import React, { useState } from 'react';
import { X, BarChart2, Clock, CheckCircle2, Coffee, PieChart, Sparkles, Hourglass, Calendar } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import { TimeIntervalRecord, formatDurationHuman, formatShamsiDate, toPersianDigits } from '../utils/time';

interface IntervalChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDateStr: string;
  intervals: TimeIntervalRecord[];
}

export const IntervalChartModal: React.FC<IntervalChartModalProps> = ({
  isOpen,
  onClose,
  selectedDateStr,
  intervals,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'hourly' | 'intervals'>('hourly');

  if (!isOpen) return null;

  // Calculate overall metrics
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

  // Prepare Sequential Intervals Data for Bar Chart
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

  // Pie Chart Data
  const pieData = [
    { name: 'تمرکز (Focus)', value: Math.ceil(totalFocusSec / 60), color: '#06b6d4' },
    { name: 'استراحت (Idle)', value: Math.ceil(totalIdleSec / 60), color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  // Custom Tooltip for Hourly Bar/Area Chart
  const CustomHourlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const focusValue = payload.find((p: any) => p.dataKey === 'focusMins')?.value || 0;
      const idleValue = payload.find((p: any) => p.dataKey === 'idleMins')?.value || 0;
      return (
        <div className="p-3 bg-[#0d0221] border border-fuchsia-500/80 rounded-xl shadow-xl text-xs space-y-1.5 font-sans dir-rtl">
          <p className="font-extrabold text-cyan-300 border-b border-fuchsia-800/60 pb-1 flex items-center justify-between gap-4">
            <span>ساعت: {label}</span>
            <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
          </p>
          <p className="text-cyan-400 font-bold flex items-center justify-between gap-3">
            <span>زمان تمرکز:</span>
            <span className="font-mono bg-fuchsia-950 px-2 py-0.5 rounded border border-fuchsia-800">
              {focusValue} دقیقه
            </span>
          </p>
          <p className="text-amber-400 font-bold flex items-center justify-between gap-3">
            <span>زمان استراحت/استفاده‌نشده:</span>
            <span className="font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
              {idleValue} دقیقه
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Sequential Intervals
  const CustomIntervalTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 bg-[#0d0221] border border-cyan-500/80 rounded-xl shadow-xl text-xs space-y-1.5 font-sans dir-rtl">
          <p className="font-extrabold text-fuchsia-200 border-b border-fuchsia-800/60 pb-1 flex items-center justify-between gap-4">
            <span>بازه #{data.index}: {data.taskName}</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                data.type === 'focus' ? 'bg-cyan-950 text-cyan-300 border border-cyan-600' : 'bg-amber-950 text-amber-300 border border-amber-600'
              }`}
            >
              {data.typeName}
            </span>
          </p>
          <p className="text-cyan-300 font-bold flex items-center justify-between gap-4">
            <span>زمان دقیق (HH:MM):</span>
            <span className="font-mono bg-[#150533] px-2 py-0.5 rounded border border-fuchsia-700 dir-ltr text-amber-300">
              {data.startTime} ➔ {data.endTime}
            </span>
          </p>
          <p className="text-fuchsia-200 font-bold flex items-center justify-between gap-4">
            <span>مدت زمان:</span>
            <span className="font-mono bg-fuchsia-950 px-2 py-0.5 rounded border border-fuchsia-700 text-cyan-200">
              {data.durationHuman} ({data.durationMins} دقیقه)
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-[98vw] h-[95vh] sm:h-[96vh] flex flex-col bg-[#0d0221] border border-fuchsia-500/60 rounded-3xl shadow-[0_0_50px_rgba(217,70,239,0.25)] text-fuchsia-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-3.5 py-3 sm:px-5 sm:py-4 border-b border-fuchsia-900/60 flex items-center justify-between gap-4 bg-gradient-to-r from-[#150533] via-[#0d0221] to-[#1a053f] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-fuchsia-950/90 border border-fuchsia-600/70 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(217,70,239,0.3)] shrink-0">
              <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 flex items-center gap-2">
                <span>نمودار بازه‌های زمانی تمرکز و استراحت (HH:MM)</span>
              </h3>
              <p className="text-xs text-fuchsia-300/80 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>تاریخ: {formatShamsiDate(selectedDateStr)} ({selectedDateStr})</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-[#150533] hover:bg-rose-950/80 text-fuchsia-300 hover:text-rose-200 border border-fuchsia-800/60 hover:border-rose-600/60 transition shadow-md cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body - Scrollable & Flex fill */}
        <div className="px-2 sm:px-4 py-3 sm:py-4 overflow-y-auto flex-1 space-y-5 dir-rtl flex flex-col">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Total Focus */}
            <div className="p-3.5 rounded-2xl bg-[#150533]/90 border border-fuchsia-800/70 flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-bold text-cyan-300/90 flex items-center justify-between">
                <span>کل تمرکز (Focus)</span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-base sm:text-lg font-extrabold text-cyan-200 mt-2 font-mono dir-ltr text-right">
                {formatDurationHuman(totalFocusSec, 'en')}
              </div>
            </div>

            {/* Total Idle */}
            <div className="p-3.5 rounded-2xl bg-[#150533]/90 border border-amber-800/60 flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-bold text-amber-300/90 flex items-center justify-between">
                <span>استراحت/عدم تمرکز</span>
                <Coffee className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-base sm:text-lg font-extrabold text-amber-200 mt-2 font-mono dir-ltr text-right">
                {formatDurationHuman(totalIdleSec, 'en')}
              </div>
            </div>

            {/* Focus Ratio % */}
            <div className="p-3.5 rounded-2xl bg-[#150533]/90 border border-fuchsia-800/70 flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-bold text-fuchsia-300/90 flex items-center justify-between">
                <span>درصد بهره‌وری</span>
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div className="text-base sm:text-lg font-extrabold text-fuchsia-200 mt-2 font-mono">
                {focusPercentage}%
              </div>
            </div>

            {/* Total Intervals Count */}
            <div className="p-3.5 rounded-2xl bg-[#150533]/90 border border-fuchsia-800/70 flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-bold text-fuchsia-300/90 flex items-center justify-between">
                <span>تعداد بازه‌ها</span>
                <Hourglass className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div className="text-base sm:text-lg font-extrabold text-fuchsia-100 mt-2 font-mono">
                {intervals.length} بازه
              </div>
            </div>
          </div>

          {/* Chart View Selection Tabs */}
          <div className="flex items-center justify-between border-b border-fuchsia-900/60 pb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-[#150533] border border-fuchsia-800/60 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('hourly')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'hourly'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.3)]'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>نمودار ساعتی (24h Breakdown)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.3)]'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>خط زمانی بازه‌ها (Interval Gantt)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('intervals')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'intervals'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.3)]'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span>مقایسه بازه‌های جداگانه</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold text-fuchsia-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]"></span>
                <span>Focus (تمرکز)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <span>Idle (استراحت)</span>
              </span>
            </div>
          </div>

          {/* TAB 1: Hourly Bar Chart (00:00 - 24:00) */}
          {activeTab === 'hourly' && (
            <div className="flex-1 flex flex-col space-y-4 min-h-[380px]">
              <div className="flex items-center justify-between shrink-0">
                <h4 className="text-sm font-extrabold text-cyan-300 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-cyan-400" />
                  <span>میزان تمرکز و استراحت در هر ساعت (دقیقه در هر ساعت)</span>
                </h4>
                <span className="text-xs text-fuchsia-400/80">محور افقی: ساعت (00:00 - 23:00) | محور عمودی: دقیقه</span>
              </div>

              <div className="w-full flex-1 min-h-[350px] sm:min-h-[420px] p-2 sm:p-3 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 shadow-inner dir-ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyChartData} margin={{ top: 15, right: 5, left: -25, bottom: 5 }}>
                    <XAxis
                      dataKey="hourLabel"
                      stroke="#c084fc"
                      fontSize={11}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis
                      stroke="#c084fc"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, 60]}
                      ticks={[0, 15, 30, 45, 60]}
                    />
                    <Tooltip content={<CustomHourlyTooltip />} />
                    <Bar dataKey="focusMins" name="Focus (تمرکز)" fill="#06b6d4" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="idleMins" name="Idle (استراحت)" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TAB 2: Visual Interval Gantt / Timeline Ribbon */}
          {activeTab === 'timeline' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between shrink-0">
                <h4 className="text-sm font-extrabold text-cyan-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>خط زمانی پیوسته ۲۴ ساعته (Continuous 24-Hour Timeline Bar)</span>
                </h4>
                <span className="text-xs text-fuchsia-400/80">روی هر بازه نگه دارید تا ساعت دقیق شروع و پایان را ببینید</span>
              </div>

              {/* 24h Ribbon Representation */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#150533]/90 border border-fuchsia-800/70 space-y-3 shrink-0">
                <div className="relative w-full h-16 sm:h-20 bg-[#0d0221] rounded-xl border border-fuchsia-900/80 overflow-hidden flex items-center shadow-inner">
                  {intervals.map((item, idx) => {
                    const [sH, sM] = item.startTimeStr.split(':').map(Number);
                    const [eH, eM] = item.endTimeStr.split(':').map(Number);
                    const startMin = sH * 60 + sM;
                    let endMin = eH * 60 + eM;
                    if (endMin <= startMin && endMin === 0) endMin = 1440;

                    const leftPct = (startMin / 1440) * 100;
                    const widthPct = Math.max(0.4, ((endMin - startMin) / 1440) * 100);

                    const isFocus = item.type === 'focus';

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                        className={`absolute h-full transition-all hover:brightness-125 cursor-pointer flex items-center justify-center text-[10px] font-bold group ${
                          isFocus
                            ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 border-x border-cyan-300/40 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                            : 'bg-amber-500/80 border-x border-amber-300/40'
                        }`}
                        title={`${item.taskName || (isFocus ? 'تمرکز' : 'استراحت')}: ${item.startTimeStr} تا ${item.endTimeStr} (${formatDurationHuman(item.durationSeconds, 'en')})`}
                      >
                        {widthPct > 4 && (
                          <span className="truncate px-1 text-white font-mono drop-shadow text-[11px] dir-ltr">
                            {item.startTimeStr}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hour Scale Markers (00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 24:00) */}
                <div className="flex justify-between text-[11px] font-mono font-bold text-fuchsia-300/80 px-1 dir-ltr">
                  <span>00:00</span>
                  <span>04:00</span>
                  <span>08:00</span>
                  <span>12:00</span>
                  <span>16:00</span>
                  <span>20:00</span>
                  <span>24:00</span>
                </div>
              </div>

              {/* Detail Cards List */}
              <div className="mt-2 space-y-2 flex-1 min-h-[220px] max-h-[420px] overflow-y-auto pr-1">
                {intervals.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      item.type === 'focus'
                        ? 'bg-[#1a073d]/80 border-fuchsia-700/60 text-cyan-200'
                        : 'bg-[#12042b]/60 border-amber-800/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[#0d0221] border border-fuchsia-700 font-mono text-fuchsia-300">
                        {idx + 1}
                      </span>
                      <span>{item.taskName || (item.type === 'focus' ? 'تمرکز' : 'استراحت')}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono bg-[#0d0221] px-2.5 py-1 rounded-lg border border-fuchsia-800 dir-ltr text-cyan-300">
                        {item.startTimeStr} ➔ {item.endTimeStr}
                      </span>
                      <span className="font-mono text-fuchsia-200 bg-fuchsia-950 px-2 py-1 rounded-lg border border-fuchsia-700">
                        {formatDurationHuman(item.durationSeconds, 'en')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Individual Interval Duration Bar Chart */}
          {activeTab === 'intervals' && (
            <div className="flex-1 flex flex-col space-y-4 min-h-[380px]">
              <div className="flex items-center justify-between shrink-0">
                <h4 className="text-sm font-extrabold text-cyan-300 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-cyan-400" />
                  <span>مقایسه طول هر بازه (مدت زمان بر حسب دقیقه)</span>
                </h4>
                <span className="text-xs text-fuchsia-400/80">نمودار ستونی بازه‌های زمانی به ترتیب وقوع</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[350px]">
                <div className="md:col-span-2 min-h-[320px] sm:min-h-[400px] h-full p-2 sm:p-3 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 shadow-inner dir-ltr flex flex-col">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sequentialChartData} margin={{ top: 15, right: 5, left: -25, bottom: 20 }}>
                      <XAxis
                        dataKey="startTime"
                        stroke="#c084fc"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis stroke="#c084fc" fontSize={11} tickLine={false} />
                      <Tooltip content={<CustomIntervalTooltip />} />
                      <Bar dataKey="durationMins" name="مدت زمان (دقیقه)">
                        {sequentialChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fillColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Ratio Breakdown */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/60 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[400px] h-full">
                  <h5 className="text-xs font-extrabold text-fuchsia-200 mb-2">سهم تمرکز vs استراحت</h5>
                  <div className="w-full flex-1 min-h-[240px] dir-ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`pie-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center text-xs font-extrabold text-cyan-300 font-mono mt-2">
                    تمرکز: {focusPercentage}% | استراحت: {100 - focusPercentage}%
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-fuchsia-900/60 bg-[#150533] flex items-center justify-between text-xs text-fuchsia-300/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>گزارش کامل دقیق به دقیقه با فرمت HH:MM</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-extrabold transition shadow-[0_0_12px_rgba(217,70,239,0.3)] cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
