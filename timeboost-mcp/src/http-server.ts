/**
 * HTTP server entry point for deploying the Timeboost MCP server.
 *
 * Wraps the existing MCP server with StreamableHTTP transport so it can
 * be accessed over the network (e.g. on Railway, Render, Fly.io).
 *
 * Usage:
 *   CHAIN=arbitrum-sepolia PORT=3000 node dist/http-server.js
 */

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { Request, Response } from "express";
import { createServer } from "./index.js";
import type { ChainName } from "./types.js";

const CHAIN = (process.env.CHAIN ?? "arbitrum") as ChainName;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const PORT = Number(process.env.PORT) || 3000;

const app = createMcpExpressApp({ host: "0.0.0.0" });

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    name: "timeboost-mcp",
    version: "1.0.0",
    chain: CHAIN,
    tools: 6,
  });
});

// MCP Streamable HTTP endpoint (stateless — new server per request)
app.post("/mcp", async (req: Request, res: Response) => {
  const server = createServer({ chain: CHAIN, privateKey: PRIVATE_KEY });

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Reject GET/DELETE on /mcp
app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST." },
    id: null,
  });
});

app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.listen(PORT, () => {
  console.log(`Timeboost MCP HTTP server listening on port ${PORT}`);
  console.log(`Chain: ${CHAIN}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`MCP:    POST http://localhost:${PORT}/mcp`);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit(0);
});
