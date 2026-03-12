// Plan Mode — Read-only planning phase where the model creates a plan before executing.
// Only safe/read tools are allowed; the model writes a plan to .wizard/plans/<name>.md.
// The user reviews and approves the plan, then exits plan mode to begin execution.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { CONFIG_DIR } from '../config/constants.js'

// ─── Allowed Tools in Plan Mode ─────────────────────────────────────

/** Tools that are permitted while plan mode is active */
const PLAN_MODE_ALLOWED_TOOLS = new Set([
  // Read/search tools
  'read_file',
  'glob_files',
  'grep',
  'list_directory',

  // Web tools (read-only)
  'web_fetch',
  'web_search',

  // Solana read tools
  'solana_balance',
  'solana_account_info',

  // Mythic read tools
  'mythic_network_status',
  'mythic_supply',

  // Memory tools
  'write_memory',
  'search_memory',

  // Agent spawning (plan subagent only)
  'spawn_agent',
])

// ─── Plan Mode ──────────────────────────────────────────────────────

export class PlanMode {
  private _active: boolean = false
  private _planFile: string = ''

  /**
   * Whether plan mode is currently active.
   */
  get active(): boolean {
    return this._active
  }

  /**
   * The path to the current plan file, or empty string if none.
   */
  get planFile(): string {
    return this._planFile
  }

  /**
   * Enter plan mode. Creates the plans directory and optionally sets a named plan file.
   *
   * @param planFile - Optional plan name (defaults to timestamp-based name).
   *                   Stored at `.wizard/plans/<name>.md`
   */
  enter(planFile?: string): void {
    this._active = true

    const plansDir = join(process.cwd(), CONFIG_DIR, 'plans')
    if (!existsSync(plansDir)) {
      mkdirSync(plansDir, { recursive: true })
    }

    if (planFile) {
      // Normalize: strip path separators, ensure .md extension
      const safeName = basename(planFile).replace(/[^a-zA-Z0-9_-]/g, '-')
      const name = safeName.endsWith('.md') ? safeName : `${safeName}.md`
      this._planFile = join(plansDir, name)
    } else {
      // Generate timestamp-based plan file
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      this._planFile = join(plansDir, `plan-${ts}.md`)
    }
  }

  /**
   * Exit plan mode. The plan file remains on disk for reference.
   */
  exit(): void {
    this._active = false
    // Plan file path is kept so it can be referenced after exit
  }

  /**
   * Check whether a given tool is allowed in plan mode.
   * Only read-only and analysis tools are permitted.
   */
  isToolAllowed(toolName: string): boolean {
    if (!this._active) return true // not in plan mode — everything allowed
    return PLAN_MODE_ALLOWED_TOOLS.has(toolName)
  }

  /**
   * Write content to the current plan file.
   * This is the ONE write operation allowed in plan mode.
   */
  writePlan(content: string): void {
    if (!this._planFile) {
      throw new Error('No plan file set. Call enter() first.')
    }

    // Ensure the plans directory exists
    const plansDir = join(process.cwd(), CONFIG_DIR, 'plans')
    if (!existsSync(plansDir)) {
      mkdirSync(plansDir, { recursive: true })
    }

    writeFileSync(this._planFile, content, 'utf-8')
  }

  /**
   * Read the current plan file contents, or null if it doesn't exist.
   */
  readPlan(): string | null {
    if (!this._planFile || !existsSync(this._planFile)) {
      return null
    }
    return readFileSync(this._planFile, 'utf-8')
  }

  /**
   * Get a summary of plan mode state for display.
   */
  getSummary(): { active: boolean; planFile: string | null; planExists: boolean } {
    return {
      active: this._active,
      planFile: this._planFile || null,
      planExists: this._planFile ? existsSync(this._planFile) : false,
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

/** Global plan mode instance */
export const planMode = new PlanMode()
