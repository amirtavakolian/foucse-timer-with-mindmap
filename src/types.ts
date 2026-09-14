export interface FocusSession {
  id: string;
  startTime: number; // Unix timestamp ms
  endTime: number | null; // Unix timestamp ms or null if running
  durationSeconds: number; // Target duration
  elapsedSeconds: number; // Actual elapsed time
  taskName?: string;
  completed: boolean;
  dateStr: string; // YYYY-MM-DD
  sessionType?: 'focus' | 'idle';
}

export interface HourFocusData {
  hour: number; // 0 to 23
  focusSeconds: number; // Seconds focused during this hour block
  percentage: number; // 0 to 100
}

export interface DayFocusRecord {
  dateStr: string; // YYYY-MM-DD
  sessions: FocusSession[];
  totalFocusSeconds: number;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0 to 1
  soundType: 'chime' | 'piano' | 'gentle_bell' | 'marimba';
}

export interface AppSettings {
  theme: 'dark' | 'light';
  sound: SoundSettings;
  nativeNotifications: boolean;
  alwaysOnTopSimulated: boolean;
  language: 'fa' | 'en';
  autoStartBreak: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  targetMinutes: number;
  completedMinutes: number;
}

export interface StaircaseTodo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface StairStep {
  id: string;
  title: string;
  color?: string;
  createdAt?: number;
  customDate?: string; // Optional custom ISO date (YYYY-MM-DD) or timestamp
  todos: StaircaseTodo[];
}

export interface StaircaseProject {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  steps: StairStep[];
  notes?: string;
  parentId?: string; // Optional ID of parent staircase if this is a sub-staircase
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
  color?: string; // Hex or theme color for categorization
  tags?: string[];
}
