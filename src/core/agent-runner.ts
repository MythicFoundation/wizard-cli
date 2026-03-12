import { randomUUID } from 'crypto'
import { readFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages'
import { streamConversation, createToolDefinition, type ToolCall } from '../providers/claude.js'
import { getAllTools, executeTool } from '../tools/registry.js'
import { getSystemPrompt } from './system-prompt.js'
import { getConfig } from '../config/settings.js'

// ─── Types ──────────────────────────────────────────────────────────

export interface AgentDefinition {
  name: string
  description: string
  systemPrompt: string       // From .wizard/agents/<name>.md
  tools?: string[]            // Tool filter (default: all tools)
  model?: string              // Optional model override
}

export interface AgentResult {
  agentId: string
  name: string
  output: string
  toolCalls: number
  tokensUsed: { input: number; output: number }
  duration: number
  status: 'completed' | 'error' | 'background'
}

export interface AgentStatus {
  agentId: string
  name: string
  status: 'running' | 'completed' | 'error' | 'background'
  startTime: number
  duration?: number
  toolCalls?: number
  output?: string
}

export interface SpawnOpts {
  definition: AgentDefinition
  prompt: string
  parentMessages?: MessageParam[]
  background?: boolean
  model?: string
  sessionDir?: string
}

// ─── Built-in Agent Templates ───────────────────────────────────────

const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    name: 'program-engineer',
    description: 'Solana program specialist — native solana_program, borsh, PDA derivation, CPI, account validation',
    systemPrompt: `You are a Solana program engineer specializing in native solana_program development (NOT Anchor).

Your expertise:
- Native solana_program with borsh 0.10 serialization
- PDA derivation and cross-program invocation (CPI)
- Account validation, signer checks, owner checks
- SPL Token and Token-2022 integration
- Solana BPF compilation with cargo build-sbf

Build rules:
- Pin blake3 = ">=1.3, <1.8" in workspace Cargo.toml
- Pin getrandom = { version = "0.2", features = ["custom"] }
- Pin solana-program = "=2.1.17"
- Profile: overflow-checks = true, lto = "fat"
- Use checked_ arithmetic everywhere
- Every instruction must validate ALL accounts (owner, signer, writable, PDA seeds)

When writing programs, always:
1. Define instruction enum with borsh serialization
2. Validate every account in the accounts array
3. Use checked_add/checked_sub/checked_mul for all math
4. Return proper ProgramError variants
5. Document PDA seeds in comments`,
  },
  {
    name: 'defi-ops',
    description: 'DeFi operations — pool management, price syncing, fee collection, launchpad, DEX API',
    systemPrompt: `You are a DeFi operations specialist for Mythic L2.

Your expertise:
- AMM pool management (constant product x*y=k)
- Price syncing between L1 and L2
- Fee collection and distribution (50% validators / 10% foundation / 40% burn)
- Launchpad bonding curves
- DEX API integration

Key MythicSwap details:
- Swap program: 3QB8S38ouuREEDPxnaaGeujLsUhwFoRbLAejKywtEgv7
- Config PDA: 57ftqTCKyRMSijd9c4KFnafuL7qgviQUbaiwWyKKMS99
- Protocol fee: 3 bps, LP fee: 22 bps
- IMPORTANT: Account 7 (protocol_fee_vault) = TOKEN ACCOUNT (ATA of PDA), NOT the PDA
- IMPORTANT: Account 1 (config) = WRITABLE (updates total_volume/fees)
- Pools: MYTH/wSOL, USDC/MYTH, MYTH/wBTC, wETH/MYTH

Always check on-chain state before making claims about pool reserves or prices.`,
  },
  {
    name: 'validator-ops',
    description: 'Validator operations — Firedancer debugging, consensus, genesis, fddev/fdctl configuration',
    systemPrompt: `You are a Firedancer validator operations specialist for Mythic L2.

Your expertise:
- Frankendancer (fddev/fdctl) configuration and debugging
- Genesis creation and modification
- Gossip protocol, QUIC transport, shred repair
- Consensus and vote account management
- Validator monitoring and alerting

Critical rules:
- NEVER add unrecognized keys to fddev config — crash loop = network down
- fddev and fdctl have DIFFERENT config schemas
- rpc.public_address is valid for fdctl ONLY, NOT fddev
- Always verify config keys are valid before editing
- NEVER rebuild genesis without explicit confirmation — resets entire L2
- Start command: sudo fddev dev --no-configure --config fddev-config.toml
- The --no-configure flag is REQUIRED to prevent fddev from overwriting modified genesis`,
  },
  {
    name: 'bridge-security',
    description: 'Bridge operations and security — withdrawal expediting, L1<>L2 state, challenge periods, auditing',
    systemPrompt: `You are a bridge security specialist for Mythic L2.

Your expertise:
- Bridge deposit and withdrawal flows
- Challenge period mechanics (24h default)
- L1 <-> L2 state synchronization
- Withdrawal expediting (admin function)
- Bridge security auditing and attack surface analysis

Bridge configuration:
- L1 Bridge: oEQfREm4FQkaVeRoxJHkJLB1feHprrntY6eJuW2zbqQ
- L2 Bridge: MythBrdgL2111111111111111111111111111111111
- Config PDA: 4A76xw47iNfTkoC5dGSGND5DW5z3E5gPdjPzp8Gnk9s9
- Challenge period: 86,400s (24h)
- Min: 0.01 SOL, Max: 1000 SOL, Daily: 10K SOL
- Sequencer: DLB2NZ5PSNAoChQAaUCBwoHCf6vzeStDa6kCYbB8HjSg

Security checklist for any bridge changes:
1. Verify challenge period is not reduced
2. Check max withdrawal limits
3. Verify admin authority
4. Review nonce sequencing
5. Check for replay attack vectors`,
  },
  {
    name: 'frontend-dev',
    description: 'Frontend development — Next.js 14, Tailwind, TypeScript with Mythic brand guidelines',
    systemPrompt: `You are a frontend development specialist for Mythic L2 web applications.

Your expertise:
- Next.js 14 with App Router
- Tailwind CSS with custom configuration
- TypeScript for type-safe frontend code
- Real-time WebSocket data display
- Responsive design and accessibility

Brand guidelines:
- Primary color: Network Green #39FF14
- Accent: Electric Violet #7B2FFF
- Swap: Amber #FF9500
- Money/Launchpad: Cyan #00E5FF
- Wallet: Rose #FF2D78
- Typography: Sora (display), Inter (body), JetBrains Mono (code)
- Design: Zero border-radius everywhere, glass-morphism cards
- Dark theme by default

Domains:
- mythic.sh (port 3000) — main website + docs + bridge + tokenomics
- mythicswap.app (port 3002) — DEX
- mythic.fun (port 3001) — launchpad
- wallet.mythic.sh (port 3003) — web wallet
- mythic.foundation (port 3004) — DAO governance
- mythiclabs.io (port 3005) — company/tech blog`,
  },
]

