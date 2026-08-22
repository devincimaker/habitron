import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

// stdio transport: stdout is the protocol channel, so all logging goes to stderr.
const server = createServer();
await server.connect(new StdioServerTransport());
console.error('habitron MCP server ready');
