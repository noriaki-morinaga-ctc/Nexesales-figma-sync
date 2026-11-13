// 支払詳細(自販機)：支払回数の選択・支払回数追加・支払情報引用の行

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
  // 支払情報引用（引用明細選択ペインを開く）
  onQuotePaymentInfo: () => void;
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
      <button
        type="button"
        className="btn-toolbar-outline ml-4"
        onClick={onQuotePaymentInfo}
        aria-label="支払情報引用"
      >
        <Copy className="h-4 w-4" />
        支払情報引用
      </button>
    </div>
  );
}
