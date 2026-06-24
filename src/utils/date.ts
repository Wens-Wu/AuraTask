export const pad = (n: number) => String(n).padStart(2, "0");

export const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromISODate = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * The calendar-date label that an instant belongs to once the "day starts at
 * `dayStartHour`" rule is applied. With dayStartHour=4, anything before 04:00
 * counts toward the previous calendar day. Use this for "now"; calendar-date
 * labels already stored on tasks/cells are compared against the result as-is.
 */
export const logicalDateISO = (d: Date, dayStartHour: number): string =>
  toISODate(new Date(d.getTime() - dayStartHour * 3600_000));

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfWeek = (d: Date) => {
  // Monday as week start
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const weekDays = (anchor: Date): Date[] => {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const monthGrid = (anchor: Date): Date[] => {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

type Lang = "zh" | "en";
const WEEK_LABELS_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const WEEK_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const weekdayLabel = (d: Date, lang: Lang = "zh") =>
  (lang === "zh" ? WEEK_LABELS_ZH : WEEK_LABELS_EN)[(d.getDay() + 6) % 7];

export const formatLongDate = (d: Date, lang: Lang = "zh") => {
  if (lang === "en") {
    return `${MONTH_NAMES_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${weekdayLabel(d, "en")}`;
  }
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${weekdayLabel(d, "zh")}`;
};

export const formatMonth = (d: Date, lang: Lang = "zh") => {
  if (lang === "en") return `${MONTH_NAMES_EN[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
};

/** Compact day-view header with weekday but no year, e.g. 6 月 9 日 · 周三 / Jun 9 · Wed */
export const formatDayHeader = (d: Date, lang: Lang = "zh") =>
  lang === "en"
    ? `${MONTH_NAMES_EN[d.getMonth()]} ${d.getDate()} · ${weekdayLabel(d, "en")}`
    : `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${weekdayLabel(d, "zh")}`;

/** Week-view header range, dropping the repeated month within one month.
 *  e.g. 6 月 8 日 – 14 日 / 6 月 8 日 – 7 月 1 日 (Jun 8 – 14 / Jun 8 – Jul 1) */
export const formatWeekRange = (start: Date, end: Date, lang: Lang = "zh") => {
  const sameMonth = start.getMonth() === end.getMonth();
  if (lang === "en") {
    const left = `${MONTH_NAMES_EN[start.getMonth()]} ${start.getDate()}`;
    const right = sameMonth
      ? `${end.getDate()}`
      : `${MONTH_NAMES_EN[end.getMonth()]} ${end.getDate()}`;
    return `${left} – ${right}`;
  }
  const left = `${start.getMonth() + 1} 月 ${start.getDate()} 日`;
  const right = sameMonth ? `${end.getDate()} 日` : `${end.getMonth() + 1} 月 ${end.getDate()} 日`;
  return `${left} – ${right}`;
};
