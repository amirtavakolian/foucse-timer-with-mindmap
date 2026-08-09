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
import {
  loadSessions,
  loadSettings,
  loadTasks,
  saveSession,
  saveSettings,
  saveTasks,
  saveAllSessions,
  fetchServerData,
  loadActiveTimerState,
  saveActiveTimerState,
  clearActiveTimerState,
  saveIntervalReports,
  saveIntervalReportForDate,
  clearIntervalReportForDate,
  IntervalReportsMap,
  SESSIONS_KEY,
  TASKS_KEY,
  SETTINGS_KEY,
  INITIAL_START_DATE_KEY,
  INTERVAL_REPORTS_KEY,
  DEFAULT_SETTINGS,
  getInitialStartDate
} from './utils/storage';
import { formatTime, getTodayDateStr, generateDayIntervals } from './utils/time';
import { Monitor, Maximize2, Minimize2, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  // App Settings
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...loadSettings(), language: 'en' }));
  const isFa = false;

  // Persistence State
  const [sessions, setSessions] = useState<FocusSession[]>(() => loadSessions());
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasks());

  // Load initial timer state if exists
  const initialTimerState = useRef(loadActiveTimerState());

  // Timer Core State
  const [status, setStatus] = useState<TimerStatus>(initialTimerState.current?.status || 'idle');
  const [targetSeconds, setTargetSeconds] = useState<number>(initialTimerState.current?.targetSeconds || 3600);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimerState.current?.remainingSeconds || 3600);
  const [activeTaskName, setActiveTaskName] = useState<string>(initialTimerState.current?.activeTaskName || 'Daily Deep Work & Focus');

  // Active Session tracking
  const [activeSession, setActiveSession] = useState<{
    id: string;
    startTime: number;
    elapsedSeconds: number;
  } | null>(initialTimerState.current?.activeSession || null);

  // Notification Modal State
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [lastCompletedDuration, setLastCompletedDuration] = useState<number>(initialTimerState.current?.targetSeconds || 3600);

  // Selected Date for 24h timeline
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getTodayDateStr());

  // Window frame states
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Reference for interval and exact end time
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number | null>(initialTimerState.current?.endTime || null);


  const activeSessionRef = useRef(activeSession);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  const targetSecondsRef = useRef(targetSeconds);
  useEffect(() => { targetSecondsRef.current = targetSeconds; }, [targetSeconds]);

  const activeTaskNameRef = useRef(activeTaskName);
  useEffect(() => { activeTaskNameRef.current = activeTaskName; }, [activeTaskName]);

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
    endTimeRef.current = now + remainingSeconds * 1000;

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
    endTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Resume Timer
  const handleResumeTimer = () => {
    const now = Date.now();
    endTimeRef.current = now + remainingSeconds * 1000;
    setStatus('running');
  };

  // Stop & Record Session Early or Normally
  const handleStopAndSaveTimer = () => {
    endTimeRef.current = null;
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
        const allSessions = loadSessions();
        setSessions(allSessions);
        const todayStr = getTodayDateStr();
        const todaySessions = allSessions.filter((s) => s.dateStr === todayStr);
        saveIntervalReportForDate(todayStr, generateDayIntervals(todayStr, todaySessions, null, false));
      }
    }

    setStatus('idle');
    setActiveSession(null);
    setRemainingSeconds(targetSeconds);
  };

  // Reset Timer
  const handleResetTimer = () => {
    endTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('idle');
    setActiveSession(null);
    setRemainingSeconds(targetSeconds);
  };

  // Main Timer Countdown Loop Effect (Real Wall-Clock Time Driven)
  useEffect(() => {
    if (status === 'running') {
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + remainingSeconds * 1000;
      }

      const tick = () => {
        if (!endTimeRef.current) return;
        const now = Date.now();
        const diffSec = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));

        if (diffSec <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);

          const endNow = Date.now();
          if (activeSessionRef.current) {
            const completedSession: FocusSession = {
              id: activeSessionRef.current.id,
              startTime: activeSessionRef.current.startTime,
              endTime: endNow,
              durationSeconds: targetSecondsRef.current,
              elapsedSeconds: targetSecondsRef.current,
              taskName: activeTaskNameRef.current,
              completed: true,
              dateStr: getTodayDateStr(),
            };

            saveSession(completedSession);
            const allSessions = loadSessions();
            setSessions(allSessions);
            const todayStr = getTodayDateStr();
            const todaySessions = allSessions.filter((s) => s.dateStr === todayStr);
            saveIntervalReportForDate(todayStr, generateDayIntervals(todayStr, todaySessions, null, false));
          }

          endTimeRef.current = null;
          setStatus('completed');
          setLastCompletedDuration(targetSecondsRef.current);
          setIsNotificationOpen(true);
          setActiveSession(null);
          setRemainingSeconds(0);
        } else {
          setRemainingSeconds(diffSec);
          if (activeSessionRef.current) {
            const newElapsed = targetSecondsRef.current - diffSec;
            setActiveSession((a) => (a ? { ...a, elapsedSeconds: newElapsed } : null));
          }
        }
      };

      tick();
      timerRef.current = setInterval(tick, 250);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Sync timer immediately when tab/window gains focus or visibility changes
  useEffect(() => {
    const handleSyncOnWakeup = () => {
      if (status === 'running' && endTimeRef.current) {
        const now = Date.now();
        const diffSec = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
        setRemainingSeconds(diffSec <= 0 ? 0 : diffSec);
      }
    };

    document.addEventListener('visibilitychange', handleSyncOnWakeup);
    window.addEventListener('focus', handleSyncOnWakeup);

    return () => {
      document.removeEventListener('visibilitychange', handleSyncOnWakeup);
      window.removeEventListener('focus', handleSyncOnWakeup);
    };
  }, [status]);

  // Persist active timer state
  useEffect(() => {
    saveActiveTimerState({
      status,
      targetSeconds,
      remainingSeconds,
      activeTaskName,
      endTime: endTimeRef.current,
      activeSession,
    });
  }, [status, targetSeconds, remainingSeconds, activeTaskName, activeSession]);

  // Update Window Title Bar dynamically with countdown timer
  useEffect(() => {
    if (status === 'running' || status === 'paused') {
      document.title = `(${formatTime(remainingSeconds, false)}) Windows Focus Timer`;
    } else {
      document.title = 'Windows Focus Timer';
    }
  }, [remainingSeconds, status]);

  // Initial sync from server JSON files
  useEffect(() => {
    async function initStorageSync() {
      const serverSessions = await fetchServerData<FocusSession[]>(SESSIONS_KEY);
      if (serverSessions && Array.isArray(serverSessions)) {
        setSessions(serverSessions);
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(serverSessions));
      }

      const serverTasks = await fetchServerData<TaskItem[]>(TASKS_KEY);
      if (serverTasks && Array.isArray(serverTasks)) {
        setTasks(serverTasks);
        localStorage.setItem(TASKS_KEY, JSON.stringify(serverTasks));
      }

      const serverSettings = await fetchServerData<AppSettings>(SETTINGS_KEY);
      if (serverSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...serverSettings });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(serverSettings));
      }

      const serverStartDate = await fetchServerData<string>(INITIAL_START_DATE_KEY);
      if (serverStartDate) {
        localStorage.setItem(INITIAL_START_DATE_KEY, serverStartDate);
      } else {
        getInitialStartDate();
      }

      const serverIntervalReports = await fetchServerData<IntervalReportsMap>(INTERVAL_REPORTS_KEY);
      if (serverIntervalReports && typeof serverIntervalReports === 'object') {
        localStorage.setItem(INTERVAL_REPORTS_KEY, JSON.stringify(serverIntervalReports));
      }
    }

    initStorageSync();
  }, []);

  // Handle Clear Day Sessions
  const handleClearDaySessions = (dateStr: string) => {
    const updated = sessions.filter((s) => s.dateStr !== dateStr);
    saveAllSessions(updated);
    setSessions(updated);
    clearIntervalReportForDate(dateStr);
  };

  // Handle Add Manual Session
  const handleAddSession = (newSession: FocusSession) => {
    const updated = [...sessions, newSession];
    saveAllSessions(updated);
    setSessions(updated);
    const daySessions = updated.filter((s) => s.dateStr === newSession.dateStr);
    const newIntervals = generateDayIntervals(newSession.dateStr, daySessions, activeSession, false);
    saveIntervalReportForDate(newSession.dateStr, newIntervals);
  };

  // Handle Delete Single Session
  const handleDeleteSession = (sessionId: string) => {
    const deletedSession = sessions.find((s) => s.id === sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    saveAllSessions(updated);
    setSessions(updated);
    if (deletedSession) {
      const daySessions = updated.filter((s) => s.dateStr === deletedSession.dateStr);
      const newIntervals = generateDayIntervals(deletedSession.dateStr, daySessions, activeSession, false);
      saveIntervalReportForDate(deletedSession.dateStr, newIntervals);
    }
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
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden space-y-8">
          {/* Top Section: Timer Display + Daily Summary Sidebar */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
            {/* Main Focus Timer Section */}
            <div className="w-full lg:flex-1 min-w-0 flex flex-col">
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
            </div>

            {/* Right Side Panel: Daily Focus & Unused Time Summary */}
            <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col">
              <DailyFocusSummarySidebar
                settings={settings}
                sessions={sessions}
                activeSession={activeSession}
                selectedDateStr={selectedDateStr}
                onSelectDate={(d) => setSelectedDateStr(d)}
                onClearDay={handleClearDaySessions}
              />
            </div>
          </div>

          {/* 24-Hour Daily Focus Activity Timeline Section (Full 12-Column Width) */}
          <section className="w-full">
            <Timeline24h
              settings={settings}
              selectedDateStr={selectedDateStr}
              onChangeDateStr={setSelectedDateStr}
              sessions={sessions}
              activeSession={activeSession}
              onClearDay={handleClearDaySessions}
              onAddSession={handleAddSession}
              onDeleteSession={handleDeleteSession}
            />
          </section>

          {/* Focus Task Checklist & MindMap Canvas (Full 12-Column Width) */}
          <section className="w-full">
            <TaskList
              tasks={tasks}
              onUpdateTasks={handleUpdateTasks}
              activeTaskName={activeTaskName}
              onSelectTaskForTimer={(taskTitle) => setActiveTaskName(taskTitle)}
              isFa={false}
            />
          </section>
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
