// 追加口の「明細追加」ペイン（右ペインの本文）。
// 項目・並び・活性/非活性は追加口グリッド（DetailTable）の列にそろえる。
//   活性  … グリッドで編集できる列（支払ケース／バラ、支払NET（全体）、照合支払区分、
//           摘要1・2、函数無効チェック、最終NET）
//   非活性… グリッドで編集できない列（自動採番・商品マスタからの自動表示・数式の自動算出）
// ただしサマリ商品名だけは、追加する明細の起点になる項目のため活性にする
//（グリッドでは請求EDIの取込値のため編集できない）。
// 請求書情報（請求書ページ・請求明細番号・販売店名）も常に活性にする。
// 請求情報（請求NET・ケース・バラ）は担当者が請求書を見て入力する（→ 補足1-5 b24.t7〜t9）。
// 請求NETは初期値なし（空欄から入力する）。
// バラ単価・金額は計算した値を表示し、手で直せる（→ b24.t10・t11、updateEntryBillingDraft）。
// 支払NET（追加口分）・（全体）の初期値はサマリ商品のマスタNET（→ b24.t12・t13）。
// 計画情報は当月の販売計画の値（計画に無いサマリ商品はマスタの値）を表示する
//（→ DetailTable の entryReferenceOf）。
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '@/constants/matchPaymentType';
import { DEFAULT_DATA_SOURCE } from '@/constants/dataSource';
import { BILL_RETAILER_NAME } from '@/mocks/payment/payment-detail-with-invoice/paymentDetail';
import {
  entryMasterNetOf,
  entryReferenceOf,
} from '@/features/payment/payment-detail-with-invoice/utilsEntryRows';
import type { EntryFormValues } from '@/types/paymentDetail';
import { entrySummaryProductComboOptions } from '@/features/payment/payment-detail-with-invoice/utils';
import {
  updateEntryBillingDraft,
  type EntryBillingDraftField,
} from '@/utils/payment/payment-detail/additionalEntryRules';
import {
  FieldGroup,
  InputField,
  SelectField,
  ReadOnlyField,
  CheckField,
} from '@/features/payment/shared/payment-detail/AddDetailFields';

// 親（画面）から「追加」ボタンで呼ぶハンドル。
export interface AddEntryPaneHandle {
  // 入力値を検証して明細を1件追加し、フォームを初期化する。
  // 追加できたら true を返す（ペインは閉じず、続けて入力できる）。
  submit: () => boolean;
}

interface AddEntryPaneProps {
  // 「追加」押下時。追加口一覧へ明細を1件足す。
  onAdd: (values: EntryFormValues) => void;
}

const EMPTY_FORM: EntryFormValues = {
  productName: '',
  payCases: '',
  payLoose: '',
  addNet: '',
  payNet: '',
  matchType: '',
  expProcess: '-',
  summary1: '',
  summary2: '',
  funcCheck: false,
  finalNet: '',
  billNet: '',
  cases: '',
  loose: '',
  unitPrice: '',
  amount: '',
  unitPriceManual: false,
  amountManual: false,
  billPage: '',
  billDetailNo: '',
  // 販売店名は請求書の販売店名を初期表示し、必要に応じて書き換えられるようにする。
  retailerName: BILL_RETAILER_NAME,
};

// 自動算出の項目に出す説明（空欄の理由が分かるようにする）。
const AUTO_CALC_HINT = '追加後に自動算出';
const AUTO_MASTER_HINT = 'サマリ商品名から自動表示';
// 請求情報のバラ単価・金額（計算した値を表示する。計算できないあいだは空欄）。
const UNIT_PRICE_HINT = '社外売上高単価－請求NETで自動算出';
const AMOUNT_HINT = '（入数×ケース＋バラ）×バラ単価で自動算出';

// 数値を桁区切りの文字列にする（空欄はそのまま）。
const fmt = (value: number | '' | undefined): string =>
  value === '' || value === undefined ? '' : value.toLocaleString();

