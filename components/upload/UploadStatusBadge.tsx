import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'uploading' | 'success' | 'error'

const config: Record<Status, { label: string; icon: React.ReactNode; classes: string }> = {
  idle:      { label: 'Aguardando arquivo',    icon: <Clock className="h-3.5 w-3.5" />,              classes: 'bg-pb-card-alt text-pb-muted border-pb-border' },
  uploading: { label: 'Processando...',         icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, classes: 'bg-pb-blue/10 text-pb-blue border-pb-blue/30' },
  success:   { label: 'Importado com sucesso', icon: <CheckCircle2 className="h-3.5 w-3.5" />,       classes: 'bg-pb-green/10 text-pb-green border-pb-green/30' },
  error:     { label: 'Erro no upload',        icon: <AlertCircle className="h-3.5 w-3.5" />,        classes: 'bg-pb-red/10 text-pb-red border-pb-red/30' },
}

export function UploadStatusBadge({ status }: { status: Status }) {
  const { label, icon, classes } = config[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium', classes)}>
      {icon}
      {label}
    </span>
  )
}
