import { keccak256, encodePacked, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS } from "../constants.js";
import type { ChainName, ExpressLaneTxResult } from "../types.js";

const TIMEBOOST_PREFIX = keccak256(
  encodePacked(["string"], ["TIMEBOOST_BID"]),
);

export async function sendExpressLaneTx(params: {
  chain: ChainName;
  controllerPrivateKey: `0x${string}`;
  serializedTx: `0x${string}`;
  round: number;
  sequenceNumber: number;
  _fetchFn?: typeof fetch;
}): Promise<ExpressLaneTxResult> {
  const { chain, controllerPrivateKey, serializedTx, round, sequenceNumber, _fetchFn } = params;
  const config = CHAINS[chain];
  const controller = privateKeyToAccount(controllerPrivateKey);
  const fetchFn = _fetchFn ?? fetch;

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
      ],
    ),
  );

  const signature = await controller.signMessage({
    message: { raw: messageHash },
  });

  const res = await fetchFn(config.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "express-lane-tx",
      method: "timeboost_sendExpressLaneTransaction",
      params: [
        {
          chainId: toHex(config.id),
          round: toHex(round),
          auctionContractAddress: config.auctionContract,
          sequenceNumber: toHex(sequenceNumber),
          transaction: serializedTx,
          options: {},
          signature,
        },
      ],
    }),
  });

  const json = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };

  if (json.error)
    throw new Error(`Express lane tx failed: ${JSON.stringify(json.error)}`);

  return {
    accepted: true,
    round,
    sequenceNumber,
    note: "Null result from sequencer = success. Tx is queued for express sequencing.",
  };
}

export async function checkIfTimeboosted(
  txHash: `0x${string}`,
  rpcUrl: string,
  _fetchFn?: typeof fetch,
): Promise<boolean> {
  const fetchFn = _fetchFn ?? fetch;

  const res = await fetchFn(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "get-receipt",
      method: "eth_getTransactionReceipt",
      params: [txHash],
    }),
  });

  const json = (await res.json()) as { result?: { timeboosted?: boolean } };
  return json.result?.timeboosted === true;
}
