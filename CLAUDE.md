# SSHGPU - macOS Menu Bar GPU Monitor

Electron app for monitoring remote GPU servers via SSH, displayed as a macOS menu bar popover. Click the tray icon to see GPU utilization, system stats, and task status across all your servers at a glance.

## Prerequisites

- macOS (menu bar app)
- Node.js >= 18
- npm >= 9
- SSH access configured in `~/.ssh/config` with key-based authentication
- Remote servers must have `nvidia-smi` installed (GPU monitoring), `squeue` (SLURM, optional), `conda` (env listing, optional)

## Installation

```bash
git clone <repo-url> sshgpu
cd sshgpu
npm install
```

## Development

```bash
npm run dev          # Start dev server + Electron (hot reload)
npm run build        # Production build (main + renderer)
npm run build:main   # Build main process only (fast iteration)
npm test             # Run all tests (34 tests, 7 test files)
npm run package      # Package as .dmg via electron-builder
```

The dev command runs three processes concurrently:
1. Vite dev server on port 5173 (renderer hot reload)
2. esbuild in watch mode (main process rebuild)
3. Electron pointing to the dev server

## Architecture

```
src/
  main/                    # Electron main process
    index.ts               # App entry: init, server loading, event wiring
    window.ts              # Popover window (frameless, tray-relative positioning)
    tray.ts                # macOS tray icon with status title/tooltip
    collector.ts           # SSH data collection orchestration
    store.ts               # In-memory server + status data store
    history-store.ts       # Persistent task history (electron-store)
    utilization-history.ts # Ring buffer for GPU utilization sparklines (60 pts)
    notifier.ts            # Idle GPU notification logic (macOS + DingTalk)
    dingtalk.ts            # DingTalk webhook sender
    export.ts              # JSON/CSV export via save dialog
    ipc.ts                 # IPC handler registration (invoke/handle)
    preload.ts             # contextBridge API exposure
    ssh/
      config-parser.ts     # Parse ~/.ssh/config for server discovery
      connection-manager.ts# SSH execution via system `ssh` command (spawn)
      output-parser.ts     # Parsers: nvidia-smi, squeue, ps aux, free, top, df, ping
  renderer/                # React + TypeScript + Vite
    App.tsx                # Main app with loading state, server list + detail
    settings.tsx           # Settings window entry
    components/
      ServerList.tsx       # Server sidebar with grouping and status dots
      ServerDetail.tsx     # GPU cards, system stats, tasks (running/history tabs)
      GpuCard.tsx          # Per-GPU card: utilization bar, memory, processes, sparkline
      TaskTable.tsx        # Running tasks table (SLURM squeue + ps aux)
      TaskHistoryTable.tsx # Historical task records
      Settings.tsx         # Config UI: theme, polling, notifications, DingTalk
      StatusBar.tsx        # Last updated time, refresh/settings buttons
    hooks/
      useServers.ts        # Polling hook: fetch servers every 3s
    styles/
      global.css           # CSS custom properties, dark mode, all component styles
  shared/
    types.ts               # TypeScript interfaces (Server, GPU, Task, AppConfig, IPC)
```

### Data Flow

1. `collector.ts` runs SSH commands on each server via `connection-manager.ts`
2. `output-parser.ts` parses stdout into typed objects (GPU, tasks, system stats)
3. Results stored in `store.ts` (in-memory) + `history-store.ts` (persistent)
4. Renderer polls `get-servers` IPC every 3 seconds
5. GPU utilization history stored in `utilization-history.ts` ring buffer (60 points/GPU)
6. Idle detection: utilization < threshold AND memory < 10% = "available"

### Key Design Decisions

- **System `ssh` command** instead of ssh2 library: uses user's existing SSH keys/agent, no credential management
- **Polling** instead of push: renderer calls `get-servers` via setInterval; simpler with contextIsolation
- **PID-based task history**: monitors `ps aux` output, records history when PID disappears from running list
- **No shell interpretation**: `spawn('ssh', args)` prevents command injection

## Features

### GPU Monitoring
- Per-GPU: utilization %, memory used/total, temperature, process list (PID, name, memory)
- Three visual states: **Active** (default), **Idle** (low util, memory occupied - orange), **Available** (low util, memory <10% - green)
- SVG sparkline chart showing utilization history (last 60 polling cycles)
- Configurable idle utilization threshold (default 5%)

### Server Management
- Auto-discovers servers from `~/.ssh/config`
- Manual server addition with host/port/user/jump host/group
- SSH connectivity test on startup (only reachable servers shown)
- Server grouping by SSH config group or manual assignment
- Hide (delete) server temporarily; refresh re-discovers all

### Task Monitoring
- SLURM `squeue` for running/pending jobs with partition, user, runtime, resources
- `ps aux` fallback for non-SLURM servers
- Running/History tab switcher
- SLURM queue depth badge on tasks header
- PID-based task history: tracks start/end time, duration, final state

### Notifications
- macOS native notifications for idle GPUs (utilization < threshold)
- DingTalk webhook: sends when GPU is idle AND memory is freed (< 10%)
- Quiet hours support (configurable start/end time)
- Task completion notifications (PID disappears from process list)

### UI
- Dark mode: system preference auto-detect + manual toggle (light/dark/system)
- macOS popover window positioned under tray icon
- Search/filter servers
- Export GPU data and task history as JSON or CSV

