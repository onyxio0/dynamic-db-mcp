/**
 * Base connector interface
 */

import type { QueryResult, DatabaseInfo } from '../types/index.js';

export interface DatabaseConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(query: string, timeout?: number): Promise<QueryResult>;
  listDatabases(): Promise<string[]>;
  switchDatabase(database: string): Promise<void>;
  getDatabaseInfo(database?: string): Promise<DatabaseInfo>;
  searchObjects(pattern: string, objectType?: string): Promise<Record<string, any>[]>;
}
