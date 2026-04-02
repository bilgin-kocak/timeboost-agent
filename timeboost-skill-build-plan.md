# Timeboost Express Lane Skill — Build Plan
**ArbiLink Agentic Bounty | Deadline: April 3, 19:30 CET**

---

## What we're building

A **Claude Code Skill** called `timeboost-skill` — a structured markdown knowledge package
that drops into `~/.claude/skills/` and gives any Claude Code session full intelligence
over Arbitrum's Timeboost express lane.

Once installed, any developer can say:
- *"Should I use the express lane for this liquidation?"*
- *"Write me code to bid for the next Timeboost round"*
- *"Analyze the last 24h of bid history and tell me the typical winning price"*
- *"Submit this transaction through the express lane"*

...and Claude Code gives a correct, production-ready answer using exact Arbitrum APIs.

**Why this wins the bounty:**
- The official `arbitrum-dapp-skill` explicitly says Timeboost is not covered yet — this fills that gap
- Zero other submissions will have Timeboost knowledge — it requires deep protocol-specific context
- Covers every bounty criterion: reading onchain data, wallets, interacting with protocols
- Installable in one command, composable with the existing Arbitrum skill

---

## Final deliverable structure

```
timeboost-skill/
├── SKILL.md                    ← core skill (YAML frontmatter + decision tree)
├── install.sh                  ← one-command installer
├── README.md                   ← submission README
└── references/
    ├── timeboost-api.md        ← exact RPC methods, contract addresses, ABIs, S3 format
    ├── bid-strategy.md         ← when/how to bid intelligently, decision logic
    └── code-patterns.md        ← complete working TypeScript code examples
```

Install command for judges:
```bash
git clone https://github.com/YOUR_HANDLE/timeboost-skill ~/.claude/skills/timeboost-skill
```

Or via installer:
```bash
bash <(curl -s https://raw.githubusercontent.com/YOUR_HANDLE/timeboost-skill/main/install.sh)
```

---

## Step 1 — Create the repo

```bash
mkdir timeboost-skill && cd timeboost-skill
git init
mkdir references
```

---

## Step 2 — Write `SKILL.md`

This is the core file. The `description` field is what triggers the skill automatically
when Claude Code detects a relevant conversation. Keep it precise.

```
timeboost-skill/SKILL.md
```

Full content:

```markdown
---
name: timeboost
description: >
  Use when working with Arbitrum's Timeboost express lane: checking round state,
  bidding for express lane control, submitting timeboosted transactions, analyzing
  bid history from S3, or deciding whether a transaction benefits from priority
  sequencing. Also triggers for: "express lane", "Timeboost auction",
  "auctioneer_submitBid", "timeboost_sendExpressLaneTransaction", MEV on Arbitrum.
---

# Timeboost Express Lane Skill

Timeboost is Arbitrum's unique express lane auction system. It is live on
Arbitrum One and Arbitrum Nova. No other L2 has this primitive.

## What Timeboost is

Every 60 seconds a new round starts. Anyone can bid in a sealed second-price
auction for the right to be the "express lane controller" for that round.
The winner gets a 200ms sequencing advantage — their transactions skip the
artificial delay imposed on all other transactions.

Regular users experience ~450ms confirmation. Express lane controller
experiences ~250ms (same as raw block time). The 200ms difference is
decisive for liquidations and arbitrage.

## Quick facts — always use these exact values

| Parameter | Value |
|-----------|-------|
| Round duration | 60 seconds |
| Auction closes | 15 seconds before round start |
| Express lane advantage | 200ms |
| Normal tx artificial delay | 200ms |
| Block time | 250ms |
| Max bids per round per address | 5 |
| Auction type | Sealed bid, second-price |

## Contract addresses

| Chain | Auction Contract |
|-------|-----------------|
| Arbitrum One (42161) | `0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079` |
| Arbitrum Sepolia (421614) | Check `https://docs.arbitrum.io/how-arbitrum-works/timeboost/how-to-use-timeboost` |

## RPC endpoints

| Chain | Endpoint |
|-------|----------|
| Arbitrum One | `https://arb1.arbitrum.io/rpc` |
| Arbitrum Sepolia | `https://sepolia-rollup.arbitrum.io/rpc` |

