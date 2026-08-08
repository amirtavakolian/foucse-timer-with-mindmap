import React, { useState } from 'react';
import { Clock, Calendar, Zap, Info, ChevronRight, ChevronLeft, Trash2, CheckCircle2, Coffee, Filter, Hourglass } from 'lucide-react';
import { AppSettings, FocusSession, HourFocusData } from '../types';
import { calculate24HourBreakdown, formatDurationHuman, formatHourLabel, formatShamsiDate, generateDayIntervals, getTodayDateStr, toPersianDigits, TimeIntervalRecord } from '../utils/time';

interface Timeline24hProps {
  settings: AppSettings;
  selectedDateStr: string;
  onChangeDateStr: (dateStr: string) => void;
  sessions: FocusSession[];
  activeSession: { startTime: number; elapsedSeconds: number } | null;
  onClearDay: (dateStr: string) => void;
}

export const Timeline24h: React.FC<Timeline24hProps> = ({
  settings,
  selectedDateStr,
  onChangeDateStr,
  sessions,
  activeSession,
  onClearDay,
}) => {
  const todayStr = getTodayDateStr();
  const isToday = selectedDateStr === todayStr;

  const [intervalFilter, setIntervalFilter] = useState<'all' | 'focus' | 'idle'>('all');

  // Filter sessions for selected date
  const daySessions = sessions.filter((s) => s.dateStr === selectedDateStr);

  // Calculate 24-hour hour blocks data
  const hoursData = calculate24HourBreakdown(selectedDateStr, daySessions, activeSession);

  // Generate exact minute-by-minute continuous interval log (Focus & Idle)
  const intervals = generateDayIntervals(selectedDateStr, daySessions, activeSession, false);

  // Filter intervals based on selected tab
  const filteredIntervals = intervals.filter((item) => {
    if (intervalFilter === 'focus') return item.type === 'focus';
    if (intervalFilter === 'idle') return item.type === 'idle';
    return true;
  });

  // Total seconds worked today
  const totalFocusSeconds = hoursData.reduce((acc, h) => acc + h.focusSeconds, 0);

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
    <div className="w-full max-w-5xl mx-auto mt-8 p-6 sm:p-8 rounded-3xl bg-[#0d0221]/90 border border-fuchsia-500/40 shadow-[0_0_35px_rgba(217,70,239,0.18)] backdrop-blur-xl">
      {/* Header & Date Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-fuchsia-900/50">
        <div>
          <h2 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 flex items-center gap-2">
            <Clock className="w-5 h-5 text-fuchsia-400" />
            <span>Exact Minute-by-Minute Focus & Idle Timeline</span>
          </h2>
          <p className="text-xs text-fuchsia-300/80 mt-1">
            Detailed breakdown showing exact start and end times for focused vs non-focused gaps.
          </p>
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

          {daySessions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear logs for this day?')) {
                  onClearDay(selectedDateStr);
                }
              }}
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
        </div>

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

                        {isFocus && item.taskName && (
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

                  {/* Right: Duration pill */}
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

