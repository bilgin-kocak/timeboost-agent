import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPublicClient } from "./helpers/mocks.js";
import { getRoundState } from "../src/timeboost/round.js";

describe("round", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set time so we're 30 seconds into a round (30s left until next round)
    // This means auction should be open (30s > 15s close window)
    vi.setSystemTime(new Date("2025-06-10T12:00:30.000Z"));
  });

  it("returns correct RoundState shape", async () => {
    const client = createMockPublicClient({ currentRound: 87432n });
    const state = await getRoundState("arbitrum", client as any);

    expect(state).toHaveProperty("currentRound");
    expect(state).toHaveProperty("nextRound");
    expect(state).toHaveProperty("expressLaneController");
    expect(state).toHaveProperty("hasController");
    expect(state).toHaveProperty("reservePrice");
    expect(state).toHaveProperty("isAuctionOpen");
    expect(state).toHaveProperty("msUntilNextRound");
    expect(state).toHaveProperty("msUntilAuctionCloses");
    expect(state).toHaveProperty("expressLaneAdvantageMs");
  });

  it("nextRound is currentRound + 1", async () => {
    const client = createMockPublicClient({ currentRound: 100n });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.nextRound).toBe(101);
  });

  it("hasController is true for non-zero address", async () => {
    const client = createMockPublicClient({
      controller: "0x1234567890abcdef1234567890abcdef12345678",
    });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.hasController).toBe(true);
  });

  it("hasController is false for zero address", async () => {
    const client = createMockPublicClient({
      controller: "0x0000000000000000000000000000000000000000",
    });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.hasController).toBe(false);
  });

  it("reservePrice is string representation of bigint", async () => {
    const client = createMockPublicClient({ reservePrice: 5000000000000000n });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.reservePrice).toBe("5000000000000000");
  });

  it("isAuctionOpen is true when time allows and contract not closed", async () => {
    // 30s into round = 30s left > 15s close window → auction open
    const client = createMockPublicClient({ isRoundClosed: false });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.isAuctionOpen).toBe(true);
  });

  it("isAuctionOpen is false when contract says closed", async () => {
    const client = createMockPublicClient({ isRoundClosed: true });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.isAuctionOpen).toBe(false);
  });

  it("isAuctionOpen is false when within 15s close window", async () => {
    // Set time so only 10s left in round (within 15s close window)
    vi.setSystemTime(new Date("2025-06-10T12:00:50.000Z"));
    const client = createMockPublicClient({ isRoundClosed: false });
    const state = await getRoundState("arbitrum", client as any);
    expect(state.isAuctionOpen).toBe(false);
  });

  it("msUntilAuctionCloses is never negative", async () => {
    // Set time so only 5s left (auction already closed by timing)
    vi.setSystemTime(new Date("2025-06-10T12:00:55.000Z"));
    const client = createMockPublicClient();
    const state = await getRoundState("arbitrum", client as any);
    expect(state.msUntilAuctionCloses).toBeGreaterThanOrEqual(0);
  });

  it("expressLaneAdvantageMs is always 200", async () => {
    const client = createMockPublicClient();
    const state = await getRoundState("arbitrum", client as any);
    expect(state.expressLaneAdvantageMs).toBe(200);
  });

  it("works with arbitrum-sepolia chain", async () => {
    const client = createMockPublicClient({ currentRound: 50n });
    const state = await getRoundState("arbitrum-sepolia", client as any);
    expect(state.currentRound).toBe(50);
  });
});
