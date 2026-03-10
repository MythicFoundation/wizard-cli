import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { getFilesystemTools, executeFilesystemTool } from './filesystem/index.js'
import { getShellTools, executeShellTool } from './shell/index.js'
import { getSolanaTools, executeSolanaTool } from './solana/index.js'
import { getMythicTools, executeMythicTool } from './mythic/index.js'

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

export function getAllTools(): Tool[] {
  return [
    ...getFilesystemTools(),
    ...getShellTools(),
    ...getSolanaTools(),
    ...getMythicTools(),
  ]
}

export async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  if (FILESYSTEM_TOOLS.has(name)) return executeFilesystemTool(name, input)
  if (SHELL_TOOLS.has(name)) return executeShellTool(name, input)
  if (SOLANA_TOOLS.has(name)) return executeSolanaTool(name, input)
  if (MYTHIC_TOOLS.has(name)) return executeMythicTool(name, input)
  return `Error: Unknown tool "${name}". Available tools: ${[...FILESYSTEM_TOOLS, ...SHELL_TOOLS, ...SOLANA_TOOLS, ...MYTHIC_TOOLS].join(', ')}`
}

export function getToolCategory(name: string): string {
  if (FILESYSTEM_TOOLS.has(name)) return 'filesystem'
  if (SHELL_TOOLS.has(name)) return 'shell'
  if (SOLANA_TOOLS.has(name)) return 'solana'
  if (MYTHIC_TOOLS.has(name)) return 'mythic'
  return 'unknown'
}
