import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FIELDS = [
  { key: 'weight_kg', label: 'Вага', unit: 'кг', step: 0.1 },
  { key: 'chest', label: 'Груди', unit: 'см', step: 0.5 },
  { key: 'waist', label: 'Талія', unit: 'см', step: 0.5 },
  { key: 'hips', label: 'Стегна', unit: 'см', step: 0.5 },
  { key: 'left_thigh', label: 'Ліве стегно', unit: 'см', step: 0.5 },
  { key: 'right_thigh', label: 'Праве стегно', unit: 'см', step: 0.5 },
  { key: 'left_calf', label: 'Литка ліва', unit: 'см', step: 0.5 },
  { key: 'right_calf', label: 'Литка права', unit: 'см', step: 0.5 },
  { key: 'left_arm', label: 'Рука ліва', unit: 'см', step: 0.5 },
  { key: 'right_arm', label: 'Рука права', unit: 'см', step: 0.5 },
  { key: 'wrist', label: 'Зап\'ясток', unit: 'см', step: 0.1 },
]

const CHART_FIELDS = [
  { key: 'weight_kg', label: 'Вага' },
  { key: 'waist', label: 'Талія' },
  { key: 'hips', label: 'Стегна' },
  { key: 'chest', label: 'Груди' },
  { key: 'left_thigh', label: 'Стегно' },
  { key: 'left_arm', label: 'Рука' },
]

export default function BodyStats() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({})
  const [activeChart, setActiveChart] = useState('weight_kg')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('mf_body_stats')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = data ?? []
        setHistory(rows)
        if (rows[0]) {
          const last = { ...rows[0] }
          delete last.id; delete last.user_id; delete last.recorded_at
          setForm(Object.fromEntries(Object.entries(last).map(([k, v]) => [k, v ?? ''])))
        }
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const payload = { user_id: user.user.id }
    FIELDS.forEach(f => {
      const v = parseFloat(form[f.key])
      if (!isNaN(v)) payload[f.key] = v
    })
    await supabase.from('mf_body_stats').insert(payload)
    const { data } = await supabase
      .from('mf_body_stats')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(20)
    setHistory(data ?? [])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Chart ──────────────────────────────────────────────────
  const chartData = history
    .filter(r => r[activeChart] != null)
    .slice(0, 12)
    .reverse()
    .map(r => ({
      value: parseFloat(r[activeChart]),
      date: new Date(r.recorded_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
    }))

  const values = chartData.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 300
  const H = 100
  const pad = 12

  const points = chartData.map((d, i) => {
    const x = pad + (i / Math.max(chartData.length - 1, 1)) * (W - pad * 2)
    const y = H - pad - ((d.value - min) / range) * (H - pad * 2)
    return { x, y, ...d }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="p-4 space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/progress')} className="text-zinc-400 text-2xl leading-none">‹</button>
        <h1 className="text-xl font-semibold">Заміри тіла</h1>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <section className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CHART_FIELDS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveChart(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  activeChart === f.key
                    ? 'bg-zinc-100 text-zinc-950 font-medium'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
              <path d={pathD} fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#e4e4e7" />
              ))}
            </svg>
            <div className="flex justify-between mt-1">
              {points.length > 0 && (
                <>
                  <span className="text-xs text-zinc-600">{points[0].date}</span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {points[points.length - 1].value} {FIELDS.find(f => f.key === activeChart)?.unit}
                  </span>
                  <span className="text-xs text-zinc-600">{points[points.length - 1].date}</span>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Form */}
      <section className="space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-widest">Нова сесія</p>
        <div className="space-y-2">
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
              <label className="text-sm text-zinc-300">{f.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={f.step}
                  value={form[f.key] ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="—"
                  className="w-20 bg-transparent text-right text-zinc-100 text-sm outline-none placeholder:text-zinc-600"
                />
                <span className="text-zinc-500 text-sm w-6">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-zinc-100 text-zinc-950 font-semibold mt-2 disabled:opacity-50"
        >
          {saved ? 'Збережено ✓' : saving ? 'Зберігаємо...' : 'Зберегти заміри'}
        </button>
      </section>
    </div>
  )
}
