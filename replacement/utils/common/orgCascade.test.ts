import { describe, expect, it } from 'vitest';
import {
  applyOrgSelection,
  orgCandidates,
  type OrgCascadeConfig,
  type OrgCascadeState,
} from './orgCascade';

// 仕様タブ（連動フィルタリング）の例を、事業場・部署・末端組織・作成者の4階層で確かめる。
const CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'terminalOrg', 'salesRep'],
  labels: {
    office: '事業場',
    department: '部署',
    terminalOrg: '末端組織',
    salesRep: '作成者',
  },
};
const EMPTY: OrgCascadeState = { values: {}, autoOnly: [] };
const state = (
  values: OrgCascadeState['values'],
  autoOnly: OrgCascadeState['autoOnly'] = []
): OrgCascadeState => ({ values, autoOnly });

describe('orgCandidates（ルール①⑤）', () => {
  it('上位が指定なしなら全件', () => {
    expect(orgCandidates(CONFIG, EMPTY, 'department')).toHaveLength(7);
    expect(orgCandidates(CONFIG, EMPTY, 'terminalOrg')).toHaveLength(8);
  });

  it('事業場で絞り込む（例：北海道支社）', () => {
    const s = state({ office: ['hokkaido'] });
    expect(orgCandidates(CONFIG, s, 'department')).toEqual([
      'hokkaido-sales-1',
      'hokkaido-sales-2',
    ]);
    expect(orgCandidates(CONFIG, s, 'terminalOrg')).toEqual([
      'sapporo-1',
      'sapporo-2',
      'asahikawa-1',
    ]);
  });

  it('自動追加の値だけの項目は絞り込まず、さらに上位で判定する', () => {
    const s = state(
      { office: ['hokkaido', 'tohoku'], department: ['tohoku-sales-1'] },
      ['department']
    );
    expect(orgCandidates(CONFIG, s, 'terminalOrg')).toEqual([
      'sapporo-1',
      'sapporo-2',
      'asahikawa-1',
      'sendai-1',
    ]);
  });
});

describe('applyOrgSelection', () => {
  it('ルール②：上位の値を外すと、選択肢から外れた下位の値を連鎖して解除する', () => {
    const prev = state({
      office: ['hokkaido', 'tohoku'],
      department: ['hokkaido-sales-1', 'tohoku-sales-1'],
      terminalOrg: ['sapporo-1', 'sendai-1'],
    });
    const r = applyOrgSelection(CONFIG, prev, 'office', ['hokkaido']);
    expect(r.state.values.department).toEqual(['hokkaido-sales-1']);
    expect(r.state.values.terminalOrg).toEqual(['sapporo-1']);
  });

  it('ルール③：上位をすべて外しても、下位の値は解除しない', () => {
    const prev = state({
      office: ['tohoku'],
      department: ['tohoku-sales-1'],
      terminalOrg: ['sendai-1'],
    });
    const r = applyOrgSelection(CONFIG, prev, 'office', []);
    expect(r.state.values.department).toEqual(['tohoku-sales-1']);
    expect(r.state.values.terminalOrg).toEqual(['sendai-1']);
    expect(orgCandidates(CONFIG, r.state, 'department')).toHaveLength(7);
  });

  it('ルール④⑤：下位を選ぶと所属先を上位へ連鎖して追加し、自動追加の値だけの状態にする', () => {
    const r = applyOrgSelection(CONFIG, EMPTY, 'terminalOrg', ['sendai-1']);
    expect(r.state.values.office).toEqual(['tohoku']);
    expect(r.state.values.department).toEqual(['tohoku-sales-1']);
    expect(r.state.autoOnly.sort()).toEqual(['department', 'office']);
    // 自動追加の値だけのため、選択肢は狭まらない（続けて別の事業場の末端組織も選べる）
    expect(orgCandidates(CONFIG, r.state, 'terminalOrg')).toHaveLength(8);
  });

  it('ルール⑤ 例1：自動追加の値だけのときは、別の事業場の値も続けて選べる', () => {
    const prev = applyOrgSelection(CONFIG, EMPTY, 'terminalOrg', [
      'sendai-1',
    ]).state;
    const r = applyOrgSelection(CONFIG, prev, 'terminalOrg', [
      'sendai-1',
      'sapporo-1',
    ]);
    expect(r.state.values.office).toEqual(['hokkaido', 'tohoku']);
    expect(r.state.values.department).toEqual([
      'hokkaido-sales-1',
      'tohoku-sales-1',
    ]);
    expect(r.state.values.terminalOrg).toEqual(['sapporo-1', 'sendai-1']);
    expect(r.state.autoOnly.sort()).toEqual(['department', 'office']);
  });

  it('ルール⑤ 例2：利用者が事業場を操作すると絞り込むようになり、既存の下位の値は残る', () => {
    const prev = applyOrgSelection(CONFIG, EMPTY, 'terminalOrg', [
      'sendai-1',
    ]).state;
    const r = applyOrgSelection(CONFIG, prev, 'office', ['hokkaido', 'tohoku']);
    expect(r.state.autoOnly).toEqual(['department']);
    expect(orgCandidates(CONFIG, r.state, 'department')).toEqual([
      'hokkaido-sales-1',
      'hokkaido-sales-2',
      'tohoku-sales-1',
    ]);
    expect(orgCandidates(CONFIG, r.state, 'terminalOrg')).toEqual([
      'sapporo-1',
      'sapporo-2',
      'asahikawa-1',
      'sendai-1',
    ]);
    expect(r.state.values.terminalOrg).toEqual(['sendai-1']);
  });

  it('ルール⑥：下位の値を外しても、上位の値は変わらない', () => {
    const prev = state({
      office: ['tohoku'],
      department: ['tohoku-sales-1'],
      terminalOrg: ['sendai-1'],
    });
    const r = applyOrgSelection(CONFIG, prev, 'terminalOrg', []);
    expect(r.state.values.office).toEqual(['tohoku']);
    expect(r.state.values.department).toEqual(['tohoku-sales-1']);
  });

  it('末端組織の無い画面では、担当者の所属先を部署へ追加する', () => {
    const cfg: OrgCascadeConfig = {
      levels: ['office', 'department', 'salesRep'],
      labels: { office: '事業場', department: '部署', salesRep: '営業担当者' },
    };
    const r = applyOrgSelection(cfg, EMPTY, 'salesRep', ['suzuki-ichiro']);
    expect(r.state.values.department).toEqual(['tohoku-sales-1']);
    expect(r.state.values.office).toEqual(['tohoku']);
  });
});

