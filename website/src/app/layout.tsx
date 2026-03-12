import type { Metadata } from 'next'
import { Sora, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['300', '400', '500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://wizardcli.com'),
  title: {
    default: 'Wizard CLI — AI-Powered Solana Development Agent | Claude + OpenAI Terminal Tools',
    template: '%s | Wizard CLI',
  },
  description: 'The AI development agent for Solana and Mythic L2. Claude + OpenAI with 27 native blockchain tools — deploy programs, inspect accounts, bridge assets, swap tokens, run validators. Free tier. One command install: curl -sSfL https://mythic.sh/wizard | bash',
  keywords: [
    'Solana', 'CLI', 'AI', 'development', 'blockchain', 'Claude', 'OpenAI', 'GPT-4',
    'terminal', 'developer tools', 'smart contracts', 'Rust', 'Anchor',
    'Mythic L2', 'Firedancer', 'DeFi', 'token', 'NFT', 'web3',
    'program deployment', 'airdrop', 'validator', 'bridge', 'swap',
    'wizard', 'WIZCLI', 'coding assistant', 'AI agent',
  ],
  authors: [{ name: 'Mythic Foundation', url: 'https://mythic.foundation' }],
  creator: 'Mythic Foundation',
  publisher: 'Mythic Foundation',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title: 'Wizard CLI — AI-Powered Solana Development Agent',
    description: 'Claude + OpenAI in your terminal with 27 native Solana blockchain tools. Deploy, inspect, bridge, swap, validate. Free tier — no API key needed.',
    url: 'https://wizardcli.com',
    siteName: 'Wizard CLI',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Wizard CLI — AI-Powered Solana Development Agent',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wizard CLI — AI Dev Agent for Solana',
    description: 'Claude + OpenAI with 27 blockchain tools. Deploy programs, bridge, swap, validators. One command: curl -sSfL https://mythic.sh/wizard | bash',
    site: '@WizardCLI',
    creator: '@WizardCLI',
    images: ['/og.png'],
  },
  alternates: {
    canonical: 'https://wizardcli.com',
  },
  category: 'Developer Tools',
  icons: {
    icon: '/wizard-logo.png',
    apple: '/wizard-logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="icon" href="/wizard-logo.png" />
        <meta name="theme-color" content="#9945FF" />
      </head>
      <body className="font-sans bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
