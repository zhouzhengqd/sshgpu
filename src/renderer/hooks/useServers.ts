import { useState, useEffect, useCallback, useRef } from 'react';
import { ServerWithStatus, TaskHistoryEntry } from '@shared/types';

declare global {
  interface Window {
    api: {
      getServers: () => Promise<ServerWithStatus[]>;
      refreshServer: (id: string) => Promise<void>;
      refreshAll: () => Promise<void>;
      addServer: (config: any) => Promise<void>;
      updateServer: (config: any) => Promise<void>;
      deleteServer: (id: string) => Promise<void>;
      openTerminal: (serverId: string) => Promise<void>;
      submitJob: (serverId: string, templateId: string) => Promise<void>;
      getConfig: () => Promise<any>;
      updateConfig: (config: any) => Promise<void>;
      openSettings: () => Promise<void>;
      disableServer: (id: string) => Promise<void>;
      getTaskHistory: (serverId: string) => Promise<TaskHistoryEntry[]>;
      getUtilizationHistory: (serverId: string) => Promise<Record<number, number[]>>;
      exportGpuData: (format: 'json' | 'csv') => Promise<void>;
      exportTaskHistory: (serverId: string, format: 'json' | 'csv') => Promise<void>;
      onServersUpdated: (callback: (servers: ServerWithStatus[]) => void) => () => void;
    };
  }
}

export function useServers() {
  const [servers, setServers] = useState<ServerWithStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let attempts = 0;

    async function load() {
      try {
        const data = await window.api.getServers();
        console.log(`[useServers] poll #${attempts + 1}: got ${data.length} servers, loading=${true}`);
        setServers(data);
        setLastUpdated(new Date());
        attempts++;

        if (data.length > 0) {
          console.log('[useServers] servers found, setting loading=false');
          setLoading(false);
          if (selectedIdRef.current === null) {
            selectedIdRef.current = data[0].id;
            setSelectedId(data[0].id);
          }
        } else if (attempts >= 10) {
          console.log('[useServers] timeout, setting loading=false');
          setLoading(false);
        }
      } catch (err) {
        console.error('[useServers] Failed to load servers:', err);
        attempts++;
        if (attempts >= 10) setLoading(false);
      }
    }

    load();
    timer = setInterval(load, 3000);

    return () => clearInterval(timer);
  }, []);

  const refreshAll = useCallback(async () => {
    await window.api.refreshAll();
  }, []);

  const refreshServer = useCallback(async (id: string) => {
    await window.api.refreshServer(id);
  }, []);

  const disableServer = useCallback(async (id: string) => {
    await window.api.disableServer(id);
    setServers((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    if (selectedIdRef.current === id) selectedIdRef.current = null;
  }, []);

  const selected = servers.find((s) => s.id === selectedId) ?? null;

  return {
    servers,
    selected,
    selectedId,
    setSelectedId,
    loading,
    lastUpdated,
    refreshAll,
    refreshServer,
    disableServer,
  };
}
