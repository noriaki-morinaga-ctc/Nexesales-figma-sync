import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { Label } from '@/components/ui/label';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { RequiredBadge } from '@/components/ui/required-badge';
import { Combobox } from '@/components/ui/combobox';
import {
  META_BRAND_MASTER,
  CONTAINER_CAPACITY_MASTER,
  WHOLESALE_MESH_OPTIONS,
  SUMMARY_PRODUCT_OPTIONS,
} from '@/constants/productMasters';
import { isNewProductAt } from '@/utils/common/productMasters';
import { CATEGORY_OPTIONS_NET } from '@/constants/promotionCategories';
import { productCodeFromValue } from '@/utils/common/comboFieldOptions';
import { summaryProductOptionCode } from '@/utils/common/summaryProductSearch';
import { initialOnlyNew } from '@/utils/sales-plan/common/onlyNewProductDefault';

// ── 明細 商品選択コンポーネント（明細追加・編集・コピーで共通利用）──────────
// サマリ商品名／一般卸メッシュ・メタブランド・容器容量Gの選択を担う。
// ・サマリ商品名（または定番商品時は一般卸メッシュ）を選択すると
//   メタブランド・容器容量Gが自動選択され、非活性（グレーアウト）になる
// ・メタブランド／容器容量Gの選択肢は実在する組み合わせのみを連動表示する
// ・サマリ商品名／メタブランド／容器容量Gはそれぞれクリア可能
//   （autoFillOnly 指定時は、メタブランド・容器容量Gを常に非活性＝自動反映のみとし、
//   この2項目による商品候補の絞り込みもしない）
// 販売計画表（マージン率固定／NET固定）・シミュレーション各画面で共有する。
interface DetailProductSelectorProps {
  /** 商品区分セレクトを表示するか（「全て」タブ時） */
  showCategorySelect: boolean;
  category: string;
  onCategoryChange: (v: string) => void;

  summaryProduct: string;
  wholesaleMesh: string;
  metaBrand: string;
  containerCapacityG: string;

  /** サマリ商品選択時：明細フォーム全体を反映 */
  onSelectSummaryProduct: (
    product: (typeof SUMMARY_PRODUCT_OPTIONS)[number]
  ) => void;
  /** 一般卸メッシュ選択時（定番商品）：明細フォーム全体を反映 */
  onSelectWholesaleMesh: (
    mesh: (typeof WHOLESALE_MESH_OPTIONS)[number]
  ) => void;

  /** メタブランドの手入力選択（autoFillOnly の場合は不要） */
  onChangeMetaBrand?: (v: string) => void;
  /** 容器容量Gの手入力選択（autoFillOnly の場合は不要） */
  onChangeContainerCapacity?: (v: string) => void;
  /** サマリ商品名／一般卸メッシュをクリア（連動するメタブランド・容量も解除） */
  onClearPrimary: () => void;
  /**
   * メタブランド・容器容量Gを常に非活性（自動反映のみ）にするか。
   * サマリ商品名（定番商品は一般卸メッシュ）の選択で自動反映され、選択前は空欄のまま。
   * この2項目での商品候補の絞り込みも行わない（シミュレーション向け）。
   */
  autoFillOnly?: boolean;

  submitted?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  /** 一般卸メッシュを使用するか（false の場合は定番商品でもサマリ商品名を主選択・必須にする：量販向け） */
  useWholesaleMesh?: boolean;
  /** 商品区分セレクトの選択肢（未指定時は NET固定の商品区分） */
  categoryOptions?: { value: string; label: string }[];
  /** 商品区分セレクトのみ非活性にする（ギフト行の区分固定などに使用） */
  categoryDisabled?: boolean;
  /** 主選択（サマリ商品名／一般卸メッシュ）のみ非活性にする */
  primaryDisabled?: boolean;
  /**
   * 「新商品のみ表示」の判定基準となる年月（'YYYY/MM'）。
   * シミュレーションは対象期間が複数月にわたり、新商品に該当するかが対象年月で変わるため、
   * その年月時点で新商品の商品だけに候補を絞る。未指定の画面（計画詳細）はマスタの
   * 新商品フラグをそのまま使う。
   */
  newProductBaseMonth?: string;
  /**
   * 基準年月が未入力の間「新商品のみ表示」を非活性にするか。
   * 対象年月 → 新商品のみ表示 の順で入力させるシミュレーション向け。
   */
  requireNewProductBaseMonth?: boolean;
  /**
   * 商品区分が「新商品」のとき「新商品のみ表示」を初期でチェック済みにするか。
   * 新商品は初期で絞り込んで表示し、新商品以外を追加したい場合にチェックを外して使う
   * （計画詳細の明細追加ペイン向け。商品区分を変えると初期状態に戻す）。
   */
  onlyNewByDefaultForNewCategory?: boolean;
}

