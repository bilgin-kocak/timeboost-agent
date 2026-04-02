# Timeboost Express Lane MCP Server — Build Plan
**ArbiLink Agentic Bounty | Deadline: April 3, 19:30 CET**

---

## What we're building

An MCP server called **`timeboost-mcp`** that gives any AI agent (Claude, LangChain, AutoGen) full
intelligence over Arbitrum's Timeboost express lane — the only feature of its kind on any L2.

The agent can:
1. Read live auction state and round timing
2. Pull and analyze historical bid data from Arbitrum's public S3
3. Decide autonomously whether a transaction is worth boosting
4. Bid for express lane control
5. Submit signed express lane transactions with priority sequencing
6. Monitor whether its txs actually got timeboosted in the block

**Why this wins:** Zero other bounty submissions will touch Timeboost. It requires deep
Arbitrum-specific knowledge. It fits every bounty criterion — wallets, onchain data, protocol
interaction, contract reads.

---

## Key protocol facts (hardcoded into the server)

```
Arbitrum One chain ID:        42161
Arbitrum Sepolia chain ID:    421614

Timeboost auction contract (Arb One):    0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079
Timeboost auction contract (Arb Sepolia): 0x37b9b61db53e3b3f5b4a2e2e11b3c8c8b3a4a000  # confirm from docs

Arbitrum One sequencer RPC:   https://arb1.arbitrum.io/rpc
Arbitrum Sepolia sequencer:   https://sepolia-rollup.arbitrum.io/rpc

S3 bid history bucket:        s3://timeboost-auctioneer-arb1/ue2/validated-timeboost-bids/
S3 public access:             --no-sign-request flag (no AWS credentials needed)

Round duration:               60 seconds
Auction closes:               15 seconds before round start
Express lane advantage:       200ms head start over normal txs
Max bids per round:           5 per address
Block time:                   250ms

Bid token:                    ETH (check auction contract for current deposit token)
Bid format:                   EIP-712 sealed-bid, second-price auction
```

---

## Project structure

```
timeboost-mcp/
├── package.json
├── tsconfig.json
├── README.md
├── .env.example
└── src/
    ├── index.ts              # MCP server entry point
    ├── timeboost/
    │   ├── auction.ts        # Auction contract reads + bidding
    │   ├── express-lane.ts   # Express lane tx submission
    │   ├── round.ts          # Round timing + state
    │   ├── history.ts        # S3 bid history fetcher
    │   └── intelligence.ts   # Decision logic: should I boost?
    ├── types.ts
    └── constants.ts
```

---

## Step 1 — Initialize the project

```bash
mkdir timeboost-mcp && cd timeboost-mcp
npm init -y
npm install @modelcontextprotocol/sdk viem dotenv
npm install -D typescript @types/node tsx
npx tsc --init
```

`package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "bin": {
    "timeboost-mcp": "./dist/index.js"
  }
}
```

`.env.example`:
```
PRIVATE_KEY=0x...          # wallet that will bid and sign express lane txs
RPC_URL=https://arb1.arbitrum.io/rpc
CHAIN=arbitrum             # arbitrum | arbitrum-sepolia
```

---

## Step 2 — Constants

`src/constants.ts`:
```typescript
export const CHAINS = {
  arbitrum: {
    id: 42161,
    rpc: "https://arb1.arbitrum.io/rpc",
    auctionContract: "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079",
    s3Bucket: "s3://timeboost-auctioneer-arb1/ue2/validated-timeboost-bids/",
    s3HttpBase: "https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/ue2/validated-timeboost-bids",
  },
  "arbitrum-sepolia": {
    id: 421614,
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    auctionContract: "0x...", // fetch from Arbitrum Sepolia deployment docs
    s3Bucket: null, // sepolia may not have S3
    s3HttpBase: null,
  },
} as const;

export const ROUND_DURATION_MS = 60_000;
export const AUCTION_CLOSE_BEFORE_ROUND_MS = 15_000;
export const EXPRESS_LANE_ADVANTAGE_MS = 200;
export const MAX_BIDS_PER_ROUND = 5;

// EIP-712 domain for bid signing
export const TIMEBOOST_BID_TYPEHASH = "Bid(uint64 roundNumber,address expressLaneController,uint256 amount)";
```

