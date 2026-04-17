import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const claudePath = resolve(repoRoot, "CLAUDE.md");
const agentsPath = resolve(repoRoot, "AGENTS.md");
const checkOnly = process.argv.includes("--check");

const claude = readFileSync(claudePath, "utf8");
let agents = "";

try {
  agents = readFileSync(agentsPath, "utf8");
} catch {
  agents = "";
}

if (claude === agents) {
  console.log("AGENTS.md is already in sync with CLAUDE.md");
  process.exit(0);
}

if (checkOnly) {
  console.error("AGENTS.md is out of sync with CLAUDE.md");
  process.exit(1);
}

writeFileSync(agentsPath, claude, "utf8");
console.log("Synced AGENTS.md from CLAUDE.md");
