import readline from 'readline'
import chalk from 'chalk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { streamConversation, type ToolCall } from '../providers/claude.js'
import { getAllTools, executeTool, getToolCategory } from '../tools/registry.js'
import { getSystemPrompt } from './system-prompt.js'
import { getConfig, isUsingFreeKey, checkFreeUsage, incrementFreeUsage } from '../config/settings.js'
import { CLI_VERSION, MODELS, MODEL_ALIASES, NETWORKS, type ModelInfo } from '../config/constants.js'

// ─── Cost Tracking ─────────────────────────────────────────────────

interface SessionStats {
  inputTokens: number
  outputTokens: number
  cost: number
  turns: number
  toolCalls: number
  startTime: number
}

const stats: SessionStats = {
  inputTokens: 0,
  outputTokens: 0,
  cost: 0,
  turns: 0,
  toolCalls: 0,
  startTime: Date.now(),
}

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const info = MODELS[model]
  if (!info) return 0
  return (inputTokens / 1_000_000) * info.inputPrice + (outputTokens / 1_000_000) * info.outputPrice
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

// ─── Markdown Rendering ────────────────────────────────────────────

function renderMarkdown(text: string): string {
  let result = text

  // Code blocks with language
  result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const header = lang ? chalk.dim.bgGray(` ${lang} `) + '\n' : ''
    return '\n' + header + chalk.green(code.trimEnd()) + '\n'
  })

  // Inline code
  result = result.replace(/`([^`]+)`/g, (_, code) => chalk.green(code))

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text))

  // Italic
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, text) => chalk.italic(text))

  // Headers
  result = result.replace(/^### (.+)$/gm, (_, text) => chalk.bold.cyan(text))
  result = result.replace(/^## (.+)$/gm, (_, text) => chalk.bold.white(text))
  result = result.replace(/^# (.+)$/gm, (_, text) => '\n' + chalk.bold.underline.white(text))

  // Horizontal rules
  result = result.replace(/^---$/gm, chalk.dim('─'.repeat(60)))

  // Bullet points
  result = result.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, text) => `${indent}${chalk.dim('•')} ${text}`)

  // Numbered lists
  result = result.replace(/^(\s*)(\d+)\. (.+)$/gm, (_, indent, num, text) => `${indent}${chalk.dim(`${num}.`)} ${text}`)

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `${chalk.underline.blue(text)} ${chalk.dim(`(${url})`)}`)

  // Blockquotes
  result = result.replace(/^> (.+)$/gm, (_, text) => chalk.dim('│ ') + chalk.italic(text))

  return result
}

// ─── Tool Display ──────────────────────────────────────────────────

const TOOL_ICONS: Record<string, string> = {
  filesystem: '📁',
  shell: '⚡',
  solana: '◎',
  mythic: '🔮',
}

const TOOL_COLORS: Record<string, (s: string) => string> = {
  filesystem: chalk.cyan,
  shell: chalk.yellow,
  solana: (s: string) => chalk.hex('#9945FF')(s),
  mythic: chalk.green,
  unknown: chalk.gray,
}

function formatToolCall(tc: ToolCall): string {
  const category = getToolCategory(tc.name)
  const colorFn = TOOL_COLORS[category] || chalk.gray
  const icon = TOOL_ICONS[category] || '🔧'

  let summary = ''
  if (tc.name === 'bash') summary = tc.input.command?.slice(0, 80) || ''
  else if (tc.name === 'read_file') summary = tc.input.path || ''
  else if (tc.name === 'write_file') summary = `${tc.input.path} (${tc.input.content?.length || 0} bytes)`
  else if (tc.name === 'edit_file') summary = tc.input.path || ''
  else if (tc.name === 'glob_files') summary = tc.input.pattern || ''
  else if (tc.name === 'grep') summary = `"${tc.input.pattern}" ${tc.input.path || ''}`
  else if (tc.name.startsWith('solana_')) summary = tc.input.address?.slice(0, 16) || tc.input.signature?.slice(0, 16) || JSON.stringify(tc.input).slice(0, 50)
  else if (tc.name.startsWith('mythic_')) summary = tc.input.address?.slice(0, 16) || tc.input.mint?.slice(0, 16) || ''
  else summary = JSON.stringify(tc.input).slice(0, 50)

  return `  ${icon} ${colorFn(tc.name)} ${chalk.dim(summary)}`
}

function formatToolResult(result: string, name: string): string {
  const maxPreview = 400
  const trimmed = result.length > maxPreview ? result.slice(0, maxPreview) + chalk.dim(`\n  ... (${result.length} chars)`) : result

  // Indent the result
  const lines = trimmed.split('\n')
  const indented = lines.map(l => `  ${chalk.dim('│')} ${chalk.dim(l)}`).join('\n')
  return indented
}

// ─── ASCII Art Logo ────────────────────────────────────────────────

function gradientText(text: string, colors: string[]): string {
  const chars = [...text]
  return chars.map((ch, i) => {
    const colorIdx = Math.floor((i / chars.length) * colors.length)
    const color = colors[Math.min(colorIdx, colors.length - 1)]
    return chalk.hex(color)(ch)
  }).join('')
}

function printBanner(modelName: string, network: string, yolo: boolean, toolCount: number) {
  const v = chalk.hex('#9945FF')   // solana purple
  const p = chalk.hex('#9945FF')   // solana purple
  const g = chalk.hex('#14F195')   // solana green
  const c = chalk.hex('#14F195')   // solana green
  const dim = chalk.dim
  const colors = ['#9945FF', '#9945FF', '#A86BFF', '#14F195', '#14F195', '#14F195', '#14F195']

  console.log()
  // True gradient: interpolate #9945FF → #14F195 per character across each line
  function lerpColor(t: number): string {
    // #9945FF (153,69,255) → #14F195 (20,241,149)
    const r = Math.round(153 + (20 - 153) * t)
    const gg = Math.round(69 + (241 - 69) * t)
    const b = Math.round(255 + (149 - 255) * t)
    return `#${r.toString(16).padStart(2,'0')}${gg.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  }

  function gradLine(text: string): string {
    const chars = [...text]
    return chars.map((ch, i) => {
      if (ch === ' ') return ch
      const t = chars.length > 1 ? i / (chars.length - 1) : 0
      return chalk.hex(lerpColor(t))(ch)
    }).join('')
  }

  const art = [
    '  ██╗    ██╗██╗███████╗█████╗ ██████╗ ██████╗   █████╗ ██╗     ██╗',
    '  ██║    ██║██║╚══███╔╝██╔══██╗██╔══██╗██╔══██╗ ██╔══██╗██║     ██║',
    '  ██║ █╗ ██║██║  ███╔╝ ███████║██████╔╝██║  ██║ ██║  ╚═╝██║     ██║',
    '  ██║███╗██║██║ ███╔╝  ██╔══██║██╔══██╗██║  ██║ ██║  ██╗██║     ██║',
    '  ╚███╔████╔╝██║███████╗██║  ██║██║  ██║██████╔╝ ╚█████╔╝███████╗██║',
    '   ╚══╝╚══╝ ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝   ╚════╝ ╚══════╝╚═╝',
  ]
  for (const line of art) {
    console.log(gradLine(line))
  }
  console.log()
  console.log('  ' + gradLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(dim('  ') + chalk.bold.white('Wizard CLI') + dim(` v${CLI_VERSION}`) + dim(' — AI-powered blockchain development agent'))
  console.log()

  // Status line like Claude Code
  const modelDisplay = MODELS[modelName]?.name || modelName.split('-').slice(-2).join(' ')
  const providerBadge = MODELS[modelName]?.provider === 'openai'
    ? chalk.hex('#10A37F')('OpenAI')
    : chalk.hex('#D97706')('Anthropic')

  const isFree = isUsingFreeKey()
  const freeStatus = isFree ? checkFreeUsage() : null

  console.log(dim('  ┌──────────────────────────────────────────────────────────┐'))
  console.log(dim('  │') + ` Model: ${chalk.bold.white(modelDisplay)} ${dim('(')}${providerBadge}${dim(')')}`.padEnd(72) + dim('│'))
  console.log(dim('  │') + ` Network: ${chalk.bold(network === 'mythic-l2' ? g2('Mythic L2') : chalk.white(network))}${' '.repeat(Math.max(0, 47 - network.length))}` + dim('│'))
  console.log(dim('  │') + ` Tools: ${chalk.bold.white(String(toolCount))}` + dim(` available`) + `  YOLO: ${yolo ? chalk.red.bold('ON') : dim('off')}`.padEnd(34) + dim('│'))
  if (isFree) {
    console.log(dim('  │') + ` ${chalk.yellow('Free tier')}: ${chalk.white(String(freeStatus!.remaining))}/${chalk.dim('25')} messages remaining today`.padEnd(65) + dim('│'))
  }
  console.log(dim('  └──────────────────────────────────────────────────────────┘'))
  console.log()
  console.log(dim('  Tip: ') + chalk.white('/help') + dim(' for commands, ') + chalk.white('/model') + dim(' to switch models, ') + chalk.white('Ctrl+C') + dim(' to exit'))
  console.log(dim('  Web: ') + chalk.underline.hex('#14F195')('wizardcli.com') + dim(' · Docs: ') + chalk.underline.hex('#9945FF')('docs.wizardcli.com'))
  console.log()
}

