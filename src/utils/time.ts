import { FocusSession, HourFocusData } from '../types';

/**
 * Converts English digits to Persian digits if needed
 */
export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num
    .toString()
    .replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

/**
 * Format total seconds into HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number, usePersian = false): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  let result = '';

  if (h > 0) {
    result = `${pad(h)}:${pad(m)}:${pad(s)}`;
  } else {
    result = `${pad(m)}:${pad(s)}`;
  }

  return usePersian ? toPersianDigits(result) : result;
}

/**
 * Formats time duration into human readable text (e.g. "۱ ساعت و ۲۵ دقیقه")
 */
export function formatDurationHuman(seconds: number, lang: 'fa' | 'en' = 'en'): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (lang === 'fa') {
    if (h === 0 && m === 0) return `${toPersianDigits(Math.floor(seconds))} ثانیه`;
    if (h === 0) return `${toPersianDigits(m)} دقیقه`;
    if (m === 0) return `${toPersianDigits(h)} ساعت`;
    return `${toPersianDigits(h)} ساعت و ${toPersianDigits(m)} دقیقه`;
  }

  if (h === 0 && m === 0) return `${Math.floor(seconds)}s`;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format timestamp (ms) into HH:MM string (e.g. "02:37" or "14:05")
 * Rounds UP to the next minute if there are leftover seconds/ms
 */
export function formatHHMM(timestampMs: number, usePersian = false): string {
  const roundedMs = Math.ceil(timestampMs / 60000) * 60000;
  const date = new Date(roundedMs);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const str = `${h}:${m}`;
  return usePersian ? toPersianDigits(str) : str;
}

/**
 * Formats a Date object or YYYY-MM-DD date string into Solar Hijri (Shamsi / Jalali) date format.
 * E.g., "جمعه ۱۷ مرداد ۱۴۰۵" or "۱۷ مرداد ۱۴۰۵"
 */
