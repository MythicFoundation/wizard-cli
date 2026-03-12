/**
 * Wizard CLI — Authentication Flow
 *
 * Arrow-key selector for auth method, API key input with
 * live validation spinner. Clean, minimal UI like Claude Code.
 */

import chalk from 'chalk'
import { setConfig, getConfig, isUsingFreeKey } from '../config/settings.js'
import { select, spinner, passwordInput } from './ui.js'

const ACCENT = '#14F195'
const accentFn = chalk.hex(ACCENT)

// ─── Key Validation ─────────────────────────────────────────────

async function validateAnthropicKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    // 200 = valid, 401 = invalid key, anything else = likely valid key
    return res.status !== 401
  } catch {
    // Network error — assume key format is OK
    return key.startsWith('sk-ant-')
  }
}

async function validateOpenAIKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    return res.status !== 401
  } catch {
    return key.startsWith('sk-')
  }
}

// ─── Auth Status Display ────────────────────────────────────────

function showCurrentStatus(): void {
  const cfg = getConfig()
  const usingFree = isUsingFreeKey()
  const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY || cfg.anthropicApiKey)
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || cfg.openaiApiKey)

  if (usingFree && !hasAnthropic && !hasOpenAI) {
    console.log(chalk.yellow('  Current: Free tier (25 messages/day)'))
  } else {
    if (hasAnthropic) {
      const key = process.env.ANTHROPIC_API_KEY || cfg.anthropicApiKey
      const masked = key.slice(0, 10) + '...' + key.slice(-4)
      console.log(chalk.green('  \u2713 Anthropic: ') + chalk.dim(masked))
    }
    if (hasOpenAI) {
      const key = process.env.OPENAI_API_KEY || cfg.openaiApiKey
      const masked = key.slice(0, 7) + '...' + key.slice(-4)
      console.log(chalk.green('  \u2713 OpenAI:    ') + chalk.dim(masked))
    }
  }
  console.log()
}

// ─── Auth Handlers ──────────────────────────────────────────────

async function handleAnthropicKey(): Promise<void> {
  console.log()
  console.log(chalk.dim('  Get your API key at: ') + chalk.cyan('https://console.anthropic.com/settings/keys'))
  console.log()

  const key = await passwordInput(accentFn('  API Key: '))

  if (!key) {
    console.log(chalk.yellow('  No key entered. Cancelled.'))
    console.log()
    return
  }

  if (!key.startsWith('sk-ant-')) {
    console.log(chalk.yellow('  Warning: Key doesn\'t start with sk-ant-. Anthropic keys typically do.'))
  }

  const s = spinner()
  s.start('Validating key...')

  const valid = await validateAnthropicKey(key)

  if (valid) {
    setConfig('anthropicApiKey', key)
    s.succeed('Authenticated with Anthropic API key')
    console.log(chalk.dim('  Key saved to wizard-cli config.'))
    console.log()
  } else {
    s.fail('Invalid API key. Please check and try again.')
    console.log()
  }
}

async function handleOpenAIKey(): Promise<void> {
  console.log()
  console.log(chalk.dim('  Get your API key at: ') + chalk.cyan('https://platform.openai.com/api-keys'))
  console.log()

  const key = await passwordInput(accentFn('  API Key: '))

  if (!key) {
    console.log(chalk.yellow('  No key entered. Cancelled.'))
    console.log()
    return
  }

  if (!key.startsWith('sk-')) {
    console.log(chalk.yellow('  Warning: Key doesn\'t start with sk-. OpenAI keys typically do.'))
  }

  const s = spinner()
  s.start('Validating key...')

  const valid = await validateOpenAIKey(key)

  if (valid) {
    setConfig('openaiApiKey', key)
    s.succeed('Authenticated with OpenAI API key')
    console.log(chalk.dim('  Key saved to wizard-cli config.'))
    console.log()
  } else {
    s.fail('Invalid API key. Please check and try again.')
    console.log()
  }
}

async function handleClaudeMax(): Promise<void> {
  console.log()

  // Check if claude CLI is installed
  let claudeInstalled = false
  try {
    const { execSync } = await import('child_process')
    execSync('which claude', { stdio: 'pipe' })
    claudeInstalled = true
  } catch {}

  if (!claudeInstalled) {
    console.log(chalk.yellow('  Claude CLI not found.'))
    console.log()
    console.log(chalk.dim('  Install Claude Code first:'))
    console.log(chalk.white('    npm install -g @anthropic-ai/claude-code'))
    console.log()
    console.log(chalk.dim('  Then run:'))
    console.log(chalk.white('    claude auth login'))
    console.log()
    console.log(chalk.dim('  After authenticating, Wizard CLI will automatically'))
    console.log(chalk.dim('  use your Claude Max subscription.'))
    console.log()
    return
  }

  console.log(chalk.dim('  Opening browser for Claude Max authentication...'))
  console.log()

  try {
    const { execSync } = await import('child_process')
    execSync('claude auth login', { stdio: 'inherit' })
    console.log(chalk.green('\n  \u2713 Authenticated via Claude Max subscription.'))
    console.log()
  } catch (err: any) {
    console.log(chalk.red(`\n  Authentication failed: ${err.message}`))
    console.log()
  }
}

