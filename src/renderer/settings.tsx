import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Settings } from './components/Settings';
import './styles/global.css';

function SettingsApp() {
  useEffect(() => {
    window.api.getConfig().then((config) => {
      if (config.theme && config.theme !== 'system') {
        document.documentElement.dataset.theme = config.theme;
      } else {
        delete document.documentElement.dataset.theme;
      }
    });
  }, []);

  return <Settings />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);
