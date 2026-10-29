import { useState } from 'react';
import { toast } from 'sonner';
import {
  findOrgItem,
  type OrgItem,
  type OrgLevel,
} from '../../constants/orgHierarchy';
import {
  applyOrgSelection,
  orgCandidates,
  type OrgCascadeConfig,
  type OrgCascadeState,
} from '../../utils/orgCascade';
import type { MultiComboboxOption } from './multi-combobox';
import { formatSummaryValues, type SearchSummaryItem } from './search-summary';

// 検索条件の組織項目（事業場 → 部署 → 末端組織 → 担当者）を連動させるフック（画面共通）。
// 連動のルールは utils/orgCascade.ts。自動で追加・解除したときは画面右上に通知する（ルール⑦）。
// 使い方：
//   const org = useOrgCascadeSearch(CONFIG, { office: ['hokkaido'] });
//   <MultiCombobox options={toOrgComboOptions(org.options('office'))}
//     value={org.values('office')} onChange={(v) => org.change('office', v)} />
//   クリアは org.reset()。
export function useOrgCascadeSearch(
  config: OrgCascadeConfig,
  initial: Partial<Record<OrgLevel, string[]>> = {}
) {
  const [state, setState] = useState<OrgCascadeState>({
    values: initial,
    autoOnly: [],
    autoSelected: [],
  });

  const values = (level: OrgLevel) => state.values[level] ?? [];

  // その項目の選択肢（ルール①⑤で絞り込んだもの）
  const options = (level: OrgLevel): OrgItem[] =>
    orgCandidates(config, state, level)
      .map((v) => findOrgItem(level, v))
      .filter((o): o is OrgItem => o !== undefined);

  // 利用者が項目の選択値を変えた
  const change = (level: OrgLevel, next: string[]) => {
    const r = applyOrgSelection(config, state, level, next);
    setState(r.state);
    // 自動追加・自動選択・自動解除を項目ごとの行にして通知する（選択肢の増減は通知しない）
    [[...r.addedMessages, ...r.selectedMessages], r.removedMessages].forEach((lines) => {
      if (lines.length === 0) return;
      toast.info(
        <div>
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      );
    });
  };

  // 選択値を入れ直す（クリア等。自動追加の状態も解除する）
  const reset = (next: Partial<Record<OrgLevel, string[]>> = {}) =>
    setState({ values: next, autoOnly: [], autoSelected: [] });

  // 検索条件カードを折り畳んだときの要約の項目（組織項目を上位から順に。→ ui/search-summary.ts）。
  // 表示名は toOrgComboOptions と同じ形式にする。
  const summaryItems = (
    format: 'name' | 'nameCode' | 'codeName' = 'name'
  ): SearchSummaryItem[] =>
    config.levels.map((level) => ({
      label: config.labels[level] ?? '',
      value: formatSummaryValues(
        values(level).map((v) => {
          const item = findOrgItem(level, v);
          if (!item) return v;
          return format === 'codeName' ? `${item.code}:${item.name}` : item.name;
        }),
        undefined,
        config.units?.[level]
      ),
    }));

  return { values, options, change, reset, summaryItems };
}

// 組織の項目を MultiCombobox の選択肢にする。
//   'name'      … 名称だけ
//   'nameCode'  … 名称＋2行目にコード（名称・コードどちらでも絞り込める）
//   'codeName'  … 「コード:名称」（支払一覧系の表記）
export function toOrgComboOptions(
  items: OrgItem[],
  format: 'name' | 'nameCode' | 'codeName' = 'name'
): MultiComboboxOption[] {
  return items.map((o) =>
    format === 'codeName'
      ? { value: o.value, label: `${o.code}:${o.name}` }
      : format === 'nameCode'
        ? { value: o.value, label: o.name, code: o.code }
        : { value: o.value, label: o.name }
  );
}
