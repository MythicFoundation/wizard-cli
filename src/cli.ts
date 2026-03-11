#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { CLI_NAME, CLI_VERSION, CLI_DESCRIPTION, NETWORKS } from './config/constants.js'
import { setConfig, getConfig, resetConfig, type WizardConfig } from './config/settings.js'
import { startRepl } from './core/repl.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WIZARD_ROOT = resolve(__dirname, '..')

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

    // API key always available (free tier fallback)

    const initialPrompt = promptParts.length > 0 ? promptParts.join(' ') : undefined
    await startRepl(initialPrompt)
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
    const templatesDir = join(WIZARD_ROOT, 'templates')

    if (!existsSync(templatesDir)) {
      console.log(chalk.red('\n  Templates not found. Reinstall wizard-cli.\n'))
      process.exit(1)
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

    console.log(chalk.hex('#39FF14').bold('\n  Mythic L2 — Claude Code Agent Setup\n'))

    let created = 0
    let skipped = 0

    for (const { src, dest } of files) {
      const destPath = join(cwd, dest)
      const destDir = dirname(destPath)

      if (existsSync(destPath) && !options.force) {
        console.log(chalk.dim(`  skip  ${dest}`) + chalk.dim(' (exists, use --force to overwrite)'))
        skipped++
        continue
      }

      mkdirSync(destDir, { recursive: true })
      cpSync(join(templatesDir, src), destPath)
      console.log(chalk.green(`  create  ${dest}`))
      created++
    }

    console.log()
    if (created > 0) {
      console.log(chalk.green(`  ${created} files created`) + (skipped > 0 ? chalk.dim(`, ${skipped} skipped`) : ''))
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
