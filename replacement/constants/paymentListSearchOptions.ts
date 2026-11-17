// 支払一覧の検索条件で使う選択肢（単一選択・「コード:名称」で表示／コード・名称どちらでも検索）。
// 振替詳細の「検印済み明細（振替元）」の検索条件も同じ項目・同じ選択肢を使うため、
// 画面コンポーネントから本ファイルへ切り出して一元管理する。
import type { SingleComboboxOption } from '@/components/ui/single-combobox';
import {
  NO_PAYMENT_STATUS,
  STATUS_FILTER_ALL,
  STATUS_FILTER_EXCLUDING_NO_PAYMENT,
} from '@/utils/payment/payment-list/paymentApplicationList';

// 事業場
export const OFFICE_OPTIONS: SingleComboboxOption[] = [
  { value: 'hokkaido', label: '10000621:北海道支社' },
  { value: 'tohoku', label: '10000622:東北支社' },
  { value: 'shutoken', label: '10000623:首都圏支社' },
  { value: 'kinki', label: '10000624:近畿圏支社' },
  { value: 'shikoku', label: '10000625:四国支社' },
  { value: 'kyushu', label: '10000626:九州支社' },
];

// 部署
export const DEPARTMENT_OPTIONS: SingleComboboxOption[] = [
  { value: 'hokkaido-sales-1', label: '10002984:北海道営業一部' },
  { value: 'tohoku-sales-1', label: '10002985:東北営業一部' },
  { value: 'shutoken-sales-1', label: '10002986:首都圏営業一部' },
  { value: 'kinki-sales-1', label: '10002987:近畿圏営業一部' },
  { value: 'shikoku-sales-1', label: '10002988:四国営業一部' },
  { value: 'kyushu-sales-1', label: '10002989:九州営業一部' },
];

// 営業担当者
export const SALES_REP_OPTIONS: SingleComboboxOption[] = [
  { value: 'yamada-taro', label: '5172733:山田 太郎' },
  { value: 'sato-hanako', label: '5172734:佐藤 花子' },
  { value: 'suzuki-ichiro', label: '5172735:鈴木 一郎' },
  { value: 'tanaka-misaki', label: '5172736:田中 美咲' },
  { value: 'takahashi-kenta', label: '5172737:高橋 健太' },
];

// 販売店。value に販売店コードを持たせ、絞り込みに直接使う。
export const RETAILER_OPTIONS: SingleComboboxOption[] = [
  { value: '30200740', label: '30200740:セブン-イレブン' },
  { value: '30200741', label: '30200741:ファミリーマート' },
  { value: '30200742', label: '30200742:ローソン' },
  { value: '30200743', label: '30200743:イオン' },
];
import type { StoreOption } from '@/types/paymentList';

// 一次店
export const PRIMARY_STORE_OPTIONS: StoreOption[] = [
  {
    value: '10010075',
    label: '10010075:国分6社通販',
    retailerCode: '30200740',
  },
  {
    value: '10010076',
    label: '10010076:三菱食品株式会社北見営業所',
    retailerCode: '30200741',
  },
  {
    value: '10010077',
    label: '10010077:伊藤忠食品札幌支店',
    retailerCode: '30200742',
  },
  {
    value: '10010078',
    label: '10010078:日本アクセス仙台営業所',
    retailerCode: '30200743',
  },
];

// 三次店
export const TERTIARY_STORE_OPTIONS: StoreOption[] = [
  {
    value: '10754882',
    label: '10754882:国分北海道株式会社経営FC',
    retailerCode: '30200740',
  },
  {
    value: '10754883',
    label: '10754883:三菱食品株式会社広島FC',
    retailerCode: '30200741',
  },
  {
    value: '10754884',
    label: '10754884:伊藤忠食品株式会社東北支社',
    retailerCode: '30200742',
  },
  {
    value: '10754885',
    label: '10754885:日本アクセス株式会社首都圏支社',
    retailerCode: '30200743',
  },
];

// 末端組織（部署配下の営業所単位）。組織階層は 事業場→部署→末端組織→営業担当者。
export const TERMINAL_ORG_OPTIONS: SingleComboboxOption[] = [
  { value: 'sapporo-1', label: '10005001:札幌第一営業所' },
  { value: 'sapporo-2', label: '10005002:札幌第二営業所' },
  { value: 'sendai-1', label: '10005003:仙台営業所' },
  { value: 'tokyo-1', label: '10005004:東京第一営業所' },
  { value: 'osaka-1', label: '10005005:大阪営業所' },
];

// ステータスの選択肢（値＝表示名。STATUS_FILTER_ALL は「全て」）。
// 「支払無し以外」は検索条件の初期値で、支払無しの伝票だけを除く（課題No.0949）。
export const STATUS_FILTER_OPTIONS = [
  { value: STATUS_FILTER_ALL, label: '全て' },
  { value: STATUS_FILTER_EXCLUDING_NO_PAYMENT, label: '支払無し以外' },
  { value: '未申請', label: '未申請' },
  { value: NO_PAYMENT_STATUS, label: NO_PAYMENT_STATUS },
  { value: '承認待ち', label: '承認待ち' },
  { value: '承認差戻し', label: '承認差戻し' },
  { value: '検印待ち', label: '検印待ち' },
  { value: '検印差戻し', label: '検印差戻し' },
  { value: '検印済', label: '検印済' },
];
