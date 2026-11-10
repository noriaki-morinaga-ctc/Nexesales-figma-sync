import {
  Search,
  SquarePen,
  Trash2,
  Save,
  Upload,
  Download,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
} from 'ag-grid-community';
import { toast } from 'sonner';

import { CopyableArea } from '../../ui/copyable-area';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
  TEXT_INPUT_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '../../../../styles/commonStyles';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_MONTH_TEXT_FILTER,
} from '../../grid';
import { MonthYearPicker } from '../../ui/month-year-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { SingleCombobox } from '../../ui/single-combobox';
import { summaryProductComboOptions } from '../../../constants/comboFieldOptions';
import { RequiredBadge } from '../../ui/required-badge';
import { RightPane } from '../../ui/right-pane';
import { DeleteConfirmPane } from '../../ui/delete-confirm-pane';
import { CollapsibleCard } from '../../ui/collapsible-card';
import { SearchClearButton } from '../../ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryValue,
} from '../../ui/search-summary';
import { ScreenTitle } from '../../ui/screen-title';
import { ConfirmDialog } from '../../ui/confirm-dialog';

interface ProductTargetData {
  id: string;
  productCategory: string;
  summaryProduct: string;
  metaBrand: string;
  referenceProduct: string;
  targetStartMonth: string;
  targetEndMonth: string;
  targetArea: string;
}

interface ManagedProductListProps {
  onMenuChange?: (menuId: string) => void;
}

// 一覧グリッドの行ID（→ 画面設計標準 4.7）。サンプルデータの id、新規登録行は登録時に採番した id を使う
const getRowId = (params: GetRowIdParams<ProductTargetData>) => params.data.id;

