'use client'
import { useState } from 'react'
import type { QueryResponse } from '@/types'

interface Props {
  response: QueryResponse
}

type Tab = 'sql' | 'result' | 'chart' | 'explanation' | 'trace'

export default function ResultTabs({ response }: Props) {
  const [tab, setTab] = useState<Tab>('sql')

  const hasChart = response.result.ok && (response.result.rows?.length ?? 0) > 0

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sql', label: 'SQL' },
    { id: 'result', label: `Result${response.result.row_count != null ? ` (${response.result.row_count})` : ''}` },
    ...(hasChart ? [{ id: 'chart' as Tab, label: 'Chart' }] : []),
    { id: 'explanation', label: 'Explanation' },
    { id: 'trace', label: `Trace${response.trace.length ? ` (${response.trace.length})` : ''}` },
  ]

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-100 px-1 pt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors mr-0.5 ${
              tab === t.id
                ? 'text-zinc-900 bg-zinc-100'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {t.label}
          </button>
        ))}

        <div className="flex-1" />
        <div className="flex items-center gap-2 pr-3 pb-1">
          <Badge label={response.difficulty} color={response.difficulty === 'complex' ? 'indigo' : 'zinc'} />
          <Badge label={`${response.attempts} attempt${response.attempts !== 1 ? 's' : ''}`} color="zinc" />
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'sql' && <SQLTab sql={response.sql} />}
        {tab === 'result' && <ResultTab result={response.result} />}
        {tab === 'chart' && <ChartTab result={response.result} />}
        {tab === 'explanation' && <ExplanationTab response={response} />}
        {tab === 'trace' && <TraceTab trace={response.trace} />}
      </div>
    </div>
  )
}

