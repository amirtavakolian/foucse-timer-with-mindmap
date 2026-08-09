import { AppSettings, FocusSession, TaskItem } from '../types';
import { getTodayDateStr, TimeIntervalRecord, generateDayIntervals } from './time';

export const SESSIONS_KEY = 'win_focus_timer_sessions_v1';
export const SETTINGS_KEY = 'win_focus_timer_settings_v1';
export const TASKS_KEY = 'win_focus_timer_tasks_v1';
export const MINDMAP_NODES_KEY = 'focustime_mindmap_nodes_v1';
export const MINDMAP_CONNS_KEY = 'focustime_mindmap_conns_v1';
export const ACTIVE_TIMER_KEY = 'focustime_active_timer_v1';
export const INITIAL_START_DATE_KEY = 'focustime_initial_start_date_v1';
export const INTERVAL_REPORTS_KEY = 'focustime_interval_reports_v1';

export function getInitialStartDate(): string {
  try {
    const stored = localStorage.getItem(INITIAL_START_DATE_KEY);
    if (stored) return stored;
    const today = getTodayDateStr();
    localStorage.setItem(INITIAL_START_DATE_KEY, today);
    syncApiSave(INITIAL_START_DATE_KEY, today);
    return today;
  } catch (e) {
    console.warn('Failed to load initial start date', e);
  }
  return getTodayDateStr();
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sound: {
    enabled: true,
    volume: 0.8,
    soundType: 'chime',
  },
  nativeNotifications: true,
  alwaysOnTopSimulated: true,
  language: 'en',
  autoStartBreak: false,
};

