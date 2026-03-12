import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { MYTHIC_PROGRAMS, MYTHIC_MINTS, MYTH_L1_MINT, CLI_VERSION, WIZARD_DIR, GLOBAL_WIZARD_DIR, AGENTS_DIR, SKILLS_DIR, MEMORY_DIR } from '../config/constants.js'
import { getConfig } from '../config/settings.js'

// ─── File Finders ───────────────────────────────────────────────────

/**
 * Walk up from cwd to git root (or filesystem root) looking for a file.
 */
function findFileUpward(filename: string, startDir?: string): string | null {
  let dir = startDir || process.cwd()

  // Find git root as upper bound
  let gitRoot: string | null = null
  try {
    gitRoot = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8' }).trim()
  } catch {
    // Not in a git repo — walk to filesystem root
  }

  const upperBound = gitRoot || path.parse(dir).root

  while (true) {
    const candidate = path.join(dir, filename)
    if (existsSync(candidate)) {
      return candidate
    }

    const parent = path.dirname(dir)
    if (parent === dir || dir === upperBound) {
      break
    }
    dir = parent
  }

  // Also check the upper bound itself
  const candidate = path.join(upperBound, filename)
  if (existsSync(candidate)) {
    return candidate
  }

  return null
}

/**
 * Load a JSON settings file, returning null if not found or invalid.
 */
function loadJsonFile(filePath: string): any | null {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    }
  } catch {
    // Invalid JSON — skip
  }
  return null
}

/**
 * Load WIZARD.md project instructions.
 */
function loadWizardMd(): string | null {
  const wizardMdPath = findFileUpward('WIZARD.md')
  if (wizardMdPath) {
    try {
      return readFileSync(wizardMdPath, 'utf-8')
    } catch {
      return null
    }
  }
  return null
}

/**
 * Load project-level .wizard/settings.json.
 */
function loadProjectSettings(): any | null {
  const wizardDir = findFileUpward(path.join(WIZARD_DIR, 'settings.json'))
  if (wizardDir) {
    return loadJsonFile(wizardDir)
  }
  return null
}

/**
 * Load global ~/.wizard/settings.json.
 */
function loadGlobalSettings(): any | null {
  const globalSettingsPath = path.join(GLOBAL_WIZARD_DIR, 'settings.json')
  return loadJsonFile(globalSettingsPath)
}

/**
 * Load agent definitions from .wizard/agents/ directory.
 * Returns a summary string of available agents.
 */
function loadAgentSummary(): string | null {
  // Check project-level agents
  const wizardDirPath = findFileUpward(WIZARD_DIR)
  if (!wizardDirPath) return null

  // wizardDirPath is the path to the WIZARD_DIR name match — we need to resolve it
  let agentsDir: string | null = null

  // Walk upward looking for .wizard/agents/
  let dir = process.cwd()
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8' }).trim()
    dir = gitRoot
  } catch {
    // Not in git repo
  }

  const candidateDirs = [
    path.join(process.cwd(), WIZARD_DIR, AGENTS_DIR),
    path.join(dir, WIZARD_DIR, AGENTS_DIR),
  ]

  for (const candidate of candidateDirs) {
    if (existsSync(candidate)) {
      agentsDir = candidate
      break
    }
  }

  if (!agentsDir) return null

  try {
    const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'))
    if (files.length === 0) return null

    const agents: string[] = []
    for (const file of files) {
      const name = file.replace('.md', '')
      const content = readFileSync(path.join(agentsDir, file), 'utf-8')
      // Extract first line (title) or first sentence
      const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim()
        || content.split('\n').find(l => l.startsWith('# '))?.replace(/^#\s+/, '').trim()
        || name
      agents.push(`- ${name}: ${firstLine}`)
    }

    return agents.join('\n')
  } catch {
    return null
  }
}

/**
 * Load skill definitions from .wizard/skills/ directory.
 * Returns a summary string of available skills.
 */
function loadSkillsSummary(): string | null {
  const candidateDirs = [
    path.join(process.cwd(), WIZARD_DIR, SKILLS_DIR),
  ]

  // Also check git root
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim()
    candidateDirs.push(path.join(gitRoot, WIZARD_DIR, SKILLS_DIR))
  } catch { /* not in git */ }

  let skillsDir: string | null = null
  for (const candidate of candidateDirs) {
    if (existsSync(candidate)) {
      skillsDir = candidate
      break
    }
  }

  if (!skillsDir) return null

  try {
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    if (dirs.length === 0) return null

    const skills: string[] = []
    for (const dir of dirs) {
      const skillMdPath = path.join(skillsDir, dir.name, 'SKILL.md')
      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, 'utf-8')
        // Extract description from frontmatter or first line
        const descMatch = content.match(/^description:\s*(.+)$/m)
        const cmdMatch = content.match(/^command:\s*(.+)$/m)
        const desc = descMatch?.[1]?.trim() || dir.name
        const cmd = cmdMatch?.[1]?.trim() || `/${dir.name}`
        skills.push(`- ${cmd}: ${desc}`)
      }
    }

    return skills.length > 0 ? skills.join('\n') : null
  } catch {
    return null
  }
}

/**
 * Load memory summary from .wizard/memory/MEMORY.md (first 200 lines).
 */
