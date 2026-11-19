// 計画一覧（sales-plan/plan-list）：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。

import { ORG_ITEMS } from '@/constants/orgHierarchy';
import { VENDING_PATTERN } from '@/features/sales-plan/plan-list/constants';
import type {
  SalesPlanData,
  StoreDetail,
} from '@/features/sales-plan/plan-list/planList.types';

type CodeKey =
  | 'retailerCode'
  | 'tertiaryStoreCode'
  | 'primaryStoreCode'
  | 'tertiaryStoreCompanyCode'
  | 'areaCode'
  | 'officeCode'
  | 'terminalOrgCode'
  | 'salesRepCode';
type PlanRowWithoutCodes = Omit<SalesPlanData, CodeKey>;

// 名称からコードを決める。組織（事業場・末端組織・作成者）は組織階層マスタのコード（検索条件と同じ）、
// マスタに無い名称と取引先・担当エリアは、出てきた順に番号を振る（同じ名称は同じコード）。名称が空ならコードも空
const createCoder = (
  start: number,
  digits: number,
  master?: readonly { code: string; name: string }[]
) => {
  const codes = new Map<string, string>(master?.map((m) => [m.name, m.code]));
  let next = start;
  return (name: string): string => {
    if (!name) return '';
    if (!codes.has(name)) codes.set(name, String(next++).padStart(digits, '0'));
    return codes.get(name) ?? '';
  };
};

const withCodes = (): ((row: PlanRowWithoutCodes) => SalesPlanData) => {
  const retailer = createCoder(1000001, 7);
  const tertiaryStore = createCoder(2000001, 7);
  const primaryStore = createCoder(3000001, 7);
  const tertiaryStoreCompany = createCoder(4000001, 7);
  const area = createCoder(1, 3);
  const office = createCoder(10000690, 8, ORG_ITEMS.office);
  const terminalOrg = createCoder(10005090, 8, ORG_ITEMS.terminalOrg);
  const salesRep = createCoder(5172790, 7, ORG_ITEMS.salesRep);
  return (row) => ({
    ...row,
    retailerCode: retailer(row.retailer),
    tertiaryStoreCode: tertiaryStore(row.tertiaryStore),
    primaryStoreCode: primaryStore(row.primaryStore),
    tertiaryStoreCompanyCode: tertiaryStoreCompany(row.tertiaryStoreCompany),
    areaCode: area(row.area),
    officeCode: office(row.office),
    terminalOrgCode: terminalOrg(row.terminalOrg),
    salesRepCode: salesRep(row.salesRep),
  });
};

