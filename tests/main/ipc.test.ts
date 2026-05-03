import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => any>,
  spawn: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      mocks.handlers[channel] = handler;
    }),
  },
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

import { registerIpcHandlers, shellQuote } from '../../src/main/ipc';

describe('IPC handlers', () => {
  beforeEach(() => {
    mocks.spawn.mockReset();
    mocks.spawn.mockReturnValue({ unref: vi.fn() });
    for (const key of Object.keys(mocks.handlers)) {
      delete mocks.handlers[key];
    }
  });

  it('quotes shell values with embedded single quotes', () => {
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
  });

  it('opens terminal through osascript without invoking a shell', async () => {
    registerIpcHandlers(
      {
        getServer: () => ({
          id: 's1',
          name: 'Server',
          host: 'example.com',
          port: 22,
          user: "bad'; touch /tmp/pwn #",
          source: 'manual',
          status: 'online',
          lastUpdated: null,
        }),
      } as any,
      {} as any,
      {} as any,
      { get: () => 'Terminal.app' } as any,
      {} as any,
      vi.fn()
    );

    await mocks.handlers['open-terminal']({}, 's1');

    expect(mocks.spawn).toHaveBeenCalledWith(
      'osascript',
      [
        '-e',
        'tell application "Terminal" to do script "ssh \'bad\'\\\\\'\'; touch /tmp/pwn #@example.com\' -p \'22\'"',
      ],
      { detached: true, stdio: 'ignore' }
    );
  });
});
