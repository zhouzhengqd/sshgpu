<p align="center">
  <img src="build/banner.png" alt="SSHGPU" width="100%">
</p>

<p align="center">
  <strong>macOS menu bar app for monitoring remote GPU servers via SSH</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a> •
  <a href="README_zh.md">中文文档</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-blue" alt="Platform">
  <img src="https://img.shields.io/badge/electron-28-blue" alt="Electron">
  <img src="https://img.shields.io/badge/react-18-blue" alt="React">
  <img src="https://img.shields.io/badge/typescript-5.3-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## Features

- **GPU Monitoring** — Per-GPU utilization %, memory, temperature, and process list
- **Three Visual States** — Active, Idle (memory occupied), Available (memory freed)
- **Utilization History** — SVG sparkline charts showing the last 60 polling cycles
- **Task Monitoring** — SLURM `squeue` and `ps aux` with running/history tabs
- **Notifications** — macOS native + DingTalk webhook when GPUs become idle
- **Dark Mode** — System preference auto-detect + manual toggle
- **Auto-Discovery** — Finds servers from `~/.ssh/config`, supports manual addition
- **Data Export** — Export GPU data and task history as JSON or CSV

## Installation

### Download

Download the latest `.dmg` from [Releases](../../releases) and drag SSHGPU to Applications.

> **Note:** macOS will block the first launch because the app is not signed. Go to **System Settings → Privacy & Security** and click **Open Anyway**.

### Build from Source

```bash
git clone https://github.com/zhouzhengqd/sshgpu.git
cd sshgpu
npm install
npm run package
```

Output: `release/SSHGPU-{version}.dmg`

## Prerequisites

Remote servers need:
- SSH access with key-based authentication configured in `~/.ssh/config`
- `nvidia-smi` installed (GPU monitoring)
- `squeue` (SLURM, optional — falls back to `ps aux`)
- `conda` (optional — for environment listing)

## Usage

1. Launch SSHGPU — it appears in the macOS menu bar
2. Click the tray icon to open the popover
3. Servers from `~/.ssh/config` are auto-discovered and tested
4. Add manual servers via Settings (gear icon)

### GPU States

| State | Condition | Visual |
|-------|-----------|--------|
| **Available** | Utilization < threshold AND memory < 10% | Green border |
| **Idle** | Utilization < threshold, memory occupied | Orange border |
| **Active** | Utilization >= threshold | Default border |

### Tray Icon

The menu bar shows: `2/3 | 4 idle | 2 avail`

- `2/3` — 2 of 3 servers online
- `4 idle` — 4 GPUs below utilization threshold
- `2 avail` — 2 GPUs truly available (low memory)

## Configuration

Settings are stored at `~/Library/Application Support/sshgpu/config.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `pollingInterval` | 3 | Seconds between data refreshes |
| `idleUtilizationThreshold` | 5 | GPU utilization % below which is idle |
| `notificationEnabled` | true | Enable macOS notifications |
| `quietHoursStart` | "22:00" | Notification quiet hours start |
| `quietHoursEnd` | "08:00" | Notification quiet hours end |
| `terminalApp` | "Terminal.app" | Terminal for SSH (Terminal.app or iTerm2) |
| `theme` | "system" | UI theme: system/light/dark |
| `dingtalkWebhook` | "" | DingTalk webhook URL (empty = disabled) |

## Development

```bash
npm install
npm run dev          # Start dev server + Electron (hot reload)
npm test             # Run tests (34 tests)
npm run build        # Production build
npm run build:main   # Build main process only (fast iteration)
npm run package      # Package as .dmg
```

### Architecture

```
src/
  main/                    # Electron main process
    index.ts               # App entry, event wiring
    collector.ts           # SSH data collection
    store.ts               # In-memory data store
    history-store.ts       # Persistent task history
    utilization-history.ts # Ring buffer for sparklines (60 pts)
    notifier.ts            # Idle GPU notifications
    dingtalk.ts            # DingTalk webhook
    export.ts              # JSON/CSV export
    ipc.ts                 # IPC handlers
    preload.ts             # contextBridge API
    ssh/
      config-parser.ts     # ~/.ssh/config parser
      connection-manager.ts# SSH via system `ssh` command
      output-parser.ts     # nvidia-smi, squeue, ps aux parsers
  renderer/                # React + TypeScript + Vite
    components/            # UI components
    hooks/useServers.ts    # Polling hook (3s interval)
    styles/global.css      # CSS variables, dark mode
  shared/types.ts          # TypeScript interfaces
```

### Key Design Decisions

- **System `ssh` command** instead of ssh2 library — uses existing SSH keys/agent, no credential management
- **Polling** instead of push — simpler with Electron contextIsolation
- **PID-based task history** — monitors `ps aux`, records history when PID disappears
- **`spawn('ssh', args)`** — no shell interpretation, prevents command injection

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

MIT

## Acknowledgments

This project was built with the support of [MIMO](https://mimo.dev)'s billion-token subsidy program, which provided the AI coding assistance needed to bring SSHGPU from concept to completion.

Special thanks to all contributors and the open source community.
