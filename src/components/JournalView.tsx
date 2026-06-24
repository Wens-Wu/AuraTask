import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  clearRecordLog,
  createRecordItem,
  deleteRecordItem,
  latestRecordLogDate,
  listRecordItems,
  listRecordLogs,
  listRecordLogsForItem,
  updateRecordItem,
  upsertRecordLog,
} from "../db/database";
import type {
  NewRecordItem,
  RecordItem,
  RecordKind,
  RecordLog,
} from "../types";
import { useT } from "../i18n";
import { useSettings } from "../settings";
import {
  addDays,
  endOfMonth,
  formatLongDate,
  formatMonth,
  fromISODate,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "../utils/date";

const HEATMAP_DAYS = 30;
const EMOJI_PRESETS = ["📝", "🌙", "🩸", "💊", "💧", "☕", "⚖️", "🌡️", "😊", "⭐"];
const WEEKDAYS_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function JournalView() {
  const { t } = useT();
  const { todayISO } = useSettings();
  const [items, setItems] = useState<RecordItem[]>([]);
  const [logs, setLogs] = useState<RecordLog[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [selected, setSelected] = useState<RecordItem | null>(null);

  const refresh = useCallback(async () => {
    const startISO = toISODate(addDays(fromISODate(todayISO), -HEATMAP_DAYS + 1));
    const [nextItems, nextLogs] = await Promise.all([
      listRecordItems(),
      listRecordLogs(startISO, todayISO),
    ]);
    setItems(nextItems);
    setLogs(nextLogs);
    setSelected((current) =>
      current ? nextItems.find((item) => item.id === current.id) ?? null : null,
    );
  }, [todayISO]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const saveItem = async (item: NewRecordItem) => {
    if (editing) await updateRecordItem(editing.id, item);
    else await createRecordItem(item);
    setEditing(null);
    setCreating(false);
    await refresh();
  };

  const saveLog = async (itemId: number, date: string, value: number) => {
    await upsertRecordLog(itemId, date, value);
    await refresh();
  };

  const clearLog = async (itemId: number, date: string) => {
    await clearRecordLog(itemId, date);
    await refresh();
  };

  if (selected) {
    return (
      <>
        <RecordDetail
          item={selected}
          todayISO={todayISO}
          onBack={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onChanged={refresh}
        />
        {editing && (
          <RecordDialog
            existing={editing}
            onCancel={() => setEditing(null)}
            onSubmit={saveItem}
            onDelete={async () => {
              await deleteRecordItem(editing.id);
              setEditing(null);
              setSelected(null);
              await refresh();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="day-header">
        <div className="day-counts">
          {t(`${items.length} 个记录项`, `${items.length} record${items.length === 1 ? "" : "s"}`)}
        </div>
        <div className="day-header-actions">
          <button className="primary-btn" onClick={() => setCreating(true)}>
            + {t("新建记录项", "New record")}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          {t(
            "还没有记录项。可以记录生理期、早睡、体重或任何你关心的事情。",
            "No records yet. Track sleep, periods, weight, or anything you care about.",
          )}
          <button className="link-btn" onClick={() => setCreating(true)}>
            {t("创建第一个", "Create your first one")}
          </button>
        </div>
      ) : (
        <div className="habit-list">
          {items.map((item) => (
            <RecordCard
              key={item.id}
              item={item}
              logs={logs.filter((log) => log.item_id === item.id)}
              todayISO={todayISO}
              onOpen={() => setSelected(item)}
              onEdit={() => setEditing(item)}
              onSave={(value) => saveLog(item.id, todayISO, value)}
              onClear={() => clearLog(item.id, todayISO)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <RecordDialog
          existing={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={saveItem}
          onDelete={
            editing
              ? async () => {
                  await deleteRecordItem(editing.id);
                  setEditing(null);
                  await refresh();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function RecordCard({
  item,
  logs,
  todayISO,
  onOpen,
  onEdit,
  onSave,
  onClear,
}: {
  item: RecordItem;
  logs: RecordLog[];
  todayISO: string;
  onOpen: () => void;
  onEdit: () => void;
  onSave: (value: number) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const { t } = useT();
  const logMap = new Map(logs.map((log) => [log.date, log.value]));
  const todayValue = logMap.get(todayISO);
  const [value, setValue] = useState(todayValue == null ? "" : String(todayValue));
  const recordedDays = logs.length;
  const quantityAverage =
    recordedDays > 0
      ? logs.reduce((total, log) => total + log.value, 0) / recordedDays
      : 0;
  const cells = Array.from({ length: HEATMAP_DAYS }, (_, index) => {
    const date = addDays(fromISODate(todayISO), index - HEATMAP_DAYS + 1);
    const iso = toISODate(date);
    return { iso, value: logMap.get(iso) };
  });
  const maxValue = Math.max(0, ...cells.map((cell) => Math.abs(cell.value ?? 0)));

  useEffect(() => {
    setValue(todayValue == null ? "" : String(todayValue));
  }, [todayValue]);

  return (
    <article className="habit-card record-card" onClick={onOpen}>
      <div className="habit-card-head">
        <div className="habit-name">
          <span className="habit-emoji">{item.emoji}</span>
          <span>{item.name}</span>
          <span className="habit-sched-tag">
            {item.kind === "binary" ? t("二元", "Binary") : t("量化", "Quantity")}
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          aria-label={t("编辑", "Edit")}
        >
          <EditIcon />
        </button>
      </div>

      <div className="habit-stats">
        <div>
          <span className="num">{recordedDays}</span>
          <span className="lbl">{t("近 30 天记录", "logged in 30 days")}</span>
        </div>
        {item.kind === "quantity" && (
          <div>
            <span className="num">
              {formatValue(quantityAverage)}
              <span className="num-unit">{item.unit ?? ""}</span>
            </span>
            <span className="lbl">{t("近 30 天平均", "30-day average")}</span>
          </div>
        )}
      </div>

      <div className="habit-heatmap">
        {cells.map((cell) => (
          <div
            key={cell.iso}
            className={`heat-cell heat-${heatLevel(item, cell.value, maxValue)} ${
              cell.iso === todayISO ? "is-today" : ""
            }`}
            title={`${cell.iso}: ${cell.value ?? "—"}${item.unit ?? ""}`}
          />
        ))}
      </div>

      <div className="habit-actions" onClick={(event) => event.stopPropagation()}>
        {item.kind === "binary" ? (
          <button
            className={`primary-btn ${todayValue != null ? "muted" : ""}`}
            onClick={() => (todayValue == null ? onSave(1) : onClear())}
          >
            {todayValue != null
              ? t("✓ 今天已记录", "✓ Recorded today")
              : t("记录今天", "Record today")}
          </button>
        ) : (
          <>
            <input
              type="number"
              step="any"
              value={value}
              placeholder={t(`今天 (${item.unit ?? ""})`, `Today (${item.unit ?? ""})`)}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && Number.isFinite(Number(value))) {
                  onSave(Number(value));
                }
              }}
            />
            <button
              className="primary-btn"
              disabled={value.trim() === "" || !Number.isFinite(Number(value))}
              onClick={() => onSave(Number(value))}
            >
              {t("记录", "Log")}
            </button>
            {todayValue != null && (
              <button
                className="ghost-btn"
                onClick={() => {
                  setValue("");
                  onClear();
                }}
              >
                {t("清除", "Clear")}
              </button>
            )}
          </>
        )}
        <button className="record-open-link" onClick={onOpen}>
          {t("查看详情 ›", "View details ›")}
        </button>
      </div>
    </article>
  );
}

function RecordDetail({
  item,
  todayISO,
  onBack,
  onEdit,
  onChanged,
}: {
  item: RecordItem;
  todayISO: string;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t, lang } = useT();
  const [rangeMode, setRangeMode] = useState<"week" | "month" | "year">("month");
  const [anchor, setAnchor] = useState(() => fromISODate(todayISO));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [logs, setLogs] = useState<RecordLog[]>([]);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const range = useMemo(() => {
    if (item.kind === "binary") {
      return {
        start: new Date(anchor.getFullYear(), 0, 1),
        end: new Date(anchor.getFullYear(), 11, 31),
      };
    }
    if (rangeMode === "week") {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 6) };
    }
    if (rangeMode === "year") {
      return {
        start: new Date(anchor.getFullYear(), 0, 1),
        end: new Date(anchor.getFullYear(), 11, 31),
      };
    }
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }, [anchor, item.kind, rangeMode, todayISO]);
  const rangeStartISO = toISODate(range.start);
  const rangeEndISO = toISODate(range.end);

  const refresh = useCallback(async () => {
    const [rangeLogs, latest] = await Promise.all([
      listRecordLogsForItem(item.id, rangeStartISO, rangeEndISO),
      latestRecordLogDate(item.id),
    ]);
    setLogs(rangeLogs);
    setLatestDate(latest);
  }, [item.id, rangeEndISO, rangeStartISO]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const logMap = useMemo(
    () => new Map(logs.map((log) => [log.date, log.value])),
    [logs],
  );
  const selectedValue = logMap.get(selectedDate);
  const average =
    logs.length > 0
      ? logs.reduce((total, log) => total + log.value, 0) / logs.length
      : 0;
  const sumValue = logs.reduce((acc, log) => acc + log.value, 0);
  const maxValue = logs.length ? Math.max(...logs.map((log) => log.value)) : 0;
  const daysSinceLatest =
    latestDate == null
      ? null
      : Math.round(
          (fromISODate(todayISO).getTime() - fromISODate(latestDate).getTime()) / 86400000,
        );
  const latestText =
    daysSinceLatest == null
      ? null
      : daysSinceLatest <= 0
        ? t("今天", "Today")
        : daysSinceLatest === 1
          ? t("昨天", "Yesterday")
          : t(`${daysSinceLatest} 天前`, `${daysSinceLatest}d ago`);
  const statItems =
    item.kind === "quantity"
      ? [
          { label: t("合计", "Total"), value: `${formatValue(sumValue)}${item.unit ?? ""}` },
          { label: t("平均", "Avg"), value: `${formatValue(average)}${item.unit ?? ""}` },
          { label: t("最高", "Max"), value: `${formatValue(maxValue)}${item.unit ?? ""}` },
          { label: t("记录", "Logged"), value: `${logs.length} ${t("天", "d")}` },
        ]
      : [{ label: t("记录", "Logged"), value: `${logs.length} ${t("天", "d")}` }];

  useEffect(() => {
    setValue(selectedValue == null ? "" : String(selectedValue));
  }, [selectedDate, selectedValue]);

  const changeRange = (offset: number) => {
    if (item.kind === "binary") {
      const next = new Date(anchor.getFullYear() + offset, 0, 1);
      setAnchor(next);
      const jan1 = toISODate(next);
      setSelectedDate(jan1 > todayISO ? todayISO : jan1);
      return;
    }
    const next =
      rangeMode === "week"
        ? addDays(anchor, offset * 7)
        : rangeMode === "year"
          ? new Date(anchor.getFullYear() + offset, 0, 1)
        : new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
    setAnchor(next);
    const candidate = toISODate(
      rangeMode === "week"
        ? startOfWeek(next)
        : rangeMode === "year"
          ? new Date(next.getFullYear(), 0, 1)
          : startOfMonth(next),
    );
    setSelectedDate(candidate > todayISO ? todayISO : candidate);
  };

  const save = async (nextValue: number) => {
    await upsertRecordLog(item.id, selectedDate, nextValue);
    await Promise.all([refresh(), onChanged()]);
  };

  const clear = async () => {
    await clearRecordLog(item.id, selectedDate);
    setValue("");
    await Promise.all([refresh(), onChanged()]);
  };

  const removeLog = async (date: string) => {
    await clearRecordLog(item.id, date);
    if (date === selectedDate) setValue("");
    await Promise.all([refresh(), onChanged()]);
  };

  const canGoNext = range.end < fromISODate(todayISO);
  const rangeLabel =
    item.kind === "binary"
      ? `${anchor.getFullYear()}`
      : rangeMode === "week"
        ? `${rangeStartISO.slice(5)} – ${rangeEndISO.slice(5)}`
        : rangeMode === "year"
          ? `${range.start.getFullYear()}`
          : formatMonth(range.start, lang);

  return (
    <div className="record-detail">
      <div className="day-header record-detail-header">
        <button className="record-back-btn" onClick={onBack} aria-label={t("返回", "Back")}>
          ←
        </button>
        <div className="record-detail-title">
          <span className="habit-emoji">{item.emoji}</span>
          <span className="record-detail-name">{item.name}</span>
          <span className="habit-sched-tag">
            {item.kind === "binary" ? t("二元", "Binary") : t("量化", "Quantity")}
          </span>
        </div>
        <div className="record-detail-header-right">
          {latestText && (
            <span className="record-detail-latest">
              {t("最近", "Last")} {latestText}
            </span>
          )}
          <button className="icon-btn" onClick={onEdit} aria-label={t("编辑", "Edit")}>
            <EditIcon />
          </button>
        </div>
      </div>

      <div className="record-chart-toolbar">
        {item.kind === "quantity" && (
          <div className="segmented record-range-mode">
            <button
              className={rangeMode === "week" ? "active" : ""}
              onClick={() => {
                setRangeMode("week");
                setAnchor(fromISODate(todayISO));
                setSelectedDate(todayISO);
              }}
            >
              {t("周", "Week")}
            </button>
            <button
              className={rangeMode === "month" ? "active" : ""}
              onClick={() => {
                setRangeMode("month");
                setAnchor(fromISODate(todayISO));
                setSelectedDate(todayISO);
              }}
            >
              {t("月", "Month")}
            </button>
            <button
              className={rangeMode === "year" ? "active" : ""}
              onClick={() => {
                setRangeMode("year");
                setAnchor(fromISODate(todayISO));
                setSelectedDate(todayISO);
              }}
            >
              {t("年", "Year")}
            </button>
          </div>
        )}
        <div className="record-range-nav">
          <button className="icon-btn" onClick={() => changeRange(-1)}>
            ‹
          </button>
          <strong>{rangeLabel}</strong>
          <button
            className="icon-btn"
            disabled={!canGoNext}
            onClick={() => changeRange(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="record-stats">
        {statItems.map((stat, index) => (
          <Fragment key={stat.label}>
            {index > 0 && <span className="record-stats-sep">·</span>}
            <span>
              {stat.label} <b>{stat.value}</b>
            </span>
          </Fragment>
        ))}
      </div>

      {item.kind === "binary" ? (
        <BinaryContributionChart
          start={range.start}
          end={range.end}
          logMap={logMap}
          todayISO={todayISO}
          selectedDate={selectedDate}
          lang={lang}
          onSelect={setSelectedDate}
        />
      ) : (
        <QuantityLineChart
          start={range.start}
          end={range.end}
          logMap={logMap}
          unit={item.unit}
          selectedDate={selectedDate}
          lang={lang}
          onSelect={setSelectedDate}
        />
      )}

      <div className="record-day-editor">
        <div className="record-editor-date-wrap">
          <span>{t("编辑日期", "Edit date")}</span>
          <input
            className="record-editor-date"
            type="date"
            value={selectedDate}
            max={todayISO}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
        {item.kind === "binary" ? (
          <button
            className={`primary-btn ${selectedValue != null ? "muted" : ""}`}
            onClick={() => (selectedValue == null ? save(1) : clear())}
          >
            {selectedValue != null ? t("✓ 已记录，点击清除", "✓ Recorded, click to clear") : t("标记记录", "Mark recorded")}
          </button>
        ) : (
          <div className="record-day-editor-actions">
            <input
              type="number"
              step="any"
              value={value}
              placeholder={t("输入数值", "Enter value")}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && Number.isFinite(Number(value))) {
                  save(Number(value));
                }
              }}
            />
            <span>{item.unit}</span>
            <button
              className="primary-btn"
              disabled={value.trim() === "" || !Number.isFinite(Number(value))}
              onClick={() => save(Number(value))}
            >
              {t("保存", "Save")}
            </button>
            {selectedValue != null && (
              <button className="ghost-btn" onClick={clear}>
                {t("清除", "Clear")}
              </button>
            )}
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="record-log-list">
          <div className="record-log-list-title">{t("记录明细", "Entries")}</div>
          <div className="record-log-scroll">
            {[...logs].reverse().map((log) => (
              <div
                key={log.date}
                className={`record-log-row ${log.date === selectedDate ? "selected" : ""}`}
                onClick={() => setSelectedDate(log.date)}
              >
                <span className="record-log-date">
                  {formatLongDate(fromISODate(log.date), lang)}
                </span>
                <span className="record-log-value">
                  {item.kind === "binary"
                    ? t("已记录", "Recorded")
                    : `${formatValue(log.value)}${item.unit ?? ""}`}
                </span>
                <button
                  className="record-log-del"
                  aria-label={t("删除", "Delete")}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeLog(log.date);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BinaryContributionChart({
  start,
  end,
  logMap,
  todayISO,
  selectedDate,
  lang,
  onSelect,
}: {
  start: Date;
  end: Date;
  logMap: Map<string, number>;
  todayISO: string;
  selectedDate: string;
  lang: "zh" | "en";
  onSelect: (date: string) => void;
}) {
  const { t } = useT();
  const gridStart = startOfWeek(start);
  const days = Array.from({ length: 53 * 7 }, (_, index) => addDays(gridStart, index));
  const monthLabels = new Map<number, string>();
  const seenMonths = new Set<string>();
  days.forEach((day, index) => {
    if (day.getDate() <= 7) {
      const week = Math.floor(index / 7);
      const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        monthLabels.set(
          week,
          lang === "zh"
            ? `${day.getMonth() + 1}月`
            : day.toLocaleString("en", { month: "short" }),
        );
      }
    }
  });

  return (
    <div className="record-contribution-card">
      <div className="record-contribution-scroll">
        <div className="record-contribution-layout">
          <div className="record-contribution-months">
            {Array.from({ length: 53 }, (_, week) => (
              <span key={week}>{monthLabels.get(week) ?? ""}</span>
            ))}
          </div>
          <div className="record-contribution-body">
            <div className="record-contribution-weekdays">
              {(lang === "zh" ? WEEKDAYS_ZH : WEEKDAYS_EN).map((day, index) => (
                <span key={day}>{index % 2 === 0 ? day : ""}</span>
              ))}
            </div>
            <div className="record-contribution-grid">
              {days.map((day, index) => {
                const iso = toISODate(day);
                const inRange = day >= start && day <= end && iso <= todayISO;
                const recorded = inRange && logMap.has(iso);
                return (
                  <button
                    key={iso}
                    style={{
                      gridColumn: Math.floor(index / 7) + 1,
                      gridRow: (index % 7) + 1,
                    }}
                    className={[
                      "record-contribution-cell",
                      recorded ? "recorded" : "",
                      iso === todayISO ? "today" : "",
                      iso === selectedDate ? "selected" : "",
                      inRange ? "" : "outside",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={!inRange}
                    title={`${formatLongDate(day, lang)}: ${
                      recorded ? t("已记录", "Recorded") : t("未记录", "Not recorded")
                    }`}
                    onClick={() => onSelect(iso)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="record-contribution-legend">
        <span>{t("未记录", "Not recorded")}</span>
        <i />
        <i className="recorded" />
        <span>{t("已记录", "Recorded")}</span>
      </div>
    </div>
  );
}

function QuantityLineChart({
  start,
  end,
  logMap,
  unit,
  selectedDate,
  lang,
  onSelect,
}: {
  start: Date;
  end: Date;
  logMap: Map<string, number>;
  unit: string | null;
  selectedDate: string;
  lang: "zh" | "en";
  onSelect: (date: string) => void;
}) {
  const { t } = useT();
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  const points = days.flatMap((day, index) => {
    const iso = toISODate(day);
    const recordedValue = logMap.get(iso);
    return recordedValue == null ? [] : [{ day, iso, value: recordedValue, index }];
  });
  const values = points.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const width = 900;
  const height = 260;
  const padding = { left: 56, right: 24, top: 24, bottom: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) =>
    padding.left +
    (days.length === 1 ? plotWidth / 2 : (index / (days.length - 1)) * plotWidth);
  const y = (recordedValue: number) =>
    padding.top + ((max - recordedValue) / span) * plotHeight;
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.index)} ${y(point.value)}`,
    )
    .join(" ");

  return (
    <div className="record-line-card">
      {points.length === 0 ? (
        <div className="record-chart-empty">
          {t("这个区间还没有量化记录", "No values in this range")}
        </div>
      ) : (
        <svg className="record-line-chart" viewBox={`0 0 ${width} ${height}`} role="img">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const gridY = padding.top + ratio * plotHeight;
            return (
              <g key={ratio}>
                <line
                  className="record-chart-gridline"
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={gridY}
                  y2={gridY}
                />
                <text
                  className="record-chart-axis"
                  x={padding.left - 10}
                  y={gridY + 4}
                  textAnchor="end"
                >
                  {formatValue(max - ratio * span)}
                </text>
              </g>
            );
          })}
          <path className="record-chart-line" d={path} />
          {points.map((point) => (
            <circle
              key={point.iso}
              className={`record-chart-point ${
                point.iso === selectedDate ? "selected" : ""
              }`}
              cx={x(point.index)}
              cy={y(point.value)}
              r={point.iso === selectedDate ? 6 : 4}
              onClick={() => onSelect(point.iso)}
            >
              <title>{`${formatLongDate(point.day, lang)}: ${formatValue(
                point.value,
              )}${unit ?? ""}`}</title>
            </circle>
          ))}
          {days.map((day, index) => {
            const step = days.length <= 7 ? 1 : Math.max(1, Math.ceil(days.length / 6));
            if (index % step !== 0 && index !== days.length - 1) return null;
            return (
              <text
                key={toISODate(day)}
                className="record-chart-axis"
                x={x(index)}
                y={height - 14}
                textAnchor="middle"
              >
                {`${day.getMonth() + 1}/${day.getDate()}`}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function RecordDialog({
  existing,
  onCancel,
  onSubmit,
  onDelete,
}: {
  existing: RecordItem | null;
  onCancel: () => void;
  onSubmit: (item: NewRecordItem) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { t } = useT();
  const [name, setName] = useState(existing?.name ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "📝");
  const [kind, setKind] = useState<RecordKind>(existing?.kind ?? "binary");
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        emoji,
        kind,
        unit: kind === "quantity" ? unit.trim() || null : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onMouseDown={onCancel}>
      <form className="dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>{existing ? t("编辑记录项", "Edit record") : t("新建记录项", "New record")}</h2>
        <div className="field-row">
          <div className="field">
            <label>{t("名称", "Name")}</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("生理期、早睡、体重…", "Period, early sleep, weight…")}
            />
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>{t("图标", "Icon")}</label>
            <input value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={4} />
          </div>
        </div>
        <div className="emoji-presets">
          {EMOJI_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset}
              className={`emoji-preset ${emoji === preset ? "active" : ""}`}
              onClick={() => setEmoji(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="field">
          <label>{t("记录类型", "Record type")}</label>
          <div className="segmented">
            <button
              type="button"
              className={kind === "binary" ? "active" : ""}
              onClick={() => setKind("binary")}
            >
              {t("二元 · 是或否", "Binary · yes or no")}
            </button>
            <button
              type="button"
              className={kind === "quantity" ? "active" : ""}
              onClick={() => setKind("quantity")}
            >
              {t("量化 · 记录数值", "Quantity · numeric value")}
            </button>
          </div>
        </div>
        {kind === "quantity" && (
          <div className="field">
            <label>{t("单位（可选）", "Unit (optional)")}</label>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder={t("kg、小时、ml…", "kg, hours, ml…")}
            />
          </div>
        )}
        <div className="dialog-footer">
          {existing && onDelete && (
            <button
              type="button"
              className="ghost-btn danger"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    t(
                      "删除这个记录项？已有记录也会一并删除。",
                      "Delete this record and all its history?",
                    ),
                  )
                )
                  return;
                setBusy(true);
                try {
                  await onDelete();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("删除", "Delete")}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {t("取消", "Cancel")}
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !name.trim()}>
            {existing ? t("保存", "Save") : t("添加", "Add")}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function heatLevel(item: RecordItem, value: number | undefined, maxValue: number): number {
  if (value == null) return 0;
  if (item.kind === "binary") return 4;
  if (maxValue <= 0) return 1;
  const ratio = Math.abs(value) / maxValue;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}
