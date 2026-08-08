import React from 'react';
import { Monitor, Minus, Square, X, Settings, Moon, Sun, Bell, Volume2, ShieldCheck, HelpCircle } from 'lucide-react';
import { AppSettings } from '../types';
import { formatShamsiDate, toPersianDigits } from '../utils/time';

interface WindowsTitleBarProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenPwaGuide: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenPwaGuide,
  isMinimized,
  onToggleMinimize,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const today = new Date();
  
  // Solar Hijri (Shamsi) date format in English context
  const dateStr = formatShamsiDate(today);

  return (
    <header className="select-none flex items-center justify-between h-10 px-4 border-b border-fuchsia-900/50 bg-[#0d0221]/95 backdrop-blur-md text-fuchsia-200 z-50 transition-colors">
      {/* Left section: App Icon & Title */}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-md bg-gradient-to-r from-fuchsia-600 to-pink-600 flex items-center justify-center shadow-[0_0_8px_rgba(217,70,239,0.5)]">
          <Monitor className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 flex items-center gap-1.5">
          FocusTime Pro v2.4
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fuchsia-950 text-fuchsia-300 font-bold border border-fuchsia-700/60 shadow-[0_0_6px_rgba(217,70,239,0.2)]">
            Win11 Cyberpunk
          </span>
        </span>

        <span className="hidden sm:inline-block text-[11px] font-bold text-fuchsia-300/80 border-l border-fuchsia-900/60 pl-3 ml-1">
          {dateStr}
        </span>
      </div>

      {/* Middle/Right Quick Action Controls */}
      <div className="flex items-center gap-1.5">
        {/* Theme Toggle */}
        <button
          onClick={() => onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          className="p-1.5 rounded hover:bg-fuchsia-950/80 text-fuchsia-300 transition"
          title="Toggle Theme"
        >
          {settings.theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-fuchsia-300" />
          )}
        </button>

        {/* Install / Desktop app guide */}
        <button
          onClick={onOpenPwaGuide}
          className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-[#150533] hover:bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-800/60 font-bold transition"
          title="Install as Windows Desktop App"
        >
          <HelpCircle className="w-3 h-3 text-cyan-400" />
          <span className="hidden md:inline">Windows App</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-fuchsia-950/80 text-fuchsia-300 transition"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Window controls (Minimize, Maximize, Close) */}
        <div className="flex items-center border-l border-fuchsia-900/60 pl-2 ml-1 gap-0.5">
          <button
            onClick={onToggleMinimize}
            className="w-8 h-7 flex items-center justify-center hover:bg-fuchsia-950/80 rounded text-fuchsia-300 transition"
            title="Minimize to Mini Widget"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleFullscreen}
            className="w-8 h-7 flex items-center justify-center hover:bg-fuchsia-950/80 rounded text-fuchsia-300 transition"
            title="Toggle Fullscreen"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              if (window.confirm('Close Windows Focus Timer?')) {
                window.close();
              }
            }}
            className="w-8 h-7 flex items-center justify-center hover:bg-red-600 hover:text-white rounded text-purple-300 transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
