'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { CampaignMetrics } from '@/types/metrics'
import { formatNumber } from '@/lib/utils'

interface RoasTimelineChartProps {
  campaigns: CampaignMetrics[]
}

export function RoasTimelineChart({ campaigns }: RoasTimelineChartProps) {
  const top5 = [...campaigns]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)

  const data = top5.map(c => ({
    name: c.campaignName.length > 20 ? c.campaignName.slice(0, 20) + '…' : c.campaignName,
    roas: Number(c.roas.toFixed(2)),
    spend: c.spend,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 8, right: 8 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          axisLine={{ stroke: '#2A2A40' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickFormatter={v => `${v}x`}
          axisLine={{ stroke: '#2A2A40' }}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [`${formatNumber(Number(v))}x`, 'ROAS']}
          contentStyle={{ fontSize: 12, background: '#111122', border: '1px solid #2A2A40', borderRadius: 8, color: '#F8FAFC' }}
          cursor={{ stroke: '#2A2A40' }}
        />
        <ReferenceLine y={3} stroke="#22C55E" strokeDasharray="4 4" label={{ value: 'Meta 3x', fontSize: 10, fill: '#22C55E' }} />
        <ReferenceLine y={1} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Break-even', fontSize: 10, fill: '#EF4444' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
        <Line
          type="monotone"
          dataKey="roas"
          stroke="#7C3AED"
          strokeWidth={2}
          dot={{ r: 5, fill: '#7C3AED', strokeWidth: 0 }}
          activeDot={{ r: 7, fill: '#38BDF8' }}
          name="ROAS"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