Both the auction bid submission (`auctioneer_submitBid`) and express lane
tx submission (`timeboost_sendExpressLaneTransaction`) are sent to the
same sequencer RPC endpoint — just different JSON-RPC method names.

## Decision tree — load the right reference

**Is the user asking whether to use the express lane?**
→ Load `references/bid-strategy.md` for the scoring logic.

**Is the user asking for code to read round state, bid, or submit express lane txs?**
→ Load `references/code-patterns.md` for working TypeScript implementations.

**Is the user asking about RPC method signatures, ABI, S3 bucket format, or EIP-712?**
→ Load `references/timeboost-api.md` for the complete technical reference.

**Always remember:**
- Test on **Arbitrum Sepolia** first — no real funds at risk
- The S3 bid history is only available for Arbitrum One mainnet
- A `null` response from `timeboost_sendExpressLaneTransaction` means **success**
  (sequence number consumed, tx accepted) — do not treat it as an error
- The `timeboosted` field on `eth_getTransactionReceipt` confirms express lane
  inclusion after the fact

## Common patterns summary

### Read current round state (no wallet needed)
```typescript
// Call auction contract: currentRound(), expressLaneControllerOf(round), reservePrice()
// See references/code-patterns.md → getRoundState()
```

### Fetch and analyze bid history (no wallet needed)
```typescript
// Fetch from S3: s3://timeboost-auctioneer-arb1/ue2/validated-timeboost-bids/YYYY/MM/DD/
// Files are gzip-compressed CSVs — decompress before parsing
// See references/code-patterns.md → fetchBidHistory()
```

### Bid for next round's express lane (wallet required, costs ETH)
```typescript
// Sign EIP-712 Bid struct, POST to auctioneer_submitBid
// See references/code-patterns.md → submitBid()
```

### Submit express lane transaction (must be current controller)
```typescript
// Sign message hash, POST to timeboost_sendExpressLaneTransaction
// See references/code-patterns.md → sendExpressLaneTx()
```
```

---

## Step 3 — Write `references/timeboost-api.md`

```markdown
# Timeboost API Reference

## Auction contract ABI (minimal — read-only functions)

```typescript
const AUCTION_ABI = [
  {
    name: "currentRound",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "expressLaneControllerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "round", type: "uint64" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "reservePrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isAuctionRoundClosed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## `auctioneer_submitBid` — submit a bid for the next round

**Endpoint:** `POST {SEQUENCER_RPC}`

**Method:** `auctioneer_submitBid`

**Params:**
```typescript
{
  chainId: `0x${string}`,                  // hex-encoded chain ID
  auctionContractAddress: `0x${string}`,   // auction contract
  roundNumber: `0x${string}`,              // hex-encoded target round (currentRound + 1)
  amount: `0x${string}`,                   // hex-encoded bid in wei
  expressLaneController: `0x${string}`,    // address to become controller if you win
  signature: `0x${string}`,               // EIP-712 signature (see below)
}
```

**EIP-712 signature spec:**

```typescript
// Domain
const domain = {
  name: "ExpressLaneAuction",
  version: "1",
  chainId: 42161,  // or 421614 for Sepolia
  verifyingContract: "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079",
};

// Type
const types = {
  Bid: [
    { name: "roundNumber", type: "uint64" },
    { name: "expressLaneController", type: "address" },
    { name: "amount", type: "uint256" },
  ],
};

// Message
const message = {
  roundNumber: BigInt(targetRound),
  expressLaneController: controllerAddress,
  amount: bidAmountWei,
};
```

**Bid rules:**
- Maximum 5 bids per round per address
- Subsequent bids replace earlier ones (only most recent counts)
- Bid below reserve price = rejected
- Auction closes 15 seconds before round start

---

## `timeboost_sendExpressLaneTransaction` — submit express lane tx

**Endpoint:** `POST {SEQUENCER_RPC}`

**Method:** `timeboost_sendExpressLaneTransaction`

**Params:**
```typescript
{
  chainId: `0x${string}`,                  // hex-encoded chain ID
  round: `0x${string}`,                    // hex-encoded CURRENT round
  auctionContractAddress: `0x${string}`,
  sequenceNumber: `0x${string}`,           // per-round nonce, starts at 0, resets each round
  transaction: `0x${string}`,             // RLP-encoded signed transaction
  options: {},                             // empty object
  signature: `0x${string}`,               // controller's signature (see below)
}
```

**Controller signature spec (raw keccak256, NOT EIP-712):**
```typescript
import { keccak256, encodePacked, toHex } from "viem";

