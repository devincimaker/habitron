import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHabitron, type AnyHabitronTool } from '@habits-coach/habitron';
import { config } from './config.js';

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export function createServer(tools: AnyHabitronTool[]): McpServer {
  const server = new McpServer({ name: 'habitron', version: '1.0.0' });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      (args: Record<string, unknown>) => tool.handler(args).then(json, failure)
    );
  }
  return server;
}

const habitron = createHabitron({
  supabaseUrl: config.supabase.url,
  serviceRoleKey: config.supabase.serviceRoleKey,
  userId: config.userId,
  timezone: config.timezone,
});

// stdio transport: stdout is the protocol channel, so all logging goes to stderr.
const server = createServer(habitron.tools);
await server.connect(new StdioServerTransport());
console.error('habitron MCP server ready');
