/**
 * PostgreSQL Connector
 */

import { Client } from 'pg';
import type { DatabaseConnector } from './base.js';
import type { ServerConfig, QueryResult, DatabaseInfo, TableInfo, ColumnInfo } from '../types/index.js';

export class PostgresConnector implements DatabaseConnector {
  private client: Client | null = null;
  private currentDatabase = '';
  private host: string;
  private port: number;
  private user: string;
  private password: string;

  constructor(private config: ServerConfig) {
    this.host = config.host;
    this.port = config.port || 5432;
    this.user = config.user;
    this.password = config.password;
  }

  private createConnectionOptions(database?: string) {
    return {
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      database: database || 'postgres',
      connectionTimeoutMillis: (this.config.timeout || 30) * 1000,
      query_timeout: (this.config.timeout || 30) * 1000,
    };
  }

  async connect(): Promise<void> {
    try {
      this.client = new Client(this.createConnectionOptions(this.config.defaultDb));
      await this.client.connect();

      if (this.config.defaultDb) {
        this.currentDatabase = this.config.defaultDb;
      }

      console.error(`[PostgreSQL] Connected to ${this.host}:${this.port}`);
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    console.error('[PostgreSQL] Disconnected');
  }

  async execute(query: string, timeout?: number): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    try {
      const result = await this.client.query({
        text: query,
        timeout: (timeout || this.config.timeout || 30) * 1000,
      });

      const fields = result.fields.map(f => ({
        name: f.name,
        type: this.mapDataType(f.dataTypeID),
      }));

      return {
        success: true,
        rows: result.rows as Record<string, any>[],
        rowCount: result.rowCount || 0,
        fields,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    // Query postgres database for list of databases
    const tempClient = new Client(this.createConnectionOptions('postgres'));
    await tempClient.connect();
    
    const result = await tempClient.query(
      `SELECT datname FROM pg_database 
       WHERE datistemplate = false AND datname != 'postgres'
       ORDER BY datname`
    );
    
    await tempClient.end();
    return result.rows.map(r => r.datname);
  }

  async switchDatabase(database: string): Promise<void> {
    if (this.client) {
      await this.client.end();
    }

    this.client = new Client(this.createConnectionOptions(database));
    await this.client.connect();
    this.currentDatabase = database;
    console.error(`[PostgreSQL] Switched to database: ${database}`);
  }

  async getDatabaseInfo(database?: string): Promise<DatabaseInfo> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    const db = database || this.currentDatabase;
    if (!db) {
      throw new Error('No database selected');
    }

    const result = await this.execute(`
      SELECT 
        t.table_name,
        json_agg(
          json_build_object(
            'name', c.column_name,
            'type', c.data_type,
            'nullable', c.is_nullable = 'YES',
            'defaultValue', c.column_default,
            'isPrimaryKey', tc.constraint_type = 'PRIMARY KEY'
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      LEFT JOIN information_schema.table_constraints tc 
        ON tc.table_name = t.table_name AND tc.table_schema = t.table_schema AND tc.constraint_type = 'PRIMARY KEY'
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name
    `);

    if (!result.success) {
      throw new Error(result.error);
    }

    const tables: TableInfo[] = result.rows?.map(row => ({
      name: row.table_name,
      schema: 'public',
      columns: row.columns || [],
    })) || [];

    return { name: db, tables };
  }

  async searchObjects(pattern: string, objectType?: string): Promise<Record<string, any>[]> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    const results: Record<string, any>[] = [];

    // Search tables
    if (!objectType || objectType === 'table') {
      const result = await this.execute(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name ILIKE '%${pattern}%'
        ORDER BY table_name
      `);

      if (result.success && result.rows) {
        result.rows.forEach(row => {
          results.push({ type: 'table', name: row.table_name, schema: 'public' });
        });
      }
    }

    // Search columns
    if (!objectType || objectType === 'column') {
      const result = await this.execute(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name ILIKE '%${pattern}%'
        ORDER BY table_name, ordinal_position
      `);

      if (result.success && result.rows) {
        result.rows.forEach(row => {
          results.push({
            type: 'column',
            name: row.column_name,
            parent: row.table_name,
            dataType: row.data_type,
            schema: 'public',
          });
        });
      }
    }

    // Search functions/procedures
    if (!objectType || objectType === 'procedure') {
      const result = await this.execute(`
        SELECT routine_name, routine_type FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name ILIKE '%${pattern}%'
        ORDER BY routine_name
      `);

      if (result.success && result.rows) {
        result.rows.forEach(row => {
          results.push({
            type: row.routine_type || 'function',
            name: row.routine_name,
            schema: 'public',
          });
        });
      }
    }

    // Search indexes
    if (!objectType || objectType === 'index') {
      const result = await this.execute(`
        SELECT indexname, tablename FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname ILIKE '%${pattern}%'
        ORDER BY indexname
      `);

      if (result.success && result.rows) {
        result.rows.forEach(row => {
          results.push({
            type: 'index',
            name: row.indexname,
            parent: row.tablename,
            schema: 'public',
          });
        });
      }
    }

    return results;
  }

  private mapDataType(oid: number): string {
    const typeMap: Record<number, string> = {
      16: 'boolean', 17: 'bytea', 18: 'char', 19: 'name', 20: 'int8',
      21: 'int2', 23: 'int4', 25: 'text', 26: 'oid', 114: 'json',
      116: 'jsonb', 700: 'float4', 701: 'float8', 1009: 'text[]',
      1043: 'varchar', 1042: 'bpchar', 1114: 'timestamp', 1184: 'timestamptz',
      1082: 'date', 1083: 'time', 1186: 'interval', 1266: 'timetz',
    };
    return typeMap[oid] || `oid_${oid}`;
  }
}
