export type ChainName = "arbitrum" | "arbitrum-sepolia";

export interface BidRecord {
  round: number;
  bidder: string;
  amount: string;
  expressLaneController: string;
  timestamp: string;
}

export interface RoundState {
  currentRound: number;
  nextRound: number;
  expressLaneController: string;
  hasController: boolean;
  reservePrice: string;
  isAuctionOpen: boolean;
  msUntilNextRound: number;
  msUntilAuctionCloses: number;
  expressLaneAdvantageMs: number;
}

export interface BoostDecision {
  shouldBoost: boolean;
  reason: string;
  estimatedWinningBid: string;
  confidencePercent: number;
  urgencyMs: number;
}

export interface BidSubmissionResult {
  success: boolean;
  bidAmount: string;
  round: number;
  controller: string;
  txHash: string;
}

export interface ExpressLaneTxResult {
  accepted: boolean;
  round: number;
  sequenceNumber: number;
  note: string;
}
