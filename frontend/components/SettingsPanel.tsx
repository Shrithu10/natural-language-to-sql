'use client'
import type { AppConfig } from '@/types'

interface Props {
  config: AppConfig
  onChange: (c: AppConfig) => void
  onClose: () => void
}

export default function SettingsPanel({ config, onChange, onClose }: Props) {
  const set = (patch: Partial<AppConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-sm mx-4 mb-4 sm:mb-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Model settings</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Controls generation behaviour</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Temperature */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-zinc-700">Temperature</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {config.temperature <= 0.2
                    ? 'Deterministic — minimal variation'
                    : config.temperature <= 0.6
                    ? 'Balanced — some variation allowed'
                    : 'Creative — high variation'}
                </p>
              </div>
              <span className="text-sm font-mono font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                {config.temperature.toFixed(2)}
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={config.temperature}
                onChange={(e) => set({ temperature: parseFloat(e.target.value) })}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #6366f1 ${config.temperature * 100}%, #e5e7eb ${config.temperature * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1.5">
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <button
                    key={v}
                    onClick={() => set({ temperature: v })}
                    className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-100" />

          {/* Max tokens */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-zinc-700">Max tokens</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {config.maxTokens <= 512
                    ? 'Short — quick responses'
                    : config.maxTokens <= 1024
                    ? 'Standard — most queries'
                    : 'Extended — complex multi-table queries'}
                </p>
              </div>
              <span className="text-sm font-mono font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                {config.maxTokens.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={128} max={4096} step={128}
                value={config.maxTokens}
                onChange={(e) => set({ maxTokens: parseInt(e.target.value) })}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #6366f1 ${((config.maxTokens - 128) / (4096 - 128)) * 100}%, #e5e7eb ${((config.maxTokens - 128) / (4096 - 128)) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1.5">
                {[256, 512, 1024, 2048, 4096].map((v) => (
                  <button
                    key={v}
                    onClick={() => set({ maxTokens: v })}
                    className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-100" />

          {/* Quick presets */}
          <div>
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">Presets</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Precise',  temperature: 0.05, maxTokens: 512,  desc: 'SQL focus' },
                { label: 'Balanced', temperature: 0.1,  maxTokens: 1024, desc: 'Default' },
                { label: 'Creative', temperature: 0.4,  maxTokens: 2048, desc: 'Complex queries' },
              ].map((p) => {
                const active = config.temperature === p.temperature && config.maxTokens === p.maxTokens
                return (
                  <button
                    key={p.label}
                    onClick={() => set({ temperature: p.temperature, maxTokens: p.maxTokens })}
                    className="text-left px-3 py-2.5 rounded-xl border transition-all"
                    style={{
                      borderColor: active ? '#6366f1' : '#e5e7eb',
                      background: active ? '#eef2ff' : 'transparent',
                    }}
                  >
                    <p className="text-xs font-semibold" style={{ color: active ? '#4f46e5' : '#3f3f46' }}>
                      {p.label}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{p.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(99,102,241,0.4);
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(99,102,241,0.4);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
