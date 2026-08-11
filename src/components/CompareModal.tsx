import React, { useState } from 'react';
import {
  X,
  BarChart2,
  Clock,
  CheckCircle2,
  Coffee,
  PieChart,
  GitCompare,
  Calendar,
  Check,
  Layers,
  Filter,
  Columns,
  List,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from 'recharts';
import { FocusSession } from '../types';
import { formatDurationHuman, formatShamsiDate, getTodayDateStr, getAllTrackedDates, toPersianDigits } from '../utils/time';
import { getInitialStartDate, getExactIntervalReportForDate } from '../utils/storage';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: FocusSession[];
  activeSession: { startTime: number; elapsedSeconds: number } | null;
  clearedDates?: string[];
}

type CompareTabType = 'hourly' | 'timeline' | 'sequential' | 'all';
type LayoutModeType = 'grid' | 'list';

// Sub-component to render a single day's charts based on activeTab and layout
const SingleDayChartsView: React.FC<{
  dateStr: string;
  sessions: FocusSession[];
  activeSession: { startTime: number; elapsedSeconds: number } | null;
  clearedDates: string[];
  todayStr: string;
  activeTab: CompareTabType;
  layoutMode: LayoutModeType;
}> = ({ dateStr, sessions, activeSession, clearedDates, todayStr, activeTab }) => {
  const daySessions = sessions.filter((s) => s.dateStr === dateStr);
  const intervals = getExactIntervalReportForDate(dateStr, daySessions, activeSession, false, clearedDates);

  // Calculate metrics
  const totalFocusSec = intervals
    .filter((i) => i.type === 'focus')
    .reduce((acc, i) => acc + i.durationSeconds, 0);

  const totalIdleSec = intervals
    .filter((i) => i.type === 'idle')
    .reduce((acc, i) => acc + i.durationSeconds, 0);

  const grandTotalSec = totalFocusSec + totalIdleSec;
  const focusPercentage = grandTotalSec > 0 ? Math.round((totalFocusSec / grandTotalSec) * 100) : 0;

  // Prepare Hourly Data (00:00 to 23:00)
  const hourlyMap: { [hour: number]: { focusMins: number; idleMins: number } } = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = { focusMins: 0, idleMins: 0 };
  }

  intervals.forEach((interval) => {
    const [startH, startM] = interval.startTimeStr.split(':').map(Number);
    const [endH, endM] = interval.endTimeStr.split(':').map(Number);

    let curStartMs = startH * 3600 + startM * 60;
    const curEndMs = endH === 0 && endM === 0 && (startH > 0 || startM > 0) ? 24 * 3600 : endH * 3600 + endM * 60;

    for (let h = 0; h < 24; h++) {
      const hStart = h * 3600;
      const hEnd = (h + 1) * 3600;

      const overlapStart = Math.max(curStartMs, hStart);
      const overlapEnd = Math.min(curEndMs, hEnd);

      if (overlapEnd > overlapStart) {
        const overlapMins = Math.ceil((overlapEnd - overlapStart) / 60);
        if (interval.type === 'focus') {
          hourlyMap[h].focusMins += overlapMins;
        } else {
          hourlyMap[h].idleMins += overlapMins;
        }
      }
    }
  });

  const hourlyChartData = Object.keys(hourlyMap).map((hStr) => {
    const h = Number(hStr);
    const hourFormatted = `${h.toString().padStart(2, '0')}:00`;
    return {
      hourLabel: hourFormatted,
      focusMins: Math.min(60, hourlyMap[h].focusMins),
      idleMins: Math.min(60, hourlyMap[h].idleMins),
    };
  });

  // Sequential Intervals Data
  const sequentialChartData = intervals.map((interval, index) => {
    const mins = Math.ceil(interval.durationSeconds / 60);
    const hours = (interval.durationSeconds / 3600).toFixed(1);
    return {
      id: interval.id || `interval_${index}`,
      index: index + 1,
      rangeLabel: `${interval.startTimeStr} - ${interval.endTimeStr}`,
      startTime: interval.startTimeStr,
      endTime: interval.endTimeStr,
      durationMins: mins,
      durationHours: Number(hours),
      durationHuman: formatDurationHuman(interval.durationSeconds, 'en'),
      type: interval.type,
      typeName: interval.type === 'focus' ? 'Focus (تمرکز)' : 'Idle (استراحت)',
      taskName: interval.taskName || (interval.type === 'focus' ? 'تمرکز' : 'استراحت'),
      fillColor: interval.type === 'focus' ? '#06b6d4' : '#f59e0b',
    };
  });

  // Pie Data
  const pieData = [
    { name: 'تمرکز (Focus)', value: Math.ceil(totalFocusSec / 60), color: '#06b6d4' },
    { name: 'استراحت (Idle)', value: Math.ceil(totalIdleSec / 60), color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  // Shamsi date label
  const shamsiLabel = formatShamsiDate(dateStr);
  const isToday = dateStr === todayStr;

  // Custom Hourly Tooltip
  const CustomHourlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const focusValue = payload.find((p: any) => p.dataKey === 'focusMins')?.value || 0;
      const idleValue = payload.find((p: any) => p.dataKey === 'idleMins')?.value || 0;
      return (
        <div className="p-2.5 bg-[#0d0221] border border-fuchsia-500/80 rounded-xl shadow-xl text-xs space-y-1 font-sans dir-rtl z-50">
          <p className="font-extrabold text-cyan-300 border-b border-fuchsia-800/60 pb-1 flex items-center justify-between gap-3">
            <span>ساعت: {label}</span>
            <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
          </p>
          <p className="text-cyan-400 font-bold flex items-center justify-between gap-3">
            <span>تمرکز:</span>
            <span className="font-mono bg-fuchsia-950 px-1.5 py-0.5 rounded border border-fuchsia-800">
              {focusValue} دقیقه
            </span>
          </p>
          <p className="text-amber-400 font-bold flex items-center justify-between gap-3">
            <span>استراحت:</span>
            <span className="font-mono bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800">
              {idleValue} دقیقه
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Interval Tooltip
  const CustomIntervalTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-2.5 bg-[#0d0221] border border-cyan-500/80 rounded-xl shadow-xl text-xs space-y-1 font-sans dir-rtl z-50">
          <p className="font-extrabold text-fuchsia-200 border-b border-fuchsia-800/60 pb-1 flex items-center justify-between gap-3">
            <span>بازه #{data.index}: {data.taskName}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                data.type === 'focus' ? 'bg-cyan-950 text-cyan-300 border border-cyan-600' : 'bg-amber-950 text-amber-300 border border-amber-600'
              }`}
            >
              {data.typeName}
            </span>
          </p>
          <p className="text-cyan-300 font-bold flex items-center justify-between gap-3">
            <span>زمان بازه:</span>
            <span className="font-mono">{data.rangeLabel}</span>
          </p>
          <p className="text-fuchsia-300 font-bold flex items-center justify-between gap-3">
            <span>مدت:</span>
            <span className="font-mono">{data.durationMins} دقیقه ({data.durationHuman})</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#12042b]/95 border border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.12)] space-y-3 dir-rtl flex flex-col h-full min-h-0">
      {/* Day Header Banner (Compact & High Contrast) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gradient-to-r from-[#1c073f] via-[#12042b] to-[#1c073f] border border-fuchsia-600/40 shadow-inner shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-fuchsia-950/80 border border-fuchsia-500 flex items-center justify-center text-cyan-300 shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-extrabold text-cyan-300">
                {shamsiLabel}
              </h4>
              {isToday && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-600">
                  امروز
                </span>
              )}
            </div>
            <p className="text-[10px] text-fuchsia-300/70 font-mono">
              {dateStr}
            </p>
          </div>
        </div>

        {/* Compact Badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-bold">
          <div className="px-2 py-0.5 rounded-lg bg-[#0d0221] border border-cyan-500/40 text-cyan-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>تمرکز: {formatDurationHuman(totalFocusSec, 'en')}</span>
          </div>
          <div className="px-2 py-0.5 rounded-lg bg-[#0d0221] border border-amber-500/40 text-amber-300 flex items-center gap-1">
            <Coffee className="w-3 h-3 text-amber-400" />
            <span>استراحت: {formatDurationHuman(totalIdleSec, 'en')}</span>
          </div>
          <div className="px-2 py-0.5 rounded-lg bg-[#0d0221] border border-fuchsia-500/40 text-fuchsia-300 flex items-center gap-1 font-mono">
            <span>درصد: {focusPercentage}%</span>
          </div>
        </div>
      </div>

      {/* ----------------- CHART 1: HOURLY BREAKDOWN ----------------- */}
      {(activeTab === 'hourly' || activeTab === 'all') && (
        <div className="p-3 rounded-xl bg-[#0d0221]/90 border border-fuchsia-800/60 space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between text-xs font-extrabold text-cyan-300 shrink-0">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>نمودار ساعتی (24h)</span>
            </span>
            <span className="text-[10px] text-fuchsia-400/80 font-normal">بر حسب دقیقه</span>
          </div>

          <div className="w-full flex-1 min-h-[200px] p-2 rounded-lg bg-[#150533]/80 border border-fuchsia-900/60 dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="hourLabel" stroke="#c084fc" fontSize={9} tickLine={false} interval={2} />
                <YAxis stroke="#c084fc" fontSize={9} tickLine={false} domain={[0, 60]} ticks={[0, 20, 40, 60]} />
                <Tooltip content={<CustomHourlyTooltip />} />
                <Bar dataKey="focusMins" name="تمرکز" fill="#06b6d4" stackId="a" />
                <Bar dataKey="idleMins" name="استراحت" fill="#f59e0b" stackId="a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ----------------- CHART 2: CONTINUOUS TIMELINE RIBBON ----------------- */}
      {(activeTab === 'timeline' || activeTab === 'all') && (
        <div className="p-3 rounded-xl bg-[#0d0221]/90 border border-fuchsia-800/60 space-y-2 flex-1 flex flex-col justify-center min-h-0">
          <div className="flex items-center justify-between text-xs font-extrabold text-cyan-300 shrink-0">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>خط زمانی ۲۴ ساعته</span>
            </span>
            <span className="text-[10px] text-fuchsia-400/80 font-normal">پیوسته</span>
          </div>

          <div className="p-3 rounded-lg bg-[#150533]/90 border border-fuchsia-800/70 space-y-2 flex-1 flex flex-col justify-center">
            <div className="relative w-full h-16 sm:h-20 bg-[#0d0221] rounded-lg border border-fuchsia-900/80 overflow-hidden flex items-center shadow-inner">
              {intervals.map((item, idx) => {
                const [sH, sM] = item.startTimeStr.split(':').map(Number);
                const [eH, eM] = item.endTimeStr.split(':').map(Number);
                const startMin = sH * 60 + sM;
                let endMin = eH * 60 + eM;
                if (endMin === 0 && startMin > 0) endMin = 1440;

                const leftPct = (startMin / 1440) * 100;
                const widthPct = Math.max(0.5, ((endMin - startMin) / 1440) * 100);

                return (
                  <div
                    key={item.id || idx}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    className={`absolute h-full transition-all duration-200 cursor-pointer hover:z-20 hover:brightness-125 border-r border-black/40 ${
                      item.type === 'focus'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_6px_rgba(6,182,212,0.4)]'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 opacity-90'
                    }`}
                    title={`${item.taskName || item.type}: ${item.startTimeStr} - ${item.endTimeStr} (${Math.ceil(item.durationSeconds / 60)} دقیقه)`}
                  />
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] font-mono font-bold text-fuchsia-300/80 px-1 dir-ltr">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- CHART 3: INDIVIDUAL INTERVALS COMPARISON ----------------- */}
      {(activeTab === 'sequential' || activeTab === 'all') && (
        <div className="p-3 rounded-xl bg-[#0d0221]/90 border border-fuchsia-800/60 space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between text-xs font-extrabold text-cyan-300 shrink-0">
            <span className="flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-cyan-400" />
              <span>بازه‌های جداگانه و سهم کل</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-h-0">
            <div className="sm:col-span-2 h-full flex-1 min-h-[200px] p-1.5 rounded-lg bg-[#150533]/80 border border-fuchsia-900/60 dir-ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sequentialChartData} margin={{ top: 10, right: 0, left: -25, bottom: 10 }}>
                  <XAxis dataKey="startTime" stroke="#c084fc" fontSize={8} tickLine={false} />
                  <YAxis stroke="#c084fc" fontSize={8} tickLine={false} />
                  <Tooltip content={<CustomIntervalTooltip />} />
                  <Bar dataKey="durationMins" name="مدت زمان (دقیقه)">
                    {sequentialChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fillColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2 rounded-lg bg-[#150533]/80 border border-fuchsia-900/60 flex flex-col items-center justify-center h-full flex-1 min-h-[180px]">
              <h6 className="text-[10px] font-extrabold text-fuchsia-200 mb-1 shrink-0">تمرکز vs استراحت</h6>
              <div className="w-full flex-1 min-h-0 dir-ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center text-[10px] font-extrabold text-cyan-300 font-mono shrink-0 mt-1">
                {focusPercentage}% تمرکز
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSession,
  clearedDates = [],
}) => {
  const initialStartDate = getInitialStartDate();
  const todayStr = getTodayDateStr();

  // All dates tracked in daily summary breakdown
  const dateList = getAllTrackedDates(sessions, initialStartDate, clearedDates);

  // Selected dates state (default: pre-select up to 2 most recent dates)
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    return dateList.slice(0, 2);
  });

  // Default active tab is 'hourly' as requested
  const [activeTab, setActiveTab] = useState<CompareTabType>('hourly');

  // Layout mode state: default to 'grid' (side-by-side)
  const [layoutMode, setLayoutMode] = useState<LayoutModeType>('grid');

  // Date selection filter collapse toggle (default to collapsed so charts take max height)
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  if (!isOpen) return null;

  // Toggle date selection
  const toggleDate = (dStr: string) => {
    if (selectedDates.includes(dStr)) {
      setSelectedDates(selectedDates.filter((d) => d !== dStr));
    } else {
      setSelectedDates([...selectedDates, dStr]);
    }
  };

  // Quick Action Handlers
  const handleSelectAll = () => setSelectedDates([...dateList]);
  const handleDeselectAll = () => setSelectedDates([]);
  const handleSelectRecent = (count: number) => setSelectedDates(dateList.slice(0, count));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black/95 backdrop-blur-md animate-fade-in">
      {/* Full screen / full frame modal box */}
      <div className="relative w-full h-full flex flex-col bg-[#0d0221] border-0 text-fuchsia-100 overflow-hidden">
        
        {/* Compact Top Header */}
        <div className="px-3 py-2 sm:px-6 sm:py-2.5 border-b border-fuchsia-900/60 flex items-center justify-between gap-3 bg-gradient-to-r from-[#150533] via-[#0d0221] to-[#1a053f] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-950/90 border border-cyan-500/80 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.3)] shrink-0">
              <GitCompare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300">
                مقایسه همزمان نمودارهای روزانه
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-[#150533] hover:bg-rose-950/80 text-fuchsia-300 hover:text-rose-200 border border-fuchsia-800/60 hover:border-rose-600/60 transition shadow-md cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Main Body (Scrollable Charts Area) */}
        <div className="px-3 sm:px-6 py-2.5 overflow-y-auto flex-1 space-y-3 dir-rtl flex flex-col min-h-0">
          
          {/* Top Collapsible Date Selection Controls */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-[#150533]/90 border border-fuchsia-800/70 space-y-2 shrink-0 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 text-xs font-extrabold text-cyan-300 hover:text-cyan-200 transition cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  انتخاب روزهای مقایسه ({toPersianDigits(selectedDates.length)} از {toPersianDigits(dateList.length)} روز انتخاب شده)
                </span>
                {isFilterOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />}
              </button>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleSelectRecent(2)}
                  className="px-2 py-0.5 rounded-md bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-700/60 text-[10px] font-bold text-fuchsia-200 transition cursor-pointer"
                >
                  ۲ روز اخیر
                </button>
                <button
                  onClick={() => handleSelectRecent(3)}
                  className="px-2 py-0.5 rounded-md bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-700/60 text-[10px] font-bold text-fuchsia-200 transition cursor-pointer"
                >
                  ۳ روز اخیر
                </button>
                <button
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 rounded-md bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-[10px] font-bold text-cyan-200 transition cursor-pointer"
                >
                  همه
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-2 py-0.5 rounded-md bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-[10px] font-bold text-rose-200 transition cursor-pointer"
                >
                  لغو
                </button>
              </div>
            </div>

            {/* Date Badges Grid */}
            {isFilterOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 border-t border-fuchsia-900/50">
                {dateList.map((dStr) => {
                  const isSelected = selectedDates.includes(dStr);
                  const shamsi = formatShamsiDate(dStr);
                  const isToday = dStr === todayStr;

                  return (
                    <button
                      key={dStr}
                      onClick={() => toggleDate(dStr)}
                      className={`p-2 rounded-lg border text-[11px] font-bold transition flex items-center justify-between gap-1.5 cursor-pointer text-right ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-950 via-[#150533] to-fuchsia-950 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.25)]'
                          : 'bg-[#0d0221]/80 hover:bg-[#1a073d] border-fuchsia-900/60 text-fuchsia-300/70 hover:text-fuchsia-100'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate">
                        <span className="truncate flex items-center gap-1">
                          {shamsi}
                          {isToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 inline-block"></span>
                          )}
                        </span>
                        <span className="text-[9px] text-fuchsia-400/60 font-mono font-normal">
                          {dStr}
                        </span>
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                            : 'border-fuchsia-800/60 bg-[#0d0221]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Render Day Charts for Selected Dates */}
          {selectedDates.length === 0 ? (
            <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center p-8 rounded-2xl bg-[#150533]/40 border border-dashed border-fuchsia-800/50 text-center space-y-3">
              <Layers className="w-12 h-12 text-fuchsia-500/50 animate-pulse" />
              <p className="text-sm font-bold text-fuchsia-300">
                هیچ روزی انتخاب نشده است. لطفاً از کادر بالا حداقل یک روز را انتخاب کنید.
              </p>
            </div>
          ) : (
            <div
              className={`flex-1 min-h-0 ${
                layoutMode === 'grid'
                  ? selectedDates.length === 1
                    ? 'grid grid-cols-1 gap-3 h-full'
                    : selectedDates.length === 2
                    ? 'grid grid-cols-1 lg:grid-cols-2 gap-3 h-full'
                    : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 h-full'
                  : 'space-y-4'
              }`}
            >
              {selectedDates.map((dateStr) => (
                <SingleDayChartsView
                  key={dateStr}
                  dateStr={dateStr}
                  sessions={sessions}
                  activeSession={activeSession}
                  clearedDates={clearedDates}
                  todayStr={todayStr}
                  activeTab={activeTab}
                  layoutMode={layoutMode}
                />
              ))}
            </div>
          )}
        </div>

        {/* STICKY BOTTOM TOOLBAR FOR EASY SWITCHING WITHOUT SCROLLING */}
        <div className="shrink-0 border-t border-fuchsia-800/80 bg-[#12042b]/95 backdrop-blur-md px-3 py-2.5 sm:px-6 sm:py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_-10px_25px_rgba(0,0,0,0.6)] z-30 dir-rtl">
          {/* Chart Type Tabs Bar */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0d0221] border border-fuchsia-800/80 text-xs font-bold overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('hourly')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'hourly'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-fuchsia-300 hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>نمودار ساعتی</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-fuchsia-300 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>خط زمانی</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sequential')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'sequential'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-fuchsia-300 hover:text-white'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>بازه‌های جداگانه</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]'
                  : 'text-fuchsia-300 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>همه</span>
            </button>
          </div>

          {/* Layout Mode Switcher (Grid side-by-side vs List stacked) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0d0221] border border-cyan-800/80 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                layoutMode === 'grid'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.5)] font-black'
                  : 'text-cyan-300 hover:text-white'
              }`}
              title="نمایش در ۱ قاب (کنار هم)"
            >
              <Columns className="w-4 h-4" />
              <span>کنار هم (در یک قاب)</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                layoutMode === 'list'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.5)] font-black'
                  : 'text-cyan-300 hover:text-white'
              }`}
              title="نمایش ستونی (زیر هم)"
            >
              <List className="w-4 h-4" />
              <span>زیر هم</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
