import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getVariant = (status: string) => {
    switch (status) {
      case 'connected':
        return 'default'
      case 'connecting':
        return 'secondary'
      case 'disconnected':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '🟢'
      case 'connecting':
        return '🟡'
      case 'disconnected':
        return '🔴'
      default:
        return '⚫'
    }
  }

  return (
    <Badge variant={getVariant(status)}>
      <span className="mr-1">{getIcon(status)}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
