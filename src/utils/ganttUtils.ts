import { Task } from '../types';

/**
 * Safely parse any date representation into a valid Date object.
 * Handles ISO strings, YYYY-MM-DD without timezone shifting, Date instances, and timestamps.
 */
export function toDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : new Date(val.getTime());
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // YYYY-MM-DD match
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day, 0, 0, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function addDays(dateInput: any, days: number): Date {
  const base = toDate(dateInput);
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  result.setDate(result.getDate() + (Number(days) || 0));
  return result;
}

export function diffDays(d1Input: any, d2Input: any): number {
  const d1 = toDate(d1Input);
  const d2 = toDate(d2Input);
  const u1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const u2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const diff = Math.floor((u2 - u1) / 86400000);
  return isNaN(diff) ? 0 : diff;
}

export function formatDateToISO(dateInput: any): string {
  const d = toDate(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateToFR(dateInput: any): string {
  const d = toDate(dateInput);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export interface ComputedTimelineParams {
  start: Date;
  end: Date;
  totalDays: number;
}

export function computeTaskDates(tasks: Task[], j0Input: string | Date | null | undefined): {
  computedTasks: Task[];
  params: ComputedTimelineParams;
} {
  const j0Date = toDate(j0Input);
  const datesMap: Record<string, { start: Date; end: Date }> = {
    J0: { start: j0Date, end: j0Date },
  };

  // Deep clone tasks to avoid direct mutations
  const computedTasks: Task[] = tasks.map((t) => ({ ...t }));
  const resolved = new Set<string>(['J0']);

  let iterations = 0;
  const maxIterations = Math.max(tasks.length * 3, 10);

  // Topological / dependency resolution
  while (resolved.size < tasks.length + 1 && iterations < maxIterations) {
    iterations++;
    let progress = false;

    for (const task of computedTasks) {
      if (resolved.has(task.id)) continue;

      if (!task.dependsOn || resolved.has(task.dependsOn)) {
        let startDate: Date;
        if (!task.dependsOn || !datesMap[task.dependsOn]) {
          startDate = task.manualStart ? toDate(task.manualStart) : new Date(j0Date.getTime());
        } else {
          startDate = addDays(datesMap[task.dependsOn].end, Number(task.offset) || 0);
        }

        const duration = Math.max(1, Number(task.duration) || 1);
        const endDate = addDays(startDate, duration);

        task.computedStart = startDate;
        task.computedEnd = endDate;

        datesMap[task.id] = { start: startDate, end: endDate };
        resolved.add(task.id);
        progress = true;
      }
    }

    if (!progress) {
      // Fallback for circular or unresolvable dependencies
      for (const task of computedTasks) {
        if (!resolved.has(task.id)) {
          const startDate = task.manualStart ? toDate(task.manualStart) : new Date(j0Date.getTime());
          const duration = Math.max(1, Number(task.duration) || 1);
          const endDate = addDays(startDate, duration);
          task.computedStart = startDate;
          task.computedEnd = endDate;
          datesMap[task.id] = { start: startDate, end: endDate };
          resolved.add(task.id);
        }
      }
      break;
    }
  }

  // Determine timeline boundaries based on actual task dates
  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  for (const task of computedTasks) {
    if (task.computedStart) {
      if (!minStart || task.computedStart < minStart) {
        minStart = new Date(task.computedStart.getTime());
      }
    }
    if (task.computedEnd) {
      if (!maxEnd || task.computedEnd > maxEnd) {
        maxEnd = new Date(task.computedEnd.getTime());
      }
    }
  }

  if (!minStart) {
    minStart = new Date(j0Date.getTime());
    maxEnd = addDays(j0Date, 30);
  } else {
    // If J0 is within 14 days before the earliest task, include J0 in timeline
    if (j0Date <= minStart && diffDays(j0Date, minStart) <= 14) {
      minStart = new Date(j0Date.getTime());
    }
    if (!maxEnd) {
      maxEnd = addDays(minStart, 30);
    }
  }

  const timelineStart = addDays(minStart, -2);
  let timelineEnd = addDays(maxEnd, 4);
  let totalDays = diffDays(timelineStart, timelineEnd);

  if (isNaN(totalDays) || totalDays < 5) {
    totalDays = 5;
    timelineEnd = addDays(timelineStart, 5);
  }

  return {
    computedTasks,
    params: {
      start: timelineStart,
      end: timelineEnd,
      totalDays,
    },
  };
}

export interface HeaderBlock {
  name: string;
  days: number;
}

export function generateTimelineHeaders(params: ComputedTimelineParams) {
  const safeStart = toDate(params.start);
  const totalDays = Math.max(1, Number(params.totalDays) || 30);

  let curMonth = safeStart.getMonth();
  let curYear = safeStart.getFullYear();
  let daysInMonth = 0;
  const qData: HeaderBlock[] = [];
  const mData: HeaderBlock[] = [];

  for (let i = 0; i < totalDays; i++) {
    const loopDate = addDays(safeStart, i);
    if (loopDate.getMonth() !== curMonth) {
      if (daysInMonth > 0) {
        const mName = new Date(curYear, curMonth, 1).toLocaleDateString('fr-FR', {
          month: 'long',
        });
        mData.push({ name: mName, days: daysInMonth });

        const qName = `${curYear} T${Math.floor(curMonth / 3) + 1}`;
        const lastQ = qData[qData.length - 1];
        if (lastQ && lastQ.name === qName) {
          lastQ.days += daysInMonth;
        } else {
          qData.push({ name: qName, days: daysInMonth });
        }
      }
      curMonth = loopDate.getMonth();
      curYear = loopDate.getFullYear();
      daysInMonth = 0;
    }
    daysInMonth++;
  }

  // Flush remaining month and quarter
  if (daysInMonth > 0) {
    const mName = new Date(curYear, curMonth, 1).toLocaleDateString('fr-FR', {
      month: 'long',
    });
    mData.push({ name: mName, days: daysInMonth });

    const qName = `${curYear} T${Math.floor(curMonth / 3) + 1}`;
    const lastQ = qData[qData.length - 1];
    if (lastQ && lastQ.name === qName) {
      lastQ.days += daysInMonth;
    } else {
      qData.push({ name: qName, days: daysInMonth });
    }
  }

  return { quarters: qData, months: mData };
}

export const TASK_COLOR_MAP: Record<string, { bg: string; text: string; hex: string }> = {
  Jaune: { bg: 'bg-[#f2c94c]', text: 'text-black', hex: '#f2c94c' },
  Bleu: { bg: 'bg-[#5bc0de]', text: 'text-black', hex: '#5bc0de' },
  RougeClair: { bg: 'bg-[#f06292]', text: 'text-black', hex: '#f06292' },
  Vert: { bg: 'bg-[#4ade80]', text: 'text-black', hex: '#4ade80' },
  Violet: { bg: 'bg-[#c084fc]', text: 'text-black', hex: '#c084fc' },
  Orange: { bg: 'bg-[#fb923c]', text: 'text-black', hex: '#fb923c' },
};

export const DEFAULT_TASKS: Task[] = [
  { name: 'Présentation projet au client', id: 'PPC', dependsOn: 'J0', offset: 0, duration: 1, color: 'Jaune', manualStart: null },
  { name: 'Go no Go', id: 'GNG', dependsOn: 'PPC', offset: 10, duration: 1, color: 'Jaune', manualStart: null },
  { name: 'Doc conception', id: 'DCP', dependsOn: 'GNG', offset: 15, duration: 15, color: 'Bleu', manualStart: null },
  { name: 'Orga Logistique', id: 'OLG', dependsOn: 'DCP', offset: -7, duration: 10, color: 'Bleu', manualStart: null },
  { name: 'Tournage', id: 'TRN', dependsOn: 'OLG', offset: 5, duration: 4, color: 'RougeClair', manualStart: null },
  { name: 'Montage', id: 'MTG', dependsOn: 'TRN', offset: 1, duration: 10, color: 'Bleu', manualStart: null },
  { name: 'Go Live', id: 'GLV', dependsOn: 'MTG', offset: 3, duration: 1, color: 'Jaune', manualStart: null },
  { name: 'Rapport de performance', id: 'PRF', dependsOn: 'GLV', offset: 45, duration: 1, color: 'Jaune', manualStart: null },
];
