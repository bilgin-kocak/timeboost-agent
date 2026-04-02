import { describe, it, expect } from "vitest";
import type {
  BidRecord,
  BoostDecision,
  RoundState,
  BidSubmissionResult,
  ExpressLaneTxResult,
  ChainName,
} from "../src/types.js";

describe("types", () => {
  it("BidRecord shape is valid", () => {
    const record: BidRecord = {
      round: 100,
      bidder: "0x1234567890abcdef1234567890abcdef12345678",
      amount: "1000000000000000",
      expressLaneController: "0x1234567890abcdef1234567890abcdef12345678",
      timestamp: "2025-06-10T12:00:00Z",
    };
    expect(record.round).toBeTypeOf("number");
    expect(record.bidder).toBeTypeOf("string");
    expect(record.amount).toBeTypeOf("string");
    expect(record.expressLaneController).toBeTypeOf("string");
    expect(record.timestamp).toBeTypeOf("string");
  });

  it("BoostDecision shape is valid", () => {
    const decision: BoostDecision = {
      shouldBoost: true,
      reason: "High urgency liquidation",
      estimatedWinningBid: "1000000000000000",
      confidencePercent: 75,
      urgencyMs: 200,
    };
    expect(decision.shouldBoost).toBeTypeOf("boolean");
    expect(decision.reason).toBeTypeOf("string");
    expect(decision.estimatedWinningBid).toBeTypeOf("string");
    expect(decision.confidencePercent).toBeTypeOf("number");
    expect(decision.urgencyMs).toBeTypeOf("number");
  });

  it("RoundState shape is valid", () => {
    const state: RoundState = {
      currentRound: 87432,
      nextRound: 87433,
      expressLaneController: "0x0000000000000000000000000000000000000000",
      hasController: false,
      reservePrice: "1000000000000000",
      isAuctionOpen: true,
      msUntilNextRound: 45000,
      msUntilAuctionCloses: 30000,
      expressLaneAdvantageMs: 200,
    };
    expect(state.currentRound).toBeTypeOf("number");
    expect(state.nextRound).toBe(state.currentRound + 1);
    expect(state.expressLaneController).toBeTypeOf("string");
    expect(state.hasController).toBeTypeOf("boolean");
    expect(state.reservePrice).toBeTypeOf("string");
    expect(state.isAuctionOpen).toBeTypeOf("boolean");
    expect(state.msUntilNextRound).toBeTypeOf("number");
    expect(state.msUntilAuctionCloses).toBeTypeOf("number");
    expect(state.expressLaneAdvantageMs).toBe(200);
  });

  it("BidSubmissionResult shape is valid", () => {
    const result: BidSubmissionResult = {
      success: true,
      bidAmount: "5000000000000000",
      round: 87433,
      controller: "0x1234567890abcdef1234567890abcdef12345678",
      txHash: "0xabc123",
    };
    expect(result.success).toBe(true);
    expect(result.bidAmount).toBeTypeOf("string");
    expect(result.round).toBeTypeOf("number");
    expect(result.controller).toBeTypeOf("string");
    expect(result.txHash).toBeTypeOf("string");
  });

  it("ExpressLaneTxResult shape is valid", () => {
    const result: ExpressLaneTxResult = {
      accepted: true,
      round: 87432,
      sequenceNumber: 0,
      note: "Tx accepted",
    };
    expect(result.accepted).toBe(true);
    expect(result.round).toBeTypeOf("number");
    expect(result.sequenceNumber).toBeTypeOf("number");
    expect(result.note).toBeTypeOf("string");
  });

  it("ChainName type accepts valid values", () => {
    const chain1: ChainName = "arbitrum";
    const chain2: ChainName = "arbitrum-sepolia";
    expect(chain1).toBe("arbitrum");
    expect(chain2).toBe("arbitrum-sepolia");
  });
});
