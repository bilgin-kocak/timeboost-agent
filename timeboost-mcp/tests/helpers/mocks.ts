import { vi } from "vitest";

export function createMockPublicClient(overrides: {
  currentRound?: bigint;
  controller?: string;
  reservePrice?: bigint;
  isRoundClosed?: boolean;
} = {}) {
  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "currentRound":
          return overrides.currentRound ?? 100n;
        case "expressLaneControllerOf":
          return overrides.controller ?? "0x0000000000000000000000000000000000000000";
        case "reservePrice":
          return overrides.reservePrice ?? 1000000000000000n;
        case "isAuctionRoundClosed":
          return overrides.isRoundClosed ?? false;
        default:
          throw new Error(`Unmocked function: ${functionName}`);
      }
    }),
  };
}

export function createMockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const key = body.method || url;
    const response = responses[key];
    if (!response) {
      return { ok: false, status: 404, json: async () => ({ error: "not found" }), text: async () => "" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => (typeof response === "string" ? response : JSON.stringify(response)),
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  });
}
