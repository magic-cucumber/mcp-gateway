import {
    CallToolRequestSchema as InternalCallToolRequestSchema,
    CallToolResult
} from "@modelcontextprotocol/sdk/types.js";

/**
 * 这里的 T 代表你的业务函数接收的参数类型（即工具的 inputSchema）
 */

export type MCPReturn = {
    raw: boolean,
    data: object | object[]
}

export const raw = (data: object | object[]): MCPReturn => ({raw: true, data})
export const wrapped = (data: object | object[]): MCPReturn => ({raw: false, data})

export const callback = <T extends Record<string, unknown>>(
    content: (state: T) => Promise<MCPReturn> | MCPReturn,
) => {
    return async (state: T): Promise<CallToolResult> => {
        const result = await content(state);

        const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key: string, value: any) => {
                if (key.startsWith("_")) return undefined
                if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) {
                        return undefined
                    }
                    seen.add(value);
                }
                return value;
            };
        }

        if (result.raw) {
            return result.data as CallToolResult
        }

        const generate = (raw: object) => ({
            type: "text" as const,
            text: JSON.stringify(raw, getCircularReplacer())
        })

        return {
            content: Array.isArray(result.data) ? result.data.map((item) => generate(item)) : [generate(result.data)]
        };
    };
};

export const CallToolRequestSchema = InternalCallToolRequestSchema.shape.params.shape.arguments
