// 通知管理マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/notification-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/notification-master.json）。項目はエンティティ定義に合わせる。
// 通知管理マスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「通知管理マスタ」。
// 通知の内容・タイミングは 260515_通知とおしらせ整理（手売・自販機）_v0.1 のお知らせ・通知v2 シートを基にしたモック。
// 2026-10-30 Q&A QM-034：本文（200・400 文字）は複数行の入力欄、タイトル・名称（40 文字）は幅の広い入力欄。一覧は列幅で省略しマウスオーバーで全文を表示。リッチテキストは使わない。

import type { MasterScreenDef } from '@/app/components/shared/master';

export const NOTIFICATION_DEF: MasterScreenDef = {
  routeId: 'notification-master',
  title: '通知管理マスタ',
  entityLabel: '通知',
  fields: [
    {
      key: 'notificationNo',
      label: '通知番号',
      kind: 'text',
      pk: true,
      required: true,
      searchAlsoKeys: ['notificationName'],
      readOnly: true,
    },
    {
      key: 'notificationType',
      label: '通知種類',
      kind: 'select',
      required: true,
      options: [
        { code: '01', name: 'ブラウザ通知' },
        { code: '02', name: 'メール通知' },
        { code: '03', name: 'ブラウザ通知＋メール通知' },
      ],
    },
    {
      key: 'notificationName',
      label: '通知名称',
      kind: 'text',
      required: true,
      maxLength: 40,
      placeholder: '全角40文字以内',
    },
    {
      key: 'browserTitle',
      label: 'ブラウザ通知タイトル',
      kind: 'text',
      maxLength: 40,
      placeholder: '全角40文字以内',
    },
    {
      key: 'browserBody',
      label: 'ブラウザ通知本文',
      kind: 'textarea',
      maxLength: 200,
      placeholder: '全角200文字以内',
    },
    {
      key: 'browserTiming',
      label: 'ブラウザ通知タイミング',
      kind: 'select',
      options: [
        { code: '01', name: '即時' },
        { code: '02', name: '日次（翌朝にまとめて）' },
      ],
    },
    {
      key: 'mailTitle',
      label: 'メール通知タイトル',
      kind: 'text',
      maxLength: 40,
      placeholder: '全角40文字以内',
    },
    {
      key: 'mailBody',
      label: 'メール通知本文',
      kind: 'textarea',
      maxLength: 400,
      placeholder: '全角400文字以内',
    },
    {
      key: 'mailTiming',
      label: 'メール通知タイミング',
      kind: 'select',
      options: [
        { code: '01', name: '即時' },
        { code: '02', name: '日次（翌朝にまとめて）' },
      ],
    },
  ],
  searchKeys: ['notificationNo', 'notificationType'],
  inactivation: true,
  autoNumberKey: 'notificationNo',
  autoNumberPrefix: 'NT',
};
