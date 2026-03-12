import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { getFilesystemTools, executeFilesystemTool } from './filesystem/index.js'
import { getShellTools, executeShellTool } from './shell/index.js'
import { getSolanaTools, executeSolanaTool } from './solana/index.js'
import { getMythicTools, executeMythicTool } from './mythic/index.js'
import { getWebTools, executeWebTool } from './web/index.js'
import { SPAWN_AGENT_TOOL, getAgentRunner } from '../core/agent-runner.js'
import { getMemoryTools, executeMemoryTool, memoryManager } from '../core/memory-manager.js'
import { getTaskTools, executeTaskTool, isTaskTool } from '../core/task-manager.js'
import { mcpClient } from '../core/mcp-client.js'

// ─── Tool Sets ────────────────────────────────────────────────────

const FILESYSTEM_TOOLS = new Set(['read_file', 'write_file', 'edit_file', 'glob_files', 'grep', 'list_directory'])
const SHELL_TOOLS = new Set(['bash'])
const SOLANA_TOOLS = new Set([
  'solana_balance', 'solana_account_info', 'solana_transfer', 'solana_transaction',
  'solana_recent_transactions', 'solana_token_accounts', 'solana_program_accounts',
  'solana_airdrop', 'solana_deploy_program', 'solana_network_status', 'solana_keygen',
])
const MYTHIC_TOOLS = new Set([
  'mythic_network_status', 'mythic_bridge_status', 'mythic_supply', 'mythic_validators',
  'mythic_deploy_validator', 'mythic_swap_pools', 'mythic_token_info', 'mythic_program_list',
  'mythic_wallet_overview',
])
const WEB_TOOLS = new Set(['web_fetch', 'web_search'])
const AGENT_TOOLS = new Set(['spawn_agent'])
const MEMORY_TOOLS = new Set(['write_memory', 'search_memory'])
const TASK_TOOLS = new Set(['task_create', 'task_update', 'task_list', 'task_get'])

// ─── Get All Tools ────────────────────────────────────────────────

export function getAllTools(): Tool[] {
  return [
    ...getFilesystemTools(),
    ...getShellTools(),
    ...getSolanaTools(),
    ...getMythicTools(),
    ...getWebTools(),
    SPAWN_AGENT_TOOL,
    ...getMemoryTools(),
    ...getTaskTools(),
    ...mcpClient.getTools(),  // MCP tools (dynamically loaded)
  ]
}

// ─── Execute Tool ──────────────────────────────────────────────────

export async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  if (FILESYSTEM_TOOLS.has(name)) return executeFilesystemTool(name, input)
  if (SHELL_TOOLS.has(name)) return executeShellTool(name, input)
  if (SOLANA_TOOLS.has(name)) return executeSolanaTool(name, input)
  if (MYTHIC_TOOLS.has(name)) return executeMythicTool(name, input)
  if (WEB_TOOLS.has(name)) return executeWebTool(name, input)

  // Agent tools
  if (name === 'spawn_agent') {
    const agentRunner = getAgentRunner()
    return agentRunner.executeSpawnAgent(input as { agent_type: string; prompt: string; background?: boolean; model?: string })
  }

  // Memory tools
  if (MEMORY_TOOLS.has(name)) return executeMemoryTool(name, input, memoryManager)

  // Task tools
  if (isTaskTool(name)) return executeTaskTool(name, input)

  // MCP tools (prefixed with mcp__)
  if (name.startsWith('mcp__')) return mcpClient.executeTool(name, input)

  return `Error: Unknown tool "${name}". Available tools: ${[...FILESYSTEM_TOOLS, ...SHELL_TOOLS, ...SOLANA_TOOLS, ...MYTHIC_TOOLS, ...WEB_TOOLS, ...AGENT_TOOLS, ...MEMORY_TOOLS, ...TASK_TOOLS].join(', ')}`
}

// ─── Get Tool Category ─────────────────────────────────────────────

export function getToolCategory(name: string): string {
  if (FILESYSTEM_TOOLS.has(name)) return 'filesystem'
  if (SHELL_TOOLS.has(name)) return 'shell'
  if (SOLANA_TOOLS.has(name)) return 'solana'
  if (MYTHIC_TOOLS.has(name)) return 'mythic'
  if (WEB_TOOLS.has(name)) return 'web'
  if (AGENT_TOOLS.has(name)) return 'agent'
  if (MEMORY_TOOLS.has(name)) return 'memory'
  if (isTaskTool(name)) return 'task'
  if (name.startsWith('mcp__')) return 'mcp'
  return 'unknown'
}
