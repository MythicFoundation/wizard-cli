import readline from 'readline'
import chalk from 'chalk'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { streamConversation, type ToolCall } from '../providers/claude.js'
import { getAllTools, executeTool, getToolCategory } from '../tools/registry.js'
import { getSystemPrompt } from './system-prompt.js'
import { getConfig, isUsingFreeKey, checkFreeUsage, incrementFreeUsage } from '../config/settings.js'
import { CLI_VERSION, MODELS, MODEL_ALIASES, NETWORKS, WIZARD_DIR, type ModelInfo } from '../config/constants.js'
import { SessionManager, type Session } from './session-manager.js'
import { permissionManager, type PermissionMode } from './permission-manager.js'
import { getAgentRunner } from './agent-runner.js'
import { skillLoader } from './skill-loader.js'
import { memoryManager } from './memory-manager.js'
import { mcpClient } from './mcp-client.js'
import { planMode } from './plan-mode.js'
import { taskManager } from './task-manager.js'
import { hookRunner } from './hook-runner.js'
import { thinkingIndicator, spinner as createSpinner } from './ui.js'

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
  web: '🌐',
  agent: '🤖',
  memory: '🧠',
  task: '📋',
  mcp: '🔌',
}

const TOOL_COLORS: Record<string, (s: string) => string> = {
  filesystem: chalk.cyan,
  shell: chalk.yellow,
  solana: (s: string) => chalk.hex('#9945FF')(s),
  mythic: chalk.green,
  web: chalk.blue,
  agent: chalk.magenta,
  memory: (s: string) => chalk.hex('#FF9500')(s),
  task: (s: string) => chalk.hex('#00E5FF')(s),
  mcp: (s: string) => chalk.hex('#FF2D78')(s),
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
  else if (tc.name === 'spawn_agent') summary = `${tc.input.agent_type}: ${(tc.input.prompt || '').slice(0, 60)}`
  else if (tc.name === 'write_memory') summary = `${tc.input.filename} (${tc.input.scope || 'project'})`
  else if (tc.name === 'search_memory') summary = `"${tc.input.query}"`
  else if (tc.name.startsWith('task_')) summary = tc.input.id || tc.input.description?.slice(0, 50) || ''
  else if (tc.name.startsWith('mcp__')) summary = tc.name.split('__').slice(2).join('__')
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

function printBanner(
  modelName: string,
  network: string,
  toolCount: number,
  permMode: PermissionMode,
  agentCount: number,
  mcpServerCount: number,
  memoryLoaded: boolean,
  sessionId: string,
) {
  const d = chalk.dim

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

  console.log()
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
  console.log(d('  ') + chalk.bold.white('Wizard CLI') + d(` v${CLI_VERSION}`) + d(' — AI-powered blockchain development agent'))
  console.log()

  // Status line like Claude Code
  const modelDisplay = MODELS[modelName]?.name || modelName.split('-').slice(-2).join(' ')
  const providerBadge = MODELS[modelName]?.provider === 'openai'
    ? chalk.hex('#10A37F')('OpenAI')
    : chalk.hex('#D97706')('Anthropic')

  const isFree = isUsingFreeKey()
  const freeStatus = isFree ? checkFreeUsage() : null

  // Permission mode display
  const permDisplay = permMode === 'auto'
    ? chalk.red.bold('AUTO')
    : permMode === 'bypassPermissions' || permMode === 'dontAsk'
    ? chalk.red.bold(permMode.toUpperCase())
    : permMode === 'plan'
    ? chalk.yellow.bold('PLAN')
    : permMode === 'acceptEdits'
    ? chalk.blue('acceptEdits')
    : d('default')

  console.log(d('  ┌──────────────────────────────────────────────────────────┐'))
  console.log(d('  │') + ` Model: ${chalk.bold.white(modelDisplay)} ${d('(')}${providerBadge}${d(')')}`.padEnd(72) + d('│'))
  console.log(d('  │') + ` Network: ${chalk.bold(network === 'mythic-l2' ? chalk.hex('#14F195')('Mythic L2') : chalk.white(network))}${' '.repeat(Math.max(0, 47 - network.length))}` + d('│'))
  console.log(d('  │') + ` Tools: ${chalk.bold.white(String(toolCount))}` + d(` available`) + `  Mode: ${permDisplay}`.padEnd(34) + d('│'))
  console.log(d('  │') + ` Agents: ${chalk.white(String(agentCount))}` + d(' loaded') + `  MCP: ${mcpServerCount > 0 ? chalk.green(String(mcpServerCount) + ' server' + (mcpServerCount > 1 ? 's' : '')) : d('none')}` + `  Memory: ${memoryLoaded ? chalk.green('loaded') : d('off')}`.padEnd(16) + d('│'))
  if (isFree) {
    console.log(d('  │') + ` ${chalk.yellow('Free tier')}: ${chalk.white(String(freeStatus!.remaining))}/${chalk.dim('25')} messages remaining today`.padEnd(65) + d('│'))
  }
  console.log(d('  │') + ` Session: ${d(sessionId.slice(0, 8))}`.padEnd(65) + d('│'))
  console.log(d('  └──────────────────────────────────────────────────────────┘'))
  console.log()
  console.log(d('  Tip: ') + chalk.white('/help') + d(' for commands, ') + chalk.white('/model') + d(' to switch models, ') + chalk.white('Ctrl+C') + d(' to exit'))
  console.log(d('  Web: ') + chalk.underline.hex('#14F195')('wizardcli.com') + d(' · Docs: ') + chalk.underline.hex('#9945FF')('docs.wizardcli.com'))
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
  console.log(`  ${c('/mode')} ${d('<mode>')}       ${d('Set permission mode (default|auto|plan|acceptEdits|bypassPermissions)')}`)
  console.log(`  ${c('/plan')}                ${d('Toggle plan mode (read-only)')}`)
  console.log(`  ${c('/network')} ${d('<name>')}    ${d('Switch Solana network')}`)
  console.log(`  ${c('/keypair')} ${d('<path>')}    ${d('Set active keypair')}`)
  console.log(`  ${c('/status')}              ${d('Show session status & config')}`)
  console.log(`  ${c('/cost')}                ${d('Show session cost breakdown')}`)
  console.log(`  ${c('/tools')}               ${d('List all available tools')}`)
  console.log(`  ${c('/compact')}             ${d('Summarize conversation to save context')}`)
  console.log(`  ${c('/clear')}               ${d('Clear conversation history')}`)
  console.log(`  ${c('/config')} ${d('<k> <v>')}    ${d('Set a config value')}`)
  console.log()
  console.log(h('  Agent & Skill Commands'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  ${c('/agent')} ${d('<type> <prompt>')}  ${d('Spawn a specialist agent')}`)
  console.log(`  ${c('/agents')}              ${d('List available agent types')}`)
  console.log(`  ${c('/team')} ${d('<prompt>')}     ${d('Agent team mode (lead delegates)')}`)
  console.log(`  ${c('/skills')}              ${d('List available skills')}`)
  console.log()
  console.log(h('  Memory & Session Commands'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  ${c('/memory')}              ${d('Show memory summary')}`)
  console.log(`  ${c('/remember')} ${d('<fact>')}   ${d('Quick-save to memory')}`)
  console.log(`  ${c('/sessions')}            ${d('List past sessions')}`)
  console.log(`  ${c('/tasks')}               ${d('List background tasks')}`)
  console.log(`  ${c('/mcp')}                 ${d('Show MCP server status')}`)
  console.log(`  ${c('/login')}               ${d('Authenticate (API key / OAuth)')}`)
  console.log(`  ${c('/init')}                ${d('Re-scaffold .wizard/ setup')}`)
  console.log()
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

function printStatus(cfg: any, messageCount: number, sessionId: string) {
  const d = chalk.dim
  const elapsed = formatDuration(Date.now() - stats.startTime)

  // Gather dynamic info
  const agentRunner = getAgentRunner()
  const agents = agentRunner.getAgents()
  const runningAgents = agents.filter(a => a.status === 'running' || a.status === 'background')
  const mcpStatus = mcpClient.getStatus()
  const permSummary = permissionManager.getSummary()
  const taskSummary = taskManager.getSummary()
  const planSummary = planMode.getSummary()

  console.log()
  console.log(chalk.bold.white('  Session Status'))
  console.log(d('  ─'.repeat(30)))
  console.log(`  Model:       ${chalk.bold.white(MODELS[cfg.model]?.name || cfg.model)}`)
  console.log(`  Provider:    ${MODELS[cfg.model]?.provider === 'openai' ? chalk.hex('#10A37F')('OpenAI') : chalk.hex('#D97706')('Anthropic')}`)
  console.log(`  Network:     ${chalk.white(cfg.network)}`)
  console.log(`  Keypair:     ${cfg.keypairPath ? chalk.white(cfg.keypairPath) : d('not set')}`)
  console.log(`  Perm Mode:   ${chalk.white(permSummary.mode)}${permSummary.allowCount > 0 ? d(` (${permSummary.allowCount} allow, ${permSummary.denyCount} deny)`) : ''}`)
  console.log(`  Plan Mode:   ${planSummary.active ? chalk.yellow.bold('ACTIVE') : d('off')}${planSummary.planFile ? d(` (${planSummary.planFile})`) : ''}`)
  console.log(`  Messages:    ${chalk.white(String(messageCount))}`)
  console.log(`  Cost:        ${chalk.green(formatCost(stats.cost))}`)
  console.log(`  Duration:    ${chalk.white(elapsed)}`)
  console.log(`  Session:     ${d(sessionId.slice(0, 8))}`)
  console.log(`  CWD:         ${d(process.cwd())}`)
  console.log()

  // Agents
  if (agents.length > 0) {
    console.log(chalk.bold.white('  Agents'))
    console.log(d('  ─'.repeat(30)))
    for (const a of agents) {
      const statusIcon = a.status === 'running' ? chalk.yellow('●') :
                         a.status === 'completed' ? chalk.green('●') :
                         a.status === 'background' ? chalk.blue('●') :
                         chalk.red('●')
      console.log(`  ${statusIcon} ${chalk.white(a.name)} ${d(`(${a.status})`)}${a.duration ? d(` ${formatDuration(a.duration)}`) : ''}`)
    }
    console.log()
  }

  // MCP
  if (mcpStatus.length > 0) {
    console.log(chalk.bold.white('  MCP Servers'))
    console.log(d('  ─'.repeat(30)))
    for (const s of mcpStatus) {
      const statusIcon = s.connected ? chalk.green('●') : chalk.red('●')
      console.log(`  ${statusIcon} ${chalk.white(s.name)} ${d(`(${s.toolCount} tools)`)}`)
    }
    console.log()
  }

  // Tasks
  if (taskManager.count > 0) {
    console.log(chalk.bold.white('  Tasks'))
    console.log(d('  ─'.repeat(30)))
    console.log(`  Pending: ${taskSummary.pending}  In Progress: ${taskSummary.in_progress}  Completed: ${taskSummary.completed}  Failed: ${taskSummary.failed}`)
    console.log()
  }
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

// ─── Settings Loader ───────────────────────────────────────────────

function loadWizardSettings(): any | null {
  const settingsPath = path.join(process.cwd(), WIZARD_DIR, 'settings.json')
  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'))
    } catch {
      return null
    }
  }
  return null
}

// ─── Main REPL ─────────────────────────────────────────────────────

export async function startRepl(initialPrompt?: string, resumeSession?: Session) {
  const cfg = getConfig()

  // ─── Initialize Session Manager ──────────────────────────────
  const sessionManager = new SessionManager()

  // ─── Initialize Permission Manager ───────────────────────────
  permissionManager.loadDefaults()
  permissionManager.applyLegacyConfig(cfg.yolo)

  // ─── Load Skills ─────────────────────────────────────────────
  skillLoader.loadSkills(process.cwd())

  // ─── Load Agents ─────────────────────────────────────────────
  const agentRunner = getAgentRunner(process.cwd(), sessionManager.getSessionId())
  const agentDefs = agentRunner.loadAgents(process.cwd())

  // ─── Load Hooks ──────────────────────────────────────────────
  const wizardSettingsPath = path.join(process.cwd(), WIZARD_DIR, 'settings.json')
  hookRunner.loadHooks(wizardSettingsPath)

  // ─── Connect MCP Servers (async, non-blocking) ───────────────
  const wizardSettings = loadWizardSettings()
  if (wizardSettings?.mcpServers && typeof wizardSettings.mcpServers === 'object') {
    mcpClient.connectAll(wizardSettings.mcpServers).catch(() => {
      // MCP connection failures are non-fatal
    })
  }

  // ─── Check memory ───────────────────────────────────────────
  const memoryContent = memoryManager.getMemoryForPrompt()
  const memoryLoaded = memoryContent.length > 0

  // ─── Resume session if requested ────────────────────────────
  const messages: MessageParam[] = resumeSession ? [...resumeSession.messages] : []
  if (resumeSession) {
    sessionManager.resumeSession(resumeSession)
  }

  const tools = getAllTools()
  const systemPrompt = getSystemPrompt()

  // Print banner
  printBanner(
    cfg.model,
    cfg.network,
    tools.length,
    permissionManager.getMode(),
    agentDefs.length,
    mcpClient.serverCount,
    memoryLoaded,
    sessionManager.getSessionId(),
  )

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex('#14F195').bold('❯ '),
    historySize: 100,
  })

  let isProcessing = false
  let fullResponseText = ''

  async function handleInput(rawInput: string) {
    let input = rawInput.trim()
    if (!input) return

    // ─── Skill Matching (before slash commands) ─────────────────
    if (input.startsWith('/')) {
      const skillMatch = skillLoader.matchSkill(input)
      if (skillMatch) {
        // Expand skill into a prompt and fall through to model handling
        input = skillLoader.expandSkill(skillMatch.skill, skillMatch.args)
        console.log(chalk.dim(`  [Skill: ${skillMatch.skill.command}]`))
        // Fall through — do not return, send as message to model
      } else {
        // ─── Slash Commands ─────────────────────────────────────
        const [cmd, ...args] = input.slice(1).split(' ')
        let handled = true

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
            // Map YOLO toggle to permission mode
            if (cfg.yolo) {
              permissionManager.setMode('auto')
            } else {
              permissionManager.setMode('default')
            }
            console.log(`\n  YOLO mode: ${cfg.yolo ? chalk.red.bold('ON') + chalk.dim(' — all tools auto-execute (mode: auto)') : chalk.dim('off (mode: default)')}\n`)
            return

          case 'mode': {
            const validModes = ['default', 'auto', 'plan', 'acceptEdits', 'bypassPermissions', 'dontAsk']
            if (!args[0]) {
              console.log(`\n  Current mode: ${chalk.bold.white(permissionManager.getMode())}`)
              console.log(chalk.dim(`  Available: ${validModes.join(', ')}\n`))
              return
            }
            if (validModes.includes(args[0])) {
              permissionManager.setMode(args[0] as PermissionMode)
              cfg.yolo = args[0] === 'auto' || args[0] === 'bypassPermissions' || args[0] === 'dontAsk'
              console.log(`\n  ${chalk.green('●')} Permission mode: ${chalk.bold.white(args[0])}\n`)
            } else {
              console.log(chalk.red(`\n  Unknown mode: ${args[0]}. Valid: ${validModes.join(', ')}\n`))
            }
            return
          }

          case 'plan': {
            if (planMode.active) {
              planMode.exit()
              permissionManager.setMode('default')
              console.log(`\n  ${chalk.green('●')} Plan mode ${chalk.dim('exited')}. Normal execution resumed.\n`)
            } else {
              planMode.enter(args[0])
              permissionManager.setMode('plan')
              console.log(`\n  ${chalk.yellow('●')} Plan mode ${chalk.yellow.bold('ACTIVE')}. Only read/analysis tools allowed.`)
              console.log(chalk.dim(`  Plan file: ${planMode.planFile}`))
              console.log(chalk.dim(`  Use /plan again to exit.\n`))
            }
            return
          }

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
            printStatus(cfg, messages.length, sessionManager.getSessionId())
            return

          case 'cost': case 'c':
            printCost(cfg.model)
            return

          case 'tools': case 't':
            printTools(getAllTools())
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

          // ─── Agent Commands ────────────────────────────────────

          case 'agent': {
            if (args.length < 2) {
              console.log(chalk.dim('\n  Usage: /agent <type> <prompt>'))
              console.log(chalk.dim('  Types: ') + agentDefs.map(a => chalk.white(a.name)).join(', '))
              console.log()
              return
            }
            const agentType = args[0]
            const agentPrompt = args.slice(1).join(' ')
            console.log(chalk.dim(`\n  Spawning agent: ${agentType}...`))
            try {
              const result = await agentRunner.executeSpawnAgent({
                agent_type: agentType,
                prompt: agentPrompt,
              })
              console.log()
              console.log(renderMarkdown(result))
              console.log()
            } catch (err: any) {
              console.log(chalk.red(`  Agent error: ${err.message}\n`))
            }
            return
          }

          case 'agents': {
            console.log()
            console.log(chalk.bold.white('  Available Agents'))
            console.log(chalk.dim('  ─'.repeat(30)))
            for (const a of agentDefs) {
              console.log(`  ${chalk.magenta('●')} ${chalk.bold.white(a.name.padEnd(20))} ${chalk.dim(a.description.slice(0, 60))}`)
            }
            console.log()
            console.log(chalk.dim('  Usage: /agent <type> <prompt>'))
            console.log()

            // Show running agents if any
            const running = agentRunner.getAgents()
            if (running.length > 0) {
              console.log(chalk.bold.white('  Running Agents'))
              console.log(chalk.dim('  ─'.repeat(30)))
              for (const a of running) {
                const icon = a.status === 'running' ? chalk.yellow('●') :
                             a.status === 'completed' ? chalk.green('●') :
                             a.status === 'background' ? chalk.blue('●') :
                             chalk.red('●')
                console.log(`  ${icon} ${chalk.white(a.name)} ${chalk.dim(`(${a.status})`)} ${a.agentId.slice(0, 8)}`)
              }
              console.log()
            }
            return
          }

          case 'team': {
            if (!args.length) {
              console.log(chalk.dim('\n  Usage: /team <prompt>\n'))
              return
            }
            const teamPrompt = args.join(' ')
            console.log(chalk.dim(`\n  Launching agent team with lead + specialists...`))
            // Use the lead agent approach — spawns as a regular agent with spawn_agent tool
            try {
              const result = await agentRunner.executeSpawnAgent({
                agent_type: 'program-engineer',
                prompt: `You are leading a team of specialist agents. Analyze this task and delegate subtasks to the appropriate specialists using the spawn_agent tool.\n\nTask: ${teamPrompt}`,
              })
              console.log()
              console.log(renderMarkdown(result))
              console.log()
            } catch (err: any) {
              console.log(chalk.red(`  Team error: ${err.message}\n`))
            }
            return
          }

          // ─── Skill Commands ────────────────────────────────────

          case 'skills': {
            const skills = skillLoader.getSkills()
            console.log()
            console.log(chalk.bold.white('  Available Skills'))
            console.log(chalk.dim('  ─'.repeat(30)))
            if (skills.length === 0) {
              console.log(chalk.dim('  No skills loaded. Run /init to scaffold .wizard/skills/.'))
            } else {
              for (const s of skills) {
                console.log(`  ${chalk.green(s.command.padEnd(20))} ${chalk.dim(s.description.slice(0, 55))}`)
              }
            }
            console.log()
            return
          }

          // ─── Memory Commands ───────────────────────────────────

          case 'memory': {
            const memContent = memoryManager.getMemoryForPrompt()
            console.log()
            console.log(chalk.bold.white('  Memory'))
            console.log(chalk.dim('  ─'.repeat(30)))
            if (memContent) {
              const lines = memContent.split('\n')
              const preview = lines.slice(0, 20).join('\n')
              console.log(chalk.dim(preview))
              if (lines.length > 20) {
                console.log(chalk.dim(`  ... ${lines.length - 20} more lines`))
              }
            } else {
              console.log(chalk.dim('  No memory files found. Use /remember <fact> to save.'))
            }
            console.log()
            return
          }

          case 'remember': {
            if (!args.length) {
              console.log(chalk.dim('\n  Usage: /remember <fact to save>\n'))
              return
            }
            const fact = args.join(' ')
            const timestamp = new Date().toISOString().slice(0, 19)
            try {
              // Append to MEMORY.md
              const memDir = path.join(process.cwd(), WIZARD_DIR, 'memory')
              const memPath = path.join(memDir, 'MEMORY.md')
              const { mkdirSync, appendFileSync } = await import('fs')
              mkdirSync(memDir, { recursive: true })
              if (!existsSync(memPath)) {
                const { writeFileSync } = await import('fs')
                writeFileSync(memPath, '# Project Memory\n\n', 'utf-8')
              }
              appendFileSync(memPath, `- ${fact} (${timestamp})\n`, 'utf-8')
              console.log(`\n  ${chalk.green('●')} Remembered: ${chalk.dim(fact.slice(0, 60))}\n`)
            } catch (err: any) {
              console.log(chalk.red(`  Error saving memory: ${err.message}\n`))
            }
            return
          }

          // ─── Session Commands ──────────────────────────────────

          case 'sessions': {
            const sessions = SessionManager.listSessions(process.cwd())
            console.log()
            console.log(chalk.bold.white('  Past Sessions'))
            console.log(chalk.dim('  ─'.repeat(30)))
            if (sessions.length === 0) {
              console.log(chalk.dim('  No previous sessions found.'))
            } else {
              for (const s of sessions.slice(0, 15)) {
                const date = new Date(s.startTime).toLocaleString()
                console.log(`  ${chalk.dim(s.id.slice(0, 8))} ${chalk.dim(date)} ${chalk.white(`${s.turns} turns`)} ${chalk.dim(s.firstMessage.slice(0, 40))}`)
              }
            }
            console.log()
            return
          }

          // ─── Task Commands ─────────────────────────────────────

          case 'tasks': {
            const tasks = taskManager.list()
            console.log()
            console.log(chalk.bold.white('  Background Tasks'))
            console.log(chalk.dim('  ─'.repeat(30)))
            if (tasks.length === 0) {
              console.log(chalk.dim('  No tasks.'))
            } else {
              for (const t of tasks) {
                const icon = t.status === 'pending' ? chalk.dim('○') :
                             t.status === 'in_progress' ? chalk.yellow('●') :
                             t.status === 'completed' ? chalk.green('●') :
                             chalk.red('●')
                console.log(`  ${icon} ${chalk.dim(t.id)} ${chalk.white(t.description.slice(0, 50))} ${chalk.dim(`(${t.status})`)}`)
              }
            }
            console.log()
            return
          }

          // ─── MCP Commands ──────────────────────────────────────

          case 'mcp': {
            const status = mcpClient.getStatus()
            console.log()
            console.log(chalk.bold.white('  MCP Servers'))
            console.log(chalk.dim('  ─'.repeat(30)))
            if (status.length === 0) {
              console.log(chalk.dim('  No MCP servers configured.'))
              console.log(chalk.dim('  Add servers to .wizard/settings.json under "mcpServers".'))
            } else {
              for (const s of status) {
                const icon = s.connected ? chalk.green('●') : chalk.red('●')
                console.log(`  ${icon} ${chalk.white(s.name)} ${chalk.dim(`(${s.toolCount} tools, ${s.connected ? 'connected' : 'disconnected'})`)}`)
              }
              console.log(chalk.dim(`\n  Total: ${mcpClient.toolCount} MCP tools across ${mcpClient.serverCount} servers`))
            }
            console.log()
            return
          }

          // ─── Init Command ──────────────────────────────────────

          case 'login': {
            const { runLoginFlow } = await import('./auth.js')
            await runLoginFlow()
            return
          }

          case 'init': {
            console.log(chalk.dim('\n  Re-scaffolding .wizard/ setup...'))
            try {
              const { execSync } = await import('child_process')
              execSync('wizard init', { cwd: process.cwd(), stdio: 'inherit' })
            } catch {
              console.log(chalk.dim('  Run "wizard init" from the command line to scaffold.'))
            }
            console.log()
            return
          }

          case 'exit': case 'quit': case 'q':
            console.log(chalk.dim(`\n  Session: ${stats.turns} turns, ${stats.toolCalls} tool calls, ${formatCost(stats.cost)}, ${formatDuration(Date.now() - stats.startTime)}`))
            console.log()
            // Disconnect MCP servers on exit
            mcpClient.disconnectAll().catch(() => {})
            process.exit(0)

          default:
            handled = false
            break
        }

        if (handled) return

        // If no built-in command matched and no skill matched, show error
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
    const userMessage: MessageParam = { role: 'user', content: input }
    messages.push(userMessage)
    sessionManager.appendMessage(userMessage)
    stats.turns++
    fullResponseText = ''

    console.log()

    const turnStart = Date.now()
    let turnInputTokens = 0
    let turnOutputTokens = 0

    // Thinking indicator — shows animated dots until first token
    const thinking = thinkingIndicator()
    thinking.start()
    let thinkingStopped = false

    function stopThinking(): void {
      if (!thinkingStopped) {
        thinkingStopped = true
        thinking.stop()
      }
    }

    try {
      // Refresh tools list (MCP tools may have changed)
      const currentTools = getAllTools()
      const currentSystemPrompt = getSystemPrompt()

      const updatedMessages = await streamConversation(
        messages,
        currentSystemPrompt,
        currentTools,
        {
          onText: (text) => {
            // Stop thinking indicator on first text token
            stopThinking()
            fullResponseText += text
            process.stdout.write(text)
          },

          onToolCall: async (tc: ToolCall) => {
            // Stop thinking indicator if still running (tool call before any text)
            stopThinking()
            stats.toolCalls++

            // Show tool call badge
            console.log('\n')
            console.log(formatToolCall(tc))

            // Run pre-hook
            if (hookRunner.hasHooks('pre_tool_call')) {
              const hookResult = await hookRunner.run('pre_tool_call', { toolName: tc.name, input: tc.input })
              if (!hookResult.allowed) {
                console.log(chalk.red('  Blocked by hook: ' + hookResult.output))
                return 'Tool call blocked by hook.'
              }
            }

            // Check plan mode
            if (planMode.active && !planMode.isToolAllowed(tc.name)) {
              console.log(chalk.yellow('  Blocked: plan mode (read-only)'))
              return 'Tool blocked: plan mode is active (read-only). Use /plan to exit.'
            }

            // Check permissions
            const permission = permissionManager.checkPermission(tc.name, tc.input)

            if (permission === 'deny') {
              console.log(chalk.red('  Denied by permission policy.'))
              return 'Tool call denied by permission policy.'
            }

            if (permission === 'ask') {
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

            // Show spinner while tool executes
            const toolSpinner = createSpinner({ indent: '  ' })
            const category = getToolCategory(tc.name)
            const colorFn = TOOL_COLORS[category] || chalk.gray
            toolSpinner.start(`Running ${colorFn(tc.name)}...`)

            let result: string
            try {
              result = await executeTool(tc.name, tc.input)
              toolSpinner.succeed(`${colorFn(tc.name)} completed`)
            } catch (toolErr: any) {
              toolSpinner.fail(`${colorFn(tc.name)} failed`)
              result = `Error: ${toolErr.message}`
            }

            console.log(formatToolResult(result, tc.name))

            // Run post-hook
            if (hookRunner.hasHooks('post_tool_call')) {
              await hookRunner.run('post_tool_call', { toolName: tc.name, input: tc.input, output: result })
            }

            // Restart thinking indicator for model's next response
            thinkingStopped = false
            thinking.start()

            return result
          },

          onUsage: (inputTokens: number, outputTokens: number) => {
            // Store real token counts from the API response
            turnInputTokens = inputTokens
            turnOutputTokens = outputTokens
          },

          onComplete: () => {
            stopThinking()
            const elapsed = Date.now() - turnStart

            // Use real token counts from API if available, fall back to estimate
            const inputTok = turnInputTokens > 0 ? turnInputTokens : Math.ceil(input.length / 4)
            const outputTok = turnOutputTokens > 0 ? turnOutputTokens : Math.ceil(fullResponseText.length / 4)
            stats.inputTokens += inputTok
            stats.outputTokens += outputTok
            stats.cost += estimateCost(inputTok, outputTok, cfg.model)

            // Render markdown on the full response
            // (We already streamed raw text; this is just for the final newlines)
            console.log()
            console.log(chalk.dim(`  ${formatDuration(elapsed)} \u00B7 ${formatCost(estimateCost(inputTok, outputTok, cfg.model))}`))
            console.log()

            // Save assistant message to session
            if (fullResponseText) {
              sessionManager.appendMessage({ role: 'assistant', content: fullResponseText })
            }

            isProcessing = false
          },

          onError: (err) => {
            stopThinking()
            console.error(chalk.red(`\n  Error: ${err.message}\n`))
            isProcessing = false
          },
        },
      )

      // Update message history
      messages.length = 0
      messages.push(...updatedMessages)
    } catch (err: any) {
      stopThinking()
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
    mcpClient.disconnectAll().catch(() => {})
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
      mcpClient.disconnectAll().catch(() => {})
      process.exit(0)
    }
  })
}
