'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { FunnelMetrics } from '@/types/metrics'
import { formatNumber } from '@/lib/utils'

interface FunnelChartProps {
  metrics: FunnelMetrics
}

export function FunnelChart({ metrics }: FunnelChartProps) {
  const data = [
    { stage: 'Impressões', value: metrics.impressions, color: '#38BDF8' },
    { stage: 'Cliques',    value: metrics.clicks,      color: '#7C3AED' },
    { stage: 'Page Views', value: metrics.pageViews,   color: '#38BDF8' },
    { stage: 'IC / Add To Cart', value: metrics.initiateCheckouts, color: '#FACC15' },
    { stage: 'Compras',    value: metrics.purchases,   color: '#22C55E' },
  ]

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 32 }}>
        <XAxis
          type="number"
          tickFormatter={v => formatNumber(v, 0)}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={{ stroke: '#2A2A40' }}
          tickLine={{ stroke: '#2A2A40' }}
        />
        <YAxis
          type="category"
          dataKey="stage"
          tick={{ fontSize: 12, fill: '#94A3B8' }}
          axisLine={{ stroke: '#2A2A40' }}
          tickLine={false}
          width={90}
        />
        <Tooltip
          formatter={(v) => [formatNumber(Number(v), 0), 'Quantidade']}
          contentStyle={{ fontSize: 12, background: '#111122', border: '1px solid #2A2A40', borderRadius: 8, color: '#F8FAFC' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
