#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CLI_NAME, CLI_VERSION, CLI_DESCRIPTION, NETWORKS, WIZARD_DIR, AGENTS_DIR, SKILLS_DIR, MEMORY_DIR, SESSIONS_DIR, PLANS_DIR } from './config/constants.js'
import { setConfig, getConfig, resetConfig, type WizardConfig } from './config/settings.js'
import { startRepl } from './core/repl.js'
import { SessionManager } from './core/session-manager.js'

// ─── Template Scaffolding ──────────────────────────────────────────

/**
 * Resolve the templates/ directory path relative to the CLI source.
 */
function getTemplatesDir(): string {
  // In development: src/cli.ts -> templates/
  // In dist: dist/cli.js -> templates/
  const thisFile = fileURLToPath(import.meta.url)
  const thisDir = path.dirname(thisFile)

  // Try sibling of src/ or dist/
  const candidates = [
    path.join(thisDir, '..', 'templates'),      // from src/cli.ts or dist/cli.js
    path.join(thisDir, '..', '..', 'templates'), // if nested deeper
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  // Fallback: relative to cwd (for development)
  const cwdCandidate = path.join(process.cwd(), 'templates')
  if (existsSync(cwdCandidate)) {
    return cwdCandidate
  }

  throw new Error('Could not find templates/ directory. Make sure wizard-cli is installed correctly.')
}

/**
 * Recursively copy a directory, creating target directories as needed.
 */
function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(src)) return
  mkdirSync(dest, { recursive: true })

  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Scaffold the .wizard/ project infrastructure.
 */
function scaffoldWizardSetup(projectDir: string): void {
  const wizardDir = path.join(projectDir, WIZARD_DIR)
  const templatesDir = getTemplatesDir()

  console.log(chalk.green('\n  Initializing Wizard CLI project...\n'))

  // Create .wizard/ directory structure
  const subdirs = [AGENTS_DIR, SKILLS_DIR, MEMORY_DIR, SESSIONS_DIR, PLANS_DIR]
  for (const subdir of subdirs) {
    const dir = path.join(wizardDir, subdir)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      console.log(chalk.dim(`  Created ${WIZARD_DIR}/${subdir}/`))
    }
  }

  // Copy agent templates
  const agentsSrc = path.join(templatesDir, 'agents')
  const agentsDest = path.join(wizardDir, AGENTS_DIR)
  if (existsSync(agentsSrc)) {
    const agentFiles = readdirSync(agentsSrc).filter(f => f.endsWith('.md'))
    for (const file of agentFiles) {
      const destPath = path.join(agentsDest, file)
      if (!existsSync(destPath)) {
        copyFileSync(path.join(agentsSrc, file), destPath)
        console.log(chalk.dim(`  Created ${WIZARD_DIR}/${AGENTS_DIR}/${file}`))
      } else {
        console.log(chalk.dim(`  Exists  ${WIZARD_DIR}/${AGENTS_DIR}/${file}`))
      }
    }
  }

  // Copy skill templates
  const skillsSrc = path.join(templatesDir, 'skills')
  const skillsDest = path.join(wizardDir, SKILLS_DIR)
  if (existsSync(skillsSrc)) {
    const skillDirs = readdirSync(skillsSrc, { withFileTypes: true }).filter(d => d.isDirectory())
    for (const dir of skillDirs) {
      const srcDir = path.join(skillsSrc, dir.name)
      const destDir = path.join(skillsDest, dir.name)
      if (!existsSync(destDir)) {
        copyDirRecursive(srcDir, destDir)
        console.log(chalk.dim(`  Created ${WIZARD_DIR}/${SKILLS_DIR}/${dir.name}/`))
      } else {
        console.log(chalk.dim(`  Exists  ${WIZARD_DIR}/${SKILLS_DIR}/${dir.name}/`))
      }
    }
  }

  // Copy settings.json
  const settingsSrc = path.join(templatesDir, 'settings.json')
  const settingsDest = path.join(wizardDir, 'settings.json')
  if (existsSync(settingsSrc) && !existsSync(settingsDest)) {
    copyFileSync(settingsSrc, settingsDest)
    console.log(chalk.dim(`  Created ${WIZARD_DIR}/settings.json`))
  } else if (existsSync(settingsDest)) {
    console.log(chalk.dim(`  Exists  ${WIZARD_DIR}/settings.json`))
  }

  // Create WIZARD.md at project root
  const wizardMdSrc = path.join(templatesDir, 'WIZARD.md')
  const wizardMdDest = path.join(projectDir, 'WIZARD.md')
  if (existsSync(wizardMdSrc) && !existsSync(wizardMdDest)) {
    copyFileSync(wizardMdSrc, wizardMdDest)
    console.log(chalk.dim(`  Created WIZARD.md`))
  } else if (existsSync(wizardMdDest)) {
    console.log(chalk.dim(`  Exists  WIZARD.md`))
  }

  // Create empty MEMORY.md
  const memoryMd = path.join(wizardDir, MEMORY_DIR, 'MEMORY.md')
  if (!existsSync(memoryMd)) {
    writeFileSync(memoryMd, '# Project Memory\n\nPersistent facts saved across sessions.\n', 'utf-8')
    console.log(chalk.dim(`  Created ${WIZARD_DIR}/${MEMORY_DIR}/MEMORY.md`))
  }

  console.log()
  console.log(chalk.green('  Wizard CLI project initialized!'))
  console.log()
  console.log(chalk.dim('  Structure:'))
  console.log(chalk.dim(`    WIZARD.md              Project instructions`))
  console.log(chalk.dim(`    ${WIZARD_DIR}/agents/          Agent definitions (5 specialists)`))
  console.log(chalk.dim(`    ${WIZARD_DIR}/skills/          Skill templates (6 commands)`))
  console.log(chalk.dim(`    ${WIZARD_DIR}/memory/          Persistent memory`))
  console.log(chalk.dim(`    ${WIZARD_DIR}/sessions/        Conversation transcripts`))
  console.log(chalk.dim(`    ${WIZARD_DIR}/settings.json    Permissions & config`))
  console.log()
  console.log(chalk.dim('  Run ') + chalk.white('wizard') + chalk.dim(' to start a session.'))
  console.log()
}

