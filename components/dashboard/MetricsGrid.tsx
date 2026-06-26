import { MetricCard } from './MetricCard'
import { FunnelMetrics } from '@/types/metrics'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'
import { TrendingUp, DollarSign, MousePointerClick, Eye, ShoppingCart, Percent, TrendingDown, BarChart2, Activity } from 'lucide-react'

interface MetricsGridProps {
  metrics: FunnelMetrics
}

function roasStatus(roas: number) {
  if (roas >= 3) return 'good' as const
  if (roas >= 1) return 'warning' as const
  return 'critical' as const
}

function ctrStatus(ctr: number) {
  if (ctr >= 0.02) return 'good' as const
  if (ctr >= 0.01) return 'warning' as const
  return 'critical' as const
}

function checkoutStatus(rate: number) {
  if (rate >= 0.5) return 'good' as const
  if (rate >= 0.2) return 'warning' as const
  return 'critical' as const
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const roi = metrics.spend > 0 ? ((metrics.revenue - metrics.spend) / metrics.spend) * 100 : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <MetricCard
        title="Gasto"
        value={formatCurrency(metrics.spend)}
        icon={DollarSign}
        highlight="neutral"
      />
      <MetricCard
        title="Faturamento"
        value={formatCurrency(metrics.revenue)}
        icon={TrendingUp}
        highlight="blue"
      />
      <MetricCard
        title="Lucro"
        value={formatCurrency(metrics.revenue - metrics.spend)}
        icon={TrendingDown}
        highlight={(metrics.revenue - metrics.spend) >= 0 ? 'good' : 'critical'}
      />
      <MetricCard
        title="ROAS"
        value={`${formatNumber(metrics.roas)}x`}
        subtitle="receita / gasto"
        icon={BarChart2}
        highlight={roasStatus(metrics.roas)}
      />
      <MetricCard
        title="ROI"
        value={`${formatNumber(roi)}%`}
        subtitle="retorno sobre investimento"
        highlight={roi >= 0 ? 'good' : 'critical'}
      />
      <MetricCard
        title="CPA"
        value={formatCurrency(metrics.cpa)}
        subtitle="custo por compra"
        icon={ShoppingCart}
        highlight="neutral"
      />
      <MetricCard
        title="Vendas"
        value={formatNumber(metrics.purchases, 0)}
        subtitle={`IC→venda: ${formatPercent(metrics.checkoutToPurchaseRate)}`}
        icon={Percent}
        highlight={checkoutStatus(metrics.checkoutToPurchaseRate)}
      />
      <MetricCard
        title="IC"
        value={formatNumber(metrics.initiateCheckouts, 0)}
        subtitle={`PV→IC: ${formatPercent(metrics.pageViewToCheckoutRate)}`}
        highlight="neutral"
      />
      <MetricCard
        title="CPC"
        value={formatCurrency(metrics.cpc)}
        subtitle="custo por clique"
        icon={MousePointerClick}
        highlight="neutral"
      />
      <MetricCard
        title="CTR"
        value={formatPercent(metrics.ctr)}
        subtitle="cliques / impressões"
        icon={Activity}
        highlight={ctrStatus(metrics.ctr)}
      />
      <MetricCard
        title="CPM"
        value={formatCurrency(metrics.cpm)}
        subtitle="custo por mil impressões"
        icon={Eye}
        highlight="neutral"
      />
    </div>
  )
}