// サンプルデータ生成関数
function generateSampleData(): ProductTargetData[] {
  return [
    {
      id: '1',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      targetStartMonth: '2025/04',
      targetEndMonth: '2025/06',
      targetArea: '全国',
    },
    {
      id: '2',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'おいしい水 天然水２Ｌ６本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '首都圏本部',
    },
    {
      id: '3',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '近畿圏本部',
    },
    {
      id: '4',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '中四国支社',
    },
    {
      id: '5',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/05',
      targetEndMonth: '2025/07',
      targetArea: '近畿圏本部',
    },
    {
      id: '6',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '中四国支社',
    },
    {
      id: '7',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '九州支社',
    },
    {
      id: '8',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '東北支社',
    },
    {
      id: '9',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/06',
      targetEndMonth: '2025/08',
      targetArea: '九州支社',
    },
    {
      id: '10',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: '十六茶６６０ｍＬ２４本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '東北支社',
    },
    {
      id: '11',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'カルピスソーダ５００ｍＬ２４本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '中部北陸本部',
    },
    {
      id: '12',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '北海道支社',
    },
    {
      id: '13',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '中部北陸本部',
    },
    {
      id: '14',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'カルピスソーダ至福の時間白桃５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '北海道支社',
    },
    {
      id: '15',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '関東本部',
    },
    {
      id: '16',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダモーニングショット１５ｇ３０本',
      targetStartMonth: '2026/04',
      targetEndMonth: '2026/06',
      targetArea: '全国',
    },
    {
      id: '17',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '関東本部',
    },
    {
      id: '18',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '全国',
    },
    {
      id: '19',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '首都圏本部',
    },
    {
      id: '20',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: '十六茶６６０ｍＬ２４本',
      targetStartMonth: '2026/05',
      targetEndMonth: '2026/07',
      targetArea: '近畿圏本部',
    },
    {
      id: '21',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: '三ツ矢特濃グレープ５００ｍＬ２４本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '首都圏本部',
    },
    {
      id: '22',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '近畿圏本部',
    },
    {
      id: '23',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ極ブラック４００ｇ２４本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '中四国支社',
    },
    {
      id: '24',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ特濃カフェオレ５００ｍＬ２４本',
      targetStartMonth: '2026/06',
      targetEndMonth: '2026/08',
      targetArea: '九州支社',
    },
    {
      id: '25',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: '十六茶６６０ｍＬ２４本',
      targetStartMonth: '2025/04',
      targetEndMonth: '2025/06',
      targetArea: '中四国支社',
    },
    {
      id: '26',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '九州支社',
    },
    {
      id: '27',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'カルピスソーダ５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '東北支社',
    },
    {
      id: '28',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダモーニングショット１５ｇ３０本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '中部北陸本部',
    },
    {
      id: '29',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2025/05',
      targetEndMonth: '2025/07',
      targetArea: '東北支社',
    },
    {
      id: '30',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダ特濃カフェオレ５００ｍＬ２４本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '中部北陸本部',
    },
    {
      id: '31',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '北海道支社',
    },
    {
      id: '32',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '関東本部',
    },
    {
      id: '33',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ',
      targetStartMonth: '2025/06',
      targetEndMonth: '2025/08',
      targetArea: '北海道支社',
    },
    {
      id: '34',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢特濃グレープ５００ｍＬ２４本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '関東本部',
    },
    {
      id: '35',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'カルピスソーダ５００ｍＬ２４本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '全国',
    },
    {
      id: '36',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢特濃グレープ５００ｍＬ２４本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '首都圏本部',
    },
    {
      id: '37',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'おいしい水 天然水２Ｌ６本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '全国',
    },
    {
      id: '38',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct:
        'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '首都圏本部',
    },
    {
      id: '39',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '近畿圏本部',
    },
    {
      id: '40',
      productCategory: '新商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      targetStartMonth: '2026/04',
      targetEndMonth: '2026/06',
      targetArea: '中四国支社',
    },
    {
      id: '41',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '近畿圏本部',
    },
    {
      id: '42',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'おいしい水 天然水２Ｌ６本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '中四国支社',
    },
    {
      id: '43',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct:
        'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '九州支社',
    },
    {
      id: '44',
      productCategory: '重点商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2026/05',
      targetEndMonth: '2026/07',
      targetArea: '東北支社',
    },
    {
      id: '45',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '九州支社',
    },
    {
      id: '46',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '東北支社',
    },
    {
      id: '47',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '中部北陸本部',
    },
    {
      id: '48',
      productCategory: '自販機専用商品',
      summaryProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      metaBrand: '三ツ矢',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2026/06',
      targetEndMonth: '2026/08',
      targetArea: '北海道支社',
    },
    {
      id: '49',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダ極ブラック４００ｇ２４本',
      targetStartMonth: '2025/04',
      targetEndMonth: '2025/06',
      targetArea: '中部北陸本部',
    },
    {
      id: '50',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢特濃グレープ５００ｍＬ２４本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '北海道支社',
    },
    {
      id: '51',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダー１．５Ｌ８本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '関東本部',
    },
    {
      id: '52',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct:
        'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '全国',
    },
    {
      id: '53',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2025/05',
      targetEndMonth: '2025/07',
      targetArea: '関東本部',
    },
    {
      id: '54',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct:
        'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '全国',
    },
    {
      id: '55',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '首都圏本部',
    },
    {
      id: '56',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '近畿圏本部',
    },
    {
      id: '57',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2025/06',
      targetEndMonth: '2025/08',
      targetArea: '首都圏本部',
    },
    {
      id: '58',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダモーニングショット１５ｇ３０本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '近畿圏本部',
    },
    {
      id: '59',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '中四国支社',
    },
    {
      id: '60',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct:
        'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '九州支社',
    },
    {
      id: '61',
      productCategory: '新商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '中四国支社',
    },
    {
      id: '62',
      productCategory: '重点商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '九州支社',
    },
    {
      id: '63',
      productCategory: '自販機専用商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '東北支社',
    },
    {
      id: '64',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ',
      targetStartMonth: '2026/04',
      targetEndMonth: '2026/06',
      targetArea: '中部北陸本部',
    },
    {
      id: '65',
      productCategory: '重点商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '東北支社',
    },
    {
      id: '66',
      productCategory: '自販機専用商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'おいしい水 天然水２Ｌ６本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '中部北陸本部',
    },
    {
      id: '67',
      productCategory: '新商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'おいしい水 天然水２Ｌ６本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '北海道支社',
    },
    {
      id: '68',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ',
      targetStartMonth: '2026/05',
      targetEndMonth: '2026/07',
      targetArea: '関東本部',
    },
    {
      id: '69',
      productCategory: '自販機専用商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '北海道支社',
    },
    {
      id: '70',
      productCategory: '新商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '関東本部',
    },
    {
      id: '71',
      productCategory: '重点商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'ワンダ極ブラック４００ｇ２４本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '全国',
    },
    {
      id: '72',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ',
      targetStartMonth: '2026/06',
      targetEndMonth: '2026/08',
      targetArea: '首都圏本部',
    },
    {
      id: '73',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/04',
      targetEndMonth: '2025/06',
      targetArea: '全国',
    },
    {
      id: '74',
      productCategory: '重点商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '首都圏本部',
    },
    {
      id: '75',
      productCategory: '自販機専用商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ワンダ特濃カフェオレ５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '近畿圏本部',
    },
    {
      id: '76',
      productCategory: '新商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '中四国支社',
    },
    {
      id: '77',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2025/05',
      targetEndMonth: '2025/07',
      targetArea: '近畿圏本部',
    },
    {
      id: '78',
      productCategory: '自販機専用商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'おいしい水 天然水６００ｍＬ２４本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '中四国支社',
    },
    {
      id: '79',
      productCategory: '新商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '九州支社',
    },
    {
      id: '80',
      productCategory: '重点商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '東北支社',
    },
    {
      id: '81',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      targetStartMonth: '2025/06',
      targetEndMonth: '2025/08',
      targetArea: '九州支社',
    },
    {
      id: '82',
      productCategory: '新商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '東北支社',
    },
    {
      id: '83',
      productCategory: '重点商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct:
        'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '中部北陸本部',
    },
    {
      id: '84',
      productCategory: '自販機専用商品',
      summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '北海道支社',
    },
    {
      id: '85',
      productCategory: '新商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '中部北陸本部',
    },
    {
      id: '86',
      productCategory: '重点商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '北海道支社',
    },
    {
      id: '87',
      productCategory: '自販機専用商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'アサヒ贅沢搾りグレープフルーツ３５０ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '関東本部',
    },
    {
      id: '88',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'おいしい水 天然水６００ｍＬ２４本',
      targetStartMonth: '2026/04',
      targetEndMonth: '2026/06',
      targetArea: '全国',
    },
    {
      id: '89',
      productCategory: '重点商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ワンダ金の微糖１８５ｇ３０本',
      targetStartMonth: '2025/08',
      targetEndMonth: '2025/10',
      targetArea: '関東本部',
    },
    {
      id: '90',
      productCategory: '自販機専用商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      targetStartMonth: '2025/11',
      targetEndMonth: '2026/01',
      targetArea: '全国',
    },
    {
      id: '91',
      productCategory: '新商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'おいしい水 天然水６００ｍＬ２４本',
      targetStartMonth: '2026/02',
      targetEndMonth: '2026/04',
      targetArea: '首都圏本部',
    },
    {
      id: '92',
      productCategory: '重点商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'カルピスウォーター５００ｍＬ２４本',
      targetStartMonth: '2026/05',
      targetEndMonth: '2026/07',
      targetArea: '近畿圏本部',
    },
    {
      id: '93',
      productCategory: '自販機専用商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      targetStartMonth: '2025/09',
      targetEndMonth: '2025/11',
      targetArea: '首都圏本部',
    },
    {
      id: '94',
      productCategory: '新商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
      targetStartMonth: '2025/12',
      targetEndMonth: '2026/02',
      targetArea: '近畿圏本部',
    },
    {
      id: '95',
      productCategory: '重点商品',
      summaryProduct: 'カルピスソーダ５００ｍＬ２４本',
      metaBrand: 'カルピス',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      targetStartMonth: '2026/03',
      targetEndMonth: '2026/05',
      targetArea: '中四国支社',
    },
    {
      id: '96',
      productCategory: '自販機専用商品',
      summaryProduct: 'ウィルキンソンタンサンレモン５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: 'アサヒ贅沢搾りグレープフルーツ３５０ｍＬ２４本',
      targetStartMonth: '2026/06',
      targetEndMonth: '2026/08',
      targetArea: '九州支社',
    },
    {
      id: '97',
      productCategory: '新商品',
      summaryProduct: 'ウィルキンソンタンサングレープフルーツ５００ｍＬ２４本',
      metaBrand: 'ウィルキンソン',
      referenceProduct: '三ツ矢特濃グレープ５００ｍＬ２４本',
      targetStartMonth: '2025/04',
      targetEndMonth: '2025/06',
      targetArea: '中四国支社',
    },
    {
      id: '98',
      productCategory: '重点商品',
      summaryProduct: 'おいしい水 天然水６００ｍＬ２４本',
      metaBrand: 'おいしい水',
      referenceProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '九州支社',
    },
    {
      id: '99',
      productCategory: '自販機専用商品',
      summaryProduct: 'おいしい水 天然水６００ｍＬ２４本',
      metaBrand: 'おいしい水',
      referenceProduct: '十六茶６６０ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '東北支社',
    },
    {
      id: '100',
      productCategory: '新商品',
      summaryProduct: 'おいしい水 天然水６００ｍＬ２４本',
      metaBrand: 'おいしい水',
      referenceProduct: 'カルピスソーダ５００ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '中部北陸本部',
    },
    {
      id: '101',
      productCategory: '新商品',
      summaryProduct: '十六茶６６０ｍＬ２４本',
      metaBrand: '十六茶',
      referenceProduct: 'アサヒ贅沢搾りグレープフルーツ３５０ｍＬ２４本',
      targetStartMonth: '2025/04',
      targetEndMonth: '2025/06',
      targetArea: '首都圏本部, 近畿圏本部',
    },
    {
      id: '102',
      productCategory: '重点商品',
      summaryProduct: 'おいしい水 天然水２Ｌ６本',
      metaBrand: 'おいしい水',
      referenceProduct: 'ウィルキンソンタンサン１Ｌ１２本',
      targetStartMonth: '2025/07',
      targetEndMonth: '2025/09',
      targetArea: '首都圏本部, 近畿圏本部, 中部北陸本部',
    },
    {
      id: '103',
      productCategory: '自販機専用商品',
      summaryProduct: 'おいしい水 天然水２Ｌ６本',
      metaBrand: 'おいしい水',
      referenceProduct: 'ワンダ特濃カフェオレ５００ｍＬ２４本',
      targetStartMonth: '2025/10',
      targetEndMonth: '2025/12',
      targetArea: '中四国支社, 九州支社',
    },
    {
      id: '104',
      productCategory: '新商品',
      summaryProduct: 'おいしい水 天然水２Ｌ６本',
      metaBrand: 'おいしい水',
      referenceProduct: '三ツ矢サイダー５００ｍＬ２４本',
      targetStartMonth: '2026/01',
      targetEndMonth: '2026/03',
      targetArea: '東北支社, 北海道支社',
    },
  ];
}