// ─── CLI Program ────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WIZARD_ROOT = resolve(__dirname, '..')

// ─── Shared init logic ──────────────────────────────────────────
function scaffoldAgentSetup(cwd: string, options: { force?: boolean; silent?: boolean } = {}): number {
  const templatesDir = join(WIZARD_ROOT, 'templates')

  if (!existsSync(templatesDir)) {
    if (!options.silent) console.log(chalk.red('\n  Templates not found. Reinstall wizard-cli.\n'))
    return -1
  }

  const files = [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    { src: 'agents/program-engineer.md', dest: '.claude/agents/program-engineer.md' },
    { src: 'agents/defi-builder.md', dest: '.claude/agents/defi-builder.md' },
    { src: 'agents/frontend-dev.md', dest: '.claude/agents/frontend-dev.md' },
    { src: 'skills/build/SKILL.md', dest: '.claude/skills/build/SKILL.md' },
    { src: 'skills/deploy/SKILL.md', dest: '.claude/skills/deploy/SKILL.md' },
    { src: 'skills/check-network/SKILL.md', dest: '.claude/skills/check-network/SKILL.md' },
    { src: 'skills/audit/SKILL.md', dest: '.claude/skills/audit/SKILL.md' },
    { src: 'skills/new-program/SKILL.md', dest: '.claude/skills/new-program/SKILL.md' },
    { src: 'settings.local.json', dest: '.claude/settings.local.json' },
  ]

  let created = 0
  let skipped = 0

  for (const { src, dest } of files) {
    const destPath = join(cwd, dest)
    const destDir = dirname(destPath)

    if (existsSync(destPath) && !options.force) {
      if (!options.silent) console.log(chalk.dim(`  skip  ${dest}`) + chalk.dim(' (exists, use --force to overwrite)'))
      skipped++
      continue
    }

    mkdirSync(destDir, { recursive: true })
    cpSync(join(templatesDir, src), destPath)
    if (!options.silent) console.log(chalk.green(`  create  ${dest}`))
    created++
  }

  return created
}

