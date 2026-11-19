/**
 * 遷移先へ引き継ぐパラメータ。値は文字列だけ（ID・区分などの小さな値）にする。
 * Next.js へ移すときは URL のクエリ（`?id=…`）になるため、行のオブジェクトや関数は載せない。
 * 画面をまたいで共有する業務のデータは、業務の Provider（例：BillingEdiProvider）で持つ。
 */
export type RouteParams = Record<string, string>;

/** 画面を切り替える関数（遷移先のルート ID と、遷移先へ引き継ぐパラメータ）。 */
export type NavigateFn = (routeId: string, params?: RouteParams) => void;