// ─── spawn_agent Tool Definition ────────────────────────────────────

export const SPAWN_AGENT_TOOL: Tool = createToolDefinition(
  'spawn_agent',
  'Spawn a specialist agent to handle a subtask autonomously. The agent runs as a separate conversation with its own context and returns a summary of its work.',
  {
    agent_type: {
      type: 'string',
      description: 'Agent type from .wizard/agents/ (e.g., program-engineer, defi-ops, validator-ops, bridge-security, frontend-dev)',
    },
    prompt: {
      type: 'string',
      description: 'Detailed task description for the agent. Be specific about what files to read, what to build, and what output is expected.',
    },
    background: {
      type: 'boolean',
      description: 'Run in background (default: false). Background agents can be checked later with getAgents().',
    },
    model: {
      type: 'string',
      description: 'Optional model override (e.g., claude-sonnet-4-20250514, claude-opus-4-6). Defaults to current session model.',
    },
  },
  ['agent_type', 'prompt'],
)

// ─── AgentRunner Class ──────────────────────────────────────────────

export class AgentRunner {
  private agents: Map<string, AgentStatus> = new Map()
  private agentMessages: Map<string, MessageParam[]> = new Map()
  private backgroundPromises: Map<string, Promise<AgentResult>> = new Map()
  private projectDir: string
  private sessionId: string

  constructor(projectDir?: string, sessionId?: string) {
    this.projectDir = projectDir || process.cwd()
    this.sessionId = sessionId || randomUUID()
  }

  // ─── Load Agent Definitions ───────────────────────────────────

