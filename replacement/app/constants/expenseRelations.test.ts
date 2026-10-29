import { describe, it, expect } from 'vitest';
import {
  accountItemFromManagementClass,
  fillFromManagementCode,
  fillFromManagementClass,
  fillFromCampaignCode,
  fillFromCampaignClass,
  managementClassFromCode,
  isManagementCodeInClass,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
} from './expenseRelations';
import {
  managementCodeNameOf,
  managementClassCodeOf,
} from './comboFieldOptions';

describe('accountItemFromManagementClass', () => {
  it('管理区分に対応する勘定科目を返す', () => {
    expect(accountItemFromManagementClass('売上連動拡売費A口')).toBe('販促費');
  });

  it('未定義の管理区分は空文字を返す', () => {
    expect(accountItemFromManagementClass('存在しない区分')).toBe('');
  });
});

describe('fillFromManagementCode', () => {
  it('管理コードから管理区分・勘定科目を補完する', () => {
    expect(fillFromManagementCode('RA001')).toEqual({
      ManagementCode: 'RA001',
      ManagementClass: '売上連動拡売費A口',
      AccountItem: '販促費',
    });
  });

  it('接頭辞が異なれば別の管理区分になる', () => {
    expect(fillFromManagementCode('FH002')).toEqual({
      ManagementCode: 'FH002',
      ManagementClass: '拡売費(固定費)本社口',
      AccountItem: '販促費',
    });
  });

  it('管理コードをクリアしても管理区分は維持する（キーを省略する）', () => {
    expect(fillFromManagementCode('')).toEqual({ ManagementCode: '' });
  });
});

describe('fillFromManagementClass', () => {
  it('管理区分に該当する管理コードは維持する', () => {
    expect(fillFromManagementClass('売上連動拡売費A口', 'RA002')).toEqual({
      ManagementClass: '売上連動拡売費A口',
      AccountItem: '販促費',
      ManagementCode: 'RA002',
    });
  });

  it('管理区分に該当しない管理コードはクリアする', () => {
    expect(fillFromManagementClass('売上連動拡売費A口', 'FB001')).toEqual({
      ManagementClass: '売上連動拡売費A口',
      AccountItem: '販促費',
      ManagementCode: '',
    });
  });

  it('管理コードが未入力なら空のまま維持する', () => {
    expect(fillFromManagementClass('売上連動拡売費B口', '')).toEqual({
      ManagementClass: '売上連動拡売費B口',
      AccountItem: '販促費',
      ManagementCode: '',
    });
  });
});

describe('fillFromCampaignCode', () => {
  it('施策コードから施策区分を補完する（勘定科目は持たない）', () => {
    expect(fillFromCampaignCode('SN001')).toEqual({
      CampaignCode: 'SN001',
      CampaignClass: '新規導入',
    });
  });

  it('施策コードをクリアしても施策区分は維持する（キーを省略する）', () => {
    expect(fillFromCampaignCode('')).toEqual({ CampaignCode: '' });
  });
});

describe('fillFromCampaignClass', () => {
  it('施策区分に該当する施策コードは維持する', () => {
    expect(fillFromCampaignClass('販売促進', 'SP002')).toEqual({
      CampaignClass: '販売促進',
      CampaignCode: 'SP002',
    });
  });

  it('施策区分に該当しない施策コードはクリアする', () => {
    expect(fillFromCampaignClass('販売促進', 'SR001')).toEqual({
      CampaignClass: '販売促進',
      CampaignCode: '',
    });
  });
});

