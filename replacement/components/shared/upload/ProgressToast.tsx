import { Progress } from '@/components/ui/progress';

interface ProgressToastProps {
  title: string;
  value: number;
}

// トースト内に表示する進捗バー（sonner の toast.custom で描画する）
export function ProgressToast({ title, value }: ProgressToastProps) {
  return (
    <div
      role="status"
      className="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-md"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <span className="text-xs text-gray-500">{value}%</span>
      </div>
      <Progress value={value} aria-label={title} />
    </div>
  );
}
