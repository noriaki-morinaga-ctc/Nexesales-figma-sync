import { useLayoutEffect, useState } from 'react';
import { toast } from 'sonner';
import { RightPane } from '../ui/right-pane';
import { Button } from '../ui/button';
import { NumericInput } from '../ui/numeric-input';
import { ConfirmDialog } from '../ui/confirm-dialog';

// 一次店/三次店ごとの固定マージン率・固定NETを入力する共通ペイン。
// variant で「マージン率（%）」と「固定NET」を切り替える。
// 一括入力は各行の入力欄へ値をコピーする補助機能で、計画への確定は「更新」ボタンで行う
// （センターフィ率・取組強化マージン率の率設定ペインと同一仕様）。
// マージン率・NETともに小数点以下2桁まで入力を許可し、必須・上限のチェックを行う。
// 右ペイン（RightPane）・更新確認ダイアログ・トーストはこのコンポーネント内で完結する。
// 入力中の下書きは開閉しても保持する（センターフィ率・取組強化マージン率の率設定ペインと同一挙動）。

export interface MarginRate {
  tier1: string;
  tier3: string;
  rate: number;
}

export interface NetRate {
  tier1: string;
  tier3: string;
  net: number;
}

// 上限値（暫定。確定値はアサヒ様よりご提示いただき次第差し替える）
const MARGIN_RATE_MAX = 100;
const NET_MAX = 9999.99;

// variantごとにプロパティの型を切り替える（marginはrate、netはnetを保持）
type MarginNetRatePaneProps = {
  /** 右ペインの表示状態 */
  open: boolean;
  /** 右ペインを閉じるハンドラ */
  onClose: () => void;
  /** ペインのタイトル（既定: variantに応じて 固定マージン率／固定NET） */
  title?: string;
  /** ペインの説明（既定: 空。上部タイトルで補完できるため率設定ペイン群では表示しない） */
  description?: string;
  /** 折り畳み（付箋）状態。親が保持する場合に指定する */
  collapsed?: boolean;
  /** 折り畳み状態の変更通知 */
  onCollapsedChange?: (collapsed: boolean) => void;
} & (
  | {
      variant: 'margin';
      rates: MarginRate[];
      onRatesChange: (rates: MarginRate[]) => void;
    }
  | {
      variant: 'net';
      rates: NetRate[];
      onRatesChange: (rates: NetRate[]) => void;
    }
);