function SQLTab({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group">
      <pre className="text-xs text-zinc-700 font-mono bg-zinc-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {sql || <span className="text-zinc-400 italic">No SQL generated</span>}
      </pre>
      {sql && (
        <button
          onClick={copy}
          className="absolute top-3 right-3 text-xs text-zinc-400 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-zinc-200 rounded px-2 py-0.5"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}

function ResultTab({ result }: { result: QueryResponse['result'] }) {
  if (!result.ok) {
    return (
      <div className="text-xs text-red-500 bg-red-50 rounded-xl p-4 font-mono">
        {result.error ?? 'Execution failed'}
      </div>
    )
  }
  if (!result.rows?.length) {
    return <p className="text-sm text-zinc-400 italic">No rows returned.</p>
  }
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th key={col} className="text-left text-zinc-500 font-medium pb-2 pr-4 border-b border-zinc-100 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 200).map((row, i) => (
            <tr key={i} className="hover:bg-zinc-50 transition-colors">
              {result.columns.map((col) => (
                <td key={col} className="py-1.5 pr-4 text-zinc-700 border-b border-zinc-50 whitespace-nowrap">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > 200 && (
        <p className="text-xs text-zinc-400 mt-2">Showing 200 of {result.rows.length} rows</p>
      )}
    </div>
  )
}

// ─── Chart visualization ───────────────────────────────────────────────────

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'k'
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2)
}

function isNumericCol(col: string, rows: Record<string, unknown>[]): boolean {
  return rows.every((r) => r[col] === null || r[col] === '' || !isNaN(Number(r[col])))
}

function ChartTab({ result }: { result: QueryResponse['result'] }) {
  const [activeCols, setActiveCols] = useState<string[]>([])

  if (!result.ok || !result.rows?.length) {
    return <p className="text-sm text-zinc-400 italic">No data to visualize.</p>
  }

  const { columns, rows } = result
  const numericCols = columns.filter((c) => isNumericCol(c, rows))
  const labelCol = columns.find((c) => !isNumericCol(c, rows)) ?? null

  if (numericCols.length === 0) {
    return <p className="text-sm text-zinc-400 italic">No numeric columns detected — nothing to chart.</p>
  }

  // Default: first numeric col selected
  const selectedCols = activeCols.length > 0
    ? activeCols.filter((c) => numericCols.includes(c))
    : [numericCols[0]]

  const data = rows.slice(0, 30).map((row, i) => ({
    label: labelCol ? String(row[labelCol] ?? i) : String(i + 1),
    values: selectedCols.map((c) => Number(row[c] ?? 0)),
  }))

  const toggleCol = (col: string) => {
    setActiveCols((prev) => {
      const next = prev.length === 0 ? [numericCols[0]] : [...prev]
      if (next.includes(col)) return next.length > 1 ? next.filter((c) => c !== col) : next
      return [...next, col]
    })
  }

  // Chart geometry
  const W = 560
  const H = 280
  const PAD = { top: 24, right: 24, bottom: 72, left: 52 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const allVals = data.flatMap((d) => d.values)
  const maxVal = Math.max(...allVals, 0)
  const minVal = Math.min(0, ...allVals)
  const range = maxVal - minVal || 1

  const numBars = data.length
  const groupW = plotW / numBars
  const barW = (groupW * 0.72) / selectedCols.length
  const barGap = groupW * 0.28

  const toY = (v: number) => PAD.top + plotH - ((v - minVal) / range) * plotH
  const zero = toY(0)

  // Y-axis ticks (5 steps)
  const TICK_COUNT = 5
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    minVal + (range * i) / TICK_COUNT
  )

  return (
    <div className="space-y-3">
      {/* Column selector — only shown if >1 numeric col */}
      {numericCols.length > 1 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mr-1">Series:</span>
          {numericCols.map((col, ci) => {
            const active = selectedCols.includes(col)
            return (
              <button
                key={col}
                onClick={() => toggleCol(col)}
                className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-all"
                style={{
                  borderColor: active ? PALETTE[ci % PALETTE.length] : '#e5e7eb',
                  background: active ? PALETTE[ci % PALETTE.length] + '18' : 'transparent',
                  color: active ? PALETTE[ci % PALETTE.length] : '#71717a',
                }}
              >
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: PALETTE[ci % PALETTE.length],
                    display: 'inline-block', opacity: active ? 1 : 0.35,
                  }}
                />
                {col}
              </button>
            )
          })}
        </div>
      )}

      {/* SVG chart */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-1 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', minWidth: 320, height: 'auto' }}
          role="img"
        >
          {/* Grid lines */}
          {ticks.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left} y1={toY(v)}
                x2={PAD.left + plotW} y2={toY(v)}
                stroke={v === 0 ? '#d1d5db' : '#f0f0f0'} strokeWidth={v === 0 ? 1.5 : 1}
              />
              <text
                x={PAD.left - 6} y={toY(v)}
                textAnchor="end" dominantBaseline="middle"
                fontSize={9} fill="#9ca3af"
              >
                {fmtNum(v)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((d, di) => {
            const groupX = PAD.left + di * groupW + barGap / 2
            return (
              <g key={di}>
                {d.values.map((val, ci) => {
                  const x = groupX + ci * barW
                  const y = Math.min(toY(val), zero)
                  const h = Math.abs(toY(val) - zero)
                  const color = PALETTE[(selectedCols.indexOf(selectedCols[ci])) % PALETTE.length]
                  return (
                    <g key={ci} className="group">
                      <rect
                        x={x} y={y} width={barW} height={Math.max(h, 1)}
                        fill={color} rx={3} opacity={0.85}
                        className="transition-opacity hover:opacity-100"
                      />
                      {/* Value label on hover via title */}
                      <title>{`${d.label}: ${fmtNum(val)}`}</title>
                    </g>
                  )
                })}
                {/* X-axis label */}
                <text
                  x={groupX + (barW * selectedCols.length) / 2}
                  y={PAD.top + plotH + 10}
                  textAnchor="end"
                  fontSize={9.5} fill="#6b7280"
                  transform={`rotate(-38, ${groupX + (barW * selectedCols.length) / 2}, ${PAD.top + plotH + 10})`}
                >
                  {d.label.length > 14 ? d.label.slice(0, 14) + '…' : d.label}
                </text>
              </g>
            )
          })}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH + 1} stroke="#d1d5db" strokeWidth={1.5} />
          <line x1={PAD.left - 1} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="#d1d5db" strokeWidth={1.5} />

          {/* Legend (if multiple cols selected) */}
          {selectedCols.length > 1 && selectedCols.map((col, ci) => (
            <g key={col} transform={`translate(${PAD.left + ci * 100}, 6)`}>
              <rect x={0} y={0} width={8} height={8} rx={2} fill={PALETTE[ci % PALETTE.length]} />
              <text x={12} y={7} fontSize={9} fill="#6b7280">{col}</text>
            </g>
          ))}
        </svg>
      </div>

      {rows.length > 30 && (
        <p className="text-[10px] text-zinc-400 text-right">Showing 30 of {rows.length} rows</p>
      )}
    </div>
  )
}