const TIMEBOOST_PREFIX = keccak256(
  encodePacked(["string"], ["TIMEBOOST_BID"])
);

const messageHash = keccak256(
  encodePacked(
    ["bytes32", "bytes32", "address", "uint64", "uint64", "bytes"],
    [
      TIMEBOOST_PREFIX,
      toHex(BigInt(chainId), { size: 32 }),
      auctionContractAddress,
      BigInt(currentRound),
      BigInt(sequenceNumber),
      serializedTx,
    ]
  )
);

// Sign the raw hash (not a personal_sign / eth_sign wrapper)
const signature = await account.signMessage({ message: { raw: messageHash } });
```

**Response:**
- `null` = **success** — sequence number consumed, tx queued for express sequencing
- Error object = failure — sequence number NOT consumed if Timeboost-related error

**Sequence number rules:**
- Starts at 0 at the beginning of each round
- Increments by 1 for each accepted submission
- Out-of-order submissions are queued until the gap is filled
- Use `2^64 - 1` as the "dontcare" sequence number if ordering doesn't matter

---

## `eth_getTransactionReceipt` — check if tx was timeboosted

Standard receipt with one extra field:
```typescript
{
  // ... normal receipt fields ...
  timeboosted: boolean  // true if tx went through express lane
}
```

---

## S3 bid history — public, no credentials needed

**Bucket:** `s3://timeboost-auctioneer-arb1/ue2/validated-timeboost-bids/`

**HTTP base:** `https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/ue2/validated-timeboost-bids`

**Path format:** `{HTTP_BASE}/YYYY/MM/DD/`

**File format:** `{roundStart}-{roundEnd}.csv.gzip`

Example:
```
https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/ue2/validated-timeboost-bids/2025/06/10/0130304-0130343.csv.gzip
```

**CSV columns (after decompressing):**
```
round, bidder, amount, expressLaneController, timestamp
```

**Note:** Before June 9 2025, the region was `uw2` not `ue2`. Use `uw2` bucket for
historical data before that date.

**AWS CLI access (no credentials):**
```bash
aws s3 ls s3://timeboost-auctioneer-arb1/ue2/validated-timeboost-bids/2025/06/10/ --no-sign-request --recursive
```
```

---

## Step 4 — Write `references/bid-strategy.md`

```markdown
# Timeboost Bid Strategy

## Should I use the express lane?

Use this scoring framework when asked whether a transaction warrants express lane priority.

### Step 1: Check if auction is open

The auction for round N closes 15 seconds before round N starts.
If the auction is already closed, you cannot bid for this round —
evaluate whether to bid for round N+1 instead.

### Step 2: Estimate the winning bid

Pull recent bid history from S3 and calculate:
- **Safe bid** = median of last 24h winning bids × 1.15 (15% buffer)
- **Aggressive bid** = max of last 24h × 0.95 (just under the top)

If no history is available, use `reservePrice × 1.5` as a conservative estimate.

Note: Empirical research (Messias & Torres, Sept 2025) shows express lane control
is highly concentrated — ~2 entities win >90% of auctions on mainnet. Winning
without deep MEV strategy is difficult on mainnet. On Sepolia, competition is low.

### Step 3: Score the transaction

| tx_type | urgency_base | notes |
|---------|-------------|-------|
| liquidation | 10/10 | milliseconds matter, missing it is expensive |
| arbitrage | 9/10 | price windows close fast |
| swap | 5/10 | 200ms usually does not change outcome |
| transfer | 2/10 | never time-sensitive |
| other | 4/10 | evaluate case by case |

**Urgency modifier:**
- If user says "in the next 300ms" or similar → +3 to score
- If user says "whenever" or "no rush" → -2 to score

### Step 4: Value check

```
value_ratio = tx_value_eth / estimated_winning_bid_eth
```

**Recommend express lane if:**
- urgency_score >= 8 (regardless of value), OR
- urgency_score >= 5 AND value_ratio >= 3

**Do NOT recommend if:**
- estimated_winning_bid > user's stated budget
- urgency_score < 4 AND value_ratio < 2
- tx is a simple token transfer or approval

### Step 5: Format the recommendation

