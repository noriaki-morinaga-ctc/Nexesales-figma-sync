// 支払詳細(紐づけなし)・拡売費計画(紐づき無し)：組織・担当者の選択肢のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 実システムでは組織マスタ・担当者マスタから取得する。

import type { SelectionOption } from '@/types/planDetail';

// 末端組織（部署配下の営業所単位）。拡売費計画(商流販売店に紐づき無し)の基本情報で使用。
export const TERMINAL_ORG_OPTIONS: SelectionOption[] = [
  { value: '東京第一営業所', label: '東京第一営業所', code: 'ORG001' },
  { value: '東京第二営業所', label: '東京第二営業所', code: 'ORG002' },
  { value: '横浜営業所', label: '横浜営業所', code: 'ORG003' },
  { value: '千葉営業所', label: '千葉営業所', code: 'ORG004' },
  { value: '埼玉営業所', label: '埼玉営業所', code: 'ORG005' },
];

export const SALES_PERSON_OPTIONS: SelectionOption[] = [
  { value: '山田 太郎', label: '山田 太郎', code: 'EMP001' },
  { value: '佐藤 花子', label: '佐藤 花子', code: 'EMP002' },
  { value: '鈴木 一郎', label: '鈴木 一郎', code: 'EMP003' },
  { value: '田中 美咲', label: '田中 美咲', code: 'EMP004' },
  { value: '高橋 健太', label: '高橋 健太', code: 'EMP005' },
];

// 事業所
export const OFFICE_OPTIONS: SelectionOption[] = [
  { value: '首都圏本部', label: '首都圏本部', code: 'OFC001' },
  { value: '関西本部', label: '関西本部', code: 'OFC002' },
  { value: '中部本部', label: '中部本部', code: 'OFC003' },
  { value: '北海道支社', label: '北海道支社', code: 'OFC004' },
  { value: '九州支社', label: '九州支社', code: 'OFC005' },
];

// 部署
export const DEPARTMENT_OPTIONS: SelectionOption[] = [
  { value: '首都圏営業第一部', label: '首都圏営業第一部', code: 'DPT001' },
  { value: '首都圏営業第二部', label: '首都圏営業第二部', code: 'DPT002' },
  { value: '関西営業部', label: '関西営業部', code: 'DPT003' },
  { value: '中部営業部', label: '中部営業部', code: 'DPT004' },
];
