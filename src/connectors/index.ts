/**
 * Connector factory
 */

import type { DatabaseConnector } from './base.js';
import { MySQLConnector } from './mysql.js';
import { PostgresConnector } from './postgres.js';
import type { ServerConfig } from '../types/index.js';

export function createConnector(config: ServerConfig): DatabaseConnector {
  switch (config.type) {
    case 'mysql':
      return new MySQLConnector(config);
    case 'postgres':
      return new PostgresConnector(config);
    default:
      throw new Error(`Unknown database type: ${config.type}`);
  }
}

export type { DatabaseConnector } from './base.js';