  loadAgents(projectDir?: string): AgentDefinition[] {
    const dir = projectDir || this.projectDir
    const agents: AgentDefinition[] = []

    // Try .wizard/agents/ in the project directory
    const wizardAgentsDir = join(dir, '.wizard', 'agents')
    if (existsSync(wizardAgentsDir)) {
      try {
        const files = readdirSync(wizardAgentsDir).filter(f => f.endsWith('.md'))
        for (const file of files) {
          const content = readFileSync(join(wizardAgentsDir, file), 'utf-8')
          const name = basename(file, '.md')
          const lines = content.split('\n')
          const description = lines[0]?.replace(/^#\s*/, '').trim() || name
          const systemPrompt = lines.slice(1).join('\n').trim()

          agents.push({ name, description, systemPrompt })
        }
      } catch {
        // Fall through to built-ins
      }
    }

    // Try ~/.wizard/agents/ for global agents
    const globalAgentsDir = join(homedir(), '.wizard', 'agents')
    if (existsSync(globalAgentsDir)) {
      try {
        const files = readdirSync(globalAgentsDir).filter(f => f.endsWith('.md'))
        for (const file of files) {
          const name = basename(file, '.md')
          // Skip if already loaded from project dir
          if (agents.some(a => a.name === name)) continue

          const content = readFileSync(join(globalAgentsDir, file), 'utf-8')
          const lines = content.split('\n')
          const description = lines[0]?.replace(/^#\s*/, '').trim() || name
          const systemPrompt = lines.slice(1).join('\n').trim()

          agents.push({ name, description, systemPrompt })
        }
      } catch {
        // Fall through to built-ins
      }
    }

    // Fall back to built-in templates if no custom agents found
    if (agents.length === 0) {
      return [...BUILTIN_AGENTS]
    }

    // Merge: custom agents take priority, add missing built-ins
    for (const builtin of BUILTIN_AGENTS) {
      if (!agents.some(a => a.name === builtin.name)) {
        agents.push(builtin)
      }
    }

    return agents
  }

  // ─── Find Agent Definition by Name ────────────────────────────

  findAgent(name: string): AgentDefinition | undefined {
    const agents = this.loadAgents()
    return agents.find(a =>
      a.name === name ||
      a.name === name.toLowerCase() ||
      a.name.replace(/-/g, '') === name.replace(/-/g, '').toLowerCase()
    )
  }

  // ─── Build Agent System Prompt ────────────────────────────────

  private buildAgentSystemPrompt(definition: AgentDefinition): string {
    const basePrompt = getSystemPrompt()

    return `# Agent: ${definition.name}

${definition.description}

---

${definition.systemPrompt}

---

# Base Context

${basePrompt}

---

# Agent Rules
- You are a specialist agent spawned to handle a specific subtask.
- Complete your task thoroughly, then provide a clear summary of what you did.
- Use tools to verify your work. Read files before editing. Check on-chain state before making claims.
- Be concise but complete in your final output.
- If you encounter errors, diagnose the root cause and report it clearly.
- Do not ask for clarification — work with what you have.
`
  }

  // ─── Filter Tools for Agent ───────────────────────────────────

  private filterTools(tools: Tool[], toolFilter?: string[]): Tool[] {
    if (!toolFilter || toolFilter.length === 0) return tools
    return tools.filter(t => toolFilter.includes(t.name))
  }

  // ─── Save Agent Messages ─────────────────────────────────────

  private saveAgentSession(agentId: string, messages: MessageParam[]): void {
    try {
      const sessionDir = join(this.projectDir, '.wizard', 'sessions', this.sessionId, 'agents')
      mkdirSync(sessionDir, { recursive: true })
      const filePath = join(sessionDir, `${agentId}.jsonl`)
      for (const msg of messages) {
        appendFileSync(filePath, JSON.stringify(msg) + '\n')
      }
    } catch {
      // Session saving is best-effort
    }
  }

  // ─── Load Agent Messages ─────────────────────────────────────

  private loadAgentSession(agentId: string): MessageParam[] | null {
    // Check in-memory first
    const cached = this.agentMessages.get(agentId)
    if (cached) return cached

    // Try loading from disk
    try {
      const filePath = join(this.projectDir, '.wizard', 'sessions', this.sessionId, 'agents', `${agentId}.jsonl`)
      if (!existsSync(filePath)) return null

      const content = readFileSync(filePath, 'utf-8')
      const messages: MessageParam[] = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))

      this.agentMessages.set(agentId, messages)
      return messages
    } catch {
      return null
    }
  }

