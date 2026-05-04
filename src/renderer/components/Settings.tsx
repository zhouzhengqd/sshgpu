import React, { useState, useEffect } from 'react';
import { AppConfig, ManualServerConfig } from '@shared/types';

export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [editingServer, setEditingServer] = useState<ManualServerConfig | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Partial<AppConfig>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.getConfig().then(setConfig);
  }, []);

  if (!config) return <div>Loading...</div>;

  const handleChange = (updates: Partial<AppConfig>) => {
    setPendingChanges((prev) => ({ ...prev, ...updates }));
    setSaved(false);
  };

  const handleSaveAll = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    await window.api.updateConfig(pendingChanges);
    const updated = await window.api.getConfig();
    setConfig(updated);
    setPendingChanges({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentValue = <K extends keyof AppConfig>(key: K): AppConfig[K] => {
    return (pendingChanges[key] as AppConfig[K]) ?? config[key];
  };

  const handleDeleteServer = async (serverId: string) => {
    await window.api.deleteServer(serverId);
    const updated = await window.api.getConfig();
    setConfig(updated);
  };

  const handleSaveServer = async (server: ManualServerConfig) => {
    const exists = config.servers.some((s) => s.id === server.id);
    if (exists) {
      await window.api.updateServer(server);
    } else {
      await window.api.addServer(server);
    }
    const updated = await window.api.getConfig();
    setConfig(updated);
    setEditingServer(null);
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="settings">
      <h2>SSHGPU Settings</h2>

      <section>
        <h3>General</h3>
        <div className="setting-row">
          <label>Theme</label>
          <select
            value={currentValue('theme') || 'system'}
            onChange={(e) => handleChange({ theme: e.target.value as 'system' | 'light' | 'dark' })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Polling Interval (seconds)</label>
          <input
            type="number"
            value={currentValue('pollingInterval')}
            onChange={(e) => handleChange({ pollingInterval: parseInt(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <label>Idle Threshold (minutes)</label>
          <input
            type="number"
            value={currentValue('idleThreshold')}
            onChange={(e) => handleChange({ idleThreshold: parseInt(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <label>Terminal App</label>
          <select
            value={currentValue('terminalApp')}
            onChange={(e) => handleChange({ terminalApp: e.target.value as any })}
          >
            <option value="Terminal.app">Terminal.app</option>
            <option value="iTerm2">iTerm2</option>
          </select>
        </div>
      </section>

      <section>
        <h3>Notifications</h3>
        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={currentValue('notificationEnabled')}
              onChange={(e) => handleChange({ notificationEnabled: e.target.checked })}
            />
            Enable notifications
          </label>
        </div>
        <div className="setting-row">
          <label>Quiet Hours</label>
          <div className="quiet-hours">
            <input
              type="time"
              value={currentValue('quietHoursStart') || '22:00'}
              onChange={(e) => handleChange({ quietHoursStart: e.target.value })}
            />
            <span>to</span>
            <input
              type="time"
              value={currentValue('quietHoursEnd') || '08:00'}
              onChange={(e) => handleChange({ quietHoursEnd: e.target.value })}
            />
          </div>
        </div>
        <div className="setting-row">
          <label>Idle Utilization Threshold (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={currentValue('idleUtilizationThreshold') ?? 5}
            onChange={(e) => handleChange({ idleUtilizationThreshold: parseInt(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <label>DingTalk Webhook</label>
          <input
            type="text"
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            value={currentValue('dingtalkWebhook') || ''}
            onChange={(e) => handleChange({ dingtalkWebhook: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
          GPU空闲且显存释放时发送钉钉群通知。留空则不发送。
        </p>
      </section>

      <div className="settings-actions">
        <button
          className="save-btn"
          onClick={handleSaveAll}
          disabled={!hasChanges}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <section>
        <h3>Manual Servers</h3>
        <button onClick={() => setEditingServer(createEmptyServer())}>
          Add Server
        </button>
        {config.servers.map((server) => (
          <div key={server.id} className="server-config">
            <span>{server.name}</span>
            <span>{server.host}</span>
            <button onClick={() => setEditingServer(server)}>Edit</button>
            <button onClick={() => handleDeleteServer(server.id)}>Delete</button>
          </div>
        ))}
      </section>

      {editingServer && (
        <ServerEditor
          server={editingServer}
          onSave={handleSaveServer}
          onCancel={() => setEditingServer(null)}
        />
      )}
    </div>
  );
}

function createEmptyServer(): ManualServerConfig {
  return {
    id: `manual-${Date.now()}`,
    name: '',
    host: '',
    port: 22,
    user: 'root',
  };
}

function ServerEditor({
  server,
  onSave,
  onCancel,
}: {
  server: ManualServerConfig;
  onSave: (config: ManualServerConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(server);

  return (
    <div className="server-editor">
      <h3>{server.name ? 'Edit Server' : 'Add Server'}</h3>
      <div className="form-row">
        <label>Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="form-row">
        <label>Host</label>
        <input
          value={form.host}
          onChange={(e) => setForm({ ...form, host: e.target.value })}
        />
      </div>
      <div className="form-row">
        <label>Port</label>
        <input
          type="number"
          value={form.port}
          onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) })}
        />
      </div>
      <div className="form-row">
        <label>User</label>
        <input
          value={form.user}
          onChange={(e) => setForm({ ...form, user: e.target.value })}
        />
      </div>
      <div className="form-row">
        <label>Jump Host (optional)</label>
        <input
          value={form.jumpHost || ''}
          onChange={(e) => setForm({ ...form, jumpHost: e.target.value || undefined })}
        />
      </div>
      <div className="form-row">
        <label>Group (optional)</label>
        <input
          value={form.group || ''}
          onChange={(e) => setForm({ ...form, group: e.target.value || undefined })}
        />
      </div>
      <div className="form-actions">
        <button onClick={() => onSave(form)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
