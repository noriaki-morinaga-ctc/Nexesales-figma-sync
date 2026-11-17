// コンポーネント見本
// 計画一覧・計画詳細・支払詳細(追加口請求書有／自販機)では使わず、
// 他画面でのみ使っている ui コンポーネント（Progress／YearPicker）を並べて確認する。
import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { YearPicker } from '@/components/ui/year-picker';
// Progress は実画面と同じく進捗トースト（予算参照登録の ProgressToast）の中で表示する
import { ProgressToast } from '@/features/budget/budget-reference-registration/components/ProgressToast';
import {
  CARD_TITLE_CLASS,
  FORM_LABEL_CLASS,
  FORM_VALUE_CLASS,
  SCREEN_TITLE_CLASS,
} from '@/styles/commonStyles';

// 進捗トーストの動き（予算参照登録・ファイルアップロード画面と同じ値）
const UPLOAD_PROGRESS_TOAST_ID = 'showcase-upload-progress';
const DOWNLOAD_PROGRESS_TOAST_ID = 'showcase-download-progress';
const UPLOAD_SIMULATE_MS = 2000;
const UPLOAD_PROGRESS_INTERVAL_MS = 200;
const UPLOAD_PROGRESS_MAX = 95;
const DOWNLOAD_PROGRESS_INTERVAL_MS = 100;
const PROGRESS_STEP = 10;

// 進捗トーストを表示（同一IDで再描画して更新）する
const showProgressToast = (id: string, title: string, value: number) => {
  toast.custom(() => <ProgressToast title={title} value={value} />, {
    id,
    duration: Infinity,
  });
};

/** 見本1件分の白カード（見出し＋使用画面＋本文）。 */
interface SampleCardProps {
  title: string;
  usedIn: string;
  children: React.ReactNode;
}

function SampleCard({ title, usedIn, children }: SampleCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-md">
      <div className="px-3 py-1.5 border-b border-gray-200">
        <h3 className={CARD_TITLE_CLASS}>{title}</h3>
        <p className="text-xs text-gray-500">使用画面：{usedIn}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ComponentShowcase() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  // 実行中のタイマー（画面を離れたら止めてトーストを閉じる）
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearInterval(t));
      toast.dismiss(UPLOAD_PROGRESS_TOAST_ID);
      toast.dismiss(DOWNLOAD_PROGRESS_TOAST_ID);
    },
    []
  );

  // アップロード：95%で止め、処理完了（2秒後）にトーストを閉じて完了を通知
  const handleUpload = () => {
    setIsUploading(true);
    let progress = 0;
    showProgressToast(UPLOAD_PROGRESS_TOAST_ID, 'アップロード中...', progress);
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + PROGRESS_STEP, UPLOAD_PROGRESS_MAX);
      showProgressToast(
        UPLOAD_PROGRESS_TOAST_ID,
        'アップロード中...',
        progress
      );
    }, UPLOAD_PROGRESS_INTERVAL_MS);
    const doneTimer = setTimeout(() => {
      clearInterval(progressInterval);
      toast.dismiss(UPLOAD_PROGRESS_TOAST_ID);
      toast.success('アップロードが完了しました。');
      setIsUploading(false);
    }, UPLOAD_SIMULATE_MS);
    timersRef.current.push(progressInterval, doneTimer);
  };

  // ダウンロード：100%まで進めたらトーストを閉じて完了を通知
  const handleDownload = () => {
    setIsDownloading(true);
    let progress = 0;
    showProgressToast(
      DOWNLOAD_PROGRESS_TOAST_ID,
      'ダウンロード中...',
      progress
    );
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + PROGRESS_STEP, 100);
      showProgressToast(
        DOWNLOAD_PROGRESS_TOAST_ID,
        'ダウンロード中...',
        progress
      );
      if (progress >= 100) {
        clearInterval(progressInterval);
        toast.dismiss(DOWNLOAD_PROGRESS_TOAST_ID);
        toast.success('ダウンロードが完了しました。');
        setIsDownloading(false);
      }
    }, DOWNLOAD_PROGRESS_INTERVAL_MS);
    timersRef.current.push(progressInterval);
  };

  return (
    <div className="min-w-[75rem]">
      <div className="px-6 pt-6 pb-6">
        {/* 画面タイトル */}
        <div className="px-3 py-1.5 mb-1">
          <div className="flex items-center gap-2">
            <h2 className={SCREEN_TITLE_CLASS}>コンポーネント見本</h2>
            <span className="text-xs text-gray-500">
              計画一覧・計画詳細・支払詳細(追加口請求書有／自販機)以外の画面でのみ使用している
              ui コンポーネント
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 items-start gap-3">
          {/* Progress */}
          <SampleCard
            title="Progress（ui/progress.tsx）"
            usedIn="予算参照登録、ファイルアップロード画面"
          >
            <p className={`${FORM_VALUE_CLASS} mb-3`}>
              ボタンを押すと、画面右上に進捗トーストが表示されます。
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpload}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4" />
                アップロード
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <Download className="h-4 w-4" />
                ダウンロード
              </Button>
            </div>
          </SampleCard>

          {/* YearPicker */}
          <SampleCard
            title="YearPicker（ui/year-picker.tsx）"
            usedIn="年間計画作成"
          >
            <div className="flex items-center gap-3">
              <span className={FORM_LABEL_CLASS}>年度</span>
              <YearPicker value={year} onChange={setYear} />
              <span className={FORM_VALUE_CLASS}>選択値：{year}</span>
            </div>
          </SampleCard>
        </div>
      </div>
    </div>
  );
}
