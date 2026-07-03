# Pitbrain

Inteligência operacional para tráfego pago, com UTMify, Meta Sync read-only, diagnóstico local e biblioteca futura de winners.

## Como instalar (depois de formatar o PC)

```bash
npm install
```

## Como rodar

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Como buildar

```bash
npm run build
```

## Variáveis de ambiente necessárias

Copie `.env.example` para `.env.local` e preencha com os valores reais:

- `META_ACCESS_TOKEN`
- `META_API_VERSION`
- `META_DEFAULT_AD_ACCOUNT_ID`

Além dessas, o projeto também usa variáveis de IA (OpenAI/Anthropic) e Supabase — veja `.env.example` para a lista completa.

> ⚠️ **Nunca commitar `.env.local` ou tokens reais.**

## Modo de armazenamento (Supabase vs local)

O Pitbrain detecta automaticamente (`getStorageMode()`) se o Supabase está configurado e escolhe onde persistir imports, active import, etc.

**Modo Supabase** (principal, quando configurado):
- Ativado quando `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão presentes no client, e `SUPABASE_SERVICE_ROLE_KEY` no server.
- Imports, active import e (futuramente) meta syncs/winners ficam no banco — compartilhado entre toda a equipe.
- Rotas de escrita (`/api/imports`, `/api/settings/active-import`) usam o client server-side com `service_role` (`getSupabaseAdminClient()`), que nunca roda no browser.
- Schema: veja `supabase/schema.sql`. Rode esse arquivo no **SQL Editor** do painel do Supabase antes de usar o modo Supabase (cria as tabelas `pitbrain_imports`, `pitbrain_settings`, `pitbrain_meta_syncs`, `pitbrain_winners` com RLS habilitado e sem policy pública — só acessíveis via `service_role`).

**Modo local** (fallback, sem Supabase configurado ou se uma chamada ao Supabase falhar):
- Funciona sem Supabase — nenhuma variável adicional é necessária.
- Usa `localStorage` (`pitbrain:imports`, `pitbrain:activeImportId`).
- Dados ficam apenas no navegador/dispositivo do usuário.
- Em `/imports`, com Supabase ativo, um botão permite migrar imports salvos localmente para o Supabase (não apaga o localStorage automaticamente).

## Variáveis necessárias na Vercel

Configure em **Project Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
META_ACCESS_TOKEN
META_API_VERSION
META_DEFAULT_AD_ACCOUNT_ID
```

> ⚠️ **Depois de alterar variáveis de ambiente na Vercel, é preciso fazer Redeploy** — a Vercel não aplica novas envs em deploys já existentes, só nos próximos builds.

## Stack

Next.js (App Router) + TypeScript + Supabase (banco principal, com fallback local).
