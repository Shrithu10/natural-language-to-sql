'use client'
import { useState } from 'react'
import { setSchema } from '@/lib/api'
import type { SchemaState } from '@/types'

interface Props {
  sessionId: string
  schema: SchemaState
  onUpdate: (s: SchemaState) => void
  onClose: () => void
}

type Mode = 'ddl' | 'csv' | 'builder'

const DEFAULT_DDL = `CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department TEXT,
  salary REAL,
  hire_date DATE
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT,
  budget REAL,
  manager_id INTEGER
);

INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 95000, '2020-01-15');
INSERT INTO employees VALUES (2, 'Bob', 'Marketing', 72000, '2019-06-01');
INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 105000, '2018-03-20');
INSERT INTO employees VALUES (4, 'Dave', 'HR', 68000, '2021-09-10');
INSERT INTO employees VALUES (5, 'Eve', 'Marketing', 78000, '2022-04-05');

INSERT INTO departments VALUES (1, 'Engineering', 500000, 3);
INSERT INTO departments VALUES (2, 'Marketing', 300000, 2);
INSERT INTO departments VALUES (3, 'HR', 150000, 4);`

export default function SchemaPanel({ sessionId, schema, onUpdate, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('ddl')
  const [ddl, setDdl] = useState(schema.ddl || DEFAULT_DDL)
  const [csvContent, setCsvContent] = useState('')
  const [csvTable, setCsvTable] = useState('my_table')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      let body: Record<string, unknown> = { session_id: sessionId }
      if (mode === 'ddl') body.ddl = ddl
      else if (mode === 'csv') { body.csv_content = csvContent; body.csv_table_name = csvTable }

      const res = await fetch('http://localhost:8000/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: 'Failed' }))
        throw new Error(e.detail)
      }
      const data = await res.json()
      onUpdate({ ddl: data.ddl, description: data.description })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update schema')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-100 w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Schema</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg leading-none">×</button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(['ddl', 'csv'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                mode === m ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {m === 'ddl' ? 'SQL DDL' : 'CSV Upload'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {mode === 'ddl' && (
            <textarea
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
              className="w-full h-80 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-zinc-300 resize-none text-zinc-700 leading-relaxed"
              placeholder="CREATE TABLE ..."
            />
          )}
          {mode === 'csv' && (
            <div className="space-y-3">
              <input
                type="text"
                value={csvTable}
                onChange={(e) => setCsvTable(e.target.value)}
                placeholder="Table name"
                className="w-full text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full h-64 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-zinc-300 resize-none"
                placeholder="col1,col2,col3&#10;val1,val2,val3"
              />
            </div>
          )}

          {schema.description && (
            <div className="mt-4 p-3 bg-zinc-50 rounded-xl">
              <p className="text-xs font-medium text-zinc-400 mb-1">Current schema</p>
              <pre className="text-xs text-zinc-600 whitespace-pre-wrap">{schema.description}</pre>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm bg-zinc-900 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Apply Schema'}
          </button>
        </div>
      </div>
    </div>
  )
}
