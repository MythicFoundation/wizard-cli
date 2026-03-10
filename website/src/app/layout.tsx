import type { Metadata } from 'next'
import { Sora, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', weight: ['100', '200', '300', '400', '500', '600', '700', '800'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['300', '400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Wizard CLI — AI-Powered Solana & Mythic L2 Development Agent',
  description: 'Claude + OpenAI in your terminal with 27 blockchain tools. Deploy programs, inspect accounts, bridge, swap, run validators. One command to install.',
  openGraph: {
    title: 'Wizard CLI — AI-Powered Blockchain Development',
    description: 'Claude + OpenAI in your terminal with 27 blockchain tools. Deploy, inspect, bridge, swap, validate.',
    url: 'https://wizardcli.com',
    siteName: 'Wizard CLI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wizard CLI',
    description: 'AI-powered Solana & Mythic L2 development agent. 27 tools. One command.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