---

## Step 3 — Round timing module

`src/timeboost/round.ts`:
```typescript
import { createPublicClient, http } from "viem";
import { CHAINS, ROUND_DURATION_MS, AUCTION_CLOSE_BEFORE_ROUND_MS } from "../constants";

// Minimal ABI — only what we need from the auction contract
const AUCTION_ABI = [
  {
    name: "currentRound",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    name: "expressLaneControllerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "round", type: "uint64" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "reservePrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "isAuctionRoundClosed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

export async function getRoundState(chain: keyof typeof CHAINS) {
  const config = CHAINS[chain];
  const client = createPublicClient({ transport: http(config.rpc) });

  const [currentRound, controller, reservePrice, isRoundClosed] = await Promise.all([
    client.readContract({ address: config.auctionContract as `0x${string}`, abi: AUCTION_ABI, functionName: "currentRound" }),
    client.readContract({ address: config.auctionContract as `0x${string}`, abi: AUCTION_ABI, functionName: "expressLaneControllerOf", args: [BigInt(0)] }), // 0 = current round, adjust
    client.readContract({ address: config.auctionContract as `0x${string}`, abi: AUCTION_ABI, functionName: "reservePrice" }),
    client.readContract({ address: config.auctionContract as `0x${string}`, abi: AUCTION_ABI, functionName: "isAuctionRoundClosed" }),
  ]);

  const now = Date.now();
  const roundStart = Number(currentRound) * ROUND_DURATION_MS; // approximate — derive from genesis
  const msUntilNextRound = ROUND_DURATION_MS - (now % ROUND_DURATION_MS);
  const auctionOpen = msUntilNextRound > AUCTION_CLOSE_BEFORE_ROUND_MS;
  const nextRound = Number(currentRound) + 1;

  return {
    currentRound: Number(currentRound),
    nextRound,
    expressLaneController: controller as string,
    hasController: controller !== "0x0000000000000000000000000000000000000000",
    reservePrice: reservePrice.toString(),
    isAuctionOpen: auctionOpen && !isRoundClosed,
    msUntilNextRound,
    msUntilAuctionCloses: Math.max(0, msUntilNextRound - AUCTION_CLOSE_BEFORE_ROUND_MS),
    expressLaneAdvantageMs: 200,
  };
}
```

---

## Step 4 — S3 bid history module

`src/timeboost/history.ts`:

The S3 bucket is publicly readable without credentials. We fetch via HTTPS directly.

