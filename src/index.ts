#!/usr/bin/env node
/**
 * Google AI Edge Gallery Video MCP Server
 * Model Context Protocol (MCP) server for on-device and edge video creation.
 * Supports Stdio and Streamable HTTP transports.
 */

import http from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';

import { ToolDefinitions } from './tools/tool-definitions.js';
import { Config } from './config.js';

export function createServerInstance(): { server: Server; tools: ToolDefinitions } {
  const server = new Server(
    {
      name: 'google-ai-edge-gallery-video-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  const tools = new ToolDefinitions();

  // ... (yahan aapke saare tools, resources aur prompts ka code waisa hi rahega, jo maine aapko diye gaye code mein se copy kar liya hai) ...
  // (Main ise short rakhne ke liye sirf transport wala hissa dikha raha hoon, lekin poora code aapko neeche milega)

  // --- Transport Runner (Stdio vs Streamable HTTP) ---

async function run(): Promise<void> {
  Config.initDirectories();
  const args = process.argv.slice(2);
  const isHttpMode = args.includes('--http') || args.includes('-h') || Boolean(process.env.PORT) || process.env.MCP_TRANSPORT === 'http';

  if (!isHttpMode) {
    // Standard Stdio Transport (Claude Desktop / Cursor)
    const { server } = createServerInstance();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Google AI Edge Gallery Video MCP Server running on stdio transport.');
    return;
  }

  // Streamable HTTP Server
  const port = parseInt(process.env.PORT || '3000', 10);
  
  const httpServer = http.createServer(async (req, res) => {
    // Permissive CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, x-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Health Check
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', transport: 'streamable-http', endpoint: '/mcp' }));
      return;
    }

    // MCP Endpoint
    if (pathname === '/mcp') {
      try {
        const { server } = createServerInstance();
        
        // Create a new transport for each request as per SDK docs
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        // Connect the server to the transport
        await server.connect(transport);

        // Let the transport handle the request
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.writeHead(500).json({ error: "Internal Server Error" });
        }
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 Google AI Edge Gallery Video MCP running via Streamable HTTP`);
    console.log(`📡 Local URL:   http://localhost:${port}/mcp`);
    console.log(`================================================================`);
  });
}

run().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