async function syncApiSave(key: string, data: any) {
  try {
    await fetch(`/api/storage/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.warn('API storage sync write error:', e);
  }
}

export async function fetchServerData<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/storage/${key}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn('API storage sync read error:', e);
  }
  return null;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load settings from storage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    syncApiSave(SETTINGS_KEY, settings);
  } catch (e) {
    console.warn('Failed to save settings to storage', e);
  }
}

export function loadSessions(): FocusSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load sessions from storage', e);
  }
  return [];
}

export function saveSession(session: FocusSession): void {
  try {
    const sessions = loadSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    syncApiSave(SESSIONS_KEY, sessions);
  } catch (e) {
    console.warn('Failed to save session', e);
  }
}

export function saveAllSessions(sessions: FocusSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    syncApiSave(SESSIONS_KEY, sessions);
  } catch (e) {
    console.warn('Failed to save all sessions', e);
  }
}

export function clearDaySessions(dateStr: string): void {
  try {
    const sessions = loadSessions().filter((s) => s.dateStr !== dateStr);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    syncApiSave(SESSIONS_KEY, sessions);
  } catch (e) {
    console.warn('Failed to clear day sessions', e);
  }
}

export function loadTasks(): TaskItem[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load tasks', e);
  }
  return [
    { id: '1', title: 'Focus on primary daily goals', completed: false, targetMinutes: 60, completedMinutes: 0 },
    { id: '2', title: 'Review emails and messages', completed: false, targetMinutes: 30, completedMinutes: 0 },
  ];
}

export function saveTasks(tasks: TaskItem[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    syncApiSave(TASKS_KEY, tasks);
  } catch (e) {
    console.warn('Failed to save tasks', e);
  }
}

export function loadMindMapNodes(): any[] | null {
  try {
    const raw = localStorage.getItem(MINDMAP_NODES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load mindmap nodes', e);
  }
  return null;
}

export function saveMindMapNodes(nodes: any[]): void {
  try {
    localStorage.setItem(MINDMAP_NODES_KEY, JSON.stringify(nodes));
    syncApiSave(MINDMAP_NODES_KEY, nodes);
  } catch (e) {
    console.warn('Failed to save mindmap nodes', e);
  }
}

export function loadMindMapConnections(): any[] | null {
  try {
    const raw = localStorage.getItem(MINDMAP_CONNS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load mindmap connections', e);
  }
  return null;
}

export function saveMindMapConnections(conns: any[]): void {
  try {
    localStorage.setItem(MINDMAP_CONNS_KEY, JSON.stringify(conns));
    syncApiSave(MINDMAP_CONNS_KEY, conns);
  } catch (e) {
    console.warn('Failed to save mindmap connections', e);
  }
}

export type IntervalReportsMap = Record<string, TimeIntervalRecord[]>;

export function loadIntervalReports(): IntervalReportsMap {
  try {
    const raw = localStorage.getItem(INTERVAL_REPORTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load interval reports from storage', e);
  }
  return {};
}

export function saveIntervalReports(reports: IntervalReportsMap): void {
  try {
    localStorage.setItem(INTERVAL_REPORTS_KEY, JSON.stringify(reports));
    syncApiSave(INTERVAL_REPORTS_KEY, reports);
  } catch (e) {
    console.warn('Failed to save interval reports', e);
  }
}

export function saveIntervalReportForDate(dateStr: string, intervals: TimeIntervalRecord[]): void {
  try {
    const reports = loadIntervalReports();
    reports[dateStr] = intervals;
    saveIntervalReports(reports);
  } catch (e) {
    console.warn('Failed to save interval report for date', e);
  }
}

export function clearIntervalReportForDate(dateStr: string): void {
  try {
    const reports = loadIntervalReports();
    delete reports[dateStr];
    saveIntervalReports(reports);
  } catch (e) {
    console.warn('Failed to clear interval report for date', e);
  }
}

/**
 * Gets exact time interval report (HH:MM) for a date directly from JSON storage.
 * If JSON storage does not have data for this date yet, generates it and persists to JSON storage.
 */
export function getExactIntervalReportForDate(
  dateStr: string,
  sessions: FocusSession[],
  activeSession: { startTime: number; elapsedSeconds: number } | null,
  usePersian = false
): TimeIntervalRecord[] {
  const reportsMap = loadIntervalReports();
  const storedForDate = reportsMap[dateStr];

  // If stored in JSON and date is not today, return directly from JSON
  if (storedForDate && storedForDate.length > 0 && dateStr !== getTodayDateStr()) {
    return storedForDate;
  }

  // Generate / update intervals and persist to JSON storage
  const generated = generateDayIntervals(dateStr, sessions, activeSession, usePersian);
  saveIntervalReportForDate(dateStr, generated);
  return generated;
}

export function exportBackupData(): string {
  const data = {
    settings: loadSettings(),
    sessions: loadSessions(),
    tasks: loadTasks(),
    mindmapNodes: loadMindMapNodes(),
    mindmapConnections: loadMindMapConnections(),
    intervalReports: loadIntervalReports(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importBackupData(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.settings) saveSettings(parsed.settings);
    if (Array.isArray(parsed.sessions)) saveAllSessions(parsed.sessions);
    if (Array.isArray(parsed.tasks)) saveTasks(parsed.tasks);
    if (Array.isArray(parsed.mindmapNodes)) saveMindMapNodes(parsed.mindmapNodes);
    if (Array.isArray(parsed.mindmapConnections)) saveMindMapConnections(parsed.mindmapConnections);
    if (parsed.intervalReports && typeof parsed.intervalReports === 'object') {
      saveIntervalReports(parsed.intervalReports);
    }
    return true;
  } catch {
    return false;
  }
}

export interface ActiveTimerState {
  status: 'idle' | 'running' | 'paused' | 'completed';
  targetSeconds: number;
  remainingSeconds: number;
  activeTaskName: string;
  endTime: number | null;
  activeSession: {
    id: string;
    startTime: number;
    elapsedSeconds: number;
  } | null;
}

export function loadActiveTimerState(): ActiveTimerState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load active timer state', e);
  }
  return null;
}

export function saveActiveTimerState(state: ActiveTimerState): void {
  try {
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save active timer state', e);
  }
}

export function clearActiveTimerState(): void {
  try {
    localStorage.removeItem(ACTIVE_TIMER_KEY);
  } catch (e) {
    console.warn('Failed to clear active timer state', e);
  }
}