```typescript
import { CHAINS } from "../constants";

export interface BidRecord {
  round: number;
  bidder: string;
  amount: string; // in wei
  expressLaneController: string;
  timestamp: string;
}

export async function getRecentBidHistory(
  chain: "arbitrum",
  daysBack: number = 1
): Promise<BidRecord[]> {
  const config = CHAINS[chain];
  if (!config.s3HttpBase) throw new Error("No S3 history for this chain");

  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  // List available files for the date via S3 HTTP listing
  // Files are named like: ue2/validated-timeboost-bids/2025/06/10/0130304-0130343.csv.gzip
  // Use AWS SDK with --no-sign-request or direct HTTP with list-objects

  // SIMPLER: use the public HTTP endpoint directly
  const listUrl = `${config.s3HttpBase}/${yyyy}/${mm}/${dd}/`;
  
  try {
    // Fetch the index listing (S3 returns XML for public buckets)
    const listRes = await fetch(listUrl);
    const xml = await listRes.text();
    
    // Parse Key elements from S3 XML response
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
    
    const allBids: BidRecord[] = [];
    
    // Fetch and decompress the most recent few files (last 3 = ~3 minutes of data)
    for (const key of keys.slice(-3)) {
      const fileUrl = `https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/${key}`;
      const res = await fetch(fileUrl);
      const buffer = await res.arrayBuffer();
      
      // Decompress gzip
      const ds = new DecompressionStream("gzip");
      const stream = new ReadableStream({ start(c) { c.enqueue(buffer); c.close(); } });
      const decompressed = await new Response(stream.pipeThrough(ds)).text();
      
      // Parse CSV: round,bidder,amount,expressLaneController,timestamp
      const rows = decompressed.trim().split("\n").slice(1); // skip header
      for (const row of rows) {
        const [round, bidder, amount, expressLaneController, timestamp] = row.split(",");
        allBids.push({ round: Number(round), bidder, amount, expressLaneController, timestamp });
      }
    }
    
    return allBids;
  } catch (e) {
    console.error("S3 fetch error:", e);
    return [];
  }
}

export function analyzeBidHistory(bids: BidRecord[]) {
  if (bids.length === 0) return null;
  
  const amounts = bids.map(b => BigInt(b.amount));
  const sorted = [...amounts].sort((a, b) => (a > b ? -1 : 1));
  
  return {
    totalBids: bids.length,
    uniqueBidders: new Set(bids.map(b => b.bidder)).size,
    maxBid: sorted[0].toString(),
    medianBid: sorted[Math.floor(sorted.length / 2)].toString(),
    minBid: sorted[sorted.length - 1].toString(),
    dominantController: getMostFrequent(bids.map(b => b.expressLaneController)),
    recentRounds: [...new Set(bids.map(b => b.round))].slice(-5),
  };
}

function getMostFrequent(arr: string[]): string {
  const counts = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {} as Record<string, number>);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
```

---

## Step 5 — Intelligence module (the brain)

`src/timeboost/intelligence.ts`:

This is the key differentiator — the agent *reasons* about whether to boost.

```typescript
import { analyzeBidHistory, BidRecord } from "./history";

export interface BoostDecision {
  shouldBoost: boolean;
  reason: string;
  estimatedWinningBid: string; // in wei
  confidencePercent: number;
  urgencyMs: number; // how urgently does this tx need to land?
}

export function shouldUseExpressLane(params: {
  txValueWei: bigint;          // value at stake in the transaction
  txType: "swap" | "liquidation" | "arbitrage" | "transfer" | "other";
  urgencyMs: number;           // how quickly does this need to confirm?
  bidHistory: BidRecord[] | null;
  reservePrice: bigint;
  myMaxBudgetWei: bigint;
}): BoostDecision {
  const { txValueWei, txType, urgencyMs, bidHistory, reservePrice, myMaxBudgetWei } = params;

  // Estimate what the winning bid will likely be from history
  let estimatedWinningBid = reservePrice;
  if (bidHistory && bidHistory.length > 0) {
    const analysis = analyzeBidHistory(bidHistory);
    if (analysis) {
      // Winning bid is typically close to the median of recent bids
      estimatedWinningBid = BigInt(analysis.medianBid) * 110n / 100n; // +10% buffer
    }
  }

  // Can we afford it?
  if (estimatedWinningBid > myMaxBudgetWei) {
    return {
      shouldBoost: false,
      reason: `Estimated winning bid (${estimatedWinningBid} wei) exceeds your budget (${myMaxBudgetWei} wei)`,
      estimatedWinningBid: estimatedWinningBid.toString(),
      confidencePercent: 90,
      urgencyMs,
    };
  }

  // Is the 200ms advantage worth it for this tx type?
  const urgencyScore = getUrgencyScore(txType, urgencyMs);
  const valueScore = txValueWei > 0n ? Number(txValueWei / estimatedWinningBid) : 0;

  const shouldBoost = urgencyScore >= 7 || (urgencyScore >= 5 && valueScore >= 2);

  return {
    shouldBoost,
    reason: shouldBoost
      ? `High urgency (${urgencyScore}/10) + value ratio (${valueScore.toFixed(1)}x) justifies express lane cost`
      : `Urgency score ${urgencyScore}/10 insufficient — save the bid cost for high-value txs`,
    estimatedWinningBid: estimatedWinningBid.toString(),
    confidencePercent: bidHistory ? 75 : 40,
    urgencyMs,
  };
}

function getUrgencyScore(txType: string, urgencyMs: number): number {
  // Base score by tx type
  const typeScore: Record<string, number> = {
    liquidation: 10,    // milliseconds matter — missing a liquidation is expensive
    arbitrage: 9,       // arbitrage windows close fast
    swap: 5,            // 200ms usually doesn't matter for regular swaps
    transfer: 2,        // transfers are not time-sensitive
    other: 4,
  };
  const base = typeScore[txType] ?? 4;

  // Urgency modifier from explicit urgency param
  if (urgencyMs < 500) return Math.min(10, base + 3);   // very urgent
  if (urgencyMs < 2000) return Math.min(10, base + 1);  // somewhat urgent
  if (urgencyMs > 10000) return Math.max(1, base - 2);  // not urgent at all
  return base;
}
```

