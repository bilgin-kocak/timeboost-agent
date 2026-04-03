import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import { getRoundState } from "./timeboost/round.js";
import { getRecentBidHistory, analyzeBidHistory } from "./timeboost/history.js";
import { shouldUseExpressLane } from "./timeboost/intelligence.js";
import { submitBid } from "./timeboost/auction.js";
import { sendExpressLaneTx, checkIfTimeboosted } from "./timeboost/express-lane.js";
import type { ChainName } from "./types.js";

export function createServer(config: {
  chain: ChainName;
  privateKey?: `0x${string}`;
}) {
  const { chain: CHAIN, privateKey: PRIVATE_KEY } = config;

  const server = new Server(
    { name: "timeboost-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_timeboost_round_state",
        description:
          "Get the current Timeboost round number, express lane controller, reserve price, auction timing, and whether the auction is still open for bids. Call this first to understand the current state.",
        inputSchema: { type: "object" as const, properties: {}, required: [] },
      },
      {
        name: "get_bid_history",
        description:
          "Fetch and analyze recent bid history from Arbitrum's public S3 bucket. Returns statistics about recent bids: max bid, median bid, dominant controller address, unique bidder count. Use this to estimate what you need to bid to win.",
        inputSchema: {
          type: "object" as const,
          properties: {
            days_back: {
              type: "number",
              description: "How many days of history to analyze (default: 1)",
            },
          },
          required: [],
        },
      },
      {
        name: "analyze_should_boost",
        description:
          "Decide intelligently whether a given transaction is worth submitting via the express lane. Returns a yes/no recommendation with reasoning, estimated winning bid, and confidence score.",
        inputSchema: {
          type: "object" as const,
          properties: {
            tx_value_eth: {
              type: "string",
              description: "Value at stake in the transaction (ETH, e.g. '0.5')",
            },
            tx_type: {
              type: "string",
              enum: ["swap", "liquidation", "arbitrage", "transfer", "other"],
              description: "Type of transaction — affects urgency scoring",
            },
            urgency_ms: {
              type: "number",
              description:
                "How quickly this tx needs to confirm in ms (e.g. 500 = very urgent, 10000 = not urgent)",
            },
            my_max_budget_eth: {
              type: "string",
              description:
                "Maximum you're willing to bid for the express lane (ETH)",
            },
          },
          required: ["tx_type", "urgency_ms"],
        },
      },
      {
        name: "bid_for_express_lane",
        description:
          "Submit a sealed bid to win the express lane for the NEXT round. The auction is a second-price auction — you pay the second-highest bid, not your bid amount. Auction closes 15 seconds before round start.",
        inputSchema: {
          type: "object" as const,
          properties: {
            bid_amount_eth: {
              type: "string",
              description: "Your bid amount in ETH (e.g. '0.005')",
            },
            controller_address: {
              type: "string",
              description:
                "Address that will control the express lane if you win (default: your wallet)",
            },
          },
          required: ["bid_amount_eth"],
        },
      },
      {
        name: "send_express_lane_tx",
        description:
          "Submit a pre-signed transaction through the Timeboost express lane for priority sequencing. The transaction skips the 200ms artificial delay. You must be the current round's express lane controller.",
        inputSchema: {
          type: "object" as const,
          properties: {
            serialized_tx: {
              type: "string",
              description:
                "RLP-encoded signed transaction (0x-prefixed hex)",
            },
            sequence_number: {
              type: "number",
              description:
                "Per-round nonce for express lane submissions (starts at 0 each round)",
            },
          },
          required: ["serialized_tx"],
        },
      },
      {
        name: "check_timeboosted",
        description:
          "Check whether a transaction hash was actually sequenced via the express lane (timeboosted). The tx receipt includes a timeboosted field. Use this to verify your express lane submissions worked.",
        inputSchema: {
          type: "object" as const,
          properties: {
            tx_hash: {
              type: "string",
              description: "Transaction hash to check (0x-prefixed)",
            },
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
            content: [{ type: "text" as const, text: JSON.stringify(state, null, 2) }],
          };
        }

        case "get_bid_history": {
          if (CHAIN !== "arbitrum") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "S3 bid history is only available for Arbitrum One mainnet.",
                },
              ],
            };
          }
          const bids = await getRecentBidHistory(
            "arbitrum",
            (args?.days_back as number) ?? 1,
          );
          const analysis = analyzeBidHistory(bids);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ rawCount: bids.length, analysis }, null, 2),
              },
            ],
          };
        }

        case "analyze_should_boost": {
          const bids =
            CHAIN === "arbitrum"
              ? await getRecentBidHistory("arbitrum", 1)
              : null;
          const state = await getRoundState(CHAIN);

          const txValueWei = args?.tx_value_eth
            ? BigInt(Math.floor(Number(args.tx_value_eth as string) * 1e18))
            : 0n;
          const maxBudgetWei = args?.my_max_budget_eth
            ? BigInt(
                Math.floor(Number(args.my_max_budget_eth as string) * 1e18),
              )
            : BigInt(1e16);

          const decision = shouldUseExpressLane({
            txValueWei,
            txType: (args?.tx_type as any) ?? "other",
            urgencyMs: (args?.urgency_ms as number) ?? 5000,
            bidHistory: bids,
            reservePrice: BigInt(state.reservePrice),
            myMaxBudgetWei: maxBudgetWei,
          });

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(decision, null, 2) },
            ],
          };
        }

        case "bid_for_express_lane": {
          if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY env var not set");
          const bidWei = BigInt(
            Math.floor(
              Number((args?.bid_amount_eth as string) ?? "0.001") * 1e18,
            ),
          );
          const state = await getRoundState(CHAIN);
          const { privateKeyToAccount } = await import("viem/accounts");
          const account = privateKeyToAccount(PRIVATE_KEY);

          const result = await submitBid({
            chain: CHAIN,
            privateKey: PRIVATE_KEY,
            bidAmountWei: bidWei,
            expressLaneControllerAddress: ((args?.controller_address as string) ??
              account.address) as `0x${string}`,
            targetRound: state.nextRound,
          });
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        }

        case "send_express_lane_tx": {
          if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY env var not set");
          const state = await getRoundState(CHAIN);

          const result = await sendExpressLaneTx({
            chain: CHAIN,
            controllerPrivateKey: PRIVATE_KEY,
            serializedTx: (args?.serialized_tx as string) as `0x${string}`,
            round: state.currentRound,
            sequenceNumber: (args?.sequence_number as number) ?? 0,
          });
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        }

        case "check_timeboosted": {
          const rpcUrl =
            CHAIN === "arbitrum"
              ? "https://arb1.arbitrum.io/rpc"
              : "https://sepolia-rollup.arbitrum.io/rpc";
          const boosted = await checkIfTimeboosted(
            (args?.tx_hash as string) as `0x${string}`,
            rpcUrl,
          );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { txHash: args?.tx_hash, timeboosted: boosted, chain: CHAIN },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// Main entrypoint — only runs when executed directly
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isMainModule) {
  const server = createServer({
    chain: (process.env.CHAIN ?? "arbitrum") as ChainName,
    privateKey: process.env.PRIVATE_KEY as `0x${string}` | undefined,
  });
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error("Timeboost MCP server running on stdio");
  });
}
