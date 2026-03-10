// Mythic Wizard CLI — Constants

export const CLI_NAME = 'mythic'
export const CLI_VERSION = '0.1.0'
export const CLI_DESCRIPTION = 'Wizard CLI — AI-powered Solana & Mythic L2 development agent'

// Claude API
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
export const OPUS_MODEL = 'claude-opus-4-20250514'
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_TOKENS = 16384
export const TEMPERATURE = 0

// Solana Networks
export const NETWORKS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'localnet': 'http://127.0.0.1:8899',
  'mythic-l2': 'https://rpc.mythic.sh',
  'mythic-testnet': 'https://testnet.mythic.sh',
} as const

export type NetworkName = keyof typeof NETWORKS

// Mythic L2 Programs
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

// Mythic L2 Token Mints
export const MYTHIC_MINTS = {
  MYTH: '7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq',
  wSOL: 'FEJa8wGyhXu9Hic1jNTg76Atb57C7jFkmDyDTQZkVwy3',
  USDC: '6QTVHn4TUPQSpCH1uGmAK1Vd6JhuSEeKMKSi1F1SZMN',
  wBTC: '8Go32n5Pv4HYdML9DNr8ePh4UHunqS9ZgjKMurz1vPSw',
  wETH: '4zmzPzkexJRCVKSrYCHpmP8TVX6kMobjiFu8dVKtuXGT',
} as const

// PumpFun MYTH on Solana L1
export const MYTH_L1_MINT = '5UP2iL9DefXC3yovX9b4XG2EiCnyxuVo3S2F6ik5pump'

// File size limits
export const MAX_FILE_READ_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_OUTPUT_LENGTH = 50000

// YOLO mode defaults
export const YOLO_DESCRIPTION = 'Skip all confirmation prompts. Execute tool calls automatically.'

// Config file
export const CONFIG_DIR = '.wizard'
export const CONFIG_FILE = 'config.json'
export const HISTORY_FILE = 'history.jsonl'
export const SYSTEM_PROMPT_FILE = 'WIZARD.md'
