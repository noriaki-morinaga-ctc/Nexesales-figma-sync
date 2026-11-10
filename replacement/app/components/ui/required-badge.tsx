// 必須バッジ。狭い列見出しの中でも「必須」が折り返して潰れないよう、折り返さず縮めない
export function RequiredBadge() {
  return (
    <span className="inline-flex shrink-0 items-center ml-1 align-middle">
      <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0 rounded-full text-xs font-medium bg-gradient-to-r from-pink-500 to-red-500 text-white shadow-sm">
        必須
      </span>
    </span>
  );
}
