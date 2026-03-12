import fs from 'fs'
import path from 'path'
import os from 'os'
import { createToolDefinition } from '../providers/claude.js'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

// ─── Constants ────────────────────────────────────────────────────

const GLOBAL_MEMORY_DIR = path.join(os.homedir(), '.wizard', 'memory')
const MEMORY_INDEX_FILE = 'MEMORY.md'
const MAX_MEMORY_LINES = 200

// ─── Types ────────────────────────────────────────────────────────

export interface MemorySearchResult {
  file: string
  matches: string[]
}

export type MemoryScope = 'global' | 'project'

// ─── Frontmatter Helpers ──────────────────────────────────────────

interface MemoryFrontmatter {
  name?: string
  description?: string
  type?: 'user' | 'feedback' | 'project' | 'reference'
  [key: string]: string | undefined
}

function parseMemoryFrontmatter(content: string): { frontmatter: MemoryFrontmatter; body: string } {
  const frontmatter: MemoryFrontmatter = {}

  if (!content.startsWith('---')) {
    return { frontmatter, body: content }
  }

  const endIdx = content.indexOf('---', 3)
  if (endIdx === -1) {
    return { frontmatter, body: content }
  }

  const fmBlock = content.slice(3, endIdx).trim()
  const body = content.slice(endIdx + 3).trim()

  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    frontmatter[key] = value
  }

  return { frontmatter, body }
}

// ─── MemoryManager ────────────────────────────────────────────────

export class MemoryManager {
  private projectDir: string

  constructor(projectDir?: string) {
    this.projectDir = projectDir || process.cwd()
  }

  /**
   * Set or update the project directory.
   */
  setProjectDir(dir: string): void {
    this.projectDir = dir
  }

  /**
   * Load MEMORY.md content from both global and project scopes.
   * Returns combined content, limited to first MAX_MEMORY_LINES lines.
   * This gets injected into the system prompt.
   */
  getMemoryForPrompt(): string {
    const sections: string[] = []

    // Global memory
    const globalMemory = this.readMemoryIndex('global')
    if (globalMemory) {
      sections.push('# Global Memory\n\n' + globalMemory)
    }

    // Project memory
    const projectMemory = this.readMemoryIndex('project')
    if (projectMemory) {
      sections.push('# Project Memory\n\n' + projectMemory)
    }

    if (sections.length === 0) return ''

    const combined = sections.join('\n\n---\n\n')
    const lines = combined.split('\n')

    if (lines.length > MAX_MEMORY_LINES) {
      return lines.slice(0, MAX_MEMORY_LINES).join('\n') +
        `\n\n> WARNING: Memory truncated at ${MAX_MEMORY_LINES} lines.`
    }

    return combined
  }

  /**
   * Write a memory file and update the MEMORY.md index.
   */
  writeMemory(opts: { filename: string; content: string; scope: MemoryScope }): void {
    const { filename, content, scope } = opts
    const dir = this.getMemoryDir(scope)

    // Ensure directory exists
    this.ensureDir(dir)

    // Write the memory file
    const filePath = path.join(dir, filename)
    fs.writeFileSync(filePath, content, 'utf-8')

    // Extract description from frontmatter or first line
    const { frontmatter, body } = parseMemoryFrontmatter(content)
    const description = frontmatter.description ||
      body.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim() ||
      filename

    // Update the index
    this.updateMemoryIndex(filename, description, scope)
  }

  /**
   * Add or update a line in MEMORY.md pointing to the memory file.
   */
  updateMemoryIndex(filename: string, description: string, scope: MemoryScope): void {
    const dir = this.getMemoryDir(scope)
    this.ensureDir(dir)

    const indexPath = path.join(dir, MEMORY_INDEX_FILE)
    let indexContent = ''

    if (fs.existsSync(indexPath)) {
      indexContent = fs.readFileSync(indexPath, 'utf-8')
    } else {
      indexContent = '# Memory Index\n\n'
    }

    // Check if this file is already in the index
    const entryPattern = new RegExp(`^- \\[${this.escapeRegex(filename)}\\].*$`, 'm')
    const newEntry = `- [${filename}](${filename}) — ${description}`

    if (entryPattern.test(indexContent)) {
      // Update existing entry
      indexContent = indexContent.replace(entryPattern, newEntry)
    } else {
      // Append new entry
      indexContent = indexContent.trimEnd() + '\n' + newEntry + '\n'
    }

    fs.writeFileSync(indexPath, indexContent, 'utf-8')
  }

