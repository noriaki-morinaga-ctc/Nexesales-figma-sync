
import { Diff, Plus, Triangle } from 'lucide-react';
import { GRID_COLORS } from '@/components/grid';

// 増減（差分）の共通表示ユーティリティ＋セルコンポーネント（UI共通）。
// gridStyles には配色定数（increaseText/decreaseText）のみを置き、
// 差分の整形・配色判定・アイコン表示ロジックは本UIコンポーネントに集約する。

// 数値 → 増減表示文字列。プラス＝「+N」／マイナス＝「▲N」／ゼロ＝「0」。
// isPercent=true で末尾に「%」を付与し、率は小数点以下3桁を四捨五入して2桁で表示する。
// 金額・函数は整数表示のままとし、小数を持つ場合のみ小数点以下2桁で表示する。
export function formatDelta(num: number, isPercent = false): string {
  if (!Number.isFinite(num)) return '';
  const abs = Math.abs(num);
  const body = isPercent
    ? `${abs.toFixed(2)}%`
    : Number.isInteger(abs)
      ? String(abs)
      : abs.toFixed(2);
  if (num > 0) return `+${body}`;
  if (num < 0) return `▲${body}`;
  return isPercent ? '0.00%' : '0';
}

// 表示文字列の符号から増減の文字色を返す（＋＝青字 / ▲・−＝赤字 / それ以外＝なし）。
// 「▲123」「+100」「-50」などの差分表記を解釈する（符号なし・±0・空は色なし）。
export function deltaTextColor(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (/^[▲△−-]/.test(raw)) return GRID_COLORS.decreaseText; // マイナス＝赤字
  if (/^[＋+]/.test(raw)) return GRID_COLORS.increaseText; // プラス＝青字
  return undefined; // 符号なし・ゼロ・空は既定色
}

// 増減（差分）セルの共通表示コンポーネント（AG Grid の cellRenderer 用）。
// 画面設計標準の差分表現を全画面共通でアイコン表示する。
//   ・プラス（＋）＝Plus アイコン（青字）
//   ・マイナス（▲・−）＝Triangle(▲) アイコン（赤字）
//   ・ゼロ・符号なし＝Diff アイコン（既定色）
// value は formatDelta 由来の文字列（"+N" / "▲N" / "0" / "0%"）を想定し、
// 先頭の符号記号をアイコンに置き換え、数値部分（絶対値）を併記する。
export function DeltaCell(props: { value?: unknown }) {
  const raw = String(props.value ?? '').trim();
  if (raw === '') return null;

  const isNeg = /^[▲△−-]/.test(raw);
  const isPos = /^[＋+]/.test(raw);
  // 先頭の符号記号を除いた数値部分（"▲123" → "123"、"0%" → "0%"）
  const body = raw.replace(/^[▲△＋+−-]/, '');
  const Icon = isNeg ? Triangle : isPos ? Plus : Diff;
  const color = deltaTextColor(raw);

  return (
    <span
      className="inline-flex items-center justify-end gap-1 w-full"
      style={color ? { color } : undefined}
    >
      <Icon className={`w-3 h-3 ${isNeg ? 'fill-current' : ''}`} aria-hidden />
      {body}
    </span>
  );
}
