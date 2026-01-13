# mcp-gateway

mcp-gateway is a Model Context Protocol (MCP) gateway server that helps AI models selectively invoke MCP tools. It acts as an intermediary layer between AI assistants and multiple MCP servers, providing intelligent tool routing and filtering capabilities.

## Features

- **Tool Aggregation**: Aggregate multiple MCP servers into a single gateway
- **Selective Tool Invocation**: AI can selectively invoke specific tools instead of being exposed to all tools from all servers

## Installation

```bash
npm install -g mcp-gateway
```

## Configuration

Create a configuration file (e.g., `mcpConfig.json`) to define your MCP servers:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest"
      ]
    },
    "mcp-server-time": {
      "command": "uvx",
      "args": [
        "mcp-server-time",
        "--local-timezone=Asia/Shanghai"
      ],
      "alwaysAllow": [
        "get_current_time",
        "convert_time"
      ]
    }
  }
}
```


## Usage

### CLI Usage

```bash
mcp-gateway -f /path/to/your/mcpConfig.json
```

### Configure in AI Client

Add the gateway to your MCP client configuration:

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "mcp-gateway",
      "args": [
        "-f",
        "/path/to/your/mcpConfig.json"
      ]
    }
  }
}
```

### Example Prompts

> For models that require explicit instructions, recommend to start with `search MCP tool, and then...`

```
call the chrome-devtools new-page tool, then open a new tab for me
```

## Available Gateway Tools

The following tools are provided by mcp-gateway:

- `mcp-tools-search` - Search for available tools across all configured MCP servers
- `mcp-server-tools-fetch` - Get detailed information about tools from specific servers
- `mcp-server-tool-execute` - Execute a tool on a specific MCP server

## Proxy Notes

When configuring MCP servers in the gateway, please consider the following:

1. **Frequently used tools should not be proxied**: Tools that are used frequently (e.g., `sequential-thinking`) are recommended to be called directly without going through the gateway.

2. **Tools with special notes in description should not be proxied**: Some tools may have special requirements or notes in their description (e.g., `context7`). These tools should also be called directly.

For such tools, it's better to configure them directly in your AI client rather than routing them through mcp-gateway.

## Development

```bash
# Build the project
npm run build:production

# publish it to cli
npm link --force

# Development mode with a web page
npm run dev
```
