// 型1 マスタメンテCRUD型 画面の定義（スキャフォールド共通）。
// 画面側は MasterScreenDef（項目・検索条件・属性・仕様）とモックデータだけを定義し、
// 検索カード・一覧グリッド・右ペイン・確認ダイアログは shared/master の部品が描画する。
// 標準の出典：マスタ画面標準化 p.5〜p.7（ひな形＝パターン＋属性＋仕様、全マスタ共通の標準仕様）、
// 画面設計標準 ver0.3 3.2／3.4／3.6／3.8／3.9／4.x、第27回共通セッション（10/2）決定1〜7、
// 10/21 内部レビュー（Q&A No.34・35）。全マスタ共通のルールは画面定義で外せないよう部品側で持つ。
// メッセージの文言は共通メッセージ一覧（constants/masterMessages.ts、sync-messages.cjs が生成）から引く。

/**
 * 項目の入力形式。combo／select はコード値を保持し、一覧ではコード列と名称列に分けて表示する。
 * month は年月（YYYY/MM）。適用期間が年月のマスタ（販売店条件口率・管理対象商品）で使う
 */
export type MasterFieldKind =
  | 'text'
  | 'number'
  | 'date'
  | 'month'
  | 'combo'
  | 'select';

/** コードと名称の組（外部キー・区分値の候補） */
export interface MasterCodeNameOption {
  code: string;
  name: string;
}

export interface MasterFieldDef {
  /** データのキー。combo／select はコード値を保持する */
  key: string;
  /** 項目名（画面表示） */
  label: string;
  kind: MasterFieldKind;
  /** 主キー（エンティティ定義の PK）。更新時は変更不可とし、検索条件の候補にする（Q&A No.16） */
  pk?: boolean;
  /**
   * ユニーク制約（エンティティ定義の AK）。主キーとは別に、同じ値の組（世代管理は同じ適用開始年月日の中で）を
   * 重複して登録できない項目（一般卸メッシュのメタブランド・容器容量G・希望小売価格・商品函バラ入数）
   */
  unique?: boolean;
  required?: boolean;
  /** combo／select の候補 */
  options?: MasterCodeNameOption[];
  /** combo のとき一覧に出すコード列・名称列の見出し（既定は「<label>コード」「<label>名称」） */
  codeLabel?: string;
  nameLabel?: string;
  /** number の表示書式 */
  format?: 'integer' | 'decimal2' | 'decimal4';
  /** 単位（入力欄の右に表示） */
  unit?: string;
  placeholder?: string;
  /** 入力欄の下に出す利用者向けの案内（単位・入力例など）。決定番号・要確認・設計メモは書かない（Q&A No.34⑨） */
  note?: string;
  /** 登録・更新とも固定の値（変更不可）。例：共通会社＝アサヒ飲料（Q&A No.35①） */
  fixedValue?: string;
  /**
   * 親項目による候補の絞り込み（例：事業場 → 部署）。parentOf は子のコード → 親のコード。
   * 親を選ぶと子の候補を絞り、子を選ぶと親を自動で設定する。子が変更不可のときは親も変更不可
   */
  parentKey?: string;
  parentOf?: Record<string, string>;
  /** text の検索条件で、この項目に加えて部分一致の対象にするキー（例：名称の検索でコードも対象にする） */
  searchAlsoKeys?: string[];
  /** 一覧の列幅（rem ではなく AG Grid の px 指定。未指定は内容に合わせて自動調整） */
  gridWidth?: number;
  hideInGrid?: boolean;
  hideInForm?: boolean;
  /** 自動採番など、入力させず表示のみ。主キーの自動採番コード（一般卸メッシュコード）もこれ */
  readOnly?: boolean;
}

/**
 * 世代管理（属性）。同一の業務キーで適用開始・終了（年月日または年月）を持ち、
 * 一覧は最新世代（適用開始が最も新しい世代）に集約し、最左の展開列で全世代を確認できるようにする
 * （マスタ画面標準化 p.12、Q&A No.34⑥）。将来世代という区別は設けない（10/21 戦略NET レビュー）。
 * 適用終了は必須で、有効なデータは 4000/12/31（年月は 4000/12）とする（Q&A No.34⑧）。
 * 新しい世代を登録したら、前の世代の適用終了を前日（前月）に自動で更新する（10/21 朝比奈決定）。
 */
export interface MasterGenerationDef {
  startKey: string;
  endKey: string;
}

export interface MasterScreenDef {
  /** ルート ID（＝画面ディレクトリ名）。列状態の保存キーにも使う */
  routeId: string;
  /** 画面タイトル（例：一般卸メッシュマスタ） */
  title: string;
  /** 1件の呼び名（例：一般卸メッシュ）。ボタン名・ペイン名・メッセージに使う */
  entityLabel: string;
  fields: MasterFieldDef[];
  /**
   * 検索条件に出す項目のキー（検索ボタンは設けず、条件変更で一覧を随時更新する）。
   * 世代管理の適用開始は From〜To で出し、適用終了は検索条件にしない（Q&A No.34②）
   */
  searchKeys: string[];
  /** 属性：世代管理 */
  generation?: MasterGenerationDef;
  /** 属性：無効化フラグ（世代管理を持たないマスタの利用停止手段）。論理削除とあわせて持つ */
  inactivation?: boolean;
  /** 操作列にコピーを設ける（世代管理マスタは新世代の作成に使い、適用期間以外の業務キーは変更不可） */
  copyAction?: boolean;
  /** 仕様：一括UL対象。一覧に「アップロード用シートDL」ボタンを設ける（10/2 決定1・6） */
  bulkUpload?: boolean;
  /** UL用シートの列見出し（既定：入力項目の項目名） */
  uploadSheetColumns?: string[];
  /** 登録時に自動採番する項目（内部コードは非表示が標準だが、業務で使うコードは表示する） */
  autoNumberKey?: string;
  autoNumberPrefix?: string;
}

/** システム共通項目。個別の変更履歴は設けず、作成者・最終更新者と日時を一覧・右ペインに表示する（7/30 決定7） */
export interface MasterRowBase {
  id: string;
  /** 無効化フラグ（inactivation のマスタのみ使う） */
  inactive?: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export type MasterRow = MasterRowBase & Record<string, unknown>;

/** 一覧表示用に世代の情報を付けた行 */
export type MasterGridRow = MasterRow & {
  /** 業務キー（適用開始・終了を除く PK を連結したもの） */
  generationGroup: string;
  /** その業務キーの中で最新の世代（適用開始が最も新しい世代）か */
  isLatestGeneration: boolean;
  /** 世代管理の展開表示（AG Grid Tree Data）のパス */
  treePath: string[];
};

/** 検索条件の値（キー → 入力値。未入力は空文字） */
export type MasterCriteria = Record<string, string>;
/** 右ペインの入力値（キー → 入力値。すべて文字列で保持し、保存時に型を解決する） */
export type MasterDraft = Record<string, string>;

/** 右ペインの種類。コピー登録は新規登録と初期値・活性制御が違うため分ける（10/21 戦略NET レビュー） */
export type MasterPaneMode = 'create' | 'copy' | 'update';
