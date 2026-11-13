import { useState, useRef, useCallback } from 'react';
import { LicenseManager } from 'ag-grid-enterprise';

import { useInitialFocus } from './components/ui/use-initial-focus';
import { AppProviders } from './components/shared/layout/AppProviders';

import { Header } from './components/shared/layout/Header';
import { ROUTES, DEFAULT_ROUTE, type RouteContext } from './routes';
import type { MenuChangePayload } from './types/navigation';
import type { QuoteBasicInfo } from './utils/payment/quote/quoteBasicInfo';
import { createEmptyBilling } from '@/mocks/common/billing';
import type { BillingRow } from '@/app/types/billing';
import {
  matchesErrorSummary,
  originalValueOf,
} from './utils/payment/billing/billingEdiImport';
import {
  ASSIGN_OPTIONS,
  BILLING_EDI_ROWS,
  RETAILER_ASSIGN_OPTIONS,
  SUMMARY_PRODUCT_CODE,
  SUMMARY_PRODUCT_NAME,
} from '@/mocks/common/billingEdi';
import {
  ASSIGN_TARGET_BY_FIELD,
  type AssignTarget,
} from '@/app/constants/billingEdi';
import type {
  BillingEdiDetailRow,
  BillingEdiImportRow,
} from '@/app/types/billingEdi';
import { setupAgGrid } from './components/grid';

LicenseManager.setLicenseKey('AG_GRID_LICENSE_KEY');

// AG Grid の全画面共通の設定（モジュール・テーマ・ロケール・右クリックメニュー・列フィルタ等。→ grid/gridSetup）
setupAgGrid();
// AG Grid v33+ 新しいTheming APIを使用（CSSファイルは不要）
// 古いgrid.cssとag-theme-alpine.cssは削除

/**
 * 初期表示ページに指定できるルート ID の一覧。
 *
 * 切り替えたいときは App 内の currentPage の初期値（`useState<string>('…')`）の
 * **1 行だけ**を下記のルート ID に書き換える。他のファイルを触る必要はない。
 *
 * 別ファイル（旧 `initialPage.tsx`）に外出しすると Figma Make が再生成で元に戻して
 * しまうため、初期値は App.tsx に直接書く。
 *
 * 未知の値を書いた場合は `routes.tsx` の `DEFAULT_ROUTE`（= `top`）へフォールバックする。
 * 一覧は `src/app/routes.tsx` の `ROUTES` が正で、`routes.test.ts` が下記コメントとの
 * 同期を検証する。
 *
 * 選べるルート ID:
 *
 * - Top
 *   - `top` … Top
 * - 販売計画
 *   - `plan-list` … 計画一覧
 *   - `plan-list-actual` … 実績一覧（計画一覧の実績モード）
 *   - `managed-product-plan-list` … 計画一覧(管理対象商品)
 *   - `plan-detail-margin-rate-fixed` … 計画詳細(マージン率固定・NET入力)
 *   - `plan-detail-net-fixed` … 計画詳細(NET固定)
 *   - `plan-detail-vending` … 計画詳細（自販機）
 *   - `promotion-cost-plan-unlinked` … 拡売費計画(商流販売店に紐づき無し)
 *   - `annual-plan-creation` … 年間計画作成
 *   - `sales-plan-simulation-margin-rate-fixed` … 販売計画シミュレーション(マージン率固定・NET入力)
 *   - `sales-plan-simulation-net-fixed` … 販売計画シミュレーション(NET固定)
 *   - `managed-product-plan-detail` … 計画詳細(管理対象商品)
 *   - `marketing-file-upload` … ファイルアップロード画面
 * - 実績登録
 *   - `sales-actual-detail` … 販売実績詳細
 *   - `marketing-file-upload-actual` … ファイルアップロード画面（jihanki＝提携機／アライアンス品／販売器具費・リース料）
 * - 支払
 *   - `payment-list` … 支払一覧
 *   - `payment-detail-vending` … 支払詳細(自販機)
 *   - `payment-detail-with-invoice` … 支払詳細(追加口請求書有)
 *   - `payment-detail-without-invoice` … 支払詳細(追加口請求書無)
 *   - `payment-detail-other` … 支払詳細(その他)（★廃止）
 *   - `payment-detail-unlinked` … 支払詳細(商流販売店紐づけなし)
 *   - `payment-detail-quote` … 支払詳細(引用)
 *   - `payment-detail-quote-entry` … 支払詳細(引用) 入力
 *   - `transfer-detail` … 振替詳細
 *   - `quote-list` … 引用一覧（★廃止）
 *   - `location-contract-amortization-list` … ロケ契約(償却)一覧
 *   - `location-contract-fee-list` … ロケ契約料一覧（★廃止）
 *   - `billing-edi-list` … 請求EDI取込一覧
 *   - `billing-edi-detail` … 請求EDI取込結果詳細
 *   - `billing-list` … 請求一覧
 *   - `billing-detail-edi` … 請求詳細(請求EDI)
 *   - `billing-detail-aic` … 請求詳細(AIC入力)
 *   - `unamortized-project-billing-list` … 未償却案件請求一覧
 *   - `unamortized-project-billing` … 未償却案件請求（★廃止）
 * - 予算
 *   - `budget-reference-registration` … 予算参照登録
 * - マスタ
 *   - `distribution-retailer-master` … 商流販売店マスタ
 *   - `managed-product-list` … 管理対象商品一覧
 *   - `metadata-maintenance` … メタデータメンテナンス
 *   - `notice-admin` … お知らせメンテ
 *   - `general-wholesale-mesh-master` … 一般卸メッシュマスタ
 *   - `managed-product-master` … 管理対象商品マスタ
 *   - `container-capacity-group-master` … 容器容量グループマスタ
 *   - `retailer-condition-rate-master` … 販売店条件口率マスタ
 *   - `individual-net-master` … 個別NETマスタ
 *   - `strategic-net-master` … 戦略NETマスタ
 *   - `notification-master` … 通知管理マスタ
 *   - `system-admin-setting-master` … システム管理者設定マスタ
 *   - `position-approver-setting-master` … 役職承認者設定マスタ
 *   - `display-management-master` … 表示管理マスタ
 *   - `product-class-derivation-master` … 商品分類導出マスタ
 *   - `sales-area-master` … 担当エリアマスタ
 *   - `summary-product-management-master` … サマリ商品管理マスタ
 *   - `new-product-summary-link-master` … 新商品・新価格用サマリ商品紐づけマスタ
 *   - `new-product-item-master` … 新商品・新価格用商品マスタ
 *   - `new-product-sub-brand-master` … 新商品小ブランドマスタ
 *   - `new-product-unit-price-master` … 新商品・新価格用単価マスタ
 *   - `new-product-bulk-change-master` … 新商品一括変更マスタ
 */
