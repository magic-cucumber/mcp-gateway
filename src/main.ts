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
    console.error(`${clients.keys().length} MCP server was initialized.`)

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
        capabilities: {
            tools: {}
        }
    });

    server.registerTool(
        'mcp-servers-all',
        {
            description: 'Retrieve a summary of all available MCP servers and their tools. This provides an overview to help you identify which servers contain the functionality you need.',
            inputSchema: z.object({})
        },
        callback(async () => {
            //TODO configuration cache.
            const tools = await Promise.all(clients.keys().map(it => clients.get(it)))
            return wrapped([...tools.filter(it => it !== undefined)].map(it => ({
                name: it.config.name,
                description: limit(it.config.description),
                tools: [...it.config.tools.values()].map(it => ({
                    name: it.name,
                    description: limit(it.description ?? ''),
                }))
            })))
        })
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
            const keys = new Set(...clients.keys())
            const available = query.filter(q => keys.has(q.name));
            if (available.length === 0) {
                return wrapped({
                    error: `MCP server [${query.map(it => it.name).join(", ")}] all not found.`,
                    available: [...keys]
                })
            }
            const available_client_arr = await Promise.all(
                available.map(it => clients.get(it.name))
            )

            const client_map = new Map(available_client_arr.filter(it => it !== undefined).map(it => [it.config.name, it]))
            return wrapped({
                data: available.map(({name, tool_names}) => {
                    const client = client_map.get(name)!
                    const tools = tool_names.map(it => client.tools.get(it)).filter(it => it !== undefined)

                    if (tools.length === 0) {
                        return {
                            error: `tools [${tool_names.join(", ")}] all not found.`,
                            available: [...client.config.tools.keys()]
                        }
                    }

                    return {
                        name: client.config.name,
                        description: client.config.description,
                        tools: {
                            data: tools,
                            not_found: tool_names.filter(it => !client.tools.has(it))
                        }
                    }
                }),
                not_found: query.filter(it => !keys.has(it.name)).map(it => it.name)
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
            const context = await clients.get(name)
            if (context === undefined) {
                return wrapped({
                    error: 'MCP server not found or initialize failure.',
                    available: clients.keys()
                })
            }

            const tool = context.tools.get(tool_name)
            if (tool === undefined) {
                return wrapped({
                    error: 'Tool not found on the specified server.',
                    available: context.config.tools
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
