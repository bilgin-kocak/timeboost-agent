import { analyzeBidHistory } from "./history.js";
import type { BidRecord, BoostDecision } from "../types.js";

export function shouldUseExpressLane(params: {
  txValueWei: bigint;
  txType: "swap" | "liquidation" | "arbitrage" | "transfer" | "other";
  urgencyMs: number;
  bidHistory: BidRecord[] | null;
  reservePrice: bigint;
  myMaxBudgetWei: bigint;
}): BoostDecision {
  const { txValueWei, txType, urgencyMs, bidHistory, reservePrice, myMaxBudgetWei } = params;

  // Estimate winning bid from history or fall back to reserve price
  let estimatedWinningBid = reservePrice;
  if (bidHistory && bidHistory.length > 0) {
    const analysis = analyzeBidHistory(bidHistory);
    if (analysis) {
      estimatedWinningBid = BigInt(analysis.medianBid) * 110n / 100n; // +10% buffer
    }
  }

  // Budget check
  if (estimatedWinningBid > myMaxBudgetWei) {
    return {
      shouldBoost: false,
      reason: `Estimated winning bid (${estimatedWinningBid} wei) exceeds your budget (${myMaxBudgetWei} wei)`,
      estimatedWinningBid: estimatedWinningBid.toString(),
      confidencePercent: bidHistory ? 90 : 40,
      urgencyMs,
    };
  }

  // Score the transaction
  const urgencyScore = getUrgencyScore(txType, urgencyMs);
  const valueScore = txValueWei > 0n && estimatedWinningBid > 0n
    ? Number(txValueWei / estimatedWinningBid)
    : 0;

  const shouldBoost = urgencyScore >= 7 || (urgencyScore >= 5 && valueScore >= 2);

  return {
    shouldBoost,
    reason: shouldBoost
      ? `High urgency (${urgencyScore}/10) + value ratio (${valueScore.toFixed(1)}x) justifies express lane cost`
      : `Urgency score ${urgencyScore}/10 insufficient — save the bid cost for high-value txs`,
    estimatedWinningBid: estimatedWinningBid.toString(),
    confidencePercent: bidHistory ? 75 : 40,
    urgencyMs,
  };
}

function getUrgencyScore(txType: string, urgencyMs: number): number {
  const typeScore: Record<string, number> = {
    liquidation: 10,
    arbitrage: 9,
    swap: 5,
    transfer: 2,
    other: 4,
  };
  const base = typeScore[txType] ?? 4;

  if (urgencyMs < 500) return Math.min(10, base + 3);
  if (urgencyMs < 2000) return Math.min(10, base + 1);
  if (urgencyMs > 10000) return Math.max(1, base - 2);
  return base;
}
