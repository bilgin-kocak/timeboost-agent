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

## MCP Server

This skill includes a companion MCP server (`timeboost-mcp/`) with 6 tools:

1. `get_timeboost_round_state` — Read live auction state
2. `get_bid_history` — Fetch and analyze S3 bid data
3. `analyze_should_boost` — Intelligent boost decision
4. `bid_for_express_lane` — Submit sealed EIP-712 bid
5. `send_express_lane_tx` — Submit express lane transaction
6. `check_timeboosted` — Verify tx was timeboosted

See `timeboost-mcp/README.md` for setup instructions.

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
