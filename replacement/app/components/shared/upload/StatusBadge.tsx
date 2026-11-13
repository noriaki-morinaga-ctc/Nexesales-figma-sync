import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import type { UploadStatusType } from './uploadTypes';
import { STATUS_NAME_MAP } from './uploadConstants';

interface StatusBadgeProps {
  status: UploadStatusType;
}

// ステータスごとの配色・アイコン
const STATUS_BADGE_CONFIG: Record<
  UploadStatusType,
  { className: string; icon: ReactNode }
> = {
  PROCESSING: {
    className: 'bg-blue-100 text-blue-700 border-blue-300',
    icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
  },
  COMPLETED: {
    className: 'bg-green-100 text-green-700 border-green-300',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  },
  ERROR: {
    className: 'bg-red-100 text-red-700 border-red-300',
    icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
  },
};

// アップロードのステータスバッジ（アイコン＋ステータス名）
export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_BADGE_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={`${config.className} text-xs px-1.5 py-0 gap-1 h-4 font-bold`}
    >
      {config.icon}
      {STATUS_NAME_MAP[status]}
    </Badge>
  );
}
