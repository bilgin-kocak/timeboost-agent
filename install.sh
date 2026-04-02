#!/bin/bash
set -e

SKILLS_DIR="${HOME}/.claude/skills"
SKILL_NAME="timeboost-skill"
REPO_URL="https://github.com/bilgin-kocak/timeboost-agent.git"

echo "Installing ${SKILL_NAME}..."

mkdir -p "${SKILLS_DIR}"

if [ -d "${SKILLS_DIR}/${SKILL_NAME}" ]; then
  echo "Updating existing installation..."
  git -C "${SKILLS_DIR}/${SKILL_NAME}" pull
else
  git clone "${REPO_URL}" "${SKILLS_DIR}/${SKILL_NAME}"
fi

echo ""
echo "Done! ${SKILL_NAME} installed to ${SKILLS_DIR}/${SKILL_NAME}"
echo ""
echo "Restart Claude Code and try:"
echo '  "Should I use the express lane for this 5 ETH liquidation in the next 300ms?"'
echo '  "Write me code to bid for the next Timeboost round on Arbitrum Sepolia"'
echo '  "What is the current express lane controller on Arbitrum One?"'