export function formatShamsiDate(
  dateInput: Date | string,
  options: { showWeekday?: boolean; showYear?: boolean } = { showWeekday: true, showYear: true }
): string {
  let d: Date;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';

  try {
    return d.toLocaleDateString('fa-IR-u-ca-persian', {
      weekday: options.showWeekday ? 'long' : undefined,
      year: options.showYear !== false ? 'numeric' : undefined,
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return d.toLocaleDateString('fa-IR');
  }
}

/**
 * Format hour number (0 to 23) into time string "00:00", "01:00", etc.
 */
export function formatHourLabel(hour: number, usePersian = false): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const str = `${pad(hour)}:00`;
  return usePersian ? toPersianDigits(str) : str;
}

export interface TimeIntervalRecord {
  id: string;
  type: 'focus' | 'idle';
  startTimeMs: number;
  endTimeMs: number;
  startTimeStr: string;
  endTimeStr: string;
  durationSeconds: number;
  taskName?: string;
  sessionId?: string;
}

/**
 * Generate exact continuous minute-by-minute intervals (focus sessions and idle/rest gaps) for a selected date
 */
export function generateDayIntervals(
  dateStr: string,
  sessions: FocusSession[],
  activeSession: { startTime: number; elapsedSeconds: number } | null,
  usePersian = false
): TimeIntervalRecord[] {
  const targetDate = new Date(dateStr);
  const dayStart = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  const isToday = getTodayDateStr() === dateStr;
  const nowMs = Date.now();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  // Cap time for calculating idle space: now if today, or 24:00 if past day
  const capTime = isToday ? Math.min(nowMs, dayEnd) : dayEnd;

  // Collect and normalize focus and idle sessions that overlap with target day
  const sessionList: {
    id: string;
    start: number;
    end: number;
    taskName?: string;
    type: 'focus' | 'idle';
  }[] = [];

  const allSessions = [...sessions];
  if (activeSession && isToday) {
    allSessions.push({
      id: 'active_live',
      startTime: activeSession.startTime,
      endTime: nowMs,
      durationSeconds: activeSession.elapsedSeconds,
      elapsedSeconds: activeSession.elapsedSeconds,
      completed: false,
      dateStr,
      taskName: undefined,
      sessionType: 'focus',
    });
  }

  allSessions.forEach((s) => {
    const sStart = s.startTime;
    const sEnd = s.endTime || nowMs;

    if (sEnd <= dayStart || sStart >= capTime) return;

    const clampedStart = Math.max(sStart, dayStart);
    const clampedEnd = Math.min(sEnd, capTime);

    if (clampedEnd > clampedStart) {
      sessionList.push({
        id: s.id,
        start: clampedStart,
        end: clampedEnd,
        taskName: s.taskName,
        type: s.sessionType === 'idle' ? 'idle' : 'focus',
      });
    }
  });

  // Sort sessions chronologically by start time
  sessionList.sort((a, b) => a.start - b.start);

  const intervals: TimeIntervalRecord[] = [];
  let cursor = dayStart;

  sessionList.forEach((item, index) => {
    // If there is an unfocused gap before this session
    if (item.start > cursor) {
      const durationSec = Math.round((item.start - cursor) / 1000);
      if (durationSec >= 1) {
        intervals.push({
          id: `idle_gap_${cursor}_${item.start}`,
          type: 'idle',
          startTimeMs: cursor,
          endTimeMs: item.start,
          startTimeStr: formatHHMM(cursor, usePersian),
          endTimeStr: formatHHMM(item.start, usePersian),
          durationSeconds: durationSec,
        });
      }
    }

    // Session interval
    const durationSec = Math.round((item.end - item.start) / 1000);
    intervals.push({
      id: item.id || `session_${item.start}_${index}`,
      type: item.type,
      startTimeMs: item.start,
      endTimeMs: item.end,
      startTimeStr: formatHHMM(item.start, usePersian),
      endTimeStr: formatHHMM(item.end, usePersian),
      durationSeconds: Math.max(1, durationSec),
      taskName: item.taskName,
      sessionId: item.id !== 'active_live' ? item.id : undefined,
    });

    cursor = Math.max(cursor, item.end);
  });

  // Check remaining unfocused gap from last cursor to capTime
  if (cursor < capTime) {
    const durationSec = Math.round((capTime - cursor) / 1000);
    if (durationSec >= 1) {
      intervals.push({
        id: `idle_gap_${cursor}_${capTime}`,
        type: 'idle',
        startTimeMs: cursor,
        endTimeMs: capTime,
        startTimeStr: formatHHMM(cursor, usePersian),
        endTimeStr: formatHHMM(capTime, usePersian),
        durationSeconds: durationSec,
      });
    }
  }

  return intervals;
}


/**
 * Gets date string format YYYY-MM-DD
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate all tracked dates from initial start date up to today (inclusive), plus any dates with sessions
 */
export function getAllTrackedDates(
  sessions: FocusSession[],
  initialStartDate?: string,
  clearedDates: string[] = []
): string[] {
  const todayStr = getTodayDateStr();
  const dateSet = new Set<string>();

  dateSet.add(todayStr);

  if (initialStartDate) {
    dateSet.add(initialStartDate);
  }

  sessions.forEach((s) => {
    if (s.dateStr) {
      dateSet.add(s.dateStr);
    }
  });

  let minDateStr = todayStr;
  dateSet.forEach((d) => {
    if (d < minDateStr) {
      minDateStr = d;
    }
  });

  const resultDates = new Set<string>();

  try {
    const partsMin = minDateStr.split('-').map(Number);
    const partsToday = todayStr.split('-').map(Number);

    if (partsMin.length === 3 && partsToday.length === 3) {
      const cur = new Date(partsMin[0], partsMin[1] - 1, partsMin[2]);
      const end = new Date(partsToday[0], partsToday[1] - 1, partsToday[2]);

      if (!isNaN(cur.getTime()) && !isNaN(end.getTime()) && cur <= end) {
        while (cur <= end) {
          const y = cur.getFullYear();
          const m = (cur.getMonth() + 1).toString().padStart(2, '0');
          const d = cur.getDate().toString().padStart(2, '0');
          resultDates.add(`${y}-${m}-${d}`);
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
  } catch (e) {
    console.warn('Error expanding tracked date range:', e);
  }

  dateSet.forEach((d) => resultDates.add(d));

  if (clearedDates.length > 0) {
    clearedDates.forEach((clearedDate) => {
      const hasSessions = sessions.some((s) => s.dateStr === clearedDate);
      if (!hasSessions) {
        resultDates.delete(clearedDate);
      }
    });
  }

  const sorted = Array.from(resultDates);
  sorted.sort((a, b) => (a < b ? 1 : -1));
  return sorted;
}

/**
 * Calculate 24-hour breakdown (0 to 23) for a given date from recorded sessions + active running session
 */
export function calculate24HourBreakdown(
  dateStr: string,
  sessions: FocusSession[],
  activeSession: { startTime: number; elapsedSeconds: number } | null
): HourFocusData[] {
  const hoursData: HourFocusData[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    focusSeconds: 0,
    percentage: 0,
  }));

  const targetDate = new Date(dateStr);
  const dayStartTimestamp = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  const dayEndTimestamp = dayStartTimestamp + 24 * 60 * 60 * 1000;

  // Combine completed sessions + active session
  const allSessionsToCalculate = [...sessions];

  if (activeSession && getTodayDateStr() === dateStr) {
    const now = Date.now();
    allSessionsToCalculate.push({
      id: 'active_live',
      startTime: activeSession.startTime,
      endTime: now,
      durationSeconds: activeSession.elapsedSeconds,
      elapsedSeconds: activeSession.elapsedSeconds,
      completed: false,
      dateStr,
    });
  }

  allSessionsToCalculate.forEach((session) => {
    // Skip idle/break sessions when calculating focus seconds
    if (session.sessionType === 'idle') return;

    const sStart = session.startTime;
    const sEnd = session.endTime || Date.now();

    // Check overlap with the target day
    if (sEnd <= dayStartTimestamp || sStart >= dayEndTimestamp) return;

    const clampedStart = Math.max(sStart, dayStartTimestamp);
    const clampedEnd = Math.min(sEnd, dayEndTimestamp);

    // Calculate overlap per hour block (3600 seconds each)
    for (let h = 0; h < 24; h++) {
      const hourStart = dayStartTimestamp + h * 3600 * 1000;
      const hourEnd = hourStart + 3600 * 1000;

      const overlapStart = Math.max(clampedStart, hourStart);
      const overlapEnd = Math.min(clampedEnd, hourEnd);

      if (overlapEnd > overlapStart) {
        const secondsInHour = (overlapEnd - overlapStart) / 1000;
        hoursData[h].focusSeconds += secondsInHour;
      }
    }
  });

  // Calculate percentages (cap at 100% or 3600s)
  hoursData.forEach((h) => {
    h.focusSeconds = Math.min(3600, Math.round(h.focusSeconds));
    h.percentage = Math.min(100, Math.round((h.focusSeconds / 3600) * 100));
  });

  return hoursData;
}
