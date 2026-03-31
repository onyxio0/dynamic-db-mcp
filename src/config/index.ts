/**
 * Configuration management
 */

import type { ServerConfig, DatabaseType } from '../types/index.js';

let cachedConfig: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const envConfig = loadEnvConfig();
  const argConfig = parseArgs();
  
  cachedConfig = mergeConfigs(envConfig, argConfig);
  validateConfig(cachedConfig);
  
  return cachedConfig;
}

function loadEnvConfig(): Partial<ServerConfig> {
  const defaultPort = (process.env.DB_TYPE as DatabaseType) === 'postgres' ? 5432 : 3306;
  
  return {
    type: (process.env.DB_TYPE as DatabaseType) || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || String(defaultPort), 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    defaultDb: process.env.DB_NAME,
    readonly: process.env.DB_READONLY === 'true',
    maxRows: parseInt(process.env.DB_MAX_ROWS || '10000', 10),
    timeout: parseInt(process.env.DB_TIMEOUT || '30', 10),
  };
}

function mergeConfigs(...configs: Partial<ServerConfig>[]): ServerConfig {
  const merged = configs.reduce((acc, conf) => ({ ...acc, ...conf }), {});
  return merged as ServerConfig;
}

function validateConfig(config: ServerConfig): void {
  if (!config.host) {
    throw new Error('Database host is required. Set DB_HOST or use --host');
  }
  if (!config.user) {
    throw new Error('Database user is required. Set DB_USER or use --user');
  }
  if (!config.password) {
    throw new Error('Database password is required. Set DB_PASSWORD or use --password');
  }
  if (config.type !== 'mysql' && config.type !== 'postgres') {
    throw new Error('Database type must be "mysql" or "postgres". Set DB_TYPE or use --type');
  }
}

function parseArgs(): Partial<ServerConfig> {
  const args = process.argv.slice(2);
  const result: Partial<ServerConfig> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    
    const key = arg.slice(2);
    const nextArg = args[i + 1];
    
    if (key === 'help' || key === 'h') {
      printHelp();
      process.exit(0);
    }
    
    switch (key) {
      case 'type':
        if (nextArg) { result.type = nextArg as DatabaseType; i++; }
        break;
      case 'host':
        if (nextArg) { result.host = nextArg; i++; }
        break;
      case 'port':
        if (nextArg) { result.port = parseInt(nextArg, 10); i++; }
        break;
      case 'user':
        if (nextArg) { result.user = nextArg; i++; }
        break;
      case 'password':
        if (nextArg) { result.password = nextArg; i++; }
        break;
      case 'db':
      case 'database':
        if (nextArg) { result.defaultDb = nextArg; i++; }
        break;
      case 'readonly':
        result.readonly = true;
        break;
      case 'max-rows':
        if (nextArg) { result.maxRows = parseInt(nextArg, 10); i++; }
        break;
      case 'timeout':
        if (nextArg) { result.timeout = parseInt(nextArg, 10); i++; }
        break;
    }
  }
  
  return result;
}

function printHelp(): void {
  console.log(`
Dynamic Database MCP Server

Usage: dynamic-db-mcp [options]

Options:
  --type <mysql|postgres>    Database type (default: mysql)
  --host <hostname>          Database host (default: localhost)
  --port <number>            Database port
                             Default: 3306 for MySQL, 5432 for PostgreSQL
  --user <username>          Database user (required)
  --password <password>      Database password (required)
  --db <database>            Default database name (optional)
  --readonly                 Enable readonly mode (default: false)
  --max-rows <number>        Maximum rows to return (default: 10000)
  --timeout <seconds>        Query timeout in seconds (default: 30)
  --help                     Show this help

Environment Variables:
  DB_TYPE, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
  DB_READONLY, DB_MAX_ROWS, DB_TIMEOUT

Examples:
  # MySQL
  dynamic-db-mcp --type mysql --host 10.0.0.1 --user root --password secret

  # PostgreSQL
  dynamic-db-mcp --type postgres --host 10.0.0.1 --user postgres --password secret
`);
}
