import {MCPServersConfiguration} from "../util/validate.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {ServerCapabilities, Tool} from "@modelcontextprotocol/sdk/spec.types.js";
import merge from 'lodash.merge';
import {createPrefixTransform} from "../util/stream.js";

type ListToolsResponse = Awaited<ReturnType<InstanceType<typeof Client>["listTools"]>>;

export type Context = {
    client: Client;
    name: string;
    cmd: string;
    description: string
    tools: Map<string, Tool>;
    close: () => Promise<void>;
}

export type ProxyClient = {
    context: Map<string, Context>
    capabilities: ServerCapabilities
}


export const createProxyClient = async (config: MCPServersConfiguration): Promise<ProxyClient> => {
    const context = await Promise.all<Context>(
        Object.keys(config.mcpServers).map(async (name) => {
            const launch_args = config.mcpServers[name]
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
            const tools: ListToolsResponse['tools'] = []
            let cursor: string | undefined = undefined

            do {
                const result = await client.listTools({cursor});
                tools.push(...result.tools);
                cursor = result.nextCursor
            } while (cursor !== '' && cursor !== undefined); // 如果有 cursor 则继续循环

            return {
                client: client,
                name: name,
                cmd: `${launch_args.command} ${launch_args.args?.join(" ")}`,
                description: client.getInstructions() ?? '',
                tools: new Map(tools.map(tool => [tool.name, tool])),
                close: () => client.close(),
            }
        })
    )
    const capabilities = merge({}, context.map(it => it.client.getServerCapabilities())) as ServerCapabilities

    return {
        context: new Map(context.map(c => [c.name, c])),
        capabilities: capabilities,
    }
}
