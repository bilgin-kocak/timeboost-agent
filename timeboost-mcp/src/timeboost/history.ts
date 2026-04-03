import { CHAINS } from "../constants.js";
import type { BidRecord } from "../types.js";

export async function getRecentBidHistory(
  chain: "arbitrum",
  daysBack: number = 1,
  skipDecompress: boolean = false,
): Promise<BidRecord[]> {
  const config = CHAINS[chain];
  if (!config.s3HttpBase) throw new Error("No S3 history for this chain");

  const allBids: BidRecord[] = [];

  try {
    for (let d = 0; d < daysBack; d++) {
      const date = new Date(Date.now() - d * 86_400_000);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");

      const listUrl = `${config.s3HttpBase}/${yyyy}/${mm}/${dd}/`;
      const listRes = await fetch(listUrl);
      if (!listRes.ok) continue;

      const xml = await listRes.text();
      const keys = [...xml.matchAll(/<Key>([^<]+\.csv\.gzip)<\/Key>/g)].map(
        (m) => m[1],
      );

      for (const key of keys.slice(-3)) {
        const fileUrl = `https://timeboost-auctioneer-arb1.s3.us-east-2.amazonaws.com/${key}`;
        const res = await fetch(fileUrl);
        if (!res.ok) continue;

        const buffer = await res.arrayBuffer();
        let csv: string;

        if (skipDecompress) {
          // In test mode, buffer is already plain CSV
          csv = Buffer.from(buffer).toString("utf8");
        } else {
          // Decompress gzip
          const zlib = await import("zlib");
          const { promisify } = await import("util");
          const gunzip = promisify(zlib.gunzip);
          const decompressed = await gunzip(Buffer.from(buffer));
          csv = decompressed.toString("utf8");
        }

        const rows = csv.trim().split("\n").slice(1); // skip header
        for (const row of rows) {
          if (!row.trim()) continue;
          const [round, bidder, amount, expressLaneController, timestamp] =
            row.split(",");
          allBids.push({
            round: Number(round),
            bidder: bidder?.trim(),
            amount: amount?.trim(),
            expressLaneController: expressLaneController?.trim(),
            timestamp: timestamp?.trim(),
          });
        }
      }
    }
  } catch {
    return [];
  }

  return allBids;
}

export function analyzeBidHistory(bids: BidRecord[]) {
  if (bids.length === 0) return null;

  const amounts = bids.map((b) => BigInt(b.amount));
  const sorted = [...amounts].sort((a, b) => (a > b ? -1 : 1));

  return {
    totalBids: bids.length,
    uniqueBidders: new Set(bids.map((b) => b.bidder)).size,
    maxBid: sorted[0].toString(),
    medianBid: sorted[Math.floor(sorted.length / 2)].toString(),
    minBid: sorted[sorted.length - 1].toString(),
    dominantController: getMostFrequent(
      bids.map((b) => b.expressLaneController),
    ),
    recentRounds: [...new Set(bids.map((b) => b.round))].slice(-5),
  };
}

function getMostFrequent(arr: string[]): string {
  const counts = arr.reduce(
    (acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }),
    {} as Record<string, number>,
  );
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
