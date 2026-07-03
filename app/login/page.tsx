'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { AlertCircle, Loader2, Brain } from 'lucide-react'

const UNAUTHORIZED_MESSAGE = 'Acesso não autorizado. Este e-mail não tem permissão para acessar o Pitbrain.'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') setError(UNAUTHORIZED_MESSAGE)
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setError('Supabase não configurado neste ambiente.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      setError('E-mail ou senha inválidos.')
      return
    }

    router.push(searchParams.get('redirect') ?? '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pb-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-pb-purple/15 border border-pb-purple/30 flex items-center justify-center">
            <Brain className="h-6 w-6 text-pb-purple" />
          </div>
          <h1 className="text-xl font-bold text-pb-text">Entrar no Pitbrain</h1>
          <p className="text-pb-muted text-sm">Inteligência operacional para tráfego pago.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-pb-card border border-pb-border rounded-xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-pb-muted">E-mail</label>
            <input
              type="email"
              required
              autoFocus
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60"
              placeholder="••••••••"
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
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando…</> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
