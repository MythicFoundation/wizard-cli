import { createToolDefinition } from '../../providers/claude.js'
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { getRpcUrl, getConfig } from '../../config/settings.js'
import { readFileSync, existsSync } from 'fs'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { NETWORKS, MYTHIC_PROGRAMS, MYTHIC_MINTS, MYTH_L1_MINT } from '../../config/constants.js'

function getConnection(network?: string): Connection {
  const url = network ? (NETWORKS as any)[network] || network : getRpcUrl()
  return new Connection(url, 'confirmed')
}

function loadKeypair(path?: string): Keypair | null {
  const kpPath = path || getConfig().keypairPath
  if (!kpPath || !existsSync(kpPath)) return null
  const data = JSON.parse(readFileSync(kpPath, 'utf-8'))
  return Keypair.fromSecretKey(Uint8Array.from(data))
}

export function getSolanaTools(): Tool[] {
  return [
    createToolDefinition(
      'solana_balance',
      'Get the SOL or MYTH balance of a wallet address on any Solana network.',
      {
        address: { type: 'string', description: 'Wallet address (base58 pubkey)' },
        network: { type: 'string', description: 'Network: mainnet-beta, devnet, testnet, mythic-l2, mythic-testnet, or custom RPC URL' },
      },
      ['address'],
    ),

    createToolDefinition(
      'solana_account_info',
      'Get detailed account info: owner, lamports, data size, executable status.',
      {
        address: { type: 'string', description: 'Account address' },
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      ['address'],
    ),

    createToolDefinition(
      'solana_transfer',
      'Transfer SOL from loaded keypair to a recipient. Requires keypair configured.',
      {
        to: { type: 'string', description: 'Recipient address' },
        amount: { type: 'number', description: 'Amount in SOL' },
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      ['to', 'amount'],
    ),

    createToolDefinition(
      'solana_transaction',
      'Get details of a transaction by signature.',
      {
        signature: { type: 'string', description: 'Transaction signature' },
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      ['signature'],
    ),

    createToolDefinition(
      'solana_recent_transactions',
      'Get recent transaction signatures for an address.',
      {
        address: { type: 'string', description: 'Account address' },
        limit: { type: 'number', description: 'Number of transactions (default: 10, max: 50)' },
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      ['address'],
    ),

    createToolDefinition(
      'solana_token_accounts',
      'Get all SPL token accounts owned by a wallet.',
      {
        owner: { type: 'string', description: 'Wallet address' },
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      ['owner'],
    ),

    createToolDefinition(
      'solana_program_accounts',
      'Get all accounts owned by a program (with optional filters).',
      {
        program: { type: 'string', description: 'Program ID' },
        data_size: { type: 'number', description: 'Filter by account data size' },
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      ['program'],
    ),

    createToolDefinition(
      'solana_airdrop',
      'Request an airdrop (devnet/testnet/localnet only).',
      {
        address: { type: 'string', description: 'Address to airdrop to' },
        amount: { type: 'number', description: 'Amount in SOL (default: 1)' },
        network: { type: 'string', description: 'Network (devnet, testnet, or localnet)' },
      },
      ['address'],
    ),

    createToolDefinition(
      'solana_deploy_program',
      'Deploy a compiled Solana program (.so file) to a network. Uses `solana program deploy` CLI.',
      {
        program_path: { type: 'string', description: 'Path to the .so file' },
        keypair_path: { type: 'string', description: 'Path to upgrade authority keypair (uses default if not set)' },
        network: { type: 'string', description: 'Network name or RPC URL' },
        program_id: { type: 'string', description: 'Existing program ID to upgrade (optional)' },
      },
      ['program_path'],
    ),

    createToolDefinition(
      'solana_network_status',
      'Get current network status: slot, block height, epoch, TPS, version.',
      {
        network: { type: 'string', description: 'Network name or RPC URL' },
      },
      [],
    ),

    createToolDefinition(
      'solana_keygen',
      'Generate a new Solana keypair and return the public key. Optionally save to file.',
      {
        outfile: { type: 'string', description: 'Path to save the keypair JSON (optional)' },
      },
      [],
    ),
  ]
}

export async function executeSolanaTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'solana_balance': {
        const conn = getConnection(input.network)
        const pubkey = new PublicKey(input.address)
        const balance = await conn.getBalance(pubkey)
        return JSON.stringify({
          address: input.address,
          balance_sol: balance / LAMPORTS_PER_SOL,
          balance_lamports: balance,
          network: input.network || getConfig().network,
        }, null, 2)
      }

      case 'solana_account_info': {
        const conn = getConnection(input.network)
        const pubkey = new PublicKey(input.address)
        const info = await conn.getAccountInfo(pubkey)
        if (!info) return JSON.stringify({ error: 'Account not found', address: input.address })
        return JSON.stringify({
          address: input.address,
          owner: info.owner.toBase58(),
          lamports: info.lamports,
          sol: info.lamports / LAMPORTS_PER_SOL,
          data_length: info.data.length,
          executable: info.executable,
          rent_epoch: info.rentEpoch,
        }, null, 2)
      }

      case 'solana_transfer': {
        const conn = getConnection(input.network)
        const keypair = loadKeypair()
        if (!keypair) return 'Error: No keypair configured. Set WIZARD_KEYPAIR env var or run: mythic config set keypairPath <path>'

        const to = new PublicKey(input.to)
        const lamports = Math.floor(input.amount * LAMPORTS_PER_SOL)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: to,
            lamports,
          }),
        )

        const sig = await sendAndConfirmTransaction(conn, tx, [keypair])
        return JSON.stringify({
          signature: sig,
          from: keypair.publicKey.toBase58(),
          to: input.to,
          amount_sol: input.amount,
        }, null, 2)
      }

      case 'solana_transaction': {
        const conn = getConnection(input.network)
        const tx = await conn.getTransaction(input.signature, {
          maxSupportedTransactionVersion: 0,
        })
        if (!tx) return JSON.stringify({ error: 'Transaction not found' })
        return JSON.stringify({
          signature: input.signature,
          slot: tx.slot,
          blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
          fee: tx.meta?.fee,
          status: tx.meta?.err ? 'failed' : 'success',
          error: tx.meta?.err || null,
          accounts: tx.transaction.message.staticAccountKeys?.map((k: any) => k.toBase58()),
          log_messages: tx.meta?.logMessages?.slice(0, 20),
        }, null, 2)
      }

      case 'solana_recent_transactions': {
        const conn = getConnection(input.network)
        const pubkey = new PublicKey(input.address)
        const limit = Math.min(input.limit || 10, 50)
        const sigs = await conn.getSignaturesForAddress(pubkey, { limit })
        return JSON.stringify(
          sigs.map((s) => ({
            signature: s.signature,
            slot: s.slot,
            blockTime: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
            err: s.err || null,
            memo: s.memo || null,
          })),
          null,
          2,
        )
      }

      case 'solana_token_accounts': {
        const conn = getConnection(input.network)
        const owner = new PublicKey(input.owner)
        const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        })

        // Also check Token-2022
        let token2022Accounts: any[] = []
        try {
          const t22 = await conn.getParsedTokenAccountsByOwner(owner, {
            programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
          })
          token2022Accounts = t22.value
        } catch { /* Token-2022 may not exist on all networks */ }

        const all = [...tokenAccounts.value, ...token2022Accounts]

        return JSON.stringify(
          all.map((a) => ({
            address: a.pubkey.toBase58(),
            mint: a.account.data.parsed.info.mint,
            owner: a.account.data.parsed.info.owner,
            amount: a.account.data.parsed.info.tokenAmount.uiAmountString,
            decimals: a.account.data.parsed.info.tokenAmount.decimals,
          })),
          null,
          2,
        )
      }

      case 'solana_program_accounts': {
        const conn = getConnection(input.network)
        const programId = new PublicKey(input.program)
        const filters = input.data_size ? [{ dataSize: input.data_size }] : []
        const accounts = await conn.getProgramAccounts(programId, { filters })

        return JSON.stringify({
          program: input.program,
          count: accounts.length,
          accounts: accounts.slice(0, 50).map((a) => ({
            pubkey: a.pubkey.toBase58(),
            lamports: a.account.lamports,
            data_length: a.account.data.length,
          })),
          ...(accounts.length > 50 ? { note: `Showing 50 of ${accounts.length} accounts` } : {}),
        }, null, 2)
      }

      case 'solana_airdrop': {
        const network = input.network || 'devnet'
        if (!['devnet', 'testnet', 'localnet'].includes(network)) {
          return 'Error: Airdrop only available on devnet, testnet, or localnet'
        }
        const conn = getConnection(network)
        const pubkey = new PublicKey(input.address)
        const amount = (input.amount || 1) * LAMPORTS_PER_SOL
        const sig = await conn.requestAirdrop(pubkey, amount)
        await conn.confirmTransaction(sig)
        return JSON.stringify({ signature: sig, address: input.address, amount_sol: input.amount || 1 }, null, 2)
      }

      case 'solana_deploy_program': {
        const { execSync } = await import('child_process')
        const network = input.network || getConfig().network
        const rpcUrl = (NETWORKS as any)[network] || network || getRpcUrl()
        const kpPath = input.keypair_path || getConfig().keypairPath || ''

        let cmd = `solana program deploy ${input.program_path} --url ${rpcUrl}`
        if (kpPath) cmd += ` --keypair ${kpPath}`
        if (input.program_id) cmd += ` --program-id ${input.program_id}`

        const result = execSync(cmd, { encoding: 'utf-8', timeout: 300000 })
        return result.trim()
      }

      case 'solana_network_status': {
        const conn = getConnection(input.network)
        const [slot, blockHeight, epochInfo, version] = await Promise.all([
          conn.getSlot(),
          conn.getBlockHeight(),
          conn.getEpochInfo(),
          conn.getVersion(),
        ])

        let tps = 0
        try {
          const perf = await conn.getRecentPerformanceSamples(1)
          if (perf.length > 0) tps = Math.round(perf[0].numTransactions / perf[0].samplePeriodSecs)
        } catch { /* TPS not available on all networks */ }

        return JSON.stringify({
          network: input.network || getConfig().network,
          slot,
          block_height: blockHeight,
          epoch: epochInfo.epoch,
          epoch_progress: `${((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(1)}%`,
          tps,
          version: version['solana-core'],
        }, null, 2)
      }

      case 'solana_keygen': {
        const keypair = Keypair.generate()
        const pubkey = keypair.publicKey.toBase58()

        if (input.outfile) {
          const { writeFileSync } = await import('fs')
          writeFileSync(input.outfile, JSON.stringify(Array.from(keypair.secretKey)))
          return JSON.stringify({ pubkey, saved_to: input.outfile }, null, 2)
        }

        return JSON.stringify({ pubkey, secret_key: JSON.stringify(Array.from(keypair.secretKey)) }, null, 2)
      }

      default:
        return `Unknown Solana tool: ${name}`
    }
  } catch (err: any) {
    return `Error in ${name}: ${err.message}`
  }
}
