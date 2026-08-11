import React, { useEffect } from 'react';
import { Bell, CheckCircle2, Volume2, X, Sparkles, RotateCcw } from 'lucide-react';
import { AppSettings } from '../types';
import { playCompletionChime } from '../utils/audio';
import { formatDurationHuman, toPersianDigits } from '../utils/time';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartTimer: () => void;
  completedDurationSeconds: number;
  taskName: string;
  settings: AppSettings;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onRestartTimer,
  completedDurationSeconds,
  taskName,
  settings,
}) => {
  const isFa = settings.language === 'fa';

  useEffect(() => {
    if (isOpen) {
      // Play 5-second light chime sound
      if (settings.sound.enabled) {
        playCompletionChime(settings.sound.volume, settings.sound.soundType);
      }

      // Native Windows Notification trigger
      if (settings.nativeNotifications && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(isFa ? 'تایمر تمرکز ویندوز به پایان رسید!' : 'Windows Focus Timer Finished!', {
            body: isFa
              ? `تمرکز شما به مدت ${formatDurationHuman(completedDurationSeconds, 'fa')} با موفقیت کامل شد. خسته نباشید!`
              : `Focus session of ${formatDurationHuman(completedDurationSeconds, 'en')} completed!`,
            requireInteraction: true,
          });
        } catch (e) {
          console.warn('Native notification error:', e);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/85 animate-in fade-in duration-300">
      {/* High priority Windows Toast Card */}
      <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden transform scale-100 transition-all">
        {/* Animated background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-bounce">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                {isFa ? 'اعلان رسمی ویندوز ۱۱' : 'Windows 11 Priority Notification'}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isFa ? 'زمان تمرکز پایان یافت!' : 'Focus Time Completed!'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
            title={isFa ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="my-6 space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                {isFa
                  ? `تبریک! زمان تعیین‌شده به پایان رسید و این بازه تمرکز در نمودار ۲۴ ساعته امروز شما ثبت شد.`
                  : `Congratulations! Your target focus time reached zero and was logged to your 24-hour timeline.`}
              </p>
              {taskName && (
                <div className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg inline-block border border-blue-200 dark:border-blue-700/40 shadow-sm">
                  {isFa ? `عنوان فعالیت: ${taskName}` : `Task: ${taskName}`}
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500 dark:text-slate-400">{isFa ? 'مدت زمان این جلسه:' : 'Session Duration:'}</span>
            <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
              {formatDurationHuman(completedDurationSeconds, settings.language)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-2">
          {/* Replay chime sound button */}
          <button
            onClick={() => playCompletionChime(settings.sound.volume, settings.sound.soundType)}
            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-2 text-xs font-bold"
            title={isFa ? 'پخش مجدد صدای نوتیفیکیشن' : 'Replay Sound'}
          >
            <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">{isFa ? 'پخش مجدد صدا' : 'Replay Sound'}</span>
          </button>

          {/* Close Notification button */}
          <button
            onClick={onClose}
            className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>{isFa ? 'بستن نوتیفیکیشن' : 'Close Notification'}</span>
          </button>

          {/* Start New Session */}
          <button
            onClick={() => {
              onClose();
              onRestartTimer();
            }}
            className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isFa ? 'شروع دوباره' : 'Restart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
