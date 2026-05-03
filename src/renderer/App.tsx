import React, { useState, useEffect } from 'react';
import { useServers } from './hooks/useServers';
import { ServerList } from './components/ServerList';
import { ServerDetail } from './components/ServerDetail';
import { StatusBar } from './components/StatusBar';

export default function App() {
  // Apply theme
  useEffect(() => {
    window.api.getConfig().then((config) => {
      if (config.theme && config.theme !== 'system') {
        document.documentElement.dataset.theme = config.theme;
      } else {
        delete document.documentElement.dataset.theme;
      }
    });
  }, []);
  const {
    servers,
    selected,
    selectedId,
    setSelectedId,
    loading,
    lastUpdated,
    refreshAll,
    refreshServer,
    disableServer,
  } = useServers();

  const [searchQuery, setSearchQuery] = useState('');
  const [loadStartTime] = useState(() => Date.now());
  const [elapsedSecs, setElapsedSecs] = useState(0);

  console.log(`[App] render: loading=${loading}, servers=${servers.length}, selectedId=${selectedId}`);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setElapsedSecs(Math.floor((Date.now() - loadStartTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [loading, loadStartTime]);

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p className="loading-text">Connecting to servers...</p>
          <p className="loading-hint">
            {elapsedSecs < 5 && 'Testing SSH connectivity...'}
            {elapsedSecs >= 5 && elapsedSecs < 15 && `Testing SSH connections... (${elapsedSecs}s)`}
            {elapsedSecs >= 15 && elapsedSecs < 25 && `Collecting server data... (${elapsedSecs}s)`}
            {elapsedSecs >= 25 && `Still working... (${elapsedSecs}s) - Check SSH key access if this persists`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search servers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="main-content">
        <ServerList
          servers={servers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={disableServer}
          searchQuery={searchQuery}
        />

        {selected && (
          <ServerDetail
            server={selected}
            onRefresh={() => refreshServer(selected.id)}
            onOpenTerminal={() => window.api.openTerminal(selected.id)}
          />
        )}
      </div>

      <StatusBar
        lastUpdated={lastUpdated}
        onRefresh={refreshAll}
        onOpenSettings={() => window.api.openSettings()}
      />
    </div>
  );
}