Always include:
1. Yes/No recommendation
2. The estimated winning bid in ETH and wei
3. The urgency score and why
4. The value ratio
5. Whether the auction is still open for the current round
6. What round to target

---

## Alternative: reselling express lane rights

The express lane controller can sign express lane submissions for other parties
(the controller signs the metadata, the transaction itself can be from any address).
This means you could win an auction and resell per-transaction access.

Secondary markets for this have mostly collapsed on mainnet due to reliability
issues — but it is a valid pattern to document when asked.

---

## Testnet strategy

On Arbitrum Sepolia:
- Competition is near zero — often no bids at all
- Reserve price is very low (often 0 or minimal wei)
- Ideal for demonstrating the full flow without cost
- S3 bid history may not be available — use contract reads only
```

---

## Step 5 — Write `references/code-patterns.md`

````markdown
# Timeboost Code Patterns

All examples use `viem` and TypeScript. Install dependencies:
```bash
npm install viem dotenv
```

---

## getRoundState — read live auction state (no wallet)

```typescript
import { createPublicClient, http } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";

const AUCTION_ADDRESS_MAINNET = "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079";

const AUCTION_ABI = [
  { name: "currentRound", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint64" }] },
  { name: "expressLaneControllerOf", type: "function", stateMutability: "view",
    inputs: [{ name: "round", type: "uint64" }], outputs: [{ type: "address" }] },
  { name: "reservePrice", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "isAuctionRoundClosed", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "bool" }] },
] as const;

export async function getRoundState(useMainnet = true) {
  const chain = useMainnet ? arbitrum : arbitrumSepolia;
  const auctionAddress = AUCTION_ADDRESS_MAINNET as `0x${string}`;
  
  const client = createPublicClient({ chain, transport: http() });

  const [currentRound, reservePrice, isRoundClosed] = await Promise.all([
    client.readContract({ address: auctionAddress, abi: AUCTION_ABI, functionName: "currentRound" }),
    client.readContract({ address: auctionAddress, abi: AUCTION_ABI, functionName: "reservePrice" }),
    client.readContract({ address: auctionAddress, abi: AUCTION_ABI, functionName: "isAuctionRoundClosed" }),
  ]);

  const controller = await client.readContract({
    address: auctionAddress, abi: AUCTION_ABI,
    functionName: "expressLaneControllerOf",
    args: [currentRound],
  });

  const ROUND_MS = 60_000;
  const CLOSE_BEFORE_MS = 15_000;
  const msIntoRound = Date.now() % ROUND_MS;
  const msUntilNextRound = ROUND_MS - msIntoRound;
  const msUntilClose = Math.max(0, msUntilNextRound - CLOSE_BEFORE_MS);

  return {
    currentRound: Number(currentRound),
    nextRound: Number(currentRound) + 1,
    expressLaneController: controller,
    hasActiveController: controller !== "0x0000000000000000000000000000000000000000",
    reservePriceWei: reservePrice.toString(),
    reservePriceEth: (Number(reservePrice) / 1e18).toFixed(6),
    isAuctionOpen: !isRoundClosed && msUntilClose > 0,
    msUntilNextRound,
    msUntilAuctionCloses: msUntilClose,
  };
}
```

---

## fetchBidHistory — pull from public S3 (Arbitrum One only)

```typescript
export interface BidRecord {
  round: number;
  bidder: string;
  amountWei: bigint;
  expressLaneController: string;
  timestamp: string;
}

export interface BidAnalysis {
  totalBids: number;
  uniqueBidders: number;
  maxBidEth: string;
  medianBidEth: string;
  minBidEth: string;
  safeWinningBidEth: string;  // median × 1.15
  rounds: number[];
}

