import { z } from 'zod'

export const MetaRowSchema = z.object({
  campaign_name: z.string().optional().default(''),
  campaign_id: z.string().optional().default(''),
  adset_name: z.string().optional().default(''),
  adset_id: z.string().optional().default(''),
  ad_name: z.string().optional().default(''),
  ad_id: z.string().optional().default(''),
  date_start: z.string().optional().default(''),
  date_stop: z.string().optional().default(''),
  spend: z.string().optional().default('0'),
  impressions: z.string().optional().default('0'),
  clicks: z.string().optional().default('0'),
  reach: z.string().optional().default('0'),
  cpm: z.string().optional().default('0'),
  cpc: z.string().optional().default('0'),
  ctr: z.string().optional().default('0'),
}).passthrough()

export type MetaRowInput = z.input<typeof MetaRowSchema>
