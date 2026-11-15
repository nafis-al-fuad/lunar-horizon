import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '1', desc: 'Switch to Screen S1: Explore Site / Navigator' },
    { key: '2', desc: 'Switch to Screen S2: Timeline & Events' },
    { key: '3', desc: 'Switch to Screen S3: Compare & Date Slip' },
    { key: '4', desc: 'Switch to Screen S4: Seasons & Heatmap' },
    { key: '5', desc: 'Switch to Screen S5: Sources & Validation' },
    { key: '6', desc: 'Switch to Screen S6: Mission Primer' },
    { key: 'Space', desc: 'Play / Pause timeline playback' },
    { key: 's', desc: 'Open "My landing slipped. What now?" drawer' },
    { key: 'm', desc: 'Toggle Explorer Mode / Pro Engineering Mode' },
    { key: 'a', desc: 'Open Scientific Assumptions & Limitations' },
    { key: '?', desc: 'Open this Keyboard Shortcuts cheat sheet' },
    { key: 'Esc', desc: 'Close any open drawer, modal, or overlay' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-mono text-sm">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-10" data-lenis-prevent>
        <div
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
          className="bg-[#0A0D15] border border-[#252E42] rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overscroll-contain"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#1A2234] flex items-center justify-between bg-[#0C101A]">
            <div className="flex items-center space-x-2">
              <Keyboard className="w-5 h-5 text-[#E5A93C]" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Keyboard Shortcuts Matrix
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2234]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Table */}
          <div
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
            className="overflow-y-auto p-4 space-y-2 text-xs overscroll-contain"
          >
            {shortcuts.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between p-2 rounded bg-[#07090F] border border-[#161C28]"
              >
                <span className="text-slate-300">{s.desc}</span>
                <kbd className="px-2 py-1 bg-[#151C2C] text-[#E5A93C] border border-[#25324E] rounded font-bold text-[11px] min-w-[28px] text-center">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#1A2234] bg-[#0C101A] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#182133] hover:bg-[#E5A93C] text-white hover:text-black font-bold text-xs rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