export async function fetchBidHistory(daysBack = 1): Promise<BidRecord[]> {
  const S3_BASE = "https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/ue2/validated-timeboost-bids";
  const allBids: BidRecord[] = [];

  for (let d = 0; d < daysBack; d++) {
    const date = new Date(Date.now() - d * 86_400_000);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");

    // List files for this date via S3 XML listing
    const listUrl = `${S3_BASE}/${yyyy}/${mm}/${dd}/`;
    const listRes = await fetch(listUrl).catch(() => null);
    if (!listRes?.ok) continue;

    const xml = await listRes.text();
    const keys = [...xml.matchAll(/<Key>([^<]+\.csv\.gzip)<\/Key>/g)].map(m => m[1]);

    // Fetch and parse the last 5 files (most recent ~5 minutes)
    for (const key of keys.slice(-5)) {
      const fileUrl = `https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/${key}`;
      const res = await fetch(fileUrl).catch(() => null);
      if (!res?.ok) continue;

      const buffer = await res.arrayBuffer();
      
      // Decompress gzip using Node.js zlib
      const zlib = await import("zlib");
      const { promisify } = await import("util");
      const gunzip = promisify(zlib.gunzip);
      const decompressed = await gunzip(Buffer.from(buffer));
      const csv = decompressed.toString("utf8");

      // Parse CSV (skip header row)
      const rows = csv.trim().split("\n").slice(1);
      for (const row of rows) {
        if (!row.trim()) continue;
        const [round, bidder, amount, expressLaneController, timestamp] = row.split(",");
        allBids.push({
          round: Number(round),
          bidder: bidder?.trim(),
          amountWei: BigInt(amount?.trim() ?? "0"),
          expressLaneController: expressLaneController?.trim(),
          timestamp: timestamp?.trim(),
        });
      }
    }
  }

  return allBids;
}

export function analyzeBids(bids: BidRecord[]): BidAnalysis | null {
  if (bids.length === 0) return null;
  
  const amounts = bids.map(b => b.amountWei).sort((a, b) => (a > b ? -1 : 1));
  const toEth = (wei: bigint) => (Number(wei) / 1e18).toFixed(6);
  const median = amounts[Math.floor(amounts.length / 2)];

  return {
    totalBids: bids.length,
    uniqueBidders: new Set(bids.map(b => b.bidder)).size,
    maxBidEth: toEth(amounts[0]),
    medianBidEth: toEth(median),
    minBidEth: toEth(amounts[amounts.length - 1]),
    safeWinningBidEth: toEth(median * 115n / 100n),
    rounds: [...new Set(bids.map(b => b.round))].sort().slice(-10),
  };
}
```

---

## submitBid — bid for next round (wallet required)

```typescript
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";

