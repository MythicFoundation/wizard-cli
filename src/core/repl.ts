import readline from 'readline'
import chalk from 'chalk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { streamConversation, type ToolCall } from '../providers/claude.js'
import { getAllTools, executeTool, getToolCategory } from '../tools/registry.js'
import { getSystemPrompt } from './system-prompt.js'
import { getConfig } from '../config/settings.js'
import { CLI_NAME } from '../config/constants.js'

const TOOL_COLORS: Record<string, (s: string) => string> = {
  filesystem: chalk.cyan,
  shell: chalk.yellow,
  solana: chalk.magenta,
  mythic: chalk.green,
  unknown: chalk.gray,
}

function formatToolCall(tc: ToolCall): string {
  const category = getToolCategory(tc.name)
  const colorFn = TOOL_COLORS[category] || chalk.gray
  const badge = colorFn(`[${tc.name}]`)

  // Summarize input
  let summary = ''
  if (tc.name === 'bash') summary = tc.input.command?.slice(0, 80) || ''
  else if (tc.name === 'read_file') summary = tc.input.path || ''
  else if (tc.name === 'write_file') summary = tc.input.path || ''
  else if (tc.name === 'edit_file') summary = tc.input.path || ''
  else if (tc.name === 'glob_files') summary = tc.input.pattern || ''
  else if (tc.name === 'grep') summary = tc.input.pattern || ''
  else if (tc.name === 'solana_balance') summary = tc.input.address?.slice(0, 12) + '...'
  else if (tc.name === 'solana_transfer') summary = `${tc.input.amount} SOL → ${tc.input.to?.slice(0, 12)}...`
  else summary = JSON.stringify(tc.input).slice(0, 60)

  return `${badge} ${chalk.dim(summary)}`
}