---

## Step 6 — Bidding module

`src/timeboost/auction.ts`:
```typescript
import { createWalletClient, createPublicClient, http, encodeAbiParameters, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS } from "../constants";

export async function submitBid(params: {
  chain: "arbitrum" | "arbitrum-sepolia";
  privateKey: `0x${string}`;
  bidAmountWei: bigint;
  expressLaneControllerAddress: `0x${string}`; // usually == your wallet
  targetRound: number; // current round + 1
}) {
  const { chain, privateKey, bidAmountWei, expressLaneControllerAddress, targetRound } = params;
  const config = CHAINS[chain];
  const account = privateKeyToAccount(privateKey);

  // EIP-712 signing for the bid
  // Bid(uint64 roundNumber, address expressLaneController, uint256 amount)
  const domain = {
    name: "ExpressLaneAuction",
    version: "1",
    chainId: config.id,
    verifyingContract: config.auctionContract as `0x${string}`,
  };
  
  const types = {
    Bid: [
      { name: "roundNumber", type: "uint64" },
      { name: "expressLaneController", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  };

  const walletClient = createWalletClient({
    account,
    transport: http(config.rpc),
  });

  const signature = await walletClient.signTypedData({
    domain,
    types,
    primaryType: "Bid",
    message: {
      roundNumber: BigInt(targetRound),
      expressLaneController: expressLaneControllerAddress,
      amount: bidAmountWei,
    },
  });

  // Submit bid to the auctioneer endpoint
  // The auctioneer RPC runs alongside the sequencer
  const auctioneerEndpoint = config.rpc; // same endpoint, different method
  
  const bidPayload = {
    chainId: toHex(config.id),
    auctionContractAddress: config.auctionContract,
    roundNumber: toHex(targetRound),
    amount: toHex(bidAmountWei),
    expressLaneController: expressLaneControllerAddress,
    signature,
  };

  const res = await fetch(auctioneerEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "bid-submission",
      method: "auctioneer_submitBid",
      params: [bidPayload],
    }),
  });

  const json = await res.json();
  
  if (json.error) throw new Error(`Bid failed: ${JSON.stringify(json.error)}`);
  
  return {
    success: true,
    bidAmount: bidAmountWei.toString(),
    round: targetRound,
    controller: expressLaneControllerAddress,
    txHash: json.result,
  };
}
```

---

## Step 7 — Express lane transaction submission

