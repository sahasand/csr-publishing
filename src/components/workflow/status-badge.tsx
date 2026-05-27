import { Badge } from '@/components/ui/badge';
import { STATUS_CONFIG, type DocumentStatusType } from '@/types';

interface StatusBadgeProps {
  status: DocumentStatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
