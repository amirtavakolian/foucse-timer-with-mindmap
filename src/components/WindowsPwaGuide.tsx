import React from 'react';
import { X, Monitor, Download, CheckCircle, ArrowRight } from 'lucide-react';

interface WindowsPwaGuideProps {
  isOpen: boolean;
  onClose: () => void;
  isFa: boolean;
}

export const WindowsPwaGuide: React.FC<WindowsPwaGuideProps> = ({ isOpen, onClose, isFa }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85">
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isFa ? 'نصب برنامه‌ روی دسکتاپ ویندوز' : 'Install as Native Windows App'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          <p className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-blue-900 dark:text-blue-200 font-semibold">
            {isFa
              ? 'این نرم‌افزار به صورت کامل با استانداردهای Windows PWA و ویندوز ۱۱ سازگار است. می‌توانید آن را به عنوان یک نرم‌افزار مستقل در ویندوز نصب کرده و آیکون آن را روی دسکتاپ یا Taskbar قرار دهید.'
              : 'This app is fully compliant with Windows 11 PWA standards and can be installed natively on your desktop.'}
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                1
              </span>
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block font-bold">{isFa ? 'در مرورگر گوگل کروم یا مایکروسافت اج:' : 'In Chrome or Microsoft Edge:'}</strong>
                <span>
                  {isFa
                    ? 'روی آیکون ۳ نقطه در بالای سمت راست مرورگر کلیک کنید.'
                    : 'Click the 3-dots menu in the top right corner.'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                2
              </span>
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block font-bold">{isFa ? 'انتخاب گزینه نصب:' : 'Select Install:'}</strong>
                <span>
                  {isFa
                    ? 'گزینه «Save and Share» -> «Install page as app» یا «نصب Windows Focus Timer» را انتخاب کنید.'
                    : 'Choose "Save and Share" -> "Install page as app" or "Install Windows Focus Timer".'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                3
              </span>
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block font-bold">{isFa ? 'اجرا مانند برنامه‌های ویندوز:' : 'Launch like any Windows app:'}</strong>
                <span>
                  {isFa
                    ? 'از این پس نرم‌افزار در منوی Start ویندوز قرار می‌گیرد و بدون نیاز به تب مرورگر اجرا می‌شود.'
                    : 'The app will now appear in your Windows Start Menu and Taskbar!'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/20"
          >
            {isFa ? 'متوجه شدم' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
