import { describe, it, expect, vi, afterEach } from "vitest";
import { sendExpressLaneTx, checkIfTimeboosted } from "../src/timeboost/express-lane.js";

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

describe("express-lane", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendExpressLaneTx", () => {
    it("sends timeboost_sendExpressLaneTransaction RPC method", async () => {
      const calls: any[] = [];
      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        calls.push(body);
        return { ok: true, json: async () => ({ jsonrpc: "2.0", id: "express-lane-tx", result: null }) };
      });

      await sendExpressLaneTx({
        chain: "arbitrum",
        controllerPrivateKey: TEST_PRIVATE_KEY,
        serializedTx: "0xf86c0184" as `0x${string}`,
        round: 87432,
        sequenceNumber: 0,
        _fetchFn: mockFetch as any,
      });

      expect(calls[0].method).toBe("timeboost_sendExpressLaneTransaction");
    });

    it("includes all required params", async () => {
      let capturedParams: any;
      const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        capturedParams = body.params[0];
        return { ok: true, json: async () => ({ jsonrpc: "2.0", result: null }) };
      });

      await sendExpressLaneTx({
        chain: "arbitrum",
        controllerPrivateKey: TEST_PRIVATE_KEY,
        serializedTx: "0xf86c0184" as `0x${string}`,
        round: 87432,
        sequenceNumber: 0,
        _fetchFn: mockFetch as any,
      });

      expect(capturedParams).toHaveProperty("chainId");
      expect(capturedParams).toHaveProperty("round");
      expect(capturedParams).toHaveProperty("auctionContractAddress");
      expect(capturedParams).toHaveProperty("sequenceNumber");
      expect(capturedParams).toHaveProperty("transaction");
      expect(capturedParams).toHaveProperty("signature");
      expect(capturedParams).toHaveProperty("options");
    });

    it("returns accepted=true on null result (success)", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result: null }),
      }));

      const result = await sendExpressLaneTx({
        chain: "arbitrum",
        controllerPrivateKey: TEST_PRIVATE_KEY,
        serializedTx: "0xf86c0184" as `0x${string}`,
        round: 87432,
        sequenceNumber: 0,
        _fetchFn: mockFetch as any,
      });

      expect(result.accepted).toBe(true);
      expect(result.round).toBe(87432);
      expect(result.sequenceNumber).toBe(0);
    });

    it("throws on RPC error", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", error: { code: -32000, message: "not controller" } }),
      }));

      await expect(
        sendExpressLaneTx({
          chain: "arbitrum",
          controllerPrivateKey: TEST_PRIVATE_KEY,
          serializedTx: "0xf86c0184" as `0x${string}`,
          round: 87432,
          sequenceNumber: 0,
          _fetchFn: mockFetch as any,
        }),
      ).rejects.toThrow("Express lane tx failed");
    });
  });

  describe("checkIfTimeboosted", () => {
    it("returns true when receipt has timeboosted=true", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result: { timeboosted: true, blockNumber: "0x100" } }),
      }));

      const result = await checkIfTimeboosted(
        "0xabc123" as `0x${string}`,
        "https://arb1.arbitrum.io/rpc",
        mockFetch as any,
      );
      expect(result).toBe(true);
    });

    it("returns false when timeboosted is false", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result: { timeboosted: false } }),
      }));

      const result = await checkIfTimeboosted(
        "0xabc123" as `0x${string}`,
        "https://arb1.arbitrum.io/rpc",
        mockFetch as any,
      );
      expect(result).toBe(false);
    });

    it("returns false when receipt is null (pending tx)", async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result: null }),
      }));

      const result = await checkIfTimeboosted(
        "0xabc123" as `0x${string}`,
        "https://arb1.arbitrum.io/rpc",
        mockFetch as any,
      );
      expect(result).toBe(false);
    });

    it("calls eth_getTransactionReceipt method", async () => {
      let capturedMethod: string = "";
      const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
        capturedMethod = JSON.parse(init?.body as string).method;
        return { ok: true, json: async () => ({ jsonrpc: "2.0", result: null }) };
      });

      await checkIfTimeboosted(
        "0xabc123" as `0x${string}`,
        "https://arb1.arbitrum.io/rpc",
        mockFetch as any,
      );
      expect(capturedMethod).toBe("eth_getTransactionReceipt");
    });
  });
});