export async function startRepl(initialPrompt?: string) {
  const cfg = getConfig()
  const messages: MessageParam[] = []
  const tools = getAllTools()
  const systemPrompt = getSystemPrompt()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green(`${CLI_NAME} `) + chalk.dim('> '),
  })

  // Header
  console.log()
  console.log(chalk.green.bold('  ⚡ Wizard CLI') + chalk.dim(` v${cfg.model.includes('opus') ? 'opus' : cfg.model.includes('haiku') ? 'haiku' : 'sonnet'}`))
  console.log(chalk.dim(`  Network: ${cfg.network} | Tools: ${tools.length} | YOLO: ${cfg.yolo ? chalk.red('ON') : 'OFF'}`))
  console.log(chalk.dim(`  Type your request. /help for commands. Ctrl+C to exit.`))
  console.log()

  async function handleInput(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.slice(1).split(' ')
      switch (cmd) {
        case 'help':
          console.log(chalk.green('\nCommands:'))
          console.log('  /help              Show this help')
          console.log('  /yolo              Toggle YOLO mode (auto-execute)')
          console.log('  /network <name>    Switch network (mainnet-beta, devnet, mythic-l2, etc.)')
          console.log('  /model <name>      Switch model (sonnet, opus, haiku)')
          console.log('  /keypair <path>    Set keypair path')
          console.log('  /status            Show current config')
          console.log('  /clear             Clear conversation history')
          console.log('  /tools             List available tools')
          console.log('  /exit              Exit')
          console.log()
          return

        case 'yolo':
          cfg.yolo = !cfg.yolo
          console.log(chalk.yellow(`\nYOLO mode: ${cfg.yolo ? chalk.red('ON') : 'OFF'}\n`))
          return

        case 'network':
          if (args[0]) {
            (cfg as any).network = args[0]
            console.log(chalk.green(`\nNetwork: ${args[0]}\n`))
          } else {
            console.log(chalk.dim('\nUsage: /network <name>\nAvailable: mainnet-beta, devnet, testnet, localnet, mythic-l2, mythic-testnet\n'))
          }
          return

        case 'model':
          if (args[0]) {
            const modelMap: Record<string, string> = {
              sonnet: 'claude-sonnet-4-20250514',
              opus: 'claude-opus-4-20250514',
              haiku: 'claude-haiku-4-5-20251001',
            }
            cfg.model = modelMap[args[0]] || args[0]
            console.log(chalk.green(`\nModel: ${cfg.model}\n`))
          }
          return

        case 'keypair':
          if (args[0]) {
            cfg.keypairPath = args[0]
            console.log(chalk.green(`\nKeypair: ${args[0]}\n`))
          }
          return

        case 'status':
          console.log(chalk.green('\nCurrent Config:'))
          console.log(`  Model:    ${cfg.model}`)
          console.log(`  Network:  ${cfg.network}`)
          console.log(`  Keypair:  ${cfg.keypairPath || 'not set'}`)
          console.log(`  YOLO:     ${cfg.yolo ? chalk.red('ON') : 'OFF'}`)
          console.log(`  Messages: ${messages.length}`)
          console.log()
          return

        case 'clear':
          messages.length = 0
          console.log(chalk.dim('\nConversation cleared.\n'))
          return

        case 'tools':
          console.log(chalk.green('\nAvailable Tools:'))
          for (const t of tools) {
            const cat = getToolCategory(t.name)
            const colorFn = TOOL_COLORS[cat] || chalk.gray
            console.log(`  ${colorFn(t.name.padEnd(30))} ${chalk.dim(t.description?.slice(0, 60))}`)
          }
          console.log()
          return

        case 'exit':
        case 'quit':
          process.exit(0)

        default:
          console.log(chalk.red(`Unknown command: /${cmd}. Type /help for available commands.\n`))
          return
      }
    }

    // Send to Claude
    messages.push({ role: 'user', content: trimmed })

    process.stdout.write('\n')

    try {
      const updatedMessages = await streamConversation(
        messages,
        systemPrompt,
        tools,
        {
          onText: (text) => {
            process.stdout.write(text)
          },

          onToolCall: async (tc: ToolCall) => {
            console.log('\n' + formatToolCall(tc))

            // YOLO mode: execute immediately
            if (cfg.yolo) {
              const result = await executeTool(tc.name, tc.input)
              const preview = result.length > 200 ? result.slice(0, 200) + '...' : result
              console.log(chalk.dim(preview))
              return result
            }

            // Non-YOLO: ask for confirmation on dangerous operations
            const dangerous = ['solana_transfer', 'solana_deploy_program', 'write_file', 'edit_file', 'bash'].includes(tc.name)

            if (dangerous) {
              const answer = await new Promise<string>((resolve) => {
                const confirmRl = readline.createInterface({ input: process.stdin, output: process.stdout })
                confirmRl.question(chalk.yellow('  Execute? [Y/n] '), (ans) => {
                  confirmRl.close()
                  resolve(ans.trim().toLowerCase())
                })
              })

              if (answer === 'n' || answer === 'no') {
                return 'User declined to execute this tool call.'
              }
            }

            const result = await executeTool(tc.name, tc.input)
            const preview = result.length > 300 ? result.slice(0, 300) + `... (${result.length} chars)` : result
            console.log(chalk.dim(preview))
            return result
          },

          onComplete: () => {
            console.log('\n')
          },

          onError: (err) => {
            console.error(chalk.red(`\nError: ${err.message}\n`))
          },
        },
      )

      // Update message history
      messages.length = 0
      messages.push(...updatedMessages)
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message}\n`))
      // Remove the failed user message
      messages.pop()
    }
  }

  // Handle initial prompt (from CLI args)
  if (initialPrompt) {
    await handleInput(initialPrompt)
  }

  // Start interactive loop
  rl.prompt()
  rl.on('line', async (line) => {
    await handleInput(line)
    rl.prompt()
  })

  rl.on('close', () => {
    console.log(chalk.dim('\nGoodbye.\n'))
    process.exit(0)
  })
}
