# Supabase — configuração do Pitbrain

## 1. Aplicar o schema

1. Abra o [Supabase Dashboard](https://supabase.com/dashboard) do projeto.
2. Vá em **SQL Editor** → **New query**.
3. Cole todo o conteúdo de `supabase/schema.sql`.
4. Clique em **Run**.

Isso cria as tabelas (`pitbrain_workspaces`, `pitbrain_profiles`, `pitbrain_workspace_members`,
`pitbrain_imports`, `pitbrain_settings`, `pitbrain_meta_syncs`, `pitbrain_winners`), os índices,
as policies de RLS e o trigger que provisiona automaticamente um workspace + perfil para cada
novo usuário que se cadastrar.

O arquivo é idempotente — pode rodar de novo sem duplicar nada.

## 2. Habilitar Email/Password no Auth

Em **Authentication → Providers**, confirme que **Email** está habilitado (é o padrão).
Se quiser exigir confirmação por e-mail, ajuste em **Authentication → Settings**.

## 3. Configurar variáveis de ambiente

Local (`.env.local`) e na Vercel (**Project Settings → Environment Variables**):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → `service_role` (secreta — nunca expor no client).

## 4. Redeploy na Vercel

Depois de configurar/alterar as variáveis na Vercel, é obrigatório fazer **Redeploy** —
env vars novas só entram em vigor em builds subsequentes.

## 5. Verificar

Acesse `/api/supabase/health` no app — deve retornar `{"ok":true,"configured":true,"tablesReady":true}`.
Se `tablesReady` vier `false`, o schema ainda não foi aplicado (volte ao passo 1).