// サンプルデータ（100件＋ダミー行）
export function generateSampleData(): SalesPlanData[] {
  const data: PlanRowWithoutCodes[] = [];
  const applicationStatuses = [
    '未登録',
    '未申請',
    '部支店長承認待ち',
    '承認済',
  ];
  const statuses = [
    '未申請',
    '承認待ち',
    '差戻し',
    '承認済み',
    '確定',
    '未承認確定',
  ];
  const channels = [
    '全国/SM',
    '全国/Dgs',
    '全国CVS',
    '管理CVS',
    '全国/通販',
    'その他販売店',
  ];
  const areas = ['道央', '道南', '道北', '道東'];
  const offices = ['北海道支社', '首都圏支社', '東北支社', '関西支社'];
  const retailers = [
    'セブン-イレブン',
    'ファミリーマート',
    'ローソン',
    'イオン',
  ];
  const tertiaryStores = [
    '国分北海道株式会社経営FC',
    '三菱食品株式会社広島FC',
    '伊藤忠食品株式会社東北支社',
    '日本アクセス株式会社首都圏支社',
  ];
  const primaryStores = [
    '国分6社通販',
    '三菱食品株式会社北見営業所',
    '伊藤忠食品札幌支店',
    '日本アクセス仙台営業所',
  ];
  const departments = [
    '北海道営業一部',
    '東北営業一部',
    '首都圏営業一部',
    '近畿圏営業一部',
    '四国営業一部',
    '九州営業一部',
  ];
  // 末端組織（＝採算組織第6階層。部署配下の営業所単位）
  const terminalOrgs = [
    '札幌第一営業所',
    '札幌第二営業所',
    '仙台営業所',
    '東京第一営業所',
    '大阪営業所',
  ];
  const salesReps = [
    '山田 太郎',
    '佐藤 花子',
    '鈴木 一郎',
    '田中 美咲',
    '高橋 健太',
  ];
  const inputProductGranularities = ['サマリ商品', '一般卸メッシュ（卸）'];
  // 「自販機」は自販機（計画一覧（自販機）統合分）の作成パターン。
  // 自販機行はチャネル・担当エリア・商品粒度を持たない（一覧では「-」表示）。
  const tradeSystems = [
    'マージン率固定',
    'NET入力',
    'NET固定',
    VENDING_PATTERN,
  ];

  // 対象年月を202601~202703でランダムに生成
  const generateRandomMonth = (): string => {
    const year = 2026;
    const month = Math.floor(Math.random() * 15) + 1; // 1~15（2026年1月~2027年3月）
    if (month <= 12) {
      return `${year}${String(month).padStart(2, '0')}`;
    } else {
      return `2027${String(month - 12).padStart(2, '0')}`;
    }
  };

  // 月次販売計画書Noをランダム生成（A26100502形式）
  const generateRandomPlanNo = (): string => {
    const randomNum = Math.floor(Math.random() * 900000) + 100000; // 100000~999999
    return `A26${randomNum}`;
  };

  // 実績番号をランダム生成（ダミー。桁・形式は未確定のため計画書番号と同じ9桁とする）
  const generateRandomActualNo = (): string => {
    const randomNum = Math.floor(Math.random() * 900000) + 100000; // 100000~999999
    return `J26${randomNum}`;
  };

  for (let i = 1; i <= 100; i++) {
    const targetMonth = generateRandomMonth();
    const retailer = retailers[i % retailers.length];
    const tertiaryStore = tertiaryStores[i % tertiaryStores.length];
    const primaryStore = primaryStores[i % primaryStores.length];

    // 三次店・一次店の組み合わせデータを条件に応じて追加
    let storeDetails: StoreDetail[] | undefined = undefined;

    // 対象年月202603 & ファミリーマート
    if (targetMonth === '202603' && retailer === 'ファミリーマート') {
      storeDetails = [
        {
          tertiaryStore: 'ファミリーマート渋谷店',
          primaryStore: '伊藤忠商事',
        },
        {
          tertiaryStore: 'ファミリーマート新宿店',
          primaryStore: '三菱商事',
        },
        {
          tertiaryStore: 'ファミリーマート池袋店',
          primaryStore: '日本アクセス',
        },
        {
          tertiaryStore: 'ファミリーマート品川店',
          primaryStore: '菱食',
        },
        {
          tertiaryStore: 'ファミリーマート六本木店',
          primaryStore: '三井物産',
        },
      ];
    }

    // 対象年月202611 & ローソン
    if (targetMonth === '202611' && retailer === 'ローソン') {
      storeDetails = [
        {
          tertiaryStore: 'ローソン丸の内店',
          primaryStore: '伊藤忠商事',
        },
        {
          tertiaryStore: 'ローソン銀座店',
          primaryStore: '三菱商事',
        },
        {
          tertiaryStore: 'ローソン秋葉原店',
          primaryStore: '日本アクセス',
        },
        {
          tertiaryStore: 'ローソン上野店',
          primaryStore: '菱食',
        },
        {
          tertiaryStore: 'ローソン浅草店',
          primaryStore: '三井物産',
        },
      ];
    }

    const tradeSystem = tradeSystems[i % tradeSystems.length];
    // 自販機はチャネル・担当エリア・商品粒度を持たない
    const isVending = tradeSystem === VENDING_PATTERN;

    // 対象年月≦202606・販売店イオン・作成パターン自販機 のデータはステータスを「確定」にする
    const rowStatus =
      targetMonth <= '202606' && retailer === 'イオン' && isVending
        ? '確定'
        : statuses[i % statuses.length];

    // 実績番号は、実績を登録できる自販機の計画（ステータスが確定・未承認確定）だけ採番済みとする
    const hasActualNo =
      isVending && (rowStatus === '確定' || rowStatus === '未承認確定');

    data.push({
      id: String(i),
      targetMonth,
      monthlyPlanNo: generateRandomPlanNo(),
      actualNo: hasActualNo ? generateRandomActualNo() : undefined,
      applicationStatus: applicationStatuses[i % applicationStatuses.length],
      status: rowStatus,
      channel: isVending ? '' : channels[i % channels.length],
      area: isVending ? '' : areas[i % areas.length],
      office: offices[i % offices.length],
      retailer,
      // 三次店企業は「その他企業」の販売店のみ値を持つ。通常行は値なし（グレーの「-」表示）
      tertiaryStoreCompany: '',
      tertiaryStore,
      primaryStore,
      department: departments[i % departments.length],
      terminalOrg: terminalOrgs[i % terminalOrgs.length],
      salesRep: salesReps[i % salesReps.length],
      inputProductGranularity: isVending
        ? ''
        : inputProductGranularities[i % inputProductGranularities.length],
      tradeSystem,
      storeDetails,
    });
  }
  // 商流紐づけなし計画のダミー行（計画表ボタンで販売計画表(商流紐づけなし)へ遷移）
  const noLinkDummyRows: PlanRowWithoutCodes[] = [
    {
      id: 'nolink-1',
      targetMonth: '202510',
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[0],
      status: statuses[0],
      channel: '全国/SM',
      area: '道央',
      office: offices[0],
      retailer: '【ダミー】イオンリテール',
      tertiaryStoreCompany: '',
      tertiaryStore: '【ダミー】イオン東北ＲＤＣ',
      primaryStore: '【ダミー】三菱食品株式会社（イオン）',
      department: departments[0],
      terminalOrg: terminalOrgs[0],
      salesRep: salesReps[0],
      inputProductGranularity: '',
      tradeSystem: '商流販売店に紐づかない',
      isNoLink: true,
    },
    {
      id: 'nolink-2',
      targetMonth: '202510',
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[0],
      status: statuses[0],
      channel: '全国CVS',
      area: '道南',
      office: offices[0],
      retailer: '【ダミー】セブン-イレブン',
      tertiaryStoreCompany: '',
      tertiaryStore: '【ダミー】セブン-イレブン仙台ＲＤＣ',
      primaryStore: '【ダミー】加藤産業株式会社',
      department: departments[0],
      terminalOrg: terminalOrgs[0],
      salesRep: salesReps[0],
      inputProductGranularity: '',
      tradeSystem: '商流販売店に紐づかない',
      isNoLink: true,
    },
    {
      id: 'nolink-3',
      targetMonth: '202510',
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[0],
      status: statuses[0],
      channel: '全国/Dgs',
      area: '道北',
      office: offices[0],
      retailer: '【ダミー】ウエルシア',
      tertiaryStoreCompany: '',
      tertiaryStore: '【ダミー】ウエルシア東日本ＤＣ',
      primaryStore: '【ダミー】伊藤忠食品株式会社',
      department: departments[0],
      terminalOrg: terminalOrgs[0],
      salesRep: salesReps[0],
      inputProductGranularity: '',
      tradeSystem: '商流販売店に紐づかない',
      isNoLink: true,
    },
  ];
  // 販売店「その他企業」のダミー行（三次店企業に値を持つ唯一のケース）
  const otherCompanyDummyRows: PlanRowWithoutCodes[] = [
    {
      id: 'other-1',
      targetMonth: '202510',
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[0],
      status: statuses[0],
      channel: 'その他販売店',
      area: '道央',
      office: offices[0],
      retailer: 'その他企業',
      tertiaryStoreCompany: '三菱食品株式会社',
      tertiaryStore: '三菱食品株式会社首都圏支社',
      primaryStore: '三菱食品株式会社北見営業所',
      department: departments[0],
      terminalOrg: terminalOrgs[0],
      salesRep: salesReps[0],
      inputProductGranularity: 'サマリ商品',
      tradeSystem: 'NET固定',
    },
    {
      id: 'other-2',
      targetMonth: '202511',
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[1 % applicationStatuses.length],
      status: statuses[1 % statuses.length],
      channel: 'その他販売店',
      area: '道南',
      office: offices[1 % offices.length],
      retailer: 'その他企業',
      tertiaryStoreCompany: '伊藤忠食品株式会社',
      tertiaryStore: '伊藤忠食品株式会社東北支社',
      primaryStore: '伊藤忠食品札幌支店',
      department: departments[1 % departments.length],
      terminalOrg: terminalOrgs[1 % terminalOrgs.length],
      salesRep: salesReps[1 % salesReps.length],
      inputProductGranularity: 'サマリ商品',
      tradeSystem: 'NET固定',
    },
    {
      id: 'other-3',
      targetMonth: '202512',
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[2 % applicationStatuses.length],
      status: statuses[2 % statuses.length],
      channel: 'その他販売店',
      area: '道北',
      office: offices[2 % offices.length],
      retailer: 'その他企業',
      tertiaryStoreCompany: '日本アクセス株式会社',
      tertiaryStore: '日本アクセス株式会社首都圏支社',
      primaryStore: '日本アクセス仙台営業所',
      department: departments[2 % departments.length],
      terminalOrg: terminalOrgs[2 % terminalOrgs.length],
      salesRep: salesReps[2 % salesReps.length],
      inputProductGranularity: 'サマリ商品',
      tradeSystem: 'NET固定',
    },
  ];
  return [...otherCompanyDummyRows, ...noLinkDummyRows, ...data].map(
    withCodes()
  );
}
