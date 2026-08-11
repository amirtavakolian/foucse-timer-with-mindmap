import React, { useState } from 'react';
import { Clock, Calendar, Zap, Info, ChevronRight, ChevronLeft, Trash2, CheckCircle2, Coffee, Filter, Hourglass, Plus, X, Check, BarChart2, AlertTriangle, GitCompare } from 'lucide-react';
import { AppSettings, FocusSession, HourFocusData } from '../types';
import { calculate24HourBreakdown, formatDurationHuman, formatHourLabel, formatShamsiDate, generateDayIntervals, getTodayDateStr, toPersianDigits, TimeIntervalRecord } from '../utils/time';
import { getExactIntervalReportForDate, saveIntervalReportForDate, clearIntervalReportForDate } from '../utils/storage';
import { IntervalChartModal } from './IntervalChartModal';
import { CompareModal } from './CompareModal';

interface Timeline24hProps {
  settings: AppSettings;
  selectedDateStr: string;
  onChangeDateStr: (dateStr: string) => void;
  sessions: FocusSession[];
  activeSession: { startTime: number; elapsedSeconds: number } | null;
  onClearDay: (dateStr: string) => void;
  onAddSession?: (session: FocusSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  clearedDates?: string[];
}

export const Timeline24h: React.FC<Timeline24hProps> = React.memo(({
  settings,
  selectedDateStr,
  onChangeDateStr,
  sessions,
  activeSession,
  onClearDay,
  onAddSession,
  onDeleteSession,
  clearedDates = [],
}) => {
  const todayStr = getTodayDateStr();
  const isToday = selectedDateStr === todayStr;

  const [intervalFilter, setIntervalFilter] = useState<'all' | 'focus' | 'idle'>('all');
  const [showChartModal, setShowChartModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [confirmClearDay, setConfirmClearDay] = useState(false);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  // Manual interval form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('09:00');
  const [endTimeInput, setEndTimeInput] = useState('10:00');
  const [intervalType, setIntervalType] = useState<'focus' | 'idle'>('focus');
  const [taskNameInput, setTaskNameInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filter sessions for selected date
  const daySessions = sessions.filter((s) => s.dateStr === selectedDateStr);

  // Calculate 24-hour hour blocks data
  const hoursData = calculate24HourBreakdown(selectedDateStr, daySessions, activeSession);

  // Generate exact minute-by-minute continuous interval log (Focus & Idle) reading from JSON storage
  const intervals = getExactIntervalReportForDate(selectedDateStr, daySessions, activeSession, false);

  // Filter intervals based on selected tab
  const filteredIntervals = intervals.filter((item) => {
    if (intervalFilter === 'focus') return item.type === 'focus';
    if (intervalFilter === 'idle') return item.type === 'idle';
    return true;
  });

  // Handle manual interval submission
  const handleAddIntervalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!startTimeInput || !endTimeInput) {
      setFormError('لطفاً زمان شروع و پایان را وارد کنید');
      return;
    }

    const [sH, sM] = startTimeInput.split(':').map(Number);
    const [eH, eM] = endTimeInput.split(':').map(Number);

    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) {
      setFormError('فرمت زمان وارد شده نامعتبر است');
      return;
    }

    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const startMs = new Date(year, month - 1, day, sH, sM, 0, 0).getTime();
    const endMs = new Date(year, month - 1, day, eH, eM, 0, 0).getTime();

    if (endMs <= startMs) {
      setFormError('ساعت پایان باید بعد از ساعت شروع باشد');
      return;
    }

    const durationSec = Math.round((endMs - startMs) / 1000);

    const newSession: FocusSession = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      startTime: startMs,
      endTime: endMs,
      durationSeconds: durationSec,
      elapsedSeconds: durationSec,
      completed: true,
      dateStr: selectedDateStr,
      taskName: taskNameInput.trim() || (intervalType === 'focus' ? 'ثبت دستی تمرکز' : 'ثبت دستی استراحت'),
      sessionType: intervalType,
    };

    if (onAddSession) {
      onAddSession(newSession);
    }

    const updatedSessions = [...daySessions, newSession];
    const newIntervals = generateDayIntervals(selectedDateStr, updatedSessions, activeSession, false);
    saveIntervalReportForDate(selectedDateStr, newIntervals);

    setShowAddForm(false);
    setTaskNameInput('');
    setFormError(null);
  };

