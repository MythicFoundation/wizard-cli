import { createToolDefinition } from '../../providers/claude.js'
import { execSync, spawn } from 'child_process'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { MAX_OUTPUT_LENGTH } from '../../config/constants.js'

export function getShellTools(): Tool[] {
  return [
    createToolDefinition(
      'bash',
      'Execute a bash command and return stdout/stderr. Use for: git, npm, cargo, solana CLI, anchor, system commands. Timeout: 2 minutes.',
      {
        command: { type: 'string', description: 'The bash command to execute' },
        cwd: { type: 'string', description: 'Working directory (default: current)' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 120000, max: 600000)' },
      },
      ['command'],
    ),
  ]
}

export async function executeShellTool(name: string, input: Record<string, any>): Promise<string> {
  if (name !== 'bash') return `Unknown shell tool: ${name}`

  const { command, cwd, timeout: userTimeout } = input
  const timeout = Math.min(userTimeout || 120000, 600000)

  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      cwd: cwd || process.cwd(),
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    const output = result.trim()
    if (output.length > MAX_OUTPUT_LENGTH) {
      return output.slice(0, MAX_OUTPUT_LENGTH) + `\n... (truncated, ${output.length} total chars)`
    }
    return output || '(no output)'
  } catch (err: any) {
    const stdout = (err.stdout || '').trim()
    const stderr = (err.stderr || '').trim()
    const combined = [stdout, stderr].filter(Boolean).join('\n')

    if (err.killed) return `Error: Command timed out after ${timeout}ms\n${combined}`
    if (err.status !== undefined) return `Exit code ${err.status}\n${combined}`
    return `Error: ${err.message}\n${combined}`
  }
}
