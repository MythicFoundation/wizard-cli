import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { WIZARD_DIR, SESSIONS_DIR } from '../config/constants.js'

// ─── Types ──────────────────────────────────────────────────────────

export interface SessionStats {
  inputTokens: number
  outputTokens: number
  cost: number
  turns: number
  toolCalls: number
}

export interface Session {
  id: string
  startTime: number
  projectPath: string
  messages: MessageParam[]
  stats: SessionStats
}

export interface SessionSummary {
  id: string
  startTime: number
  projectPath: string
  turns: number
  toolCalls: number
  cost: number
  firstMessage: string
  lastMessage: string
}

// ─── Session Manager ────────────────────────────────────────────────

export class SessionManager {
  private session: Session
  private sessionsDir: string

  constructor(projectPath?: string) {
    const projPath = projectPath || process.cwd()
    this.sessionsDir = path.join(projPath, WIZARD_DIR, SESSIONS_DIR)

    this.session = {
      id: randomUUID(),
      startTime: Date.now(),
      projectPath: projPath,
      messages: [],
      stats: {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        turns: 0,
        toolCalls: 0,
      },
    }
  }

  /** Get the current session */
  getSession(): Session {
    return this.session
  }

  /** Get the current session ID */
  getSessionId(): string {
    return this.session.id
  }

  /** Ensure the sessions directory exists */
  private ensureDir(): void {
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true })
    }
  }

  /** Get the file path for a session */
  private getSessionPath(sessionId?: string): string {
    return path.join(this.sessionsDir, `${sessionId || this.session.id}.jsonl`)
  }

  /** Append a message to the session transcript (append-only JSONL) */
  appendMessage(message: MessageParam): void {
    this.session.messages.push(message)

    this.ensureDir()
    const entry = JSON.stringify({
      timestamp: Date.now(),
      sessionId: this.session.id,
      message,
    })
    appendFileSync(this.getSessionPath(), entry + '\n', 'utf-8')
  }

  /** Update session stats */
  updateStats(updates: Partial<SessionStats>): void {
    Object.assign(this.session.stats, {
      inputTokens: (this.session.stats.inputTokens || 0) + (updates.inputTokens || 0),
      outputTokens: (this.session.stats.outputTokens || 0) + (updates.outputTokens || 0),
      cost: (this.session.stats.cost || 0) + (updates.cost || 0),
      turns: updates.turns !== undefined ? (this.session.stats.turns || 0) + updates.turns : this.session.stats.turns,
      toolCalls: updates.toolCalls !== undefined ? (this.session.stats.toolCalls || 0) + updates.toolCalls : this.session.stats.toolCalls,
    })
  }

  /** Load and resume a previous session by ID */
  static loadSession(projectPath: string, sessionId: string): Session | null {
    const sessionsDir = path.join(projectPath, WIZARD_DIR, SESSIONS_DIR)
    const sessionPath = path.join(sessionsDir, `${sessionId}.jsonl`)

    if (!existsSync(sessionPath)) {
      return null
    }

    const lines = readFileSync(sessionPath, 'utf-8').trim().split('\n').filter(Boolean)
    const messages: MessageParam[] = []
    let startTime = Date.now()

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.message) {
          messages.push(entry.message)
        }
        if (entry.timestamp && messages.length === 1) {
          startTime = entry.timestamp
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (messages.length === 0) {
      return null
    }

    return {
      id: sessionId,
      startTime,
      projectPath,
      messages,
      stats: {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        turns: Math.floor(messages.filter(m => m.role === 'user').length),
        toolCalls: 0,
      },
    }
  }

  /** Resume a session — sets the current session to a previously loaded one */
  resumeSession(session: Session): void {
    this.session = session
  }

  /** List all sessions with summaries */
  static listSessions(projectPath: string): SessionSummary[] {
    const sessionsDir = path.join(projectPath, WIZARD_DIR, SESSIONS_DIR)

    if (!existsSync(sessionsDir)) {
      return []
    }

    const files = readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse() // newest first

    const summaries: SessionSummary[] = []

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')
      const filePath = path.join(sessionsDir, file)

      try {
        const content = readFileSync(filePath, 'utf-8').trim()
        if (!content) continue

        const lines = content.split('\n').filter(Boolean)
        let startTime = Date.now()
        let turns = 0
        let firstMessage = ''
        let lastMessage = ''

        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (entry.timestamp && !firstMessage) {
              startTime = entry.timestamp
            }
            if (entry.message?.role === 'user') {
              turns++
              const content = typeof entry.message.content === 'string'
                ? entry.message.content
                : JSON.stringify(entry.message.content)
              if (!firstMessage) firstMessage = content.slice(0, 100)
              lastMessage = content.slice(0, 100)
            }
          } catch {
            // Skip malformed lines
          }
        }

        summaries.push({
          id: sessionId,
          startTime,
          projectPath,
          turns,
          toolCalls: 0,
          cost: 0,
          firstMessage,
          lastMessage,
        })
      } catch {
        // Skip unreadable files
      }
    }

    return summaries
  }

  /** Estimate token count from messages (rough: chars / 4) */
  estimateTokenCount(): number {
    let totalChars = 0
    for (const msg of this.session.messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ('text' in block && typeof block.text === 'string') {
            totalChars += block.text.length
          } else {
            totalChars += JSON.stringify(block).length
          }
        }
      }
    }
    return Math.ceil(totalChars / 4)
  }

  /** Check if the session needs compression (>150K estimated tokens) */
  needsCompression(): boolean {
    return this.estimateTokenCount() > 150_000
  }

  /**
   * Compress old messages by replacing them with a summary.
   * Returns the messages that should be summarized (all except last 4).
   * The caller should send these to Claude for summarization, then call
   * `applySummary()` with the result.
   */
  getMessagesForCompression(): MessageParam[] | null {
    if (this.session.messages.length <= 4) {
      return null
    }
    return this.session.messages.slice(0, -4)
  }

  /**
   * Apply a conversation summary, replacing old messages with the summary.
   * Keeps the last 4 messages intact.
   */
  applySummary(summary: string): void {
    const recentMessages = this.session.messages.slice(-4)
    this.session.messages = [
      { role: 'user', content: `[Previous conversation summary]\n${summary}` },
      { role: 'assistant', content: 'Understood. I have the context from our previous conversation. How can I help?' },
      ...recentMessages,
    ]

    // Log compression event
    this.ensureDir()
    const entry = JSON.stringify({
      timestamp: Date.now(),
      sessionId: this.session.id,
      type: 'compression',
      summary,
    })
    appendFileSync(this.getSessionPath(), entry + '\n', 'utf-8')
  }
}