  // Total seconds worked today directly from intervals
  const totalFocusSeconds = intervals
    .filter((i) => i.type === 'focus')
    .reduce((acc, i) => acc + i.durationSeconds, 0);

  // Find peak hour
  const peakHourObj = [...hoursData].sort((a, b) => b.focusSeconds - a.focusSeconds)[0];
  const peakHourText = peakHourObj && peakHourObj.focusSeconds > 0
    ? `${formatHourLabel(peakHourObj.hour, false)} - ${formatHourLabel((peakHourObj.hour + 1) % 24, false)}`
    : 'None yet';

  // Navigate dates
  const handlePrevDay = () => {
    const current = new Date(selectedDateStr);
    current.setDate(current.getDate() - 1);
    const y = current.getFullYear();
    const m = (current.getMonth() + 1).toString().padStart(2, '0');
    const d = current.getDate().toString().padStart(2, '0');
    onChangeDateStr(`${y}-${m}-${d}`);
  };

  const handleNextDay = () => {
    const current = new Date(selectedDateStr);
    current.setDate(current.getDate() + 1);
    const y = current.getFullYear();
    const m = (current.getMonth() + 1).toString().padStart(2, '0');
    const d = current.getDate().toString().padStart(2, '0');
    if (`${y}-${m}-${d}` <= todayStr) {
      onChangeDateStr(`${y}-${m}-${d}`);
    }
  };

