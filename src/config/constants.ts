// Wizard CLI — Constants

export const CLI_NAME = 'wizard'
export const CLI_VERSION = '0.2.0'
export const CLI_DESCRIPTION = 'Wizard CLI — AI-powered Solana & Mythic L2 development agent'

// ─── Model Registry ────────────────────────────────────────────────

export interface ModelInfo {
  id: string
  name: string
  provider: 'anthropic' | 'openai'
  contextWindow: number
  maxOutput: number
  inputPrice: number   // per 1M tokens
  outputPrice: number  // per 1M tokens
  tier: 'flagship' | 'balanced' | 'fast' | 'reasoning'
}

export const MODELS: Record<string, ModelInfo> = {
  // Anthropic
  'claude-sonnet-4-20250514': { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000, maxOutput: 64000, inputPrice: 3, outputPrice: 15, tier: 'balanced' },
  'claude-opus-4-20250514': { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', contextWindow: 200000, maxOutput: 32000, inputPrice: 15, outputPrice: 75, tier: 'flagship' },
  'claude-haiku-4-5-20251001': { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', contextWindow: 200000, maxOutput: 64000, inputPrice: 1, outputPrice: 5, tier: 'fast' },
  'claude-sonnet-4-6': { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', contextWindow: 200000, maxOutput: 64000, inputPrice: 3, outputPrice: 15, tier: 'balanced' },
  'claude-opus-4-6': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', contextWindow: 200000, maxOutput: 128000, inputPrice: 15, outputPrice: 75, tier: 'flagship' },

  // OpenAI
  'gpt-4.1': { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', contextWindow: 1047576, maxOutput: 32768, inputPrice: 2, outputPrice: 8, tier: 'flagship' },
  'gpt-4.1-mini': { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', contextWindow: 1047576, maxOutput: 32768, inputPrice: 0.4, outputPrice: 1.6, tier: 'balanced' },
  'gpt-4.1-nano': { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', contextWindow: 1047576, maxOutput: 32768, inputPrice: 0.1, outputPrice: 0.4, tier: 'fast' },
  'o3': { id: 'o3', name: 'o3', provider: 'openai', contextWindow: 200000, maxOutput: 100000, inputPrice: 10, outputPrice: 40, tier: 'reasoning' },
  'o3-mini': { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', contextWindow: 200000, maxOutput: 100000, inputPrice: 1.1, outputPrice: 4.4, tier: 'reasoning' },
  'o4-mini': { id: 'o4-mini', name: 'o4 Mini', provider: 'openai', contextWindow: 200000, maxOutput: 100000, inputPrice: 1.1, outputPrice: 4.4, tier: 'reasoning' },
}

// Aliases for quick model switching
export const MODEL_ALIASES: Record<string, string> = {
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'haiku': 'claude-haiku-4-5-20251001',
  'sonnet-4.6': 'claude-sonnet-4-6',
  'opus-4.6': 'claude-opus-4-6',
  'gpt4.1': 'gpt-4.1',
  'gpt4.1-mini': 'gpt-4.1-mini',
  'gpt4.1-nano': 'gpt-4.1-nano',
  'o3': 'o3',
  'o3-mini': 'o3-mini',
  'o4-mini': 'o4-mini',
}

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
export const MAX_TOKENS = 16384
export const TEMPERATURE = 0

// ─── Solana Networks ───────────────────────────────────────────────

export const NETWORKS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'localnet': 'http://127.0.0.1:8899',
  'mythic-l2': 'https://rpc.mythic.sh',
  'mythic-testnet': 'https://testnet.mythic.sh',
} as const

export type NetworkName = keyof typeof NETWORKS

// ─── Mythic L2 Programs ───────────────────────────────────────────

export const MYTHIC_PROGRAMS = {
  bridge_l1: 'oEQfREm4FQkaVeRoxJHkJLB1feHprrntY6eJuW2zbqQ',
  bridge_l2: 'MythBrdgL2111111111111111111111111111111111',
  token: 'MythToken1111111111111111111111111111111111',
  swap: 'MythSwap11111111111111111111111111111111111',
  launchpad: 'MythPad111111111111111111111111111111111111',
  staking: 'MythStak11111111111111111111111111111111111',
  governance: 'MythGov111111111111111111111111111111111111',
  airdrop: 'MythDrop11111111111111111111111111111111111',
  settlement: 'MythSett1ement11111111111111111111111111111',
  ai_precompiles: 'CT1yUSX8n5uid5PyrPYnoG5H6Pp2GoqYGEKmMehq3uWJ',
  compute_market: 'AVWSp12ji5yoiLeC9whJv5i34RGF5LZozQin6T58vaEh',
} as const

export const MYTHIC_MINTS = {
  MYTH: '7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq',
  wSOL: 'FEJa8wGyhXu9Hic1jNTg76Atb57C7jFkmDyDTQZkVwy3',
  USDC: '6QTVHn4TUPQSpCH1uGmAK1Vd6JhuSEeKMKSi1F1SZMN',
  wBTC: '8Go32n5Pv4HYdML9DNr8ePh4UHunqS9ZgjKMurz1vPSw',
  wETH: '4zmzPzkexJRCVKSrYCHpmP8TVX6kMobjiFu8dVKtuXGT',
} as const

export const MYTH_L1_MINT = '5UP2iL9DefXC3yovX9b4XG2EiCnyxuVo3S2F6ik5pump'

// ─── Limits ────────────────────────────────────────────────────────

export const MAX_FILE_READ_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_OUTPUT_LENGTH = 50000

// ─── Config paths ──────────────────────────────────────────────────

export const CONFIG_DIR = '.wizard'
export const CONFIG_FILE = 'config.json'
export const HISTORY_FILE = 'history.jsonl'
export const SYSTEM_PROMPT_FILE = 'WIZARD.md'
