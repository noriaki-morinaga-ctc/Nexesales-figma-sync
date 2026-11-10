import {
  hasSimulationExpense,
  simulationExpenseItems,
  type SimulationExpenseRow,
} from '../../../../constants/planDeleteItems';
import { valueOrEmpty } from '../../../ui/empty-value';

interface SimulationExpenseDeleteInfoProps {
  // 削除対象のシミュレーション明細行（拡売費①②を exp1/exp2 接頭辞で持つ）
  data?: SimulationExpenseRow;
}

interface InfoRowProps {
  label: string;
  value: string;
}

// 削除確認ペインの「ラベル: 値」1行。値が無いときはグレーの「-」（valueOrEmpty）（DeleteConfirmPane の items と同じ体裁）
function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex gap-2">
      <span className="font-bold text-gray-600 w-32">{label}:</span>
      <span className="text-gray-900">{valueOrEmpty(value)}</span>
    </div>
  );
}

interface ExpenseBlockProps {
  title: string;
  data?: SimulationExpenseRow;
  prefix: 'exp1' | 'exp2';
}

// 拡売費①／②の内訳ブロック。未入力のブロックは「-」1行にまとめる。
function ExpenseBlock({ title, data, prefix }: ExpenseBlockProps) {
  if (!hasSimulationExpense(data, prefix)) {
    return <InfoRow label={title} value="-" />;
  }
  return (
    <div className="space-y-2">
      <p className="font-bold text-gray-700">{title}</p>
      <div className="space-y-2 pl-4">
        {simulationExpenseItems(data, prefix).map((item) => (
          <InfoRow
            key={item.label}
            label={item.label}
            value={String(item.value)}
          />
        ))}
      </div>
    </div>
  );
}

// シミュレーション(詳細)の明細削除ペインに、KEY項目に続けて拡売費①②の内訳を表示する。
// DeleteConfirmPane の items は「ラベル → 値」の1階層のみで、拡売費①②は同じ項目名が
// 重複するため、見出し付きのブロックとして children に差し込む。
export function SimulationExpenseDeleteInfo({
  data,
}: SimulationExpenseDeleteInfoProps) {
  // 拡売費①②がどちらも内訳を出すときは行が続けて並ぶため、
  // ②の上に1行分（pt-6＝1.5rem）の余白を足して区切りを分かりやすくする。
  const bothFilled =
    hasSimulationExpense(data, 'exp1') && hasSimulationExpense(data, 'exp2');
  return (
    <div className="space-y-3 pt-2 border-t border-gray-200">
      <ExpenseBlock title="拡売費①" data={data} prefix="exp1" />
      <div className={bothFilled ? 'pt-6' : undefined}>
        <ExpenseBlock title="拡売費②" data={data} prefix="exp2" />
      </div>
    </div>
  );
}
