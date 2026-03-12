import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Types ────────────────────────────────────────────────────────

export interface SkillDefinition {
  name: string          // Directory name (e.g., "build")
  command: string       // Slash command (e.g., "/build")
  description: string   // First line of SKILL.md or frontmatter description
  prompt: string        // Full SKILL.md content — injected as user message
}

// ─── Frontmatter Parser ───────────────────────────────────────────

interface Frontmatter {
  name?: string
  command?: string
  description?: string
  [key: string]: string | undefined
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const frontmatter: Frontmatter = {}

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

function extractDescription(content: string): string {
  const { frontmatter, body } = parseFrontmatter(content)

  // Prefer frontmatter description
  if (frontmatter.description) {
    return frontmatter.description
  }

  // Fall back to first non-empty line of body
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      return trimmed
    }
  }

  return 'No description'
}

// ─── SkillLoader ──────────────────────────────────────────────────

export class SkillLoader {
  private skills: SkillDefinition[] = []
  private loaded = false

  /**
   * Load skills from .wizard/skills/ and built-in templates/skills/.
   * Project skills override built-in skills with the same name.
   */
  loadSkills(projectDir: string): SkillDefinition[] {
    const skillMap = new Map<string, SkillDefinition>()

    // 1. Load built-in skills from templates/skills/
    const builtinDir = this.getBuiltinSkillsDir()
    if (builtinDir) {
      this.loadSkillsFromDir(builtinDir, skillMap)
    }

    // 2. Load project skills from .wizard/skills/ (overrides built-in)
    const projectSkillsDir = path.join(projectDir, '.wizard', 'skills')
    this.loadSkillsFromDir(projectSkillsDir, skillMap)

    this.skills = Array.from(skillMap.values())
    this.loaded = true
    return this.skills
  }

  /**
   * Check if user input matches a skill command.
   * Returns the matched skill and remaining args, or null.
   */
  matchSkill(input: string): { skill: SkillDefinition; args: string } | null {
    if (!input.startsWith('/')) return null

    const trimmed = input.trim()

    for (const skill of this.skills) {
      // Match "/build" or "/build some-arg"
      if (trimmed === skill.command || trimmed.startsWith(skill.command + ' ')) {
        const args = trimmed.slice(skill.command.length).trim()
        return { skill, args }
      }
    }

    return null
  }

  /**
   * Expand a skill into a full prompt string to send to the model.
   * Combines the SKILL.md content with the user's args.
   */
  expandSkill(skill: SkillDefinition, args: string): string {
    if (args) {
      return `${skill.prompt}\n\nArgs: ${args}`
    }
    return skill.prompt
  }

  /**
   * Get all loaded skills.
   */
  getSkills(): SkillDefinition[] {
    return this.skills
  }

  /**
   * Check if skills have been loaded.
   */
  isLoaded(): boolean {
    return this.loaded
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private loadSkillsFromDir(dir: string, skillMap: Map<string, SkillDefinition>): void {
    if (!fs.existsSync(dir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillMdPath = path.join(dir, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillMdPath)) continue

      try {
        const content = fs.readFileSync(skillMdPath, 'utf-8')
        const { frontmatter } = parseFrontmatter(content)

        const name = frontmatter.name || entry.name
        const command = frontmatter.command || `/${entry.name}`
        const description = extractDescription(content)

        skillMap.set(name, {
          name,
          command,
          description,
          prompt: content,
        })
      } catch {
        // Skip malformed skill files
      }
    }
  }

  private getBuiltinSkillsDir(): string | null {
    // Resolve relative to this file's location:
    // src/core/skill-loader.ts -> ../../templates/skills/
    // dist/core/skill-loader.js -> ../../templates/skills/
    try {
      const thisFile = fileURLToPath(import.meta.url)
      const thisDir = path.dirname(thisFile)
      const templatesDir = path.join(thisDir, '..', '..', 'templates', 'skills')

      if (fs.existsSync(templatesDir)) {
        return templatesDir
      }
    } catch {
      // import.meta.url may not be available in all contexts
    }

    // Fallback: check relative to cwd
    const cwdTemplates = path.join(process.cwd(), 'templates', 'skills')
    if (fs.existsSync(cwdTemplates)) {
      return cwdTemplates
    }

    return null
  }
}

// ─── Singleton ────────────────────────────────────────────────────

export const skillLoader = new SkillLoader()
