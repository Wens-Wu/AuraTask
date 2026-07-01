# AuraTask

**English** · [简体中文](./README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-v0.1.0-4f46e5?style=flat-square)](https://github.com/Wens-Wu/AuraTask/releases/tag/v0.1.0)
[![Latest release](https://img.shields.io/github/v/release/Wens-Wu/AuraTask?label=download&color=4f46e5&style=flat-square)](https://github.com/Wens-Wu/AuraTask/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Wens-Wu/AuraTask/total?style=flat-square)](https://github.com/Wens-Wu/AuraTask/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=flat-square)](#install-end-user)

AuraTask folds the handful of things you do every day — planning tasks, focusing in short bursts, building habits, logging anything, tracking how you feel — into a single lightweight native app. Everything lives in a local SQLite file, fully offline.

## Features

- **Tasks** — day / week / month calendar; **primary / secondary** priority; morning / afternoon / evening color bands; drag a task across days in the week view; a one-line daily note per day;
- **Later** — a parking spot for undated tasks until you schedule them;
- **Habits** — binary or quantitative, with flexible schedules (daily / chosen weekdays / N× per week), streaks, completion rate, and a mini heatmap;
- **Records** — pure logging with no targets (period, early sleep, weight…), binary or quantitative; each record opens a detail page with a contribution heatmap or week / month / year trend line;
- **Pomodoro timer** — custom focus / break lengths, task binding, automatic session logging on completion or app close, and a Windows notification when a session ends;
- **Statistics** — week / month / year focus minutes (against a daily / weekly goal), completion rate, active days, mood trend, habit consistency, and tag-time breakdown;
- One-tap daily **mood emoji** (😄🙂😐😕😭), shown as small badges on the week / month grid;
- **Data backup** — one-click JSON export / restore (drop it on OneDrive/Dropbox to survive Windows reinstalls);

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + N` | New task (anywhere) |
| `Ctrl + 1` | Calendar |
| `Ctrl + 2` | Later inbox |
| `Ctrl + 3` | Habits |
| `Ctrl + 4` | Records |
| `Ctrl + 5` | Daily goals |
| `Ctrl + 6` | Focus timer |
| `Ctrl + 7` | Statistics |
| `Ctrl + /` · `F1` | Guide / shortcuts |
| `Esc` | Close dialog |

## Tech stack

- **Tauri 2** — Rust core, native Windows app, custom frameless window
- **React 19 + TypeScript + Vite**
- **SQLite** via [`tauri-plugin-sql`](https://github.com/tauri-apps/plugins-workspace)
- Desktop plugins: `tauri-plugin-window-state`, `tauri-plugin-notification`, `tauri-plugin-dialog`, `tauri-plugin-fs`
- Hand-written CSS only (no UI kit), layered surfaces and hairline borders inspired by macOS

## Install (end user)

**👉 [Download the latest installer](https://github.com/Wens-Wu/AuraTask/releases/latest)** (Windows 10 / 11 `.msi` or `.exe`).

The build is unsigned, so SmartScreen may warn you the first time. After installation, your data lives at `%APPDATA%\com.auratask.app\auratask.db`, and you can back it up from the sidebar at any time.

## Develop

### Prerequisites

- **Node.js** 20+
- **Rust** stable (install via `rustup`)
- **Visual Studio Build Tools 2022** — make sure the *Desktop development with C++* workload is selected (provides `link.exe`)
- **Windows 10 SDK** or Windows 11 SDK (10 SDK has fewer install hiccups)

### Run

```powershell
npm install
npm run tauri dev   # Vite + native window with hot reload
```

Front-end only (no MSVC required, handy for UI iteration):

```powershell
npm run dev
```

### Type check

```powershell
npx tsc --noEmit
```

### Build a release bundle

```powershell
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/` and includes a standalone `AuraTask.exe` and an `.msi` installer.

## Project layout

```
src/
├── App.tsx                  # View routing + top-level state + global shortcuts
├── main.tsx
├── types.ts                 # Data models + enums
├── db/
│   └── database.ts          # The only module talking to SQLite
├── components/              # Views and dialogs
│   ├── DayView.tsx / WeekView.tsx / MonthView.tsx
│   ├── InboxView.tsx / FocusView.tsx / StatsView.tsx
│   ├── HabitsView.tsx / JournalView.tsx
│   ├── TaskDialog.tsx / HabitDialog.tsx
│   ├── TopbarChips.tsx / WindowControls.tsx
│   ├── ThemeToggle.tsx / BackupActions.tsx
│   └── ...
├── hooks/
│   └── useFocusTimer.ts     # Pomodoro state lifted to App scope, survives view switches
├── i18n/                    # Language toggle (zh / en)
├── utils/                   # Pure functions: dates, habits, backup, notifications
└── styles/global.css        # Global CSS variables driving light + dark themes

src-tauri/
├── src/lib.rs               # Rust entry: plugin registration + SQL migrations
├── tauri.conf.json          # Window config (frameless) + app metadata
├── capabilities/default.json  # Plugin permission allowlist
└── icons/                   # Full icon set
```

## Migration policy

The SQLite schema is managed through `tauri-plugin-sql`'s `Migration` array (see `src-tauri/src/lib.rs`). **Once a migration has shipped, never change its SQL string** — the plugin hashes each migration and will refuse to start with `"migration N was previously applied but has been modified"`. New schema needs always go in as `version: N+1`.

## Backup

Sidebar footer: *💾 Export* / *📂 Import*:

- **Export** — native save dialog writes a full JSON dump (all tables + version + timestamp)
- **Import** — pick a JSON file; **the current database will be wiped and replaced** (with a confirm step)

Drop the export on OneDrive / Dropbox / iCloud and you don't have to fear a Windows reinstall.

## License

All rights reserved. The source code is published for transparency. No license is granted to copy, modify, redistribute, or use it beyond running the official builds from the Releases page. See [LICENSE](./LICENSE) for the full notice.
