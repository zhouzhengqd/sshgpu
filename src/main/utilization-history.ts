export class UtilizationHistory {
  private history = new Map<string, number[]>();
  private maxSize: number;

  constructor(maxSize: number = 60) {
    this.maxSize = maxSize;
  }

  addPoint(serverId: string, gpuIndex: number, utilization: number): void {
    const key = `${serverId}-${gpuIndex}`;
    let arr = this.history.get(key);
    if (!arr) {
      arr = [];
      this.history.set(key, arr);
    }
    arr.push(utilization);
    if (arr.length > this.maxSize) {
      arr.shift();
    }
  }

  getHistoriesForServer(serverId: string): Record<number, number[]> {
    const result: Record<number, number[]> = {};
    const prefix = `${serverId}-`;
    for (const [key, values] of this.history) {
      if (key.startsWith(prefix)) {
        const gpuIndex = parseInt(key.slice(prefix.length), 10);
        result[gpuIndex] = values;
      }
    }
    return result;
  }

  removeServer(serverId: string): void {
    const prefix = `${serverId}-`;
    for (const key of this.history.keys()) {
      if (key.startsWith(prefix)) {
        this.history.delete(key);
      }
    }
  }
}
