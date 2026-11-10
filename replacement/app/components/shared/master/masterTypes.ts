// 型1 マスタメンテCRUD型 画面の定義（スキャフォールド共通）。
// 画面側は MasterScreenDef（項目・検索条件・属性・仕様）とモックデータだけを定義し、
// 検索カード・一覧グリッド・右ペイン・確認ダイアログは shared/master の部品が描画する。
// 標準の出典：マスタ画面標準化 p.5〜p.7（ひな形＝パターン＋属性＋仕様、全マスタ共通の標準仕様）、
// 画面設計標準 ver0.3 3.2／3.4／3.6／3.8／3.9／4.x、第27回共通セッション（10/2）決定1〜7、
// 10/21 内部レビュー（Q&A No.34・35）。全マスタ共通のルールは画面定義で外せないよう部品側で持つ。
// メッセージの文言は共通メッセージ一覧（constants/masterMessages.ts、sync-messages.cjs が生成）から引く。
// 2026-10-30：画面設計標準 ver0.3 と guidelines 01〜08（10/28〜29 更新）に合わせて共通部品を直した。
// 検索条件は 5 列＋複数選択（未選択＝条件なし）、一覧カードは CollapsibleCard（fillParent）、右ペインの破棄確認は RightPane の dirty。
// あわせて Q&A QM-028（商品分類導出の主キー）に要る定義（uniqueGroups・displayKeys・emptyLabel・maxDigits／min／max）を足した。
// 2026-10-30（2回目）：Q&A QM-020・026（数値はマイナス入力不可を標準に）、QM-033（主キーと無効化フラグだけのマスタは更新ペインを設けない。
// 変更できる項目が無い画面は部品側で判定する＝型1 ルール R-63）、QM-034（長い文字の項目は複数行の入力欄・一覧は省略表示＋ツールチップ＝R-64）、
// QM-032（社員を事業場→部署で絞り込む 2 段の親子連動）を足した。

/**
 * 項目の入力形式。combo／select はコード値を保持し、一覧ではコード列と名称列に分けて表示する。
 * month は年月（YYYY/MM）。適用期間が年月のマスタ（販売店条件口率・管理対象商品）で使う。
 * textarea は複数行の文字入力（通知の本文など 100 文字を超える項目。Q&A QM-034）。一覧では列幅で省略し、マウスオーバーで全文を表示する
 */
export type MasterFieldKind =
  | 'text'
  | 'textarea'
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
   * 重複して登録できない項目（一般卸メッシュのメタブランド・容器容量G・希望小売価格・商品函バラ入数）。
   * 組が複数あるマスタは MasterScreenDef.uniqueGroups で指定する
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
  /** number：整数部の桁数の上限。入力欄で超える桁を受け付けない（例：適用優先順＝3 桁。Q&A QM-029） */
  maxDigits?: number;
  /** number：下限・上限（決定事項で決めた業務上の範囲。外れると入力エラー。7 の範囲チェックに書く） */
  min?: number;
  max?: number;
  /**
   * number：マイナスの入力を許す。既定（未指定）はマイナスを入力できない（型1 の標準。Q&A QM-020・026）。
   * 標準のため 7 の範囲チェックには書かず、業務上の下限があるときだけ min を書く
   */
  allowNegative?: boolean;
  /**
   * text／textarea：文字数の上限（全角の文字数。エンティティ定義の桁）。入力欄で超える文字を受け付けない。
   * 40 文字以上の項目は右ペインを広げて表示し、一覧は列幅で省略してマウスオーバーで全文を表示する（Q&A QM-034）
   */
  maxLength?: number;
  /** 単位（入力欄の右に表示） */
  unit?: string;
  placeholder?: string;
  /** 入力欄の下に出す利用者向けの案内（単位・入力例など）。決定番号・要確認・設計メモは書かない（Q&A No.34⑨） */
  note?: string;
  /** 登録・更新とも固定の値（変更不可）。例：共通会社＝アサヒ飲料（Q&A No.35①） */
  fixedValue?: string;
  /**
   * combo／select：値が無い（未設定）ときに一覧の名称列・右ペインで表示する語（例：「指定なし」）。
   * 任意の判断軸で「未設定＝どの値にも当てはまる」を表すマスタ（商品分類導出。Q&A QM-028）で使う。
   * 右ペインではクリアで未設定に戻せる。保持する値は無し（NULL）で、専用のコードは作らない
   */
  emptyLabel?: string;
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

/**
 * 一意制約の組（主キーとは別）。keys の値の組（世代管理は同じ適用開始年月日の中で）が同じ行を重複して登録できない。
 * 未設定（空）の値も同じ値として比べる（NULL を同値扱いする一意インデックス。Q&A QM-028）。
 * activeOnly は無効化済みの行を判定から外す（有効行の中で一意）
 */
export interface MasterUniqueGroup {
  keys: string[];
  activeOnly?: boolean;
}

/**
 * 画面の定義。更新ペインの有無は定義で指定せず、部品が項目から判定する（masterUtils.hasUpdate）：
 * 主キー・固定値・表示のみ・主キーの親（絞り込み用）以外に変更できる項目が無いマスタ（システム管理者設定など）は
 * 更新ペインと操作列の編集アイコンを設けず、登録・無効化・削除だけにする（Q&A QM-033）
 */
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
  /** 一意制約の組（主キーとは別。fields の unique と併用できる） */
  uniqueGroups?: MasterUniqueGroup[];
  /**
   * 確認ダイアログ・メッセージで行を示す項目（既定＝業務キー）。
   * 主キーがシステム採番の内部コードで画面に出さないマスタ（商品分類導出）で、利用者に分かる項目を指定する
   */
  displayKeys?: string[];
  /** 一覧の既定の並び順にする項目（昇順）。未指定は列定義の順（業務キーの昇順） */
  defaultSortKey?: string;
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

/**
 * 検索条件の値（キー → 入力値）。選択肢のある項目（combo／select／無効化）は複数選択のため配列（未選択＝条件なし）、
 * 文字・数値・年月日は文字列（未入力は空文字）
 */
export type MasterCriteriaValue = string | string[];
export type MasterCriteria = Record<string, MasterCriteriaValue>;
/** 右ペインの入力値（キー → 入力値。すべて文字列で保持し、保存時に型を解決する） */
export type MasterDraft = Record<string, string>;

/** 右ペインの種類。コピー登録は新規登録と初期値・活性制御が違うため分ける（10/21 戦略NET レビュー） */
export type MasterPaneMode = 'create' | 'copy' | 'update';
