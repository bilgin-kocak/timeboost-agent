# timeboost-skill

A Claude Code skill + MCP server that gives AI agents full intelligence over
Arbitrum's **Timeboost express lane** — the only priority sequencing primitive on any L2.

**ArbiLink Agentic Bounty Submission**

## What this skill enables

After installing, Claude Code can:

- **Analyze** whether a transaction benefits from express lane priority
- **Read** live round state: current controller, reserve price, auction timing
- **Fetch and analyze** historical bid data from Arbitrum's public S3 bucket
- **Generate** production-ready TypeScript code for bidding and express lane submission
- **Verify** whether a submitted transaction was actually timeboosted

## Why Timeboost matters

Timeboost gives the auction winner a **200ms sequencing advantage**. For liquidations
and arbitrage, this is decisive. For regular users and transfers, it is irrelevant.
The skill knows this distinction and applies it to every recommendation.

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

The companion MCP server provides 6 tools for programmatic access:

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
| `analyze_should_boost` | Intelligent boost decision with reasoning |
| `bid_for_express_lane` | Submit sealed EIP-712 bid for next round |
| `send_express_lane_tx` | Submit express lane transaction |
| `check_timeboosted` | Verify tx was timeboosted |

## Example Prompts

```
"What is the current Timeboost round state on Arbitrum One?"
"Should I use the express lane for a 5 ETH liquidation in the next 300ms?"
"Write me code to bid for the next round's express lane on Arbitrum Sepolia"
"What has the median winning bid been in the last 24 hours?"
"Generate a full express lane transaction submission script"
"Was tx 0xabc123 timeboosted?"
```

## Project Structure

```
timeboost-agent/
├── SKILL.md                  # Core skill file (triggers on Timeboost topics)
├── install.sh                # One-command installer
├── references/
│   ├── timeboost-api.md      # RPC, ABI, S3, EIP-712 reference
│   ├── bid-strategy.md       # Decision framework
│   └── code-patterns.md      # Working TypeScript examples
├── docs/
│   ├── step2-agent-registration.md  # Agent registry guide
│   └── step3-deployment.md          # Deployment guide
└── timeboost-mcp/            # MCP server with 6 tools
    ├── src/
    │   ├── index.ts           # Server entry point
    │   ├── constants.ts       # Chain configs
    │   ├── types.ts           # Shared interfaces
    │   └── timeboost/         # Core modules
    └── tests/                 # 71 tests, 100% passing
```

## Running Tests

```bash
cd timeboost-mcp
npm test
```

All 71 tests pass with zero network calls (fully mocked).

## Complementary Skill

This skill is designed to work alongside
[arbitrum-dapp-skill](https://github.com/hummusonrails/arbitrum-dapp-skill)
which covers general Stylus and Solidity dApp scaffolding.
Install both for complete Arbitrum development coverage.

## Specification Sources

- [Timeboost gentle introduction](https://docs.arbitrum.io/how-arbitrum-works/timeboost/gentle-introduction)
- [How to use Timeboost](https://docs.arbitrum.io/how-arbitrum-works/timeboost/how-to-use-timeboost)
- [OffchainLabs research spec](https://github.com/OffchainLabs/timeboost-design/blob/main/research_spec.md)
- [Empirical analysis of Timeboost](https://arxiv.org/abs/2509.22143) (Messias & Torres, 2025)