const program = new Command()

program
  .name(CLI_NAME)
  .version(CLI_VERSION)
  .description(CLI_DESCRIPTION)

// Main command — start the REPL
program
  .argument('[prompt...]', 'Initial prompt to send (optional)')
  .option('-y, --yolo', 'Enable YOLO mode (auto-execute all tools)')
  .option('-m, --model <model>', 'Model to use (sonnet, opus, haiku)')
  .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, mythic-l2, etc.)')
  .option('-k, --keypair <path>', 'Path to Solana keypair JSON')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--resume <id>', 'Resume a previous session by ID')
  .action(async (promptParts: string[], options) => {
    // Apply CLI options
    if (options.yolo) setConfig('yolo', true)
    if (options.model) {
      const modelMap: Record<string, string> = {
        sonnet: 'claude-sonnet-4-20250514',
        opus: 'claude-opus-4-20250514',
        haiku: 'claude-haiku-4-5-20251001',
      }
      setConfig('model', modelMap[options.model] || options.model)
    }
    if (options.network) setConfig('network', options.network)
    if (options.keypair) setConfig('keypairPath', options.keypair)
    if (options.rpc) setConfig('customRpc', options.rpc)

    // Auto-init: check if .wizard/ and WIZARD.md exist
    const cwd = process.cwd()
    const hasWizardDir = existsSync(path.join(cwd, WIZARD_DIR))
    const hasWizardMd = existsSync(path.join(cwd, 'WIZARD.md'))

    if (!hasWizardDir && !hasWizardMd) {
      // Check if templates dir exists before auto-prompting
      try {
        getTemplatesDir()
        console.log(chalk.dim('\n  No WIZARD.md or .wizard/ found. Run ') + chalk.white('wizard init') + chalk.dim(' to set up this project.\n'))
      } catch {
        // Templates not available — skip the suggestion
      }
    }

    const initialPrompt = promptParts.length > 0 ? promptParts.join(' ') : undefined

    // Handle --resume option
    if (options.resume) {
      const session = SessionManager.loadSession(cwd, options.resume)
      if (session) {
        console.log(chalk.green(`\n  Resuming session ${chalk.dim(options.resume.slice(0, 8))}... (${session.messages.length} messages)\n`))
        await startRepl(initialPrompt, session)
      } else {
        console.log(chalk.red(`\n  Session not found: ${options.resume}`))
        console.log(chalk.dim('  Use ') + chalk.white('wizard sessions') + chalk.dim(' to list available sessions.\n'))
      }
      return
    }

    await startRepl(initialPrompt)
  })

// Init subcommand — scaffold .wizard/ project infrastructure
program
  .command('init')
  .description('Initialize Wizard CLI project (creates .wizard/ and WIZARD.md)')
  .action(() => {
    scaffoldWizardSetup(process.cwd())
  })

// Sessions subcommand — list past sessions
program
  .command('sessions')
  .description('List past conversation sessions')
  .action(() => {
    const sessions = SessionManager.listSessions(process.cwd())

    if (sessions.length === 0) {
      console.log(chalk.dim('\n  No sessions found. Start a session with ') + chalk.white('wizard') + chalk.dim('.\n'))
      return
    }

    console.log(chalk.green(`\n  Past Sessions (${sessions.length})\n`))
    console.log(chalk.dim('  ─'.repeat(40)))

    for (const s of sessions.slice(0, 20)) {
      const date = new Date(s.startTime).toLocaleString()
      const shortId = s.id.slice(0, 8)
      const preview = s.firstMessage ? s.firstMessage.slice(0, 60) : chalk.dim('(empty)')
      console.log(`  ${chalk.white(shortId)} ${chalk.dim(date)} ${chalk.dim(`(${s.turns} turns)`)}`)
      console.log(`  ${chalk.dim('  ')}${preview}`)
      console.log()
    }

    console.log(chalk.dim('  Resume a session: ') + chalk.white('wizard --resume <id>'))
    console.log()
  })

