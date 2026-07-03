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
- `UTMIFY_MCP_URL` (opcional — habilita `/utmify-sync`; veja "UTMify MCP" abaixo)

Além dessas, o projeto também usa variáveis de IA (OpenAI/Anthropic) e Supabase — veja `.env.example` para a lista completa.

> ⚠️ **Nunca commitar `.env.local` ou tokens reais.**

## Modo de armazenamento (Supabase + login vs local)

O Pitbrain detecta automaticamente (`getStorageMode()`) se o Supabase está configurado e escolhe onde persistir imports, active import, etc.

**Modo Supabase** (principal — empresa/login, quando configurado):
- Ativado quando `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão presentes no client, e `SUPABASE_SERVICE_ROLE_KEY` no server.
- Exige login (`/login`) — **cadastro público está desativado** (`/register` só mostra "Cadastro desativado"). Acesso restrito aos e-mails listados em `PITBRAIN_ALLOWED_EMAILS` (veja "Acesso restrito" abaixo). Cada usuário pertence a um **workspace** (criado automaticamente ao ser criado no Supabase Auth) e só vê os dados desse workspace.
- Imports, active import e (futuramente) meta syncs/winners ficam no banco, por workspace — compartilhado entre toda a equipe.
- Rotas de escrita usam o client server-side com `service_role` (`getSupabaseAdminClient()`), que nunca roda no browser.
- `proxy.ts` protege as rotas principais (`/`, `/dashboard`, `/upload`, `/imports`, etc.) — sem sessão, redireciona para `/login`; logado, `/` vai direto para `/dashboard`.
- As rotas de API (`/api/imports`, `/api/settings/active-import`, `/api/upload`, `/api/analyze`, `/api/metrics`, `/api/structure`, `/api/meta/*`) também exigem sessão autorizada quando o Supabase está configurado — `proxy.ts` não cobre `/api/*`, então cada rota valida o usuário no próprio handler.
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

UTMIFY_MCP_URL=
```

> ⚠️ **Avisos importantes**
> - Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no client — ela só é lida em rotas server-side (`getSupabaseAdminClient()`), que lança erro se chamada no browser.
> - Nunca commite `.env.local`.
> - Nenhum e-mail ou senha fica hardcoded no código — o acesso é 100% controlado pela env `PITBRAIN_ALLOWED_EMAILS` + pelos usuários criados no Supabase Auth.
> - Depois de alterar variáveis de ambiente na Vercel, é preciso fazer **Redeploy** — a Vercel não aplica novas envs em deploys já existentes.
> - Se o token da Meta expirar, gere um novo (veja "Como renovar token?" em `/meta-sync`) e atualize `META_ACCESS_TOKEN` — local e na Vercel.
> - `UTMIFY_MCP_URL` carrega o token de acesso embutido na própria URL — nunca commite o valor real nem logue a URL sem redigir o token (o cliente em `lib/utmify-mcp/utmify-mcp-client.ts` já faz isso automaticamente em todo log de dev).

## Renovar token da Meta

O Meta Sync é somente leitura (`ads_read`) e usa um único token global, lido de `META_ACCESS_TOKEN` no
server — nunca é exposto ao browser nem aparece em logs. Quando o token expira, `/meta-sync` mostra
"Token da Meta expirado ou inválido" com um botão **Testar conexão** (chama `GET /api/meta/ad-accounts`,
sem rodar sync) e um bloco "Como renovar token?" com duas opções:

**Opção rápida — Graph API Explorer** (bom para testar, mas expira em poucas horas/dias):
1. Abra [Meta Developers → Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Selecione o app **PITBRAIN**.
3. Adicione a permissão `ads_read`.
4. Gere o novo token.
5. Atualize `META_ACCESS_TOKEN` na Vercel.
6. Faça **Redeploy**.

**Opção recomendada — System User Token** (não expira automaticamente, ideal para produção):
1. Acesse **Business Settings** do Business Manager.
2. Vá em **Usuários do sistema**.
3. Crie ou selecione um usuário do sistema.
4. Dê acesso à conta de anúncios que o Pitbrain deve ler.
5. Gere um token com a permissão `ads_read`.
6. Atualize `META_ACCESS_TOKEN` na Vercel e faça **Redeploy**.

> ⚠️ Depois de atualizar `META_ACCESS_TOKEN` na Vercel (Project Settings → Environment Variables),
> é sempre necessário fazer **Redeploy** — a env nova só entra em vigor no próximo deploy.

## Meta Sync otimizado

O Meta Sync foi desenhado para pedir o mínimo possível à Meta API:

- **Dark Posts Fast é o padrão** (`includeAdsets: false`) — pula a etapa de conjuntos/adsets
  inteira e busca anúncios direto por campanha, já que Dark Posts só precisa de anúncios +
  criativos. O checkbox "Buscar conjuntos/adsets como enriquecimento" liga o modo **Structure
  Full**, que inclui conjuntos (mais chamadas). Chamadas seriais (nunca `Promise.all` agressivo),
  com um delay configurável entre cada iteração (`META_SYNC_REQUEST_DELAY_MS`, default 1200ms) e
  um timeout global de 120s.
- **Insights são separados** — seção própria "Insights de Performance", só habilitada depois de
  existir um Structure Sync concluído para a conta, com escopo pequeno por padrão (nível anúncio,
  últimos 7 dias, até 50 anúncios). Um rate limit em Insights nunca afeta o Structure Sync — são
  estados de erro independentes. Performance principal continua vindo da **UTMify**; Insights da
  Meta são complementares.
- **Presets de escopo**: Seguro (Dark Posts Fast · ativas · 10 campanhas · 50 anúncios — default),
  Médio (Dark Posts Fast · ativas · 25 · 100) e Completo (Structure Full · todas · 50 · 250 · inclui
  conjuntos — pede confirmação antes de rodar, por ser mais pesado). Um card de "plano estimado"
  mostra a estimativa de chamadas e avisos antes de sincronizar. O botão "Sincronizar Insights"
  funciona como um quarto preset ("Insights") e também pede confirmação explícita antes de rodar,
  já que faz chamadas extras separadas do sync principal.
- **Cache de criativos**: criativos já buscados ficam salvos em `pitbrain_meta_creative_cache`
  (workspace-scoped) e não são buscados de novo em syncs seguintes — só o que ainda não está em
  cache é buscado na Meta, em lotes pequenos. Use "Forçar refresh de criativos" para ignorar o
  cache quando precisar de dados atualizados.
- **Checkpoint em Supabase**: o progresso do Structure Sync é salvo em `pitbrain_meta_syncs`
  (workspace-scoped) por etapa — se o sync for interrompido (rate limit, timeout, cancelamento),
  os dados parciais continuam disponíveis (na tela e em `/dark-posts`) e o botão "Usar último sync
  válido" recupera o que já foi coletado, mesmo sem Supabase configurado (nesse caso usa o cache
  local do navegador). O último sync **completo** fica protegido: uma tentativa nova que falhar no
  meio do caminho nunca sobrescreve os dados de um sync válido anterior — o resultado da tentativa
  mais recente (sucesso ou falha) é registrado à parte em `last_attempt_status`/`last_attempt_error`,
  sem tocar no snapshot que "Usar último sync válido" lê.
- **Rate limit**: se a Meta recusar chamadas, o Pitbrain tenta **uma única vez** de novo após 60s
  de espera; se falhar de novo, aborta o sync e preserva os dados parciais já coletados — nunca
  fica tentando de novo sem parar. Se continuar batendo limite, aguarde 30–60 minutos ou reduza o
  escopo (preset Seguro).
- Para uso contínuo em produção, prefira um **System User Token** (não expira automaticamente) —
  veja "Renovar token da Meta" acima.

> ⚠️ Esta seção depende de `pitbrain_meta_syncs` (com `updated_at` + índice único) e da nova tabela
> `pitbrain_meta_creative_cache` — rode o `supabase/schema.sql` atualizado no SQL Editor (é
> idempotente) antes de usar checkpoint/cache. Sem isso, o Meta Sync continua funcionando
> normalmente, só sem persistir progresso parcial nem cachear criativos.

## UTMify MCP (read-only)

`/utmify-sync` conecta a um servidor remoto **MCP** (Model Context Protocol) da UTMify, lido de
`UTMIFY_MCP_URL` — server-side only, nunca exposto ao browser. É um cliente novo, sem SDK externo
(`lib/utmify-mcp/utmify-mcp-client.ts`, JSON-RPC 2.0 sobre HTTP, aceitando resposta JSON direta ou
`text/event-stream`).

- **Configurar**: adicione `UTMIFY_MCP_URL` (com o token já embutido na URL, do jeito que a UTMify
  fornecer) nas Environment Variables da Vercel e faça **Redeploy**. Sem essa env, `/utmify-sync`
  mostra "Configure UTMIFY_MCP_URL nas variáveis de ambiente" e o resto do app continua
  funcionando normalmente.
- **Nunca commite** a URL com o token real — nem em `.env.local`, nem em nenhum outro arquivo.
  Todo log de dev já redige o token automaticamente
  (`https://mcp.utmify.com.br/mcp/?token=***redacted***`).
- **Somente leitura**: toda ferramenta (`tool`) que o servidor reporta é classificada antes de
  poder ser chamada — nomes/descrições com `create|update|delete|remove|mutate|send|post|write`
  são bloqueadas automaticamente (`POST /api/utmify-mcp/call` responde `403`), mesmo que a
  ferramenta pareça inofensiva. Só ferramentas com `get|list|search|fetch|report|metrics|orders|
  sales|campaigns|utms` no nome/descrição — e sem nenhuma palavra de escrita — são permitidas.
- **Testar conexão**: botão em `/utmify-sync` chama `GET /api/utmify-mcp/status` (lista as
  ferramentas disponíveis, não executa nenhuma).
- **Import automático**: ainda não existe — `createImportFromUtmifyMcpResult()` em
  `lib/utmify-mcp/utmify-mcp-service.ts` é um placeholder que prepara o formato
  (`PitbrainImport` com `sourceType: 'utmify_mcp'`), reaproveitando os mesmos normalizadores
  BR/Page Views/IC do upload CSV/XLSX — falta ligar isso à UI de fato.

## Stack

Next.js (App Router) + TypeScript + Supabase Auth + Postgres (banco principal, com fallback local).
