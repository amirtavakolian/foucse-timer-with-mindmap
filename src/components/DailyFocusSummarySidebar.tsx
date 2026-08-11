import React, { useState } from 'react';
import { AppSettings, FocusSession } from '../types';
import { formatDurationHuman, formatShamsiDate, getTodayDateStr, getAllTrackedDates } from '../utils/time';
import { getInitialStartDate, getExactIntervalReportForDate } from '../utils/storage';
import { BarChart3, Calendar, Clock, Hourglass, Trash2, ChevronDown, ChevronUp, AlertTriangle, X } from 'lucide-react';

interface DailyFocusSummarySidebarProps {
  settings: AppSettings;
  sessions: FocusSession[];
  activeSession: { startTime: number; elapsedSeconds: number } | null;
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onClearDay?: (dateStr: string) => void;
  clearedDates?: string[];
}

export const DailyFocusSummarySidebar: React.FC<DailyFocusSummarySidebarProps> = React.memo(({
  settings,
  sessions,
  activeSession,
  selectedDateStr,
  onSelectDate,
  onClearDay,
  clearedDates = [],
}) => {
  const [showAllDays, setShowAllDays] = useState<boolean>(false);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const todayStr = getTodayDateStr();
  const initialStartDate = getInitialStartDate();

  // Get all dates from initial start date up to today (inclusive), plus any dates with sessions
  const dateList = getAllTrackedDates(sessions, initialStartDate, clearedDates);

  // Compute daily stats for each date
  const dailyData = dateList.map((dateStr) => {
    const daySessions = sessions.filter((s) => s.dateStr === dateStr);

    let totalFocusSec = 0;
    let unusedSec = 0;

    if (daySessions.length > 0 || (dateStr === todayStr && activeSession) || dateStr <= todayStr) {
      const intervals = getExactIntervalReportForDate(dateStr, daySessions, activeSession, false, clearedDates);

      totalFocusSec = intervals
        .filter((i) => i.type === 'focus')
        .reduce((acc, i) => acc + i.durationSeconds, 0);

      unusedSec = intervals
        .filter((i) => i.type === 'idle')
        .reduce((acc, i) => acc + i.durationSeconds, 0);
    }

    const totalMeasuredSec = totalFocusSec + unusedSec;
    const focusPercent =
      totalMeasuredSec > 0 ? Math.min(100, Math.round((totalFocusSec / totalMeasuredSec) * 100)) : 0;
    const unusedPercent = totalMeasuredSec > 0 ? Math.max(0, 100 - focusPercent) : 0;

    return {
      dateStr,
      isToday: dateStr === todayStr,
      totalFocusSec,
      unusedSec,
      focusPercent,
      unusedPercent,
      hasSessions: daySessions.length > 0,
    };
  });

  // Overall totals accumulated across ALL recorded days
  const grandTotalFocusSec = dailyData.reduce((acc, d) => acc + d.totalFocusSec, 0);
  const grandTotalUnusedSec = dailyData.reduce((acc, d) => acc + d.unusedSec, 0);

  // Filter visible items (at most 3 days by default, or all if expanded)
  const visibleDailyData = showAllDays ? dailyData : dailyData.slice(0, 3);

  // Helper to format date label (Always Solar Hijri / Shamsi date)
  const formatDateLabel = (dateStr: string) => {
    const shamsi = formatShamsiDate(dateStr);
    if (dateStr === todayStr) {
      return `Today (${shamsi})`;
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

    if (dateStr === yesterdayStr) {
      return `Yesterday (${shamsi})`;
    }

    return shamsi;
  };

  return (
    <aside className="w-full h-full flex flex-col gap-6 select-none">
      {/* Main Container */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#0d0221] border border-fuchsia-500/40 shadow-[0_0_25px_rgba(217,70,239,0.12)] flex flex-col h-full flex-1 justify-start gap-4">
        {/* Header */}
        <div className="pb-5 border-b border-fuchsia-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-fuchsia-950/80 border border-fuchsia-700/60 flex items-center justify-center text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.2)]">
                <BarChart3 className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300">
                  Daily Focus & Unused Time
                </h2>
                <p className="text-[11px] font-bold text-fuchsia-300/80 mt-0.5">
                  Daily breakdown of focused vs idle hours
                </p>
              </div>
            </div>
          </div>

          {/* Grand summary pill box */}
          <div className="mt-4 p-3.5 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 grid grid-cols-2 gap-3 text-center">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-fuchsia-950/80 border border-fuchsia-700/60 shadow-[0_0_10px_rgba(217,70,239,0.15)]">
              <span className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Total Focused
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-fuchsia-100 mt-1">
                {formatDurationHuman(grandTotalFocusSec, 'en')}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#0d0221] border border-fuchsia-900/60">
              <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider flex items-center gap-1">
                <Hourglass className="w-3 h-3 text-fuchsia-400" />
                Total Unused
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-fuchsia-200 mt-1">
                {formatDurationHuman(grandTotalUnusedSec, 'en')}
              </span>
            </div>
          </div>
        </div>

        {/* Daily Breakdown List */}
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider flex items-center justify-between">
            <span>Daily Summary Breakdown</span>
            <span className="text-[10px] font-normal text-fuchsia-400">
              ({dailyData.length} days)
            </span>
          </div>

          {visibleDailyData.map((item) => {
            const isSelected = item.dateStr === selectedDateStr;

            return (
              <div
                key={item.dateStr}
                onClick={() => onSelectDate(item.dateStr)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1a073d] border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.3)] ring-1 ring-fuchsia-400/50'
                    : 'bg-[#150533]/60 border-fuchsia-900/60 hover:border-fuchsia-700/60 hover:bg-[#1a073d]/50'
                }`}
              >
                {/* Date Header & Badges */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${isSelected ? 'text-cyan-300' : 'text-fuchsia-400/60'}`} />
                    <span className="text-xs font-extrabold text-fuchsia-200">
                      {formatDateLabel(item.dateStr)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isToday && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_8px_rgba(217,70,239,0.4)]">
                        Today
                      </span>
                    )}

                    {onClearDay && !item.isToday && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteDate(item.dateStr);
                        }}
                        className="p-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition shadow-[0_0_8px_rgba(225,29,72,0.2)]"
                        title="پاک کردن داده‌های این روز"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Focus Time Row */}
                <div className="p-2.5 rounded-xl bg-fuchsia-950/80 border border-fuchsia-700/60 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_#22d3ee]"></span>
                    <span className="text-xs font-bold text-fuchsia-200">
                      Focused Time:
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-cyan-300">
                    {formatDurationHuman(item.totalFocusSec, 'en')}
                  </span>
                </div>

                {/* Unused Time Row */}
                <div className="p-2.5 rounded-xl bg-[#0d0221] border border-fuchsia-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-800 inline-block"></span>
                    <span className="text-xs font-medium text-fuchsia-300/80">
                      Unused / Free Time:
                    </span>
                  </div>
                  <span className="text-xs font-bold text-fuchsia-300/80">
                    {formatDurationHuman(item.unusedSec, 'en')}
                  </span>
                </div>

                {/* Comparative Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                    <span className="text-cyan-300">
                      Focus: {item.focusPercent}%
                    </span>
                    <span className="text-fuchsia-400/80">
                      Unused: {item.unusedPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0d0221] overflow-hidden flex border border-fuchsia-800/60">
                    <div
                      style={{ width: `${item.focusPercent}%` }}
                      className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all duration-300"
                      title="Focus Time"
                    />
                    <div
                      style={{ width: `${item.unusedPercent}%` }}
                      className="h-full bg-fuchsia-950 transition-all duration-300"
                      title="Unused Time"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show More / Show Less Toggle Button */}
          {dailyData.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllDays(!showAllDays)}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#150533] hover:bg-[#1f0947] border border-fuchsia-700/60 text-fuchsia-200 text-xs font-bold transition flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(217,70,239,0.15)] hover:border-fuchsia-500 cursor-pointer"
            >
              {showAllDays ? (
                <>
                  <span>Show Less</span>
                  <ChevronUp className="w-4 h-4 text-cyan-300" />
                </>
              ) : (
                <>
                  <span>Show More ({dailyData.length - 3} older days)</span>
                  <ChevronDown className="w-4 h-4 text-cyan-300" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDeleteDate && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#120326] border border-rose-600/50 text-fuchsia-100 rounded-2xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(225,29,72,0.3)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-fuchsia-900/60">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-fuchsia-100">تایید حذف داده‌های روز</h3>
              </div>
              <button
                onClick={() => setConfirmDeleteDate(null)}
                className="text-fuchsia-400 hover:text-white p-1 rounded-lg hover:bg-fuchsia-900/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-fuchsia-200 mb-6 leading-relaxed">
              آیا از پاک کردن تمامی داده‌ها و زمان‌های ثبت‌شده برای روز{' '}
              <span className="font-extrabold text-cyan-300 dir-ltr inline-block">
                {formatShamsiDate(confirmDeleteDate)} ({confirmDeleteDate})
              </span>{' '}
              اطمینان دارید؟
              <br />
              <span className="text-xs text-fuchsia-400 mt-2 block">
                با تایید این عملیات، داده‌های این روز از لیست تاریخچه حذف شده و زمان متناظر از مجموع زمان‌های تمرکز و غیرفعال کسر می‌گردد.
              </span>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteDate(null)}
                className="px-4 py-2.5 rounded-xl bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-800 text-fuchsia-200 text-sm font-bold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearDay && confirmDeleteDate) {
                    onClearDay(confirmDeleteDate);
                  }
                  setConfirmDeleteDate(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition shadow-[0_0_15px_rgba(225,29,72,0.4)] flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
});
