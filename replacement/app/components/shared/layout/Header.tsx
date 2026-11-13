import {
  LogOut,
  ClipboardList,
  CreditCard,
  Wallet,
  Database,
  ChevronDown,
  LayoutGrid,
  Check,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useScreenTitle } from '@/app/components/ui/screen-title';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';

// 切り替えられる部署（モック。本番はログインユーザーの所属から取得する）
const DEPARTMENTS = [
  '首都圏営業二部',
  '首都圏営業一部',
  '関西営業部',
  '中部営業部',
  '東北営業部',
];

/** ヘッダのメニュー定義。ルート ID は画面ディレクトリ名と一致させること。 */
export const MENU_ITEMS = [
  {
    id: 'sales-plan',
    label: '販売計画',
    icon: ClipboardList,
    children: [
      {
        id: 'plan-list',
        label: '計画一覧',
      },
      {
        id: 'managed-product-plan-list',
        label: '計画一覧(管理対象商品)',
      },
      {
        id: 'plan-detail-margin-rate-fixed',
        label: '計画詳細(マージン率固定・NET入力)',
      },
      { id: 'plan-detail-net-fixed', label: '計画詳細(NET固定)' },
      {
        id: 'promotion-cost-plan-unlinked',
        label: '拡売費計画(商流販売店に紐づき無し)',
      },
      {
        id: 'plan-detail-vending',
        label: '計画詳細',
      },
      {
        id: 'annual-plan-creation',
        label: '年間計画作成',
      },
      {
        id: 'sales-plan-simulation-margin-rate-fixed',
        label: '販売計画シミュレーション(マージン率固定・NET入力)',
      },
      {
        id: 'sales-plan-simulation-net-fixed',
        label: '販売計画シミュレーション(NET固定)',
      },
      {
        id: 'managed-product-plan-detail',
        label: '計画詳細(管理対象商品)',
      },
      {
        id: 'marketing-file-upload',
        label: 'ファイルアップロード',
      },
    ],
  },
  {
    id: 'Actual',
    label: '実績登録',
    icon: ClipboardList,
    children: [
      { id: 'plan-list-actual', label: '実績一覧' },
      { id: 'marketing-file-upload-actual', label: 'ファイルアップロード' },
      //      { id: 'sales-actual-detail', label: '販売実績詳細' },
    ],
  },
  {
    id: 'payment',
    label: '支払',
    icon: CreditCard,
    children: [
      { id: 'payment-list', label: '支払一覧' },
      { id: 'payment-detail-vending', label: '支払詳細(自販機)' },
      { id: 'payment-detail-with-invoice', label: '支払詳細(追加口請求書有)' },
      {
        id: 'payment-detail-without-invoice',
        label: '支払詳細(追加口請求書無)',
      },
      {
        id: 'payment-detail-unlinked',
        label: '支払詳細(商流販売店紐づけなし)',
      },
      { id: 'transfer-detail', label: '振替詳細' },
      {
        id: 'location-contract-amortization-list',
        label: 'ロケ契約(償却)一覧',
      },
      { id: 'billing-edi-list', label: '請求EDI取込一覧' },
      { id: 'billing-edi-detail', label: '請求EDI取込結果詳細' },
      { id: 'billing-list', label: '請求一覧' },
      { id: 'billing-detail-edi', label: '請求詳細(請求EDI)' },
      { id: 'billing-detail-aic', label: '請求詳細(AIC入力)' },
      // ★廃止の画面は、使う画面と混ざらないようメニューの最下部にまとめる。
      { id: 'payment-detail-other', label: '支払詳細(その他)★廃止' },
      { id: 'quote-list', label: '引用一覧★廃止→支払一覧にマージ' },
      {
        id: 'location-contract-fee-list',
        label: 'ロケ契約料一覧★廃止',
      },
      { id: 'unamortized-project-billing', label: '未償却案件請求★廃止' },
    ],
  },
  {
    id: 'budget',
    label: '予算',
    icon: Wallet,
    children: [
      {
        id: 'budget-reference-registration',
        label: '予算参照登録',
      },
    ],
  },
  {
    id: 'master',
    label: 'マスタ',
    icon: Database,
    children: [
      {
        id: 'distribution-retailer-master',
        label: '商流販売店マスタ',
      },
      {
        id: 'managed-product-list',
        label: '管理対象商品一覧',
      },
      {
        id: 'metadata-maintenance',
        label: 'メタデータメンテナンス',
      },
      {
        id: 'notice-admin',
        label: 'お知らせメンテ',
      },
      {
        id: 'general-wholesale-mesh-master',
        label: '一般卸メッシュマスタ',
      },
      {
        id: 'strategic-net-master',
        label: '戦略NETマスタ',
      },
      {
        id: 'individual-net-master',
        label: '個別NETマスタ',
      },
      {
        id: 'retailer-condition-rate-master',
        label: '販売店条件口率マスタ',
      },
      {
        id: 'container-capacity-group-master',
        label: '容器容量グループマスタ',
      },
      {
        id: 'managed-product-master',
        label: '管理対象商品マスタ',
      },
      {
        id: 'notification-master',
        label: '通知管理マスタ',
      },
      {
        id: 'system-admin-setting-master',
        label: 'システム管理者設定マスタ',
      },
      {
        id: 'position-approver-setting-master',
        label: '役職承認者設定マスタ',
      },
      {
        id: 'display-management-master',
        label: '表示管理マスタ',
      },
      {
        id: 'product-class-derivation-master',
        label: '商品分類導出マスタ',
      },
      {
        id: 'sales-area-master',
        label: '担当エリアマスタ',
      },
      {
        id: 'summary-product-management-master',
        label: 'サマリ商品管理マスタ',
      },
      {
        id: 'new-product-summary-link-master',
        label: '新商品・新価格用サマリ商品紐づけマスタ',
      },
      {
        id: 'new-product-item-master',
        label: '新商品・新価格用商品マスタ',
      },
      {
        id: 'new-product-sub-brand-master',
        label: '新商品小ブランドマスタ',
      },
      {
        id: 'new-product-unit-price-master',
        label: '新商品・新価格用単価マスタ',
      },
      {
        id: 'new-product-bulk-change-master',
        label: '新商品一括変更マスタ',
      },
    ],
  },
  {
    id: 'other-systems',
    label: 'その他システム',
    icon: LayoutGrid,
    children: [
      { id: 'bi-system', label: 'BIシステム' },
      {
        id: 'budget-sales-system',
        label: '予算営業システム',
      },
    ],
  },
];