export async function submitBid(params: {
  privateKey: `0x${string}`;
  bidAmountEth: string;         // e.g. "0.005"
  targetRound: number;          // currentRound + 1
  useMainnet?: boolean;
}) {
  const { privateKey, bidAmountEth, targetRound, useMainnet = false } = params;
  const chain = useMainnet ? arbitrum : arbitrumSepolia;
  const auctionAddress = "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079" as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const bidAmountWei = BigInt(Math.floor(Number(bidAmountEth) * 1e18));

  const walletClient = createWalletClient({ account, chain, transport: http() });

  // EIP-712 signature
  const signature = await walletClient.signTypedData({
    domain: {
      name: "ExpressLaneAuction",
      version: "1",
      chainId: chain.id,
      verifyingContract: auctionAddress,
    },
    types: {
      Bid: [
        { name: "roundNumber", type: "uint64" },
        { name: "expressLaneController", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    },
    primaryType: "Bid",
    message: {
      roundNumber: BigInt(targetRound),
      expressLaneController: account.address,
      amount: bidAmountWei,
    },
  });

  const rpc = useMainnet
    ? "https://arb1.arbitrum.io/rpc"
    : "https://sepolia-rollup.arbitrum.io/rpc";

  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "bid",
      method: "auctioneer_submitBid",
      params: [{
        chainId: `0x${chain.id.toString(16)}`,
        auctionContractAddress: auctionAddress,
        roundNumber: `0x${targetRound.toString(16)}`,
        amount: `0x${bidAmountWei.toString(16)}`,
        expressLaneController: account.address,
        signature,
      }],
    }),
  });

  const json = await res.json();
  if (json.error) throw new Error(`Bid failed: ${JSON.stringify(json.error)}`);
  
  return {
    success: true,
    round: targetRound,
    bidAmountEth,
    bidAmountWei: bidAmountWei.toString(),
    controller: account.address,
    result: json.result,
  };
}
```

---

## sendExpressLaneTx — submit via express lane (must be current controller)

```typescript
import { keccak256, encodePacked, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export async function sendExpressLaneTx(params: {
  controllerPrivateKey: `0x${string}`;
  serializedTx: `0x${string}`;     // RLP-encoded signed transaction (from sender)
  currentRound: number;
  sequenceNumber: number;           // starts at 0 each round, increment per submission
  useMainnet?: boolean;
}) {
  const { controllerPrivateKey, serializedTx, currentRound, sequenceNumber, useMainnet = false } = params;
  const chainId = useMainnet ? 42161 : 421614;
  const auctionAddress = "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079" as `0x${string}`;
  const rpc = useMainnet
    ? "https://arb1.arbitrum.io/rpc"
    : "https://sepolia-rollup.arbitrum.io/rpc";

  const controller = privateKeyToAccount(controllerPrivateKey);

  // Build the signing payload
  // keccak256(TIMEBOOST_BID_prefix || chainId || auctionContract || round || seqNum || tx)
  const TIMEBOOST_PREFIX = keccak256(encodePacked(["string"], ["TIMEBOOST_BID"]));
  
  const messageHash = keccak256(
    encodePacked(
      ["bytes32", "bytes32", "address", "uint64", "uint64", "bytes"],
      [
        TIMEBOOST_PREFIX,
        toHex(BigInt(chainId), { size: 32 }),
        auctionAddress,
        BigInt(currentRound),
        BigInt(sequenceNumber),
        serializedTx,
      ]
    )
  );

  const signature = await controller.signMessage({
    message: { raw: messageHash },
  });

  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "express-lane-tx",
      method: "timeboost_sendExpressLaneTransaction",
      params: [{
        chainId: `0x${chainId.toString(16)}`,
        round: `0x${currentRound.toString(16)}`,
        auctionContractAddress: auctionAddress,
        sequenceNumber: `0x${sequenceNumber.toString(16)}`,
        transaction: serializedTx,
        options: {},
        signature,
      }],
    }),
  });

  const json = await res.json();

  // null result = success (sequence number consumed, tx queued)
  // error = failure (sequence number NOT consumed for Timeboost errors)
  if (json.error) throw new Error(`Express lane tx failed: ${JSON.stringify(json.error)}`);

  return {
    accepted: true,                    // null response = success
    round: currentRound,
    sequenceNumber,
    note: "null result from sequencer = tx accepted and queued",
  };
}
```

---

## checkTimeboosted — verify a tx was express lane sequenced

```typescript
export async function checkTimeboosted(
  txHash: `0x${string}`,
  useMainnet = true
): Promise<{ txHash: string; timeboosted: boolean; blockNumber?: string }> {
  const rpc = useMainnet
    ? "https://arb1.arbitrum.io/rpc"
    : "https://sepolia-rollup.arbitrum.io/rpc";

  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "receipt",
      method: "eth_getTransactionReceipt",
      params: [txHash],
    }),
  });

  const json = await res.json();
  const receipt = json.result;

  return {
    txHash,
    timeboosted: receipt?.timeboosted === true,
    blockNumber: receipt?.blockNumber,
  };
}
```
````

---

## Step 6 — Write `install.sh`

```bash
#!/bin/bash
set -e

SKILLS_DIR="${HOME}/.claude/skills"
SKILL_NAME="timeboost-skill"
REPO_URL="https://github.com/YOUR_HANDLE/timeboost-skill.git"

echo "Installing ${SKILL_NAME}..."

mkdir -p "${SKILLS_DIR}"

if [ -d "${SKILLS_DIR}/${SKILL_NAME}" ]; then
  echo "Updating existing installation..."
  git -C "${SKILLS_DIR}/${SKILL_NAME}" pull
else
  git clone "${REPO_URL}" "${SKILLS_DIR}/${SKILL_NAME}"
fi

echo ""
echo "✓ ${SKILL_NAME} installed to ${SKILLS_DIR}/${SKILL_NAME}"
echo ""
echo "Restart Claude Code and try:"
echo '  "Should I use the express lane for this 5 ETH liquidation in the next 300ms?"'
echo '  "Write me code to bid for the next Timeboost round on Arbitrum Sepolia"'
echo '  "What is the current express lane controller on Arbitrum One?"'
```

---

## Step 7 — Write `README.md`

```markdown
# timeboost-skill

A Claude Code skill that gives AI agents full intelligence over Arbitrum's
Timeboost express lane — the only priority sequencing primitive on any L2.

## What this skill enables

After installing, Claude Code can:

- **Analyze** whether a transaction benefits from express lane priority
- **Read** live round state: current controller, reserve price, auction timing
- **Fetch and analyze** historical bid data from Arbitrum's public S3 bucket
- **Generate** production-ready TypeScript code for bidding and express lane submission
- **Verify** whether a submitted transaction was actually timeboosted

