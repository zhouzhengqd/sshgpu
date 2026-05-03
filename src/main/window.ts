import { BrowserWindow, screen } from 'electron';
import path from 'path';

export class PopoverWindow {
  private window: BrowserWindow | null = null;
  private isVisible = false;

  create(): BrowserWindow {
    const { width, height } = this.calculateSize();

    this.window = new BrowserWindow({
      width,
      height,
      show: false,
      frame: false,
      resizable: false,
      transparent: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      const port = process.env.VITE_DEV_PORT || '5173';
      this.window.loadURL(`http://localhost:${port}`);
    } else {
      this.window.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.window.on('blur', () => {
      this.hide();
    });

    return this.window;
  }

  toggle(trayBounds?: Electron.Rectangle): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(trayBounds);
    }
  }

  show(trayBounds?: Electron.Rectangle): void {
    if (!this.window) return;

    const position = this.calculatePosition(trayBounds);
    this.window.setPosition(position.x, position.y);
    this.window.show();
    this.isVisible = true;
  }

  hide(): void {
    this.window?.hide();
    this.isVisible = false;
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  private calculateSize(): { width: number; height: number } {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth } = display.workAreaSize;

    return {
      width: Math.min(800, screenWidth - 40),
      height: 500,
    };
  }

  private calculatePosition(trayBounds?: Electron.Rectangle): { x: number; y: number } {
    if (!trayBounds) {
      const display = screen.getPrimaryDisplay();
      return {
        x: display.workArea.x + display.workArea.width - 820,
        y: display.workArea.y + 28,
      };
    }

    const { width } = this.calculateSize();
    const display = screen.getPrimaryDisplay();

    // Center under tray icon
    let x = trayBounds.x + trayBounds.width / 2 - width / 2;
    const y = trayBounds.y + trayBounds.height + 4;

    // Keep within screen bounds
    x = Math.max(display.workArea.x, Math.min(x, display.workArea.x + display.workArea.width - width));

    return { x, y };
  }
}