// ─── Slash Commands ────────────────────────────────────────────────

function printHelp() {
  const h = chalk.bold.white
  const c = chalk.green
  const d = chalk.dim

  console.log()
  console.log(h('  Slash Commands'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  ${c('/help')}               ${d('Show this help message')}`)
  console.log(`  ${c('/model')} ${d('[name]')}       ${d('Switch model or show picker')}`)
  console.log(`  ${c('/models')}              ${d('List all available models')}`)
  console.log(`  ${c('/yolo')}                ${d('Toggle auto-execute mode')}`)
  console.log(`  ${c('/network')} ${d('<name>')}    ${d('Switch Solana network')}`)
  console.log(`  ${c('/keypair')} ${d('<path>')}    ${d('Set active keypair')}`)
  console.log(`  ${c('/status')}              ${d('Show session status & config')}`)
  console.log(`  ${c('/cost')}                ${d('Show session cost breakdown')}`)
  console.log(`  ${c('/tools')}               ${d('List all available tools')}`)
  console.log(`  ${c('/compact')}             ${d('Summarize conversation to save context')}`)
  console.log(`  ${c('/clear')}               ${d('Clear conversation history')}`)
  console.log(`  ${c('/config')} ${d('<k> <v>')}    ${d('Set a config value')}`)
  console.log(`  ${c('/exit')}                ${d('Exit Wizard CLI')}`)
  console.log()
  console.log(d('  Keyboard Shortcuts'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  ${c('Ctrl+C')}              ${d('Cancel current generation / Exit')}`)
  console.log(`  ${c('Ctrl+D')}              ${d('Exit')}`)
  console.log(`  ${c('Up/Down')}             ${d('Navigate input history')}`)
  console.log()
}

function printModels(currentModel: string) {
  const h = chalk.bold.white
  const d = chalk.dim

  console.log()
  console.log(h('  Available Models'))
  console.log(d('  ─'.repeat(30)))

  const byProvider: Record<string, ModelInfo[]> = {}
  for (const m of Object.values(MODELS)) {
    if (!byProvider[m.provider]) byProvider[m.provider] = []
    byProvider[m.provider].push(m)
  }

  for (const [provider, models] of Object.entries(byProvider)) {
    const badge = provider === 'openai'
      ? chalk.hex('#10A37F').bold('  OpenAI')
      : chalk.hex('#D97706').bold('  Anthropic')
    console.log(`\n${badge}`)

    for (const m of models) {
      const active = m.id === currentModel ? chalk.green(' ●') : '  '
      const tier = m.tier === 'flagship' ? chalk.yellow('★') :
                   m.tier === 'reasoning' ? chalk.magenta('◆') :
                   m.tier === 'balanced' ? chalk.blue('◎') : chalk.dim('○')
      const alias = Object.entries(MODEL_ALIASES).find(([_, v]) => v === m.id)?.[0] || ''
      const aliasStr = alias ? chalk.dim(` (${alias})`) : ''
      const price = d(`$${m.inputPrice}/$${m.outputPrice} per 1M tok`)
      const ctx = d(`${(m.contextWindow / 1000).toFixed(0)}K ctx`)

      console.log(`${active} ${tier} ${chalk.white(m.name.padEnd(22))}${aliasStr.padEnd(18)} ${ctx.padEnd(18)} ${price}`)
    }
  }

  console.log()
  console.log(d(`  Usage: /model <alias>  e.g. /model opus, /model gpt4.1, /model o3`))
  console.log()
}

function printCost(model: string) {
  const d = chalk.dim
  const elapsed = formatDuration(Date.now() - stats.startTime)

  console.log()
  console.log(chalk.bold.white('  Session Cost'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  Input tokens:  ${chalk.white(stats.inputTokens.toLocaleString())}`)
  console.log(`  Output tokens: ${chalk.white(stats.outputTokens.toLocaleString())}`)
  console.log(`  Total cost:    ${chalk.green.bold(formatCost(stats.cost))}`)
  console.log(`  Turns:         ${chalk.white(String(stats.turns))}`)
  console.log(`  Tool calls:    ${chalk.white(String(stats.toolCalls))}`)
  console.log(`  Duration:      ${chalk.white(elapsed)}`)
  console.log(`  Model:         ${chalk.white(MODELS[model]?.name || model)}`)
  console.log()
}

function printStatus(cfg: any, messageCount: number) {
  const d = chalk.dim
  const elapsed = formatDuration(Date.now() - stats.startTime)

  console.log()
  console.log(chalk.bold.white('  Session Status'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  Model:      ${chalk.bold.white(MODELS[cfg.model]?.name || cfg.model)}`)
  console.log(`  Provider:   ${MODELS[cfg.model]?.provider === 'openai' ? chalk.hex('#10A37F')('OpenAI') : chalk.hex('#D97706')('Anthropic')}`)
  console.log(`  Network:    ${chalk.white(cfg.network)}`)
  console.log(`  Keypair:    ${cfg.keypairPath ? chalk.white(cfg.keypairPath) : d('not set')}`)
  console.log(`  YOLO:       ${cfg.yolo ? chalk.red.bold('ON') : d('off')}`)
  console.log(`  Messages:   ${chalk.white(String(messageCount))}`)
  console.log(`  Cost:       ${chalk.green(formatCost(stats.cost))}`)
  console.log(`  Duration:   ${chalk.white(elapsed)}`)
  console.log(`  CWD:        ${d(process.cwd())}`)
  console.log()
}

function printTools(tools: any[]) {
  const d = chalk.dim

  console.log()
  console.log(chalk.bold.white('  Available Tools'))
  console.log(d('  ─'.repeat(30)))

  const byCategory: Record<string, any[]> = {}
  for (const t of tools) {
    const cat = getToolCategory(t.name)
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(t)
  }

  for (const [cat, catTools] of Object.entries(byCategory)) {
    const colorFn = TOOL_COLORS[cat] || chalk.gray
    const icon = TOOL_ICONS[cat] || '🔧'
    console.log(`\n  ${icon} ${colorFn(cat.toUpperCase())} ${d(`(${catTools.length})`)}`)
    for (const t of catTools) {
      console.log(`     ${colorFn(t.name.padEnd(28))} ${d(t.description?.slice(0, 55) || '')}`)
    }
  }
  console.log()
}

// ─── Main REPL ─────────────────────────────────────────────────────

export async function startRepl(initialPrompt?: string) {
  const cfg = getConfig()
  const messages: MessageParam[] = []
  const tools = getAllTools()
  let systemPrompt = getSystemPrompt()

  // Print banner
  printBanner(cfg.model, cfg.network, cfg.yolo, tools.length)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex('#14F195').bold('❯ '),
    historySize: 100,
  })

  let isProcessing = false
  let fullResponseText = ''

  async function handleInput(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return

    // ─── Slash Commands ─────────────────────────────────────
    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.slice(1).split(' ')
      switch (cmd) {
        case 'help': case 'h':
          printHelp()
          return

        case 'model': case 'm': {
          if (!args[0]) {
            printModels(cfg.model)
            return
          }
          const resolved = MODEL_ALIASES[args[0]] || args[0]
          if (MODELS[resolved]) {
            cfg.model = resolved
            const info = MODELS[resolved]
            console.log(`\n  ${chalk.green('●')} Switched to ${chalk.bold.white(info.name)} ${chalk.dim(`(${info.provider}, $${info.inputPrice}/$${info.outputPrice} per 1M)`)}\n`)
          } else {
            console.log(chalk.red(`\n  Unknown model: ${args[0]}. Use /models to see available.\n`))
          }
          return
        }

        case 'models':
          printModels(cfg.model)
          return

        case 'yolo':
          cfg.yolo = !cfg.yolo
          console.log(`\n  YOLO mode: ${cfg.yolo ? chalk.red.bold('ON') + chalk.dim(' — all tools auto-execute') : chalk.dim('off')}\n`)
          return

        case 'network': case 'n':
          if (args[0]) {
            const url = (NETWORKS as any)[args[0]]
            if (url) {
              (cfg as any).network = args[0]
              console.log(`\n  ${chalk.green('●')} Network: ${chalk.bold.white(args[0])} ${chalk.dim(`(${url})`)}\n`)
            } else {
              (cfg as any).network = args[0] as any
              (cfg as any).customRpc = args[0]
              console.log(`\n  ${chalk.green('●')} Custom RPC: ${chalk.bold.white(args[0])}\n`)
            }
          } else {
            console.log(chalk.dim('\n  Available networks:'))
            for (const [name, url] of Object.entries(NETWORKS)) {
              const active = name === cfg.network ? chalk.green(' ●') : '  '
              console.log(`${active} ${chalk.white(name.padEnd(18))} ${chalk.dim(url)}`)
            }
            console.log()
          }
          return

        case 'keypair': case 'k':
          if (args[0]) {
            cfg.keypairPath = args[0]
            console.log(`\n  ${chalk.green('●')} Keypair: ${chalk.white(args[0])}\n`)
          } else {
            console.log(`\n  Keypair: ${cfg.keypairPath ? chalk.white(cfg.keypairPath) : chalk.dim('not set')}\n`)
          }
          return

        case 'status': case 's':
          printStatus(cfg, messages.length)
          return

        case 'cost': case 'c':
          printCost(cfg.model)
          return

        case 'tools': case 't':
          printTools(tools)
          return

        case 'compact':
          if (messages.length > 4) {
            const kept = messages.slice(-4)
            messages.length = 0
            messages.push(...kept)
            console.log(chalk.dim(`\n  Compacted: kept last ${kept.length} messages, freed context.\n`))
          } else {
            console.log(chalk.dim('\n  Nothing to compact.\n'))
          }
          return

        case 'clear':
          messages.length = 0
          stats.inputTokens = 0
          stats.outputTokens = 0
          stats.cost = 0
          stats.turns = 0
          stats.toolCalls = 0
          console.log(chalk.dim('\n  Conversation and stats cleared.\n'))
          return

        case 'config':
          if (args.length >= 2) {
            const [key, ...valueParts] = args
            const value = valueParts.join(' ')
            ;(cfg as any)[key] = value === 'true' ? true : value === 'false' ? false : value
            console.log(`\n  ${chalk.green('●')} ${key} = ${value}\n`)
          } else {
            console.log(chalk.dim('\n  Usage: /config <key> <value>\n'))
          }
          return

        case 'exit': case 'quit': case 'q':
          console.log(chalk.dim(`\n  Session: ${stats.turns} turns, ${stats.toolCalls} tool calls, ${formatCost(stats.cost)}, ${formatDuration(Date.now() - stats.startTime)}`))
          console.log()
          process.exit(0)

        default:
          console.log(chalk.red(`  Unknown command: /${cmd}`) + chalk.dim(` — type /help for commands\n`))
          return
      }
    }

    // ─── Rate limit check for free tier ─────────────────────
    if (isUsingFreeKey()) {
      const { allowed, remaining } = checkFreeUsage()
      if (!allowed) {
        console.log()
        console.log(chalk.yellow('  Free tier limit reached (25 messages/day).'))
        console.log(chalk.dim('  Set your own API key for unlimited use:'))
        console.log(chalk.green('    export ANTHROPIC_API_KEY=sk-ant-...'))
        console.log(chalk.dim('  Get a key at: https://console.anthropic.com'))
        console.log()
        return
      }
      if (remaining <= 5) {
        console.log(chalk.dim(`  ${remaining} free messages remaining today`))
      }
      incrementFreeUsage()
    }

    // ─── Send to Model ──────────────────────────────────────
    isProcessing = true
    messages.push({ role: 'user', content: trimmed })
    stats.turns++
    fullResponseText = ''

    console.log()

    const turnStart = Date.now()

    try {
      const updatedMessages = await streamConversation(
        messages,
        systemPrompt,
        tools,
        {
          onText: (text) => {
            fullResponseText += text
            process.stdout.write(text)
          },

          onToolCall: async (tc: ToolCall) => {
            stats.toolCalls++

            // Show tool call badge
            console.log('\n')
            console.log(formatToolCall(tc))

            // YOLO mode: execute immediately
            if (cfg.yolo) {
              const result = await executeTool(tc.name, tc.input)
              console.log(formatToolResult(result, tc.name))
              return result
            }

            // Non-YOLO: ask for confirmation on dangerous operations
            const dangerous = ['solana_transfer', 'solana_deploy_program', 'write_file', 'edit_file', 'bash'].includes(tc.name)

            if (dangerous) {
              const answer = await new Promise<string>((resolve) => {
                const confirmRl = readline.createInterface({ input: process.stdin, output: process.stdout })
                confirmRl.question(chalk.yellow('  Allow? ') + chalk.dim('[Y/n] '), (ans) => {
                  confirmRl.close()
                  resolve(ans.trim().toLowerCase())
                })
              })

              if (answer === 'n' || answer === 'no') {
                console.log(chalk.dim('  Denied.'))
                return 'User declined to execute this tool call.'
              }
            }

            const result = await executeTool(tc.name, tc.input)
            console.log(formatToolResult(result, tc.name))
            return result
          },

          onComplete: () => {
            const elapsed = Date.now() - turnStart

            // Estimate tokens (rough: 4 chars per token)
            const inputEst = Math.ceil(trimmed.length / 4)
            const outputEst = Math.ceil(fullResponseText.length / 4)
            stats.inputTokens += inputEst
            stats.outputTokens += outputEst
            stats.cost += estimateCost(inputEst, outputEst, cfg.model)

            // Render markdown on the full response
            // (We already streamed raw text; this is just for the final newlines)
            console.log()
            console.log(chalk.dim(`  ${formatDuration(elapsed)} · ${formatCost(estimateCost(inputEst, outputEst, cfg.model))}`))
            console.log()

            isProcessing = false
          },

          onError: (err) => {
            console.error(chalk.red(`\n  Error: ${err.message}\n`))
            isProcessing = false
          },
        },
      )

      // Update message history
      messages.length = 0
      messages.push(...updatedMessages)
    } catch (err: any) {
      if (err.message?.includes('API key')) {
        console.error(chalk.red(`\n  Authentication error. Check your API key.\n`))
      } else {
        console.error(chalk.red(`\n  Error: ${err.message}\n`))
      }
      messages.pop()
      isProcessing = false
    }
  }

  // Handle initial prompt (from CLI args)
  if (initialPrompt) {
    await handleInput(initialPrompt)
  }

  // Start interactive loop
  rl.prompt()
  rl.on('line', async (line) => {
    if (isProcessing) return
    await handleInput(line)
    rl.prompt()
  })

  rl.on('close', () => {
    console.log(chalk.dim(`\n  Session: ${stats.turns} turns, ${formatCost(stats.cost)}`))
    console.log()
    process.exit(0)
  })

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    if (isProcessing) {
      console.log(chalk.dim('\n  Cancelled.'))
      isProcessing = false
      rl.prompt()
    } else {
      console.log(chalk.dim(`\n  Session: ${stats.turns} turns, ${formatCost(stats.cost)}`))
      console.log()
      process.exit(0)
    }
  })
}