function ExplanationTab({ response }: { response: QueryResponse }) {
  const hasRag = response.rag_tables_retrieved?.length > 0

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-zinc-400 mb-1">Intent</p>
        <p className="text-sm text-zinc-700">{response.intent}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-400 mb-1">Explanation</p>
        <p className="text-sm text-zinc-700 leading-relaxed">{response.explanation}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 mb-1.5">Tables used</p>
          <div className="flex flex-wrap gap-1.5">
            {response.tables_used.map((t) => (
              <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-400 mb-1.5">Operations</p>
          <div className="flex flex-wrap gap-1.5">
            {response.operations.map((op) => (
              <span key={op} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{op}</span>
            ))}
          </div>
        </div>
      </div>

      {/* RAG info */}
      {hasRag && (
        <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-emerald-700">RAG active</span>
            <span className="text-xs text-emerald-500">— schema filtered by keyword relevance</span>
          </div>
          <div>
            <p className="text-xs text-emerald-600 mb-1">Tables retrieved for this query:</p>
            <div className="flex flex-wrap gap-1.5">
              {response.rag_tables_retrieved.map((t) => (
                <span key={t} className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">{t}</span>
              ))}
            </div>
          </div>
          {response.rag_schema_used && (
            <details className="mt-1">
              <summary className="text-xs text-emerald-600 cursor-pointer select-none">
                View filtered schema ↓
              </summary>
              <pre className="mt-2 text-xs font-mono text-emerald-800 bg-emerald-100 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {response.rag_schema_used}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Trace workflow ────────────────────────────────────────────────────────

import type { TraceStep } from '@/types'

const STEP_STYLE: Record<string, { bg: string; border: string; dotBg: string; label: string; text: string }> = {
  generate:      { bg: '#f5f3ff', border: '#ddd6fe', dotBg: '#7c3aed', label: 'Generate',        text: '#5b21b6' },
  retry:         { bg: '#fffbeb', border: '#fde68a', dotBg: '#d97706', label: 'Retry',            text: '#92400e' },
  validate_pass: { bg: '#f0fdf4', border: '#bbf7d0', dotBg: '#16a34a', label: 'Validation pass',  text: '#15803d' },
  validate_fail: { bg: '#fff7ed', border: '#fed7aa', dotBg: '#ea580c', label: 'Validation fail',  text: '#c2410c' },
  direct:        { bg: '#f8fafc', border: '#e2e8f0', dotBg: '#64748b', label: 'Direct call',      text: '#475569' },
  error:         { bg: '#fef2f2', border: '#fecaca', dotBg: '#dc2626', label: 'Error',            text: '#b91c1c' },
}

function TraceTab({ trace }: { trace: TraceStep[] }) {
  if (!trace.length) {
    return (
      <div className="flex flex-col items-center py-10 text-zinc-400">
        <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-500">No agent trace</p>
        <p className="text-xs text-zinc-400 mt-1">Enable Agent in the top bar and run a query</p>
      </div>
    )
  }

  return (
    <div>
      {trace.map((step, i) => (
        <TraceNode key={i} step={step} isLast={i === trace.length - 1} index={i} />
      ))}
    </div>
  )
}

function TraceNode({ step, isLast, index }: { step: TraceStep; isLast: boolean; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const style = STEP_STYLE[step.step_type] ?? STEP_STYLE.direct
  const hasDetail = step.content?.trim().length > 0

  return (
    <div className="flex gap-3">
      {/* Left: dot + connector line */}
      <div className="flex flex-col items-center" style={{ width: 24 }}>
        <div
          style={{
            width: 10, height: 10,
            borderRadius: '50%',
            background: style.dotBg,
            flexShrink: 0,
            marginTop: 14,
            boxShadow: `0 0 0 3px ${style.border}`,
          }}
        />
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: '#e5e7eb', marginTop: 4 }} />
        )}
      </div>

      {/* Right: card */}
      <div className="flex-1 pb-3 min-w-0">
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: style.border, background: style.bg }}
        >
          {/* Header row */}
          <div
            className="flex items-start justify-between px-3 py-2.5 gap-3"
            onClick={() => hasDetail && setExpanded(!expanded)}
            style={{ cursor: hasDetail ? 'pointer' : 'default' }}
          >
            <div className="min-w-0">
              {/* Step type label */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: style.dotBg + '22', color: style.dotBg }}
                >
                  {style.label}
                </span>
                <span className="text-xs font-medium" style={{ color: style.text }}>
                  {step.author}
                </span>
              </div>
              {/* Summary */}
              <p className="text-[11px] mt-1 leading-snug" style={{ color: style.text, opacity: 0.75 }}>
                {step.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              <span className="text-[10px] font-mono text-zinc-400">{step.ts}s</span>
              {hasDetail && (
                <svg
                  width="10" height="10" viewBox="0 0 24 24"
                  fill="none" stroke={style.dotBg} strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </div>
          </div>

          {/* Expanded detail */}
          {hasDetail && expanded && (
            <div
              className="px-3 pb-3 pt-2 border-t"
              style={{ borderColor: style.border }}
            >
              <pre
                className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all"
                style={{ color: style.text }}
              >
                {step.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'zinc' | 'indigo' }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{
        background: color === 'indigo' ? '#eef2ff' : '#f4f4f5',
        color: color === 'indigo' ? '#4f46e5' : '#71717a',
      }}
    >
      {label}
    </span>
  )
}