export const AddEntryPane = forwardRef<AddEntryPaneHandle, AddEntryPaneProps>(
  function AddEntryPane({ onAdd }: AddEntryPaneProps, ref) {
    const [form, setForm] = useState<EntryFormValues>(EMPTY_FORM);
    // 追加を試みたかどうか（未入力の必須項目を赤枠で示すのは、押したあとだけにする）。
    const [isSubmitted, setIsSubmitted] = useState(false);

    // 最終NET：函数無効チェックONのときは数式で算出せず手入力の値を使うため必須にする。
    const finalNetRequired = form.funcCheck;
    const finalNetMissing = finalNetRequired && form.finalNet.trim() === '';

    const set = <K extends keyof EntryFormValues>(
      key: K,
      value: EntryFormValues[K]
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    // サマリ商品名の選択肢（商品マスタ）。2行目の商品コードでも検索できる。
    const productOptions = useMemo(() => entrySummaryProductComboOptions(), []);

    // 選択したサマリ商品名から引く参照値（入数・NET・社外売上高単価）。
    const reference = entryReferenceOf(form.productName);

    // 請求情報（請求NET・ケース・バラ・バラ単価・金額）の入力。バラ単価・金額は計算した値を
    // 表示し、手で直した値はグリッドと同じ決まりで残す（→ updateEntryBillingDraft）。
    // フォームから請求情報の部分を取り出す。
    const billingOf = (prev: EntryFormValues) => ({
      billNet: prev.billNet,
      cases: prev.cases,
      loose: prev.loose,
      unitPrice: prev.unitPrice,
      amount: prev.amount,
      unitPriceManual: prev.unitPriceManual ?? false,
      amountManual: prev.amountManual ?? false,
    });

    // バラ単価・金額の入力欄に入った時点の請求情報（値が変わったかの比べ元）。
    const committedRef = useRef<ReturnType<typeof billingOf> | null>(null);
    const handleFocusBilling = () => {
      committedRef.current = billingOf(form);
    };

    // 請求情報の入力（1文字ごと）。入力中のバラ単価・金額は入力中の文字を残す（focused）。
    const setBilling = (field: EntryBillingDraftField, value: string) => {
      const committed = committedRef.current ?? undefined;
      setForm((prev) => ({
        ...prev,
        ...updateEntryBillingDraft(
          billingOf(prev),
          field,
          value,
          entryReferenceOf(prev.productName),
          { focused: true, committed }
        ),
      }));
    };

    // バラ単価・金額の入力欄を離れたとき、入力を確定する（空欄→計算した値、計算した値と同じ
    // →手で直した値として扱わない、表示を整える）。入った時点から値が変わっていなければ、
    // 入った時点の値・手で直した印のまま（もう一方の手で直した値も残す）。
    const commitBilling = (field: 'unitPrice' | 'amount') => {
      const committed = committedRef.current ?? undefined;
      committedRef.current = null;
      setForm((prev) => ({
        ...prev,
        ...updateEntryBillingDraft(
          billingOf(prev),
          field,
          prev[field],
          entryReferenceOf(prev.productName),
          { committed }
        ),
      }));
    };

    // サマリ商品名を選んだら、支払NET（追加口分）・（全体）へサマリ商品のマスタNETを初期表示する
    //（→ b24.t12・t13。選んだあとに手で直せる）。請求NETは入れない（初期値なし → b24.t7）。
    // バラ単価・金額は選んだ商品の社外売上高単価・入数で計算し直す。
    const handleProductChange = (value: string) => {
      const masterNet = entryMasterNetOf(value);
      const net = masterNet === '' ? '' : `${masterNet}`;
      setForm((prev) => ({
        ...prev,
        ...updateEntryBillingDraft(
          billingOf(prev),
          'product',
          '',
          entryReferenceOf(value)
        ),
        productName: value,
        addNet: net,
        payNet: net,
      }));
    };

    useImperativeHandle(ref, () => ({
      submit: () => {
        setIsSubmitted(true);
        if (!form.productName) {
          toast.warning('サマリ商品名を選択してください。');
          return false;
        }
        if (finalNetMissing) {
          toast.warning(
            '函数無効チェックONの明細は、最終NETを入力してください。'
          );
          return false;
        }
        onAdd(form);
        // 次の入力に備えてフォームを初期化する（ペインの開閉は親が決める）。
        setForm(EMPTY_FORM);
        setIsSubmitted(false);
        return true;
      },
    }));

    return (
      <div className="space-y-5 bg-white p-4">
        <FieldGroup title="明細">
          <ReadOnlyField
            id="add-entry-no"
            label="No."
            hint="追加時に自動採番"
          />
          <ReadOnlyField
            id="add-entry-source"
            label="データ元"
            value={DEFAULT_DATA_SOURCE}
          />
          <ReadOnlyField
            id="add-entry-product-code"
            label="サマリ商品コード"
            value={form.productName ? reference?.productCode : ''}
            hint={AUTO_MASTER_HINT}
          />
          {/* サマリ商品名：追加する明細の起点になる項目のため必須。 */}
          <SelectField
            id="add-entry-product"
            label="サマリ商品名"
            value={form.productName}
            onChange={handleProductChange}
            options={productOptions}
            placeholder="サマリ商品名を選択"
            required
            invalid={isSubmitted && !form.productName}
          />
          <ReadOnlyField
            id="add-entry-capacity"
            label="入数"
            value={fmt(reference?.capacity)}
            hint={AUTO_MASTER_HINT}
          />
        </FieldGroup>

        <FieldGroup title="計画情報">
          <ReadOnlyField
            id="add-entry-seihan"
            label="社外売上高単価"
            value={fmt(reference?.seihan)}
            hint={AUTO_MASTER_HINT}
          />
          <ReadOnlyField
            id="add-entry-plan-net"
            label="計画NET"
            value={fmt(reference?.net)}
            hint={AUTO_MASTER_HINT}
          />
        </FieldGroup>

        {/* 請求情報は担当者が請求書を見て入力する（→ 補足1-5 b24.t7〜t11）。
            バラ単価・金額は計算した値を表示し、手で直せる（直した値はグリッドと同じ決まりで残す）。 */}
        <FieldGroup
          title="請求情報"
          description="請求書を見て入力します。バラ単価・金額は請求NETを入れると自動算出し、手で直せます。空欄にすると自動算出の値に戻ります。"
        >
          <InputField
            id="add-entry-bill-net"
            label="請求NET"
            value={form.billNet}
            onChange={(v) => setBilling('billNet', v)}
            numeric
            maxFractionDigits={2}
          />
          <InputField
            id="add-entry-cases"
            label="ケース"
            value={form.cases}
            onChange={(v) => setBilling('cases', v)}
            numeric
            maxFractionDigits={0}
          />
          <InputField
            id="add-entry-loose"
            label="バラ"
            value={form.loose}
            onChange={(v) => setBilling('loose', v)}
            numeric
            maxFractionDigits={0}
          />
          <InputField
            id="add-entry-unit-price"
            label="バラ単価"
            value={form.unitPrice}
            onChange={(v) => setBilling('unitPrice', v)}
            onFocus={handleFocusBilling}
            onBlur={() => commitBilling('unitPrice')}
            numeric
            maxFractionDigits={2}
            placeholder={UNIT_PRICE_HINT}
          />
          <InputField
            id="add-entry-amount"
            label="金額"
            value={form.amount}
            onChange={(v) => setBilling('amount', v)}
            onFocus={handleFocusBilling}
            onBlur={() => commitBilling('amount')}
            numeric
            maxFractionDigits={0}
            placeholder={AMOUNT_HINT}
          />
        </FieldGroup>

        <FieldGroup title="支払情報">
          <InputField
            id="add-entry-add-net"
            label="支払NET（追加口分）"
            value={form.addNet}
            onChange={(v) => set('addNet', v)}
            numeric
            maxFractionDigits={2}
          />
          <InputField
            id="add-entry-pay-net"
            label="支払NET（全体）"
            value={form.payNet}
            onChange={(v) => set('payNet', v)}
            numeric
            maxFractionDigits={2}
          />
          <InputField
            id="add-entry-pay-cases"
            label="ケース"
            value={form.payCases}
            onChange={(v) => set('payCases', v)}
            numeric
            maxFractionDigits={0}
          />
          <InputField
            id="add-entry-pay-loose"
            label="バラ"
            value={form.payLoose}
            onChange={(v) => set('payLoose', v)}
            numeric
            maxFractionDigits={0}
          />
          <ReadOnlyField
            id="add-entry-add-unit"
            label="追加口バラ単価"
            hint={AUTO_CALC_HINT}
          />
          <ReadOnlyField
            id="add-entry-exp-unit"
            label="拡売費バラ単価（NET未承認）"
            hint={AUTO_CALC_HINT}
          />
          <ReadOnlyField
            id="add-entry-add-amount"
            label="追加口金額"
            hint={AUTO_CALC_HINT}
          />
          <ReadOnlyField
            id="add-entry-exp-amount"
            label="拡売費金額（NET未承認）"
            hint={AUTO_CALC_HINT}
          />
          <ReadOnlyField
            id="add-entry-pay-amount"
            label="支払金額"
            hint={AUTO_CALC_HINT}
          />
        </FieldGroup>

        {/* 一覧の「請求-支払」は差額のみ。照合支払区分は独立した見出しになっている。 */}
        <FieldGroup title="請求-支払">
          <ReadOnlyField
            id="add-entry-diff"
            label="差額"
            hint={AUTO_CALC_HINT}
          />
        </FieldGroup>

        <FieldGroup title="照合支払区分">
          <SelectField
            id="add-entry-match-type"
            label="※差がある場合のみ"
            value={form.matchType}
            onChange={(v) => set('matchType', v)}
            options={MATCH_PAYMENT_TYPE_OPTIONS.map((v) => ({
              value: v,
              label: v,
            }))}
            placeholder="照合支払区分を選択"
          />
        </FieldGroup>

        <FieldGroup title="その他">
          {/* 摘要1→摘要2→函数無効チェック→最終NET の順に、横に並べず上下に並べる
              （各項目がグループの1行を丸ごと使う）。 */}
          <InputField
            id="add-entry-summary1"
            label="摘要1（社内用）"
            value={form.summary1}
            onChange={(v) => set('summary1', v)}
            wide
          />
          <InputField
            id="add-entry-summary2"
            label="摘要2（社外用）"
            value={form.summary2}
            onChange={(v) => set('summary2', v)}
            wide
          />
          <CheckField
            id="add-entry-func-check"
            label="函数無効チェック"
            checked={form.funcCheck}
            onChange={(v) => set('funcCheck', v)}
            wide
          />
          {/* 最終NET：グリッドと同じく、函数無効チェックの状態を問わず入力できる。
              ただし函数無効チェックONのときは必須（未入力なら追加できない）。 */}
          <InputField
            id="add-entry-final-net"
            label="最終NET"
            value={form.finalNet}
            onChange={(v) => set('finalNet', v)}
            numeric
            maxFractionDigits={2}
            wide
            required={finalNetRequired}
            invalid={isSubmitted && finalNetMissing}
          />
        </FieldGroup>

        {/* 請求書情報：常に活性（入力可）。 */}
        <FieldGroup title="請求書情報">
          <InputField
            id="add-entry-bill-page"
            label="請求書ページ"
            value={form.billPage}
            onChange={(v) => set('billPage', v)}
          />
          <InputField
            id="add-entry-bill-no"
            label="請求明細番号"
            value={form.billDetailNo}
            onChange={(v) => set('billDetailNo', v)}
          />
          <InputField
            id="add-entry-retailer"
            label="販売店名"
            value={form.retailerName}
            onChange={(v) => set('retailerName', v)}
          />
        </FieldGroup>
      </div>
    );
  }
);