// Config subcommand
const configCmd = program
  .command('config')
  .description('Manage Wizard CLI configuration')

configCmd
  .command('set <key> <value>')
  .description('Set a config value')
  .action((key: string, value: string) => {
    const keyMap: Record<string, keyof WizardConfig> = {
      apiKey: 'anthropicApiKey',
      model: 'model',
      network: 'network',
      rpc: 'customRpc',
      keypair: 'keypairPath',
      yolo: 'yolo',
    }
    const configKey = keyMap[key] || key
    const parsedValue = value === 'true' ? true : value === 'false' ? false : value
    setConfig(configKey as keyof WizardConfig, parsedValue)
    console.log(chalk.green(`Set ${configKey} = ${parsedValue}`))
  })

configCmd
  .command('get [key]')
  .description('Get config value(s)')
  .action((key?: string) => {
    const cfg = getConfig()
    if (key) {
      console.log((cfg as any)[key] ?? chalk.dim('not set'))
    } else {
      // Show all (mask API key)
      const display = { ...cfg }
      if (display.anthropicApiKey) {
        display.anthropicApiKey = display.anthropicApiKey.slice(0, 10) + '...'
      }
      console.log(JSON.stringify(display, null, 2))
    }
  })

configCmd
  .command('reset')
  .description('Reset all configuration to defaults')
  .action(() => {
    resetConfig()
    console.log(chalk.yellow('Config reset to defaults.'))
  })

// Network subcommand
program
  .command('networks')
  .description('List available networks')
  .action(() => {
    console.log(chalk.green('\nAvailable Networks:\n'))
    for (const [name, url] of Object.entries(NETWORKS)) {
      console.log(`  ${chalk.bold(name.padEnd(20))} ${chalk.dim(url)}`)
    }
    console.log()
  })

// Quick commands
program
  .command('status')
  .description('Quick Mythic L2 network status check')
  .action(async () => {
    const { Connection } = await import('@solana/web3.js')
    const conn = new Connection(NETWORKS['mythic-l2'], 'confirmed')
    try {
      const [slot, version] = await Promise.all([conn.getSlot(), conn.getVersion()])
      console.log(chalk.green(`\nMythic L2 Status:`))
      console.log(`  Slot:    ${slot.toLocaleString()}`)
      console.log(`  Version: ${version['solana-core']}`)
      console.log(`  RPC:     ${NETWORKS['mythic-l2']}`)

      // Supply
      try {
        const res = await fetch('https://mythic.sh/api/supply/stats')
        if (res.ok) {
          const data = await res.json() as any
          console.log(`  Supply:  ${data.circulatingSupply || 'N/A'}`)
          console.log(`  Burned:  ${data.totalBurned || 'N/A'}`)
        }
      } catch { }
      console.log()
    } catch (err: any) {
      console.log(chalk.red(`\nFailed to connect: ${err.message}\n`))
    }
  })

program
  .command('balance <address>')
  .option('-n, --network <network>', 'Network (default: mythic-l2)')
  .description('Check SOL/MYTH balance of an address')
  .action(async (address: string, options) => {
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
    const network = options.network || 'mythic-l2'
    const url = (NETWORKS as any)[network] || network
    const conn = new Connection(url, 'confirmed')
    try {
      const balance = await conn.getBalance(new PublicKey(address))
      const unit = network.includes('mythic') ? 'MYTH' : 'SOL'
      console.log(`${(balance / LAMPORTS_PER_SOL).toFixed(9)} ${unit}`)
    } catch (err: any) {
      console.log(chalk.red(err.message))
    }
  })

