import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconX, IconBell, IconVibration, IconBrightness, IconStopwatch } from './Icons'
import { BODY_FIELDS } from '../lib/bodyFields'

const GOALS = [
  { key: 'weight_loss', label: 'Схуднення' },
  { key: 'muscle_gain', label: 'Набір маси' },
  { key: 'maintenance', label: 'Підтримка' },
]

function getLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v) } catch { return fallback }
}
function setLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore storage write errors */ }
}

export default function ProfileSheet({ onClose }) {
  const [age, setAge] = useState(() => getLS('mf_age', ''))
  const [height, setHeight] = useState(() => getLS('mf_height', ''))
  const [goal, setGoal] = useState(() => getLS('mf_goal', ''))
  const [goalWeight, setGoalWeight] = useState(() => getLS('mf_goal_weight', ''))
  const [sound, setSound] = useState(() => getLS('mf_sound_enabled', true))
  const [vibration, setVibration] = useState(() => getLS('mf_vibration_enabled', true))
  const [wakeLock, setWakeLock] = useState(() => getLS('mf_wake_lock_enabled', true))
  const [restSeconds, setRestSeconds] = useState(() => getLS('mf_rest_seconds', 90))
  const [bodyForm, setBodyForm] = useState({})
  const [bodyOpen, setBodyOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('mf_body_stats')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const form = {}
        BODY_FIELDS.forEach(f => { form[f.key] = data[f.key] ?? '' })
        setBodyForm(form)
      })
  }, [])

  function toggle(key, value, setter) {
    setter(value)
    setLS(key, value)
  }

  async function saveBodyStats() {
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    const payload = { user_id: user.user.id }
    BODY_FIELDS.forEach(f => {
      const v = parseFloat(bodyForm[f.key])
      if (!isNaN(v)) payload[f.key] = v
    })
    await supabase.from('mf_body_stats').insert(payload)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        style={{ maxHeight: '88dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-handle" />

        <div className="stack" style={{ gap: 24 }}>
          {/* Header */}
          <div className="card-row">
            <div className="h-3">Профіль</div>
            <button type="button" className="icon-btn" onClick={onClose}>
              <IconX size={18} />
            </button>
          </div>

          {/* Особисті дані */}
          <div className="stack" style={{ gap: 12 }}>
            <div className="label">Особисті дані</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <span className="meta">Вік</span>
                <input
                  type="number"
                  value={age}
                  onChange={e => { setAge(e.target.value); setLS('mf_age', e.target.value) }}
                  placeholder="—"
                  className="field"
                  style={{ textAlign: 'center', width: '100%' }}
                />
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <span className="meta">Зріст, см</span>
                <input
                  type="number"
                  value={height}
                  onChange={e => { setHeight(e.target.value); setLS('mf_height', e.target.value) }}
                  placeholder="—"
                  className="field"
                  style={{ textAlign: 'center', width: '100%' }}
                />
              </div>
            </div>
            <div
              className="card-row"
              style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <label style={{ color: 'var(--text)', fontSize: 14 }}>Ціль ваги</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  step={0.1}
                  value={goalWeight}
                  onChange={e => { setGoalWeight(e.target.value); setLS('mf_goal_weight', e.target.value) }}
                  placeholder="—"
                  className="field"
                  style={{ width: 72, textAlign: 'right', background: 'transparent', border: 0, paddingRight: 0 }}
                />
                <span className="meta" style={{ width: 22 }}>кг</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GOALS.map(g => (
                <button
                  key={g.key}
                  type="button"
                  className="pill-btn"
                  data-active={goal === g.key ? '1' : '0'}
                  onClick={() => { setGoal(g.key); setLS('mf_goal', g.key) }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Заміри тіла */}
          <div className="stack" style={{ gap: 12 }}>
            <button
              type="button"
              className="card-row"
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
              }}
              onClick={() => setBodyOpen(v => !v)}
            >
              <div className="label">Заміри тіла</div>
              <span style={{ color: 'var(--text-3)', fontSize: 18, transform: bodyOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>∨</span>
            </button>

            {bodyOpen && (
              <div className="stack" style={{ gap: 8 }}>
                {BODY_FIELDS.map(f => (
                  <div
                    key={f.key}
                    className="card-row"
                    style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <label style={{ color: 'var(--text)', fontSize: 14 }}>{f.label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        step={f.step}
                        value={bodyForm[f.key] ?? ''}
                        onChange={e => setBodyForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder="—"
                        className="field"
                        style={{ width: 72, textAlign: 'right', background: 'transparent', border: 0, paddingRight: 0 }}
                      />
                      <span className="meta" style={{ width: 22 }}>{f.unit}</span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={saveBodyStats}
                  disabled={saving}
                  style={{ marginTop: 4, opacity: saving ? 0.7 : 1 }}
                >
                  {saved ? 'Збережено ✓' : saving ? 'Зберігаємо...' : 'Зберегти заміри'}
                </button>
              </div>
            )}
          </div>

          {/* Налаштування */}
          <div className="stack" style={{ gap: 12 }}>
            <div className="label">Налаштування тренування</div>

            <Toggle icon={<IconBell size={17} />} label="Звук після таймера" value={sound} onChange={v => toggle('mf_sound_enabled', v, setSound)} />
            <Toggle icon={<IconVibration size={17} />} label="Вібрація після таймера" value={vibration} onChange={v => toggle('mf_vibration_enabled', v, setVibration)} />
            <Toggle icon={<IconBrightness size={17} />} label="Екран не гасне" value={wakeLock} onChange={v => toggle('mf_wake_lock_enabled', v, setWakeLock)} />

            <div
              className="card-row"
              style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconStopwatch size={17} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                Відпочинок за замовч.
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={restSeconds}
                  min={15}
                  max={300}
                  step={15}
                  onChange={e => { const v = Number(e.target.value); setRestSeconds(v); setLS('mf_rest_seconds', v) }}
                  className="field"
                  style={{ width: 62, textAlign: 'center' }}
                />
                <span className="meta">сек</span>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button type="button" className="btn btn-ghost btn-block" onClick={logout} style={{ color: 'var(--warning)' }}>
            Вийти з акаунта
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ icon, label, value, onChange }) {
  return (
    <div
      className="card-row"
      style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{icon}</span>
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: value ? 'var(--accent)' : 'var(--surface)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: value ? 'var(--accent-text)' : 'var(--text-3)',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}
