#!/usr/bin/env node
/**
 * Dynamic Database MCP Server
 * 
 * A lightweight MCP server that supports dynamic database switching
 * for MySQL and PostgreSQL. Configure once, switch between databases at runtime.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig } from './config/index.js';
import { createConnector } from './connectors/index.js';
import { QueryExecutor } from './tools/executor.js';
import { createTools } from './tools/index.js';

async function main() {
  // Load configuration
  const config = getConfig();
  
  console.error(`[DynamicDB] Starting MCP server for ${config.type}`);
  console.error(`[DynamicDB] Connecting to ${config.host}:${config.port}`);
  console.error(`[DynamicDB] Readonly mode: ${config.readonly ? 'enabled' : 'disabled'}`);
  console.error(`[DynamicDB] Max rows: ${config.maxRows}`);

  // Create database connector and connect
  const connector = createConnector(config);
  await connector.connect();

  // Create query executor
  const executor = new QueryExecutor(config, connector);

  // Create MCP server
  const server = new Server(
    {
      name: 'dynamic-db-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  const tools = createTools(executor);

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.schema,
    })),
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    }

    return tool.handle(request.params.arguments || {});
  });

  // Cleanup on exit
  process.on('SIGINT', async () => {
    console.error('[DynamicDB] Shutting down...');
    await connector.disconnect();
    process.exit(0);
  });

  // Create STDIO transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[DynamicDB] MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
