import { AppSettings, FocusSession, TaskItem } from '../types';

export const SESSIONS_KEY = 'win_focus_timer_sessions_v1';
export const SETTINGS_KEY = 'win_focus_timer_settings_v1';
export const TASKS_KEY = 'win_focus_timer_tasks_v1';
export const MINDMAP_NODES_KEY = 'focustime_mindmap_nodes_v1';
export const MINDMAP_CONNS_KEY = 'focustime_mindmap_conns_v1';

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

export function exportBackupData(): string {
  const data = {
    settings: loadSettings(),
    sessions: loadSessions(),
    tasks: loadTasks(),
    mindmapNodes: loadMindMapNodes(),
    mindmapConnections: loadMindMapConnections(),
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
    return true;
  } catch {
    return false;
  }
}
