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
