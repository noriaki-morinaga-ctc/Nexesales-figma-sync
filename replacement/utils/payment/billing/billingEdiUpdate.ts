// 請求EDI取込（取込一覧・取込結果詳細）の行データを更新する処理（再取込・変換後の値の登録・連携値の修正）。
// 画面をまたいで共有する行データは BillingEdiProvider が持ち、更新はこの関数で行う。
// 実システムではサーバーの処理になるため、ここは入力（行データ）→ 出力（新しい行データ）の純粋な関数にする。
import {
  ASSIGN_TARGET_BY_FIELD,
  type AssignTarget,
} from '@/constants/billingEdi';
import type {
  BillingEdiAssignMasters,
  BillingEdiDetailRow,
  BillingEdiImportRow,
} from '@/types/billingEdi';
import {
  matchesErrorSummary,
  originalValueOf,
} from '@/utils/payment/billing/billingEdiImport';

// 'YYYY/MM/DD HH:mm' の日時（修正履歴の記録に使う）
export const formatBillingEdiStamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 変換エラーで指定された「変換後の値」を明細へ反映する。
// 原本（連携値）は上書きせず、変換値指定として差分に残す。
export const applyAssignedValue = (
  detail: BillingEdiDetailRow,
  target: AssignTarget,
  value: string,
  correctedAt: string,
  correctedBy: string,
  masters: BillingEdiAssignMasters
): BillingEdiDetailRow => {
  const option = masters.assignOptions[target].find((o) => o.value === value);
  const label = option?.label ?? value;
  // 選択肢のラベルは「コード:名称」形式（→ 02 §9-1・UX-114）。名称部分だけを表示値に使う
  const name = label.includes(':')
    ? label.slice(label.indexOf(':') + 1)
    : label;
  const correction = {
    kind: '変換値指定' as const,
    field: target,
    original: '(未変換)',
    corrected: label,
    correctedBy,
    correctedAt,
  };
  const corrections = [
    ...detail.corrections.filter((c) => c.field !== target),
    correction,
  ];
  if (target === '商流販売店') {
    // 商流販売店変換マスタの出力は一次店・三次店・販売店の組（決定12）
    const retailer = masters.retailerAssignOptions.find(
      (o) => o.value === value
    );
    return {
      ...detail,
      storeCode: retailer?.storeCode ?? '',
      storeName: retailer?.storeName ?? '',
      primaryStoreCode: retailer?.primaryStoreCode ?? '',
      primaryStoreName: retailer?.primaryStoreName ?? '',
      tertiaryStoreCode: retailer?.tertiaryStoreCode ?? '',
      tertiaryStoreName: retailer?.tertiaryStoreName ?? '',
      corrections,
    };
  }
  // オンライン商品（費目は判別できなくても追加口として取り込むため指定対象ではない。決定19）
  return {
    ...detail,
    onlineProductCode: value,
    onlineProductName: name,
    // サマリ商品はオンライン商品から導出する（決定6）
    summaryProductCode: masters.summaryProduct.code,
    summaryProductName: masters.summaryProduct.name,
    corrections,
  };
};

