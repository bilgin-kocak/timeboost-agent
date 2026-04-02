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

export async function fetchBidHistory(daysBack = 1): Promise<BidRecord[]> {
  const S3_BASE = "https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/ue2/validated-timeboost-bids";
  const allBids: BidRecord[] = [];

  for (let d = 0; d < daysBack; d++) {
    const date = new Date(Date.now() - d * 86_400_000);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");

    const listUrl = `${S3_BASE}/${yyyy}/${mm}/${dd}/`;
    const listRes = await fetch(listUrl).catch(() => null);
    if (!listRes?.ok) continue;

    const xml = await listRes.text();
    const keys = [...xml.matchAll(/<Key>([^<]+\.csv\.gzip)<\/Key>/g)].map(m => m[1]);

    for (const key of keys.slice(-5)) {
      const fileUrl = `https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/${key}`;
      const res = await fetch(fileUrl).catch(() => null);
      if (!res?.ok) continue;

      const buffer = await res.arrayBuffer();
      const zlib = await import("zlib");
      const { promisify } = await import("util");
      const gunzip = promisify(zlib.gunzip);
      const decompressed = await gunzip(Buffer.from(buffer));
      const csv = decompressed.toString("utf8");

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
```

---

## submitBid — bid for next round (wallet required)

```typescript
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";

export async function submitBid(params: {
  privateKey: `0x${string}`;
  bidAmountEth: string;
  targetRound: number;
  useMainnet?: boolean;
}) {
  const { privateKey, bidAmountEth, targetRound, useMainnet = false } = params;
  const chain = useMainnet ? arbitrum : arbitrumSepolia;
  const auctionAddress = "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079" as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const bidAmountWei = BigInt(Math.floor(Number(bidAmountEth) * 1e18));

  const walletClient = createWalletClient({ account, chain, transport: http() });

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
  serializedTx: `0x${string}`;
  currentRound: number;
  sequenceNumber: number;
  useMainnet?: boolean;
}) {
  const { controllerPrivateKey, serializedTx, currentRound, sequenceNumber, useMainnet = false } = params;
  const chainId = useMainnet ? 42161 : 421614;
  const auctionAddress = "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079" as `0x${string}`;
  const rpc = useMainnet
    ? "https://arb1.arbitrum.io/rpc"
    : "https://sepolia-rollup.arbitrum.io/rpc";

  const controller = privateKeyToAccount(controllerPrivateKey);

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
  if (json.error) throw new Error(`Express lane tx failed: ${JSON.stringify(json.error)}`);

  return {
    accepted: true,
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
