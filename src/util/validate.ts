import {z} from "zod";

const McpServerSchema = z.object({
    command: z.string().min(1, "Command is required"),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
});

// 定义完整的配置校验规则
export const MCPServersConfigurationSchema = z.object({
    mcpServers: z.record(z.string(), McpServerSchema),
});

// 导出类型
export type MCPServersConfiguration = z.infer<typeof MCPServersConfigurationSchema>;