function handleEnvVars(): void {
  console.log()
  console.log(chalk.white('  Set these environment variables in your shell profile:'))
  console.log()
  console.log(chalk.dim('  # Anthropic (Claude models)'))
  console.log(chalk.green('  export ANTHROPIC_API_KEY=sk-ant-...'))
  console.log()
  console.log(chalk.dim('  # OpenAI (GPT models) — optional'))
  console.log(chalk.green('  export OPENAI_API_KEY=sk-...'))
  console.log()
  console.log(chalk.dim('  Add to ~/.zshrc or ~/.bashrc and restart your terminal.'))
  console.log(chalk.dim('  Environment variables take priority over saved config.'))
  console.log()
}

function handleFreeTier(): void {
  console.log()
  console.log(chalk.white('  Free tier is already active!'))
  console.log()
  console.log(chalk.dim('  Limits:'))
  console.log(chalk.dim('    25 messages per day'))
  console.log(chalk.dim('    Claude Sonnet (latest)'))
  console.log(chalk.dim('    All tools available'))
  console.log()
  console.log(chalk.dim('  Upgrade anytime with ') + chalk.white('wizard login') + chalk.dim(' to add your API key.'))
  console.log()
}

// ─── Auth Method Enum ───────────────────────────────────────────

type AuthMethod = 'anthropic' | 'openai' | 'claude-max' | 'env-vars' | 'free'

// ─── Main Login Flow ────────────────────────────────────────────

export async function runLoginFlow(): Promise<void> {
  console.log()
  console.log(chalk.bold.white('  Wizard CLI') + chalk.dim(' — Authentication'))
  console.log()

  showCurrentStatus()

  const method = await select<AuthMethod>({
    message: 'How would you like to authenticate?',
    choices: [
      {
        label: 'Anthropic API Key',
        description: 'Paste your sk-ant-... key from console.anthropic.com',
        value: 'anthropic',
      },
      {
        label: 'OpenAI API Key',
        description: 'Paste your sk-... key from platform.openai.com',
        value: 'openai',
      },
      {
        label: 'Claude Max (OAuth)',
        description: 'Browser login via Claude CLI',
        value: 'claude-max',
      },
      {
        label: 'Environment Variables',
        description: 'Set ANTHROPIC_API_KEY in your shell profile',
        value: 'env-vars',
      },
      {
        label: 'Continue without auth',
        description: 'Free tier \u2014 25 messages/day',
        value: 'free',
      },
    ],
    theme: { accent: ACCENT },
  })

  switch (method) {
    case 'anthropic':
      await handleAnthropicKey()
      break
    case 'openai':
      await handleOpenAIKey()
      break
    case 'claude-max':
      await handleClaudeMax()
      break
    case 'env-vars':
      handleEnvVars()
      break
    case 'free':
      handleFreeTier()
      break
  }
}

/**
 * Quick auth status check — called from REPL /login
 */
export function showAuthStatus(): void {
  const cfg = getConfig()
  const usingFree = isUsingFreeKey()

  console.log()
  if (usingFree) {
    console.log(chalk.yellow('  Auth: Free tier (25 messages/day)'))
    console.log(chalk.dim('  Run ') + chalk.white('wizard login') + chalk.dim(' or ') + chalk.white('/login') + chalk.dim(' to authenticate.'))
  } else {
    const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY || cfg.anthropicApiKey)
    const hasOpenAI = !!(process.env.OPENAI_API_KEY || cfg.openaiApiKey)

    if (hasAnthropic) {
      const key = process.env.ANTHROPIC_API_KEY || cfg.anthropicApiKey
      const source = process.env.ANTHROPIC_API_KEY ? 'env' : 'config'
      console.log(chalk.green(`  Anthropic: ${key.slice(0, 10)}...${key.slice(-4)}`) + chalk.dim(` (${source})`))
    }
    if (hasOpenAI) {
      const key = process.env.OPENAI_API_KEY || cfg.openaiApiKey
      const source = process.env.OPENAI_API_KEY ? 'env' : 'config'
      console.log(chalk.green(`  OpenAI:    ${key.slice(0, 7)}...${key.slice(-4)}`) + chalk.dim(` (${source})`))
    }
  }
  console.log()
}
