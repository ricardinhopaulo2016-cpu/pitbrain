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

## Stack

Next.js (App Router) + TypeScript + Supabase.
