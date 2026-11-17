import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { TEXT_INPUT_CLASS } from '@/styles/commonStyles';

// 率設定の項目（年契基本分・センターフィ等）。販売計画(詳細)・拡売費計画のどちらから開いても同じ並び・同じ見た目にする
// （9/29 第35回手売りセッション 決定事項10・課題1780：拡売費計画から開いた右ペインも編集できる）。
export interface PlanRateLinkItem {
  // 項目名（例：年契基本分）
  label: string;
  // 項目名の右に出す設定値（平均）
  value?: string;
  // 右ペインを開く
  onClick?: () => void;
}

// 計画詳細の販売計画(詳細)／拡売費計画の見出しの行に置くメニュー（UI/UX UX-106。Figma #51・案：販売計画詳細_タブ見出し.html）。
// ボタンを並べず「一括操作」「率設定」「関連画面」の3つにまとめ、見出しを1行に収める。
// メニューを開くボタンはほかの表の上の操作ボタンと同じ btn-toolbar-outline＋∨（→ 02 §6）。

// メニューを開くボタン（btn-toolbar-outline＋∨）
const MenuTriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(({ label, ...props }, ref) => (
  <button ref={ref} type="button" className="btn-toolbar-outline" {...props}>
    {label}
    <ChevronDown className="h-4 w-4" />
  </button>
));
MenuTriggerButton.displayName = 'MenuTriggerButton';

// メニューの項目の文字（項目名・値）
const MENU_ITEM_CLASS = 'gap-4 text-sm whitespace-nowrap';

interface PlanBulkActionsMenuProps {
  /** 前月計画コピー（右ペインを開く） */
  onPlanCopy: () => void;
  /** 本部計画コピー（右ペインを開く。無い画面は渡さない） */
  onHeadquartersCopy?: () => void;
  /** 函数反映の前年実績比（%） */
  casePlanPercentage: string;
  onCasePlanPercentageChange: (value: string) => void;
  /** 函数反映（表示中の商品区分の計画函数へ前年実績比を適用。確認ダイアログは画面が出す） */
  onApplyCasePlan: () => void;
}

// 一括操作：前月計画コピー・本部計画コピー・函数反映（前年実績比の入力欄があるため Popover で組む）
export function PlanBulkActionsMenu({
  onPlanCopy,
  onHeadquartersCopy,
  casePlanPercentage,
  onCasePlanPercentageChange,
  onApplyCasePlan,
}: PlanBulkActionsMenuProps) {
  const [open, setOpen] = React.useState(false);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <MenuTriggerButton label="一括操作" aria-haspopup="menu" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-56 p-1">
        <div role="menu" aria-label="一括操作" className="flex flex-col">
          <button
            type="button"
            role="menuitem"
            className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            onClick={run(onPlanCopy)}
          >
            前月計画コピー
          </button>
          {onHeadquartersCopy && (
            <button
              type="button"
              role="menuitem"
              className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onClick={run(onHeadquartersCopy)}
            >
              本部計画コピー
            </button>
          )}
          <div className="my-1 border-t border-gray-200" />
          {/* 函数反映：前年実績比を入れて「反映」（表示中の商品区分の計画函数へ適用） */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-sm whitespace-nowrap">
            <label htmlFor="case-plan-percentage">函数反映　前年実績比</label>
            <Input
              id="case-plan-percentage"
              type="text"
              value={casePlanPercentage}
              onChange={(e) => {
                // 整数3桁・小数第1位まで入力可能（数字と小数点のみ許可）
                const value = e.target.value
                  .replace(/[^0-9.]/g, '')
                  .replace(/(\..*)\./g, '$1')
                  .replace(/^(\d{0,3})(\.\d?)?.*$/, '$1$2');
                onCasePlanPercentageChange(value);
              }}
              className={`${TEXT_INPUT_CLASS} w-15 text-right`}
              maxLength={5}
            />
            <span>%</span>
            <button
              type="button"
              className="btn-toolbar-outline ml-auto"
              onClick={run(onApplyCasePlan)}
            >
              反映
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 率設定：年契基本分・センターフィ等の右ペインを開く（項目名の右に設定値〔平均〕を出す）
interface PlanRateMenuProps {
  items: PlanRateLinkItem[];
}

export function PlanRateMenu({ items }: PlanRateMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton label="率設定" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            className={MENU_ITEM_CLASS}
            onSelect={() => item.onClick?.()}
          >
            {item.label}
            <span className="ml-auto font-bold text-gray-700">
              {item.value}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface PlanRelatedScreenItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// 関連画面：年間計画・シミュレーションへ移る
interface PlanRelatedScreensMenuProps {
  items: PlanRelatedScreenItem[];
}

export function PlanRelatedScreensMenu({ items }: PlanRelatedScreensMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton label="関連画面" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            className={MENU_ITEM_CLASS}
            disabled={item.disabled}
            onSelect={() => item.onClick()}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 販売計画(詳細)／拡売費計画の切替（見出しの行の先頭に置く。SegmentToggle → 02 §6）
export const PLAN_DETAIL_SECTION_OPTIONS = [
  { value: 'sales-detail', label: '販売計画(詳細)' },
  { value: 'non-product-expense', label: '拡売費計画' },
] as const;
