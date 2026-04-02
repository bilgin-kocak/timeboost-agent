# Step 3: Deploy & Go Agentic (Bonus)

This document describes how to deploy the Timeboost agent as a live, publicly
accessible service for additional bounty points.

## Deployment Options

### Option A: HTTP Endpoint wrapping the MCP Server (Recommended)

Wrap the MCP server in a simple HTTP server using Streamable HTTP transport:

```typescript
import { createServer } from "./timeboost-mcp/src/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";

const mcpServer = createServer({
  chain: "arbitrum",
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport("/mcp");
    await mcpServer.connect(transport);
    // Handle the request through the transport
    // See MCP SDK docs for full HTTP server setup
  }
  
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", tools: 6, chain: "arbitrum" }));
  }
});

httpServer.listen(3000, () => {
  console.log("Timeboost MCP agent running on http://localhost:3000");
});
```

**Deploy to:**
- Railway (`railway up`)
- Render (Docker or Node.js)
- Fly.io (`fly launch`)
- AWS Lambda + API Gateway
- Any VPS with Node.js 18+

### Option B: Pi.dev Agent Extension

If using Pi.dev as the agent framework:

1. Package the MCP server as a Pi.dev extension
2. Register it in the Pi.dev marketplace
3. Configure the extension to use Arbitrum RPC endpoints
4. Provide the public endpoint URL in the submission

### Option C: OpenClaw Plugin

If using OpenClaw:

1. Create an OpenClaw plugin manifest
2. Map the 6 MCP tools to OpenClaw actions
3. Deploy as a public OpenClaw workflow
4. Provide the workflow URL in the submission

## Environment Variables

For any deployment, set these environment variables:

```env
PRIVATE_KEY=0x...          # Wallet for bidding and signing
CHAIN=arbitrum             # or arbitrum-sepolia for testing
PORT=3000                  # HTTP server port
```

**Security note:** Never expose the private key in public repositories or client-side code.
Use environment variables or secret management services.

## Dockerfile (for containerized deployment)

```dockerfile
FROM node:22-slim

WORKDIR /app
COPY timeboost-mcp/ ./
RUN npm install && npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Verification

After deployment:
1. Confirm the health endpoint responds: `curl https://your-domain.com/health`
2. Test a tool call via the MCP HTTP endpoint
3. Include the public URL in your bounty submission
4. Ensure the endpoint is accessible without authentication for judges

## Documentation Requirements

The submission should include:
- Public endpoint URL
- Link to your repository with documentation
- Instructions for judges to test the deployed agent
- Any API keys or credentials needed (provide test/demo keys if required)
