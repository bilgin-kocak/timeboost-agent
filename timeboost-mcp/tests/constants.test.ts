import { describe, it, expect } from "vitest";
import {
  CHAINS,
  ROUND_DURATION_MS,
  AUCTION_CLOSE_BEFORE_ROUND_MS,
  EXPRESS_LANE_ADVANTAGE_MS,
  MAX_BIDS_PER_ROUND,
  TIMEBOOST_BID_TYPEHASH,
} from "../src/constants.js";

describe("constants", () => {
  describe("CHAINS", () => {
    it("has arbitrum and arbitrum-sepolia keys", () => {
      expect(CHAINS).toHaveProperty("arbitrum");
      expect(CHAINS).toHaveProperty("arbitrum-sepolia");
    });

    it("arbitrum one has correct chain id", () => {
      expect(CHAINS.arbitrum.id).toBe(42161);
    });

    it("arbitrum sepolia has correct chain id", () => {
      expect(CHAINS["arbitrum-sepolia"].id).toBe(421614);
    });

    it("arbitrum one has valid auction contract address", () => {
      expect(CHAINS.arbitrum.auctionContract).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("arbitrum one has valid rpc url", () => {
      expect(CHAINS.arbitrum.rpc).toMatch(/^https:\/\//);
    });

    it("arbitrum one has s3HttpBase with amazonaws.com", () => {
      expect(CHAINS.arbitrum.s3HttpBase).toContain("amazonaws.com");
    });

    it("arbitrum sepolia has valid rpc url", () => {
      expect(CHAINS["arbitrum-sepolia"].rpc).toMatch(/^https:\/\//);
    });
  });

  describe("timing constants", () => {
    it("round duration is 60 seconds", () => {
      expect(ROUND_DURATION_MS).toBe(60_000);
    });

    it("auction closes 15 seconds before round start", () => {
      expect(AUCTION_CLOSE_BEFORE_ROUND_MS).toBe(15_000);
    });

    it("express lane advantage is 200ms", () => {
      expect(EXPRESS_LANE_ADVANTAGE_MS).toBe(200);
    });

    it("max bids per round is 5", () => {
      expect(MAX_BIDS_PER_ROUND).toBe(5);
    });
  });

  describe("EIP-712", () => {
    it("typehash contains Bid(", () => {
      expect(TIMEBOOST_BID_TYPEHASH).toContain("Bid(");
    });
  });
});