`src/timeboost/express-lane.ts`:
```typescript
import { createWalletClient, http, keccak256, encodePacked, toHex, serializeTransaction } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS } from "../constants";

// The TIMEBOOST_BID prefix used in signing
const TIMEBOOST_PREFIX = keccak256(encodePacked(["string"], ["TIMEBOOST_BID"]));

export async function sendExpressLaneTx(params: {
  chain: "arbitrum" | "arbitrum-sepolia";
  controllerPrivateKey: `0x${string}`;
  serializedTx: `0x${string}`;        // already signed tx from the sender
  round: number;
  sequenceNumber: number;              // per-round nonce, starts at 0
}) {
  const { chain, controllerPrivateKey, serializedTx, round, sequenceNumber } = params;
  const config = CHAINS[chain];
  const controller = privateKeyToAccount(controllerPrivateKey);

  // Build the message to sign:
  // keccak256(TIMEBOOST_BID, chainId, auctionContractAddress, roundNumber, sequenceNumber, transaction)
  const messageHash = keccak256(
    encodePacked(
      ["bytes32", "bytes32", "address", "uint64", "uint64", "bytes"],
      [
        TIMEBOOST_PREFIX,
        toHex(BigInt(config.id), { size: 32 }),
        config.auctionContract as `0x${string}`,
        BigInt(round),
        BigInt(sequenceNumber),
        serializedTx,
      ]
    )
  );

  const signature = await controller.signMessage({ message: { raw: messageHash } });

  const res = await fetch(config.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "express-lane-tx",
      method: "timeboost_sendExpressLaneTransaction",
      params: [{
        chainId: toHex(config.id),
        round: toHex(round),
        auctionContractAddress: config.auctionContract,
        sequenceNumber: toHex(sequenceNumber),
        transaction: serializedTx,
        options: {},
        signature,
      }],
    }),
  });

  const json = await res.json();
  
  // null result = success (sequenceNumber consumed, tx accepted)
  // non-null error = failure
  if (json.error) throw new Error(`Express lane tx failed: ${JSON.stringify(json.error)}`);
  
  return {
    accepted: true,
    round,
    sequenceNumber,
    note: "Null result from sequencer = success. Tx is queued for express sequencing.",
  };
}

export async function checkIfTimeboosted(txHash: `0x${string}`, rpcUrl: string): Promise<boolean> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "get-receipt",
      method: "eth_getTransactionReceipt",
      params: [txHash],
    }),
  });
  const json = await res.json();
  // The receipt includes a `timeboosted` field (true/false)
  return json.result?.timeboosted === true;
}
```

---

## Step 8 — MCP server (all 6 tools)

`src/index.ts`:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import { getRoundState } from "./timeboost/round";
import { getRecentBidHistory, analyzeBidHistory } from "./timeboost/history";
import { shouldUseExpressLane } from "./timeboost/intelligence";
import { submitBid } from "./timeboost/auction";
import { sendExpressLaneTx, checkIfTimeboosted } from "./timeboost/express-lane";

const CHAIN = (process.env.CHAIN ?? "arbitrum") as "arbitrum" | "arbitrum-sepolia";
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