// 管理対象エリアが重複するかを判定する
// targetArea は '全国' または支社名のカンマ区切り（例：'中四国支社, 九州支社'）
// 全国は全支社を含むため、いずれかが全国なら常に重複とみなす
const isAreaOverlapped = (areaA: string, areaB: string): boolean => {
  const parseAreas = (area: string) =>
    area
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  const areasA = parseAreas(areaA);
  const areasB = parseAreas(areaB);

  if (areasA.includes('全国') || areasB.includes('全国')) {
    return true;
  }

  // 支社が1つでも一致すれば重複
  return areasA.some((area) => areasB.includes(area));
};

// 管理対象エリアセルレンダラー
const AreaCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;

  const areas = props.data.targetArea.split(', ');
  const isNationwide = areas.includes('全国');

  if (isNationwide) {
    return <div className="flex items-center">全国</div>;
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-1">
        <span>エリア</span>
      </div>
      <div className="pl-5 text-sm text-gray-600 space-y-0.5">
        {areas.map((area, index) => (
          <div key={index} className="flex items-center gap-1">
            <span className="text-gray-400">└</span>
            <span>{area}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// アクションセルレンダラー
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onEditRow, onDeleteRow } = props.context;

  if (!props.data) return null;

  const handleEdit = () => {
    onEditRow(props.data);
  };

  const handleDelete = () => {
    onDeleteRow(props.data);
  };

  return (
    <div className="flex h-full items-center justify-center gap-1">
      <button
        onClick={handleEdit}
        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="更新"
        title="更新"
      >
        <SquarePen className="w-4 h-4" />
      </button>
      <button
        onClick={handleDelete}
        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// 管理対象商品ペインのフォーム初期値。
// useState の初期化・新規登録・連続追加の3箇所で共通利用する。
const EMPTY_TARGET_FORM = {
  productCategory: '',
  summaryProduct: '',
  referenceProduct: '',
  targetStartMonth: '',
  targetEndMonth: '',
  areaType: '' as '全国' | 'エリア指定' | '',
  targetArea: [] as string[],
};

// 検索条件の初期値（既定値）。
// 各 useState の初期化とクリアボタンの2箇所で共通利用する。
// 選択項目の未選択（''）＝条件なし（「指定なし」）
const INITIAL_SEARCH_FILTERS = {
  productCategory: '',
  summaryProduct: '',
  targetArea: '',
  startMonth: '2025/04',
  endMonth: '',
};

export default function ManagedProductList({
  onMenuChange,
}: ManagedProductListProps) {
  // 検索条件の状態管理。計画一覧・計画一覧(管理対象商品)と同様にリアルタイム検索とし、
  // この状態を直接 filteredData のフィルタ条件に用いる（検索ボタンは廃止）。
  const [productCategory, setProductCategory] = useState(
    INITIAL_SEARCH_FILTERS.productCategory
  );
  const [summaryProduct, setSummaryProduct] = useState(
    INITIAL_SEARCH_FILTERS.summaryProduct
  );
  const [targetArea, setTargetArea] = useState(
    INITIAL_SEARCH_FILTERS.targetArea
  );
  const [startMonth, setStartMonth] = useState(
    INITIAL_SEARCH_FILTERS.startMonth
  );
  const [endMonth, setEndMonth] = useState(INITIAL_SEARCH_FILTERS.endMonth);

  // 検索条件を初期値（既定値）へ戻す。一覧のデータ自体は変更しない。
  const handleClear = () => {
    setProductCategory(INITIAL_SEARCH_FILTERS.productCategory);
    setSummaryProduct(INITIAL_SEARCH_FILTERS.summaryProduct);
    setTargetArea(INITIAL_SEARCH_FILTERS.targetArea);
    setStartMonth(INITIAL_SEARCH_FILTERS.startMonth);
    setEndMonth(INITIAL_SEARCH_FILTERS.endMonth);
  };

  // 右ペインとダイアログの状態管理
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  // 削除確認は計画詳細(マージン率固定・NET入力)の明細削除と同様に右ペインで行う
  const [isDeletePaneOpen, setIsDeletePaneOpen] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<'create' | 'edit'>('create');
  const [selectedData, setSelectedData] = useState<ProductTargetData | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ProductTargetData | null>(
    null
  );

  // フォームの状態管理
  const [formData, setFormData] = useState({ ...EMPTY_TARGET_FORM });

  // サンプルデータ
  const [rowData, setRowData] =
    useState<ProductTargetData[]>(generateSampleData());

  // サマリ商品の選択肢（検索条件・登録/更新ペイン共通）。
  // 一覧が保持する値から重複を除いて生成し、共通ビルダーで「名称＋商品コード」の
  // 2行表示にする（§9）。登録で追加した値もそのまま選択肢に載る。
  const summaryProductOptions = useMemo(
    () =>
      summaryProductComboOptions(
        Array.from(new Set(rowData.map((row) => row.summaryProduct)))
      ),
    [rowData]
  );

  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    { label: '商品区分', value: productCategory },
    {
      label: 'サマリ商品',
      value: formatSummaryValue(summaryProduct, summaryProductOptions),
    },
    { label: '管理対象エリア', value: targetArea },
    { label: '管理対象開始月', value: startMonth },
    { label: '管理対象終了月', value: endMonth },
  ]);

  // 参考商品の選択肢（登録/更新ペイン用）。サマリ商品と同じく一覧の実値から生成する。
  const referenceProductOptions = useMemo(
    () =>
      summaryProductComboOptions(
        Array.from(new Set(rowData.map((row) => row.referenceProduct)))
      ),
    [rowData]
  );

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    return rowData.filter((row) => {
      // 商品区分フィルタ
      if (productCategory && row.productCategory !== productCategory) {
        return false;
      }

      // サマリ商品フィルタ（コンボボックスで選んだ1件と完全一致。未選択は絞り込みなし）
      if (summaryProduct && row.summaryProduct !== summaryProduct) {
        return false;
      }

      // 管理対象エリアフィルタ
      // 検索条件のエリアが、データのエリア指定に含まれているかチェック
      if (targetArea) {
        // データのエリアをカンマで分割して配列に変換
        const dataAreas = row.targetArea.split(',').map((area) => area.trim());

        // 検索条件のエリアがデータのエリアリストに含まれているかチェック
        if (!dataAreas.includes(targetArea)) {
          return false;
        }
      }

      // 管理対象月フィルタ（期間が重なるデータを表示）。
      // 開始月・終了月とも×でクリアできるため、指定されている側だけ判定する。
      const dataStart = row.targetStartMonth.replace('/', '');
      const dataEnd = row.targetEndMonth.replace('/', '');
      // 開始月のみ指定：開始月以降も管理対象のデータ
      if (startMonth && dataEnd < startMonth.replace('/', '')) {
        return false;
      }
      // 終了月のみ指定：終了月までに管理対象が始まっているデータ
      if (endMonth && dataStart > endMonth.replace('/', '')) {
        return false;
      }

      return true;
    });
  }, [
    rowData,
    productCategory,
    summaryProduct,
    targetArea,
    startMonth,
    endMonth,
  ]);

  // カラム定義
  const columnDefs: ColDef<ProductTargetData>[] = useMemo(
    () => [
      {
        headerName: '商品区分',
        field: 'productCategory',
        width: 96,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      // サマリ商品・参考商品は flex で残り幅を按分し、管理対象エリアと操作列の間に
      // 余白が出ないようにする（AG Grid 公式の flex。固定幅列とは併用可能）。
      // minWidth は従来の固定幅と同値のため、幅が足りない場合の見え方は従来どおり。
      {
        headerName: 'サマリ商品',
        field: 'summaryProduct',
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 280,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '参考商品',
        field: 'referenceProduct',
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 280,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '管理対象開始月',
        field: 'targetStartMonth',
        ...GRID_MONTH_TEXT_FILTER,
        width: 120,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '管理対象終了月',
        field: 'targetEndMonth',
        ...GRID_MONTH_TEXT_FILTER,
        width: 120,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '管理対象エリア',
        field: 'targetArea',
        width: 120,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '',
        colId: 'actions',
        width: 64,
        pinned: 'right',
        lockPinned: true,
        cellRenderer: ActionsCellRenderer,
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'cell-center',
      },
    ],
    []
  );

  // defaultColDef設定
  // 共通の defaultColDef（GRID_DEFAULT_COL_DEF）をそのまま使用する。
  // 列の高さ・セル背景色・文字サイズ・文字フォントは共通テーマ GRID_THEME に一任し、
  // 画面独自の cellStyle で上書きしない（画面設計標準）。
  // ※ ヘッダーのフィルター／列メニューボタン非表示・セル値ツールチップは
  //   GRID_DEFAULT_COL_DEF に内包（フィルターは右クリックメニューから開く）。
  const defaultColDef = useMemo(() => ({ ...GRID_DEFAULT_COL_DEF }), []);

  // 列状態（列幅・並び順・ソート等）を localStorage へ保存／復元する（共通フック）。
  // 列を flex 化した際にキーを更新している。旧キーのまま流用すると、保存済みの
  // 固定幅が applyColumnState で復元され flex レイアウトが無効化されるため。
  const gridColumnStateProps = useGridColumnState(
    'ManagedProductList.targetGrid.columnState.v2'
  );

  // ヘッダーのツールチップ（列幅で省略された見出しの全文表示）を付与した列定義。
  const columnDefsWithTooltips = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // 更新ハンドラ
  const handleEdit = (data: ProductTargetData) => {
    setSelectedData(data);
    const areas = data.targetArea.split(', ');
    const isNationwide = areas.includes('全国');
    setFormData({
      productCategory: data.productCategory,
      summaryProduct: data.summaryProduct,
      referenceProduct: data.referenceProduct,
      targetStartMonth: data.targetStartMonth,
      targetEndMonth: data.targetEndMonth,
      areaType: isNationwide ? '全国' : 'エリア指定',
      targetArea: isNationwide ? [] : areas,
    });
    setPaneMode('edit');
    // 削除ペインが開いていれば閉じる（右ペインは同時に1つだけ）
    setIsDeletePaneOpen(false);
    setIsPaneOpen(true);
  };

  // 右ペインは同時に1つだけ開く（計画詳細(マージン率固定・NET入力)と同方針）
  const closeAllRightPanes = () => {
    setIsPaneOpen(false);
    setIsDeletePaneOpen(false);
  };

  // 削除クリックハンドラ。計画詳細(マージン率固定・NET入力)の明細削除と同様に、
  // 同じ行の削除アイコンを再押下したら閉じ、別の行なら対象を差し替えて開き直す。
  const handleDeleteClick = (data: ProductTargetData) => {
    const isSameRowOpen = isDeletePaneOpen && deleteTarget?.id === data.id;
    closeAllRightPanes();
    if (isSameRowOpen) return;
    setDeleteTarget(data);
    setIsDeletePaneOpen(true);
  };

  // 削除実行ハンドラ
  const handleDelete = () => {
    if (deleteTarget) {
      setRowData(rowData.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('データを削除しました');
    }
    setIsDeletePaneOpen(false);
  };

  // 右クリック時に行を選択するハンドラ
  const handleCellContextMenu = (event: any) => {
    const clickedNode = event.node;
    if (clickedNode && event.api) {
      // 既存の選択を解除
      event.api.deselectAll();
      // 右クリックした行を選択
      clickedNode.setSelected(true);
    }
  };

  // 新規登録ハンドラ
  const handleAddRow = () => {
    setSelectedData(null);
    setFormData({ ...EMPTY_TARGET_FORM });
    setPaneMode('create');
    // 削除ペインが開いていれば閉じる（右ペインは同時に1つだけ）
    setIsDeletePaneOpen(false);
    setIsPaneOpen(true);
  };

  // 保存ハンドラ
  // continuous=true（連続追加）はペインを開いたままフォームを初期化する
  const handleSave = (continuous = false) => {
    // バリデーション
    if (!formData.productCategory || !formData.summaryProduct) {
      toast.error('商品区分とサマリ商品は必須です');
      return;
    }

    if (!formData.referenceProduct) {
      toast.error('参考商品は必須です');
      return;
    }

    if (!formData.targetStartMonth || !formData.targetEndMonth) {
      toast.error('管理対象期間は必須です');
      return;
    }

    // 開始月 ≤ 終了月チェック
    const start = formData.targetStartMonth.replace('/', '');
    const end = formData.targetEndMonth.replace('/', '');
    if (start > end) {
      toast.error('管理対象開始は管理対象終了以前である必要があります');
      return;
    }

    if (!formData.areaType) {
      toast.error('管理対象エリアは全国またはエリア指定を選択してください');
      return;
    }

    if (
      formData.areaType === 'エリア指定' &&
      formData.targetArea.length === 0
    ) {
      toast.error(
        'エリア指定を選択した場合は、最低1つの支社を選択してください'
      );
      return;
    }

    // 期間重複チェック（同一サマリ商品かつ管理対象エリアが重複する場合のみ）
    const currentArea =
      formData.areaType === '全国' ? '全国' : formData.targetArea.join(', ');

    const duplicateCheck = rowData.some((row) => {
      // 更新時は自分自身を除外
      if (paneMode === 'edit' && row.id === selectedData?.id) {
        return false;
      }

      // 同じサマリ商品でない場合はスキップ
      if (row.summaryProduct !== formData.summaryProduct) {
        return false;
      }

      // エリアが重複しない場合は期間が重なっても許容する
      if (!isAreaOverlapped(currentArea, row.targetArea)) {
        return false;
      }

      const rowStart = row.targetStartMonth.replace('/', '');
      const rowEnd = row.targetEndMonth.replace('/', '');

      // 期間が重なるかチェック
      return start <= rowEnd && end >= rowStart;
    });

    if (duplicateCheck) {
      toast.error(
        '同一サマリ商品・同一管理対象エリアで管理対象期間が重複しています'
      );
      return;
    }

    if (paneMode === 'create') {
      const newData: ProductTargetData = {
        id: String(Date.now()),
        productCategory: formData.productCategory,
        summaryProduct: formData.summaryProduct,
        metaBrand: '',
        referenceProduct: formData.referenceProduct,
        targetStartMonth: formData.targetStartMonth,
        targetEndMonth: formData.targetEndMonth,
        targetArea:
          formData.areaType === '全国'
            ? '全国'
            : formData.targetArea.join(', '),
      };
      setRowData([...rowData, newData]);
      toast.success('データを登録しました');
      // 連続追加：ペインを閉じずにフォームを初期化し、次の入力に備える
      if (continuous) {
        setFormData({ ...EMPTY_TARGET_FORM });
        return;
      }
    } else {
      setRowData(
        rowData.map((row) =>
          row.id === selectedData?.id
            ? {
                ...row,
                productCategory: formData.productCategory,
                summaryProduct: formData.summaryProduct,
                metaBrand: row.metaBrand,
                referenceProduct: formData.referenceProduct,
                targetStartMonth: formData.targetStartMonth,
                targetEndMonth: formData.targetEndMonth,
                targetArea:
                  formData.areaType === '全国'
                    ? '全国'
                    : formData.targetArea.join(', '),
              }
            : row
        )
      );
      toast.success('データを更新しました');
    }
    setIsPaneOpen(false);
  };

  // 支社チェックボックスハンドラ
  const handleAreaChange = (area: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        targetArea: [...formData.targetArea, area],
      });
    } else {
      setFormData({
        ...formData,
        targetArea: formData.targetArea.filter((a) => a !== area),
      });
    }
  };

  // インポートボタンハンドラ：ファイル選択ダイアログを開く
  const handleImport = () => {
    setIsImportDialogOpen(true);
  };

  // エクスポート機能は未実装。出力対象は rowData（管理対象商品）。
  // 計画詳細(マージン率固定・NET入力)の handleExport と同方針。
  const handleExport = () => {
    // TODO: 管理対象商品のExcel出力実装時に rowData を渡して出力する
  };

  // 登録ボタンハンドラ
  const handleRegister = () => {
    setIsRegisterDialogOpen(true);
  };

  const handleRegisterConfirm = () => {
    toast.success('データを登録しました');
    setIsRegisterDialogOpen(false);
  };

  return (
    <div className="min-w-300 relative overflow-hidden h-full">
      {/* メインコンテンツエリア（右ペインは RightPane のオーバーレイ表示のため
          グリッドは押し出さず全幅のまま。販売計画表(商流紐づけなし)と同一挙動） */}
      {/* ページ自体はスクロールさせず、下端の一覧カード内のグリッドだけをスクロールさせる。
          高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当て、
          横スクロールバーが画面外へ押し出されないようにする（支払一覧と同じ構成）。
          画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけこの領域がスクロールする。 */}
      <div className="overflow-x-auto overflow-y-auto h-full flex flex-col">
        <div className="px-6 pt-3 pb-3 min-w-300 flex-1 min-h-0 flex flex-col">
          {/* 画面名はヘッダー（システム名の右）に表示する */}
          <ScreenTitle title="管理対象商品一覧" />

          {/* 検索条件カード（計画詳細(マージン率固定・NET入力)と同じ折り畳みカード）。
              ヘッダーバーの黄色帯（card-header-accent）は CollapsibleCard 側が担う。 */}
          {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
          <CopyableArea className="shrink-0">
            <CollapsibleCard
              title={
                <span className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-gray-700" />
                  検索条件
                </span>
              }
              // 画面が低くてもグリッドに押しつぶされないよう縮めない（足りない分は画面側がスクロールする）
              className="shrink-0"
              // クリアボタンはヘッダーバーに置く（計画一覧と同一体裁。検索はリアルタイムのため検索ボタンは廃止）
              headerActions={<SearchClearButton onClick={handleClear} />}
              collapsedSummary={searchSummary}
            >
              <div className="px-4 py-1.5">
                {/* 一覧画面の検索条件は全画面共通の5列（→ 05 一覧画面の検索条件）。
                    1行目: 商品区分、サマリ商品、管理対象エリア／2行目: 管理対象開始月、管理対象終了月 */}
                <div className={SEARCH_GRID_CLASS}>
                  {/* 商品区分 */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="search-product-category"
                      className={SEARCH_LABEL_CLASS}
                    >
                      商品区分
                    </label>
                    <SingleCombobox
                      id="search-product-category"
                      className="min-w-0 flex-1"
                      options={[
                        { value: '新商品', label: '新商品' },
                        { value: '重点商品', label: '重点商品' },
                        { value: '自販機専用商品', label: '自販機専用商品' },
                      ]}
                      value={productCategory}
                      onChange={setProductCategory}
                      // 未選択＝「指定なし」（条件なし）。「すべて」の選択肢は持たない（→ 02 §9）
                      placeholder="指定なし"
                      clearable
                      searchable={false}
                    />
                  </div>

                  {/* サマリ商品（検索付き単一選択コンボボックス。任意条件のため clearable） */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="search-summary-product"
                      className={SEARCH_LABEL_CLASS}
                    >
                      サマリ商品
                    </label>
                    <div className="min-w-0 flex-1">
                      <SingleCombobox
                        id="search-summary-product"
                        options={summaryProductOptions}
                        value={summaryProduct}
                        onChange={setSummaryProduct}
                        placeholder="指定なし"
                        clearable
                      />
                    </div>
                  </div>

                  {/* 管理対象エリア */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="search-target-area"
                      className={SEARCH_LABEL_CLASS}
                    >
                      管理対象エリア
                    </label>
                    <SingleCombobox
                      id="search-target-area"
                      className="min-w-0 flex-1"
                      options={[
                        { value: '全国', label: '全国' },
                        { value: '首都圏本部', label: '首都圏本部' },
                        { value: '関東本部', label: '関東本部' },
                        { value: '中部北陸本部', label: '中部北陸本部' },
                        { value: '近畿圏本部', label: '近畿圏本部' },
                        { value: '北海道支社', label: '北海道支社' },
                        { value: '東北支社', label: '東北支社' },
                        { value: '中四国支社', label: '四国支社' },
                        { value: '九州支社', label: '九州支社' },
                      ]}
                      value={targetArea}
                      onChange={setTargetArea}
                      placeholder="指定なし"
                      clearable
                      searchable={false}
                    />
                  </div>

                  {/* 2行目: 管理対象開始月（行の先頭は col-start-1） */}
                  <div className="flex items-center gap-2 col-start-1">
                    <label className={SEARCH_LABEL_CLASS}>管理対象開始月</label>
                    {/* 検索条件の年月も入力欄の幅いっぱいにする（全項目一律の幅 → 05） */}
                    <div className="flex min-w-0 flex-1">
                      <MonthYearPicker
                        className="w-full"
                        value={startMonth}
                        onChange={setStartMonth}
                        required={false}
                        clearable
                      />
                    </div>
                  </div>

                  {/* 管理対象終了月 */}
                  <div className="flex items-center gap-2">
                    <label className={SEARCH_LABEL_CLASS}>管理対象終了月</label>
                    <div className="flex min-w-0 flex-1">
                      <MonthYearPicker
                        className="w-full"
                        value={endMonth}
                        onChange={setEndMonth}
                        required={false}
                        clearable
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleCard>
          </CopyableArea>

          {/* データ一覧カード（計画一覧(管理対象商品)と同じ折り畳みカード）。
              登録ボタンはヘッダーバー（headerActions）へ配置する。
              fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す。 */}
          <CollapsibleCard
            title="管理対象商品一覧"
            fillParent
            headerActions={
              <>
                <button
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm`}
                  onClick={handleAddRow}
                  aria-label="+管理対象商品登録"
                >
                  +管理対象商品登録
                </button>
              </>
            }
            className="mb-0 data-[state=open]:min-h-95"
            contentClassName="p-2 flex flex-col flex-1 min-h-0"
          >
            {/* グリッドはカード内の残り高さを埋める（min-h-0 が無いと flex 子要素が縮まない） */}
            <div className="grid-unified flex-1 min-h-0 w-full">
              <AgGridReact
                rowData={filteredData}
                columnDefs={columnDefsWithTooltips}
                defaultColDef={defaultColDef}
                getRowId={getRowId}
                statusBar={GRID_STATUS_BAR}
                domLayout="normal"
                ensureDomOrder={true}
                context={{
                  onEditRow: handleEdit,
                  onDeleteRow: handleDeleteClick,
                }}
                preventDefaultOnContextMenu={true}
                getContextMenuItems={(params) => {
                  // 右クリック時に行を自動選択
                  if (params.node && params.api) {
                    params.api.deselectAll();
                    params.node.setSelected(true);
                  }
                  // 標準のフィルタ導線（ヘッダーのフィルタボタンは非表示のため
                  // 右クリックメニューからフィルタを開く。§7/§8）。
                  return gridFilterContextMenuItems(params);
                }}
                {...GRID_BASE_PROPS}
                {...gridColumnStateProps}
              />
            </div>
          </CollapsibleCard>
        </div>
      </div>
      {/* メインコンテンツエリア終了 */}

      {/* 右ペイン（共通 RightPane：販売計画表(商流紐づけなし)と
          スタイル・左端の形状（リサイズハンドル/折り畳みタブ）・
          表示時のグリッド挙動（オーバーレイ）を統一） */}
      <RightPane
        open={isPaneOpen}
        onClose={() => setIsPaneOpen(false)}
        title={paneMode === 'create' ? '管理対象商品登録' : '管理対象商品更新'}
        description={`管理対象商品の${
          paneMode === 'create' ? '登録' : '更新'
        }を行います`}
        footer={
          <div className="flex items-center justify-end gap-3">
            {/* 連続追加：新規登録時のみ表示。押下してもペインは閉じない */}
            {paneMode === 'create' && (
              <Button
                onClick={() => handleSave(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
              >
                連続追加
              </Button>
            )}
            <Button
              onClick={() => handleSave(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
            >
              {paneMode === 'create' ? '登録' : '更新'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {/* 商品区分 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="productCategory" className="font-bold text-sm">
              商品区分
              <RequiredBadge />
            </Label>
            <SingleCombobox
              ariaRequired
              id="productCategory"
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              options={[
                { value: '新商品', label: '新商品' },
                { value: '重点商品', label: '重点商品' },
                { value: '自販機専用商品', label: '自販機専用商品' },
              ]}
              value={formData.productCategory}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  productCategory: value,
                })
              }
              placeholder="選択してください"
              searchable={false}
            />
          </div>

          {/* サマリ商品 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="summaryProduct" className="font-bold text-sm">
              サマリ商品
              <RequiredBadge />
            </Label>
            {/* 検索付き単一選択（共通部品）。必須項目のため clearable は付けない。
                更新時はキー項目のため非活性（従来どおり）。 */}
            <SingleCombobox
              id="summaryProduct"
              options={summaryProductOptions}
              value={formData.summaryProduct}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  summaryProduct: value,
                })
              }
              placeholder="コード または 名称で検索..."
              ariaRequired
              disabled={paneMode === 'edit'}
            />
          </div>

          {/* 参考商品 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="referenceProduct" className="font-bold text-sm">
              参考商品
              <RequiredBadge />
            </Label>
            {/* 検索付き単一選択（共通部品）。必須項目のため clearable は付けない。 */}
            <SingleCombobox
              id="referenceProduct"
              options={referenceProductOptions}
              value={formData.referenceProduct}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  referenceProduct: value,
                })
              }
              placeholder="コード または 名称で検索..."
              ariaRequired
            />
          </div>

          {/* 管理対象開始月 */}
          <div className="flex gap-4">
            {/* 管理対象開始月 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetStartMonth" className="font-bold text-sm">
                管理対象開始月
                <RequiredBadge />
              </Label>
              <MonthYearPicker
                id="targetStartMonth"
                required
                value={formData.targetStartMonth}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    targetStartMonth: value,
                  })
                }
                className="w-40"
              />
            </div>

            {/* 管理対象終了月 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetEndMonth" className="font-bold text-sm">
                管理対象終了月
                <RequiredBadge />
              </Label>
              <MonthYearPicker
                id="targetEndMonth"
                required
                value={formData.targetEndMonth}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    targetEndMonth: value,
                  })
                }
                className="w-40"
              />
            </div>
          </div>

          {/* 管理対象エリア */}
          <div className="flex flex-col gap-2">
            <Label className="font-bold text-sm">
              管理対象エリア
              <RequiredBadge />
            </Label>
            {/* 更新時はキー項目のため非活性（サマリ商品と同じ扱い）。
                Radix の RadioGroup は disabled が配下の項目へ伝播する。 */}
            <RadioGroup
              value={formData.areaType || ''}
              onValueChange={(value) => {
                setFormData({
                  ...formData,
                  areaType: value as '全国' | 'エリア指定',
                  targetArea: value === '全国' ? [] : formData.targetArea,
                });
              }}
              disabled={paneMode === 'edit'}
              className="flex flex-col gap-3"
            >
              {/* 全国 */}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="全国" id="area-type-all" />
                <Label
                  htmlFor="area-type-all"
                  className="cursor-pointer text-sm font-normal"
                >
                  全国
                </Label>
              </div>
              {/* エリア指定 */}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="エリア指定" id="area-type-specific" />
                <Label
                  htmlFor="area-type-specific"
                  className="cursor-pointer text-sm font-normal"
                >
                  エリア指定
                </Label>
              </div>
            </RadioGroup>
            {/* 全国以外の支社（エリア指定選択時のみ表示） */}
            {formData.areaType === 'エリア指定' && (
              <div className="flex flex-col gap-3 mt-2 pl-6 border-l-2 border-blue-200">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-shuto"
                    checked={formData.targetArea.includes('首都圏本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('首都圏本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-shuto"
                    className="text-sm cursor-pointer"
                  >
                    首都圏本部
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-kinki"
                    checked={formData.targetArea.includes('近畿圏本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('近畿圏本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-kinki"
                    className="text-sm cursor-pointer"
                  >
                    近畿圏本部
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-shikoku"
                    checked={formData.targetArea.includes('中四国支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('中四国支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-shikoku"
                    className="text-sm cursor-pointer"
                  >
                    四国支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-kyushu"
                    checked={formData.targetArea.includes('九州支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('九州支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-kyushu"
                    className="text-sm cursor-pointer"
                  >
                    九州支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-tohoku"
                    checked={formData.targetArea.includes('東北支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('東北支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-tohoku"
                    className="text-sm cursor-pointer"
                  >
                    東北支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-chubu"
                    checked={formData.targetArea.includes('中部北陸本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('中部北陸本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-chubu"
                    className="text-sm cursor-pointer"
                  >
                    中部北陸本部
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-hokkaido"
                    checked={formData.targetArea.includes('北海道支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('北海道支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-hokkaido"
                    className="text-sm cursor-pointer"
                  >
                    北海道支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-chugoku"
                    checked={formData.targetArea.includes('関東本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('関東本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-chugoku"
                    className="text-sm cursor-pointer"
                  >
                    関東本部
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </RightPane>

      {/* 右ペイン：削除確認（共通部品 DeleteConfirmPane）。
          ダイアログと異なりモーダルではないため、表示中も一覧を参照・操作できる。 */}
      <DeleteConfirmPane
        open={isDeletePaneOpen}
        onClose={() => setIsDeletePaneOpen(false)}
        title="管理対象商品削除"
        description="管理対象商品を削除します"
        message="以下の管理対象商品を削除してもよろしいですか？この操作は取り消せません。"
        items={[
          { label: '商品区分', value: deleteTarget?.productCategory },
          { label: 'サマリ商品', value: deleteTarget?.summaryProduct },
          { label: '参考商品', value: deleteTarget?.referenceProduct },
          {
            label: '管理対象期間',
            value: `${deleteTarget?.targetStartMonth}～${deleteTarget?.targetEndMonth}`,
          },
          { label: '管理対象エリア', value: deleteTarget?.targetArea },
        ]}
        onDelete={handleDelete}
      />

      {/* 管理対象商品インポートダイアログ
          （計画詳細(マージン率固定・NET入力)の計画書インポートと同構成） */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>管理対象商品インポート</DialogTitle>
            <DialogDescription>
              管理対象商品のExcelファイルをアップロードします。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right col-span-4">
                アップロードファイル
              </Label>
              <Input
                type="file"
                className={`${TEXT_INPUT_CLASS} col-span-4`}
                accept=".xlsx"
              />
            </div>
            <div className="text-sm text-gray-500 col-span-4">
              ファイル形式: 管理対象商品_yyyyMMddHHmmss.xlsx
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsImportDialogOpen(false)}>
              <Upload className="h-4 w-4" />
              管理対象商品インポート
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 登録確認ダイアログ */}
      <ConfirmDialog
        open={isRegisterDialogOpen}
        onOpenChange={setIsRegisterDialogOpen}
        title="登録の確認"
        description={
          <>
            以下の管理対象商品を登録してもよろしいですか？
            <div className="mt-4 text-gray-900 space-y-1">
              {rowData.slice(0, 3).map((row) => (
                <div key={row.id}>
                  サマリ商品名：{row.summaryProduct}
                  {'　'}&emsp;管理対象期間：{row.targetStartMonth}~
                  {row.targetEndMonth}
                </div>
              ))}
            </div>
          </>
        }
        confirmLabel="登録"
        onConfirm={handleRegisterConfirm}
      />
    </div>
  );
}
