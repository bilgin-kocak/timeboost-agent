import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock all timeboost modules before importing server
vi.mock("../src/timeboost/round.js", () => ({
  getRoundState: vi.fn(async () => ({
    currentRound: 87432,
    nextRound: 87433,
    expressLaneController: "0x1234567890abcdef1234567890abcdef12345678",
    hasController: true,
    reservePrice: "1000000000000000",
    isAuctionOpen: true,
    msUntilNextRound: 45000,
    msUntilAuctionCloses: 30000,
    expressLaneAdvantageMs: 200,
  })),
}));

vi.mock("../src/timeboost/history.js", () => ({
  getRecentBidHistory: vi.fn(async () => [
    { round: 100, bidder: "0xa", amount: "1000000000000000", expressLaneController: "0xc1", timestamp: "t1" },
  ]),
  analyzeBidHistory: vi.fn(() => ({
    totalBids: 1,
    uniqueBidders: 1,
    maxBid: "1000000000000000",
    medianBid: "1000000000000000",
    minBid: "1000000000000000",
    dominantController: "0xc1",
    recentRounds: [100],
  })),
}));

vi.mock("../src/timeboost/intelligence.js", () => ({
  shouldUseExpressLane: vi.fn(() => ({
    shouldBoost: true,
    reason: "High urgency",
    estimatedWinningBid: "1000000000000000",
    confidencePercent: 75,
    urgencyMs: 200,
  })),
}));

vi.mock("../src/timeboost/auction.js", () => ({
  submitBid: vi.fn(async () => ({
    success: true,
    bidAmount: "5000000000000000",
    round: 87433,
    controller: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    txHash: "0xbidtxhash",
  })),
}));

vi.mock("../src/timeboost/express-lane.js", () => ({
  sendExpressLaneTx: vi.fn(async () => ({
    accepted: true,
    round: 87432,
    sequenceNumber: 0,
    note: "Tx accepted",
  })),
  checkIfTimeboosted: vi.fn(async () => true),
}));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";

describe("MCP server", () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer({ chain: "arbitrum", privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}` });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists exactly 6 tools", async () => {
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(6);
  });

  it("has all expected tool names", async () => {
    const tools = await client.listTools();
    const names = tools.tools.map((t: any) => t.name);
    expect(names).toContain("get_timeboost_round_state");
    expect(names).toContain("get_bid_history");
    expect(names).toContain("analyze_should_boost");
    expect(names).toContain("bid_for_express_lane");
    expect(names).toContain("send_express_lane_tx");
    expect(names).toContain("check_timeboosted");
  });

  it("each tool has description and inputSchema", async () => {
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
    }
  });

  it("get_timeboost_round_state returns round state JSON", async () => {
    const result = await client.callTool({ name: "get_timeboost_round_state", arguments: {} });
    const text = (result.content as any)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.currentRound).toBe(87432);
    expect(parsed.nextRound).toBe(87433);
  });

  it("get_bid_history returns analysis JSON", async () => {
    const result = await client.callTool({ name: "get_bid_history", arguments: {} });
    const text = (result.content as any)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("rawCount");
    expect(parsed).toHaveProperty("analysis");
  });

  it("analyze_should_boost returns decision JSON", async () => {
    const result = await client.callTool({
      name: "analyze_should_boost",
      arguments: { tx_type: "liquidation", urgency_ms: 200 },
    });
    const text = (result.content as any)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("shouldBoost");
    expect(parsed).toHaveProperty("reason");
  });

  it("bid_for_express_lane returns bid result", async () => {
    const result = await client.callTool({
      name: "bid_for_express_lane",
      arguments: { bid_amount_eth: "0.005" },
    });
    const text = (result.content as any)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
  });

  it("send_express_lane_tx returns accepted result", async () => {
    const result = await client.callTool({
      name: "send_express_lane_tx",
      arguments: { serialized_tx: "0xf86c0184" },
    });
    const text = (result.content as any)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.accepted).toBe(true);
  });

  it("check_timeboosted returns timeboosted status", async () => {
    const result = await client.callTool({
      name: "check_timeboosted",
      arguments: { tx_hash: "0xabc123" },
    });
    const text = (result.content as any)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("timeboosted");
  });

  it("unknown tool returns error", async () => {
    const result = await client.callTool({ name: "nonexistent_tool", arguments: {} });
    expect((result as any).isError).toBe(true);
  });
});
