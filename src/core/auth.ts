/**
 * Wizard CLI — Authentication Flow
 *
 * Interactive auth selector with API key validation,
 * similar to Claude Code's login experience.
 */

import chalk from 'chalk'
import readline from 'readline'
import { setConfig, getConfig, isUsingFreeKey } from '../config/settings.js'

// ─── Helpers ─────────────────────────────────────────────────────

function createRl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()))
  })
}

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

// ─── Menu Rendering ──────────────────────────────────────────────

function showHeader(): void {
  console.log()
  console.log(chalk.hex('#9945FF')('  ╔═══════════════════════════════════════╗'))
  console.log(chalk.hex('#9945FF')('  ║') + chalk.white.bold('   Wizard CLI — Authentication Setup   ') + chalk.hex('#9945FF')('║'))
  console.log(chalk.hex('#9945FF')('  ╚═══════════════════════════════════════╝'))
  console.log()
}

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
      console.log(chalk.green('  Anthropic: ') + chalk.dim(masked))
    }
    if (hasOpenAI) {
      const key = process.env.OPENAI_API_KEY || cfg.openaiApiKey
      const masked = key.slice(0, 7) + '...' + key.slice(-4)
      console.log(chalk.green('  OpenAI:    ') + chalk.dim(masked))
    }
  }
  console.log()
}

function showMenu(): void {
  console.log(chalk.white('  How would you like to authenticate?'))
  console.log()
  console.log(chalk.hex('#14F195')('  [1]') + chalk.white(' Anthropic API Key') + chalk.dim(' — paste your sk-ant-... key'))
  console.log(chalk.hex('#14F195')('  [2]') + chalk.white(' OpenAI API Key') + chalk.dim(' — paste your sk-... key'))
  console.log(chalk.hex('#14F195')('  [3]') + chalk.white(' Claude Max (OAuth)') + chalk.dim(' — browser login via Claude CLI'))
  console.log(chalk.hex('#14F195')('  [4]') + chalk.white(' Environment Variables') + chalk.dim(' — export ANTHROPIC_API_KEY=...'))
  console.log(chalk.hex('#14F195')('  [5]') + chalk.white(' Free Tier') + chalk.dim(' — 25 messages/day, no key needed'))
  console.log()
}

// ─── Auth Flows ──────────────────────────────────────────────────

async function handleAnthropicKey(rl: readline.Interface): Promise<void> {
  console.log()
  console.log(chalk.dim('  Get your API key at: ') + chalk.cyan('https://console.anthropic.com/settings/keys'))
  console.log()

  const key = await prompt(rl, chalk.hex('#14F195')('  API Key: '))

  if (!key) {
    console.log(chalk.yellow('\n  No key entered. Cancelled.\n'))
    return
  }

  if (!key.startsWith('sk-ant-')) {
    console.log(chalk.yellow('\n  Warning: Key doesn\'t start with sk-ant-. Anthropic keys typically do.'))
    const proceed = await prompt(rl, chalk.dim('  Continue anyway? [y/N] '))
    if (proceed.toLowerCase() !== 'y') {
      console.log(chalk.dim('  Cancelled.\n'))
      return
    }
  }

  console.log(chalk.dim('\n  Validating key...'))
  const valid = await validateAnthropicKey(key)

  if (valid) {
    setConfig('anthropicApiKey', key)
    console.log(chalk.green('\n  Authenticated with Anthropic API key.'))
    console.log(chalk.dim('  Key saved to wizard-cli config.\n'))
  } else {
    console.log(chalk.red('\n  Invalid API key. Please check and try again.\n'))
  }
}

async function handleOpenAIKey(rl: readline.Interface): Promise<void> {
  console.log()
  console.log(chalk.dim('  Get your API key at: ') + chalk.cyan('https://platform.openai.com/api-keys'))
  console.log()

  const key = await prompt(rl, chalk.hex('#14F195')('  API Key: '))

  if (!key) {
    console.log(chalk.yellow('\n  No key entered. Cancelled.\n'))
    return
  }

  if (!key.startsWith('sk-')) {
    console.log(chalk.yellow('\n  Warning: Key doesn\'t start with sk-. OpenAI keys typically do.'))
    const proceed = await prompt(rl, chalk.dim('  Continue anyway? [y/N] '))
    if (proceed.toLowerCase() !== 'y') {
      console.log(chalk.dim('  Cancelled.\n'))
      return
    }
  }

  console.log(chalk.dim('\n  Validating key...'))
  const valid = await validateOpenAIKey(key)

  if (valid) {
    setConfig('openaiApiKey', key)
    console.log(chalk.green('\n  Authenticated with OpenAI API key.'))
    console.log(chalk.dim('  Key saved to wizard-cli config.\n'))
  } else {
    console.log(chalk.red('\n  Invalid API key. Please check and try again.\n'))
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
    console.log(chalk.dim('  use your Claude Max subscription.\n'))
    return
  }

  console.log(chalk.dim('  Opening browser for Claude Max authentication...'))
  console.log()

  try {
    const { execSync } = await import('child_process')
    execSync('claude auth login', { stdio: 'inherit' })
    console.log(chalk.green('\n  Authenticated via Claude Max subscription.\n'))
  } catch (err: any) {
    console.log(chalk.red(`\n  Authentication failed: ${err.message}\n`))
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
  console.log(chalk.dim('  Environment variables take priority over saved config.\n'))
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
  console.log(chalk.dim('  Upgrade anytime with ') + chalk.white('wizard login') + chalk.dim(' to add your API key.\n'))
}

// ─── Main Login Flow ─────────────────────────────────────────────

export async function runLoginFlow(): Promise<void> {
  showHeader()
  showCurrentStatus()
  showMenu()

  const rl = createRl()

  try {
    const choice = await prompt(rl, chalk.hex('#14F195')('  Select [1-5]: '))

    switch (choice) {
      case '1':
        await handleAnthropicKey(rl)
        break
      case '2':
        await handleOpenAIKey(rl)
        break
      case '3':
        rl.close()
        await handleClaudeMax()
        return
      case '4':
        handleEnvVars()
        break
      case '5':
        handleFreeTier()
        break
      default:
        console.log(chalk.dim('\n  Invalid choice. Run ') + chalk.white('wizard login') + chalk.dim(' to try again.\n'))
    }
  } finally {
    rl.close()
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
