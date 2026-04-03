#!/usr/bin/env npx tsx
/**
 * Register the Timeboost Express Lane Agent on the Arbitrum Identity Registry (ERC-8004).
 *
 * Usage (from timeboost-mcp/ directory):
 *   PRIVATE_KEY=0x... npx tsx src/register-agent.ts
 *   PRIVATE_KEY=0x... npx tsx src/register-agent.ts --chain arbitrum
 */

import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, arbitrum } from "viem/chains";

// --- Configuration ---

const REGISTRY_ADDRESSES = {
  "arbitrum": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const,
  "arbitrum-sepolia": "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
};

const CHAINS = {
  "arbitrum": arbitrum,
  "arbitrum-sepolia": arbitrumSepolia,
};

// ERC-8004 IdentityRegistry ABI (only the functions we need)
const REGISTRY_ABI = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue) external",
  "function getAgentURI(uint256 agentId) external view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

// Agent card JSON hosted on GitHub
const AGENT_URI = "https://raw.githubusercontent.com/bilgin-kocak/timeboost-agent/main/agent-card.json";

// --- Main ---

async function main() {
  const chainArg = process.argv.includes("--chain")
    ? process.argv[process.argv.indexOf("--chain") + 1]
    : "arbitrum-sepolia";

  const chainKey = chainArg as keyof typeof CHAINS;
  if (!CHAINS[chainKey]) {
    console.error(`Unknown chain: ${chainArg}. Use "arbitrum" or "arbitrum-sepolia".`);
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error("PRIVATE_KEY env var is required.");
    process.exit(1);
  }

  const chain = CHAINS[chainKey];
  const registryAddress = REGISTRY_ADDRESSES[chainKey];
  const account = privateKeyToAccount(privateKey);

  console.log(`Chain:     ${chain.name}`);
  console.log(`Registry:  ${registryAddress}`);
  console.log(`Wallet:    ${account.address}`);
  console.log(`Agent URI: ${AGENT_URI}`);
  console.log();

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:   ${(Number(balance) / 1e18).toFixed(6)} ETH`);
  if (balance === 0n) {
    console.error("\nNo ETH for gas! Get Arbitrum Sepolia ETH from:");
    console.error("  - https://arbitrum.faucet.dev/");
    console.error("  - https://faucet.quicknode.com/arbitrum/sepolia");
    console.error("  - https://www.l2faucet.com/arbitrum");
    process.exit(1);
  }
  console.log();

  // Register the agent (mints an ERC-721 NFT)
  console.log("Registering agent on identity registry...");
  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [AGENT_URI],
  });

  console.log(`Tx submitted: ${txHash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    console.error("Transaction reverted!");
    process.exit(1);
  }

  // Extract agentId from Registered event log
  const registeredLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === registryAddress.toLowerCase()
  );

  let agentId: string = "unknown";
  if (registeredLog && registeredLog.topics[1]) {
    agentId = BigInt(registeredLog.topics[1]).toString();
  }

  const explorerBase = chainKey === "arbitrum"
    ? "https://arbiscan.io"
    : "https://sepolia.arbiscan.io";

  console.log();
  console.log("========================================");
  console.log("  Agent Registered Successfully!");
  console.log("========================================");
  console.log(`Agent ID:  ${agentId}`);
  console.log(`Tx Hash:   ${txHash}`);
  console.log(`Explorer:  ${explorerBase}/tx/${txHash}`);
  console.log(`Registry:  ${explorerBase}/address/${registryAddress}`);
  console.log();
  console.log("Save the Agent ID and Tx Hash for your bounty submission!");
}

main().catch((err) => {
  console.error("Registration failed:", err.message || err);
  process.exit(1);
});
