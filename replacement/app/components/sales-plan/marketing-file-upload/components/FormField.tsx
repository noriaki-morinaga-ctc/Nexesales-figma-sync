import type { ReactNode } from 'react';
import { RequiredBadge } from '../../../ui/required-badge';
import { FORM_LABEL_CLASS } from '../../../../../styles/commonStyles';

interface FormFieldProps {
  label: string;
  required?: boolean;
  // 単一の入力要素に紐付ける場合は htmlFor（label 要素で描画）
  htmlFor?: string;
  // 複数要素のまとまりに紐付ける場合は labelId（aria-labelledby で参照される）
  labelId?: string;
  className?: string;
  children: ReactNode;
}

// ラベル（上）＋入力（下）の縦並び項目
export function FormField({
  label,
  required,
  htmlFor,
  labelId,
  className,
  children,
}: FormFieldProps) {
  const labelClassName = `${FORM_LABEL_CLASS} whitespace-nowrap flex items-center`;
  const labelContent = (
    <>
      {label}
      {required && <RequiredBadge />}
    </>
  );
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClassName}>
          {labelContent}
        </label>
      ) : (
        <span id={labelId} className={labelClassName}>
          {labelContent}
        </span>
      )}
      {children}
    </div>
  );
}
