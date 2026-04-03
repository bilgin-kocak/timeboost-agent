# Timeboost Express Lane Agent

**ArbiLink Agentic Bounty Submission**

An AI agent that knows when Arbitrum's Timeboost express lane is worth using — and when it isn't. Instead of blindly bidding for priority, it observes live auction state, analyzes historical bid data from Arbitrum's public S3 dataset, and decides whether the 200ms sequencing advantage economically justifies the cost. When it does, it bids, executes, and verifies the outcome.

**Full agent loop:** observe → price → decide → bid → submit → verify

## Why Timeboost

Timeboost gives the auction winner a **200ms sequencing advantage** via a per-round sealed-bid second-price auction. For liquidations and arbitrage, milliseconds are decisive. For regular transfers, the express lane is irrelevant. This agent knows the difference — it scores transactions by type, urgency, and historical bid data, and only recommends boosting when economically justified.

## What This Enables

After installing, an AI agent can:

- **Observe** live round state: current controller, reserve price, auction timing
- **Analyze** historical bid data from Arbitrum's public S3 bucket
- **Decide** whether a transaction is worth boosting (cost vs. value reasoning)
- **Bid** for express lane control via EIP-712 sealed-bid auction
- **Execute** priority transactions through the express lane
- **Verify** whether a submitted transaction was actually timeboosted

## Install the Skill

```bash
# One-liner
bash <(curl -s https://raw.githubusercontent.com/bilgin-kocak/timeboost-agent/main/install.sh)

# Or manual
git clone https://github.com/bilgin-kocak/timeboost-agent ~/.claude/skills/timeboost-skill
```

Restart Claude Code. The skill loads automatically when you ask anything
related to Timeboost, express lanes, or priority sequencing on Arbitrum.

## MCP Server Setup

The MCP server provides 6 tools for programmatic access:

```bash
cd timeboost-mcp
npm install
npm run build
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "timeboost": {
      "command": "npx",
      "args": ["tsx", "/path/to/timeboost-agent/timeboost-mcp/src/index.ts"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "CHAIN": "arbitrum-sepolia"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `get_timeboost_round_state` | Current round, controller, reserve price, auction timing |
| `get_bid_history` | Fetch and analyze S3 bid data (Arbitrum One) |
| `analyze_should_boost` | Decide whether boosting is economically justified |
| `bid_for_express_lane` | Submit sealed EIP-712 bid for next round |
| `send_express_lane_tx` | Submit express lane transaction |
| `check_timeboosted` | Verify tx was timeboosted |

## Live Deployment

The agent is deployed on Railway:

- **Health:** https://timeboost-agent-production.up.railway.app/health
- **MCP endpoint:** `POST https://timeboost-agent-production.up.railway.app/mcp`

## Agent Registration

Registered on Arbitrum Sepolia identity registry via ERC-8004:

- **Registry:** [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.arbiscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e)
- **Tx:** [`0x0d2f2839ac129dd2e9cedf187b7830c2782b262b418af68ee8e5212ef4c94f8b`](https://sepolia.arbiscan.io/tx/0x0d2f2839ac129dd2e9cedf187b7830c2782b262b418af68ee8e5212ef4c94f8b)

## Example Prompts

```
"What is the current Timeboost round state on Arbitrum?"
"Should I use the express lane for a 5 ETH liquidation in the next 300ms?"
"What has the median winning bid been in the last 24 hours?"
"Bid 0.003 ETH for the next round's express lane"
"Was tx 0xabc123 timeboosted?"
```

## Project Structure

```
timeboost-agent/
├── SKILL.md                  # Core skill file (triggers on Timeboost topics)
├── install.sh                # One-command installer
├── agent-card.json           # ERC-8004 agent metadata
├── references/
│   ├── timeboost-api.md      # RPC, ABI, S3, EIP-712 reference
│   ├── bid-strategy.md       # Decision framework
│   └── code-patterns.md      # Working TypeScript examples
├── docs/
│   ├── step2-agent-registration.md
│   └── step3-deployment.md
└── timeboost-mcp/            # MCP server with 6 tools
    ├── src/
    │   ├── index.ts           # Server entry point (stdio)
    │   ├── http-server.ts     # HTTP entry point (Railway)
    │   ├── register-agent.ts  # ERC-8004 registration script
    │   ├── constants.ts       # Chain configs
    │   ├── types.ts           # Shared interfaces
    │   └── timeboost/         # Core modules
    ├── tests/                 # 71 tests, 100% passing
    └── Dockerfile             # Railway deployment
```

## Running Tests

```bash
cd timeboost-mcp
npm test
```

All 71 tests pass with zero network calls (fully mocked).

## Specification Sources

- [Timeboost gentle introduction](https://docs.arbitrum.io/how-arbitrum-works/timeboost/gentle-introduction)
- [How to use Timeboost](https://docs.arbitrum.io/how-arbitrum-works/timeboost/how-to-use-timeboost)
- [OffchainLabs research spec](https://github.com/OffchainLabs/timeboost-design/blob/main/research_spec.md)
- [Empirical analysis of Timeboost](https://arxiv.org/abs/2509.22143) (Messias & Torres, 2025)
