import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import { ServerWithStatus } from '@shared/types';
import path from 'path';

export class TrayManager {
  private tray: Tray | null = null;
  private popoverWindow: BrowserWindow | null = null;
  private onClickCallback: (() => void) | null = null;
  private idleUtilThreshold = 5;

  create(onClick: () => void): void {
    this.onClickCallback = onClick;

    // Create a simple tray icon (16x16)
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setTitle('SSHGPU');
    this.setToolTip({ online: 0, total: 0, idleGpus: 0, longIdleGpus: 0 });

    this.tray.on('click', () => {
      this.onClickCallback?.();
    });
  }

  setPopoverWindow(window: BrowserWindow): void {
    this.popoverWindow = window;
  }

  updateStatus(servers: ServerWithStatus[]): void {
    const online = servers.filter((s) => s.status === 'online').length;
    const total = servers.length;

    let idleGpus = 0;
    let availableGpus = 0;
    let longIdleGpus = 0;

    for (const server of servers) {
      if (!server.statusData) continue;
      for (const gpu of server.statusData.gpu) {
        if (gpu.utilization < this.idleUtilThreshold) {
          idleGpus++;
          const memPercent = gpu.memoryTotal > 0 ? (gpu.memoryUsed / gpu.memoryTotal) * 100 : 0;
          if (memPercent < 10) availableGpus++;
          if (gpu.idleSince) {
            const idleHours = (Date.now() - gpu.idleSince.getTime()) / 3600000;
            if (idleHours > 2) longIdleGpus++;
          }
        }
      }
    }

    this.setToolTip({ online, total, idleGpus, availableGpus, longIdleGpus });
  }

  private setToolTip(stats: { online: number; total: number; idleGpus: number; availableGpus: number; longIdleGpus: number }): void {
    const longIdleText = stats.longIdleGpus > 0 ? ` (${stats.longIdleGpus}x >2h)` : '';
    const availableText = stats.availableGpus > 0 ? ` | ${stats.availableGpus} available` : '';
    const tooltip = `SSHGPU\n${stats.online}/${stats.total} online | ${stats.idleGpus} idle${availableText}${longIdleText}`;
    this.tray?.setToolTip(tooltip);
  }

  setTitle(servers: ServerWithStatus[]): void {
    const online = servers.filter((s) => s.status === 'online').length;
    const total = servers.length;

    let idleGpus = 0;
    let availableGpus = 0;
    let longIdleGpus = 0;

    for (const server of servers) {
      if (!server.statusData) continue;
      for (const gpu of server.statusData.gpu) {
        if (gpu.utilization < this.idleUtilThreshold) {
          idleGpus++;
          const memPercent = gpu.memoryTotal > 0 ? (gpu.memoryUsed / gpu.memoryTotal) * 100 : 0;
          if (memPercent < 10) availableGpus++;
          if (gpu.idleSince) {
            const idleHours = (Date.now() - gpu.idleSince.getTime()) / 3600000;
            if (idleHours > 2) longIdleGpus++;
          }
        }
      }
    }

    const longIdleText = longIdleGpus > 0 ? ` (${longIdleGpus}x >2h)` : '';
    const availableText = availableGpus > 0 ? ` | ${availableGpus} avail` : '';
    this.tray?.setTitle(`${online}/${total} | ${idleGpus} idle${availableText}${longIdleText}`);
  }

  setIdleUtilizationThreshold(percent: number): void {
    this.idleUtilThreshold = percent;
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
