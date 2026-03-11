# $WIZCLI X Space / TG VC Script — 30 Minutes

## Pre-Show Setup
- Pin tweet with PumpFun link + wizardcli.com
- Set space title: "Wizard CLI — The AI Dev Agent for Solana | $WIZCLI Launch"
- Have terminal open with wizard running for live demo

---

## OPENING (0:00 - 2:00)

What's up everyone. Welcome to the Wizard CLI launch space.

I'm going to walk you through exactly what we built, why it matters, show you a live demo, and lay out the full roadmap. If you're a dev — this tool is going to change how you build on Solana. If you're a trader — I'm going to explain why this has real utility backing it.

Quick housekeeping — the token is $WIZCLI, live on PumpFun right now. CA is in the pinned tweet. Website is wizardcli.com. Everything is open source on GitHub under Mythic Foundation.

Let's get into it.

---

## SECTION 1: THE PROBLEM (2:00 - 5:00)

So here's the reality of building on Solana right now.

You've got your code editor open. You've got a browser with Solana docs. You've got another tab with the explorer. Another with your RPC dashboard. You're copy-pasting addresses between terminals. You're running solana CLI commands, checking balances, deploying programs, debugging failed transactions — and you're doing all of this manually, switching between fifteen different tools.

And if you want AI help? You go to ChatGPT or Claude, paste your code, get an answer back, copy it, paste it into your editor, run it, it fails because the AI didn't have context about your project, your network, your keypair, your program IDs. You go back, paste the error, wait for another answer. Back and forth. It's slow.

The fundamental problem is that AI assistants today are disconnected from your actual development environment. They can't see your files. They can't run commands. They can't check on-chain state. They're just text in a browser.

We fixed that.

---

## SECTION 2: WHAT IS WIZARD CLI (5:00 - 10:00)

Wizard CLI is an AI agent that lives in your terminal. You install it with one command:

```
curl -sSfL https://mythic.sh/wizard | bash
```

That's it. Type `wizard` and you're talking to Claude or GPT with full access to your filesystem, your shell, and 29 native blockchain tools.

Let me break down what "native blockchain tools" means. This is not a wrapper around the Solana CLI. These are purpose-built tool functions that the AI calls directly:

**Solana tools** — 11 of them. Check any balance. Inspect any account's data, owner, lamports. Transfer SOL. Look up any transaction by signature. Get recent transactions for an address. List all token accounts for a wallet. Query program accounts. Request devnet airdrops. Deploy compiled programs. Check network status — slot, epoch, TPS, version. Generate new keypairs.

**Mythic L2 tools** — 9 of them. Full Mythic L2 ecosystem access. Check network status, bridge vault balance, token supply with burn tracking, active validators, swap pool reserves and volume, token info, deployed programs, full wallet portraits.

**Filesystem tools** — 6 of them. Read files, write files, surgical edits with find-and-replace, glob pattern search, regex content search, directory listing. The AI reads your actual code, understands it, and modifies it.

**Shell** — full bash access. Git, npm, cargo, anchor, solana CLI, ssh — anything you can run in a terminal, the wizard can run.

**Web tools** — fetch any URL, search the web. The wizard can read documentation, check APIs, look things up.

That's 29 tools total. And here's the key — the AI decides which tools to use based on what you ask. You don't need to know the tool names. You just talk to it.

"Deploy my program to devnet" — it reads your code, compiles it, deploys it, gives you the program ID.

"What's the bridge vault balance?" — it calls the Mythic bridge status tool and tells you.

"Refactor this function to use PDAs instead of keypairs" — it reads your file, understands the logic, rewrites it, and saves it.

---

## SECTION 3: LIVE DEMO (10:00 - 15:00)

Let me show you this live. I'm going to open my terminal right now.

*[Open terminal, run wizard]*

Watch this. I'm going to say:

"Check the balance of the Mythic bridge vault on L1 mainnet"

*[Wait for response]*

See that? It called solana_account_info, parsed the data, and told me the exact MYTH balance in the vault. That took about 3 seconds. No copy-pasting addresses, no switching to an explorer, no RPC calls in another terminal.

Now watch this — I'm going to ask it to write code:

"Write me a Rust function that calculates a 4% burn fee on token transfers with overflow protection"

*[Wait for response — it writes the code]*

It wrote production-quality Rust with checked math, proper error handling, and comments. And it saved it to a file. I didn't have to copy-paste anything.

One more. YOLO mode — this is where it gets crazy:

"wizard --yolo 'create a new keypair, airdrop 2 SOL on devnet, and check the balance'"

*[It executes all three steps automatically without asking for permission]*

Three tool calls, zero confirmations. That's YOLO mode. You tell it what to do and it does it.

---

## SECTION 4: THE MODELS (15:00 - 17:00)

We support 11 AI models from two providers.

**Anthropic**: Claude Opus 4.6 — the flagship, best for complex multi-step tasks. Claude Sonnet 4 — balanced, great for most work. Claude Haiku 4.5 — fast, good for quick questions.

**OpenAI**: GPT-4.1, 4.1 Mini, 4.1 Nano for the standard tiers. Then o3, o3-mini, and o4-mini for reasoning tasks — these are the thinking models that are great for debugging complex issues.

You switch mid-conversation with /model. So you can start with Sonnet for speed, then switch to Opus when you hit a hard problem, then switch to o3 for deep reasoning. All in the same session with the same context.

And the free tier — 25 messages per day. No API key. No signup. No credit card. You install it and it works. If you want unlimited, just set your own Anthropic or OpenAI API key.

---

## SECTION 5: MYTHIC L2 & THE ECOSYSTEM (17:00 - 21:00)

Now let me talk about why this exists and where it fits.

