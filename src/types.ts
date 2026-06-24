export type Priority = 0 | 1; // 0 = 延伸, 1 = 主要

export type TimeSlot = "morning" | "afternoon" | "evening";

export const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "上午",
  afternoon: "下午",
  evening: "晚上",
};
const TIME_SLOT_LABEL_EN: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
export const TIME_SLOT_ORDER: TimeSlot[] = ["morning", "afternoon", "evening"];
export const timeSlotLabel = (s: TimeSlot, lang: "zh" | "en" = "zh") =>
  (lang === "zh" ? TIME_SLOT_LABEL : TIME_SLOT_LABEL_EN)[s];

export interface Task {
  id: number;
  title: string;
  notes: string | null;
  subject: string | null;
  priority: Priority;
  due_date: string | null; // YYYY-MM-DD or null for inbox
  completed_at: string | null;
  created_at: string;
  time_slot: TimeSlot | null;
  position: number;
  color: string | null; // hex like "#10b981"; null = default accent
}

export interface NewTask {
  title: string;
  notes?: string | null;
  subject?: string | null;
  priority?: Priority;
  due_date: string | null;
  time_slot?: TimeSlot | null;
  color?: string | null;
}

// Preset palette for task display color. null (not listed here) = default accent.
export const TASK_COLORS: { value: string; label: string; labelEn: string }[] = [
  { value: "#0ea5e9", label: "天蓝", labelEn: "Sky" },
  { value: "#10b981", label: "翠绿", labelEn: "Green" },
  { value: "#14b8a6", label: "青绿", labelEn: "Teal" },
  { value: "#f59e0b", label: "琥珀", labelEn: "Amber" },
  { value: "#ef4444", label: "朱红", labelEn: "Red" },
  { value: "#ec4899", label: "品红", labelEn: "Pink" },
  { value: "#8b5cf6", label: "紫罗兰", labelEn: "Violet" },
  { value: "#64748b", label: "石墨", labelEn: "Slate" },
];

export type ViewMode =
  | "day"
  | "week"
  | "month"
  | "focus"
  | "stats"
  | "inbox"
  | "habits"
  | "journal"
  | "goals";

export type HabitKind = "binary" | "quantity";

/** When a habit is expected to be done.
 *  - daily: every day
 *  - days: specific ISO weekdays (1=Mon … 7=Sun)
 *  - weekly: any N days within a Monday-start week
 *  Persisted in the `schedule` TEXT column as "daily" | "days:1,3,5" | "weekly:2". */
export type HabitSchedule =
  | { kind: "daily" }
  | { kind: "days"; days: number[] }
  | { kind: "weekly"; count: number };

export interface Habit {
  id: number;
  name: string;
  emoji: string;
  kind: HabitKind;
  target_value: number | null;
  unit: string | null;
  schedule: string; // raw encoding; read via parseSchedule()
  archived_at: string | null;
  created_at: string;
}

export interface NewHabit {
  name: string;
  emoji: string;
  kind: HabitKind;
  target_value: number | null;
  unit: string | null;
  schedule: string;
}

export interface HabitLog {
  habit_id: number;
  date: string;
  value: number;
}

export type RecordKind = "binary" | "quantity";

export interface RecordItem {
  id: number;
  name: string;
  emoji: string;
  kind: RecordKind;
  unit: string | null;
  created_at: string;
}

export interface NewRecordItem {
  name: string;
  emoji: string;
  kind: RecordKind;
  unit: string | null;
}

export interface RecordLog {
  item_id: number;
  date: string;
  value: number;
  updated_at: string;
}

export type SessionKind = "focus" | "break";

export interface FocusSession {
  id: number;
  task_id: number | null;
  kind: SessionKind;
  duration_sec: number;
  session_date: string;
  started_at: string;
  ended_at: string;
}

export interface NewFocusSession {
  task_id: number | null;
  kind: SessionKind;
  duration_sec: number;
  started_at: string;
  ended_at: string;
}

export interface DayMetric {
  date: string;
  focus_min: number;
  done: number;
  planned: number;
}

export interface SubjectMetric {
  subject: string;
  focus_min: number;
  task_count: number;
}

export interface DailyMood {
  date: string;
  mood: string; // emoji
  score: number; // 1..5
}

export interface DailyNote {
  date: string;
  text: string;
}

// Ordered worst → best, so the day-view picker reads left-to-right as
// increasingly happy.
export const MOOD_OPTIONS: { emoji: string; score: number; label: string; labelEn: string }[] = [
  { emoji: "😭", score: 1, label: "糟糕", labelEn: "Bad" },
  { emoji: "😕", score: 2, label: "不太好", labelEn: "Meh" },
  { emoji: "😐", score: 3, label: "一般", labelEn: "Okay" },
  { emoji: "🙂", score: 4, label: "不错", labelEn: "Good" },
  { emoji: "😄", score: 5, label: "很好", labelEn: "Great" },
];
