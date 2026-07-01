# AuraTask

[English](./README.md) · **简体中文**

[![版本](https://img.shields.io/badge/version-v0.1.0-4f46e5?style=flat-square)](https://github.com/Wens-Wu/AuraTask/releases/tag/v0.1.0)
[![最新版本](https://img.shields.io/github/v/release/Wens-Wu/AuraTask?label=%E4%B8%8B%E8%BD%BD&color=4f46e5&style=flat-square)](https://github.com/Wens-Wu/AuraTask/releases/latest)
[![下载次数](https://img.shields.io/github/downloads/Wens-Wu/AuraTask/total?label=%E5%85%B1%E4%B8%8B%E8%BD%BD&style=flat-square)](https://github.com/Wens-Wu/AuraTask/releases)
[![平台](https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%2010%2F11-blue?style=flat-square)](#%E5%AE%89%E8%A3%85)

AuraTask 把日常会用到的几件事——任务规划、专注计时、习惯养成、随手记录、状态记录——揉成一个轻量原生应用。数据全部存在本地 SQLite，不联网。

## 特性

- **任务管理**：日 / 周 / 月日历，任务分**主要 / 延伸**，上午 / 下午 / 晚上色块分区，可在周视图拖动任务改期，每天还能写一句随手笔记；
- **稍后待做**：无日期任务暂存区，等空了再排期；
- **习惯养成**：二元或量化习惯，周期灵活（每天 / 指定周几 / 每周 N 次），含连续天数、完成率、迷你热力图；
- **记录**：纯记录、不设目标（生理期、早睡、体重……），二元或量化；每条记录有详情页，含贡献热力图或周 / 月 / 年趋势折线；
- **番茄钟计时**：专注 / 休息时长自定义，可绑定任务，结束或关闭应用时自动入库，并在正常结束时弹 Windows 通知；
- **学习统计**：周 / 月 / 年的专注分钟（对照每日 / 每周目标）、任务完成率、活跃天数、心情走势、习惯坚持、标签时间分布；
- 每日一选 emoji 记录心情（😄🙂😐😕😭），周 / 月视图小角标可见；
- **数据备份**：JSON 一键备份 / 恢复（导出可放 OneDrive/Dropbox，重装系统不丢）；

## 快捷键


| 键位       | 功能                 |
| ------------ | ---------------------- |
| `Ctrl + N` | 新建任务（任意视图） |
| `Ctrl + 1` | 日历视图             |
| `Ctrl + 2` | 稍后收件箱           |
| `Ctrl + 3` | 习惯                 |
| `Ctrl + 4` | 记录                 |
| `Ctrl + 5` | 今日小目标           |
| `Ctrl + 6` | 番茄计时             |
| `Ctrl + 7` | 学习统计             |
| `Ctrl + /` · `F1` | 使用说明 / 快捷键 |
| `Esc`      | 关闭对话框           |

## 技术栈

- **Tauri 2** —— Rust 内核，Windows 原生应用，自定义无边框窗口
- **React 19 + TypeScript + Vite**
- **SQLite** via [`tauri-plugin-sql`](https://github.com/tauri-apps/plugins-workspace)
- 桌面集成插件：`tauri-plugin-window-state`、`tauri-plugin-notification`、`tauri-plugin-dialog`、`tauri-plugin-fs`
- 纯手写 CSS（无组件库），macOS 风格的层次与发丝边界

## 安装

**👉 [下载最新安装包](https://github.com/Wens-Wu/AuraTask/releases/latest)**（Windows 10 / 11 的 `.msi` 或 `.exe`）。

安装包未签名，首次运行 SmartScreen 可能提示风险，装完后数据在`%APPDATA%\com.auratask.app\auratask.db`，可以随时从侧边栏导出备份。

## 开发

### 前置要求

- **Node.js** 20+
- **Rust** stable (`rustup` 安装)
- **Visual Studio Build Tools 2022** —— 必须勾选 *使用 C++ 的桌面开发* 工作负载（提供 `link.exe`）
- **Windows 10 SDK** 或 Windows 11 SDK（前者兼容性更好）

### 启动开发

```powershell
npm install
npm run tauri dev   # Vite + 原生窗口，前端热更新
```

仅前端（不需要 MSVC，便于纯 UI 调试）：

```powershell
npm run dev
```

### 类型检查

```powershell
npx tsc --noEmit
```

### 构建发布包

```powershell
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/`，包含独立 `AuraTask.exe` 和 `.msi` 安装器。

## 项目结构

```
src/
├── App.tsx                  # 顶层视图路由 + 状态总管 + 全局快捷键
├── main.tsx
├── types.ts                 # 数据模型 + 枚举
├── db/
│   └── database.ts          # 唯一与 SQLite 通信的模块
├── components/              # 视图与对话框
│   ├── DayView.tsx / WeekView.tsx / MonthView.tsx
│   ├── InboxView.tsx / FocusView.tsx / StatsView.tsx
│   ├── HabitsView.tsx / JournalView.tsx
│   ├── TaskDialog.tsx / HabitDialog.tsx
│   ├── TopbarChips.tsx / WindowControls.tsx
│   ├── ThemeToggle.tsx / BackupActions.tsx
│   └── ...
├── hooks/
│   └── useFocusTimer.ts     # 番茄钟状态提升到 App 层，跨视图持续
├── utils/                   # 纯函数：日期、习惯、备份、通知
└── styles/global.css        # 全局样式（CSS 变量驱动浅/深主题）

src-tauri/
├── src/lib.rs               # Rust 入口：插件注册 + SQL 迁移
├── tauri.conf.json          # 窗口配置（无边框）/ 应用元信息
├── capabilities/default.json  # 插件权限白名单
└── icons/                   # 应用图标全套
```

## 数据库迁移说明

Schema 通过 `tauri-plugin-sql` 的 `Migration` 数组管理（见 `src-tauri/src/lib.rs`）。**一旦某版本迁移已发布运行过，就绝不能修改它的 SQL 字符串**——插件会对 SQL 求哈希，改动后下次启动会报 `"migration N was previously applied but has been modified"`。新需求一律新增 `version: N+1` 的迁移。

## 备份

侧边栏底部 *💾 导出备份 / 📂 导入备份*：

- **导出** —— 弹出原生保存对话框，写一份完整 JSON（含全部数据表 + 版本号 + 时间戳）
- **导入** —— 选择 JSON 文件，**会清空当前数据并替换**（带二次确认）

定期把导出的 JSON 备份到 OneDrive / Dropbox / iCloud，重装系统不慌。

## 许可

版权所有，保留一切权利。仓库代码仅出于透明展示目的公开——**不授权**任何形式的复制、修改、再发布或源码层面的使用，使用本软件请通过 Releases 页面下载官方安装包。完整声明见 [LICENSE](./LICENSE)。