## Why Timeboost matters

Timeboost gives the auction winner a 200ms sequencing advantage. For liquidations
and arbitrage, this is decisive. For regular users and transfers, it is irrelevant.
The skill knows this distinction and applies it to every recommendation.

## Install

```bash
# One-liner
bash <(curl -s https://raw.githubusercontent.com/YOUR_HANDLE/timeboost-skill/main/install.sh)

# Or manual
git clone https://github.com/YOUR_HANDLE/timeboost-skill ~/.claude/skills/timeboost-skill
```

Restart Claude Code. The skill loads automatically when you ask anything
related to Timeboost, express lanes, or priority sequencing on Arbitrum.

## Example prompts

```
"What is the current Timeboost round state on Arbitrum One?"
"Should I use the express lane for a 5 ETH liquidation in the next 300ms?"
"Write me code to bid for the next round's express lane on Arbitrum Sepolia"
"What has the median winning bid been in the last 24 hours?"
"Generate a full express lane transaction submission script"
"Was tx 0xabc123 timeboosted?"
```

## Complementary skill

This skill is designed to work alongside
[arbitrum-dapp-skill](https://github.com/hummusonrails/arbitrum-dapp-skill)
which covers general Stylus and Solidity dApp scaffolding.
Install both for complete Arbitrum development coverage.

## Specification sources

- [Timeboost gentle introduction](https://docs.arbitrum.io/how-arbitrum-works/timeboost/gentle-introduction)
- [How to use Timeboost](https://docs.arbitrum.io/how-arbitrum-works/timeboost/how-to-use-timeboost)
- [OffchainLabs research spec](https://github.com/OffchainLabs/timeboost-design/blob/main/research_spec.md)
- [Empirical analysis of Timeboost](https://arxiv.org/abs/2509.22143) (Messias & Torres, 2025)
```

---

## Build order (clock starts now)

| Time | Task | Output |
|------|------|--------|
| 0–20 min | `mkdir timeboost-skill && git init` | repo scaffolded |
| 20–50 min | Write `references/timeboost-api.md` | full RPC/ABI reference |
| 50–80 min | Write `references/bid-strategy.md` | decision framework |
| 80–130 min | Write `references/code-patterns.md` | 5 working code blocks |
| 130–160 min | Write `SKILL.md` (frontmatter + decision tree) | core skill file |
| 160–180 min | Write `install.sh` + `README.md` | submission packaging |
| 180–210 min | Test: install skill, open Claude Code, run 5 demo prompts | verified working |
| 210–240 min | Push to GitHub, record 2-min demo video | submission ready |

**Total: ~4 hours.** Well within deadline.

---

## Demo script (record this for submission)

Open Claude Code with the skill installed and run these 5 prompts in sequence:

```
1. "What is the current Timeboost round state on Arbitrum One?"
   Expected: round number, controller address, reserve price, whether auction is open

2. "Analyze the last 24 hours of Timeboost bid history"
   Expected: total bids, unique bidders, median bid, max bid, safe winning bid estimate

3. "I want to liquidate a position worth 5 ETH in the next 200ms on Arbitrum.
    Should I use the express lane? My budget is 0.01 ETH."
   Expected: yes/no with urgency score, estimated winning bid, value ratio, reasoning

4. "Write me production TypeScript code to bid for the next Timeboost round
    on Arbitrum Sepolia with a budget of 0.001 ETH"
   Expected: complete, runnable TypeScript using exact viem patterns from the skill

5. "Now write the code to submit that transaction through the express lane
    once I win the auction"
   Expected: sendExpressLaneTx implementation with correct signing spec
```

Each response should be accurate, cite specific values (contract address, RPC endpoints,
EIP-712 struct fields), and require zero correction from you.

---

## Key facts to verify before submitting

- [ ] Arbitrum One auction contract address confirmed: `0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079`
- [ ] S3 bucket path verified: `ue2/validated-timeboost-bids/` (changed from `uw2` on June 9 2025)
- [ ] `null` response from express lane RPC = success (not an error)
- [ ] EIP-712 domain name is `"ExpressLaneAuction"` (verify from contract)
- [ ] Sepolia auction contract address: fetch from official docs before hardcoding