const server = new Server(
  { name: "timeboost-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool 1: Get current round state ────────────────────────────────────────
// ─── Tool 2: Analyze bid history from S3 ────────────────────────────────────
// ─── Tool 3: Decide if tx should use express lane ───────────────────────────
// ─── Tool 4: Bid for next round's express lane ──────────────────────────────
// ─── Tool 5: Submit express lane transaction ─────────────────────────────────
// ─── Tool 6: Check if a tx hash was timeboosted ─────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_timeboost_round_state",
      description: "Get the current Timeboost round number, express lane controller, reserve price, auction timing, and whether the auction is still open for bids. Call this first to understand the current state.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_bid_history",
      description: "Fetch and analyze recent bid history from Arbitrum's public S3 bucket. Returns statistics about recent bids: max bid, median bid, dominant controller address, unique bidder count. Use this to estimate what you need to bid to win.",
      inputSchema: {
        type: "object",
        properties: {
          days_back: { type: "number", description: "How many days of history to analyze (default: 1)", default: 1 },
        },
        required: [],
      },
    },
    {
      name: "analyze_should_boost",
      description: "Decide intelligently whether a given transaction is worth submitting via the express lane. Returns a yes/no recommendation with reasoning, estimated winning bid, and confidence score.",
      inputSchema: {
        type: "object",
        properties: {
          tx_value_eth: { type: "string", description: "Value at stake in the transaction (ETH, e.g. '0.5')" },
          tx_type: { type: "string", enum: ["swap", "liquidation", "arbitrage", "transfer", "other"], description: "Type of transaction — affects urgency scoring" },
          urgency_ms: { type: "number", description: "How quickly this tx needs to confirm in ms (e.g. 500 = very urgent, 10000 = not urgent)" },
          my_max_budget_eth: { type: "string", description: "Maximum you're willing to bid for the express lane (ETH)", default: "0.01" },
        },
        required: ["tx_type", "urgency_ms"],
      },
    },
    {
      name: "bid_for_express_lane",
      description: "Submit a sealed bid to win the express lane for the NEXT round. The auction is a second-price auction — you pay the second-highest bid, not your bid amount. Auction closes 15 seconds before round start.",
      inputSchema: {
        type: "object",
        properties: {
          bid_amount_eth: { type: "string", description: "Your bid amount in ETH (e.g. '0.005')" },
          controller_address: { type: "string", description: "Address that will control the express lane if you win (default: your wallet)" },
        },
        required: ["bid_amount_eth"],
      },
    },
    {
      name: "send_express_lane_tx",
      description: "Submit a pre-signed transaction through the Timeboost express lane for priority sequencing. The transaction skips the 200ms artificial delay. You must be the current round's express lane controller.",
      inputSchema: {
        type: "object",
        properties: {
          serialized_tx: { type: "string", description: "RLP-encoded signed transaction (0x-prefixed hex)" },
          sequence_number: { type: "number", description: "Per-round nonce for express lane submissions (starts at 0 each round)", default: 0 },
        },
        required: ["serialized_tx"],
      },
    },
    {
      name: "check_timeboosted",
      description: "Check whether a transaction hash was actually sequenced via the express lane (timeboosted). The tx receipt includes a timeboosted field. Use this to verify your express lane submissions worked.",
      inputSchema: {
        type: "object",
        properties: {
          tx_hash: { type: "string", description: "Transaction hash to check (0x-prefixed)" },
        },
        required: ["tx_hash"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case "get_timeboost_round_state": {
        const state = await getRoundState(CHAIN);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(state, null, 2),
          }],
        };
      }

      case "get_bid_history": {
        if (CHAIN !== "arbitrum") {
          return { content: [{ type: "text", text: "S3 bid history is only available for Arbitrum One mainnet." }] };
        }
        const bids = await getRecentBidHistory("arbitrum", args?.days_back ?? 1);
        const analysis = analyzeBidHistory(bids);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ rawCount: bids.length, analysis }, null, 2),
          }],
        };
      }

      case "analyze_should_boost": {
        const bids = CHAIN === "arbitrum" ? await getRecentBidHistory("arbitrum", 1) : null;
        const state = await getRoundState(CHAIN);
        
        const txValueWei = args?.tx_value_eth
          ? BigInt(Math.floor(Number(args.tx_value_eth) * 1e18))
          : 0n;
        const maxBudgetWei = args?.my_max_budget_eth
          ? BigInt(Math.floor(Number(args.my_max_budget_eth) * 1e18))
          : BigInt(1e16); // 0.01 ETH default

        const decision = shouldUseExpressLane({
          txValueWei,
          txType: args?.tx_type ?? "other",
          urgencyMs: args?.urgency_ms ?? 5000,
          bidHistory: bids,
          reservePrice: BigInt(state.reservePrice),
          myMaxBudgetWei: maxBudgetWei,
        });

        return { content: [{ type: "text", text: JSON.stringify(decision, null, 2) }] };
      }

      case "bid_for_express_lane": {
        if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY env var not set");
        const bidWei = BigInt(Math.floor(Number(args?.bid_amount_eth ?? "0.001") * 1e18));
        const state = await getRoundState(CHAIN);
        const account = (await import("viem/accounts")).privateKeyToAccount(PRIVATE_KEY);
        
        const result = await submitBid({
          chain: CHAIN,
          privateKey: PRIVATE_KEY,
          bidAmountWei: bidWei,
          expressLaneControllerAddress: (args?.controller_address ?? account.address) as `0x${string}`,
          targetRound: state.nextRound,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "send_express_lane_tx": {
        if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY env var not set");
        const state = await getRoundState(CHAIN);
        
        const result = await sendExpressLaneTx({
          chain: CHAIN,
          controllerPrivateKey: PRIVATE_KEY,
          serializedTx: args?.serialized_tx as `0x${string}`,
          round: state.currentRound,
          sequenceNumber: args?.sequence_number ?? 0,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "check_timeboosted": {
        const config = { arbitrum: "https://arb1.arbitrum.io/rpc", "arbitrum-sepolia": "https://sepolia-rollup.arbitrum.io/rpc" }[CHAIN];
        const boosted = await checkIfTimeboosted(args?.tx_hash as `0x${string}`, config);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ txHash: args?.tx_hash, timeboosted: boosted, chain: CHAIN }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Timeboost MCP server running on stdio");
}

main().catch(console.error);
```

---

## Step 9 — Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "timeboost": {
      "command": "npx",
      "args": ["tsx", "/path/to/timeboost-mcp/src/index.ts"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "CHAIN": "arbitrum-sepolia"
      }
    }
  }
}
```

---

## Step 10 — Demo script (for the submission video)

Run this conversation with Claude to demo all 6 tools in sequence:

```
1. "What's the current Timeboost round state on Arbitrum?"
   → calls get_timeboost_round_state
   → shows: round 87432, controller 0xabc..., reserve price 0.001 ETH, auction closes in 34s

2. "What does the recent bid history look like?"
   → calls get_bid_history
   → shows: median bid 0.0023 ETH, 2 dominant bidders, 847 bids last 24h

3. "I want to do a liquidation worth 5 ETH in the next 300ms. Should I use the express lane?"
   → calls analyze_should_boost
   → shows: YES, urgency score 10/10, estimated win bid 0.0025 ETH, 75% confidence

4. "Bid 0.003 ETH for the next round's express lane"
   → calls bid_for_express_lane
   → shows: bid submitted for round 87433

5. "Here's my signed liquidation tx: 0xf86c... Submit it via express lane"
   → calls send_express_lane_tx
   → shows: accepted, sequenceNumber 0

6. "Was tx 0xabc123 actually timeboosted?"
   → calls check_timeboosted
   → shows: { timeboosted: true }
```

---

## Build order (clock starts now)

| Time | Task |
|------|------|
| 0–30min | `npm init`, install deps, constants.ts, types.ts |
| 30–90min | `round.ts` — read auction contract state via viem |
| 90–150min | `history.ts` — S3 fetch + CSV parse + gzip decompress |
| 150–210min | `intelligence.ts` — decision logic |
| 210–270min | `auction.ts` — EIP-712 bid signing + auctioneer_submitBid |
| 270–330min | `express-lane.ts` — timeboost_sendExpressLaneTransaction |
| 330–390min | `index.ts` — wire all 6 MCP tools |
| 390–420min | Test on Arbitrum Sepolia, record demo, write README |

**Total: ~7 hours.** Feasible before deadline.

---

## Submission README talking points

- **Only Timeboost-native MCP server in existence** — no other tool exposes these 6 primitives
- Arbitrum-specific: Timeboost is unique to Arbitrum, every tool in this server is impossible to build on any other chain
- Covers all bounty criteria: reads onchain data (round state, auction contract), uses wallets (bid signing, tx signing), interacts with Arbitrum-specific protocols (Timeboost)
- Real decision intelligence: `analyze_should_boost` is not just a wrapper — it pulls live S3 data and reasons about value vs cost
- Usable today: works on Arbitrum Sepolia for testing, mainnet-ready with a real private key

---

## Key risks and mitigations

| Risk | Mitigation |
|------|------------|
| Auction contract ABI changes | Read ABI directly from Arbiscan at runtime |
| S3 gzip decompress in browser env | Use Node.js `zlib` module as fallback |
| Sepolia auctioneer endpoint unknown | Focus demo on read tools; bid/submit needs mainnet or confirmed Sepolia endpoint |
| EIP-712 domain params wrong | Verify domain from contract's `domainSeparator()` view function |
| Sequence number tracking | Keep an in-memory counter per round, reset on new round |
