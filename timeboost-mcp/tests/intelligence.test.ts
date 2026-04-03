import { describe, it, expect } from "vitest";
import { shouldUseExpressLane } from "../src/timeboost/intelligence.js";
import type { BidRecord } from "../src/types.js";

const makeBids = (amounts: string[]): BidRecord[] =>
  amounts.map((amount, i) => ({
    round: 100 + i,
    bidder: `0x${i}`,
    amount,
    expressLaneController: "0xctrl",
    timestamp: "t",
  }));

describe("intelligence", () => {
  it("liquidation with high urgency recommends boosting", () => {
    const result = shouldUseExpressLane({
      txValueWei: 5000000000000000000n, // 5 ETH
      txType: "liquidation",
      urgencyMs: 200,
      bidHistory: null,
      reservePrice: 1000000000000000n, // 0.001 ETH
      myMaxBudgetWei: 10000000000000000n, // 0.01 ETH
    });
    expect(result.shouldBoost).toBe(true);
  });

  it("transfer with low urgency does not recommend boosting", () => {
    const result = shouldUseExpressLane({
      txValueWei: 1000000000000000000n,
      txType: "transfer",
      urgencyMs: 30000,
      bidHistory: null,
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 10000000000000000n,
    });
    expect(result.shouldBoost).toBe(false);
  });

  it("budget exceeded returns shouldBoost false with reason", () => {
    const result = shouldUseExpressLane({
      txValueWei: 5000000000000000000n,
      txType: "liquidation",
      urgencyMs: 200,
      bidHistory: makeBids(["100000000000000000"]), // median = 0.1 ETH
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 1000000000000000n, // 0.001 ETH — way below estimated winning
    });
    expect(result.shouldBoost).toBe(false);
    expect(result.reason.toLowerCase()).toContain("exceeds");
  });

  it("arbitrage with medium urgency recommends boosting", () => {
    const result = shouldUseExpressLane({
      txValueWei: 2000000000000000000n,
      txType: "arbitrage",
      urgencyMs: 400,
      bidHistory: null,
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 10000000000000000n,
    });
    expect(result.shouldBoost).toBe(true);
  });

  it("swap with low urgency does not boost", () => {
    const result = shouldUseExpressLane({
      txValueWei: 1000000000000000000n,
      txType: "swap",
      urgencyMs: 15000,
      bidHistory: null,
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 10000000000000000n,
    });
    expect(result.shouldBoost).toBe(false);
  });

  it("no bid history results in lower confidence (40%)", () => {
    const result = shouldUseExpressLane({
      txValueWei: 5000000000000000000n,
      txType: "liquidation",
      urgencyMs: 200,
      bidHistory: null,
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 10000000000000000n,
    });
    expect(result.confidencePercent).toBe(40);
  });

  it("with bid history results in higher confidence (75%)", () => {
    const result = shouldUseExpressLane({
      txValueWei: 5000000000000000000n,
      txType: "liquidation",
      urgencyMs: 200,
      bidHistory: makeBids(["1000000000000000", "2000000000000000", "3000000000000000"]),
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 10000000000000000n,
    });
    expect(result.confidencePercent).toBe(75);
  });

  it("estimated winning bid uses median * 110% with history", () => {
    // Bids: 1000, 2000, 3000 → sorted desc: 3000, 2000, 1000 → median = 2000
    // 2000 * 110% = 2200
    const result = shouldUseExpressLane({
      txValueWei: 5000000000000000000n,
      txType: "liquidation",
      urgencyMs: 200,
      bidHistory: makeBids(["1000", "2000", "3000"]),
      reservePrice: 500n,
      myMaxBudgetWei: 100000n,
    });
    expect(result.estimatedWinningBid).toBe("2200");
  });

  it("swap with very high urgency does boost", () => {
    const result = shouldUseExpressLane({
      txValueWei: 1000000000000000000n,
      txType: "swap",
      urgencyMs: 100,
      bidHistory: null,
      reservePrice: 1000000000000000n,
      myMaxBudgetWei: 10000000000000000n,
    });
    expect(result.shouldBoost).toBe(true);
  });

  it("returns correct shape", () => {
    const result = shouldUseExpressLane({
      txValueWei: 0n,
      txType: "other",
      urgencyMs: 5000,
      bidHistory: null,
      reservePrice: 1000n,
      myMaxBudgetWei: 10000n,
    });
    expect(result).toHaveProperty("shouldBoost");
    expect(result).toHaveProperty("reason");
    expect(result).toHaveProperty("estimatedWinningBid");
    expect(result).toHaveProperty("confidencePercent");
    expect(result).toHaveProperty("urgencyMs");
  });
});
