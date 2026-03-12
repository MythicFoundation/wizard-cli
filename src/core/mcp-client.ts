// MCP Client — Connects to Model Context Protocol servers for tool discovery and execution.
// Implements a minimal stdio JSON-RPC client following the MCP protocol spec.
// Tools are exposed in Anthropic Tool[] format with `mcp__<server>__<tool>` naming convention.

import { spawn, type ChildProcess } from 'child_process'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

// ─── Types ──────────────────────────────────────────────────────────

export interface McpServerConfig {
  type: 'stdio' | 'sse'
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface McpResource {
  server: string
  uri: string
  name?: string
  mimeType?: string
}

interface PendingRequest {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

// ─── Stdio MCP Connection ───────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000
const INITIALIZE_TIMEOUT_MS = 15_000

class StdioMcpConnection {
  private process: ChildProcess | null = null
  private pendingRequests: Map<number, PendingRequest> = new Map()
  private nextId = 1
  private buffer = ''
  private tools: McpTool[] = []
  private resources: McpResource[] = []
  private serverName: string
  private connected = false

  constructor(
    private command: string,
    private args: string[],
    private env?: Record<string, string>,
    serverName?: string,
  ) {
    this.serverName = serverName || command
  }

  /**
   * Spawn the process, send initialize, and list tools.
   */
  async connect(): Promise<void> {
    const spawnEnv = { ...process.env, ...(this.env || {}) }

    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv,
      shell: false,
    })

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error(`Failed to spawn MCP server: ${this.command}`)
    }

