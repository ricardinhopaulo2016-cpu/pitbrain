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

## Modo de armazenamento (local vs Supabase)

O Pitbrain detecta automaticamente (`getStorageMode()`) se o Supabase está configurado (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`) e escolhe onde persistir os imports.

**Modo local** (padrão, sem Supabase configurado):
- Funciona sem Supabase — nenhuma variável adicional é necessária.
- Usa `localStorage` (`pitbrain:imports`, `pitbrain:activeImportId`).
- Dados ficam apenas no navegador/dispositivo do usuário.

**Modo Supabase** (futuro):
- Ativado automaticamente quando as variáveis do Supabase estão presentes.
- Usado para dados compartilhados entre equipe.

## Stack

Next.js (App Router) + TypeScript + Supabase (opcional).
