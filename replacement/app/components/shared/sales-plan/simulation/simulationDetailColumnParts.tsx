// 販売計画シミュレーション（NET固定・マージン率固定）の明細表で、2画面とも同じ列の部品
// （セルの色・入力可否・比較列の値の出し入れ・更新KEYの重複チェック・企画の連動・拡売費①②の列）。
// 画面ごとに違う「算出列の再計算」「更新KEYの単価にNETを使うか」「算出列の一覧」は引数で受け取る。
// 各画面の列の定義（utilsDetailColumns.tsx）は最初の描画で1回だけこれを呼ぶ。
import type { MutableRefObject } from 'react';
import { ColDef } from 'ag-grid-community';

import { toast } from 'sonner';
import { registeredCampaignName } from '@/app/utils/sales-plan/simulation/simulationCampaignName';
import {
  GRID_COLORS,
  formatEmptyAsDash,
  changedCellStyle,
  requiredEmptyCellStyle,
  useChangedCells,
  useLinkedCellUndo,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  asCellStyle,
} from '@/app/components/grid';
import { formatDelta, deltaTextColor } from '@/app/components/ui/delta-cell';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmount,
  formatPlanRate,
  roundPlanNumber,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import {
  hasSameSimulationKey,
  simulationKeyDuplicateMessage,
} from '@/app/utils/sales-plan/simulation/simulationConfirmRules';
import { MonthYearCellEditor } from '@/app/components/ui/month-year-cell-editor';
import { SingleComboboxCellEditor } from '@/app/components/ui/single-combobox-cell-editor';

import {
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from '@/app/constants/expenseRelations';
import {
  managementClassFromCode,
  campaignClassFromCode,
  isManagementCodeInClass,
  isCampaignCodeInClass,
} from '@/app/utils/common/expenseRelations';
import {
  managementClassComboOptions,
  managementClassCodeComboOptions,
  managementCodeComboOptions,
  managementCodeNameComboOptions,
  campaignClassComboOptions,
  campaignClassCodeComboOptions,
  campaignCodeComboOptions,
  campaignCodeNameComboOptions,
} from '@/app/constants/comboFieldOptions';
import {
  managementClassCodeOf,
  managementClassNameOf,
  managementCodeNameOf,
  managementCodeOfName,
  campaignClassCodeOf,
  campaignClassNameOf,
  campaignCodeNameOf,
  campaignCodeOfName,
} from '@/app/utils/common/comboFieldOptions';
import type { ProductData } from '@/app/types/simulation';
import { parseSimMetric } from '@/app/utils/sales-plan/simulation/simulationMetricFormat';

// 拡売費の管理コード／施策コードの全候補（管理区分・施策区分で絞り込んで使う）
const MGMT_CODE_LIST = EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
const CAMPAIGN_CODE_LIST = EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value);
// 不採用行のグレーアウト背景（readonly より薄い灰。不採用は変更可能なため区別する）
const REJECTED_BG = GRID_COLORS.rejectedBg;
const parseMetric = parseSimMetric;

interface SimulationDetailColumnPartsDeps {
  allDataRef: MutableRefObject<ProductData[]>;
  handleUpdateRegularProduct: (updatedData: ProductData) => void;
  handleUpdateNewProduct: (updatedData: ProductData) => void;
  handleUpdatePromotionProduct: (updatedData: ProductData) => void;
  handleUpdateGiftProduct: (updatedData: ProductData) => void;
  isCellChanged: ReturnType<typeof useChangedCells>['isCellChanged'];
  makeLinkedHandler: ReturnType<
    typeof useLinkedCellUndo<ProductData>
  >['makeHandler'];
  // 算出列の再計算（行を直接更新する）
  recomputeDerived: (data: any) => void;
  // シミュレーション更新KEYの単価に NET を使うか（使わないときは納価）
  usesNetAsKey: (row: { targetMonth?: string }) => boolean;
  // 算出列（連動セルの Undo で主セルと一緒に退避・復元する従属セル）
  derivedFields: (keyof ProductData)[];
}

