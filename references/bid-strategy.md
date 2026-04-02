# Timeboost Bid Strategy

## Should I use the express lane?

Use this scoring framework when asked whether a transaction warrants express lane priority.

### Step 1: Check if auction is open

The auction for round N closes 15 seconds before round N starts.
If the auction is already closed, you cannot bid for this round —
evaluate whether to bid for round N+1 instead.

### Step 2: Estimate the winning bid

Pull recent bid history from S3 and calculate:
- **Safe bid** = median of last 24h winning bids x 1.15 (15% buffer)
- **Aggressive bid** = max of last 24h x 0.95 (just under the top)

If no history is available, use `reservePrice x 1.5` as a conservative estimate.

Note: Empirical research (Messias & Torres, Sept 2025) shows express lane control
is highly concentrated — ~2 entities win >90% of auctions on mainnet. Winning
without deep MEV strategy is difficult on mainnet. On Sepolia, competition is low.

### Step 3: Score the transaction

| tx_type | urgency_base | notes |
|---------|-------------|-------|
| liquidation | 10/10 | milliseconds matter, missing it is expensive |
| arbitrage | 9/10 | price windows close fast |
| swap | 5/10 | 200ms usually does not change outcome |
| transfer | 2/10 | never time-sensitive |
| other | 4/10 | evaluate case by case |

**Urgency modifier:**
- If user says "in the next 300ms" or similar: +3 to score
- If user says "whenever" or "no rush": -2 to score

### Step 4: Value check

```
value_ratio = tx_value_eth / estimated_winning_bid_eth
```

**Recommend express lane if:**
- urgency_score >= 8 (regardless of value), OR
- urgency_score >= 5 AND value_ratio >= 3

**Do NOT recommend if:**
- estimated_winning_bid > user's stated budget
- urgency_score < 4 AND value_ratio < 2
- tx is a simple token transfer or approval

### Step 5: Format the recommendation

Always include:
1. Yes/No recommendation
2. The estimated winning bid in ETH and wei
3. The urgency score and why
4. The value ratio
5. Whether the auction is still open for the current round
6. What round to target

---

## Alternative: reselling express lane rights

The express lane controller can sign express lane submissions for other parties
(the controller signs the metadata, the transaction itself can be from any address).
This means you could win an auction and resell per-transaction access.

Secondary markets for this have mostly collapsed on mainnet due to reliability
issues — but it is a valid pattern to document when asked.

---

## Testnet strategy

On Arbitrum Sepolia:
- Competition is near zero — often no bids at all
- Reserve price is very low (often 0 or minimal wei)
- Ideal for demonstrating the full flow without cost
- S3 bid history may not be available — use contract reads only
