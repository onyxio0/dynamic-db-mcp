/**
 * MySQL Connector
 */

import mysql from 'mysql2/promise';
import type { DatabaseConnector } from './base.js';
import type { ServerConfig, QueryResult, DatabaseInfo, TableInfo, ColumnInfo } from '../types/index.js';

export class MySQLConnector implements DatabaseConnector {
  private connection: mysql.Connection | null = null;
  private metadataConnection: mysql.Connection | null = null;
  private currentDatabase = '';
  private host: string;
  private port: number;
  private user: string;
  private password: string;

  constructor(private config: ServerConfig) {
    this.host = config.host;
    this.port = config.port || 3306;
    this.user = config.user;
    this.password = config.password;
  }

  async connect(): Promise<void> {
    try {
      // Connection for executing queries
      this.connection = await mysql.createConnection({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.config.defaultDb,
        connectTimeout: (this.config.timeout || 30) * 1000,
        enableKeepAlive: true,
      });

      if (this.config.defaultDb) {
        this.currentDatabase = this.config.defaultDb;
      }

      // Metadata connection (for listing databases)
      this.metadataConnection = await mysql.createConnection({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        connectTimeout: (this.config.timeout || 30) * 1000,
        enableKeepAlive: true,
      });

      console.error(`[MySQL] Connected to ${this.host}:${this.port}`);
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
    if (this.metadataConnection) {
      await this.metadataConnection.end();
      this.metadataConnection = null;
    }
    console.error('[MySQL] Disconnected');
  }

  async execute(query: string, timeout?: number): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    try {
      const [rows, fields] = await this.connection.execute({
        sql: query,
        timeout: (timeout || this.config.timeout || 30) * 1000,
      }) as [any, mysql.FieldPacket[]];

      const formattedFields = Array.isArray(fields) ? fields.map(f => ({
        name: f.name || 'unknown',
        type: this.mapFieldType(f.type),
      })) : [];

      return {
        success: true,
        rows: rows as Record<string, any>[],
        rowCount: (rows as any[]).length,
        fields: formattedFields,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.metadataConnection) {
      throw new Error('Not connected to database');
    }

    const [rows] = await this.metadataConnection.execute(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY schema_name"
    );

    return (rows as any[]).map(r => r.SCHEMA_NAME || r.schema_name);
  }

  async switchDatabase(database: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    await this.connection.execute(`USE \`${database}\``);
    this.currentDatabase = database;
    console.error(`[MySQL] Switched to database: ${database}`);
  }

  async getDatabaseInfo(database?: string): Promise<DatabaseInfo> {
    if (!this.metadataConnection) {
      throw new Error('Not connected to database');
    }

    const db = database || this.currentDatabase;
    if (!db) {
      throw new Error('No database selected. Use use_database to select one.');
    }

    const [tableRows] = await this.metadataConnection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [db]
    );

    const tables: TableInfo[] = [];

    for (const row of tableRows as any[]) {
      const tableName = row.TABLE_NAME || row.table_name;
      
      const [columnRows] = await this.metadataConnection.execute(
        `SELECT column_name, data_type, is_nullable, column_default, column_key
         FROM information_schema.columns 
         WHERE table_schema = ? AND table_name = ?`,
        [db, tableName]
      );

      const columns: ColumnInfo[] = (columnRows as any[]).map(col => ({
        name: col.COLUMN_NAME || col.column_name,
        type: col.DATA_TYPE || col.data_type,
        nullable: (col.IS_NULLABLE || col.is_nullable) === 'YES',
        defaultValue: col.COLUMN_DEFAULT || col.column_default,
        isPrimaryKey: (col.COLUMN_KEY || col.column_key) === 'PRI',
      }));

      tables.push({ name: tableName, columns });
    }

    return { name: db, tables };
  }

  async searchObjects(pattern: string, objectType?: string): Promise<Record<string, any>[]> {
    if (!this.metadataConnection) {
      throw new Error('Not connected to database');
    }

    const db = this.currentDatabase;
    if (!db) {
      throw new Error('No database selected');
    }

    const results: Record<string, any>[] = [];

    // Search tables
    if (!objectType || objectType === 'table') {
      const [tableRows] = await this.metadataConnection.execute(
        `SELECT table_name, table_type, engine FROM information_schema.tables 
         WHERE table_schema = ? AND table_name LIKE ?`,
        [db, `%${pattern}%`]
      );

      (tableRows as any[]).forEach(row => {
        results.push({
          type: 'table',
          name: row.TABLE_NAME || row.table_name,
          additional: `Engine: ${row.ENGINE || row.engine || 'N/A'}`,
          schema: db,
        });
      });
    }

    // Search columns
    if (!objectType || objectType === 'column') {
      const [columnRows] = await this.metadataConnection.execute(
        `SELECT table_name, column_name, data_type FROM information_schema.columns 
         WHERE table_schema = ? AND column_name LIKE ?`,
        [db, `%${pattern}%`]
      );

      (columnRows as any[]).forEach(row => {
        results.push({
          type: 'column',
          name: row.COLUMN_NAME || row.column_name,
          parent: row.TABLE_NAME || row.table_name,
          dataType: row.DATA_TYPE || row.data_type,
          schema: db,
        });
      });
    }

    // Search procedures/functions
    if (!objectType || objectType === 'procedure') {
      const [procRows] = await this.metadataConnection.execute(
        `SELECT routine_name, routine_type FROM information_schema.routines 
         WHERE routine_schema = ? AND routine_name LIKE ?`,
        [db, `%${pattern}%`]
      );

      (procRows as any[]).forEach(row => {
        results.push({
          type: row.ROUTINE_TYPE || row.routine_type || 'procedure',
          name: row.ROUTINE_NAME || row.routine_name,
          schema: db,
        });
      });
    }

    return results;
  }

  private mapFieldType(type: number | undefined): string {
    if (type === undefined) return 'unknown';
    const typeMap: Record<number, string> = {
      0: 'decimal', 1: 'tiny', 2: 'short', 3: 'long', 4: 'float',
      5: 'double', 6: 'null', 7: 'timestamp', 8: 'longlong',
      9: 'int24', 10: 'date', 11: 'time', 12: 'datetime',
      13: 'year', 14: 'newdate', 15: 'varchar', 16: 'bit',
      246: 'decimal', 247: 'enum', 248: 'set',
      249: 'tiny_blob', 250: 'medium_blob', 251: 'long_blob',
      252: 'blob', 253: 'varchar', 254: 'string', 255: 'geometry',
    };
    return typeMap[type] || `type_${type}`;
  }
}
