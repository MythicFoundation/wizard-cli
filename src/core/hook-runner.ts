// Hook Runner — Pre/post hooks for tool calls and messages.
// Hooks are defined in .wizard/settings.json and execute shell commands
// with context passed via environment variables.

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'

// ─── Types ──────────────────────────────────────────────────────────

export type HookEvent = 'pre_tool_call' | 'post_tool_call' | 'pre_message' | 'post_message'

export interface Hook {
  event: HookEvent
  command: string      // Shell command to execute
  match?: string       // Optional tool name pattern (glob-like)
  timeout?: number     // Timeout in ms (default: 10000)
}

export interface HookContext {
  toolName?: string
  input?: any
  output?: string
}

export interface HookResult {
  allowed: boolean     // false if hook exited non-zero
  output: string       // stdout from hook execution
}

// ─── Pattern Matching ───────────────────────────────────────────────

/**
 * Match a tool name against a hook's match pattern.
 * Supports:
 *   - "*" matches everything
 *   - "bash" exact match
 *   - "solana_*" prefix match
 *   - "*_status" suffix match
 */
function matchesHookPattern(toolName: string | undefined, pattern: string | undefined): boolean {
  // No pattern means match everything
  if (!pattern) return true
  // No tool name but pattern exists — no match
  if (!toolName) return false

  if (pattern === '*') return true
  if (pattern === toolName) return true

  // Prefix: "solana_*"
  if (pattern.endsWith('*') && !pattern.startsWith('*')) {
    return toolName.startsWith(pattern.slice(0, -1))
  }

  // Suffix: "*_status"
  if (pattern.startsWith('*') && !pattern.endsWith('*')) {
    return toolName.endsWith(pattern.slice(1))
  }

  // Contains: "*tool*"
  if (pattern.startsWith('*') && pattern.endsWith('*') && pattern.length > 2) {
    return toolName.includes(pattern.slice(1, -1))
  }

  return false
}

// ─── Hook Runner ────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000

export class HookRunner {
  private hooks: Hook[] = []

  /**
   * Load hooks from a settings file.
   * Expected format in .wizard/settings.json:
   *
   * ```json
   * {
   *   "hooks": [
   *     { "event": "pre_tool_call", "match": "bash", "command": "echo $WIZARD_TOOL_INPUT | check-safety" },
   *     { "event": "post_message", "command": "echo done" }
   *   ]
   * }
   * ```
   *
   * Also supports the nested format:
   * ```json
   * {
   *   "hooks": {
   *     "pre_tool_call": [
   *       { "match": "bash", "command": "..." }
   *     ]
   *   }
   * }
   * ```
   */
  loadHooks(settingsPath: string): void {
    if (!existsSync(settingsPath)) return

    try {
      const raw = readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(raw)

      if (!settings.hooks) return

      // Array format
      if (Array.isArray(settings.hooks)) {
        for (const hook of settings.hooks) {
          if (this.isValidHook(hook)) {
            this.hooks.push({
              event: hook.event,
              command: hook.command,
              match: hook.match,
              timeout: hook.timeout,
            })
          }
        }
        return
      }

      // Object format: { pre_tool_call: [...], post_tool_call: [...] }
      if (typeof settings.hooks === 'object') {
        for (const [event, hookList] of Object.entries(settings.hooks)) {
          if (!Array.isArray(hookList)) continue
          if (!isValidEvent(event)) continue

          for (const hook of hookList) {
            if (typeof hook === 'object' && hook !== null && typeof (hook as any).command === 'string') {
              this.hooks.push({
                event: event as HookEvent,
                command: (hook as any).command,
                match: (hook as any).match,
                timeout: (hook as any).timeout,
              })
            }
          }
        }
      }
    } catch {
      // Silently ignore malformed settings
    }
  }

  /**
   * Run all hooks matching the given event and context.
   *
   * Context is passed to hook commands via environment variables:
   *   - WIZARD_EVENT: the hook event name
   *   - WIZARD_TOOL_NAME: the tool name (for tool call events)
   *   - WIZARD_TOOL_INPUT: JSON-encoded tool input (for pre_tool_call)
   *   - WIZARD_TOOL_OUTPUT: tool output (for post_tool_call, truncated to 10K chars)
   *
   * If any hook exits with non-zero status, returns { allowed: false }.
   * All hook stdout is concatenated into the output field.
   */
  async run(event: string, context: HookContext): Promise<HookResult> {
    const matchingHooks = this.hooks.filter((h) => {
      if (h.event !== event) return false
      if (h.match && !matchesHookPattern(context.toolName, h.match)) return false
      return true
    })

    if (matchingHooks.length === 0) {
      return { allowed: true, output: '' }
    }

    const outputs: string[] = []
    let allowed = true

    for (const hook of matchingHooks) {
      const timeout = hook.timeout || DEFAULT_TIMEOUT_MS

      // Build environment with context
      const hookEnv: Record<string, string> = {
        ...process.env as Record<string, string>,
        WIZARD_EVENT: event,
      }

      if (context.toolName) {
        hookEnv.WIZARD_TOOL_NAME = context.toolName
      }

      if (context.input !== undefined) {
        try {
          hookEnv.WIZARD_TOOL_INPUT = typeof context.input === 'string'
            ? context.input
            : JSON.stringify(context.input)
        } catch {
          hookEnv.WIZARD_TOOL_INPUT = String(context.input)
        }
      }

      if (context.output !== undefined) {
        // Truncate output to prevent env var size limits
        hookEnv.WIZARD_TOOL_OUTPUT = context.output.slice(0, 10_000)
      }

      try {
        const stdout = execSync(hook.command, {
          timeout,
          env: hookEnv,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: '/bin/sh',
        })

        if (stdout) {
          outputs.push(stdout.trim())
        }
      } catch (err: any) {
        // Non-zero exit code means the hook is blocking the action
        allowed = false

        // Capture any stdout/stderr from the failed hook
        if (err.stdout) outputs.push(err.stdout.toString().trim())
        if (err.stderr) outputs.push(`Hook error: ${err.stderr.toString().trim()}`)
        if (!err.stdout && !err.stderr) {
          outputs.push(`Hook "${hook.command}" failed with exit code ${err.status ?? 'unknown'}`)
        }

        // Stop executing further hooks if one blocks
        break
      }
    }

    return {
      allowed,
      output: outputs.join('\n'),
    }
  }

  /**
   * Get the number of loaded hooks.
   */
  get count(): number {
    return this.hooks.length
  }

  /**
   * Get all loaded hooks (for debugging/display).
   */
  getHooks(): ReadonlyArray<Hook> {
    return this.hooks
  }

  /**
   * Check if there are any hooks for a given event type.
   */
  hasHooks(event: HookEvent): boolean {
    return this.hooks.some((h) => h.event === event)
  }

  /**
   * Clear all loaded hooks.
   */
  clear(): void {
    this.hooks = []
  }

  // ─── Private ──────────────────────────────────────────────────────

  private isValidHook(hook: any): hook is Hook {
    return (
      typeof hook === 'object' &&
      hook !== null &&
      typeof hook.event === 'string' &&
      isValidEvent(hook.event) &&
      typeof hook.command === 'string' &&
      hook.command.length > 0
    )
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

const VALID_EVENTS = new Set<string>(['pre_tool_call', 'post_tool_call', 'pre_message', 'post_message'])

function isValidEvent(event: string): event is HookEvent {
  return VALID_EVENTS.has(event)
}

// ─── Singleton ──────────────────────────────────────────────────────

/** Global hook runner instance */
export const hookRunner = new HookRunner()
