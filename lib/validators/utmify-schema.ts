import { z } from 'zod'

export const UtmifyRowSchema = z.object({
  order_id: z.string().optional().default(''),
  order_date: z.string().optional().default(''),
  product_name: z.string().optional().default(''),
  status: z.string().optional().default(''),
  payment_method: z.string().optional().default(''),
  gross_revenue: z.string().optional().default('0'),
  net_revenue: z.string().optional().default('0'),
  utm_source: z.string().optional().default(''),
  utm_medium: z.string().optional().default(''),
  utm_campaign: z.string().optional().default(''),
  utm_term: z.string().optional().default(''),
  utm_content: z.string().optional().default(''),
  page_views: z.string().optional().default('0'),
  sessions: z.string().optional().default('0'),
  initiate_checkouts: z.string().optional().default('0'),
}).passthrough()

export type UtmifyRowInput = z.input<typeof UtmifyRowSchema>
