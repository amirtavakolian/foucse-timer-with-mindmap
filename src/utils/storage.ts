import { AppSettings, FocusSession, TaskItem } from '../types';
import { getTodayDateStr } from './time';

const SESSIONS_KEY = 'win_focus_timer_sessions_v1';
const SETTINGS_KEY = 'win_focus_timer_settings_v1';
const TASKS_KEY = 'win_focus_timer_tasks_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
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
  } catch (e) {
    console.warn('Failed to save session', e);
  }
}

export function clearDaySessions(dateStr: string): void {
  try {
    const sessions = loadSessions().filter((s) => s.dateStr !== dateStr);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
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
  } catch (e) {
    console.warn('Failed to save tasks', e);
  }
}

export function exportBackupData(): string {
  const data = {
    settings: loadSettings(),
    sessions: loadSessions(),
    tasks: loadTasks(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importBackupData(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.settings) saveSettings(parsed.settings);
    if (Array.isArray(parsed.sessions)) localStorage.setItem(SESSIONS_KEY, JSON.stringify(parsed.sessions));
    if (Array.isArray(parsed.tasks)) saveTasks(parsed.tasks);
    return true;
  } catch {
    return false;
  }
}
