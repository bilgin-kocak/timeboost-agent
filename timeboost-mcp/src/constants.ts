export const CHAINS = {
  arbitrum: {
    id: 42161,
    rpc: "https://arb1.arbitrum.io/rpc",
    auctionContract: "0x5fcb496a31b7ae91e7c9078ec662bd7a55cd3079",
    s3Bucket: "s3://timeboost-auctioneer-arb1/ue2/validated-timeboost-bids/",
    s3HttpBase:
      "https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/ue2/validated-timeboost-bids",
  },
  "arbitrum-sepolia": {
    id: 421614,
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    auctionContract: "0x0000000000000000000000000000000000000000",
    s3Bucket: null,
    s3HttpBase: null,
  },
} as const;

export const ROUND_DURATION_MS = 60_000;
export const AUCTION_CLOSE_BEFORE_ROUND_MS = 15_000;
export const EXPRESS_LANE_ADVANTAGE_MS = 200;
export const MAX_BIDS_PER_ROUND = 5;

export const TIMEBOOST_BID_TYPEHASH =
  "Bid(uint64 roundNumber,address expressLaneController,uint256 amount)";
