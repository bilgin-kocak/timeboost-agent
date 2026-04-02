import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitBid } from "../src/timeboost/auction.js";

// Test private key (well-known, never use with real funds)
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

describe("auction", () => {
  let capturedFetchCalls: Array<{ url: string; body: any }> = [];

  beforeEach(() => {
    capturedFetchCalls = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockFetchSuccess = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    capturedFetchCalls.push({ url: url as string, body });
    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: "bid-submission", result: "0xbidtxhash123" }),
    };
  });

  const mockFetchError = vi.fn(async () => ({
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: "bid-submission", error: { code: -32000, message: "bid too low" } }),
  }));

  it("sends auctioneer_submitBid JSON-RPC method", async () => {
    const result = await submitBid({
      chain: "arbitrum",
      privateKey: TEST_PRIVATE_KEY,
      bidAmountWei: 5000000000000000n,
      expressLaneControllerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      targetRound: 87433,
      _fetchFn: mockFetchSuccess as any,
    });

    expect(capturedFetchCalls).toHaveLength(1);
    expect(capturedFetchCalls[0].body.method).toBe("auctioneer_submitBid");
  });

  it("includes all required params in the bid payload", async () => {
    await submitBid({
      chain: "arbitrum",
      privateKey: TEST_PRIVATE_KEY,
      bidAmountWei: 5000000000000000n,
      expressLaneControllerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      targetRound: 87433,
      _fetchFn: mockFetchSuccess as any,
    });

    const params = capturedFetchCalls[0].body.params[0];
    expect(params).toHaveProperty("chainId");
    expect(params).toHaveProperty("auctionContractAddress");
    expect(params).toHaveProperty("roundNumber");
    expect(params).toHaveProperty("amount");
    expect(params).toHaveProperty("expressLaneController");
    expect(params).toHaveProperty("signature");
  });

  it("returns success result with correct shape", async () => {
    const result = await submitBid({
      chain: "arbitrum",
      privateKey: TEST_PRIVATE_KEY,
      bidAmountWei: 5000000000000000n,
      expressLaneControllerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      targetRound: 87433,
      _fetchFn: mockFetchSuccess as any,
    });

    expect(result.success).toBe(true);
    expect(result.bidAmount).toBe("5000000000000000");
    expect(result.round).toBe(87433);
    expect(result.controller).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(result.txHash).toBe("0xbidtxhash123");
  });

  it("throws on RPC error response", async () => {
    await expect(
      submitBid({
        chain: "arbitrum",
        privateKey: TEST_PRIVATE_KEY,
        bidAmountWei: 5000000000000000n,
        expressLaneControllerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
        targetRound: 87433,
        _fetchFn: mockFetchError as any,
      }),
    ).rejects.toThrow("Bid failed");
  });

  it("uses correct chain ID for arbitrum", async () => {
    await submitBid({
      chain: "arbitrum",
      privateKey: TEST_PRIVATE_KEY,
      bidAmountWei: 1000n,
      expressLaneControllerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      targetRound: 100,
      _fetchFn: mockFetchSuccess as any,
    });

    const params = capturedFetchCalls[0].body.params[0];
    expect(params.chainId).toBe("0xa4b1"); // 42161 in hex
  });

  it("sends to correct RPC endpoint", async () => {
    await submitBid({
      chain: "arbitrum",
      privateKey: TEST_PRIVATE_KEY,
      bidAmountWei: 1000n,
      expressLaneControllerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      targetRound: 100,
      _fetchFn: mockFetchSuccess as any,
    });

    expect(capturedFetchCalls[0].url).toContain("arb1.arbitrum.io");
  });
});
