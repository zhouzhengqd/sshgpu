import Store from 'electron-store';
import { TaskHistoryEntry } from '@shared/types';

interface HistoryStoreData {
  [serverId: string]: TaskHistoryEntry[];
}

const MAX_ENTRIES_PER_SERVER = 1000;

export class HistoryStore {
  private store: Store<HistoryStoreData>;
  private knownKeys = new Map<string, Set<string>>();

  constructor() {
    this.store = new Store<HistoryStoreData>({
      name: 'task-history',
      defaults: {},
    });

    // Migrate existing records: merge entries with same PID and user
    this.migrateExistingEntries();

    for (const [serverId, entries] of Object.entries(this.store.store)) {
      if (Array.isArray(entries)) {
        this.knownKeys.set(serverId, new Set(entries.map((e) => `${e.id}:${e.user}`)));
      }
    }
  }

  private getEntryKey(entry: TaskHistoryEntry): string {
    return `${entry.id}:${entry.user}`;
  }

  private escapeKey(key: string): string {
    return key.replace(/\./g, '\\.');
  }

  private migrateExistingEntries(): void {
    // First, fix the nested object issue caused by dots in server IDs
    // electron-store interprets dotted keys like "server.example.com" as nested objects
    // We need to walk the nested path and reconstruct the original dotted key
    const storeData = this.store.store;
    const toDelete: string[] = [];
    const toSet: Array<{ key: string; entries: TaskHistoryEntry[] }> = [];

    for (const [key, value] of Object.entries(storeData)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const found = this.findNestedEntries(key, value);
        for (const { reconstructedKey, entries } of found) {
          toDelete.push(key);
          toSet.push({ key: this.escapeKey(reconstructedKey), entries });
        }
      }
    }

    for (const key of toDelete) {
      this.store.delete(key);
    }
    for (const { key, entries } of toSet) {
      this.store.set(key, entries);
    }

    // Then merge entries with same PID and user
    for (const [serverId, entries] of Object.entries(this.store.store)) {
      if (!Array.isArray(entries)) continue;

      const merged = new Map<string, TaskHistoryEntry>();
      for (const entry of entries) {
        const entryKey = `${entry.id}:${entry.user}`;
        const existing = merged.get(entryKey);
        // Keep the latest entry (by endTime)
        if (!existing || entry.endTime > existing.endTime) {
          merged.set(entryKey, entry);
        }
      }

      const deduplicated = Array.from(merged.values());
      if (deduplicated.length !== entries.length) {
        this.store.set(serverId, deduplicated);
      }
    }
  }

  private findNestedEntries(prefix: string, obj: any): Array<{ reconstructedKey: string; entries: TaskHistoryEntry[] }> {
    const results: Array<{ reconstructedKey: string; entries: TaskHistoryEntry[] }> = [];

    if (Array.isArray(obj)) {
      return [{ reconstructedKey: prefix, entries: obj }];
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const [segment, value] of Object.entries(obj)) {
        const fullPath = `${prefix}.${segment}`;
        const found = this.findNestedEntries(fullPath, value);
        results.push(...found);
      }
    }

    return results;
  }

  addEntries(serverId: string, entries: TaskHistoryEntry[]): TaskHistoryEntry[] {
    const escapedKey = this.escapeKey(serverId);
    const existing = this.knownKeys.get(escapedKey) || new Set();
    const current = this.store.get(escapedKey, []);
    let updated = false;

    for (const entry of entries) {
      const key = this.getEntryKey(entry);
      if (existing.has(key)) {
        // Update existing entry with same PID and user
        const index = current.findIndex((e) => this.getEntryKey(e) === key);
        if (index >= 0) {
          current[index] = entry;
          updated = true;
        }
      } else {
        existing.add(key);
        current.push(entry);
        updated = true;
      }
    }

    if (!updated) return entries;

    const capped = current.length > MAX_ENTRIES_PER_SERVER
      ? current.slice(current.length - MAX_ENTRIES_PER_SERVER)
      : current;

    // Rebuild knownKeys from capped entries to stay in sync
    this.knownKeys.set(escapedKey, new Set(capped.map((e) => this.getEntryKey(e))));
    this.store.set(escapedKey, capped);
    return entries;
  }

  getHistory(serverId: string): TaskHistoryEntry[] {
    return this.store.get(this.escapeKey(serverId), []);
  }

  removeServer(serverId: string): void {
    const escapedKey = this.escapeKey(serverId);
    this.store.delete(escapedKey);
    this.knownKeys.delete(escapedKey);
  }
}