function loadMemorySummary(): string | null {
  const candidatePaths = [
    path.join(process.cwd(), WIZARD_DIR, MEMORY_DIR, 'MEMORY.md'),
  ]

  // Also check git root
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim()
    candidatePaths.push(path.join(gitRoot, WIZARD_DIR, MEMORY_DIR, 'MEMORY.md'))
  } catch { /* not in git */ }

  // Also check global memory
  candidatePaths.push(path.join(GLOBAL_WIZARD_DIR, MEMORY_DIR, 'MEMORY.md'))

  for (const memoryPath of candidatePaths) {
    if (existsSync(memoryPath)) {
      try {
        const content = readFileSync(memoryPath, 'utf-8')
        const lines = content.split('\n')
        const truncated = lines.slice(0, 200).join('\n')
        return truncated
      } catch {
        continue
      }
    }
  }

  return null
}

// ─── Main System Prompt ─────────────────────────────────────────────

export function getSystemPrompt(): string {
  const cfg = getConfig()

  // Load project instructions (WIZARD.md)
  const wizardMd = loadWizardMd()

  // Load settings
  const projectSettings = loadProjectSettings()
  const globalSettings = loadGlobalSettings()

  // Load agent and skill summaries
  const agentSummary = loadAgentSummary()
  const skillsSummary = loadSkillsSummary()

  // Load memory
  const memorySummary = loadMemorySummary()

  // Build the system prompt
  let prompt = `You are Wizard, an AI-powered development agent for Solana and Mythic L2 blockchain development. You are version ${CLI_VERSION}.

You are an expert Solana and Mythic L2 developer. You have deep knowledge of:
- Solana program development (native solana_program and Anchor)
- SPL tokens, Token-2022, Associated Token Accounts
- Solana transaction construction, PDAs, CPIs
- Mythic L2 architecture (Firedancer-based Solana L2)
- DeFi primitives: AMMs, bonding curves, bridges, staking
- Rust, TypeScript, and the Solana ecosystem tooling

# Environment
- Current network: ${cfg.network} (RPC: ${cfg.customRpc || 'default'})
- Keypair: ${cfg.keypairPath || 'not configured'}
- YOLO mode: ${cfg.yolo ? 'ON (auto-execute all tools)' : 'OFF'}

# Mythic L2 Programs
${Object.entries(MYTHIC_PROGRAMS).map(([name, id]) => `- ${name}: ${id}`).join('\n')}

# Mythic L2 Token Mints
${Object.entries(MYTHIC_MINTS).map(([symbol, mint]) => `- ${symbol}: ${mint}`).join('\n')}

# MYTH on Solana L1
- Mint: ${MYTH_L1_MINT} (Token-2022, 6 decimals)

# Key Info
- Mythic L2 is a Firedancer-native Solana L2
- L2 uses native MYTH lamports (9 decimals) instead of SOL
- Bridge: SOL on L1 → MYTH on L2 (market buy via oracle)
- Fee split: 50% validators / 10% foundation / 40% burned
- AI validators get 2x reward multiplier
- Validator install: curl -sSfL https://mythic.sh/install | sudo bash
- Website: mythic.sh | DEX: mythicswap.app | Launchpad: mythic.fun
- Explorer: explorer.mythic.sh | Wallet: wallet.mythic.sh

# Tools Available
You have access to:
- **Filesystem tools**: read_file, write_file, edit_file, glob_files, grep, list_directory
- **Shell tools**: bash (execute any command — git, npm, cargo, solana CLI, anchor, etc.)
- **Solana tools**: balance, account info, transfer, transactions, token accounts, deploy programs, airdrop, keygen, network status
- **Mythic tools**: L2 network status, bridge status, supply info, validators, deploy validator, swap pools, token info, wallet overview

# How to Work
1. Read files before editing them
2. Use the Solana tools for on-chain queries instead of raw curl/RPC calls
3. Use bash for compilation (cargo build-sbf, anchor build), git, npm, etc.
4. When deploying programs, use solana_deploy_program or bash with solana CLI
5. For Mythic L2 specific queries, prefer the mythic_* tools
6. Be concise in responses. Lead with actions, not explanations.
7. When writing Solana programs, use native solana_program (not Anchor) unless the user specifically asks for Anchor

# YOLO Mode
${cfg.yolo ? 'YOLO mode is ON. Execute all tools immediately without asking for confirmation. Move fast.' : 'YOLO mode is OFF. Ask for confirmation before destructive operations (transfers, deploys, file writes).'}

# Important
- Never expose private keys or seed phrases in output
- Always confirm before sending transactions (unless YOLO mode)
- Default to Mythic L2 for blockchain queries unless the user specifies another network
- When writing Rust programs for Solana, pin blake3 = ">=1.3, <1.8" and use getrandom = { version = "0.2", features = ["custom"] }
`

  // ─── Append project instructions (WIZARD.md) ─────────────────
  if (wizardMd) {
    prompt += `\n# Project Instructions (WIZARD.md)\n\n${wizardMd}\n`
  }

  // ─── Append agent definitions ─────────────────────────────────
  if (agentSummary) {
    prompt += `\n# Available Agents\nYou can delegate tasks to specialist agents using /agent <type> <prompt>:\n${agentSummary}\n`
  }

  // ─── Append available skills ──────────────────────────────────
  if (skillsSummary) {
    prompt += `\n# Available Skills\nSlash commands that expand to full prompts:\n${skillsSummary}\n`
  }

  // ─── Append memory ────────────────────────────────────────────
  if (memorySummary) {
    prompt += `\n# Project Memory\nPersistent facts from previous sessions:\n${memorySummary}\n`
  }

  return prompt
}