describe('applyOrgSelection（ルール⑧：選択肢が1件の自動選択）', () => {
  it('上位を選んで選択肢が1件になった下位は、上から順に自動で選ぶ', () => {
    const r = applyOrgSelection(CONFIG, EMPTY, 'office', ['tohoku']);
    expect(r.state.values.department).toEqual(['tohoku-sales-1']);
    expect(r.state.values.terminalOrg).toEqual(['sendai-1']);
    expect(r.state.values.salesRep).toEqual(['suzuki-ichiro']);
    expect(r.state.autoSelected).toEqual([
      'department',
      'terminalOrg',
      'salesRep',
    ]);
  });

  it('選択肢が2件以上なら自動で選ばない', () => {
    const r = applyOrgSelection(CONFIG, EMPTY, 'office', ['hokkaido']);
    expect(r.state.values.department ?? []).toEqual([]);
  });

  it('上位を変えて選択肢が1件でなくなったら、自動で選んだ値を解除する', () => {
    const selected = applyOrgSelection(CONFIG, EMPTY, 'office', [
      'tohoku',
    ]).state;
    const r = applyOrgSelection(CONFIG, selected, 'office', [
      'tohoku',
      'hokkaido',
    ]);
    expect(r.state.values.department).toEqual([]);
    expect(r.state.values.terminalOrg).toEqual([]);
    expect(r.state.values.salesRep).toEqual([]);
    expect(r.state.autoSelected).toEqual([]);
  });

  it('上位をすべて外したら、自動で選んだ値も解除する（ルール③の例外）', () => {
    const selected = applyOrgSelection(CONFIG, EMPTY, 'office', [
      'tohoku',
    ]).state;
    const r = applyOrgSelection(CONFIG, selected, 'office', []);
    expect(r.state.values.department).toEqual([]);
    expect(r.state.values.salesRep).toEqual([]);
  });

  it('利用者が自動で選んだ値を外したら、その項目は自動選択の対象から外れ、選び直さない', () => {
    const selected = applyOrgSelection(CONFIG, EMPTY, 'office', [
      'tohoku',
    ]).state;
    const r = applyOrgSelection(CONFIG, selected, 'salesRep', []);
    expect(r.state.values.salesRep).toEqual([]);
    expect(r.state.autoSelected).toEqual(['department', 'terminalOrg']);
    // 下位の操作では、上位は自動で選び直さない（自動選択は操作した項目より下だけ）
    const r2 = applyOrgSelection(CONFIG, r.state, 'salesRep', []);
    expect(r2.state.values.salesRep).toEqual([]);
  });
});