    // Parse stdout line-by-line for JSON-RPC responses
    this.process.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8')
      this.processBuffer()
    })

    this.process.stderr?.on('data', (chunk: Buffer) => {
      // Log stderr at debug level — MCP servers often emit logs here
      const msg = chunk.toString('utf-8').trim()
      if (msg) {
        // Silently capture; callers can check server health
      }
    })

    this.process.on('error', (err) => {
      this.connected = false
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer)
        pending.reject(new Error(`MCP server process error: ${err.message}`))
      }
      this.pendingRequests.clear()
    })

    this.process.on('exit', (code) => {
      this.connected = false
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer)
        pending.reject(new Error(`MCP server exited with code ${code}`))
      }
      this.pendingRequests.clear()
    })

    // Send initialize
    await this.initialize()
    this.connected = true

    // List tools
    this.tools = await this.listTools()
  }

  /**
   * Send the MCP initialize handshake.
   */
  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: false },
      },
      clientInfo: {
        name: 'wizard-cli',
        version: '0.2.0',
      },
    }, INITIALIZE_TIMEOUT_MS)

    // Send initialized notification (no response expected)
    this.sendNotification('notifications/initialized', {})

    return result
  }

  /**
   * List tools from the MCP server.
   */
  async listTools(): Promise<McpTool[]> {
    const result = await this.sendRequest('tools/list', {})
    return result?.tools || []
  }

  /**
   * Call a tool on this MCP server.
   */
  async callTool(name: string, args: any): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args || {},
    })
    return result
  }

  /**
   * List resources from the MCP server.
   */
  async listResources(): Promise<McpResource[]> {
    try {
      const result = await this.sendRequest('resources/list', {})
      return (result?.resources || []).map((r: any) => ({
        server: this.serverName,
        uri: r.uri,
        name: r.name,
        mimeType: r.mimeType,
      }))
    } catch {
      // resources/list may not be supported
      return []
    }
  }

  /**
   * Get the discovered tools.
   */
  getTools(): McpTool[] {
    return this.tools
  }

  /**
   * Check if the connection is alive.
   */
  isConnected(): boolean {
    return this.connected && this.process !== null && this.process.exitCode === null
  }

  /**
   * Kill the spawned process and clean up.
   */
  disconnect(): void {
    this.connected = false

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    if (this.process) {
      this.process.stdin?.end()
      this.process.kill('SIGTERM')

      // Force kill after 2s if still alive
      const proc = this.process
      setTimeout(() => {
        if (proc.exitCode === null) {
          proc.kill('SIGKILL')
        }
      }, 2000)

      this.process = null
    }
  }

  // ─── JSON-RPC Transport ─────────────────────────────────────────

  private sendRequest(method: string, params: any, timeout = REQUEST_TIMEOUT_MS): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('MCP server stdin not writable'))
        return
      }

      const id = this.nextId++
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      })

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`MCP request timed out after ${timeout}ms: ${method}`))
      }, timeout)

      this.pendingRequests.set(id, { resolve, reject, timer })

      this.process.stdin.write(message + '\n')
    })
  }

  private sendNotification(method: string, params: any): void {
    if (!this.process?.stdin?.writable) return

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    })

    this.process.stdin.write(message + '\n')
  }

  private processBuffer(): void {
    // MCP uses newline-delimited JSON-RPC messages
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const msg = JSON.parse(trimmed)
        this.handleMessage(msg)
      } catch {
        // Not valid JSON — skip (could be a log line or partial message)
      }
    }
  }

  private handleMessage(msg: any): void {
    // JSON-RPC response (has id)
    if (msg.id !== undefined && msg.id !== null) {
      const pending = this.pendingRequests.get(msg.id)
      if (pending) {
        this.pendingRequests.delete(msg.id)
        clearTimeout(pending.timer)

        if (msg.error) {
          pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`))
        } else {
          pending.resolve(msg.result)
        }
      }
    }
    // Notifications (no id) — we ignore them for now
  }
}

// ─── MCP Client ─────────────────────────────────────────────────────

export class McpClient {
  private servers: Map<string, StdioMcpConnection> = new Map()

  /**
   * Connect to all MCP servers defined in configuration.
   * If a server fails to connect, logs a warning and continues with the rest.
   */
  async connectAll(config: Record<string, McpServerConfig>): Promise<void> {
    const connectPromises: Promise<void>[] = []

    for (const [name, serverConfig] of Object.entries(config)) {
      if (serverConfig.type !== 'stdio') {
        console.warn(`[mcp] Skipping "${name}": only stdio transport is supported`)
        continue
      }

      const connection = new StdioMcpConnection(
        serverConfig.command,
        serverConfig.args,
        serverConfig.env,
        name,
      )

      connectPromises.push(
        connection.connect()
          .then(() => {
            this.servers.set(name, connection)
            const toolCount = connection.getTools().length
            if (toolCount > 0) {
              // Successfully connected — tools are discoverable
            }
          })
          .catch((err) => {
            console.warn(`[mcp] Failed to connect to "${name}": ${err.message}`)
          }),
      )
    }

    await Promise.all(connectPromises)
  }

  /**
   * Get all tools from all connected MCP servers in Anthropic Tool[] format.
   * Tool names are prefixed: `mcp__<serverName>__<toolName>`
   */
  getTools(): Tool[] {
    const tools: Tool[] = []

    for (const [serverName, connection] of this.servers) {
      if (!connection.isConnected()) continue

      for (const mcpTool of connection.getTools()) {
        const prefixedName = `mcp__${serverName}__${mcpTool.name}`

        // Convert MCP tool schema to Anthropic tool format
        const inputSchema = mcpTool.inputSchema || {
          type: 'object' as const,
          properties: {},
        }

        tools.push({
          name: prefixedName,
          description: mcpTool.description || `MCP tool: ${mcpTool.name} (via ${serverName})`,
          input_schema: {
            type: 'object',
            properties: inputSchema.properties || {},
            required: inputSchema.required || [],
          },
        })
      }
    }

    return tools
  }

  /**
   * Execute a tool by its full prefixed name: `mcp__<server>__<tool>`
   * Parses the prefix to route to the correct MCP server.
   */
  async executeTool(fullToolName: string, input: any): Promise<string> {
    const parts = fullToolName.split('__')
    if (parts.length < 3 || parts[0] !== 'mcp') {
      return `Error: Invalid MCP tool name format "${fullToolName}". Expected "mcp__<server>__<tool>".`
    }

    const serverName = parts[1]
    const toolName = parts.slice(2).join('__') // tool name could contain __

    const connection = this.servers.get(serverName)
    if (!connection) {
      return `Error: MCP server "${serverName}" not found. Connected servers: ${[...this.servers.keys()].join(', ') || 'none'}`
    }

    if (!connection.isConnected()) {
      return `Error: MCP server "${serverName}" is disconnected.`
    }

    try {
      const result = await connection.callTool(toolName, input)

      // MCP tool results can be in various formats
      if (!result) return ''

      // Standard MCP result has content array
      if (Array.isArray(result.content)) {
        return result.content
          .map((block: any) => {
            if (block.type === 'text') return block.text
            if (block.type === 'resource') return `[Resource: ${block.resource?.uri || 'unknown'}]`
            return JSON.stringify(block)
          })
          .join('\n')
      }

      // Raw result — stringify
      if (typeof result === 'string') return result
      return JSON.stringify(result, null, 2)
    } catch (err: any) {
      return `Error calling MCP tool "${toolName}" on "${serverName}": ${err.message}`
    }
  }

  /**
   * List all resources from all connected MCP servers.
   */
  listResources(): { server: string; resources: string[] }[] {
    const result: { server: string; resources: string[] }[] = []

    for (const [serverName, connection] of this.servers) {
      if (!connection.isConnected()) continue

      // Resources are fetched lazily — we return what we have
      // Full resource listing requires async call; callers should use listResourcesAsync
      result.push({
        server: serverName,
        resources: [], // populated by listResourcesAsync
      })
    }

    return result
  }

  /**
   * Async version of listResources that actually queries MCP servers.
   */
  async listResourcesAsync(): Promise<{ server: string; resources: McpResource[] }[]> {
    const results: { server: string; resources: McpResource[] }[] = []

    for (const [serverName, connection] of this.servers) {
      if (!connection.isConnected()) continue

      try {
        const resources = await connection.listResources()
        results.push({ server: serverName, resources })
      } catch {
        results.push({ server: serverName, resources: [] })
      }
    }

    return results
  }

  /**
   * Disconnect all MCP servers and kill spawned processes.
   */
  async disconnectAll(): Promise<void> {
    for (const [name, connection] of this.servers) {
      connection.disconnect()
    }
    this.servers.clear()
  }

  /**
   * Check if a tool name is an MCP tool (prefixed with mcp__).
   */
  static isMcpTool(toolName: string): boolean {
    return toolName.startsWith('mcp__')
  }

  /**
   * Get connection status summary for all servers.
   */
  getStatus(): { name: string; connected: boolean; toolCount: number }[] {
    const status: { name: string; connected: boolean; toolCount: number }[] = []
    for (const [name, connection] of this.servers) {
      status.push({
        name,
        connected: connection.isConnected(),
        toolCount: connection.getTools().length,
      })
    }
    return status
  }

  /**
   * Get the number of connected servers.
   */
  get serverCount(): number {
    return this.servers.size
  }

  /**
   * Get the total number of tools across all servers.
   */
  get toolCount(): number {
    let count = 0
    for (const connection of this.servers.values()) {
      if (connection.isConnected()) {
        count += connection.getTools().length
      }
    }
    return count
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

/** Global MCP client instance */
export const mcpClient = new McpClient()
