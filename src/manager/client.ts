import {MCPServersConfiguration} from "../util/validate.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {ServerCapabilities, Tool} from "@modelcontextprotocol/sdk/spec.types.js";
import {createPrefixTransform} from "../util/stream.js";
import {LRUCache} from 'lru-cache'

export type Context = {
    config: {
        name: string;
        cmd: string;
        args: string[];
        description: string
        capabilities: ServerCapabilities;
        tools: Tool[];
    }
    client: Client;
    tools: Map<string, Tool>
}

export type ProxyClient = {
    get: (key: string) => Promise<Context | undefined>
    keys: () => string[]
    close: () => void
}
export const createProxyClient = async (mcp_config: MCPServersConfiguration): Promise<ProxyClient> => {
    const context = new LRUCache<string, Context>({
        max: 50,
        ttl: 1000 * 60 * 5,

        allowStale: true,
        noDeleteOnFetchRejection: true,

        fetchMethod: async (key, staleValue): Promise<Context | undefined> => {
            const launch_args = mcp_config.mcpServers[key]

            if (launch_args === undefined) {
                return undefined
            }

            let client: Context;

            try {
                client = await generate_client(key, launch_args)
            } catch (e) {
                console.error(`Failed to launch MCP server [${key}]:`, e);
                const alive = await staleValue?.client.ping().then(() => true).catch(() => false)
                if (!alive) return undefined
                return staleValue
            }

            client.client.onclose = () => { //delete cache when closed
                // prevent multi-thread write
                if (context.get(key) === client) {
                    context.delete(key);
                }
            }

            return client
        },
        dispose: (value, key) => {
            console.error(`closing mcp-server: ${key}`)
            value.client.onclose = undefined
            value.client.close()
        }
    })

    let closed = false
    const close = () => {
        closed = true
        context.clear()
    }

    return {
        get: (key: string) => {
            if (closed) {
                throw new Error('closed')
            }
            return context.fetch(key)
        },
        keys: () => Object.keys(mcp_config.mcpServers),
        close: close,
    }
}


const generate_client = async (name: string, launch_args: MCPServersConfiguration['mcpServers'][string]): Promise<Context> => {
    const transport = new StdioClientTransport({
        command: launch_args.command,
        args: launch_args.args,
        env: launch_args.env,

        stderr: 'pipe'
    });

    if (transport.stderr) {
        transport.stderr
            .pipe(createPrefixTransform(`[${name}]`))
            .pipe(process.stderr);
    }

    const client = new Client({
        name: name,
        version: "1.0.0",
    })

    client.getServerCapabilities()

    await client.connect(transport)
    const tools: Tool[] = []
    let cursor: string | undefined = undefined

    do {
        const result = await client.listTools({cursor});
        tools.push(...result.tools.map(it => ({
            name: it.name,
            description: it.description,
            inputSchema: it.inputSchema,
            outputSchema: it.outputSchema,
        })));
        cursor = result.nextCursor
    } while (cursor !== '' && cursor !== undefined); // 如果有 cursor 则继续循环

    return {
        client: client,
        config: {
            name: name,
            cmd: launch_args.command,
            args: launch_args.args ?? [],
            description: client.getServerVersion()?.description ?? "",
            capabilities: client.getServerCapabilities() ?? {},
            tools: tools,
        },
        tools: new Map(tools.map(it => [it.name, it]))
    }
}
