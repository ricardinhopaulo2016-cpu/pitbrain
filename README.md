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

## Modo de armazenamento (Supabase + login vs local)

O Pitbrain detecta automaticamente (`getStorageMode()`) se o Supabase está configurado e escolhe onde persistir imports, active import, etc.

**Modo Supabase** (principal — empresa/login, quando configurado):
- Ativado quando `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão presentes no client, e `SUPABASE_SERVICE_ROLE_KEY` no server.
- Exige login (`/login`) — **cadastro público está desativado** (`/register` só mostra "Cadastro desativado"). Acesso restrito aos e-mails listados em `PITBRAIN_ALLOWED_EMAILS` (veja "Acesso restrito" abaixo). Cada usuário pertence a um **workspace** (criado automaticamente ao ser criado no Supabase Auth) e só vê os dados desse workspace.
- Imports, active import e (futuramente) meta syncs/winners ficam no banco, por workspace — compartilhado entre toda a equipe.
- Rotas de escrita usam o client server-side com `service_role` (`getSupabaseAdminClient()`), que nunca roda no browser.
- `middleware.ts` protege as rotas principais (`/dashboard`, `/upload`, `/imports`, etc.) — sem sessão, redireciona para `/login`.
- Schema: veja `supabase/schema.sql` e `supabase/README.md`. Rode o schema no **SQL Editor** do Supabase antes de usar o modo Supabase.
- `GET /api/supabase/health` informa se o Supabase está configurado e se o schema já foi instalado (`tablesReady`).

**Modo local** (fallback — sem Supabase configurado, ou se uma chamada ao Supabase falhar):
- Funciona sem Supabase — nenhuma variável adicional é necessária, login fica indisponível.
- Usa `localStorage` (`pitbrain:imports`, `pitbrain:activeImportId`).
- Dados ficam apenas no navegador/dispositivo do usuário.
- Em `/imports`, com Supabase ativo, um botão permite migrar imports salvos localmente para o Supabase (não apaga o localStorage automaticamente).

## Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Copie a **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
3. Copie a **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Copie a **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (secreta).
5. Configure as três na Vercel (**Project Settings → Environment Variables**).
6. Rode `supabase/schema.sql` no **SQL Editor** do Supabase (veja `supabase/README.md`).
7. Faça **Redeploy** na Vercel.

## Acesso restrito

O Pitbrain **não permite cadastro público**. Só quem estiver em `PITBRAIN_ALLOWED_EMAILS` consegue logar —
qualquer outro e-mail é deslogado automaticamente com a mensagem "Acesso não autorizado. Este e-mail não
tem permissão para acessar o Pitbrain.", tanto nas páginas quanto nas rotas de API internas.

Para dar acesso a alguém:

1. Crie o usuário manualmente no **Supabase Dashboard → Authentication → Users → Add user** (defina a senha lá; o Pitbrain nunca lida com senha hardcoded).
2. Adicione o e-mail em `PITBRAIN_ALLOWED_EMAILS` na Vercel (separado por vírgula se houver mais de um).
3. Faça **Redeploy** na Vercel.

## Variáveis obrigatórias para login na Vercel

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PITBRAIN_ALLOWED_EMAILS
```

> ⚠️ Depois de alterar Environment Variables na Vercel, faça **Redeploy**. Variáveis `NEXT_PUBLIC_*`
> são embutidas no build (client bundle) — só passam a valer no próximo deploy, nunca em um já existente.
> Se `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem ausentes, a tela `/login`
> mostra um diagnóstico indicando qual das duas falta, sem nunca exibir os valores.

## Variáveis necessárias na Vercel

Configure em **Project Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

PITBRAIN_ALLOWED_EMAILS=

META_ACCESS_TOKEN=
META_API_VERSION=v25.0
META_DEFAULT_AD_ACCOUNT_ID=
```

> ⚠️ **Avisos importantes**
> - Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no client — ela só é lida em rotas server-side (`getSupabaseAdminClient()`), que lança erro se chamada no browser.
> - Nunca commite `.env.local`.
> - Nenhum e-mail ou senha fica hardcoded no código — o acesso é 100% controlado pela env `PITBRAIN_ALLOWED_EMAILS` + pelos usuários criados no Supabase Auth.
> - Depois de alterar variáveis de ambiente na Vercel, é preciso fazer **Redeploy** — a Vercel não aplica novas envs em deploys já existentes.
> - Se o token da Meta expirar, gere um novo (veja "Como renovar token?" em `/meta-sync`) e atualize `META_ACCESS_TOKEN` — local e na Vercel.

## Stack

Next.js (App Router) + TypeScript + Supabase Auth + Postgres (banco principal, com fallback local).
