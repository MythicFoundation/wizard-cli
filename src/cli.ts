#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { CLI_NAME, CLI_VERSION, CLI_DESCRIPTION, NETWORKS } from './config/constants.js'
import { setConfig, getConfig, resetConfig, type WizardConfig } from './config/settings.js'
import { startRepl } from './core/repl.js'

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

    // Check API key
    const cfg = getConfig()
    if (!cfg.anthropicApiKey) {
      console.log(chalk.red('\nNo API key found.'))
      console.log(chalk.dim('Set it with:'))
      console.log(chalk.green('  export ANTHROPIC_API_KEY=sk-ant-...'))
      console.log(chalk.dim('  or'))
      console.log(chalk.green(`  ${CLI_NAME} config set apiKey sk-ant-...`))
      console.log()
      process.exit(1)
    }

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

program.parse()
