// 支払詳細の「支払回数」の行（支払回数の選択・支払回数追加・支払情報引用）。
// 手売り（追加口請求書有・追加口請求書無・商流販売店紐づけなし）と自販機で共通（UI/UX UX-113 → 02 §10.4）。
// 「支払回数」の項目名は、下の支払情報カードの項目名（支払先）と縦にそろえる（px-4＝カードの本文の余白）。

import { Plus, Copy } from 'lucide-react';
import { FORM_LABEL_CLASS } from '@/styles/commonStyles';

import { SingleCombobox } from '@/app/components/ui/single-combobox';

interface PaymentRoundBarProps {
  // 支払回数の選択肢
  roundOptions: string[];
  // 選択中の支払回数
  invoiceCount: string;
  // 回を選ぶ（確認のうえ表示を切り替える）
  onSelectRound: (round: string) => void;
  // 支払回数追加
  onAddRound: () => void;
  // 支払情報引用（引用明細選択ペインを開く）。渡さない画面（見積など）はボタンを出さない
  onQuotePaymentInfo?: () => void;
}

export function PaymentRoundBar({
  roundOptions,
  invoiceCount,
  onSelectRound,
  onAddRound,
  onQuotePaymentInfo,
}: PaymentRoundBarProps) {
  return (
    <div className="flex items-center gap-2 px-4">
      <label
        htmlFor="invoice-count"
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
      >
        支払回数
      </label>
      {/* 回を選ぶと、確認のうえその回の保存内容へ表示を切り替える */}
      <SingleCombobox
        id="invoice-count"
        className="w-20"
        options={[...roundOptions.map((n) => ({ value: n, label: n }))]}
        value={invoiceCount}
        onChange={onSelectRound}
        placeholder="選択"
        searchable={false}
      />
      {/* 支払回数追加（支払回数の右・左に全角2文字程度の空白） */}
      <button
        type="button"
        className="btn-toolbar-outline ml-8"
        onClick={onAddRound}
        aria-label="支払回数追加"
      >
        <Plus className="h-4 w-4" />
        支払回数追加
      </button>
      {/* 支払情報引用（支払回数追加の右・間隔は全角1文字分＝1rem） */}
      {onQuotePaymentInfo && (
        <button
          type="button"
          className="btn-toolbar-outline ml-4"
          onClick={onQuotePaymentInfo}
          aria-label="支払情報引用"
        >
          <Copy className="h-4 w-4" />
          支払情報引用
        </button>
      )}
    </div>
  );
}