  /**
   * Search all memory files (both scopes) for a query string.
   * Returns matching files with context lines.
   */
  searchMemory(query: string): MemorySearchResult[] {
    const results: MemorySearchResult[] = []
    const queryLower = query.toLowerCase()

    for (const scope of ['global', 'project'] as MemoryScope[]) {
      const dir = this.getMemoryDir(scope)
      if (!fs.existsSync(dir)) continue

      let entries: string[]
      try {
        entries = fs.readdirSync(dir)
      } catch {
        continue
      }

      for (const entry of entries) {
        const filePath = path.join(dir, entry)

        // Skip directories
        try {
          if (fs.statSync(filePath).isDirectory()) continue
        } catch {
          continue
        }

        // Only search .md files
        if (!entry.endsWith('.md')) continue

        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n')
          const matches: string[] = []

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              // Include context: line before, matching line, line after
              const start = Math.max(0, i - 1)
              const end = Math.min(lines.length - 1, i + 1)
              const contextLines = lines.slice(start, end + 1).map(l => l.trim()).filter(Boolean)
              matches.push(contextLines.join('\n'))
            }
          }

          if (matches.length > 0) {
            const scopePrefix = scope === 'global' ? '~/.wizard/memory/' : '.wizard/memory/'
            results.push({
              file: scopePrefix + entry,
              matches,
            })
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return results
  }

  /**
   * Delete a memory file and remove its entry from MEMORY.md.
   */
  deleteMemory(filename: string, scope: MemoryScope): void {
    const dir = this.getMemoryDir(scope)
    const filePath = path.join(dir, filename)

    // Delete the file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Remove from index
    const indexPath = path.join(dir, MEMORY_INDEX_FILE)
    if (fs.existsSync(indexPath)) {
      let indexContent = fs.readFileSync(indexPath, 'utf-8')
      const entryPattern = new RegExp(`^- \\[${this.escapeRegex(filename)}\\].*\\n?`, 'gm')
      indexContent = indexContent.replace(entryPattern, '')
      fs.writeFileSync(indexPath, indexContent, 'utf-8')
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private getMemoryDir(scope: MemoryScope): string {
    if (scope === 'global') {
      return GLOBAL_MEMORY_DIR
    }
    return path.join(this.projectDir, '.wizard', 'memory')
  }

  private readMemoryIndex(scope: MemoryScope): string | null {
    const dir = this.getMemoryDir(scope)
    const indexPath = path.join(dir, MEMORY_INDEX_FILE)

    if (!fs.existsSync(indexPath)) return null

    try {
      const content = fs.readFileSync(indexPath, 'utf-8')
      return content.trim() || null
    } catch {
      return null
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

// ─── Memory Tools ─────────────────────────────────────────────────

export function getMemoryTools(): Tool[] {
  return [
    createToolDefinition(
      'write_memory',
      'Save information to persistent memory for future conversations. Use this to remember user preferences, project context, important decisions, or patterns discovered during work.',
      {
        filename: {
          type: 'string',
          description: 'Memory filename (e.g., user_preferences.md, project_context.md). Must end in .md',
        },
        content: {
          type: 'string',
          description: 'Memory content in markdown. Optionally include frontmatter with name, description, and type (user|feedback|project|reference)',
        },
        scope: {
          type: 'string',
          description: 'Memory scope: "global" (persists across all projects) or "project" (this project only). Default: project',
        },
      },
      ['filename', 'content'],
    ),
    createToolDefinition(
      'search_memory',
      'Search persistent memory for relevant information. Searches both global and project memory files for matching text.',
      {
        query: {
          type: 'string',
          description: 'Search query — matches against memory file contents (case-insensitive)',
        },
      },
      ['query'],
    ),
  ]
}

/**
 * Execute a memory tool call. Returns the result string.
 */
export function executeMemoryTool(name: string, input: Record<string, any>, manager: MemoryManager): string {
  switch (name) {
    case 'write_memory': {
      const filename = input.filename as string
      const content = input.content as string
      const scope = (input.scope as MemoryScope) || 'project'

      if (!filename) return 'Error: filename is required'
      if (!content) return 'Error: content is required'
      if (!filename.endsWith('.md')) return 'Error: filename must end in .md'
      if (scope !== 'global' && scope !== 'project') {
        return 'Error: scope must be "global" or "project"'
      }

      try {
        manager.writeMemory({ filename, content, scope })
        return `Memory saved: ${filename} (${scope} scope, ${content.length} bytes)`
      } catch (err: any) {
        return `Error writing memory: ${err.message}`
      }
    }

    case 'search_memory': {
      const query = input.query as string
      if (!query) return 'Error: query is required'

      try {
        const results = manager.searchMemory(query)
        if (results.length === 0) {
          return `No memory matches found for "${query}"`
        }

        const formatted = results.map(r => {
          const matchPreview = r.matches.slice(0, 3).map(m => `  ${m}`).join('\n')
          return `${r.file} (${r.matches.length} matches):\n${matchPreview}`
        }).join('\n\n')

        return `Found ${results.length} matching memory files:\n\n${formatted}`
      } catch (err: any) {
        return `Error searching memory: ${err.message}`
      }
    }

    default:
      return `Error: Unknown memory tool "${name}"`
  }
}

// ─── Singleton ────────────────────────────────────────────────────

export const memoryManager = new MemoryManager()
