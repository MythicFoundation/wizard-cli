// Permission Manager — Controls tool execution authorization
// Modes mirror Claude Code's permission system, with blockchain-aware defaults.

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { CONFIG_DIR } from '../config/constants.js'

// ─── Types ──────────────────────────────────────────────────────────

export type PermissionMode = 'default' | 'auto' | 'plan' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk'

export type PermissionResult = 'allow' | 'deny' | 'ask'

export interface PermissionSettings {
  mode: PermissionMode
  allow: string[]
  deny: string[]
}

// ─── Tool Classifications ───────────────────────────────────────────

/** Read-only tools that are safe to auto-allow in default and plan modes */
const READ_TOOLS = new Set([
  'read_file',
  'glob_files',
  'grep',
  'list_directory',
  'web_fetch',
  'web_search',
  'solana_balance',
  'solana_account_info',
  'solana_token_accounts',
  'solana_transaction',
  'solana_recent_transactions',
  'solana_program_accounts',
  'solana_network_status',
  'mythic_network_status',
  'mythic_supply',
  'mythic_validators',
  'mythic_swap_pools',
  'mythic_program_list',
  'mythic_wallet_overview',
  'mythic_bridge_status',
  'mythic_token_info',
])

/** File edit tools allowed in acceptEdits mode (in addition to read tools) */
const EDIT_TOOLS = new Set([
  'write_file',
  'edit_file',
])

/** Dangerous tools that always require confirmation in default mode */
const DANGEROUS_TOOLS = new Set([
  'bash',
  'solana_transfer',
  'solana_deploy_program',
  'solana_airdrop',
  'solana_keygen',
  'mythic_deploy_validator',
  'write_file',
  'edit_file',
])

// ─── Glob Pattern Matching ──────────────────────────────────────────

/**
 * Simple glob matching for allow/deny patterns.
 * Supports:
 *   - "mythic_*" — startsWith match
 *   - "*_status" — endsWith match
 *   - "*" — matches everything
 *   - exact names — "bash", "read_file"
 */
function matchesPattern(toolName: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern === toolName) return true

  // "mythic_*" → startsWith
  if (pattern.endsWith('*') && !pattern.startsWith('*')) {
    return toolName.startsWith(pattern.slice(0, -1))
  }

  // "*_status" → endsWith
  if (pattern.startsWith('*') && !pattern.endsWith('*')) {
    return toolName.endsWith(pattern.slice(1))
  }

  // "*foo*" → contains
  if (pattern.startsWith('*') && pattern.endsWith('*') && pattern.length > 2) {
    return toolName.includes(pattern.slice(1, -1))
  }

  return false
}

// ─── Permission Manager ────────────────────────────────────────────

export class PermissionManager {
  private mode: PermissionMode
  private allowList: Set<string>   // tool names or glob patterns
  private denyList: Set<string>    // tool names or glob patterns

  constructor(mode: PermissionMode = 'default') {
    this.mode = mode
    this.allowList = new Set()
    this.denyList = new Set()
  }

  /**
   * Check whether a tool call should be allowed, denied, or needs user confirmation.
   *
   * Evaluation order:
   * 1. Deny list (explicit deny always wins)
   * 2. Allow list (explicit allow overrides mode)
   * 3. Mode-based rules
   */
  checkPermission(toolName: string, input?: any): PermissionResult {
    // 1. Explicit deny list — always deny
    for (const pattern of this.denyList) {
      if (matchesPattern(toolName, pattern)) {
        return 'deny'
      }
    }

    // 2. Explicit allow list — always allow
    for (const pattern of this.allowList) {
      if (matchesPattern(toolName, pattern)) {
        return 'allow'
      }
    }

    // 3. Mode-based rules
    switch (this.mode) {
      case 'auto':
      case 'bypassPermissions':
      case 'dontAsk':
        return 'allow'

      case 'plan':
        // Plan mode: only read-only tools are allowed, everything else denied
        return READ_TOOLS.has(toolName) ? 'allow' : 'deny'

      case 'acceptEdits':
        // Accept edits: read tools + file edits auto-allowed, dangerous stuff asks
        if (READ_TOOLS.has(toolName)) return 'allow'
        if (EDIT_TOOLS.has(toolName)) return 'allow'
        return DANGEROUS_TOOLS.has(toolName) ? 'ask' : 'ask'

      case 'default':
      default:
        // Default: read tools auto-allowed, dangerous tools ask
        if (READ_TOOLS.has(toolName)) return 'allow'
        if (DANGEROUS_TOOLS.has(toolName)) return 'ask'
        // Unknown tools — ask to be safe
        return 'ask'
    }
  }

