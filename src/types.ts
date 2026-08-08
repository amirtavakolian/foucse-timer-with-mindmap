export interface FocusSession {
  id: string;
  startTime: number; // Unix timestamp ms
  endTime: number | null; // Unix timestamp ms or null if running
  durationSeconds: number; // Target duration
  elapsedSeconds: number; // Actual elapsed time
  taskName?: string;
  completed: boolean;
  dateStr: string; // YYYY-MM-DD
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