export const buildSimulationDetailColumnParts = ({
  allDataRef,
  handleUpdateRegularProduct,
  handleUpdateNewProduct,
  handleUpdatePromotionProduct,
  handleUpdateGiftProduct,
  isCellChanged,
  makeLinkedHandler,
  recomputeDerived,
  usesNetAsKey,
  derivedFields,
}: SimulationDetailColumnPartsDeps) => {
  // Yellow: 手入力可能セル
  const yellowCellStyle = asCellStyle((params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    // 確度が「反映済」「不採用」の場合はグレーアウト
    const probability = params.data?.probability;
    if (probability === '反映済') {
      return {
        backgroundColor: GRID_COLORS.readonly,
        cursor: 'pointer',
      };
    }
    if (probability === '不採用') {
      return {
        backgroundColor: REJECTED_BG,
        cursor: 'pointer',
      };
    }
    // 編集済みセルは黄色＋オレンジ枠で強調（gridStyles.ts 準拠）
    if (isCellChanged(params)) {
      return { ...changedCellStyle(), cursor: 'pointer' };
    }
    return { backgroundColor: GRID_COLORS.editable, cursor: 'pointer' };
  });
  // Yellow with red text for negative values (拡売費①、②用)
  const yellowCellStyleWithRedNegative = asCellStyle((params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    // 確度が「反映済」「不採用」の場合はグレーアウト
    const probability = params.data?.probability;
    const value = parseFloat(String(params.value || '').replace(/,/g, ''));
    const isNegative = !isNaN(value) && value < 0;

    if (probability === '反映済') {
      return {
        backgroundColor: GRID_COLORS.readonly,
        cursor: 'pointer',
        ...(isNegative && { color: GRID_COLORS.overText }),
      };
    }
    if (probability === '不採用') {
      return {
        backgroundColor: REJECTED_BG,
        cursor: 'pointer',
        ...(isNegative && { color: GRID_COLORS.overText }),
      };
    }
    // 編集済みセルは黄色＋オレンジ枠で強調（マイナスは赤字を維持）
    if (isCellChanged(params)) {
      return {
        ...changedCellStyle(),
        cursor: 'pointer',
        ...(isNegative && { color: GRID_COLORS.overText }),
      };
    }
    if (isNegative) {
      return {
        backgroundColor: GRID_COLORS.editable,
        cursor: 'pointer',
        color: GRID_COLORS.overText,
      };
    }
    return { backgroundColor: GRID_COLORS.editable, cursor: 'pointer' };
  });
  // White: 自動表示・参照セル
  const whiteCellStyle = (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    // 確度が「反映済」「不採用」の場合はグレーアウト
    const probability = params.data?.probability;
    if (probability === '反映済') {
      return { backgroundColor: GRID_COLORS.readonly };
    }
    if (probability === '不採用') {
      return { backgroundColor: REJECTED_BG };
    }
    return { backgroundColor: GRID_COLORS.readonly };
  };
  // 白背景・マイナス値は赤字
  const whiteCellStyleWithRedNegative = (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    // 確度が「反映済」「不採用」の場合はグレーアウト
    const probability = params.data?.probability;
    const value = parseFloat(String(params.value || '').replace(/,/g, ''));
    const isNegative = !isNaN(value) && value < 0;

    if (probability === '反映済') {
      return {
        backgroundColor: GRID_COLORS.readonly,
        ...(isNegative && { color: GRID_COLORS.overText }),
      };
    }
    if (probability === '不採用') {
      return {
        backgroundColor: REJECTED_BG,
        ...(isNegative && { color: GRID_COLORS.overText }),
      };
    }
    if (isNegative) {
      return {
        backgroundColor: GRID_COLORS.readonly,
        color: GRID_COLORS.overText,
      };
    }
    return { backgroundColor: GRID_COLORS.readonly };
  };
  // 商品区分ごとに背景色を切り替え、マイナス値は赤字にするファクトリ
  const makeCellStyleWithRedNegative =
    (
      rules: Record<string, 'yellow' | 'white' | 'gray'>,
      defaultStyle: 'yellow' | 'white' | 'gray' = 'white'
    ) =>
    (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;

      // 確度が「反映済」「不採用」の場合はグレーアウト
      const probability = params.data?.probability;
      const value = parseFloat(String(params.value || '').replace(/,/g, ''));
      const isNegative = !isNaN(value) && value < 0;

      if (probability === '反映済') {
        return {
          backgroundColor: GRID_COLORS.readonly,
          cursor: 'pointer',
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      if (probability === '不採用') {
        return {
          backgroundColor: REJECTED_BG,
          cursor: 'pointer',
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }

      const cat: string = params.data?.productCategory ?? '';
      const style = rules[cat] ?? defaultStyle;

      if (style === 'yellow') {
        // 編集済みセルは黄色＋オレンジ枠で強調（マイナスは赤字を維持）
        if (isCellChanged(params)) {
          return {
            ...changedCellStyle(),
            cursor: 'pointer',
            ...(isNegative && { color: GRID_COLORS.overText }),
          };
        }
        return {
          backgroundColor: GRID_COLORS.editable,
          cursor: 'pointer',
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      if (style === 'gray')
        return {
          backgroundColor: GRID_COLORS.readonly,
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      return {
        backgroundColor: GRID_COLORS.readonly,
        ...(isNegative && { color: GRID_COLORS.overText }),
      };
    };
  // 指定商品区分のみ編集可能にするファクトリ
  // 確度が「反映済」の行は編集不可（プルダウン非活性）
  const isReflectedRow = (params: any) => params.data?.probability === '反映済';
  // ヘッダー行・合計行・反映済行は編集不可、それ以外は編集可
  const baseEditable = (params: any) =>
    !params.data?._isHeader &&
    !params.node?.rowPinned &&
    !isReflectedRow(params);
  // 数値→文字列。digits を渡した項目は項目一覧の桁数へ四捨五入して保持する。
  // 省略時は従来どおり整数はそのまま／小数は2桁で表示する。
  const formatMetric = (num: number, isPercent: boolean, digits?: number) => {
    if (!isFinite(num)) return '';
    if (digits !== undefined)
      return isPercent
        ? formatPlanRate(num, digits)
        : roundPlanNumber(num, digits);
    const s = Number.isInteger(num) ? String(num) : num.toFixed(2);
    return isPercent ? `${s}%` : s;
  };
  // 増減の表記（+N／▲N／0）を項目一覧の桁数で作る。
  // 共通の formatDelta は桁数指定を持たないため、桁指定がある項目のみ本関数で整形する。
  const formatMetricDelta = (
    num: number,
    isPercent: boolean,
    digits?: number
  ) => {
    if (digits === undefined) return formatDelta(num, isPercent);
    if (!isFinite(num)) return '';
    const abs = Math.abs(num);
    const body = isPercent
      ? formatPlanRate(abs, digits)
      : formatPlanAmount(abs, digits);
    if (num > 0) return `+${body}`;
    if (num < 0) return `▲${body}`;
    return body;
  };
  // section に応じた state 同期（連動セルの共通フックの syncState 用）。
  // フックが node.data 更新・行の再描画を済ませるため state だけを更新し、rowData は作り直さない（→ 02 §7.1）。
  const syncRowState = (row: ProductData) => {
    if (row.section === '定番商品') handleUpdateRegularProduct(row);
    else if (row.section === '新商品') handleUpdateNewProduct(row);
    else if (row.section === '特殊商品') handleUpdatePromotionProduct(row);
    else if (row.section === 'ギフト') handleUpdateGiftProduct(row);
  };
  // section に応じた更新（4分岐の一本化）
  const routeUpdate = (params: any, updatedData: ProductData) => {
    // rowData は値編集で作り直さない（Undo 履歴を維持する → 02 §7.1）ため、当該ノードの
    // data を直接更新し行内の全セル（増減・マージン率などの算出列）を再描画する。
    Object.assign(params.data, updatedData);
    params.api?.refreshCells({ rowNodes: [params.node], force: true });
    const s = params.data?.section;
    if (s === '定番商品') params.context.updateRegularProduct(updatedData);
    else if (s === '新商品') params.context.updateNewProduct(updatedData);
    else if (s === '特殊商品')
      params.context.updatePromotionProduct(updatedData);
    else if (s === 'ギフト') params.context.updateGiftProduct(updatedData);
  };
  // 変更後セル：入力値をそのまま変更後の値にする（符号を付けた相対入力は行わない）
  const makeAfterSetter =
    (field: string, isPercent: boolean, digits?: number) => (params: any) => {
      const raw = String(params.newValue ?? '').trim();
      if (raw === '') {
        params.data[field] = '';
        return true;
      }
      const after = parseMetric(raw);
      if (isNaN(after)) return false;
      params.data[field] = formatMetric(after, isPercent, digits);
      return true;
    };
  // 増減の基準（変更前）。計画函数は空欄なら0として扱う（10/27 第4回 決定事項21）。
  // 空欄＝元の計画に無い明細のため、変更後がそのまま「+」の増減になる。
  // NET・納価・売価は従来どおり（どちらかが空なら増減も空欄）。
  const deltaBaseOf = (field: string, data: any): number => {
    const before = parseMetric(data?.[`${field}Before`]);
    return field === 'plan' && isNaN(before) ? 0 : before;
  };
  // 増減 = 変更後 − 変更前（保存せず都度算出）
  const makeDeltaGetter =
    (field: string, isPercent: boolean, digits?: number) => (params: any) => {
      if (params.data?._isHeader) return '';
      // 合計行（ピン留め）も「変更後合計 − 変更前合計」で増減合計を算出
      const before = deltaBaseOf(field, params.data);
      const after = parseMetric(params.data?.[field]);
      if (isNaN(before) || isNaN(after)) return '';
      const dv = after - before;
      // プラス＝+N／マイナス＝▲N／ゼロ＝0（共通ユーティリティ formatDelta）
      return formatMetricDelta(dv, isPercent, digits);
    };
  // 増減セルのスタイル（編集可=黄／不可=灰、増加=青字／減少=赤字）
  const deltaCellStyle = (editableFn: (p: any) => boolean) => (params: any) => {
    if (params.data?._isHeader) return undefined;
    const probability = params.data?.probability;
    // 増減の文字色（増加＝青字／減少＝赤字）は共通ユーティリティで判定
    const deltaColor = deltaTextColor(params.value);
    // 合計行（ピン留め）：背景は行スタイル(total)に任せ、増減の文字色のみ付与
    if (params.node?.rowPinned)
      return deltaColor ? { color: deltaColor } : undefined;
    if (probability === '反映済')
      return {
        backgroundColor: GRID_COLORS.readonly,
        ...(deltaColor && { color: deltaColor }),
      };
    if (probability === '不採用')
      return {
        backgroundColor: REJECTED_BG,
        ...(deltaColor && { color: deltaColor }),
      };
    const editable = editableFn(params);
    return {
      backgroundColor: editable ? GRID_COLORS.editable : GRID_COLORS.readonly,
      ...(editable && { cursor: 'pointer' }),
      ...(deltaColor && { color: deltaColor }),
    };
  };
  // 変更後セル：基本スタイル＋変更時ハイライト（changedCellStyle）
  const makeAfterStyle =
    (field: string, baseStyle: (p: any) => any) => (params: any) => {
      const base = baseStyle(params) || {};
      if (params.data?._isHeader || params.node?.rowPinned) return base;
      if (isReflectedRow(params)) return base;
      const before = parseMetric(params.data?.[`${field}Before`]);
      const after = parseMetric(params.data?.[field]);
      if (!isNaN(before) && !isNaN(after) && before !== after) {
        return { ...base, ...changedCellStyle() };
      }
      return base;
    };
  // 必須項目（企画・確度・企画名）が未入力のセルは、入力が必要であることを示すため
  // 赤の破線枠＋赤字で強調する。販売計画(コピー元)からのコピーは企画・確度・企画名を
  // ー（未選択）で追加するため、そのままでは保存できない行であることを画面上で示す。
  // 反映済など編集できない行は入力を促す対象にならないため強調しない。
  const requiredCellStyle = (params: any) => {
    const base = yellowCellStyle(params);
    if (!baseEditable(params)) return base;
    const isEmpty = String(params.value ?? '').trim() === '';
    return isEmpty ? requiredEmptyCellStyle(base) : base;
  };
  // シミュレーション更新KEYの重複チェック付きの valueSetter を作る（VL-04）。
  // 企画・確度・NET・納価の入力確定時に、KEYが同じ明細が他にあれば元の値に戻してトーストで知らせる。
  const withSimulationKeyCheck =
    (field: keyof ProductData, setValue: (params: any) => boolean) =>
    (params: any) => {
      const prevValue = params.data[field];
      if (!setValue(params)) return false;
      if (hasSameSimulationKey(params.data, allDataRef.current, usesNetAsKey)) {
        params.data[field] = prevValue; // 変更を破棄
        toast.error(simulationKeyDuplicateMessage('変更'));
        return false;
      }
      return true;
    };
  const campaignValueSetter = withSimulationKeyCheck('campaign', (params) => {
    params.data.campaign = params.newValue ?? '';
    return true;
  });
  const probabilityValueSetter = withSimulationKeyCheck(
    'probability',
    (params) => {
      params.data.probability = params.newValue ?? '';
      return true;
    }
  );
  const netValueSetter = withSimulationKeyCheck(
    'net',
    makeAfterSetter('net', false, PLAN_DETAIL_DIGITS.price)
  );
  const napaValueSetter = withSimulationKeyCheck(
    'planPrice',
    makeAfterSetter('planPrice', false, PLAN_DETAIL_DIGITS.price)
  );
  // 企画を選んだら、同じ対象年月・同じ企画の明細に登録済みの企画名を設定する（無ければ空欄）。
  // 従属セルの Undo は主セル1回で戻す共通フックに委譲する（→ 02 §7.3）。
  const handleCampaignChanged = makeLinkedHandler('campaign', {
    depFields: ['campaignName'],
    deriveDeps: (value, row) => ({
      campaignName: registeredCampaignName(
        allDataRef.current,
        row.targetMonth,
        value,
        row.id
      ),
    }),
    syncState: syncRowState,
  });
  // 列定義
  // 拡売費①②の共通列（計画金額～摘要1（社内用）の11列）を生成する。
  // 管理区分・管理コード・施策区分・施策コードは「区分値／コード」列と「名称」列に分け、
  // 行の保持値（管理区分＝名称／管理コード＝コード）から導出して相互に連動させる。
  // 作成者（exp1Creator/exp2Creator）は列表示しないが、行の追加・コピー時の記録として
  // データ側では引き続きログインユーザーを保持する。
  const refreshExpenseRow = (params: any) =>
    params.api?.refreshCells({ rowNodes: [params.node], force: true });
  const makeExpenseColumns = (prefix: 'exp1' | 'exp2'): ColDef[] => {
    // 以下4つの連動は共通フック（useLinkedCellUndo）に委譲する（→ 02 §7.3）。従属セルは
    // Undo スタックに積まれず、Ctrl+Z 1回で主セルと従属セル（自動補完・クリアした区分／コード、
    // 管理利益額などの算出列）がまとめて元に戻る。コード列・名称列のどちらから確定しても
    // 同じ結果になるよう、確定値（名称列では名称）ではなく行データの値を基準に導出する。
    const mgmtClassField = `${prefix}ManagementClass` as keyof ProductData;
    const mgmtCodeField = `${prefix}ManagementCode` as keyof ProductData;
    const accountItemField = `${prefix}AccountItem` as keyof ProductData;
    const campaignClassField = `${prefix}CampaignClass` as keyof ProductData;
    const campaignCodeField = `${prefix}CampaignCode` as keyof ProductData;
    // 管理コード（コード列・名称列のいずれか）確定時：管理区分・勘定科目を自動補完し、
    // 管理区分で管理利益額の費目（ロケ補填・固定費・自販機関連費）が変わるため再計算する
    const handleMgmtCodeChanged = makeLinkedHandler(mgmtCodeField, {
      depFields: [mgmtClassField, accountItemField, ...derivedFields],
      deriveDeps: (_value, row) => {
        const next: any = { ...row };
        const cls = managementClassFromCode(next[mgmtCodeField]);
        if (cls) {
          next[mgmtClassField] = cls;
          next[accountItemField] =
            EXPENSE_MANAGEMENT_CLASS_OPTIONS.find((o) => o.value === cls)
              ?.accountItem ?? next[accountItemField];
        }
        recomputeDerived(next);
        return next;
      },
      syncState: syncRowState,
    });
    // 管理区分（区分値列・名称列のいずれか）確定時：該当しない管理コードはクリアし、再計算する
    const handleMgmtClassChanged = makeLinkedHandler(mgmtClassField, {
      depFields: [mgmtCodeField, ...derivedFields],
      deriveDeps: (_value, row) => {
        const next: any = { ...row };
        const code = next[mgmtCodeField];
        if (code && !isManagementCodeInClass(code, next[mgmtClassField])) {
          next[mgmtCodeField] = '';
        }
        recomputeDerived(next);
        return next;
      },
      syncState: syncRowState,
    });
    // 施策コード（コード列・名称列のいずれか）確定時：施策区分を自動セット
    const handleCampaignCodeChanged = makeLinkedHandler(campaignCodeField, {
      depFields: [campaignClassField],
      deriveDeps: (_value, row) => ({
        [campaignClassField]:
          campaignClassFromCode(row[campaignCodeField] as string) ||
          row[campaignClassField],
      }),
      syncState: syncRowState,
    });
    // 施策区分（区分値列・名称列のいずれか）確定時：該当しない施策コードはクリア
    const handleCampaignClassChanged = makeLinkedHandler(campaignClassField, {
      depFields: [campaignCodeField],
      deriveDeps: (_value, row) => {
        const code = row[campaignCodeField] as string;
        const cls = row[campaignClassField] as string;
        return {
          [campaignCodeField]:
            code && !isCampaignCodeInClass(code, cls) ? '' : code,
        };
      },
      syncState: syncRowState,
    });

    // 拡売費①の必須項目（計画金額・計上年月・管理区分・管理コード）が全て未入力の行かを判定する
    const isExp1EmptyRow = (data: any): boolean =>
      [
        'PlannedAmountBefore',
        'PostingMonth',
        'ManagementClass',
        'ManagementCode',
      ].every((suffix) => String(data?.[`exp1${suffix}`] ?? '').trim() === '');
    // 拡売費②を編集不可にする行（拡売費①が全て未入力）。①→②の順で入力させる。
    const exp2Locked = (params: any) =>
      prefix === 'exp2' &&
      !params.data?._isHeader &&
      !params.node?.rowPinned &&
      isExp1EmptyRow(params.data);

    const columns: ColDef[] = [
      {
        // 変更後金額・増減金額は廃止し、計画金額（旧 変更前金額）を直接編集する
        headerName: '計画金額',
        field: `${prefix}PlannedAmountBefore`,
        ...GRID_NUMBER_TEXT_FILTER,
        width: 80,
        cellClass: 'ag-cell-right',
        cellStyle: yellowCellStyleWithRedNegative,
        editable: baseEditable,
        cellEditor: 'agTextCellEditor',
        valueFormatter: formatEmptyAsDash,
        valueSetter: (params: any) => {
          const raw = String(params.newValue ?? '').trim();
          params.data[`${prefix}PlannedAmountBefore`] =
            raw === '' ? '' : formatMetric(parseMetric(raw), false);
          return true;
        },
        onCellValueChanged: (params: any) => {
          // 計画金額は管理利益額（直接固定費・ロケ補填）の算出元のため再計算する
          recomputeDerived(params.data);
          // 拡売費①の入力有無で拡売費②の活性・グレーアウトが変わるため行を再描画する
          refreshExpenseRow(params);
          routeUpdate(params, { ...params.data });
        },
      },
      {
        headerName: '計上年月',
        field: `${prefix}PostingMonth`,
        ...GRID_MONTH_TEXT_FILTER,
        width: 96,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        // カレンダー入力フォーム（YYYY/MM）で入力
        editable: baseEditable,
        cellEditor: MonthYearCellEditor,
        cellEditorPopup: true,
        onCellValueChanged: (params: any) => {
          // 拡売費①の入力有無で拡売費②の活性・グレーアウトが変わるため行を再描画する
          refreshExpenseRow(params);
          routeUpdate(params, { ...params.data });
        },
      },
      {
        headerName: '管理区分',
        colId: `${prefix}ManagementClassCode`,
        width: 88,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        valueGetter: (params: any) =>
          managementClassCodeOf(
            params.data?.[`${prefix}ManagementClass`] ?? ''
          ),
        // 区分値で選択された場合も、行は管理区分の名称を保持する
        valueSetter: (params: any) => {
          params.data[`${prefix}ManagementClass`] = managementClassNameOf(
            params.newValue
          );
          return true;
        },
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: managementClassCodeComboOptions(),
          placeholder: '管理区分を選択',
        },
        onCellValueChanged: handleMgmtClassChanged,
      },
      {
        headerName: '管理区分名称',
        field: `${prefix}ManagementClass`,
        width: 136,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: managementClassComboOptions(),
          placeholder: '管理区分名称を選択',
        },
        onCellValueChanged: handleMgmtClassChanged,
      },
      {
        headerName: '管理コード',
        field: `${prefix}ManagementCode`,
        width: 104,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        // 管理区分が選択済みなら該当する管理コードのみに絞り込む
        cellEditorParams: (params: any) => {
          const cls = params.data[`${prefix}ManagementClass`];
          return {
            comboOptions: managementCodeComboOptions(
              MGMT_CODE_LIST.filter(
                (c) => !cls || isManagementCodeInClass(c, cls)
              )
            ),
            placeholder: '管理コードを選択',
          };
        },
        onCellValueChanged: handleMgmtCodeChanged,
      },
      {
        headerName: '管理コード名称',
        colId: `${prefix}ManagementCodeName`,
        width: 136,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        valueGetter: (params: any) =>
          managementCodeNameOf(params.data?.[`${prefix}ManagementCode`] ?? ''),
        // 名称で選択された場合も、行は管理コードを保持する
        valueSetter: (params: any) => {
          params.data[`${prefix}ManagementCode`] = managementCodeOfName(
            params.newValue
          );
          return true;
        },
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => {
          const cls = params.data[`${prefix}ManagementClass`];
          return {
            comboOptions: managementCodeNameComboOptions(
              MGMT_CODE_LIST.filter(
                (c) => !cls || isManagementCodeInClass(c, cls)
              )
            ),
            placeholder: '管理コード名称を選択',
          };
        },
        onCellValueChanged: handleMgmtCodeChanged,
      },
      {
        headerName: '施策区分',
        colId: `${prefix}CampaignClassCode`,
        width: 88,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        valueGetter: (params: any) =>
          campaignClassCodeOf(params.data?.[`${prefix}CampaignClass`] ?? ''),
        valueSetter: (params: any) => {
          params.data[`${prefix}CampaignClass`] = campaignClassNameOf(
            params.newValue
          );
          return true;
        },
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: campaignClassCodeComboOptions(),
          placeholder: '施策区分を選択',
        },
        onCellValueChanged: handleCampaignClassChanged,
      },
      {
        headerName: '施策区分名称',
        field: `${prefix}CampaignClass`,
        width: 120,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: campaignClassComboOptions(),
          placeholder: '施策区分名称を選択',
        },
        onCellValueChanged: handleCampaignClassChanged,
      },
      {
        headerName: '施策コード',
        field: `${prefix}CampaignCode`,
        width: 104,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        // 施策区分が選択済みなら該当する施策コードのみに絞り込む
        cellEditorParams: (params: any) => {
          const cls = params.data[`${prefix}CampaignClass`];
          return {
            comboOptions: campaignCodeComboOptions(
              CAMPAIGN_CODE_LIST.filter(
                (c) => !cls || isCampaignCodeInClass(c, cls)
              )
            ),
            placeholder: '施策コードを選択',
          };
        },
        onCellValueChanged: handleCampaignCodeChanged,
      },
      {
        headerName: '施策コード名称',
        colId: `${prefix}CampaignCodeName`,
        width: 152,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        valueGetter: (params: any) =>
          campaignCodeNameOf(params.data?.[`${prefix}CampaignCode`] ?? ''),
        valueSetter: (params: any) => {
          params.data[`${prefix}CampaignCode`] = campaignCodeOfName(
            params.newValue
          );
          return true;
        },
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => {
          const cls = params.data[`${prefix}CampaignClass`];
          return {
            comboOptions: campaignCodeNameComboOptions(
              CAMPAIGN_CODE_LIST.filter(
                (c) => !cls || isCampaignCodeInClass(c, cls)
              )
            ),
            placeholder: '施策コード名称を選択',
          };
        },
        onCellValueChanged: handleCampaignCodeChanged,
      },
      {
        headerName: '摘要1（社内用）',
        field: `${prefix}Description`,
        width: 120,
        cellClass: 'ag-cell-left',
        cellStyle: yellowCellStyle,
        editable: baseEditable,
        cellEditor: 'agTextCellEditor',
        onCellValueChanged: (params: any) =>
          routeUpdate(params, { ...params.data }),
      },
    ];

    if (prefix !== 'exp2') return columns;
    // 拡売費①が全て未入力の行では、拡売費②の入力列を編集不可＋グレーアウトにする
    return columns.map((col) =>
      col.editable === baseEditable
        ? {
            ...col,
            editable: (params: any) =>
              baseEditable(params) && !exp2Locked(params),
            cellStyle: (params: any) => {
              if (exp2Locked(params)) {
                return {
                  backgroundColor: GRID_COLORS.readonly,
                  cursor: 'default',
                };
              }
              const base = col.cellStyle;
              return typeof base === 'function' ? base(params) : base;
            },
          }
        : col
    );
  };

  return {
    yellowCellStyle,
    yellowCellStyleWithRedNegative,
    whiteCellStyle,
    whiteCellStyleWithRedNegative,
    makeCellStyleWithRedNegative,
    isReflectedRow,
    baseEditable,
    formatMetric,
    formatMetricDelta,
    syncRowState,
    routeUpdate,
    makeAfterSetter,
    deltaBaseOf,
    makeDeltaGetter,
    deltaCellStyle,
    makeAfterStyle,
    requiredCellStyle,
    withSimulationKeyCheck,
    campaignValueSetter,
    probabilityValueSetter,
    netValueSetter,
    napaValueSetter,
    handleCampaignChanged,
    refreshExpenseRow,
    makeExpenseColumns,
  };
};