// 'YYYY/MM/DD HH:mm' の現在日時（修正履歴の記録に使う）
const nowStamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

// 変換エラーで指定された「変換後の値」を明細へ反映する。
// 原本（連携値）は上書きせず、変換値指定として差分に残す。
const applyAssignedValue = (
  detail: BillingEdiDetailRow,
  target: AssignTarget,
  value: string,
  correctedAt: string
): BillingEdiDetailRow => {
  const option = ASSIGN_OPTIONS[target].find((o) => o.value === value);
  const label = option?.label ?? value;
  // 選択肢のラベルは「名称:コード」形式。名称部分だけを表示値に使う
  const name = label.includes(':') ? label.slice(0, label.indexOf(':')) : label;
  const correction = {
    kind: '変換値指定' as const,
    field: target,
    original: '(未変換)',
    corrected: label,
    correctedBy: 'アサヒ　太郎',
    correctedAt,
  };
  const corrections = [
    ...detail.corrections.filter((c) => c.field !== target),
    correction,
  ];
  if (target === '商流販売店') {
    // 商流販売店変換マスタの出力は一次店・三次店・販売店の組（決定12）
    const retailer = RETAILER_ASSIGN_OPTIONS.find((o) => o.value === value);
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
    summaryProductCode: SUMMARY_PRODUCT_CODE,
    summaryProductName: SUMMARY_PRODUCT_NAME,
    corrections,
  };
};

