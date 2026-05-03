import { GPU } from '@shared/types';

export class IdleNotifier {
  private threshold: number; // minutes
  private utilizationThreshold: number; // percentage
  private idleMap = new Map<string, Date>(); // key: serverId-gpuIndex
  quietHoursStart: string | null = null;
  quietHoursEnd: string | null = null;
  private notified = new Set<string>();

  constructor(thresholdMinutes: number, utilizationThreshold: number = 5) {
    this.threshold = thresholdMinutes;
    this.utilizationThreshold = utilizationThreshold;
  }

  checkGpu(serverId: string, gpu: GPU): GPU {
    const key = `${serverId}-${gpu.index}`;
    const isIdle = gpu.utilization < this.utilizationThreshold;

    if (isIdle) {
      const existing = this.idleMap.get(key);
      return {
        ...gpu,
        idleSince: existing || new Date(),
      };
    } else {
      this.idleMap.delete(key);
      this.notified.delete(key);
      return { ...gpu, idleSince: null };
    }
  }

  shouldNotify(idleSince: Date): boolean {
    if (this.isQuietHours()) return false;

    const idleMinutes = (Date.now() - idleSince.getTime()) / 60000;
    return idleMinutes >= this.threshold;
  }

  shouldNotifyGpu(serverId: string, gpu: GPU): boolean {
    if (!gpu.idleSince) return false;
    const key = `${serverId}-${gpu.index}`;
    if (this.notified.has(key)) return false;
    if (!this.shouldNotify(gpu.idleSince)) return false;

    this.notified.add(key);
    return true;
  }

  setQuietHours(start: string, end: string): void {
    this.quietHoursStart = start;
    this.quietHoursEnd = end;
  }

  private isQuietHours(): boolean {
    if (!this.quietHoursStart || !this.quietHoursEnd) return false;

    const now = new Date();
    const [startH, startM] = this.quietHoursStart.split(':').map(Number);
    const [endH, endM] = this.quietHoursEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  getThreshold(): number {
    return this.threshold;
  }

  setThreshold(minutes: number): void {
    this.threshold = minutes;
  }

  getUtilizationThreshold(): number {
    return this.utilizationThreshold;
  }

  setUtilizationThreshold(percent: number): void {
    this.utilizationThreshold = percent;
  }
}