export function MarginNetRatePane(props: MarginNetRatePaneProps) {
  const isNet = props.variant === 'net';
  const [bulkValue, setBulkValue] = useState('');
  // 各行の入力値（確定前の下書き）。空文字を許容してプレースホルダを表示する。
  const [rowValues, setRowValues] = useState<string[]>([]);
  // 更新確認ダイアログの表示状態
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  // 「更新」せずに×などで閉じた下書きは保存していないため、開き直したときに破棄し、
  // 親が保持する確定済みの値を表示する（年契基本分・センターフィ率・取組強化マージン率の
  // 率設定ペインと同一挙動。折り畳みは閉じないため下書きを保持する）。
  useLayoutEffect(() => {
    if (!props.open) return;
    setRowValues([]);
    setBulkValue('');
    setShowUpdateConfirm(false);
  }, [props.open]);

  // ペインのタイトル（未指定時は variant から既定値を決定）
  const paneTitle =
    props.title ?? (isNet ? '固定NET設定' : '固定マージン率設定');
  // 説明文言は上部タイトルで補完できるため既定では表示しない（率設定ペイン群で統一）。
  // 空文字のとき RightPane は sr-only で読み上げのみ残す。
  const paneDescription = props.description ?? '';

  // 列見出し（variantで切替）
  const headerLabel = isNet ? '固定NET' : 'マージン率 (%)';
  // 単位・上限・プレースホルダ（variantで切替）
  const unitLabel = isNet ? '円' : '%';
  const maxValue = isNet ? NET_MAX : MARGIN_RATE_MAX;
  const placeholder = isNet ? '10.00' : '10';

  // 各行の数値を取得（variantに応じてrate/netを参照）
  const getRowValue = (item: MarginRate | NetRate): number =>
    isNet ? (item as NetRate).net : (item as MarginRate).rate;

  // 各行の表示値。下書き未入力の行は親が保持する現在値で補完する
  // （小数点以下3桁を四捨五入し、小数点以下2桁に揃えて表示する）。
  const effectiveValues = (props.rates as (MarginRate | NetRate)[]).map(
    (item, index) => rowValues[index] ?? getRowValue(item).toFixed(2)
  );

  // 小数点以下2桁まで許可（マージン率・NET共通）
  const isWithinTwoDecimals = (value: string): boolean =>
    /^\d*(\.\d{0,2})?$/.test(value);

  // 行ごとのエラーメッセージ（未入力・上限超過）。エラーが無ければ null。
  const getRowError = (value: string): string | null => {
    if (value === '') return '入力してください';
    if (Number(value) > maxValue)
      return `${maxValue.toLocaleString('ja-JP')}${unitLabel}以下で入力してください`;
    return null;
  };

  const hasError = effectiveValues.some((value) => getRowError(value) !== null);

  // 一括入力：各行の入力欄へ値をコピーするのみ。計画への確定は「更新」ボタンで行う。
  const handleApplyToAll = () => {
    if (!bulkValue) return;
    setRowValues(effectiveValues.map(() => bulkValue));
  };

  // 各行の値を更新（下書きのみ更新し、親へは反映しない）
  const handleRowChange = (index: number, value: string) => {
    const updated = [...effectiveValues];
    updated[index] = value;
    setRowValues(updated);
  };

  // 更新確認ダイアログでOK後に実行：下書きの値を親へ反映し、トースト表示してペインを閉じる。
  const handleUpdate = () => {
    if (props.variant === 'net') {
      props.onRatesChange(
        props.rates.map((item, index) => ({
          ...item,
          net: Number(effectiveValues[index]),
        }))
      );
    } else {
      props.onRatesChange(
        props.rates.map((item, index) => ({
          ...item,
          rate: Number(effectiveValues[index]),
        }))
      );
    }
    toast.success(
      `${paneTitle}を販売計画表に反映しました。保存ボタンでデータが保存されます。`
    );
    props.onClose();
  };

  // 更新ボタン押下：入力エラーがある場合は確認ダイアログを出さずに中断する
  const handleClickUpdate = () => {
    if (hasError) {
      toast.error('入力内容に誤りがあります。エラー箇所をご確認ください。');
      return;
    }
    setShowUpdateConfirm(true);
  };

  return (
    <>
      <RightPane
        open={props.open}
        onClose={props.onClose}
        title={paneTitle}
        description={paneDescription}
        collapsed={props.collapsed}
        onCollapsedChange={props.onCollapsedChange}
      >
        {/* 一括入力エリア（各行への入力補助。確定は「更新」ボタン。率設定ペイン群で表記統一） */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-sm whitespace-nowrap">一括入力:</span>
            <div className="flex items-center gap-2 flex-1">
              <NumericInput
                step="0.01"
                value={bulkValue}
                onChange={(e) => {
                  if (isWithinTwoDecimals(e.target.value)) {
                    setBulkValue(e.target.value);
                  }
                }}
                className="w-24 h-9 text-right bg-white border-gray-300"
                placeholder={placeholder}
              />
              <span className="text-sm">{unitLabel}</span>
            </div>
            <Button
              onClick={handleApplyToAll}
              variant="outline"
              size="sm"
              className="text-xs whitespace-nowrap"
            >
              ↓全行に入力
            </Button>
          </div>
          <div className="mt-2 text-xs text-blue-700">
            ※ 各行へ数値をコピーします。個別に修正可能です。
          </div>
        </div>

        <div className="text-sm text-center text-gray-600 py-2">
          ↓ 各行の入力欄へ反映（編集可能）
        </div>

        {/* 商流一覧テーブル */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* テーブルヘッダー */}
          <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-medium text-gray-900">
              一次店/三次店
            </div>
            <div className="text-sm font-medium text-gray-900 text-right w-40">
              {headerLabel}
            </div>
          </div>

          {/* テーブルボディ（一次店/三次店が少ない行数で収まるよう余白を縮小） */}
          <div className="divide-y divide-gray-200">
            {props.rates.map((item, index) => {
              const value = effectiveValues[index] ?? '';
              const error = getRowError(value);
              return (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-sm text-gray-900">
                    {item.tier1} / {item.tier3}
                  </div>
                  <div className="w-40">
                    <div className="flex items-center justify-end gap-2">
                      <NumericInput
                        step="0.01"
                        value={value}
                        onChange={(e) => {
                          if (isWithinTwoDecimals(e.target.value)) {
                            handleRowChange(index, e.target.value);
                          }
                        }}
                        className="w-24 h-8 text-right text-sm bg-white border-gray-300"
                        placeholder={placeholder}
                        aria-invalid={error !== null}
                      />
                      <span className="text-sm text-gray-600">{unitLabel}</span>
                    </div>
                    {error && (
                      <p className="mt-1 text-xs text-red-600 text-right">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 更新ボタン（右ペイン右下ではなく入力欄の最下段直下に配置） */}
        <div className="mt-4 flex justify-end">
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
            onClick={handleClickUpdate}
          >
            更新
          </Button>
        </div>
      </RightPane>

      {/* 更新確認: 当月以降のすべての販売計画表へ反映する旨を確認 */}
      <ConfirmDialog
        open={showUpdateConfirm}
        title="保存の確認"
        confirmLabel="保存"
        description="本設定を更新後に販売計画表の保存を実行すると、当月以降のすべての販売計画表に反映されます。本当によろしいですか？"
        onConfirm={() => {
          setShowUpdateConfirm(false);
          handleUpdate();
        }}
        onCancel={() => setShowUpdateConfirm(false)}
      />
    </>
  );
}