  return (
    <div className="w-full p-6 sm:p-8 rounded-3xl bg-[#0d0221] border border-fuchsia-500/40 shadow-[0_0_25px_rgba(217,70,239,0.12)]">
      {/* Header & Date Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-fuchsia-900/50">
        <div>
          <h2 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 flex items-center gap-2">
            <Clock className="w-5 h-5 text-fuchsia-400" />
            <span>Focus & Idle Timeline</span>
          </h2>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-xl bg-[#150533] hover:bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-800/60 transition"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3.5 py-1.5 rounded-xl bg-[#150533] border border-fuchsia-700/60 text-xs font-bold text-fuchsia-200 flex items-center gap-1.5 shadow-[0_0_10px_rgba(217,70,239,0.15)]">
            <Calendar className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>{isToday ? `Today (${formatShamsiDate(selectedDateStr)})` : formatShamsiDate(selectedDateStr)}</span>
          </div>

          <button
            onClick={handleNextDay}
            disabled={isToday}
            className="p-2 rounded-xl bg-[#150533] hover:bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-800/60 disabled:opacity-40 transition"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && daySessions.length > 0 && (
            <button
              onClick={() => setConfirmClearDay(true)}
              className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 transition border border-rose-800/60 shadow-[0_0_10px_rgba(225,29,72,0.2)]"
              title="Clear Day"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        {/* Card 1: Total Focus */}
        <div className="p-4 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-950/80 border border-fuchsia-700/60 flex items-center justify-center text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.2)]">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wider">Total Focus Today:</div>
            <div className="text-base font-extrabold text-fuchsia-100 mt-0.5">
              {formatDurationHuman(totalFocusSeconds, 'en')}
            </div>
          </div>
        </div>

        {/* Card 2: Peak Hour */}
        <div className="p-4 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-950/80 border border-fuchsia-700/60 flex items-center justify-center text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.2)]">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wider">Peak Focus Hour:</div>
            <div className="text-base font-extrabold text-fuchsia-100 mt-0.5">
              {peakHourText}
            </div>
          </div>
        </div>

        {/* Card 3: Session count */}
        <div className="p-4 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-950/80 border border-fuchsia-700/60 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wider">Recorded Focus Sessions:</div>
            <div className="text-base font-extrabold text-fuchsia-100 mt-0.5">
              {daySessions.length} sessions
            </div>
          </div>
        </div>
      </div>

      {/* EXACT MINUTE-BY-MINUTE TIME INTERVAL REPORT */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#150533]/60 border border-fuchsia-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-fuchsia-900/50">
          <div>
            <h3 className="text-base font-extrabold text-fuchsia-100 flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-fuchsia-400" />
              <span>Exact Time Interval Report (HH:MM)</span>
            </h3>
            <p className="text-xs text-fuchsia-300/80 mt-0.5">
              Exact start & end minute markers for each focused and unfocused period.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0d0221] border border-fuchsia-800/60 text-xs font-bold">
              <button
                onClick={() => setIntervalFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  intervalFilter === 'all'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setIntervalFilter('focus')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  intervalFilter === 'focus'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_#22d3ee]"></span>
                <span>Focus</span>
              </button>
              <button
                onClick={() => setIntervalFilter('idle')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  intervalFilter === 'idle'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                <span>Unfocused</span>
              </button>
            </div>

            {/* Action Buttons: View Chart, Compare & Add Manual Interval */}
            <div className="flex items-center gap-2 flex-nowrap">
              <button
                onClick={() => setShowChartModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-bold transition shadow-[0_0_12px_rgba(217,70,239,0.3)] shrink-0 cursor-pointer"
              >
                <BarChart2 className="w-4 h-4" />
                <span>نمودار بازه‌ها</span>
              </button>

              <button
                onClick={() => setShowCompareModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition shadow-[0_0_12px_rgba(34,211,238,0.3)] shrink-0 cursor-pointer"
              >
                <GitCompare className="w-4 h-4" />
                <span>مقایسه</span>
              </button>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white text-xs font-bold transition shadow-[0_0_12px_rgba(34,211,238,0.3)] shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن بازه زمانی</span>
              </button>
            </div>
          </div>
        </div>

        {/* Manual Time Interval Creation Form */}
        {showAddForm && (
          <form onSubmit={handleAddIntervalSubmit} dir="rtl" className="my-4 p-4 sm:p-5 rounded-2xl bg-[#0d0221] border border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.15)] space-y-4">
            <div className="flex items-center justify-between border-b border-fuchsia-900/40 pb-3">
              <h4 className="text-sm font-extrabold text-cyan-300 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>افزودن بازه زمانی جدید</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-fuchsia-400 hover:text-fuchsia-200 transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-600/60 text-rose-200 text-xs font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-fuchsia-300 block">از ساعت (شروع):</label>
                <input
                  type="time"
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#150533] border border-fuchsia-700/60 text-cyan-300 font-mono text-sm outline-none focus:border-cyan-400"
                  required
                />
              </div>

              {/* End Time */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-fuchsia-300 block">تا ساعت (پایان):</label>
                <input
                  type="time"
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#150533] border border-fuchsia-700/60 text-cyan-300 font-mono text-sm outline-none focus:border-cyan-400"
                  required
                />
              </div>
            </div>

            {/* Type Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-fuchsia-300 block">نوع بازه زمانی:</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIntervalType('focus')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                    intervalType === 'focus'
                      ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.3)]'
                      : 'bg-[#150533] text-fuchsia-300 border-fuchsia-900/60 hover:border-fuchsia-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                  <span>تمرکز (Focus)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIntervalType('idle')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                    intervalType === 'idle'
                      ? 'bg-amber-950 text-amber-200 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'bg-[#150533] text-fuchsia-300 border-fuchsia-900/60 hover:border-fuchsia-700'
                  }`}
                >
                  <Coffee className="w-4 h-4 text-amber-400" />
                  <span>غیر تمرکز / استراحت (Idle)</span>
                </button>
              </div>
            </div>

            {/* Task / Description Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-fuchsia-300 block">عنوان یا توضیحات (اختیاری):</label>
              <input
                type="text"
                dir="rtl"
                placeholder="مثال: مطالعه کتاب، کار روی پروژه، ناهاری..."
                value={taskNameInput}
                onChange={(e) => setTaskNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#150533] border border-fuchsia-700/60 text-fuchsia-100 text-xs outline-none focus:border-cyan-400 placeholder-fuchsia-400/40"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-fuchsia-900/40">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold transition border border-rose-800/60"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold transition shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>ثبت بازه زمانی</span>
              </button>
            </div>
          </form>
        )}

        {/* Intervals List */}
        <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredIntervals.length === 0 ? (
            <div className="text-center py-8 text-xs text-fuchsia-400/80">
              No intervals found for this filter.
            </div>
          ) : (
            filteredIntervals.map((item) => {
              const isFocus = item.type === 'focus';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isFocus
                      ? 'bg-[#1a073d]/90 border-fuchsia-600/60 shadow-[0_0_15px_rgba(217,70,239,0.15)]'
                      : 'bg-[#12042b]/60 border-fuchsia-900/40'
                  }`}
                >
                  {/* Left: Type badge & Time Range */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isFocus
                          ? 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-600/60 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                          : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                      }`}
                    >
                      {isFocus ? <CheckCircle2 className="w-5 h-5 text-cyan-300" /> : <Coffee className="w-5 h-5 text-amber-400" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md ${
                            isFocus
                              ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                          }`}
                        >
                          {isFocus ? 'Focused' : 'Not Focused / Idle'}
                        </span>

                        {item.taskName && (
                          <span className="text-xs font-bold text-fuchsia-200">
                            ({item.taskName})
                          </span>
                        )}
                      </div>

                      {/* Time interval exact HH:MM display */}
                      <div className="mt-1.5 flex items-center gap-2 text-xs font-bold text-fuchsia-200 dir-ltr">
                        <span className="font-mono bg-[#0d0221] px-2 py-0.5 rounded-lg border border-fuchsia-700/60 text-cyan-300">
                          {item.startTimeStr}
                        </span>
                        <span className="text-fuchsia-400">➔</span>
                        <span className="font-mono bg-[#0d0221] px-2 py-0.5 rounded-lg border border-fuchsia-700/60 text-cyan-300">
                          {item.endTimeStr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Duration pill & optional Delete button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-fuchsia-800/50">
                    <span className="text-xs text-fuchsia-300/80 font-bold uppercase tracking-wider">
                      Duration:
                    </span>
                    <span
                      className={`text-xs font-extrabold px-3 py-1 rounded-xl ${
                        isFocus
                          ? 'bg-fuchsia-950/80 text-fuchsia-100 border border-fuchsia-600/60 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                          : 'bg-[#0d0221] text-fuchsia-300 border border-fuchsia-900/60'
                      }`}
                    >
                      {formatDurationHuman(item.durationSeconds, 'en')}
                    </span>

                    {item.sessionId && onDeleteSession && (
                      <button
                        onClick={() => setConfirmDeleteSessionId(item.sessionId!)}
                        className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition shadow-[0_0_8px_rgba(225,29,72,0.2)] ml-1"
                        title="حذف این بازه زمانی"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Interval Chart Modal */}
      <IntervalChartModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        selectedDateStr={selectedDateStr}
        intervals={intervals}
      />

      {/* Compare Modal */}
      <CompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        sessions={sessions}
        activeSession={activeSession}
        clearedDates={clearedDates}
      />

      {/* Clear Day Confirmation Modal */}
      {confirmClearDay && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#120326] border border-rose-600/50 text-fuchsia-100 rounded-2xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(225,29,72,0.3)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-fuchsia-900/60">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-fuchsia-100">تایید حذف داده‌های این روز</h3>
              </div>
              <button
                onClick={() => setConfirmClearDay(false)}
                className="text-fuchsia-400 hover:text-white p-1 rounded-lg hover:bg-fuchsia-900/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-fuchsia-200 mb-6 leading-relaxed">
              آیا از حذف تمام داده‌ها و جلسات ثبت‌شده برای روز{' '}
              <span className="font-extrabold text-cyan-300 dir-ltr inline-block">
                {formatShamsiDate(selectedDateStr)} ({selectedDateStr})
              </span>{' '}
              اطمینان دارید؟
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearDay(false)}
                className="px-4 py-2.5 rounded-xl bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-800 text-fuchsia-200 text-sm font-bold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  clearIntervalReportForDate(selectedDateStr);
                  onClearDay(selectedDateStr);
                  setConfirmClearDay(false);
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

      {/* Delete Session Confirmation Modal */}
      {confirmDeleteSessionId && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#120326] border border-rose-600/50 text-fuchsia-100 rounded-2xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(225,29,72,0.3)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-fuchsia-900/60">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-fuchsia-100">تایید حذف بازه زمانی</h3>
              </div>
              <button
                onClick={() => setConfirmDeleteSessionId(null)}
                className="text-fuchsia-400 hover:text-white p-1 rounded-lg hover:bg-fuchsia-900/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-fuchsia-200 mb-6 leading-relaxed">
              آیا از حذف این بازه زمانی مشخص اطمینان دارید؟
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteSessionId(null)}
                className="px-4 py-2.5 rounded-xl bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-800 text-fuchsia-200 text-sm font-bold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSession && confirmDeleteSessionId) {
                    onDeleteSession(confirmDeleteSessionId);
                  }
                  setConfirmDeleteSessionId(null);
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
    </div>
  );
});

