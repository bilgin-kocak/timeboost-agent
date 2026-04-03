import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS } from "../constants.js";
import type { ChainName, BidSubmissionResult } from "../types.js";

export async function submitBid(params: {
  chain: ChainName;
  privateKey: `0x${string}`;
  bidAmountWei: bigint;
  expressLaneControllerAddress: `0x${string}`;
  targetRound: number;
  _fetchFn?: typeof fetch;
}): Promise<BidSubmissionResult> {
  const { chain, privateKey, bidAmountWei, expressLaneControllerAddress, targetRound, _fetchFn } = params;
  const config = CHAINS[chain];
  const account = privateKeyToAccount(privateKey);
  const fetchFn = _fetchFn ?? fetch;

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
  } as const;

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

  const bidPayload = {
    chainId: toHex(config.id),
    auctionContractAddress: config.auctionContract,
    roundNumber: toHex(targetRound),
    amount: toHex(bidAmountWei),
    expressLaneController: expressLaneControllerAddress,
    signature,
  };

  const res = await fetchFn(config.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "bid-submission",
      method: "auctioneer_submitBid",
      params: [bidPayload],
    }),
  });

  const json = (await res.json()) as { result?: string; error?: { code: number; message: string } };

  if (json.error) throw new Error(`Bid failed: ${JSON.stringify(json.error)}`);

  return {
    success: true,
    bidAmount: bidAmountWei.toString(),
    round: targetRound,
    controller: expressLaneControllerAddress,
    txHash: json.result ?? "",
  };
}