Wizard CLI is built by Mythic Foundation. We're the team behind Mythic L2 — a high-performance Layer 2 chain built on a Firedancer fork with native AI precompiles.

For those who don't know Mythic — we have a live L2 network running Frankendancer. Real blocks producing. 11 on-chain programs deployed. An optimistic rollup bridge to Solana L1 mainnet with a live vault. MythicSwap — a real AMM DEX with live trading pairs. Mythic.fun — a bonding curve launchpad. Supply oracle tracking burns in real-time. Block explorer. Web wallet. The whole stack.

Wizard CLI is the developer tool layer. Every blockchain needs developers, and developers need tools. We built the tool that makes building on Solana and Mythic L2 as easy as having a conversation.

Think about it — if you want to onboard a new developer to Mythic L2, what do they need? They need to understand the network, the bridge, the programs, the token economics. With Wizard CLI, they just ask. "How does the Mythic bridge work?" — the wizard knows. "What are the deployed programs?" — it has the full list. "Deploy a token on Mythic L2" — it does it.

This is how you scale developer adoption. Not with better documentation — with an AI that IS the documentation and the toolchain combined.

---

## SECTION 6: $WIZCLI TOKEN (21:00 - 24:00)

So let's talk about the token.

$WIZCLI launched today on PumpFun. This is the community token for Wizard CLI.

Here's the thesis: AI dev tools are the picks and shovels of the crypto cycle. Every project building on Solana needs developers. Every developer needs tools. Wizard CLI is the tool. It's free, it's open source, it works today.

The token gives the community skin in the game. When Wizard CLI grows, when more developers use it, when it gets integrated into more workflows — the community that supported it early benefits.

We're not making promises about token utility we can't deliver. What I can tell you is:

One — the product is real and live. You can install it right now and use it. It's not a roadmap, it's not a whitepaper, it's not "coming soon." It works today.

Two — the team is real. Mythic Foundation has been shipping for months. Live L2 network, live bridge, live DEX, live launchpad. We build and we ship.

Three — it's open source. Every line of code is on GitHub. You can read it, fork it, contribute to it. There's nothing hidden.

The CA is in the pinned tweet. It's on PumpFun. Do your own research, look at the GitHub, try the tool, and make your own decision.

---

## SECTION 7: ROADMAP (24:00 - 27:00)

Here's what's coming for Wizard CLI:

**This month — March:**
- MCP server integration — connect to any external data source
- Helius RPC tools — DAS API, transaction parsing, NFT queries
- Jupiter swap integration — swap tokens directly from the wizard
- More Mythic L2 tools — staking, governance, launchpad operations

**April:**
- Anchor framework deep integration — init, build, deploy, test Anchor projects natively
- Multi-file project scaffolding — "create a new Solana program with tests and a client SDK"
- Transaction simulation — preview what a transaction will do before signing
- Metaplex tools — NFT creation, collection management, metadata updates

**May:**
- Plugin system — community can build and share custom tool packs
- Team workspaces — share context and tool configs across a team
- CI/CD integration — run wizard in your GitHub Actions pipeline
- VS Code extension — wizard inside your editor

**Longer term:**
- On-chain wizard — deploy an AI agent as a Solana program that can execute autonomously
- Multi-chain support — EVM chains, Bitcoin, Cosmos
- Wizard marketplace — buy and sell specialized tool packs and system prompts

The core vision is simple: make blockchain development as easy as talking to an AI. We're starting with Solana because it's the best chain. We're starting with CLI because developers live in the terminal. And we're building in public because that's how you earn trust.

---

## SECTION 8: Q&A + CLOSE (27:00 - 30:00)

Alright, let me open it up for questions. If you want to come up and ask something, request to speak.

While we wait for questions, let me give you the links one more time:

- **Install**: `curl -sSfL https://mythic.sh/wizard | bash`
- **Website**: wizardcli.com
- **GitHub**: github.com/MythicFoundation/wizard-cli
- **Token**: $WIZCLI on PumpFun — CA in the pinned tweet
- **Telegram**: t.me/wizardcli
- **X**: @WizardCLI

The product is live. The code is open. The wizard is ready.

Thank you all for coming. If you're a developer — install it, try it, break it, tell us what sucks. If you're investing — look at the GitHub, look at the product, look at what Mythic Foundation has shipped. Make your own decision.

Every dev needs an onchain wizard. Let's build.

*[Take 2-3 questions, then close]*

---

## KEY TALKING POINTS (Quick Reference)

If you get asked common questions:

**"Is this just a ChatGPT wrapper?"**
No. ChatGPT can't read your files, run commands, check on-chain state, or deploy programs. Wizard CLI has 29 native tools that interact directly with the blockchain. It's an agent, not a chatbot.

**"Why not just use Claude Code or Cursor?"**
Those are general-purpose coding tools. They don't have Solana-specific tools. They can't check balances, deploy programs, query validators, or interact with Mythic L2. We built something purpose-made for blockchain development.

**"What's the utility of the token?"**
$WIZCLI is a community token. The product is free and open source. The token represents community support for the project. The product is real, live, and useful — that's the foundation.

**"How is this different from other AI dev tools?"**
29 native blockchain tools. Not wrappers. Direct RPC calls, program deployment, account inspection, bridge operations, swap queries. Plus 11 models from two providers. Plus YOLO mode. Plus free tier. Name another tool that does all of this.

**"Is the team doxxed?"**
Mythic Foundation has been building publicly for months. Live L2 network, live bridge, live DEX. The code is all open source. Judge by the output.

**"What chain is the token on?"**
Solana. Launched on PumpFun.

**"Wen exchange?"**
We're focused on building the product. The token is on PumpFun and will be on Raydium after graduation. We don't make promises about exchanges.
