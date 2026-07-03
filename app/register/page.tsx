import Link from 'next/link'
import { Lock } from 'lucide-react'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-pb-bg px-4">
      <div className="w-full max-w-sm bg-pb-card border border-pb-border rounded-xl p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-pb-purple/15 border border-pb-purple/30 flex items-center justify-center mx-auto">
          <Lock className="h-6 w-6 text-pb-purple" />
        </div>
        <p className="text-pb-text font-semibold text-sm">Cadastro desativado</p>
        <p className="text-pb-muted text-xs leading-relaxed">
          O Pitbrain não permite cadastro público. O acesso é restrito a usuários autorizados,
          criados manualmente no Supabase Auth.
        </p>
        <Link href="/login" className="inline-block text-pb-purple hover:text-pb-purple/80 text-sm font-medium">
          Ir para o login
        </Link>
      </div>
    </div>
  )
}
