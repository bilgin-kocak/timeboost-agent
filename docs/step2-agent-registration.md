# Step 2: Register Your Agent on Arbitrum Identity Registry

This document describes how to register the Timeboost MCP agent on the Arbitrum
identity registry using the ERC-8004 standard.

## Overview

The Arbitrum identity registry is an ERC-8004 compliant on-chain registry where
agents can register their identity, capabilities, and metadata. Each registered
agent is minted as a unique NFT.

## Registry Contract Addresses

| Chain | Registry Address |
|-------|-----------------|
| Arbitrum One | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Arbitrum Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

## Registration Approaches

### Option A: Using Agent0 SDK (Recommended)

The Agent0 SDK (`@agent0/sdk`) provides a TypeScript-friendly interface for agent registration.

```bash
npm install @agent0/sdk
```

```typescript
import { Agent0 } from "@agent0/sdk";

// Initialize with your wallet
const agent0 = new Agent0({
  privateKey: process.env.PRIVATE_KEY,
  chain: "arbitrum-sepolia", // or "arbitrum" for mainnet
});

// Register the agent
const registration = await agent0.register({
  name: "Timeboost Express Lane Agent",
  description: "AI agent for Arbitrum Timeboost express lane intelligence — bidding, tx submission, and strategy",
  capabilities: [
    "timeboost-round-state",
    "timeboost-bid-history",
    "timeboost-boost-analysis",
    "timeboost-bid-submission",
    "timeboost-express-lane-tx",
    "timeboost-verification",
  ],
  metadata: {
    type: "mcp-server",
    mcpTools: 6,
    protocol: "timeboost",
    chain: "arbitrum",
  },
});

console.log("Agent registered! Token ID:", registration.tokenId);
```

### Option B: Direct Contract Interaction (Using viem)

If the Agent0 SDK is unavailable, interact directly with the registry contract:

```typescript
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; // Sepolia
const REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const client = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(),
});

// Prepare metadata JSON (host on IPFS or GitHub)
const metadataURI = "ipfs://QmYourMetadataHash"; // or raw GitHub URL

const txHash = await client.writeContract({
  address: REGISTRY_ADDRESS as `0x${string}`,
  abi: REGISTRY_ABI,
  functionName: "register",
  args: ["Timeboost Express Lane Agent", metadataURI],
});

console.log("Registration tx:", txHash);
```

### Option C: Using the Arbitrum-specific Implementation

Check the official ArbiLink documentation for any Arbitrum-specific registration
tooling that may provide a simpler flow.

## Agent Metadata

The metadata should describe the agent's capabilities:

```json
{
  "name": "Timeboost Express Lane Agent",
  "description": "MCP server skill providing 6 tools for Arbitrum Timeboost express lane intelligence",
  "version": "1.0.0",
  "type": "mcp-server",
  "capabilities": [
    "get_timeboost_round_state",
    "get_bid_history",
    "analyze_should_boost",
    "bid_for_express_lane",
    "send_express_lane_tx",
    "check_timeboosted"
  ],
  "protocol": "timeboost",
  "chains": ["arbitrum", "arbitrum-sepolia"],
  "repository": "https://github.com/bilgin-kocak/timeboost-agent",
  "wallet": "0xYourAgentWalletAddress"
}
```

## Verification

After registration:
1. Check the registry on Arbiscan to confirm your agent NFT was minted
2. Verify the metadata URI resolves correctly
3. Include the registration transaction hash in your bounty submission

## Notes

- Register on **Arbitrum Sepolia** first for testing (no real ETH needed beyond gas)
- The registry contract address uses a vanity prefix `0x8004` for easy identification
- Each agent gets a unique NFT representing its on-chain identity
- The ERC-8004 standard enables permissionless agent discovery