  /**
   * Set the permission mode.
   */
  setMode(mode: PermissionMode): void {
    this.mode = mode
  }

  /**
   * Get the current permission mode.
   */
  getMode(): PermissionMode {
    return this.mode
  }

  /**
   * Add a tool name or glob pattern to the allow list.
   * Supports patterns like "mythic_*", "*_status", "bash".
   */
  addToAllowList(pattern: string): void {
    this.allowList.add(pattern)
    // Remove from deny list if present (allow overrides)
    this.denyList.delete(pattern)
  }

  /**
   * Remove a tool name or pattern from the allow list.
   */
  removeFromAllowList(pattern: string): void {
    this.allowList.delete(pattern)
  }

  /**
   * Add a tool name or glob pattern to the deny list.
   * Supports the same patterns as addToAllowList.
   */
  addToDenyList(pattern: string): void {
    this.denyList.add(pattern)
    // Remove from allow list if present (deny takes precedence)
    this.allowList.delete(pattern)
  }

  /**
   * Remove a tool name or pattern from the deny list.
   */
  removeFromDenyList(pattern: string): void {
    this.denyList.delete(pattern)
  }

  /**
   * Load permission settings from a .wizard/settings.json file.
   * Merges with existing state (does not reset lists).
   */
  loadFromSettings(settingsPath: string): void {
    if (!existsSync(settingsPath)) return

    try {
      const raw = readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(raw)

      if (settings.permissions) {
        const perms = settings.permissions as Partial<PermissionSettings>

        if (perms.mode && isValidMode(perms.mode)) {
          this.mode = perms.mode
        }

        if (Array.isArray(perms.allow)) {
          for (const pattern of perms.allow) {
            if (typeof pattern === 'string') {
              this.allowList.add(pattern)
            }
          }
        }

        if (Array.isArray(perms.deny)) {
          for (const pattern of perms.deny) {
            if (typeof pattern === 'string') {
              this.denyList.add(pattern)
            }
          }
        }
      }
    } catch {
      // Silently ignore malformed settings — fall back to defaults
    }
  }

  /**
   * Load settings from the standard locations:
   * 1. Global: ~/.wizard/settings.json
   * 2. Project: <cwd>/.wizard/settings.json  (overrides global)
   *
   * Project settings take precedence over global settings.
   */
  loadDefaults(): void {
    // Global settings
    const globalPath = join(homedir(), CONFIG_DIR, 'settings.json')
    this.loadFromSettings(globalPath)

    // Project settings (overrides global)
    const projectPath = join(process.cwd(), CONFIG_DIR, 'settings.json')
    this.loadFromSettings(projectPath)
  }

  /**
   * Initialize from legacy config — maps cfg.yolo to 'auto' mode.
   * Call this after loadDefaults() to apply backward compat.
   */
  applyLegacyConfig(yolo: boolean): void {
    if (yolo) {
      this.mode = 'auto'
    }
  }

  /**
   * Get a human-readable summary of the current permission state.
   */
  getSummary(): { mode: PermissionMode; allowCount: number; denyCount: number; allowPatterns: string[]; denyPatterns: string[] } {
    return {
      mode: this.mode,
      allowCount: this.allowList.size,
      denyCount: this.denyList.size,
      allowPatterns: [...this.allowList],
      denyPatterns: [...this.denyList],
    }
  }

  /**
   * Check if a tool name is classified as read-only.
   */
  static isReadTool(toolName: string): boolean {
    return READ_TOOLS.has(toolName)
  }

  /**
   * Check if a tool name is classified as dangerous.
   */
  static isDangerousTool(toolName: string): boolean {
    return DANGEROUS_TOOLS.has(toolName)
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

const VALID_MODES: Set<string> = new Set(['default', 'auto', 'plan', 'acceptEdits', 'bypassPermissions', 'dontAsk'])

function isValidMode(mode: string): mode is PermissionMode {
  return VALID_MODES.has(mode)
}

// ─── Singleton ──────────────────────────────────────────────────────

/** Global permission manager instance. Initialized with defaults on import. */
export const permissionManager = new PermissionManager('default')
