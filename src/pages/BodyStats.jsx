import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconArrowLeft } from '../components/Icons'
import { BODY_FIELDS as FIELDS, CHART_FIELDS } from '../lib/bodyFields'
import BodyFigure from '../components/BodyFigure'

export default function BodyStats() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({})
  const [activeChart, setActiveChart] = useState('weight_kg')
  const [activeKey, setActiveKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

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
          delete last.id
          delete last.user_id
          delete last.recorded_at
          setForm(Object.fromEntries(Object.entries(last).map(([key, value]) => [key, value ?? ''])))
        }
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const payload = { user_id: user.user.id }

    FIELDS.forEach(field => {
      const value = parseFloat(form[field.key])
      if (!Number.isNaN(value)) payload[field.key] = value
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

  const chartData = history
    .filter(item => item[activeChart] != null)
    .slice(0, 12)
    .reverse()
    .map(item => ({
      value: parseFloat(item[activeChart]),
      date: new Date(item.recorded_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
    }))

  const values = chartData.map(item => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 300
  const height = 100
  const pad = 12

  const points = chartData.map((item, index) => {
    const x = pad + (index / Math.max(chartData.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((item.value - min) / range) * (height - pad * 2)
    return { x, y, ...item }
  })
  const pathD = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div className="screen screen--no-nav">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/progress')}><IconArrowLeft size={20} /></button>
        <div className="topbar-title" style={{ alignItems: 'center', textAlign: 'center', flex: 1 }}>
          <div className="label">Заміри</div>
          <div className="h-3">Зміни тіла</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div className="page stack">
        {chartData.length > 1 && (
          <section className="card line-chart-card">
            <div className="pill-row" style={{ marginBottom: 14 }}>
              {CHART_FIELDS.map(field => (
                <button
                  key={field.key}
                  type="button"
                  className="pill-btn"
                  data-active={activeChart === field.key ? '1' : '0'}
                  onClick={() => setActiveChart(field.key)}
                >
                  {field.label}
                </button>
              ))}
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 110 }}>
              <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="var(--text)" />
              ))}
            </svg>

            <div className="card-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <span className="meta">{points[0]?.date}</span>
              <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                {points[points.length - 1]?.value} {FIELDS.find(field => field.key === activeChart)?.unit}
              </span>
              <span className="meta">{points[points.length - 1]?.date}</span>
            </div>
          </section>
        )}

        <section className="card">
          <div className="h-3" style={{ marginBottom: 12 }}>Нова сесія</div>

          <BodyFigure
            form={form}
            activeKey={activeKey}
            onChange={handleField}
            onFocusField={setActiveKey}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-block"
            style={{ marginTop: 14, opacity: saving ? 0.7 : 1 }}
          >
            {saved ? 'Збережено ✓' : saving ? 'Зберігаємо...' : 'Зберегти заміри'}
          </button>
        </section>
      </div>
    </div>
  )
}
