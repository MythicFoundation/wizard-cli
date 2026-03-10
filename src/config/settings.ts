import Conf from 'conf'
import { DEFAULT_MODEL, NETWORKS, type NetworkName } from './constants.js'

export interface WizardConfig {
  anthropicApiKey: string
  model: string
  network: NetworkName
  customRpc: string | null
  keypairPath: string | null
  yolo: boolean
  theme: 'dark' | 'light'
  maxTokens: number
  systemPromptPath: string | null
}

const config = new Conf<WizardConfig>({
  projectName: 'wizard-cli',
  defaults: {
    anthropicApiKey: '',
    model: DEFAULT_MODEL,
    network: 'mythic-l2',
    customRpc: null,
    keypairPath: null,
    yolo: false,
    theme: 'dark',
    maxTokens: 16384,
    systemPromptPath: null,
  },
})

export function getConfig(): WizardConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || config.get('anthropicApiKey'),
    model: process.env.WIZARD_MODEL || config.get('model'),
    network: (process.env.WIZARD_NETWORK as NetworkName) || config.get('network'),
    customRpc: process.env.WIZARD_RPC || config.get('customRpc'),
    keypairPath: process.env.WIZARD_KEYPAIR || config.get('keypairPath'),
    yolo: process.env.WIZARD_YOLO === '1' || config.get('yolo'),
    theme: config.get('theme'),
    maxTokens: config.get('maxTokens'),
    systemPromptPath: config.get('systemPromptPath'),
  }
}

export function setConfig(key: keyof WizardConfig, value: any) {
  config.set(key, value)
}

export function getRpcUrl(networkOverride?: NetworkName): string {
  const cfg = getConfig()
  if (cfg.customRpc) return cfg.customRpc
  const network = networkOverride || cfg.network
  return NETWORKS[network]
}

export function resetConfig() {
  config.clear()
}

export { config }
