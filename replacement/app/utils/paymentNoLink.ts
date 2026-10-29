// 支払詳細(商流販売店紐づけなし) の判定・転記・計算（純粋関数）。
// React / AG Grid の結合部は型チェックと目視で確認するため、ここには UI 依存を持ち込まない。

/**
 * 商流販売店に紐づかない支払の作成単位パターン。
 * 基本情報のラジオボタンで明示的に選択する（ダミーの組合せからは導出しない。
 * 導出だと「まだ選んでいない」と「④＝全てダミー」を区別できないため）。
 */
export const NO_LINK_PATTERN = {
  /** ② 商流のみに紐づく */
  distributionOnly: '商流のみに紐づく',
  /** ③ 販売店のみに紐づく */
  dealerOnly: '販売店のみに紐づく',
  /** ④ 末端組織のみに紐づく（商流にも販売店にも紐づかない） */
  terminalOrgOnly: '末端組織のみに紐づく',
} as const;

export type NoLinkPattern =
  (typeof NO_LINK_PATTERN)[keyof typeof NO_LINK_PATTERN];

/**
 * ダミーコードの表示。
 * 実際のコード値は未確定（単位 6/23 は「ダミー値 ≠ 99999999」としか定めていない。
 * 「その他販売店(99999999)」は実在の販売店コードでありダミー値ではない）。
 */
export const DUMMY_STORE_LABEL = '－（ダミーコード）';

/** 商流販売店の各項目を入力できるか（true＝入力／false＝ダミーコード固定）。 */
export interface StoreInputAvailability {
  dealer: boolean;
  firstStore: boolean;
  thirdStore: boolean;
}

/**
 * 作成単位パターンごとの、商流販売店の入力可否。
 * 権限整理 P9〜P11 の「ダミーコードを利用する」対象をそのまま表す。
 *   ② 商流のみ   → 販売店がダミー（P9）
 *   ③ 販売店のみ → 一次店・三次店がダミー（P10）
 *   ④ 末端組織   → 一次店・三次店・販売店がダミー（P11）
 */
export function storeInputAvailability(
  pattern: NoLinkPattern
): StoreInputAvailability {
  switch (pattern) {
    case NO_LINK_PATTERN.distributionOnly:
      return { dealer: false, firstStore: true, thirdStore: true };
    case NO_LINK_PATTERN.dealerOnly:
      return { dealer: true, firstStore: false, thirdStore: false };
    case NO_LINK_PATTERN.terminalOrgOnly:
      return { dealer: false, firstStore: false, thirdStore: false };
    default:
      // 型では 3 パターンに閉じているが、本リポジトリには型チェックのゲートが無いため
      // 実行時に未知の値が来たらここで落とす。④（全てダミー）へ寄せると、誤った
      // 作成単位を正しい答えとして返してしまうため、フォールバックしない。
      throw new Error(`未知の作成単位パターン: ${pattern}`);
  }
}

/** 費用分割で追加された分割先行か（全セル非活性で表示する）。 */
export const SPLIT_DEST_LABEL = '分割先';

/**
 * 分割先行か。分割先行は分割元の内容を引き継いだ参照用の行のため、
 * 全セルを非活性にする（レビュー指摘 2026/7/22。パターンB・パターンCと同じ扱い）。
 */
export function isSplitDestRow(row: { costSplit?: string }): boolean {
  return row.costSplit === SPLIT_DEST_LABEL;
}