export default function App() {
  // 初期表示ページ。切り替えたいときはこの 'top' を上記一覧のルート ID に書き換える
  const [currentPage, setCurrentPage] = useState<string>('top');
  // 引用ペインから受け取る基本情報（支払詳細(引用) 入力へプリフィルとして渡す）
  const [quoteBasicInfo, setQuoteBasicInfo] = useState<
    QuoteBasicInfo | undefined
  >(undefined);

  // 年間計画作成へ引き継ぐ取引制度。年間計画作成の基本情報は遷移元の計画詳細と
  // 同一表示にする必要があり、取引制度で内容（販売店・三次店企業）が変わるため保持する。
  const [annualPlanTradingSystem, setAnnualPlanTradingSystem] =
    useState<string>('マージン率固定');

  // 請求一覧で選択された入力単位（請求詳細へ引き継ぐ）。
  // メニューから直接請求詳細を開いた場合は未選択とし、既定の入力単位を表示する。
  const [selectedBilling, setSelectedBilling] = useState<
    BillingRow | undefined
  >(undefined);

  // 請求一覧の行操作（詳細ボタン・行ダブルクリック）から請求詳細へ遷移する。
  // 請求詳細はデータ種別ごとに画面が分かれているため、行のデータ種別で遷移先を決める。
  const handleOpenBillingDetail = (entry: BillingRow) => {
    setSelectedBilling(entry);
    setCurrentPage(
      entry.dataSource === 'EDI' ? 'billing-detail-edi' : 'billing-detail-aic'
    );
  };

  // 請求一覧の「新規作成」から、空の入力単位（明細0件）で請求詳細(AIC入力)を開く。
  // 新規作成は AIC が入力する場合のみのため、請求EDI側の画面へは遷移しない（決定24）。
  const handleCreateBilling = () => {
    setSelectedBilling(createEmptyBilling());
    setCurrentPage('billing-detail-aic');
  };

  // 請求EDI取込一覧の行データ。詳細画面の再取込指示でステータスを更新するため
  // モジュール定数を直接使わず state で保持する（billing-list とは異なり更新が発生する）。
  const [billingEdiRows, setBillingEdiRows] =
    useState<BillingEdiImportRow[]>(BILLING_EDI_ROWS);

  // 請求EDI取込一覧で選択された取込分のID（請求EDI取込結果詳細へ引き継ぐ）。
  // メニューから直接詳細を開いた場合は未選択とし、既定の取込分を表示する。
  // 行オブジェクトそのものではなくIDを保持し、詳細画面側で billingEdiRows から
  // 引き直すことで、再取込後に詳細画面へ留まった場合も表示が古くならない。
  const [selectedBillingEdiId, setSelectedBillingEdiId] = useState<
    string | undefined
  >(undefined);

  // 請求EDI取込一覧の［詳細］から請求EDI取込結果詳細へ遷移する
  const handleOpenBillingEdiDetail = (row: BillingEdiImportRow) => {
    setSelectedBillingEdiId(row.id);
    setCurrentPage('billing-edi-detail');
  };

  // 請求EDI取込結果詳細の再取込指示。エラーサマリ1件が単位（ファイル丸ごとの再取込は行わない）。
  // 指示したエラーを明細から取り除き、エラーの残る明細が無くなれば一覧のステータスを「正常」にする（残れば「エラー」のまま）。
  const handleReimportBillingEdiSummary = (
    rowId: string,
    summaryId: string
  ) => {
    const reimportedAt = nowStamp();
    setBillingEdiRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const target = row.errorSummaries.find((e) => e.id === summaryId);
        if (!target) return row;

        // 対象明細から、このエラーサマリのエラーを取り除く。
        // 変換後の値が登録されていればその値も反映する（原本は上書きせず差分に残す）。
        const assignTarget = ASSIGN_TARGET_BY_FIELD[target.field];
        const targetIds = new Set(
          row.details
            .filter((d) => matchesErrorSummary(d, target))
            .map((d) => d.id)
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
            reimportedSummaryIds: detail.reimportedSummaryIds.includes(
              target.id
            )
              ? detail.reimportedSummaryIds
              : [...detail.reimportedSummaryIds, target.id],
          };
          const applied =
            assignTarget && target.assignedValue
              ? applyAssignedValue(
                  cleared,
                  assignTarget,
                  target.assignedValue,
                  reimportedAt
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
      })
    );
  };

  // エラーサマリの「変換後の値」を登録したときの反映（登録だけ。取り込みは再取込で行う）
  const handleAssignBillingEdiValue = (
    rowId: string,
    summaryId: string,
    assignedValue: string
  ) => {
    setBillingEdiRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              errorSummaries: row.errorSummaries.map((e) =>
                e.id === summaryId ? { ...e, assignedValue } : e
              ),
            }
          : row
      )
    );
  };

  // 形式エラーの値を請求EDI取込結果詳細で修正したときの反映。
  // 受領した原本は保管が必要なため（宿題事項2・電子帳簿保存）、連携値は上書きせず、
  // 修正前後・修正者・修正日時を差分（corrections）として持たせる。
  const handleCorrectBillingEdiDetail = (
    rowId: string,
    detailId: string,
    field: string,
    corrected: string
  ) => {
    const correctedAt = nowStamp();

    setBillingEdiRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          details: row.details.map((detail) => {
            if (detail.id !== detailId) return detail;
            // 原本の連携値。型変換できなかった項目は rawValues に生値を持つ
            const existing = detail.corrections.find((c) => c.field === field);
            const original =
              existing?.original ?? originalValueOf(detail, field);
            const corrections = [
              ...detail.corrections.filter((c) => c.field !== field),
              {
                kind: '連携値修正' as const,
                field,
                original,
                corrected,
                correctedBy: 'アサヒ　太郎',
                correctedAt,
              },
            ];
            // 生値は修正後の値に置き換わるため、未変換の印は落とす
            const rawValues = { ...detail.rawValues };
            delete rawValues[field];
            return { ...detail, corrections, rawValues };
          }),
        };
      })
    );
  };

  // 画面の切り替え。画面・ヘッダーへは AppProviders（AppNavigationProvider）で渡す（→ ui/use-app-navigation）。
  // state の更新関数だけを使うため、描画のたびに作り直さない
  const handleMenuChange = useCallback(
    (menuId: string, payload?: MenuChangePayload) => {
      // 遷移元から受け取ったペイロードを用途ごとに振り分ける。
      // 年間計画は取引制度のみ、引用フローは基本情報4項目を持つため、キーで判別する。
      if (payload) {
        if ('tradingSystem' in payload) {
          setAnnualPlanTradingSystem(payload.tradingSystem);
        } else {
          setQuoteBasicInfo(payload);
        }
      }
      // メニューから請求詳細を開いた場合は一覧での選択を引き継がない
      // （データ種別が食い違った入力単位を表示しないよう、両画面とも未選択に戻す）
      if (menuId === 'billing-detail-edi' || menuId === 'billing-detail-aic') {
        setSelectedBilling(undefined);
      }
      // メニューから請求EDI取込結果詳細を開いた場合は一覧での選択を引き継がない
      if (menuId === 'billing-edi-detail') {
        setSelectedBillingEdiId(undefined);
      }
      // メニューから請求EDI取込一覧を開き直した場合は仮データを初期状態へ戻す。
      // 再取込指示でエラーを取り除いた行も元の状態に戻し、
      // 何度でも同じ操作を試せるようにする（モック都合。実システムでは行わない）。
      if (menuId === 'billing-edi-list') {
        setBillingEdiRows(BILLING_EDI_ROWS);
        setSelectedBillingEdiId(undefined);
      }
      setCurrentPage(menuId);
    },
    []
  );

  const routeContext: RouteContext = {
    quoteBasicInfo,
    annualPlanTradingSystem,
    selectedBilling,
    onOpenBillingDetail: handleOpenBillingDetail,
    onCreateBilling: handleCreateBilling,
    onBackToBillingList: () => setCurrentPage('billing-list'),
    billingEdiRows,
    selectedBillingEdiId,
    onOpenBillingEdiDetail: handleOpenBillingEdiDetail,
    onBackToBillingEdiList: () => setCurrentPage('billing-edi-list'),
    onReimportBillingEdiSummary: handleReimportBillingEdiSummary,
    onAssignBillingEdiValue: handleAssignBillingEdiValue,
    onCorrectBillingEdiDetail: handleCorrectBillingEdiDetail,
  };

  // 未知のルート ID を受け取った場合は既定画面へフォールバックする
  const route = ROUTES[currentPage] ?? ROUTES[DEFAULT_ROUTE];

  // 画面を表示したら、先頭の入力項目へフォーカスを当てる（画面設計標準 3.10。画面側の実装は不要）
  const mainRef = useRef<HTMLElement>(null);
  useInitialFocus(mainRef, currentPage);

  return (
    // 画面名は各画面の ScreenTitle からヘッダーへ渡す（本文には画面名の見出しを置かない）
    // 共通の Provider・トースト・確認ダイアログの表示役は AppProviders にまとめる
    <AppProviders navigate={handleMenuChange}>
      <div className="flex flex-col h-screen bg-app-background">
        {/* Header */}
        <Header />

        {/* Scrollable Content */}
        <main
          ref={mainRef}
          className="flex-1 overflow-x-auto overflow-y-auto bg-app-background"
        >
          {route.render(routeContext)}
        </main>
      </div>
    </AppProviders>
  );
}
