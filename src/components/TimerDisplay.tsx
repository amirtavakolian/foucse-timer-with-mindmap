import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Square, Clock, Sparkles, CheckCircle2, ChevronUp, ChevronDown, Bell } from 'lucide-react';
import { AppSettings, TimerStatus } from '../types';
import { formatTime, toPersianDigits } from '../utils/time';
import { playUiClick } from '../utils/audio';

interface TimerDisplayProps {
  settings: AppSettings;
  status: TimerStatus;
  targetSeconds: number;
  remainingSeconds: number;
  activeTaskName: string;
  onChangeTaskName: (name: string) => void;
  onSetTargetTime: (seconds: number) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onStopAndSaveTimer: () => void;
  onResetTimer: () => void;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  settings,
  status,
  targetSeconds,
  remainingSeconds,
  activeTaskName,
  onChangeTaskName,
  onSetTargetTime,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onStopAndSaveTimer,
  onResetTimer,
}) => {
  // Input state for hours, minutes, seconds when idle
  const [inputHours, setInputHours] = useState<number>(Math.floor(targetSeconds / 3600));
  const [inputMinutes, setInputMinutes] = useState<number>(Math.floor((targetSeconds % 3600) / 60));
  const [inputSeconds, setInputSeconds] = useState<number>(targetSeconds % 60);

  // Sync inputs when targetSeconds changes externally
  useEffect(() => {
    if (status === 'idle') {
      setInputHours(Math.floor(targetSeconds / 3600));
      setInputMinutes(Math.floor((targetSeconds % 3600) / 60));
      setInputSeconds(targetSeconds % 60);
    }
  }, [targetSeconds, status]);

  const handleApplyCustomTime = (h: number, m: number, s: number) => {
    const total = h * 3600 + m * 60 + s;
    if (total > 0) {
      onSetTargetTime(total);
    }
  };

  const handlePresetSelect = (seconds: number) => {
    playUiClick(settings.sound.volume);
    onSetTargetTime(seconds);
  };

  // Progress percentage (0 to 100)
  const progressPercent = targetSeconds > 0
    ? Math.max(0, Math.min(100, ((targetSeconds - remainingSeconds) / targetSeconds) * 100))
    : 0;

  // SVG ring parameters
  const radius = 120;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#0d0221]/90 border border-fuchsia-500/40 shadow-[0_0_35px_rgba(217,70,239,0.18)] backdrop-blur-xl transition-all">
      {/* Header Task Input */}
      <div className="w-full mb-6">
        <label className="block text-xs font-bold tracking-wider text-fuchsia-300 uppercase mb-1.5 text-left">
          Focus Session Title
        </label>
        <div className="relative">
          <input
            type="text"
            value={activeTaskName}
            onChange={(e) => onChangeTaskName(e.target.value)}
            disabled={status === 'running' || status === 'paused'}
            placeholder="e.g. Working on project deadline..."
            className="w-full px-4 py-3 pl-10 rounded-xl bg-[#150533]/80 border border-fuchsia-800/60 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30 text-fuchsia-100 placeholder-fuchsia-400/40 text-sm font-medium transition outline-none text-left disabled:opacity-75"
          />
          <Sparkles className="w-4 h-4 text-fuchsia-400 absolute left-3.5 top-3.5 pointer-events-none" />
        </div>
      </div>

      {/* Main Circular Countdown Display */}
      <div className="relative flex items-center justify-center my-2 select-none">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90 drop-shadow-[0_0_30px_rgba(217,70,239,0.35)]">
          {/* Background circle track */}
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-purple-950/80"
          />
          {/* Active progress stroke */}
          <circle
            stroke="url(#cyberpunkPurpleGradient)"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <defs>
            <linearGradient id="cyberpunkPurpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Digital Timer Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
            {formatTime(remainingSeconds, false)}
          </span>

          <span className="mt-1.5 text-xs font-semibold text-fuchsia-300 flex items-center gap-1.5">
            {status === 'running' && (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block shadow-[0_0_8px_#22d3ee]"></span>
                <span className="text-cyan-300 font-bold">Counting Down...</span>
              </>
            )}
            {status === 'paused' && (
              <span className="text-amber-400 font-bold">
                Timer Paused
              </span>
            )}
            {status === 'idle' && (
              <span className="text-fuchsia-400/80 font-normal">
                Ready to Start Focus
              </span>
            )}
            {status === 'completed' && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Focus Completed!
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Preset Duration Buttons (only when idle) */}
      {status === 'idle' && (
        <div className="w-full mt-4">
          <div className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider mb-2 text-left">
            Quick Presets
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: '15 min', sec: 15 * 60 },
              { label: '25m Pomodoro', sec: 25 * 60 },
              { label: '45 min', sec: 45 * 60 },
              { label: '1 Hour', sec: 60 * 60 },
              { label: '1.5 Hours', sec: 90 * 60 },
            ].map((preset) => (
              <button
                key={preset.sec}
                onClick={() => handlePresetSelect(preset.sec)}
                className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                  targetSeconds === preset.sec
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.4)]'
                    : 'bg-[#150533]/60 border-fuchsia-900/60 text-fuchsia-200 hover:bg-fuchsia-950/60 hover:border-fuchsia-700/60'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Manual HH:MM:SS Adjuster */}
          <div className="mt-4 p-3.5 rounded-2xl bg-[#150533]/80 border border-fuchsia-800/50 flex items-center justify-between">
            <span className="text-xs text-fuchsia-300 font-bold tracking-wider uppercase">
              Custom Duration
            </span>
            <div className="flex items-center gap-2 dir-ltr">
              {/* Hours */}
              <div className="flex flex-col items-center">
                <div className="flex items-center border border-fuchsia-700/60 rounded-lg bg-[#0d0221] px-2 py-1 shadow-sm">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={inputHours}
                    onChange={(e) => {
                      const h = parseInt(e.target.value) || 0;
                      setInputHours(h);
                      handleApplyCustomTime(h, inputMinutes, inputSeconds);
                    }}
                    className="w-10 text-center text-sm font-mono font-bold bg-transparent text-fuchsia-200 outline-none"
                  />
                  <span className="text-[10px] text-fuchsia-400 font-medium">h</span>
                </div>
              </div>
              <span className="text-fuchsia-400 font-bold">:</span>
              {/* Minutes */}
              <div className="flex flex-col items-center">
                <div className="flex items-center border border-fuchsia-700/60 rounded-lg bg-[#0d0221] px-2 py-1 shadow-sm">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputMinutes}
                    onChange={(e) => {
                      const m = parseInt(e.target.value) || 0;
                      setInputMinutes(m);
                      handleApplyCustomTime(inputHours, m, inputSeconds);
                    }}
                    className="w-10 text-center text-sm font-mono font-bold bg-transparent text-fuchsia-200 outline-none"
                  />
                  <span className="text-[10px] text-fuchsia-400 font-medium">m</span>
                </div>
              </div>
              <span className="text-fuchsia-400 font-bold">:</span>
              {/* Seconds */}
              <div className="flex flex-col items-center">
                <div className="flex items-center border border-fuchsia-700/60 rounded-lg bg-[#0d0221] px-2 py-1 shadow-sm">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputSeconds}
                    onChange={(e) => {
                      const s = parseInt(e.target.value) || 0;
                      setInputSeconds(s);
                      handleApplyCustomTime(inputHours, inputMinutes, s);
                    }}
                    className="w-10 text-center text-sm font-mono font-bold bg-transparent text-fuchsia-200 outline-none"
                  />
                  <span className="text-[10px] text-fuchsia-400 font-medium">s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Control Buttons */}
      <div className="flex items-center justify-center gap-3 mt-6 w-full">
        {status === 'idle' && (
          <button
            onClick={() => {
              playUiClick(settings.sound.volume);
              onStartTimer();
            }}
            className="flex-1 max-w-xs py-3.5 px-6 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-purple-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-extrabold text-base shadow-[0_0_25px_rgba(217,70,239,0.45)] active:scale-95 transition-all flex items-center justify-center gap-2 border border-fuchsia-400/40"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Focus Session</span>
          </button>
        )}

        {status === 'running' && (
          <>
            <button
              onClick={() => {
                playUiClick(settings.sound.volume);
                onPauseTimer();
              }}
              className="flex-1 py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause Session</span>
            </button>
            <button
              onClick={() => {
                playUiClick(settings.sound.volume);
                onStopAndSaveTimer();
              }}
              className="flex-1 py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(225,29,72,0.3)] active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop & Record</span>
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={() => {
                playUiClick(settings.sound.volume);
                onResumeTimer();
              }}
              className="flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Focus</span>
            </button>
            <button
              onClick={() => {
                playUiClick(settings.sound.volume);
                onStopAndSaveTimer();
              }}
              className="flex-1 py-3 px-5 rounded-2xl bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-200 border border-fuchsia-700/60 font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop & Save</span>
            </button>
          </>
        )}

        {(status === 'running' || status === 'paused' || status === 'completed') && (
          <button
            onClick={() => {
              playUiClick(settings.sound.volume);
              onResetTimer();
            }}
            className="p-3.5 rounded-2xl bg-[#150533] hover:bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-800/60 transition"
            title="Reset Timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
