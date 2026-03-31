/**
 * MCP Tool definitions
 */

import type { QueryExecutor } from './executor.js';

export function createTools(executor: QueryExecutor) {
  return [
    {
      name: 'list_databases',
      description: 'List all available databases on the server',
      schema: {
        type: 'object' as const,
        properties: {},
      },
      handle: async () => {
        try {
          const databases = await executor.listDatabases();
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: true, databases, count: databases.length }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: String(error) }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },
    {
      name: 'use_database',
      description: 'Switch to a different database',
      schema: {
        type: 'object' as const,
        properties: {
          database: {
            type: 'string' as const,
            description: 'The name of the database to switch to',
          },
        },
        required: ['database'],
      },
      handle: async ({ database }: { database: string }) => {
        try {
          await executor.switchDatabase(database);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: true, message: `Switched to ${database}`, database }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: String(error) }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },
    {
      name: 'execute_sql',
      description: 'Execute a SQL query on the current database',
      schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string' as const,
            description: 'The SQL query to execute',
          },
          timeout: {
            type: 'number' as const,
            description: 'Query timeout in seconds (optional)',
          },
        },
        required: ['query'],
      },
      handle: async ({ query, timeout }: { query: string; timeout?: number }) => {
        try {
          const result = await executor.execute(query, timeout);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
            isError: !result.success,
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: String(error) }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },
    {
      name: 'get_database_info',
      description: 'Get information about the current database (tables, columns)',
      schema: {
        type: 'object' as const,
        properties: {
          database: {
            type: 'string' as const,
            description: 'Database name (optional, uses current if not specified)',
          },
        },
      },
      handle: async ({ database }: { database?: string }) => {
        try {
          const info = await executor.getDatabaseInfo(database);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: true, data: info }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: String(error) }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },
    {
      name: 'search_objects',
      description: 'Search for database objects (tables, columns, procedures)',
      schema: {
        type: 'object' as const,
        properties: {
          pattern: {
            type: 'string' as const,
            description: 'Search pattern (supports % wildcard)',
          },
          type: {
            type: 'string' as const,
            enum: ['table', 'column', 'procedure', 'index'],
            description: 'Optional: filter by object type',
          },
        },
        required: ['pattern'],
      },
      handle: async ({ pattern, type }: { pattern: string; type?: string }) => {
        try {
          const results = await executor.searchObjects(pattern, type);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: true, results, count: results.length }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: String(error) }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },
  ];
}