### System Stats
- CPU usage, memory, disk, network (rx/tx bytes, ping latency)
- Conda environment listing

## Configuration

Settings are stored via `electron-store` at `~/Library/Application Support/sshgpu/config.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `pollingInterval` | 3 | Seconds between data refreshes |
| `idleThreshold` | 5 | Minutes before GPU considered idle |
| `idleUtilizationThreshold` | 5 | GPU utilization % below which is idle |
| `notificationEnabled` | true | Enable macOS notifications |
| `quietHoursStart` | "22:00" | Notification quiet hours start |
| `quietHoursEnd` | "08:00" | Notification quiet hours end |
| `terminalApp` | "Terminal.app" | Terminal for SSH (Terminal.app or iTerm2) |
| `theme` | "system" | UI theme: system/light/dark |
| `dingtalkWebhook` | "" | DingTalk webhook URL (empty = disabled) |

## Testing

```bash
npm test              # Run all tests (vitest)
npm run test:watch    # Watch mode
```

Test files mirror source structure under `tests/`:
- `tests/main/ssh/output-parser.test.ts` — Parser tests (nvidia-smi, squeue, ps aux, free, top, df, conda, network, ping)
- `tests/main/ssh/config-parser.test.ts` — SSH config parsing
- `tests/main/ssh/connection-manager.test.ts` — SSH arg building
- `tests/main/collector.test.ts` — Data collection
- `tests/main/store.test.ts` — In-memory store
- `tests/main/notifier.test.ts` — Idle notification logic
- `tests/main/ipc.test.ts` — IPC handler registration

## Packaging

```bash
npm run package       # Build + package as .dmg via electron-builder
```

Output: `release/SSHGPU-{version}.dmg`

Requires `build/icon.icns` for the app icon (not yet provided — uses default Electron icon).

## Problems Encountered & Solutions

### 1. SSH Authentication Failure (ssh2 library)
**Problem**: The ssh2 Node.js library couldn't authenticate - SSH agent had no identities loaded.
**Solution**: Replaced ssh2 with system `ssh` command via `child_process.spawn`. This uses the user's existing SSH keys and agent.

### 2. Entire Window Was Draggable (No Click/Scroll)
**Problem**: `-webkit-app-region: drag` on `body` element swallowed all mouse events.
**Solution**: Moved drag region to `.toolbar` only, added `-webkit-app-region: no-drag` to interactive elements.

### 3. Frontend Showed "Loading servers..." Forever
**Problem**: `webContents.send('servers-updated')` events never reached the renderer with contextIsolation.
**Solution**: Switched to polling-based approach - renderer calls `get-servers` every 3 seconds via setInterval.

### 4. SSH Tests Take ~15 Seconds (No Feedback)
**Problem**: Many servers in SSH config, each with 5s ConnectTimeout, left user staring at blank screen.
**Solution**: Added loading spinner with progress messages ("Testing SSH connectivity...", "Collecting server data..."). Reduced ConnectTimeout from 10s to 5s.

### 5. ServerDetail Crashed on Undefined Fields
**Problem**: `Cannot read properties of undefined (reading 'toFixed')` when statusData fields were null.
**Solution**: Added fallback defaults for cpu, memory, disk, network fields. Added null-safe access with `??` operator.

### 6. squeue Missing STATUS Field
**Problem**: Format string had `%.10R` (REASON) but no `%.10T` (STATE). Parser mapped wrong field as status.
**Solution**: Added `%.10T` to squeue format string, updated parser to handle 8 fields.

### 7. Cross-Server GPU Tracking Corruption
**Problem**: status-updated handler used outer `serverId` for ALL servers in loop.
**Solution**: Fixed to only process the updated server using `server.id` from the event.

### 8. Delete Button Permanently Hid Servers
**Problem**: "Delete" added server to `disabledServerIds`, refresh couldn't recover it.
**Solution**: Changed to "temporary hide" - don't persist to disabledServerIds. Refresh re-discovers all SSH config servers.

### 9. Transparent Window Caused Invisible Text
**Problem**: `transparent: true` in BrowserWindow made text invisible.
**Solution**: Changed to `transparent: false` with `backgroundColor: '#ffffff'`.

### 10. Command Injection Vulnerability
**Problem**: `exec(args.join(' '))` allowed shell injection via malicious server names or commands.
**Solution**: Rewrote to use `spawn('ssh', args)` which passes arguments directly without shell interpretation.

### 11. Identity File Not Used
**Problem**: `_identityFile` parameter was renamed and never passed to SSH command.
**Solution**: Added `-i` flag support in `buildSshArgs()` and pass identity file from server config.

### 12. Task History Empty (No SLURM)
**Problem**: sacct-based history required SLURM, which most servers don't have.
**Solution**: Replaced with local ps aux tracking - monitors running processes by PID, saves to history when PID disappears from running list.

### 13. electron-store Dot-in-Key Corruption
**Problem**: Server IDs with dots (e.g., "gpu.lab.internal") were interpreted as nested objects by electron-store, causing data loss.
**Solution**: Added `escapeKey()` and `flattenNestedObject()` to handle dotted keys. Manually repaired corrupted task history data.

### 14. Sparkline Chart Not Visible
**Problem**: Chart didn't render - useEffect only depended on `server?.id`, not data updates.
**Solution**: Added `server?.lastUpdated` as useEffect dependency. Chart needs 2+ polling cycles to render.
