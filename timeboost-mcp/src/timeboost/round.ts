import { createPublicClient, http } from "viem";
import { CHAINS, ROUND_DURATION_MS, AUCTION_CLOSE_BEFORE_ROUND_MS } from "../constants.js";
import type { ChainName, RoundState } from "../types.js";

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
] as const;

export async function getRoundState(
  chain: ChainName,
  clientOverride?: { readContract: (args: any) => Promise<any> },
): Promise<RoundState> {
  const config = CHAINS[chain];
  const client =
    clientOverride ??
    createPublicClient({ transport: http(config.rpc) });

  const address = config.auctionContract as `0x${string}`;

  const [currentRound, reservePrice, isRoundClosed] = await Promise.all([
    client.readContract({ address, abi: AUCTION_ABI, functionName: "currentRound" }),
    client.readContract({ address, abi: AUCTION_ABI, functionName: "reservePrice" }),
    client.readContract({ address, abi: AUCTION_ABI, functionName: "isAuctionRoundClosed" }),
  ]);

  const controller = await client.readContract({
    address,
    abi: AUCTION_ABI,
    functionName: "expressLaneControllerOf",
    args: [currentRound as bigint],
  });

  const now = Date.now();
  const msUntilNextRound = ROUND_DURATION_MS - (now % ROUND_DURATION_MS);
  const msUntilAuctionCloses = Math.max(0, msUntilNextRound - AUCTION_CLOSE_BEFORE_ROUND_MS);
  const auctionOpen = msUntilAuctionCloses > 0 && !(isRoundClosed as boolean);

  return {
    currentRound: Number(currentRound),
    nextRound: Number(currentRound) + 1,
    expressLaneController: controller as string,
    hasController: (controller as string) !== "0x0000000000000000000000000000000000000000",
    reservePrice: (reservePrice as bigint).toString(),
    isAuctionOpen: auctionOpen,
    msUntilNextRound,
    msUntilAuctionCloses,
    expressLaneAdvantageMs: 200,
  };
}