export function DetailProductSelector({
  showCategorySelect,
  category,
  onCategoryChange,
  summaryProduct,
  wholesaleMesh,
  metaBrand,
  containerCapacityG,
  onSelectSummaryProduct,
  onSelectWholesaleMesh,
  onChangeMetaBrand,
  onChangeContainerCapacity,
  onClearPrimary,
  autoFillOnly = false,
  submitted = false,
  hidden = false,
  disabled = false,
  categoryDisabled = false,
  primaryDisabled = false,
  useWholesaleMesh = true,
  categoryOptions,
  newProductBaseMonth,
  requireNewProductBaseMonth = false,
  onlyNewByDefaultForNewCategory = false,
}: DetailProductSelectorProps) {
  // 定番商品は「一般卸メッシュ」が必須（サマリ商品名と項目を入れ替える）
  // ただし useWholesaleMesh=false（量販）の場合は定番でもサマリ商品名を主選択にする
  const isStandard = useWholesaleMesh && category === '定番商品';

  // 商品区分セレクトの選択肢（量販では特売など差し替え可能）
  const effectiveCategoryOptions = categoryOptions ?? CATEGORY_OPTIONS_NET;

  // 内部UI状態（新商品のみ表示の絞り込み。検索・開閉は Combobox が内部管理）
  const [onlyNew, setOnlyNew] = useState(
    () => onlyNewByDefaultForNewCategory && category === '新商品'
  );

  // 基準年月が必要な画面では、未入力の間「新商品のみ表示」を使えない。
  const baseMonth = String(newProductBaseMonth ?? '').trim();
  const onlyNewDisabled = requireNewProductBaseMonth && baseMonth === '';

  // 初期状態を決める。基準年月が未入力の間はチェックなし（基準の無い絞り込みを残さない）。
  // 指定時は商品区分が「新商品」ならチェックあり、それ以外ならチェックなしにする
  // （シミュレーションは対象年月を入力した時点で初期チェックを付ける）。
  useEffect(() => {
    const next = initialOnlyNew(
      category,
      onlyNewByDefaultForNewCategory,
      onlyNewDisabled
    );
    if (next !== null) setOnlyNew(next);
  }, [category, onlyNewByDefaultForNewCategory, onlyNewDisabled]);

  // 主選択値（定番＝一般卸メッシュ、それ以外＝サマリ商品名）
  const primaryValue = isStandard ? wholesaleMesh : summaryProduct;

  // 主選択が確定していればメタブランド・容量は自動選択＝非活性。
  // autoFillOnly の場合は選択前も含めて常に非活性（自動反映のみ）。
  const locked = autoFillOnly || primaryValue.trim().length > 0;

  // 商品候補の絞り込みに使うメタブランド・容器容量G。
  // autoFillOnly では手入力の絞り込みを行わない（自動反映された値で候補が狭まらないようにする）。
  const filterMetaBrand = autoFillOnly ? '' : metaBrand;
  const filterCapacityG = autoFillOnly ? '' : containerCapacityG;

  // 連動データソース（実在する組み合わせ）
  const universe = isStandard
    ? WHOLESALE_MESH_OPTIONS
    : SUMMARY_PRODUCT_OPTIONS;

  // 存在するメタブランド（容器容量G選択に連動）
  const availableBrands = useMemo(() => {
    const set = new Set(
      universe
        .filter(
          (u) =>
            !containerCapacityG || u.containerCapacityG === containerCapacityG
        )
        .map((u) => u.metaBrand)
    );
    return META_BRAND_MASTER.filter((b) => set.has(b.value));
  }, [universe, containerCapacityG]);

  // 存在する容器容量G（メタブランド選択に連動）
  const availableCapacities = useMemo(() => {
    const set = new Set(
      universe
        .filter((u) => !metaBrand || u.metaBrand === metaBrand)
        .map((u) => u.containerCapacityG)
    );
    return CONTAINER_CAPACITY_MASTER.filter((c) => set.has(c.value));
  }, [universe, metaBrand]);

  // 主選択（サマリ商品名／一般卸メッシュ）の候補（連動絞り込み。テキスト検索は Combobox が内部実施）
  const productOptions = useMemo(() => {
    const base = isStandard
      ? WHOLESALE_MESH_OPTIONS.filter((o) => {
          if (filterMetaBrand && o.metaBrand !== filterMetaBrand) return false;
          if (filterCapacityG && o.containerCapacityG !== filterCapacityG)
            return false;
          return true;
        }).map((o) => ({
          value: o.value,
          label: o.value,
          code: `${o.metaBrand}：${o.containerCapacityG}`,
        }))
      : SUMMARY_PRODUCT_OPTIONS.filter((o) => {
          if (filterMetaBrand && o.metaBrand !== filterMetaBrand) return false;
          if (filterCapacityG && o.containerCapacityG !== filterCapacityG)
            return false;
          if (onlyNew && !isNewProductAt(o, newProductBaseMonth)) return false;
          return true;
        }).map((o) => ({
          value: o.value,
          label: o.value,
          // サマリ商品コードでも検索できるよう、2行目の先頭にコードを表示する
          code: summaryProductOptionCode(
            productCodeFromValue(o.value),
            o.metaBrand,
            o.containerCapacityG
          ),
          badge: isNewProductAt(o, newProductBaseMonth) ? 'NEW' : undefined,
        }));
    // 編集/コピーで選択済みの値（マスタ未登録・絞り込み対象外・ギフト商品名など）が
    // 候補に無い場合でもフォームに表示できるよう、先頭へ補完する。
    if (primaryValue && !base.some((o) => o.value === primaryValue)) {
      return [{ value: primaryValue, label: primaryValue }, ...base];
    }
    return base;
  }, [
    isStandard,
    filterMetaBrand,
    filterCapacityG,
    onlyNew,
    primaryValue,
    newProductBaseMonth,
  ]);

  // メタブランド／容器容量G候補（連動。テキスト検索は Combobox が内部実施）
  const brandOptions = useMemo(
    () =>
      availableBrands.map((b) => ({
        value: b.value,
        label: b.name,
        code: b.code,
      })),
    [availableBrands]
  );
  const capacityOptionsList = useMemo(
    () =>
      availableCapacities.map((c) => ({
        value: c.value,
        label: c.name,
        code: c.code,
      })),
    [availableCapacities]
  );

  if (hidden) return null;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
      {/* 商品区分 */}
      {showCategorySelect ? (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            商品区分 <RequiredBadge />
          </Label>
          <SingleCombobox
            ariaRequired
            className="w-full"
            options={effectiveCategoryOptions}
            value={category}
            onChange={onCategoryChange}
            placeholder="選択してください"
            disabled={disabled || categoryDisabled}
            searchable={false}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            商品区分 <RequiredBadge />
          </Label>
          <Input
            aria-required="true"
            value={category}
            readOnly
            className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
          />
        </div>
      )}

      {/* 新商品のみ表示（サマリ商品名選択時のみ） */}
      {!isStandard && (
        <div className="flex items-center gap-2 @md:col-span-2 @2xl:col-span-3">
          <input
            type="checkbox"
            checked={onlyNew}
            disabled={disabled || onlyNewDisabled}
            onChange={(e) => setOnlyNew(e.target.checked)}
          />
          <Label className={onlyNewDisabled ? 'text-gray-400' : undefined}>
            新商品のみ表示
          </Label>
          {/* 基準年月を使う画面では、絞り込みが対象年月に依存することを明示する。
              シミュレーションはペインで選んだ対象年月、計画詳細は基本情報の対象年月が基準。
              シミュレーションは未入力のうちは先に対象年月を選ぶ必要があることも案内する。 */}
          {newProductBaseMonth !== undefined && (
            <span className="text-xs text-gray-500">
              {onlyNewDisabled ? '対象年月を選択すると使用できます。' : ''}
              {requireNewProductBaseMonth
                ? 'サマリ商品名は選択した対象年月時点の新商品に絞り込まれます。'
                : 'サマリ商品名は基本情報の対象年月時点の新商品に絞り込まれます。'}
            </span>
          )}
        </div>
      )}

      {/* 主選択：定番商品＝一般卸メッシュ、それ以外＝サマリ商品名 */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">
          {isStandard ? '一般卸メッシュ' : 'サマリ商品名'} <RequiredBadge />
        </Label>
        <div
          className={
            submitted && !primaryValue ? 'rounded-md ring-1 ring-red-500' : ''
          }
        >
          <Combobox
            options={productOptions}
            value={primaryValue}
            onChange={(option) => {
              if (isStandard) {
                const mesh = WHOLESALE_MESH_OPTIONS.find(
                  (o) => o.value === option.value
                );
                if (mesh) onSelectWholesaleMesh(mesh);
              } else {
                const product = SUMMARY_PRODUCT_OPTIONS.find(
                  (o) => o.value === option.value
                );
                if (product) onSelectSummaryProduct(product);
              }
            }}
            placeholder="商品名 または コードで検索..."
            disabled={disabled || primaryDisabled}
            onClear={onClearPrimary}
          />
        </div>
      </div>

      {/* メタブランド / 容器容量G（常に2列・全幅でペア表示） */}
      <div className="grid grid-cols-2 gap-3 @md:col-span-2 @2xl:col-span-3">
        <div>
          <Label className="text-xs">メタブランド</Label>
          {locked ? (
            <Input
              value={metaBrand}
              readOnly
              className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
            />
          ) : (
            <Combobox
              options={brandOptions}
              value={metaBrand}
              onChange={(option) => onChangeMetaBrand?.(option.value)}
              placeholder="コード・名前で検索"
              className="text-sm"
              disabled={disabled}
              onClear={() => onChangeMetaBrand?.('')}
            />
          )}
        </div>

        <div>
          <Label className="text-xs">容器容量G</Label>
          {locked ? (
            <Input
              value={containerCapacityG}
              readOnly
              className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
            />
          ) : (
            <Combobox
              options={capacityOptionsList}
              value={containerCapacityG}
              onChange={(option) => onChangeContainerCapacity?.(option.value)}
              placeholder="コード・名前で検索"
              className="text-sm"
              disabled={disabled}
              onClear={() => onChangeContainerCapacity?.('')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