  // ─── Spawn Agent ──────────────────────────────────────────────

  async spawnAgent(opts: SpawnOpts): Promise<AgentResult> {
    const { definition, prompt, parentMessages, background, model, sessionDir } = opts

    const agentId = randomUUID()
    const startTime = Date.now()

    // Register agent status
    const status: AgentStatus = {
      agentId,
      name: definition.name,
      status: background ? 'background' : 'running',
      startTime,
    }
    this.agents.set(agentId, status)

    // Build the execution function
    const execute = async (): Promise<AgentResult> => {
      try {
        // Build system prompt for this agent
        const systemPrompt = this.buildAgentSystemPrompt(definition)

        // Get tools, optionally filtered
        let tools = getAllTools()
        if (definition.tools && definition.tools.length > 0) {
          tools = this.filterTools(tools, definition.tools)
        }

        // Build initial messages
        const messages: MessageParam[] = []

        // Optionally inject parent context as a system-level user message
        if (parentMessages && parentMessages.length > 0) {
          const contextSummary = this.summarizeParentContext(parentMessages)
          if (contextSummary) {
            messages.push({
              role: 'user',
              content: `[Context from parent conversation]\n${contextSummary}`,
            })
            messages.push({
              role: 'assistant',
              content: 'Understood. I have the context from the parent conversation. I\'ll proceed with the task.',
            })
          }
        }

        // Add the actual task prompt
        messages.push({
          role: 'user',
          content: prompt,
        })

        // Collect output
        let outputBuffer = ''
        let agentToolCalls = 0
        let inputTokens = 0
        let outputTokens = 0

        // Override model if specified
        const cfg = getConfig()
        const originalModel = cfg.model
        if (model || definition.model) {
          (cfg as any).model = model || definition.model
        }

        try {
          const updatedMessages = await streamConversation(
            messages,
            systemPrompt,
            tools,
            {
              onText: (text) => {
                outputBuffer += text
              },
              onToolCall: async (tc: ToolCall) => {
                agentToolCalls++
                // Agents always auto-execute tools (they are sandboxed by scope)
                const result = await executeTool(tc.name, tc.input)
                return result
              },
              onUsage: (input, output) => {
                inputTokens = input
                outputTokens = output
              },
              onComplete: () => {
                // Agent turn complete
              },
              onError: (err) => {
                outputBuffer += `\n[Agent Error: ${err.message}]`
              },
            },
          )

          // Save agent messages
          this.agentMessages.set(agentId, updatedMessages)
          this.saveAgentSession(agentId, updatedMessages)

          const duration = Date.now() - startTime

          // Update status
          const agentStatus = this.agents.get(agentId)!
          agentStatus.status = 'completed'
          agentStatus.duration = duration
          agentStatus.toolCalls = agentToolCalls
          agentStatus.output = outputBuffer.slice(0, 500)

          const result: AgentResult = {
            agentId,
            name: definition.name,
            output: outputBuffer,
            toolCalls: agentToolCalls,
            tokensUsed: { input: inputTokens, output: outputTokens },
            duration,
            status: 'completed',
          }

          return result
        } finally {
          // Restore original model
          if (model || definition.model) {
            (cfg as any).model = originalModel
          }
        }
      } catch (err: any) {
        const duration = Date.now() - startTime

        // Update status
        const agentStatus = this.agents.get(agentId)!
        agentStatus.status = 'error'
        agentStatus.duration = duration

        return {
          agentId,
          name: definition.name,
          output: `Agent error: ${err.message}`,
          toolCalls: 0,
          tokensUsed: { input: 0, output: 0 },
          duration,
          status: 'error',
        }
      }
    }

    // Background execution: store promise and return immediately
    if (background) {
      const promise = execute()
      this.backgroundPromises.set(agentId, promise)

      // Update status when background agent completes
      promise.then(result => {
        const agentStatus = this.agents.get(agentId)
        if (agentStatus) {
          agentStatus.status = result.status === 'error' ? 'error' : 'completed'
          agentStatus.duration = result.duration
          agentStatus.toolCalls = result.toolCalls
          agentStatus.output = result.output.slice(0, 500)
        }
      }).catch(() => {
        const agentStatus = this.agents.get(agentId)
        if (agentStatus) agentStatus.status = 'error'
      })

      return {
        agentId,
        name: definition.name,
        output: `Agent "${definition.name}" spawned in background (id: ${agentId}). Use getAgents() to check status.`,
        toolCalls: 0,
        tokensUsed: { input: 0, output: 0 },
        duration: 0,
        status: 'background',
      }
    }

    // Foreground execution: await and return
    return execute()
  }

