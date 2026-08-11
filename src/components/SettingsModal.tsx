import React, { useState } from 'react';
import { X, Volume2, Bell, Download, Upload, ShieldCheck, Sun, Moon, Sparkles, Music } from 'lucide-react';
import { AppSettings } from '../types';
import { playCompletionChime } from '../utils/audio';
import { exportBackupData, importBackupData } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onDataImported: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onDataImported,
}) => {
  const [notificationPermission, setNotificationPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'not_supported'
  );

  if (!isOpen) return null;

  const handleRequestNotification = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        onUpdateSettings({ nativeNotifications: true });
      }
    }
  };

  const handleExport = () => {
    const jsonStr = exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `windows_focus_timer_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && importBackupData(content)) {
        alert('Data imported successfully!');
        onDataImported();
        onClose();
      } else {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-[#110926] border border-purple-900/60 shadow-2xl shadow-purple-950/90 text-purple-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/50">
          <h3 className="text-lg font-bold flex items-center gap-2 text-purple-100">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Windows Focus App Settings</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-purple-900/40 text-purple-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-6 space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Sound settings */}
          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold flex items-center gap-2 text-purple-200">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>Notification Sound:</span>
              </label>
              <input
                type="checkbox"
                checked={settings.sound.enabled}
                onChange={(e) =>
                  onUpdateSettings({ sound: { ...settings.sound, enabled: e.target.checked } })
                }
                className="w-4 h-4 text-purple-600 rounded accent-purple-600"
              />
            </div>

            {settings.sound.enabled && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-purple-300/80">Volume:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.sound.volume}
                    onChange={(e) =>
                      onUpdateSettings({ sound: { ...settings.sound, volume: parseFloat(e.target.value) } })
                    }
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs font-mono font-bold text-purple-300 w-8">
                    {Math.round(settings.sound.volume * 100)}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-purple-300/80">Chime Tone:</span>
                  <select
                    value={settings.sound.soundType}
                    onChange={(e) =>
                      onUpdateSettings({
                        sound: { ...settings.sound, soundType: e.target.value as any },
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-purple-900/60 border border-purple-700/60 text-xs font-semibold text-purple-100 outline-none"
                  >
                    <option value="chime">5s Harmonic Chime</option>
                    <option value="gentle_bell">Crystal Bell</option>
                    <option value="marimba">Marimba</option>
                    <option value="piano">Gentle Piano</option>
                  </select>

                  <button
                    onClick={() => playCompletionChime(settings.sound.volume, settings.sound.soundType)}
                    className="px-3 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs font-bold border border-purple-700/60 transition flex items-center gap-1"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Test Sound</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Windows System Notifications */}
          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-200">Windows System Notifications</span>
              </div>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                }`}
              >
                {notificationPermission === 'granted' ? 'Granted' : 'Needs Permission'}
              </span>
            </div>

            <p className="text-xs text-purple-300/80">
              Pops out native Windows banner even when the app is minimized.
            </p>

            {notificationPermission !== 'granted' && (
              <button
                onClick={handleRequestNotification}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-sm"
              >
                Enable Windows Notifications
              </button>
            )}
          </div>

          {/* Backup & Data */}
          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/50 space-y-3">
            <span className="text-sm font-bold text-purple-200 block">Data Backup & Restore</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 text-xs font-bold border border-purple-700/50 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4 text-purple-400" />
                <span>Export Backup</span>
              </button>

              <label className="flex-1 py-2.5 px-3 rounded-xl bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 text-xs font-bold border border-purple-700/50 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Import Backup</span>
                <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-purple-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md shadow-purple-900/50"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
