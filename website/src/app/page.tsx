'use client'

import Image from 'next/image'
import { useState } from 'react'
import { FaGithub, FaXTwitter, FaTelegram } from 'react-icons/fa6'

const PUMPFUN_URL = 'https://pump.fun/coin/4YuHH45nwtXcsDdRiHMgZmr4EEXcPygoyhY9qySwpump'
const CA = '4YuHH45nwtXcsDdRiHMgZmr4EEXcPygoyhY9qySwpump'

function TopBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] sol-gradient-bg">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10 h-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-white animate-pulse flex-shrink-0" />
          <span className="font-mono text-[0.65rem] sm:text-[0.75rem] text-black font-bold tracking-wide">
            $WIZCLI IS LIVE ON PUMPFUN
          </span>
        </div>
        <a href={PUMPFUN_URL} target="_blank" rel="noopener"
          className="px-4 py-1 bg-black text-white font-mono text-[0.6rem] sm:text-[0.7rem] font-bold tracking-[0.06em] hover:bg-black/80 transition-colors flex-shrink-0">
          BUY NOW
        </a>
      </div>
    </div>
  )
}

function CopyCA() {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(CA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-wiz-bg-1 border border-white/[0.08] max-w-max">
      <span className="font-mono text-[0.55rem] sm:text-[0.65rem] text-wiz-text-dim">CA:</span>
      <code className="font-mono text-[0.5rem] sm:text-[0.6rem] text-wiz-green select-all">{CA}</code>
      <button onClick={handleCopy}
        className="ml-1 px-2 py-0.5 border border-white/[0.08] hover:border-wiz-green/40 hover:bg-wiz-green/[0.05] transition-colors"
        title="Copy CA">
        {copied ? (
          <span className="font-mono text-[0.55rem] text-wiz-green">Copied</span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-wiz-text-dim">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        )}
      </button>
    </div>
  )
}

function Navbar() {
  return (
    <nav className="fixed top-10 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <Image src="/wizard-logo.png" alt="Wizard CLI" width={32} height={32} className="w-8 h-8" />
          <span className="font-display text-white font-bold text-[0.95rem] tracking-[0.02em]">
            Wizard <span className="sol-gradient-text">CLI</span>
          </span>
        </a>
        <div className="hidden sm:flex items-center gap-1">
          {[
            { label: 'Docs', href: '#docs' },
            { label: 'Tools', href: '#tools' },
            { label: 'Models', href: '#models' },
            { label: '$WIZCLI', href: '#token' },
          ].map((link) => (
            <a key={link.label} href={link.href} className="px-4 py-2 font-mono text-[0.65rem] tracking-[0.12em] uppercase text-wiz-text hover:text-white transition-colors">
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/MythicFoundation/wizard-cli" target="_blank" rel="noopener" className="text-wiz-text-dim hover:text-white transition-colors">
            <FaGithub size={18} />
          </a>
          <a href="https://x.com/WizardCLI" target="_blank" rel="noopener" className="text-wiz-text-dim hover:text-white transition-colors">
            <FaXTwitter size={18} />
          </a>
          <a href="https://t.me/wizardcli" target="_blank" rel="noopener" className="text-wiz-text-dim hover:text-white transition-colors">
            <FaTelegram size={18} />
          </a>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-40" />
      {/* Gradient orbs */}
      <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] bg-wiz-purple/10 blur-[120px]" />
      <div className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] bg-wiz-green/8 blur-[100px]" />

      <div className="relative max-w-[1280px] mx-auto px-5 sm:px-10 pt-28 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-wiz-purple/30 bg-wiz-purple/[0.08] mb-8">
              <span className="w-2 h-2 bg-wiz-green animate-pulse" />
              <span className="font-mono text-[0.6rem] tracking-[0.15em] uppercase text-wiz-green font-bold">
                v0.2.0 — Now Live
              </span>
            </div>

            <h1 className="font-display text-[2.8rem] sm:text-[3.6rem] lg:text-[4.4rem] font-extrabold tracking-[-0.02em] leading-[1.05] mb-6">
              <span className="text-white">Your AI </span>
              <span className="sol-gradient-text">Blockchain</span>
              <br />
              <span className="text-white">Dev Agent</span>
            </h1>

            <p className="text-wiz-text text-[0.95rem] sm:text-[1.05rem] max-w-[520px] mx-auto lg:mx-0 leading-relaxed mb-8">
              Claude + OpenAI in your terminal with 27 native Solana & Mythic L2 tools.
              Deploy programs, inspect accounts, bridge, swap, run validators — all from one command.
            </p>

            {/* Install command */}
            <div className="max-w-[540px] mx-auto lg:mx-0 mb-8">
              <div className="font-mono text-[0.5rem] tracking-[0.2em] uppercase text-wiz-text-muted mb-2">Install (one command)</div>
              <div className="relative group">
                <pre className="bg-wiz-bg-1 border border-white/[0.08] p-4 font-mono text-[0.85rem] sm:text-[0.95rem] text-wiz-green overflow-x-auto">
                  <span className="text-wiz-text-dim">$ </span>curl -sSfL https://mythic.sh/wizard | bash
                </pre>
                <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-wiz-bg-1 to-transparent pointer-events-none sm:hidden" />
              </div>
              <div className="font-mono text-[0.55rem] text-wiz-text-dim mt-2">
                Free tier — 25 messages/day, no API key needed
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start mb-5">
              <a href={PUMPFUN_URL} target="_blank" rel="noopener"
                className="px-7 py-3.5 sol-gradient-bg text-black font-display text-[0.85rem] font-bold tracking-[0.04em] hover:opacity-90 transition-opacity flex items-center gap-2">
                Buy $WIZCLI
              </a>
              <a href="https://github.com/MythicFoundation/wizard-cli" target="_blank" rel="noopener"
                className="px-7 py-3 border border-white/[0.12] text-white font-display text-[0.8rem] font-semibold tracking-[0.04em] hover:border-white/[0.24] hover:bg-white/[0.03] transition-colors flex items-center gap-2">
                <FaGithub size={16} />
                GitHub
              </a>
              <a href="#docs"
                className="px-7 py-3 border border-white/[0.12] text-white font-display text-[0.8rem] font-semibold tracking-[0.04em] hover:border-white/[0.24] hover:bg-white/[0.03] transition-colors">
                Docs
              </a>
            </div>
            <CopyCA />
          </div>

          {/* Right: Wizard Image */}
          <div className="flex-shrink-0 relative">
            <div className="absolute inset-0 bg-wiz-purple/20 blur-[60px] scale-75" />
            <Image src="/wizard-logo.png" alt="Wizard" width={420} height={420} className="relative w-[280px] sm:w-[360px] lg:w-[420px] h-auto drop-shadow-2xl" priority />
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    { icon: '◎', title: 'Solana Native', desc: 'Balance, accounts, transfers, token operations, program deployment, airdrop, keygen — all native tools, no CLI wrapping.', color: '#9945FF' },
    { icon: '🔮', title: 'Mythic L2 Built-In', desc: 'Bridge status, supply oracle, validators, swap pools, wallet overview, validator deployment — full L2 ecosystem.', color: '#14F195' },
    { icon: '⚡', title: 'YOLO Mode', desc: 'Auto-execute everything. No confirmations. No prompts. Just results. For when you trust the wizard.', color: '#FF9500' },
    { icon: '🧠', title: '11 AI Models', desc: 'Claude Opus, Sonnet, Haiku. GPT-4.1, Mini, Nano. o3, o3-mini, o4-mini. Switch mid-conversation with /model.', color: '#9945FF' },
    { icon: '📁', title: 'Full Codebase Access', desc: 'Read, write, edit files. Glob search. Regex grep. It reads your code, understands it, and modifies it.', color: '#14F195' },
    { icon: '🆓', title: 'Free Tier', desc: '25 messages per day. No API key. No signup. No credit card. Just install and start building.', color: '#FF2D78' },
  ]

  return (
    <section className="py-[100px] sm:py-[120px] relative">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10">
        <div className="mb-16">
          <div className="font-mono text-[0.6rem] tracking-[0.25em] uppercase text-wiz-text-muted mb-4">01 / Features</div>
          <h2 className="font-display text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.02em] text-white mb-3">
            Built for <span className="sol-gradient-text">Solana Developers</span>
          </h2>
          <p className="text-wiz-text text-[0.95rem] max-w-[600px] leading-relaxed">
            Not a generic AI wrapper. Every tool is purpose-built for blockchain development.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6 hover:border-white/[0.12] transition-colors group">
              <div className="w-10 h-10 flex items-center justify-center border mb-4" style={{ borderColor: `${f.color}33`, backgroundColor: `${f.color}10` }}>
                <span className="text-[1.2rem]">{f.icon}</span>
              </div>
              <h4 className="font-display text-white font-semibold text-[0.95rem] mb-2">{f.title}</h4>
              <p className="text-wiz-text text-[0.78rem] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Tools() {
  const categories = [
    {
      name: 'Filesystem', icon: '📁', color: '#00E5FF', count: 6,
      tools: ['read_file', 'write_file', 'edit_file', 'glob_files', 'grep', 'list_directory'],
    },
    {
      name: 'Shell', icon: '⚡', color: '#FF9500', count: 1,
      tools: ['bash — git, npm, cargo, solana CLI, anchor, ssh, anything'],
    },
    {
      name: 'Solana', icon: '◎', color: '#9945FF', count: 11,
      tools: ['solana_balance', 'solana_account_info', 'solana_transfer', 'solana_transaction', 'solana_recent_transactions', 'solana_token_accounts', 'solana_program_accounts', 'solana_airdrop', 'solana_deploy_program', 'solana_network_status', 'solana_keygen'],
    },
    {
      name: 'Mythic L2', icon: '🔮', color: '#14F195', count: 9,
      tools: ['mythic_network_status', 'mythic_bridge_status', 'mythic_supply', 'mythic_validators', 'mythic_deploy_validator', 'mythic_swap_pools', 'mythic_token_info', 'mythic_program_list', 'mythic_wallet_overview'],
    },
  ]

  return (
    <section id="tools" className="py-[100px] sm:py-[120px] relative bg-wiz-bg-1">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10">
        <div className="mb-16">
          <div className="font-mono text-[0.6rem] tracking-[0.25em] uppercase text-wiz-text-muted mb-4">02 / Tools</div>
          <h2 className="font-display text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.02em] text-white mb-3">
            <span className="sol-gradient-text">27 Tools</span> at Your Command
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => (
            <div key={cat.name} className="border border-white/[0.06] bg-black p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[1.4rem]">{cat.icon}</span>
                <h3 className="font-display text-white font-bold text-[1.1rem]" style={{ color: cat.color }}>{cat.name}</h3>
                <span className="font-mono text-[0.55rem] text-wiz-text-dim ml-auto">{cat.count} tools</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cat.tools.map((tool) => (
                  <span key={tool} className="font-mono text-[0.6rem] px-2 py-1 bg-white/[0.03] border border-white/[0.06] text-wiz-text-dim">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Models() {
  const models = [
    { name: 'Claude Opus 4.6', alias: 'opus', provider: 'Anthropic', tier: 'Flagship', color: '#D97706' },
    { name: 'Claude Sonnet 4', alias: 'sonnet', provider: 'Anthropic', tier: 'Balanced', color: '#D97706' },
    { name: 'Claude Haiku 4.5', alias: 'haiku', provider: 'Anthropic', tier: 'Fast', color: '#D97706' },
    { name: 'GPT-4.1', alias: 'gpt4.1', provider: 'OpenAI', tier: 'Flagship', color: '#10A37F' },
    { name: 'GPT-4.1 Mini', alias: 'gpt4.1-mini', provider: 'OpenAI', tier: 'Balanced', color: '#10A37F' },
    { name: 'GPT-4.1 Nano', alias: 'gpt4.1-nano', provider: 'OpenAI', tier: 'Fast', color: '#10A37F' },
    { name: 'o3', alias: 'o3', provider: 'OpenAI', tier: 'Reasoning', color: '#10A37F' },
    { name: 'o3 Mini', alias: 'o3-mini', provider: 'OpenAI', tier: 'Reasoning', color: '#10A37F' },
    { name: 'o4 Mini', alias: 'o4-mini', provider: 'OpenAI', tier: 'Reasoning', color: '#10A37F' },
  ]

  return (
    <section id="models" className="py-[100px] sm:py-[120px]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10">
        <div className="mb-16">
          <div className="font-mono text-[0.6rem] tracking-[0.25em] uppercase text-wiz-text-muted mb-4">03 / Models</div>
          <h2 className="font-display text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.02em] text-white mb-3">
            Every Major Model. <span className="sol-gradient-text">One CLI.</span>
          </h2>
          <p className="text-wiz-text text-[0.95rem] max-w-[600px] leading-relaxed">
            Switch between models mid-conversation with <code className="font-mono text-wiz-green text-[0.85rem]">/model</code>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {models.map((m) => (
            <div key={m.name} className="border border-white/[0.06] bg-wiz-bg-1 p-4 flex items-center gap-4 hover:border-white/[0.12] transition-colors">
              <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: m.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-white font-semibold text-[0.85rem]">{m.name}</div>
                <div className="font-mono text-[0.55rem] text-wiz-text-dim">{m.provider} · {m.tier}</div>
              </div>
              <code className="font-mono text-[0.6rem] text-wiz-text-dim flex-shrink-0">/model {m.alias}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Docs() {
  return (
    <section id="docs" className="py-[100px] sm:py-[120px] bg-wiz-bg-1">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10">
        <div className="mb-16">
          <div className="font-mono text-[0.6rem] tracking-[0.25em] uppercase text-wiz-text-muted mb-4">04 / Documentation</div>
          <h2 className="font-display text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.02em] text-white mb-3">
            Get Started in <span className="sol-gradient-text">60 Seconds</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Installation */}
          <div>
            <h3 className="font-display text-white font-bold text-[1.1rem] mb-4">Installation</h3>

            <div className="space-y-4">
              <div>
                <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-wiz-text-muted mb-2">Option 1: One-liner (recommended)</div>
                <pre className="bg-black border border-white/[0.06] p-4 overflow-x-auto">
                  <code className="text-[0.78rem] text-wiz-green font-mono">curl -sSfL https://mythic.sh/wizard | bash</code>
                </pre>
              </div>

              <div>
                <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-wiz-text-muted mb-2">Option 2: Clone manually</div>
                <pre className="bg-black border border-white/[0.06] p-4 overflow-x-auto">
                  <code className="text-[0.78rem] text-wiz-purple font-mono">{`git clone https://github.com/MythicFoundation/wizard-cli.git ~/.wizard-cli
cd ~/.wizard-cli && npm install && npm run build
ln -sf ~/.wizard-cli/dist/cli.js ~/.local/bin/wizard`}</code>
                </pre>
              </div>

              <div>
                <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-wiz-text-muted mb-2">Use your own API key (unlimited)</div>
                <pre className="bg-black border border-white/[0.06] p-4 overflow-x-auto">
                  <code className="text-[0.78rem] text-wiz-text font-mono">export ANTHROPIC_API_KEY=sk-ant-...</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Commands */}
          <div>
            <h3 className="font-display text-white font-bold text-[1.1rem] mb-4">Slash Commands</h3>

            <div className="border border-white/[0.06] bg-black overflow-hidden">
              {[
                { cmd: '/help', desc: 'Show all commands' },
                { cmd: '/model [name]', desc: 'Switch model (opus, sonnet, gpt4.1, o3...)' },
                { cmd: '/models', desc: 'List all available models with pricing' },
                { cmd: '/yolo', desc: 'Toggle auto-execute mode' },
                { cmd: '/network <name>', desc: 'Switch Solana network' },
                { cmd: '/keypair <path>', desc: 'Set active Solana keypair' },
                { cmd: '/status', desc: 'Session status and config' },
                { cmd: '/cost', desc: 'Token usage and cost breakdown' },
                { cmd: '/tools', desc: 'List all 27 tools' },
                { cmd: '/compact', desc: 'Compress conversation to save context' },
                { cmd: '/clear', desc: 'Clear conversation history' },
                { cmd: '/exit', desc: 'Exit Wizard CLI' },
              ].map((item, i) => (
                <div key={item.cmd} className={`flex items-center gap-4 px-4 py-2.5 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''} border-b border-white/[0.03]`}>
                  <code className="font-mono text-[0.7rem] text-wiz-green w-[160px] flex-shrink-0">{item.cmd}</code>
                  <span className="text-wiz-text text-[0.75rem]">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="mt-16">
          <h3 className="font-display text-white font-bold text-[1.1rem] mb-6">Usage Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Interactive mode', code: 'wizard' },
              { title: 'With initial prompt', code: 'wizard "deploy my program to devnet"' },
              { title: 'YOLO mode', code: 'wizard --yolo "create a token mint with 6 decimals"' },
              { title: 'Use Opus model', code: 'wizard --model opus' },
              { title: 'Quick balance check', code: 'wizard balance DLB2NZ5PSN...8HjSg' },
              { title: 'Mythic L2 status', code: 'wizard status' },
              { title: 'Deploy a validator', code: 'wizard deploy-validator --tier ai' },
              { title: 'Custom network', code: 'wizard --network devnet --keypair ~/id.json' },
            ].map((ex) => (
              <div key={ex.title} className="border border-white/[0.06] bg-black p-4">
                <div className="font-mono text-[0.5rem] tracking-[0.12em] uppercase text-wiz-text-muted mb-2">{ex.title}</div>
                <code className="font-mono text-[0.78rem] text-wiz-green">{ex.code}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Token() {
  return (
    <section id="token" className="py-[100px] sm:py-[120px] relative overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="absolute top-[30%] right-[10%] w-[300px] h-[300px] bg-wiz-purple/10 blur-[100px]" />
      <div className="absolute bottom-[20%] left-[10%] w-[250px] h-[250px] bg-wiz-green/8 blur-[80px]" />

      <div className="relative max-w-[1280px] mx-auto px-5 sm:px-10">
        <div className="mb-16">
          <div className="font-mono text-[0.6rem] tracking-[0.25em] uppercase text-wiz-text-muted mb-4">05 / Token</div>
          <h2 className="font-display text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.02em] text-white mb-3">
            <span className="sol-gradient-text">$WIZCLI</span> — Launching on PumpFun
          </h2>
          <p className="text-wiz-text text-[0.95rem] max-w-[640px] leading-relaxed">
            The community token for Wizard CLI. Every dev who ships with the wizard earns their place.
          </p>
        </div>

        {/* Contract Address */}
        <div className="mb-8 p-5 border border-wiz-green/20 bg-wiz-green/[0.04]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[0.5rem] tracking-[0.15em] uppercase text-wiz-green/60 mb-1">Contract Address</div>
              <code className="font-mono text-[0.75rem] sm:text-[0.85rem] text-wiz-green select-all break-all">{CA}</code>
            </div>
            <CopyCA />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="border border-wiz-purple/20 bg-wiz-purple/[0.04] p-6 text-center">
            <div className="font-display text-[2rem] font-extrabold sol-gradient-text">$WIZCLI</div>
            <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-wiz-text-muted mt-2">Ticker</div>
          </div>
          <a href={PUMPFUN_URL} target="_blank" rel="noopener" className="border border-wiz-green/20 bg-wiz-green/[0.04] p-6 text-center hover:bg-wiz-green/[0.08] transition-colors">
            <div className="font-display text-[2rem] font-extrabold text-wiz-green">PumpFun</div>
            <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-wiz-text-muted mt-2">Live Now</div>
          </a>
          <div className="border border-white/[0.08] bg-white/[0.02] p-6 text-center">
            <div className="font-display text-[2rem] font-extrabold text-white">Solana</div>
            <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-wiz-text-muted mt-2">Blockchain</div>
          </div>
        </div>

        <div className="border border-wiz-purple/20 bg-wiz-purple/[0.03] p-8">
          <h3 className="font-display text-white font-bold text-[1.1rem] mb-4">What is $WIZCLI?</h3>
          <div className="space-y-3 text-wiz-text text-[0.85rem] leading-relaxed">
            <p>
              Wizard CLI is the AI dev agent for Solana. Claude-powered. 27 blockchain tools built in.
              Deploy programs, inspect accounts, bridge, swap, run validators — all from your terminal.
            </p>
            <p>
              $WIZCLI is the community token launching on PumpFun. Every dev needs an onchain wizard.
            </p>
            <p className="text-wiz-text-dim text-[0.75rem]">
              Built by Mythic Foundation. Open source. MIT license.
            </p>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a href={PUMPFUN_URL} target="_blank" rel="noopener"
              className="px-7 py-3.5 bg-wiz-green text-black font-display text-[0.85rem] font-bold tracking-[0.04em] hover:bg-[#1AFF9F] transition-colors text-center">
              Buy $WIZCLI on PumpFun
            </a>
            <a href="https://github.com/MythicFoundation/wizard-cli" target="_blank" rel="noopener"
              className="px-7 py-3 border border-white/[0.12] text-white font-display text-[0.8rem] font-semibold tracking-[0.04em] hover:border-white/[0.24] transition-colors text-center">
              View Source Code
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/wizard-logo.png" alt="Wizard CLI" width={28} height={28} className="w-7 h-7" />
            <span className="font-display text-white font-bold text-[0.85rem]">Wizard CLI</span>
            <span className="font-mono text-[0.55rem] text-wiz-text-dim">v0.2.0</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://mythic.sh" target="_blank" rel="noopener" className="font-mono text-[0.6rem] tracking-[0.08em] text-wiz-text-dim hover:text-white transition-colors">Mythic L2</a>
            <a href="https://mythicswap.app" target="_blank" rel="noopener" className="font-mono text-[0.6rem] tracking-[0.08em] text-wiz-text-dim hover:text-white transition-colors">MythicSwap</a>
            <a href="https://mythic.fun" target="_blank" rel="noopener" className="font-mono text-[0.6rem] tracking-[0.08em] text-wiz-text-dim hover:text-white transition-colors">Mythic.Fun</a>
            <a href="https://mythic.foundation" target="_blank" rel="noopener" className="font-mono text-[0.6rem] tracking-[0.08em] text-wiz-text-dim hover:text-white transition-colors">Foundation</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/MythicFoundation/wizard-cli" target="_blank" rel="noopener" className="text-wiz-text-dim hover:text-white transition-colors"><FaGithub size={16} /></a>
            <a href="https://x.com/WizardCLI" target="_blank" rel="noopener" className="text-wiz-text-dim hover:text-white transition-colors"><FaXTwitter size={16} /></a>
            <a href="https://t.me/wizardcli" target="_blank" rel="noopener" className="text-wiz-text-dim hover:text-white transition-colors"><FaTelegram size={16} /></a>
          </div>
        </div>
        <div className="mt-8 text-center">
          <p className="font-mono text-[0.5rem] text-wiz-text-muted tracking-[0.08em]">
            Built by Mythic Foundation. Open source. MIT license.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <>
      <TopBanner />
      <Navbar />
      <Hero />
      <Features />
      <Tools />
      <Models />
      <Docs />
      <Token />
      <Footer />
    </>
  )
}