program
  .command('deploy-validator')
  .option('-t, --tier <tier>', 'Validator tier: mini, validator, ai')
  .description('Print validator deployment command')
  .action((options) => {
    const tier = options.tier || ''
    const env = tier ? `MYTHIC_TIER=${tier} ` : ''
    console.log(chalk.green('\nMythic L2 Validator Deployment\n'))
    console.log(chalk.dim('Run this on your Linux server:'))
    console.log()
    console.log(chalk.bold(`  ${env}curl -sSfL https://mythic.sh/install | sudo bash`))
    console.log()
    console.log(chalk.dim('Hardware requirements:'))
    console.log('  Mini:      8+ cores, 32GB RAM, 500GB SSD')
    console.log('  Validator: 32+ cores, 128GB RAM, 2TB NVMe')
    console.log('  AI:        48+ cores, 256GB RAM, 10TB NVMe, NVIDIA GPU')
    console.log()
    console.log(chalk.dim('After install:'))
    console.log('  sudo systemctl start mythic-validator')
    console.log('  sudo systemctl status mythic-validator')
    console.log()
    console.log(chalk.dim('Dashboard: https://mythic.sh/validators'))
    console.log()
  })

// ─── wizard init ─────────────────────────────────────────────────
program
  .command('init')
  .description('Scaffold Claude Code agent setup for Mythic L2 development in the current directory')
  .option('-f, --force', 'Overwrite existing files')
  .action((options) => {
    const cwd = process.cwd()

    console.log(chalk.hex('#39FF14').bold('\n  Mythic L2 — Claude Code Agent Setup\n'))

    const created = scaffoldAgentSetup(cwd, { force: options.force })

    if (created === -1) process.exit(1)

    console.log()
    if (created > 0) {
      console.log(chalk.green(`  ${created} files created`))
    } else {
      console.log(chalk.dim(`  All files already exist. Use --force to overwrite.`))
    }

    console.log()
    console.log(chalk.bold.white('  What was generated:'))
    console.log(chalk.dim('  ─'.repeat(30)))
    console.log(`  ${chalk.white('CLAUDE.md')}                             ${chalk.dim('Project instructions for Claude Code')}`)
    console.log(`  ${chalk.white('.claude/agents/')}                       ${chalk.dim('3 specialist agents (program, defi, frontend)')}`)
    console.log(`  ${chalk.white('.claude/skills/')}                       ${chalk.dim('5 slash commands (/build, /deploy, /audit, ...)')}`)
    console.log(`  ${chalk.white('.claude/settings.local.json')}           ${chalk.dim('Permissions for Solana dev tools')}`)
    console.log()
    console.log(chalk.bold.white('  Next steps:'))
    console.log(chalk.dim('  ─'.repeat(30)))
    console.log(`  1. Install Claude Code: ${chalk.green('npm i -g @anthropic-ai/claude-code')}`)
    console.log(`  2. Authenticate:        ${chalk.green('claude auth login')}`)
    console.log(`  3. Start coding:        ${chalk.green('claude')}`)
    console.log()
    console.log(chalk.dim('  Claude Code will auto-detect CLAUDE.md, agents, and skills.'))
    console.log(chalk.dim('  Try: /build, /deploy, /audit, /check-network, /new-program'))
    console.log()
  })

