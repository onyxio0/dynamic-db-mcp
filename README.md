# Dynamic Database MCP Server

A lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that supports **MySQL** and **PostgreSQL** with **runtime dynamic database switching**. Unlike other MCP database servers that require pre-configuration of each database, this server allows you to connect once and switch between any database on the same server at runtime.

## Features

- 🎯 **Dynamic Database Switching** — List all databases and switch between them at runtime
- 🔄 **Multi-Database Support** — Works with both MySQL and PostgreSQL
- 🔒 **Readonly Mode** — Enforce read-only operations for safety
- 🔍 **Schema Exploration** — Browse tables, columns, indexes, and procedures
- 📊 **Result Limits** — Prevent accidentally fetching too many rows
- ⚡ **STDIO Transport** — Compatible with all MCP clients (Claude Desktop, Cursor, etc.)

## Installation

```bash
# Clone and install
git clone https://github.com/onyxio0/dynamic-db-mcp.git
cd dynamic-db-mcp
npm install

# Build
npm run build

# Or use directly with npx
npx dynamic-db-mcp --help
```

## Quick Start

### Environment Variables

```bash
# For MySQL
export DB_TYPE=mysql
export DB_HOST=10.0.0.1
export DB_USER=root
export DB_PASSWORD=secret
export DB_READONLY=true  # Optional
export DB_MAX_ROWS=1000    # Optional

# For PostgreSQL
export DB_TYPE=postgres
export DB_HOST=10.0.0.1
export DB_USER=postgres
export DB_PASSWORD=secret
```

### Command Line Arguments

```bash
# MySQL example
node dist/index.js --type mysql --host 10.0.0.1 --user root --password secret

# PostgreSQL example
node dist/index.js --type postgres --host 10.0.0.1 --user postgres --password secret

# With readonly mode and limits
node dist/index.js \
  --type mysql \
  --host localhost \
  --user readonly \
  --password pass \
  --readonly \
  --max-rows 500
```

## MCP Configuration

Add to your MCP client configuration (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dynamic-db": {
      "command": "node",
      "args": [
        "/path/to/dynamic-db-mcp/dist/index.js",
        "--type", "mysql",
        "--host", "10.0.0.1",
        "--port", "3306",
        "--user", "root",
        "--password", "secret"
      ],
      "env": {
        "DB_READONLY": "false",
        "DB_MAX_ROWS": "10000"
      }
    }
  }
}
```

## Available Tools

### 1. `list_databases`
List all databases available on the server.

```typescript
// Usage
{
  "name": "list_databases",
  "arguments": {}
}

// Response
{
  "success": true,
  "databases": ["db_a", "db_b", "db_c"],
  "count": 3
}
```

### 2. `use_database`
Switch to a different database.

```typescript
// Usage
{
  "name": "use_database",
  "arguments": {
    "database": "db_a"
  }
}

// Response
{
  "success": true,
  "message": "Switched to db_a",
  "database": "db_a"
}
```

### 3. `execute_sql`
Execute SQL queries on the current database.

```typescript
// Usage
{
  "name": "execute_sql",
  "arguments": {
    "query": "SELECT * FROM users LIMIT 10",
    "timeout": 30  // Optional
  }
}

// Response
{
  "success": true,
  "rows": [...],
  "rowCount": 10,
  "fields": [...]
}
```

### 4. `get_database_info`
Get schema information about the current database (tables and columns).

```typescript
// Usage
{
  "name": "get_database_info",
  "arguments": {}
}

// Response
{
  "success": true,
  "data": {
    "name": "db_a",
    "tables": [
      {
        "name": "users",
        "columns": [
          { "name": "id", "type": "bigint", "nullable": false, "isPrimaryKey": true },
          { "name": "name", "type": "varchar", "nullable": true }
        ]
      }
    ]
  }
}
```

### 5. `search_objects`
Search for database objects (tables, columns, procedures) by pattern.

```typescript
// Usage
{
  "name": "search_objects",
  "arguments": {
    "pattern": "%user%",
    "type": "table"  // Optional: "table" | "column" | "procedure" | "index"
  }
}
```

## How It Differs from Other MCP Database Servers

| Feature | DBHub | MCP Toolbox | **Dynamic DB MCP** |
|--------|-------|-------------|-------------------|
| Multiple databases | Pre-configure in TOML | Pre-define tools | ✅ **Runtime switching** |
| Database discovery | Manual | Manual | ✅ **Auto list** |
| Same server, different dbs | Separate config | Separate config | ✅ **One connection** |
| Dynamic SQL | ✅ | Pre-defined queries | ✅ **Full SQL control** |

**Use this when:**
- You have many databases on the same MySQL/PostgreSQL server
- Database names change frequently
- You want AI to discover and explore databases dynamically
- You prefer one connection instead of multiple separate configurations

## Architecture

```
┌──────────────┐      MCP      ┌─────────────────────┐      SQL      ┌──────────────┐
│ Claude/Cursor│ ◄───────────► │  Dynamic DB MCP     │ ◄───────────► │ PostgreSQL   │
│  etc.        │               │  Server             │               │ or MySQL     │
└──────────────┘               └─────────────────────┘               └──────────────┘
                                    │
                                    │ list_databases()
                                    │ use_database(db_name)
                                    │ execute_sql(query)
                                    │ get_database_info()
                                    │ search_objects(pattern)
```

## Security

- **readonly mode**: Enforces only SELECT/SHOW operations
- **max_rows limit**: Prevents accidentally fetching huge result sets
- **query timeout**: Prevents long-running queries

Configure via command-line flags or environment variables.

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev -- --type mysql --host localhost --user root --password secret

# Type check
npm run typecheck

# Build
npm run build
```

## License

MIT
