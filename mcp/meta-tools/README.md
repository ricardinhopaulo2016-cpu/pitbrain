# Meta MCP tools (planned, read-only)

Not wired up yet — this documents the future MCP tool surface so the server layer
in `lib/meta/meta-service.ts` can be exposed as MCP tools later without redesigning it.
Every tool below is read-only; none of them may create, edit, pause, or publish anything.

| Tool                    | Maps to (`lib/meta/meta-service.ts`) | Input                                              |
|-------------------------|----------------------------------------|-----------------------------------------------------|
| `meta_list_ad_accounts` | `listAdAccounts()`                    | —                                                    |
| `meta_get_campaigns`    | `getCampaigns(adAccountId)`           | `adAccountId`                                        |
| `meta_get_adsets`       | `getAdsets(adAccountId, campaignId?)` | `adAccountId`, `campaignId?`                         |
| `meta_get_ads`          | `getAds(adAccountId, campaignId?, adsetId?)` | `adAccountId`, `campaignId?`, `adsetId?`      |
| `meta_get_insights`     | `getInsights(adAccountId, level, options)` | `adAccountId`, `level`, `datePreset?` \| `since?`+`until?` |
| `meta_get_dark_posts`   | `syncMetaAccount(adAccountId).darkPosts` | `adAccountId`                                     |
| `meta_sync_account`     | `syncMetaAccount(adAccountId)`        | `adAccountId`                                        |

When an MCP server is added here, each tool handler should just call the matching
`meta-service` function and pass through its return value — no new business logic.
The access token stays in `process.env.META_ACCESS_TOKEN` on the server running the
MCP process; it must never be a tool input parameter.
