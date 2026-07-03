'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { AlertCircle, CheckCircle2, Loader2, Brain } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setError('Supabase não configurado neste ambiente.')
      return
    }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message.includes('already registered')
        ? 'Este e-mail já está cadastrado.'
        : 'Não foi possível criar a conta. Tente novamente.')
      return
    }

    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    setNeedsConfirmation(true)
  }

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pb-bg px-4">
        <div className="w-full max-w-sm bg-pb-card border border-pb-border rounded-xl p-6 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-pb-green mx-auto" />
          <p className="text-pb-text font-semibold text-sm">Conta criada!</p>
          <p className="text-pb-muted text-xs">Verifique seu e-mail para confirmar o cadastro antes de entrar.</p>
          <Link href="/login" className="inline-block text-pb-purple hover:text-pb-purple/80 text-sm font-medium">
            Ir para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pb-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-pb-purple/15 border border-pb-purple/30 flex items-center justify-center">
            <Brain className="h-6 w-6 text-pb-purple" />
          </div>
          <h1 className="text-xl font-bold text-pb-text">Criar conta no Pitbrain</h1>
          <p className="text-pb-muted text-sm">Centralize os dados da equipe em um só lugar.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-pb-card border border-pb-border rounded-xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-pb-muted">Nome</label>
            <input
              type="text"
              required
              autoFocus
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60"
              placeholder="Seu nome"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-pb-muted">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-pb-muted">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <div className="bg-pb-red/10 border border-pb-red/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-pb-red shrink-0" />
              <p className="text-pb-red text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Criando conta…</> : 'Criar conta'}
          </button>

          <p className="text-center text-xs text-pb-muted">
            Já tem conta?{' '}
            <Link href="/login" className="text-pb-purple hover:text-pb-purple/80 font-medium">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
