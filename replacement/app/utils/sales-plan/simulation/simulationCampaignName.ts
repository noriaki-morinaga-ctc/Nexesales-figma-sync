// 企画名の連動（8.参考資料_企画・確度の管理 3.(2)）。
// 企画名は「対象年月×企画」ごとに1つだけ持ち、確度に関わらず同じ対象年月・同じ企画の明細は同じ企画名にする。

// 連動の判定に必要な行の項目（明細表の行の部分集合）
export interface CampaignNameRow {
  id?: string;
  targetMonth?: string;
  campaign?: string;
  campaignName?: string;
}

// 同じ対象年月・同じ企画の明細に登録済みの企画名を返す（無ければ空）。excludeId の行は見ない。
export const registeredCampaignName = (
  rows: CampaignNameRow[],
  targetMonth: string | undefined,
  campaign: string | undefined,
  excludeId?: string
): string => {
  if (!campaign) return '';
  const found = rows.find(
    (row) =>
      row.id !== excludeId &&
      row.targetMonth === targetMonth &&
      row.campaign === campaign &&
      !!row.campaignName
  );
  return found?.campaignName ?? '';
};

// 企画のプルダウンの選択肢。使用中の企画は企画名を併記する（例：企画01（アプリ連動値引企画））。
export const campaignComboOptions = (
  campaigns: string[],
  rows: CampaignNameRow[],
  targetMonth: string | undefined
) =>
  campaigns.map((campaign) => {
    const name = registeredCampaignName(rows, targetMonth, campaign);
    return {
      value: campaign,
      label: name ? `${campaign}（${name}）` : campaign,
    };
  });
