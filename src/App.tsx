import React, { useState, useEffect, useRef } from 'react';
import { WindowsTitleBar } from './components/WindowsTitleBar';
import { TimerDisplay } from './components/TimerDisplay';
import { Timeline24h } from './components/Timeline24h';
import { DailyFocusSummarySidebar } from './components/DailyFocusSummarySidebar';
import { NotificationModal } from './components/NotificationModal';
import { TaskList } from './components/TaskList';
import { SettingsModal } from './components/SettingsModal';
import { WindowsPwaGuide } from './components/WindowsPwaGuide';

import { AppSettings, FocusSession, TaskItem, TimerStatus } from './types';
import { loadSessions, loadSettings, loadTasks, saveSession, saveSettings, saveTasks } from './utils/storage';
import { formatTime, getTodayDateStr } from './utils/time';
import { Monitor, Maximize2, Minimize2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  // App Settings
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...loadSettings(), language: 'en' }));
  const isFa = false;

  // Persistence State
  const [sessions, setSessions] = useState<FocusSession[]>(() => loadSessions());
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasks());

  // Timer Core State
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [targetSeconds, setTargetSeconds] = useState<number>(3600); // Default 1 hour
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [activeTaskName, setActiveTaskName] = useState<string>('Daily Deep Work & Focus');

  // Active Session tracking
  const [activeSession, setActiveSession] = useState<{
    id: string;
    startTime: number;
    elapsedSeconds: number;
  } | null>(null);

  // Notification Modal State
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [lastCompletedDuration, setLastCompletedDuration] = useState<number>(3600);

  // Selected Date for 24h timeline
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getTodayDateStr());

  // Window frame states
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Reference for interval
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save settings on update
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  // Update tasks
  const handleUpdateTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  // Set new target time
  const handleSetTargetTime = (seconds: number) => {
    if (status === 'idle') {
      setTargetSeconds(seconds);
      setRemainingSeconds(seconds);
    }
  };

  // Start Timer
  const handleStartTimer = () => {
    if (remainingSeconds <= 0) return;

    const now = Date.now();
    const sessionId = `session_${now}`;

    setActiveSession({
      id: sessionId,
      startTime: now,
      elapsedSeconds: targetSeconds - remainingSeconds,
    });

    setStatus('running');
  };

  // Pause Timer
  const handlePauseTimer = () => {
    setStatus('paused');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Resume Timer
  const handleResumeTimer = () => {
    setStatus('running');
  };

  // Stop & Record Session Early or Normally
  const handleStopAndSaveTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeSession) {
      const now = Date.now();
      const actualElapsed = Math.round((now - activeSession.startTime) / 1000);

      if (actualElapsed >= 5) { // Log if at least 5 seconds worked
        const newSession: FocusSession = {
          id: activeSession.id,
          startTime: activeSession.startTime,
          endTime: now,
          durationSeconds: targetSeconds,
          elapsedSeconds: actualElapsed,
          taskName: activeTaskName,
          completed: remainingSeconds <= 0,
          dateStr: getTodayDateStr(),
        };

        saveSession(newSession);
        setSessions(loadSessions());
      }
    }

    setStatus('idle');
    setActiveSession(null);
    setRemainingSeconds(targetSeconds);
  };

  // Reset Timer
  const handleResetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('idle');
    setActiveSession(null);
    setRemainingSeconds(targetSeconds);
  };

  // Main Timer Countdown Loop Effect
  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            // Timer Completed!
            if (timerRef.current) clearInterval(timerRef.current);

            // Record completed session
            const now = Date.now();
            if (activeSession) {
              const completedSession: FocusSession = {
                id: activeSession.id,
                startTime: activeSession.startTime,
                endTime: now,
                durationSeconds: targetSeconds,
                elapsedSeconds: targetSeconds,
                taskName: activeTaskName,
                completed: true,
                dateStr: getTodayDateStr(),
              };

              saveSession(completedSession);
              setSessions(loadSessions());
            }

            setStatus('completed');
            setLastCompletedDuration(targetSeconds);
            setIsNotificationOpen(true);
            setActiveSession(null);

            return 0;
          }

          // Update active session elapsed
          if (activeSession) {
            setActiveSession((a) =>
              a ? { ...a, elapsedSeconds: targetSeconds - (prev - 1) } : null
            );
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, targetSeconds, activeSession, activeTaskName]);

  // Update Window Title Bar dynamically with countdown timer
  useEffect(() => {
    if (status === 'running' || status === 'paused') {
      document.title = `(${formatTime(remainingSeconds, false)}) Windows Focus Timer`;
    } else {
      document.title = 'Windows Focus Timer';
    }
  }, [remainingSeconds, status]);

  // Handle Clear Day Sessions
  const handleClearDaySessions = (dateStr: string) => {
    const updated = sessions.filter((s) => s.dateStr !== dateStr);
    localStorage.setItem('win_focus_timer_sessions_v1', JSON.stringify(updated));
    setSessions(updated);
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-300 relative overflow-x-hidden ${
        settings.theme === 'dark'
          ? 'bg-[#090314] text-fuchsia-100 selection:bg-fuchsia-500 selection:text-white'
          : 'bg-[#090314] text-fuchsia-100 selection:bg-fuchsia-500 selection:text-white'
      } dir-ltr`}
    >
      {/* Background Cyberpunk Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>

      {/* Windows 11 Title Bar Container */}
      <WindowsTitleBar
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPwaGuide={() => setIsPwaGuideOpen(true)}
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized(!isMinimized)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen();
              setIsFullscreen(false);
            }
          }
        }}
      />

      {/* Main Desktop Window Viewport */}
      {isMinimized ? (
        /* Floating Mini Widget View when minimized */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="p-6 rounded-2xl bg-purple-950/90 border-2 border-purple-500/80 shadow-2xl shadow-purple-900/50 backdrop-blur-2xl text-center space-y-4 max-w-sm w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-purple-400" />
                Mini Focus Widget
              </span>
              <button
                onClick={() => setIsMinimized(false)}
                className="px-2 py-1 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-xs text-purple-200 border border-purple-700/50"
              >
                Restore
              </button>
            </div>

            <div className="text-4xl font-black font-mono text-purple-300">
              {formatTime(remainingSeconds, false)}
            </div>

            <div className="text-xs text-purple-300/80 truncate">{activeTaskName}</div>
          </div>
        </div>
      ) : (
        /* Standard Full Windows Application View */
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Primary Focus Controls & 24h Timeline */}
            <div className="w-full lg:flex-1 space-y-8 order-2 lg:order-1 min-w-0">
              {/* Main Focus Timer Section */}
              <section className="w-full">
                <TimerDisplay
                  settings={settings}
                  status={status}
                  targetSeconds={targetSeconds}
                  remainingSeconds={remainingSeconds}
                  activeTaskName={activeTaskName}
                  onChangeTaskName={setActiveTaskName}
                  onSetTargetTime={handleSetTargetTime}
                  onStartTimer={handleStartTimer}
                  onPauseTimer={handlePauseTimer}
                  onResumeTimer={handleResumeTimer}
                  onStopAndSaveTimer={handleStopAndSaveTimer}
                  onResetTimer={handleResetTimer}
                />
              </section>

              {/* 24-Hour Daily Focus Activity Timeline Section */}
              <section className="w-full">
                <Timeline24h
                  settings={settings}
                  selectedDateStr={selectedDateStr}
                  onChangeDateStr={setSelectedDateStr}
                  sessions={sessions}
                  activeSession={activeSession}
                  onClearDay={handleClearDaySessions}
                />
              </section>

              {/* Focus Task Checklist */}
              <section className="w-full">
                <TaskList
                  tasks={tasks}
                  onUpdateTasks={handleUpdateTasks}
                  activeTaskName={activeTaskName}
                  onSelectTaskForTimer={(taskTitle) => setActiveTaskName(taskTitle)}
                  isFa={false}
                />
              </section>
            </div>

            {/* Right Side Panel: Daily Focus & Unused Time Summary */}
            <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 order-1 lg:order-2">
              <DailyFocusSummarySidebar
                settings={settings}
                sessions={sessions}
                activeSession={activeSession}
                selectedDateStr={selectedDateStr}
                onSelectDate={(d) => setSelectedDateStr(d)}
              />
            </div>
          </div>
        </main>
      )}

      {/* Windows 11 Footer Status Bar */}
      <footer className="select-none h-8 px-6 border-t border-purple-900/50 dark:border-purple-900/40 bg-purple-950/60 text-purple-300 text-[11px] font-medium flex items-center justify-between shrink-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'running'
                  ? 'bg-purple-400 animate-ping'
                  : status === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            {status === 'running'
              ? 'Focus Session Active...'
              : status === 'paused'
              ? 'Session Paused'
              : 'Focus System Ready'}
          </span>
          <span className="hidden sm:inline border-r border-purple-800/60 pr-3 mr-1 pl-3">
            Windows Desktop Notifications Ready
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-semibold">FocusTime Pro v2.4</span>
        </div>
      </footer>

      {/* High-Priority Notification Overlay Dialog when timer completes */}
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onRestartTimer={() => {
          handleSetTargetTime(targetSeconds);
          handleStartTimer();
        }}
        completedDurationSeconds={lastCompletedDuration}
        taskName={activeTaskName}
        settings={settings}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onDataImported={() => {
          setSessions(loadSessions());
          setTasks(loadTasks());
          setSettings(loadSettings());
        }}
      />

      {/* Windows PWA Installation Guide */}
      <WindowsPwaGuide
        isOpen={isPwaGuideOpen}
        onClose={() => setIsPwaGuideOpen(false)}
        isFa={isFa}
      />
    </div>
  );
}