// ─── wizard login ────────────────────────────────────────────────
program
  .command('login')
  .description('Authenticate with Claude (Max subscription or API key)')
  .action(async () => {
    console.log(chalk.hex('#39FF14').bold('\n  Wizard CLI — Authentication\n'))

    // Check if claude CLI is installed
    let claudeInstalled = false
    try {
      execSync('which claude', { stdio: 'pipe' })
      claudeInstalled = true
    } catch { }

    if (claudeInstalled) {
      console.log(chalk.white('  Option 1: Claude Max (recommended)'))
      console.log(chalk.dim('  ─'.repeat(30)))
      console.log(`  Run: ${chalk.green('claude auth login')}`)
      console.log(chalk.dim('  This opens your browser to authenticate with your Claude Max subscription.'))
      console.log(chalk.dim('  After login, both Claude Code and Wizard CLI use the same auth.'))
      console.log()
    }

    console.log(chalk.white('  Option 2: API Key'))
    console.log(chalk.dim('  ─'.repeat(30)))
    console.log(`  ${chalk.green('export ANTHROPIC_API_KEY=sk-ant-...')}`)
    console.log(chalk.dim('  Or set persistently:'))
    console.log(`  ${chalk.green('wizard config set apiKey sk-ant-...')}`)
    console.log(chalk.dim('  Get a key at: https://console.anthropic.com'))
    console.log()

    // Check current auth status
    const cfg = getConfig()
    const hasUserKey = !!(process.env.ANTHROPIC_API_KEY || cfg.anthropicApiKey)

    if (hasUserKey) {
      console.log(chalk.green('  Status: Authenticated with API key'))
    } else {
      // Check for Claude Code OAuth token
      const claudeAuthPath = join(homedir(), '.claude', '.credentials')
      if (existsSync(claudeAuthPath)) {
        console.log(chalk.green('  Status: Claude Code OAuth token found'))
        console.log(chalk.dim('  Wizard REPL uses Anthropic API key; Claude Code uses OAuth.'))
      } else {
        console.log(chalk.yellow('  Status: Using free tier (25 messages/day)'))
      }
    }
    console.log()
  })

// ─── wizard update ───────────────────────────────────────────────
program
  .command('update')
  .description('Update Wizard CLI to the latest version')
  .action(() => {
    console.log(chalk.hex('#39FF14').bold('\n  Updating Wizard CLI...\n'))

    try {
      const wizardDir = join(homedir(), '.wizard-cli')
      if (!existsSync(join(wizardDir, '.git'))) {
        console.log(chalk.red('  Not a git installation. Reinstall with:'))
        console.log(chalk.green('  curl -sSfL https://mythic.sh/wizard | bash\n'))
        process.exit(1)
      }

      console.log(chalk.dim('  Pulling latest...'))
      execSync('git pull origin main', { cwd: wizardDir, stdio: 'pipe' })

      console.log(chalk.dim('  Installing dependencies...'))
      execSync('npm install --production=false', { cwd: wizardDir, stdio: 'pipe' })

      console.log(chalk.dim('  Building...'))
      execSync('npm run build', { cwd: wizardDir, stdio: 'pipe' })

      // Read new version
      const pkg = JSON.parse(readFileSync(join(wizardDir, 'package.json'), 'utf-8'))
      console.log(chalk.green(`\n  Updated to v${pkg.version}`))
      console.log(chalk.dim('  Restart wizard to use the new version.\n'))
    } catch (err: any) {
      console.log(chalk.red(`  Update failed: ${err.message}\n`))
      process.exit(1)
    }
  })

// ─── wizard uninstall ────────────────────────────────────────────
program
  .command('uninstall')
  .description('Remove Wizard CLI from your system')
  .action(async () => {
    const readline = await import('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    rl.question(chalk.yellow('\n  Remove Wizard CLI? This deletes ~/.wizard-cli [y/N] '), (answer) => {
      rl.close()
      if (answer.toLowerCase() !== 'y') {
        console.log(chalk.dim('  Cancelled.\n'))
        process.exit(0)
      }

      try {
        const binDir = join(homedir(), '.local', 'bin')
        const links = ['wizard', 'mythic-wizard']
        for (const link of links) {
          const linkPath = join(binDir, link)
          if (existsSync(linkPath)) {
            execSync(`rm -f "${linkPath}"`)
            console.log(chalk.dim(`  Removed ${linkPath}`))
          }
        }

        const wizardDir = join(homedir(), '.wizard-cli')
        if (existsSync(wizardDir)) {
          execSync(`rm -rf "${wizardDir}"`)
          console.log(chalk.dim(`  Removed ${wizardDir}`))
        }

        console.log(chalk.green('\n  Wizard CLI uninstalled.\n'))
      } catch (err: any) {
        console.log(chalk.red(`  Uninstall failed: ${err.message}\n`))
      }
    })
  })

program.parse()
