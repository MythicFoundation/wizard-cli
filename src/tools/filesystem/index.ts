import { createToolDefinition } from '../../providers/claude.js'
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { glob } from 'glob'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { MAX_FILE_READ_SIZE } from '../../config/constants.js'

export function getFilesystemTools(): Tool[] {
  return [
    createToolDefinition(
      'read_file',
      'Read the contents of a file. Returns the file content as text. Can read up to 10MB.',
      {
        path: { type: 'string', description: 'Absolute or relative path to the file' },
        offset: { type: 'number', description: 'Line number to start reading from (1-indexed)' },
        limit: { type: 'number', description: 'Maximum number of lines to read' },
      },
      ['path'],
    ),

    createToolDefinition(
      'write_file',
      'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
      {
        path: { type: 'string', description: 'Path to write the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      ['path', 'content'],
    ),

    createToolDefinition(
      'edit_file',
      'Make a surgical edit to a file by replacing an exact string match with new content.',
      {
        path: { type: 'string', description: 'Path to the file' },
        old_string: { type: 'string', description: 'Exact string to find and replace' },
        new_string: { type: 'string', description: 'Replacement string' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
      },
      ['path', 'old_string', 'new_string'],
    ),

    createToolDefinition(
      'glob_files',
      'Find files matching a glob pattern. Returns file paths sorted by modification time.',
      {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.rs", "src/**/*.ts")' },
        cwd: { type: 'string', description: 'Directory to search from (default: current directory)' },
      },
      ['pattern'],
    ),

    createToolDefinition(
      'grep',
      'Search file contents using a regex pattern. Returns matching lines with file paths and line numbers.',
      {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'File or directory to search in' },
        glob_filter: { type: 'string', description: 'Glob pattern to filter files (e.g., "*.ts")' },
        context: { type: 'number', description: 'Lines of context around matches' },
      },
      ['pattern'],
    ),

    createToolDefinition(
      'list_directory',
      'List files and directories in a path.',
      {
        path: { type: 'string', description: 'Directory path to list' },
      },
      ['path'],
    ),
  ]
}

export async function executeFilesystemTool(name: string, input: Record<string, any>): Promise<string> {
  switch (name) {
    case 'read_file': {
      const filePath = resolve(input.path)
      if (!existsSync(filePath)) return `Error: File not found: ${filePath}`
      const stat = statSync(filePath)
      if (stat.size > MAX_FILE_READ_SIZE) return `Error: File too large (${stat.size} bytes, max ${MAX_FILE_READ_SIZE})`

      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const offset = (input.offset || 1) - 1
      const limit = input.limit || lines.length
      const slice = lines.slice(offset, offset + limit)

      return slice
        .map((line, i) => `${String(offset + i + 1).padStart(6)}  ${line}`)
        .join('\n')
    }

    case 'write_file': {
      const filePath = resolve(input.path)
      const dir = dirname(filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, input.content, 'utf-8')
      return `File written: ${filePath} (${input.content.length} bytes)`
    }

    case 'edit_file': {
      const filePath = resolve(input.path)
      if (!existsSync(filePath)) return `Error: File not found: ${filePath}`

      let content = readFileSync(filePath, 'utf-8')
      const oldStr = input.old_string
      const newStr = input.new_string

      if (!content.includes(oldStr)) {
        return `Error: old_string not found in file. Make sure it matches exactly.`
      }

      if (input.replace_all) {
        content = content.split(oldStr).join(newStr)
      } else {
        content = content.replace(oldStr, newStr)
      }

      writeFileSync(filePath, content, 'utf-8')
      return `File edited: ${filePath}`
    }

    case 'glob_files': {
      const cwd = input.cwd || process.cwd()
      const files = await glob(input.pattern, { cwd, nodir: true })
      if (files.length === 0) return 'No files found matching pattern.'
      return files.slice(0, 200).join('\n')
    }

    case 'grep': {
      const { execSync } = await import('child_process')
      const searchPath = input.path || '.'
      const contextFlag = input.context ? `-C ${input.context}` : ''
      const globFlag = input.glob_filter ? `--glob '${input.glob_filter}'` : ''

      try {
        const result = execSync(
          `rg --no-heading -n ${contextFlag} ${globFlag} '${input.pattern.replace(/'/g, "'\\''")}' ${searchPath}`,
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 },
        )
        const lines = result.split('\n')
        return lines.length > 500 ? lines.slice(0, 500).join('\n') + `\n... (${lines.length - 500} more lines)` : result
      } catch (err: any) {
        if (err.status === 1) return 'No matches found.'
        return `Error: ${err.message}`
      }
    }

    case 'list_directory': {
      const { readdirSync } = await import('fs')
      const dirPath = resolve(input.path || '.')
      if (!existsSync(dirPath)) return `Error: Directory not found: ${dirPath}`
      const entries = readdirSync(dirPath, { withFileTypes: true })
      return entries
        .map((e) => `${e.isDirectory() ? 'd' : 'f'}  ${e.name}`)
        .join('\n')
    }

    default:
      return `Unknown filesystem tool: ${name}`
  }
}