export function Header() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 表示中の画面名（各画面の ScreenTitle が登録する。TOP 等の未登録画面は空）
  const screenTitle = useScreenTitle();
  const [activeMenu, setActiveMenu] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [department, setDepartment] = useState<string>('首都圏営業二部');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isDepartmentChangeDialogOpen, setIsDepartmentChangeDialogOpen] =
    useState(false);
  const [pendingDepartment, setPendingDepartment] = useState<string>('');
  const [isTopTransitionDialogOpen, setIsTopTransitionDialogOpen] =
    useState(false);

  const navRef = useRef<HTMLElement>(null);

  const handleMenuClick = (itemId: string, hasChildren: boolean) => {
    if (hasChildren) {
      setOpenDropdown(openDropdown === itemId ? null : itemId);
    } else {
      setActiveMenu(itemId);
      setOpenDropdown(null);
      navigate(itemId);
    }
  };

  const handleSubMenuClick = (parentId: string, childId: string) => {
    setActiveMenu(childId);
    setOpenDropdown(null);
    navigate(childId);
  };

  const handleDepartmentChange = (value: string) => {
    // 今の部署を選び直したときは何もしない（確認ダイアログを出さない）
    if (value === department) return;
    setPendingDepartment(value);
    setIsDepartmentChangeDialogOpen(true);
  };

  const handleDepartmentChangeConfirm = () => {
    setDepartment(pendingDepartment);
    setIsDepartmentChangeDialogOpen(false);
    // TOP画面に移動
    setActiveMenu('');
    navigate('top');
  };

  const handleLogoClick = () => {
    // 現在TOP画面以外の場合は確認ダイアログを表示
    if (activeMenu !== '' && activeMenu !== 'top') {
      setIsTopTransitionDialogOpen(true);
    }
    // 既にTOP画面の場合は何もしない
  };

  const handleTopTransitionConfirm = () => {
    setIsTopTransitionDialogOpen(false);
    setActiveMenu('');
    setOpenDropdown(null);
    navigate('top');
  };

  // メニュー外クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    // 配色は UI/UX分科会 決定事項21（宮澤案）：濃紺の横グラデーション＋金の下線（UI/UX UX-031 → 01「画面の配色」）
    <header className="sticky top-0 z-50 w-full bg-linear-to-r from-brand-navy-950 via-brand-navy-900 via-45% to-blue-900 border-b-2 border-brand-gold shadow-app-header min-w-300">
      <div className="flex h-11 items-center gap-4 px-6">
        {/* Left side: Logo ｜ 画面名（各画面の ScreenTitle から受け取る。文字サイズはシステム名と同じ）。
            残りの幅をすべて使い、メニュー・右側は右寄せにして画面名の長さで位置が動かないようにする。
            画面名が入りきらない幅では末尾を「…」で省略し、ホバーで全文を出す。 */}
        <button
          onClick={handleLogoClick}
          className="shrink-0 whitespace-nowrap text-xl text-white font-bold hover:text-blue-100 transition-colors cursor-pointer"
          aria-label="TOP画面へ移動"
        >
          NEXT SALES
        </button>
        {/* 区切り線＋画面名。システム名は縮めず、この領域だけが縮む */}
        <div className="-ml-1 flex min-w-0 flex-1 items-center gap-3">
          {screenTitle && (
            <>
              {/* 区切り線（ヘッダーの下線と同じ金色） */}
              <span
                aria-hidden="true"
                className="h-5 shrink-0 border-l border-brand-gold"
              />
              <h1
                className="min-w-0 truncate text-xl text-white font-bold"
                title={screenTitle}
              >
                {screenTitle}
              </h1>
            </>
          )}
        </div>

        {/* Center: Navigation Menu */}
        <nav
          ref={navRef}
          className="flex items-center gap-0"
          aria-label="メインナビゲーション"
        >
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              activeMenu === item.id ||
              item.children?.some((child) => child.id === activeMenu);
            const isOpen = openDropdown === item.id;
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.id} className="relative flex items-center">
                {index > 0 && <div className="h-8 w-px bg-white/18" />}
                <button
                  onClick={() => handleMenuClick(item.id, !!hasChildren)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-md transition-colors ${
                    isActive
                      ? 'bg-brand-gold/18 text-white shadow-nav-active'
                      : isOpen
                        ? 'bg-gray-700/50 text-gray-200'
                        : 'text-nav-foreground hover:bg-white/12 hover:text-white'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  aria-expanded={hasChildren ? isOpen : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                  {hasChildren && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>

                {/* Dropdown Menu */}
                {hasChildren && isOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-nav-menu/97 rounded-md shadow-lg border border-nav-menu-border py-1 z-50">
                    {item.children?.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => handleSubMenuClick(item.id, child.id)}
                        className={`w-full text-left px-4 py-2 transition-colors ${
                          activeMenu === child.id
                            ? 'bg-brand-gold/85 text-brand-navy-900 font-medium'
                            : 'text-gray-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ユーザーメニュー：部署と氏名を1行で出し、押すと部署の切替とログアウトを開く。
            画面名に幅を回すため、部署切替・氏名・ログアウトを1つにまとめる（UI/UX UX-017） */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="group flex shrink-0 items-center gap-2 rounded-md px-3 py-1 text-white transition-colors hover:bg-white/12 data-[state=open]:bg-gray-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            aria-label={`ユーザーメニュー（${department} アサヒ太郎）`}
          >
            <span className="whitespace-nowrap">{department}</span>
            <span className="whitespace-nowrap">アサヒ太郎</span>
            {/* 開いている間はメニューと同じく上向きにする */}
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          {/* 開いた一覧は、メニューのドロップダウンと同じ背景色・枠・文字（濃紺・text-base） */}
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-md border-nav-menu-border bg-nav-menu/97 p-0 py-1 text-gray-200 shadow-lg"
          >
            <DropdownMenuLabel className="px-4 text-xs font-normal text-gray-400">
              部署を切り替える
            </DropdownMenuLabel>
            {/* 選択中の部署は、メニューの選択中の画面と同じ金色の背景・紺の文字にし、
                SingleCombobox と同じ形のチェックマーク（文字と同じ紺）を付ける */}
            {DEPARTMENTS.map((d) => (
              <DropdownMenuItem
                key={d}
                role="menuitemradio"
                aria-checked={d === department}
                onSelect={() => handleDepartmentChange(d)}
                className={`rounded-none px-4 py-2 text-base ${
                  d === department
                    ? 'bg-brand-gold/85 font-medium text-brand-navy-900 focus:bg-brand-gold/85 focus:text-brand-navy-900'
                    : 'text-gray-200 focus:bg-white/10 focus:text-white'
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {d === department && (
                    <Check
                      className="h-4 w-4 text-brand-navy-900"
                      strokeWidth={3}
                    />
                  )}
                </span>
                {d}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="mx-0 bg-nav-menu-border" />
            <DropdownMenuItem
              onSelect={() => setIsLogoutDialogOpen(true)}
              className="rounded-none px-4 py-2 text-base text-gray-200 focus:bg-white/10 focus:text-white"
            >
              <LogOut className="h-4 w-4 text-current" />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ログアウト確認ダイアログ */}
      <ConfirmDialog
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        title="確認"
        description="ログアウトしますか？"
        confirmLabel="ログアウト"
        onConfirm={() => {
          setIsLogoutDialogOpen(false);
        }}
      />

      {/* 部署変更確認ダイアログ */}
      <ConfirmDialog
        open={isDepartmentChangeDialogOpen}
        onOpenChange={setIsDepartmentChangeDialogOpen}
        title="部署変更の確認"
        description={
          <>
            部署を切り替えると、現在編集中の内容は保存されません。
            <br />
            切り替え後はTOP画面に移動しますが、よろしいですか？
          </>
        }
        confirmLabel="切替"
        onConfirm={handleDepartmentChangeConfirm}
      />

      {/* TOP画面移動確認ダイアログ */}
      <ConfirmDialog
        open={isTopTransitionDialogOpen}
        onOpenChange={setIsTopTransitionDialogOpen}
        title="TOP画面への移動"
        description="TOP画面に移動すると、現在編集中の内容は保存されません。よろしいですか？"
        confirmLabel="移動"
        onConfirm={handleTopTransitionConfirm}
      />
    </header>
  );
}
