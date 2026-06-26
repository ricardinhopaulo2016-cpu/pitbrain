import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PITBRAIN',
  description: 'Diagnóstico inteligente de campanhas Meta Ads com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-screen bg-pb-bg text-pb-text flex">
        <Sidebar />
        <div className="ml-60 flex-1 min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