// 再取込指示。エラーサマリ1件が単位（ファイル丸ごとの再取込は行わない）。
// 指示したエラーを明細から取り除き、エラーの残る明細が無くなれば一覧のステータスを「正常」にする（残れば「エラー」のまま）。
export const reimportBillingEdiSummary = (
  rows: BillingEdiImportRow[],
  rowId: string,
  summaryId: string,
  reimportedAt: string,
  operator: string,
  masters: BillingEdiAssignMasters
): BillingEdiImportRow[] =>
  rows.map((row) => {
    if (row.id !== rowId) return row;
    const target = row.errorSummaries.find((e) => e.id === summaryId);
    if (!target) return row;

    // 対象明細から、このエラーサマリのエラーを取り除く。
    // 変換後の値が登録されていればその値も反映する（原本は上書きせず差分に残す）。
    const assignTarget = ASSIGN_TARGET_BY_FIELD[target.field];
    const targetIds = new Set(
      row.details.filter((d) => matchesErrorSummary(d, target)).map((d) => d.id)
    );
    const details = row.details.map((detail) => {
      if (!targetIds.has(detail.id)) return detail;
      const cleared: BillingEdiDetailRow = {
        ...detail,
        // エラーは「エラー項目＋エラー内容」で識別する。エラー内容だけで取り除くと、
        // 同じエラー内容を持つ別項目のエラーまで消え、直していない明細が
        // 取り込まれてしまう（決定14：1件でもエラーがあれば取り込まない）
        errors: detail.errors.filter(
          (e) => !(e.field === target.field && e.reason === target.reason)
        ),
        // エラーを取り除いた後もエラーサマリから対象明細を引けるよう対応を残す
        reimportedSummaryIds: detail.reimportedSummaryIds.includes(target.id)
          ? detail.reimportedSummaryIds
          : [...detail.reimportedSummaryIds, target.id],
      };
      const applied =
        assignTarget && target.assignedValue
          ? applyAssignedValue(
              cleared,
              assignTarget,
              target.assignedValue,
              reimportedAt,
              operator,
              masters
            )
          : cleared;
      // 他のエラーが残っていなければ取り込めたことになる
      return applied.errors.length === 0
        ? { ...applied, importedAt: reimportedAt }
        : applied;
    });

    // 状態はこのエラー自体が解消したかどうかだけで決まる。対象明細に他のエラーが
    // 残っていても「解消」とする（その明細は他のエラーが解消するまで取り込めない）。
    // モックはマスタ・修正値の妥当性を判定せず、再取込すれば必ずエラーを取り除くため、
    // 「未解消」は再取込の操作では発生しない（初期データ R5 でのみ表示を確認できる）
    const errorSummaries = row.errorSummaries.map((e) =>
      e.id === summaryId ? { ...e, resolveState: '解消' } : e
    ) as BillingEdiImportRow['errorSummaries'];

    const errorCount = details.filter((d) => d.errors.length > 0).length;
    return {
      ...row,
      reimportedAt,
      details,
      errorSummaries,
      errorCount,
      status: errorCount === 0 ? '正常' : 'エラー',
    };
  });

// エラーサマリの「変換後の値」を登録したときの反映（登録だけ。取り込みは再取込で行う）
export const assignBillingEdiValue = (
  rows: BillingEdiImportRow[],
  rowId: string,
  summaryId: string,
  assignedValue: string
): BillingEdiImportRow[] =>
  rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          errorSummaries: row.errorSummaries.map((e) =>
            e.id === summaryId ? { ...e, assignedValue } : e
          ),
        }
      : row
  );

// 形式エラーの値を請求EDI取込結果詳細で修正したときの反映。
// 受領した原本は保管が必要なため（宿題事項2・電子帳簿保存）、連携値は上書きせず、
// 修正前後・修正者・修正日時を差分（corrections）として持たせる。
export const correctBillingEdiDetail = (
  rows: BillingEdiImportRow[],
  rowId: string,
  detailId: string,
  field: string,
  corrected: string,
  correctedAt: string,
  correctedBy: string
): BillingEdiImportRow[] =>
  rows.map((row) => {
    if (row.id !== rowId) return row;
    return {
      ...row,
      details: row.details.map((detail) => {
        if (detail.id !== detailId) return detail;
        // 原本の連携値。型変換できなかった項目は rawValues に生値を持つ
        const existing = detail.corrections.find((c) => c.field === field);
        const original = existing?.original ?? originalValueOf(detail, field);
        const corrections = [
          ...detail.corrections.filter((c) => c.field !== field),
          {
            kind: '連携値修正' as const,
            field,
            original,
            corrected,
            correctedBy,
            correctedAt,
          },
        ];
        // 生値は修正後の値に置き換わるため、未変換の印は落とす
        const rawValues = { ...detail.rawValues };
        delete rawValues[field];
        return { ...detail, corrections, rawValues };
      }),
    };
  });