  // ─── Spawn Parallel Agents ────────────────────────────────────

  async spawnParallel(agents: SpawnOpts[]): Promise<AgentResult[]> {
    const promises = agents.map(opts => this.spawnAgent(opts))
    return Promise.all(promises)
  }

  // ─── Resume Agent ─────────────────────────────────────────────

  async resumeAgent(agentId: string, prompt: string): Promise<AgentResult> {
    const agentStatus = this.agents.get(agentId)
    if (!agentStatus) {
      return {
        agentId,
        name: 'unknown',
        output: `Agent ${agentId} not found. Available agents: ${Array.from(this.agents.keys()).join(', ') || 'none'}`,
        toolCalls: 0,
        tokensUsed: { input: 0, output: 0 },
        duration: 0,
        status: 'error',
      }
    }

    // If background agent is still running, wait for it first
    const bgPromise = this.backgroundPromises.get(agentId)
    if (bgPromise && agentStatus.status === 'background') {
      await bgPromise
    }

    // Load previous messages
    const previousMessages = this.loadAgentSession(agentId)
    if (!previousMessages) {
      return {
        agentId,
        name: agentStatus.name,
        output: `No saved messages found for agent ${agentId}. Cannot resume.`,
        toolCalls: 0,
        tokensUsed: { input: 0, output: 0 },
        duration: 0,
        status: 'error',
      }
    }

    // Find agent definition
    const definition = this.findAgent(agentStatus.name)
    if (!definition) {
      return {
        agentId,
        name: agentStatus.name,
        output: `Agent definition "${agentStatus.name}" not found. Cannot resume.`,
        toolCalls: 0,
        tokensUsed: { input: 0, output: 0 },
        duration: 0,
        status: 'error',
      }
    }

    const startTime = Date.now()

    // Build system prompt
    const systemPrompt = this.buildAgentSystemPrompt(definition)

    // Get tools
    let tools = getAllTools()
    if (definition.tools && definition.tools.length > 0) {
      tools = this.filterTools(tools, definition.tools)
    }

    // Add new prompt to existing messages
    const messages = [...previousMessages]
    messages.push({ role: 'user', content: prompt })

    let outputBuffer = ''
    let agentToolCalls = 0
    let inputTokens = 0
    let outputTokens = 0

    try {
      const updatedMessages = await streamConversation(
        messages,
        systemPrompt,
        tools,
        {
          onText: (text) => {
            outputBuffer += text
          },
          onToolCall: async (tc: ToolCall) => {
            agentToolCalls++
            return executeTool(tc.name, tc.input)
          },
          onUsage: (input, output) => {
            inputTokens = input
            outputTokens = output
          },
          onComplete: () => {},
          onError: (err) => {
            outputBuffer += `\n[Agent Error: ${err.message}]`
          },
        },
      )

      // Save updated messages
      this.agentMessages.set(agentId, updatedMessages)
      this.saveAgentSession(agentId, updatedMessages)

      const duration = Date.now() - startTime
      agentStatus.status = 'completed'
      agentStatus.duration = (agentStatus.duration || 0) + duration
      agentStatus.toolCalls = (agentStatus.toolCalls || 0) + agentToolCalls

      return {
        agentId,
        name: definition.name,
        output: outputBuffer,
        toolCalls: agentToolCalls,
        tokensUsed: { input: inputTokens, output: outputTokens },
        duration,
        status: 'completed',
      }
    } catch (err: any) {
      const duration = Date.now() - startTime
      agentStatus.status = 'error'

      return {
        agentId,
        name: definition.name,
        output: `Resume error: ${err.message}`,
        toolCalls: 0,
        tokensUsed: { input: 0, output: 0 },
        duration,
        status: 'error',
      }
    }
  }

  // ─── Get Agent Statuses ───────────────────────────────────────

  getAgents(): AgentStatus[] {
    return Array.from(this.agents.values())
  }

  // ─── Get Background Agent Result ──────────────────────────────

