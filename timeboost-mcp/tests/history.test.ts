import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRecentBidHistory, analyzeBidHistory } from "../src/timeboost/history.js";
import type { BidRecord } from "../src/types.js";

describe("history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("getRecentBidHistory", () => {
    it("constructs correct S3 URL for today", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `<ListBucketResult><Contents><Key>ue2/validated-timeboost-bids/2025/06/10/001-002.csv.gzip</Key></Contents></ListBucketResult>`,
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(0),
        });
      vi.stubGlobal("fetch", mockFetch);

      await getRecentBidHistory("arbitrum", 1).catch(() => {});
      expect(mockFetch.mock.calls[0][0]).toContain("/2025/06/10/");
    });

    it("parses S3 XML listing to extract keys", async () => {
      const xml = `<ListBucketResult>
        <Contents><Key>ue2/validated-timeboost-bids/2025/06/10/001-002.csv.gzip</Key></Contents>
        <Contents><Key>ue2/validated-timeboost-bids/2025/06/10/003-004.csv.gzip</Key></Contents>
        <Contents><Key>ue2/validated-timeboost-bids/2025/06/10/005-006.csv.gzip</Key></Contents>
      </ListBucketResult>`;

      const csvData = "round,bidder,amount,expressLaneController,timestamp\n100,0xabc,1000,0xdef,2025-06-10T12:00:00Z";

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => xml })
        .mockResolvedValue({
          ok: true,
          arrayBuffer: async () => Buffer.from(csvData),
        });
      vi.stubGlobal("fetch", mockFetch);

      // The function will try to fetch up to 3 file URLs after the listing
      await getRecentBidHistory("arbitrum", 1, true).catch(() => {});
      // First call is the listing, rest are file fetches
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("parses CSV rows into BidRecord objects skipping header", async () => {
      const xml = `<ListBucketResult><Contents><Key>ue2/validated-timeboost-bids/2025/06/10/001-002.csv.gzip</Key></Contents></ListBucketResult>`;
      const csvData = "round,bidder,amount,expressLaneController,timestamp\n100,0xabc,1000,0xdef,2025-06-10T12:00:00Z\n101,0xghi,2000,0xjkl,2025-06-10T12:01:00Z";

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => xml })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Buffer.from(csvData) });
      vi.stubGlobal("fetch", mockFetch);

      const bids = await getRecentBidHistory("arbitrum", 1, true);
      expect(bids).toHaveLength(2);
      expect(bids[0].round).toBe(100);
      expect(bids[0].bidder).toBe("0xabc");
      expect(bids[0].amount).toBe("1000");
      expect(bids[1].round).toBe(101);
    });

    it("returns empty array on fetch error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
      const bids = await getRecentBidHistory("arbitrum", 1);
      expect(bids).toEqual([]);
    });

    it("throws for chains without S3", async () => {
      await expect(
        getRecentBidHistory("arbitrum-sepolia" as any, 1)
      ).rejects.toThrow();
    });
  });

  describe("analyzeBidHistory", () => {
    it("returns null for empty array", () => {
      expect(analyzeBidHistory([])).toBeNull();
    });

    it("computes correct stats", () => {
      const bids: BidRecord[] = [
        { round: 100, bidder: "0xa", amount: "3000", expressLaneController: "0xc1", timestamp: "t1" },
        { round: 100, bidder: "0xb", amount: "1000", expressLaneController: "0xc1", timestamp: "t2" },
        { round: 101, bidder: "0xa", amount: "5000", expressLaneController: "0xc1", timestamp: "t3" },
        { round: 101, bidder: "0xc", amount: "2000", expressLaneController: "0xc2", timestamp: "t4" },
        { round: 102, bidder: "0xa", amount: "4000", expressLaneController: "0xc1", timestamp: "t5" },
      ];
      const analysis = analyzeBidHistory(bids);
      expect(analysis).not.toBeNull();
      expect(analysis!.totalBids).toBe(5);
      expect(analysis!.uniqueBidders).toBe(3);
      expect(analysis!.maxBid).toBe("5000");
      expect(analysis!.minBid).toBe("1000");
      // Sorted desc: 5000, 4000, 3000, 2000, 1000 → median at index 2 = 3000
      expect(analysis!.medianBid).toBe("3000");
      expect(analysis!.dominantController).toBe("0xc1");
    });

    it("handles single bid without crashing", () => {
      const bids: BidRecord[] = [
        { round: 100, bidder: "0xa", amount: "1000", expressLaneController: "0xc1", timestamp: "t1" },
      ];
      const analysis = analyzeBidHistory(bids);
      expect(analysis).not.toBeNull();
      expect(analysis!.totalBids).toBe(1);
      expect(analysis!.uniqueBidders).toBe(1);
      expect(analysis!.maxBid).toBe("1000");
      expect(analysis!.medianBid).toBe("1000");
      expect(analysis!.minBid).toBe("1000");
    });
  });
});
