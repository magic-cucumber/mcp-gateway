#!/usr/bin/env node

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {config} from "./util/args.js";
import {createProxyClient} from "./manager/client.js";
import {z} from "zod";
import {CallToolRequestSchema, raw, callback, wrapped} from "./util/rtn.js";
import {limit} from "./util/string.js";

async function main() {
    console.error('Initializing All MCP server...')
    const clients = await createProxyClient(config)
    console.error(`${clients.context.size} MCP server was initialized.`)

    const server = new McpServer({
        name: 'mcp-proxy-gateway',
        version: '1.0.0',
        description: `CRITICAL GATEWAY PROTOCOL: This is a proxy for distributed MCP servers. 
        When a required tool is missing from your context, you MUST execute this strict 3-step pipeline:
        
        1. [LISTING]: Call 'mcp-servers-all' to identify available servers. 
           NOTE: This step provides SERVER NAMES ONLY and NO tool details/parameters.
           
        2. [MANDATORY INSPECTION]: You MUST call 'mcp-server-tools' for the identified server. 
           This is the ONLY way to fetch the required JSON schemas, tool descriptions, and parameter definitions needed for execution.
           
        3. [EXECUTION]: Only after fetching the schema in Step 2, call 'mcp-server-tool-execute' with precisely mapped arguments.
        
        STRICT REQUIREMENT: Never attempt 'mcp-server-tool-execute' based on guesswork or from the output of 'mcp-servers-all' alone. The pipeline 1->2->3 is atomic and non-negotiable.`,
    }, {
        capabilities: clients.capabilities
    });

    server.registerTool(
        'mcp-servers-all',
        {
            description: 'Retrieve a summary of all available MCP servers and their tools. This provides an overview to help you identify which servers contain the functionality you need.',
            inputSchema: z.object({})
        },
        callback(async () => wrapped([...clients.context.values()].map(it => ({
            name: it.name,
            description: limit(it.description),
            tools: [...it.tools.values()].map(it => ({
                name: it.name,
                description: limit(it.description ?? ''),
            }))
        }))))
    )

    server.registerTool(
        'mcp-server-tools',
        {
            description: 'Retrieve the detailed list of tools available on a specific MCP server.',
            inputSchema: z.object({
                query: z.array(
                    z.object({
                        name: z.string()
                            .describe('The unique string of the MCP server.'),
                        tool_names: z.array(z.string()).describe("The unique string of the tool name.")
                    })
                )
            })
        },
        callback(async ({query}) => {
            const available = query.filter(q => clients.context.has(q.name));
            if (available.length === 0) {
                return wrapped({
                    error: `MCP server [${query.map(it => it.name).join(", ")}] all not found.`,
                    available: [...clients.context.keys()]
                })
            }
            return wrapped({
                data: available.map(({name, tool_names}) => {
                    const client = clients.context.get(name)!
                    const tools = tool_names.map(it => client.tools.get(it)).filter(it => it !== undefined)

                    if (tools.length === 0) {
                        return {
                            error: `tools [${tool_names.join(", ")}] all not found.`,
                            available: [...client.tools.keys()]
                        }
                    }

                    return {
                        name: client.name,
                        description: client.description,
                        tools: {
                            data: tools,
                            not_found: tool_names.filter(it => !client.tools.has(it))
                        }
                    }
                }),
                not_found: query.filter(it => !clients.context.has(it.name)).map(it => it.name)
            })
        })
    )

    server.registerTool(
        'mcp-server-tool-execute',
        {
            description: 'Execute a specific tool on a target MCP server.',
            inputSchema: z.object({
                name: z.string().describe('The unique name of the target MCP server.'),
                tool_name: z.string().describe('The name of the tool to execute.'),
                args: CallToolRequestSchema.describe('The arguments required for the tool execution.'),
            })
        },
        callback(async ({name, tool_name, args}) => {
            const context = clients.context.get(name)
            if (context === undefined) {
                return wrapped({
                    error: 'MCP server not found.',
                    available: [...clients.context.keys()]
                })
            }

            const tool = context.tools.get(tool_name)
            if (tool === undefined) {
                return wrapped({
                    error: 'Tool not found on the specified server.',
                    available: [...context.tools.keys()]
                })
            }

            return raw(await context.client.callTool({
                name: tool_name,
                arguments: args,
            }))
        }),
    )

    const transport = new StdioServerTransport()
    await server.connect(transport);
    console.error('mcp-gateway started successful.')
}

// 优雅关闭处理
process.on('SIGINT', async () => {
    process.exit(0);
});

process.on('SIGTERM', async () => {
    process.exit(0);
});

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
