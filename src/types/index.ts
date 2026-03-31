/**
 * Type definitions for Dynamic Database MCP Server
 */

export type DatabaseType = 'mysql' | 'postgres';

export interface ServerConfig {
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  defaultDb?: string;
  readonly?: boolean;
  maxRows?: number;
  timeout?: number;
}

export interface QueryResult {
  success: boolean;
  rows?: Record<string, any>[];
  rowCount?: number;
  fields?: { name: string; type: string }[];
  error?: string;
}

export interface DatabaseInfo {
  name: string;
  tables: TableInfo[];
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
}

export interface ToolContext {
  currentDatabase?: string;
  readonly: boolean;
  maxRows: number;
}

export const allowedReadOnlyKeywords = [
  'SELECT',
  'SHOW',
  'DESCRIBE',
  'EXPLAIN',
  'ANALYZE',
];
