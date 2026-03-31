/**
 * SQL Query Executor with safety controls
 */

import type { DatabaseConnector } from '../connectors/base.js';
import type { QueryResult, ServerConfig } from '../types/index.js';
import { allowedReadOnlyKeywords } from '../types/index.js';

export class QueryExecutor {
  private readonly maxRows: number;
  private readonly readonly: boolean;
  private currentConnector: DatabaseConnector;

  constructor(
    private config: ServerConfig,
    connector: DatabaseConnector
  ) {
    this.maxRows = config.maxRows || 10000;
    this.readonly = config.readonly || false;
    this.currentConnector = connector;
  }

  async execute(query: string, timeout?: number): Promise<QueryResult> {
    // Check readonly mode
    if (this.readonly && !this.isReadOnlyQuery(query)) {
      return { 
        success: false, 
        error: 'Read-only mode: Only SELECT and SHOW operations are allowed'
      };
    }

    // Execute query
    const result = await this.currentConnector.execute(query, timeout);

    // Apply max rows limit
    if (result.success && result.rows && result.rows.length > this.maxRows) {
      result.rows = result.rows.slice(0, this.maxRows);
      result.error = `Result truncated to ${this.maxRows} rows`;
    }

    return result;
  }

  private isReadOnlyQuery(query: string): boolean {
    const trimmedQuery = query.trim().toUpperCase();
    const firstKeyword = trimmedQuery.split(/\s+/)[0];
    
    return allowedReadOnlyKeywords.some(kw => 
      firstKeyword.startsWith(kw)
    );
  }

  async listDatabases(): Promise<string[]> {
    return this.currentConnector.listDatabases();
  }

  async switchDatabase(database: string): Promise<void> {
    return this.currentConnector.switchDatabase(database);
  }

  async getDatabaseInfo(database?: string): Promise<Record<string, any>> {
    return this.currentConnector.getDatabaseInfo(database);
  }

  async searchObjects(pattern: string, objectType?: string): Promise<Record<string, any>[]> {
    return this.currentConnector.searchObjects(pattern, objectType);
  }
}