  async getBackgroundResult(agentId: string): Promise<AgentResult | null> {
    const promise = this.backgroundPromises.get(agentId)
    if (!promise) return null
    return promise
  }

  // ─── Execute spawn_agent Tool Call ────────────────────────────

  async executeSpawnAgent(input: {
    agent_type: string
    prompt: string
    background?: boolean
    model?: string
  }): Promise<string> {
    const definition = this.findAgent(input.agent_type)
    if (!definition) {
      const available = this.loadAgents().map(a => a.name).join(', ')
      return `Error: Unknown agent type "${input.agent_type}". Available agents: ${available || 'none'}`
    }

    const result = await this.spawnAgent({
      definition,
      prompt: input.prompt,
      background: input.background || false,
      model: input.model,
    })

    if (result.status === 'background') {
      return result.output
    }

    // Format the result for the parent conversation
    const durationStr = result.duration < 1000
      ? `${result.duration}ms`
      : `${(result.duration / 1000).toFixed(1)}s`

    return `[Agent: ${result.name} | Status: ${result.status} | Tools: ${result.toolCalls} | Duration: ${durationStr} | Tokens: ${result.tokensUsed.input}in/${result.tokensUsed.output}out]

${result.output}`
  }

  // ─── Worktree Isolation ───────────────────────────────────────

  async spawnWithWorktree(opts: SpawnOpts): Promise<AgentResult & { worktreePath?: string; branch?: string }> {
    const agentId = randomUUID()
    const branchName = `wizard-agent-${agentId.slice(0, 8)}`
    const worktreePath = join('/tmp', `wizard-wt-${agentId.slice(0, 8)}`)

    try {
      // Create git worktree
      const { execSync } = await import('child_process')
      execSync(`git worktree add ${worktreePath} -b ${branchName}`, {
        cwd: this.projectDir,
        stdio: 'pipe',
      })

      // Spawn agent with cwd set to worktree
      // Override bash tool cwd by setting in the agent prompt
      const modifiedPrompt = `Working directory: ${worktreePath}

IMPORTANT: All file operations and bash commands should use absolute paths within ${worktreePath}. You are working in a git worktree isolation branch: ${branchName}.

${opts.prompt}`

      const result = await this.spawnAgent({
        ...opts,
        prompt: modifiedPrompt,
      })

      // Check if agent made any changes
      const status = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim()

      if (!status) {
        // No changes — clean up worktree
        execSync(`git worktree remove ${worktreePath}`, {
          cwd: this.projectDir,
          stdio: 'pipe',
        })
        execSync(`git branch -d ${branchName}`, {
          cwd: this.projectDir,
          stdio: 'pipe',
        })
        return { ...result }
      }

      // Changes exist — commit and return path + branch
      execSync('git add -A && git commit -m "Agent work: ' + opts.definition.name + '"', {
        cwd: worktreePath,
        stdio: 'pipe',
      })

      return {
        ...result,
        worktreePath,
        branch: branchName,
      }
    } catch (err: any) {
      // Clean up on error
      try {
        const { execSync } = await import('child_process')
        execSync(`git worktree remove ${worktreePath} --force`, {
          cwd: this.projectDir,
          stdio: 'pipe',
        })
        execSync(`git branch -D ${branchName}`, {
          cwd: this.projectDir,
          stdio: 'pipe',
        })
      } catch {
        // Cleanup is best-effort
      }

      return {
        agentId,
        name: opts.definition.name,
        output: `Worktree error: ${err.message}`,
        toolCalls: 0,
        tokensUsed: { input: 0, output: 0 },
        duration: 0,
        status: 'error',
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private summarizeParentContext(messages: MessageParam[]): string {
    // Extract the last few meaningful messages for context
    const recent = messages.slice(-6)
    const parts: string[] = []

    for (const msg of recent) {
      if (typeof msg.content === 'string') {
        parts.push(`[${msg.role}]: ${msg.content.slice(0, 500)}`)
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ('text' in block && typeof block.text === 'string') {
            parts.push(`[${msg.role}]: ${block.text.slice(0, 500)}`)
          }
        }
      }
    }

    return parts.join('\n\n')
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let _runner: AgentRunner | null = null

export function getAgentRunner(projectDir?: string, sessionId?: string): AgentRunner {
  if (!_runner) {
    _runner = new AgentRunner(projectDir, sessionId)
  }
  return _runner
}

export function resetAgentRunner(): void {
  _runner = null
}
