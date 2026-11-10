// 年契基本分・センターフィ等の設定値（平均）と、その右ペインを開くリンクの並び。
// 計画詳細の販売計画(詳細)タブと拡売費計画タブで、同じ並び・同じ見た目にするための共通部品
// （9/29 第35回手売りセッション 決定事項10・課題1780：拡売費計画タブから開いた右ペインも編集できる）。

export interface PlanRateLinkItem {
  // リンクの文言（例：年契基本分）
  label: string;
  // リンクの右に表示する設定値（平均）
  value?: string;
  // 右ペインを開く
  onClick?: () => void;
}

interface PlanRateLinksProps {
  items: PlanRateLinkItem[];
  className?: string;
}

export function PlanRateLinks({ items, className = '' }: PlanRateLinksProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1 whitespace-nowrap"
        >
          <button
            type="button"
            onClick={item.onClick}
            className="text-blue-600 text-sm font-bold hover:underline cursor-pointer"
          >
            {item.label}
          </button>
          <span className="text-gray-900 text-sm">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