describe('自販機関連費・ロケ補填の管理区分（補足3-1 No.22〜24・31）', () => {
  it('4つの管理区分がコード接頭辞から導出できる', () => {
    expect(managementClassFromCode('LC001')).toBe('ロケ補填');
    expect(managementClassFromCode('CL001')).toBe('コラム料');
    expect(managementClassFromCode('LS001')).toBe('リース料');
    expect(managementClassFromCode('EQ001')).toBe('販売器具費');
  });

  it('管理区分の選択肢に4区分が含まれる', () => {
    const values = EXPENSE_MANAGEMENT_CLASS_OPTIONS.map((o) => o.value);
    expect(values).toContain('ロケ補填');
    expect(values).toContain('コラム料');
    expect(values).toContain('リース料');
    expect(values).toContain('販売器具費');
  });

  it('管理コードの選択肢はすべて管理区分へ解決できる（追加後は17件）', () => {
    // 空配列化に対しても検出できるよう、まず件数を明示的に固定する
    // （既存12件 + 今回追加の LC001/LC002/CL001/LS001/EQ001 の5件 = 17件）。
    expect(EXPENSE_MANAGEMENT_CODE_OPTIONS.length).toBe(17);
    const values = EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(
      expect.arrayContaining(['LC001', 'LC002', 'CL001', 'LS001', 'EQ001'])
    );
    for (const option of EXPENSE_MANAGEMENT_CODE_OPTIONS) {
      expect(managementClassFromCode(option.value), option.value).not.toBe('');
    }
  });

  it('管理コード名称（comboFieldOptions）が新4区分について実在の名称を返す', () => {
    expect(managementCodeNameOf('LC001')).toBe('ロケーション補填');
    expect(managementCodeNameOf('LC002')).toBe('ロケ設置協力金');
    expect(managementCodeNameOf('CL001')).toBe('コラム使用料');
    expect(managementCodeNameOf('LS001')).toBe('自販機リース料');
    expect(managementCodeNameOf('EQ001')).toBe('販売器具購入費');
  });

  it('管理区分の区分値（comboFieldOptions）が新4区分について一意に採番される', () => {
    const rokaCode = managementClassCodeOf('ロケ補填');
    const columnCode = managementClassCodeOf('コラム料');
    const leaseCode = managementClassCodeOf('リース料');
    const equipmentCode = managementClassCodeOf('販売器具費');

    // いずれも空文字ではない（未定義区分ではない）
    for (const code of [rokaCode, columnCode, leaseCode, equipmentCode]) {
      expect(code).not.toBe('');
    }

    // 既存6区分（RA/RB/RH/FA/FB/FH に対応する区分値）と衝突していないこと。
    // MANAGEMENT_CLASS_CODE は seq2（配列インデックス由来）で採番されるため、
    // 末尾追加であれば既存6区分の区分値は 10/20/30/40/50/60 のまま変わらない。
    const existingCodes = [
      managementClassCodeOf('売上連動拡売費A口'),
      managementClassCodeOf('売上連動拡売費B口'),
      managementClassCodeOf('売上連動拡売費本社口'),
      managementClassCodeOf('拡売費(固定費)A口'),
      managementClassCodeOf('拡売費(固定費)B口'),
      managementClassCodeOf('拡売費(固定費)本社口'),
    ];
    expect(existingCodes).toEqual(['10', '20', '30', '40', '50', '60']);

    // 新4区分は既存6区分・互いに重複しない一意な区分値を持つ
    const allCodes = [
      ...existingCodes,
      rokaCode,
      columnCode,
      leaseCode,
      equipmentCode,
    ];
    expect(new Set(allCodes).size).toBe(allCodes.length);

    // 末尾追加（seq2 はインデックス由来）である以上、具体的な値も 70/80/90/100 になる
    expect([rokaCode, columnCode, leaseCode, equipmentCode]).toEqual([
      '70',
      '80',
      '90',
      '100',
    ]);
  });

  it('isManagementCodeInClass が新4区分の所属判定を正しく行う', () => {
    expect(isManagementCodeInClass('LC001', 'ロケ補填')).toBe(true);
    expect(isManagementCodeInClass('LC001', 'コラム料')).toBe(false);
    expect(isManagementCodeInClass('CL001', 'コラム料')).toBe(true);
    expect(isManagementCodeInClass('CL001', 'リース料')).toBe(false);
    expect(isManagementCodeInClass('LS001', 'リース料')).toBe(true);
    expect(isManagementCodeInClass('EQ001', '販売器具費')).toBe(true);
    expect(isManagementCodeInClass('EQ001', 'ロケ補填')).toBe(false);
  });
});
