import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProfileSheet from '../components/ProfileSheet'
import { IconUser, IconPlay, getProgramIcon } from '../components/Icons'

const WEEK_LABELS = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд']

function getWeekDays() {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function calcStreak(dates) {
  if (!dates?.length) return 0
  const unique = [...new Set(dates.map(d => {
    const dt = new Date(d.started_at)
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
  }))].sort((a, b) => b - a)

  const DAY = 86400000
  const today = new Date()
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  if (unique[0] < todayMs - DAY) return 0

  let streak = 0
  let expected = unique[0]
  for (const d of unique) {
    if (d === expected) { streak++; expected -= DAY } else break
  }
  return streak
}

function formatToday() {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date())
}

export default function Workout() {
  const [programs, setPrograms] = useState([])
  const [nextProgram, setNextProgram] = useState(null)
  const [progStats, setProgStats] = useState({ exercises: 0, sets: 0, est: 0 })
  const [stats, setStats] = useState({ count: 0, hours: 0, streak: 0 })
  const [weekMap, setWeekMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const navigate = useNavigate()

  const weekDays = getWeekDays()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: user } = await supabase.auth.getUser()
    const uid = user.user.id
    const weekStart = weekDays[0].toISOString()

    const [
      { data: progs },
      { data: lastWo },
      { data: allWos },
      { data: weekWos },
    ] = await Promise.all([
      supabase.from('mf_programs').select('*').order('type').order('name'),
      supabase.from('mf_workouts').select('program_id').eq('user_id', uid).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('mf_workouts').select('started_at, duration_minutes').eq('user_id', uid).not('finished_at', 'is', null),
      supabase.from('mf_workouts').select('started_at, program:mf_programs(name, color)').eq('user_id', uid).not('finished_at', 'is', null).gte('started_at', weekStart),
    ])

    const programList = progs ?? []
    setPrograms(programList)

    const totalCount = allWos?.length ?? 0
    const totalMinutes = (allWos ?? []).reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
    const streak = calcStreak(allWos ?? [])
    setStats({ count: totalCount, hours: Math.round(totalMinutes / 60 * 10) / 10, streak })

    const wm = {}
    for (const w of weekWos ?? []) {
      const key = new Date(w.started_at).toDateString()
      wm[key] = w.program?.name?.replace(/\s+—.+$/, '') ?? '—'
    }
    setWeekMap(wm)

    const main = programList.filter(p => p.type === 'основна')
    let suggested = main[0] ?? programList[0] ?? null
    if (lastWo && main.length > 1) {
      const idx = main.findIndex(p => p.id === lastWo.program_id)
      if (idx !== -1) suggested = main[(idx + 1) % main.length]
    }

    if (suggested) {
      setNextProgram(suggested)
      await loadProgStats(suggested.id)
    }

    setLoading(false)
  }

  async function loadProgStats(programId) {
    const { data: exs } = await supabase
      .from('mf_program_exercises')
      .select('default_sets')
      .eq('program_id', programId)
    const exercises = exs?.length ?? 0
    const sets = (exs ?? []).reduce((s, e) => s + (e.default_sets ?? 3), 0)
    setProgStats({ exercises, sets, est: sets * 3 })
  }

  async function selectProgram(prog) {
    setNextProgram(prog)
    setPickerOpen(false)
    await loadProgStats(prog.id)
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  const progColor = nextProgram?.color ?? '#3b82f6'
  const PIcon = nextProgram ? getProgramIcon(nextProgram) : null

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <div className="label">{formatToday()}</div>
          <div className="h-1">Сьогодні</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Профіль" onClick={() => setProfileOpen(true)}>
            <IconUser size={20} />
          </button>
        </div>
      </div>

      <div className="page stack" style={{ paddingTop: 16, gap: 12 }}>

        {/* ── BLOCK 1: next workout ── */}
        {nextProgram ? (
          <div
            className="card"
            style={{
              padding: 20,
              background: `radial-gradient(130% 110% at 105% 0%, ${progColor}28, transparent 60%), var(--surface)`,
              borderColor: `${progColor}55`,
            }}
          >
            <div className="stack" style={{ gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="label" style={{ color: progColor, letterSpacing: 0.8, fontSize: 10 }}>НАСТУПНЕ ТРЕНУВАННЯ</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  style={{
                    fontSize: 11, color: 'var(--text-3)', background: 'none',
                    border: '1px solid var(--border)', borderRadius: 20,
                    padding: '3px 10px', cursor: 'pointer',
                  }}
                >
                  Змінити
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    className="prog-icon"
                    style={{ width: 52, height: 52, borderRadius: 16, background: `${progColor}22`, flexShrink: 0 }}
                  >
                    <PIcon size={26} style={{ color: progColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.05, color: 'var(--text)' }}>
                      {nextProgram.name.replace(/\s+—.+$/, '')}
                    </div>
                    <div className="meta" style={{ marginTop: 5 }}>
                      {nextProgram.name.match(/—\s*(.+)$/)?.[1] ?? 'Добірка вправ'}
                    </div>
                  </div>
                </div>
              </button>

              <div style={{ display: 'flex', gap: 0 }}>
                {[
                  { val: progStats.exercises, lbl: 'ВПРАВ' },
                  { val: progStats.sets,      lbl: 'ПІДХОДІВ' },
                  { val: `≈${progStats.est}`, lbl: 'ХВ' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none', paddingLeft: i ? 0 : 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                    <div className="label" style={{ fontSize: 9, letterSpacing: 0.5 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => navigate(`/workout/${nextProgram.id}`, { state: { fromApp: true } })}
                style={{ gap: 8, fontSize: 15 }}
              >
                <IconPlay size={15} /> Розпочати тренування
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 20 }}>
            <div className="h-3">Програм ще немає</div>
            <div className="meta" style={{ marginTop: 6 }}>
              Додай програми у вкладці «Програми»
            </div>
          </div>
        )}

        {/* ── BLOCK 2: stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <StatCard value={stats.count}  unit="тренувань"  label="ВСЬОГО"  color="#3b82f6" />
          <StatCard value={stats.hours}  unit="годин"      label="ЧАС"     color="#8b5cf6" />
          <StatCard value={stats.streak} unit="днів"       label="СЕРІЯ"   color="#22c55e" />
        </div>

        {/* ── BLOCK 3: week ── */}
        <div
          className="card"
          style={{
            padding: '14px 16px',
            background: 'radial-gradient(80% 100% at 100% 0%, #3b82f618, transparent), var(--surface)',
            borderColor: '#3b82f640',
          }}
        >
          <div className="label" style={{ marginBottom: 12, fontSize: 10, letterSpacing: 0.5 }}>ЦЬОГО ТИЖНЯ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekDays.map((day, i) => {
              const key = day.toDateString()
              const isToday = key === new Date().toDateString()
              const progName = weekMap[key]
              const hasWorkout = !!progName

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div className="meta" style={{ fontSize: 10, color: isToday ? 'var(--text)' : 'var(--text-3)', fontWeight: isToday ? 600 : 400 }}>
                    {WEEK_LABELS[i]}
                  </div>
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: hasWorkout ? '#22c55e' : isToday ? 'var(--text-3)' : 'var(--border)',
                    boxShadow: hasWorkout ? '0 0 6px #22c55e88' : 'none',
                  }} />
                  <div style={{
                    fontSize: 9, color: 'var(--text-3)', textAlign: 'center',
                    maxWidth: 38, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {progName ?? ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── PROGRAM PICKER ── */}
      {pickerOpen && (
        <div className="sheet-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="sheet" style={{ maxHeight: '80dvh' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack" style={{ gap: 12 }}>
              <div className="h-3">Обрати програму</div>
              <div className="stack" style={{ gap: 8, maxHeight: '60dvh', overflowY: 'auto' }}>
                {programs.map(prog => {
                  const PI = getProgramIcon(prog)
                  const c = prog.color ?? '#3f3f46'
                  const isActive = nextProgram?.id === prog.id
                  return (
                    <button
                      key={prog.id}
                      type="button"
                      className="prog-select-card"
                      style={{
                        background: `radial-gradient(80% 70% at 100% 0%, ${c}14, transparent), var(--surface)`,
                        borderColor: isActive ? c : `${c}40`,
                        borderWidth: isActive ? 2 : 1,
                      }}
                      onClick={() => selectProgram(prog)}
                    >
                      <div className="prog-icon" style={{ background: `${c}18` }}>
                        <PI size={18} style={{ color: c }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {prog.name.replace(/\s+—.+$/, '')}
                        </div>
                        <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
                          {prog.name.match(/—\s*(.+)$/)?.[1] ?? ''}
                        </div>
                      </div>
                      {isActive && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function StatCard({ value, unit, label, color }) {
  return (
    <div
      className="card"
      style={{
        padding: '14px 12px',
        background: `radial-gradient(110% 100% at 100% 0%, ${color}1c, transparent), var(--surface)`,
        borderColor: `${color}35`,
      }}
    >
      <div className="label" style={{ fontSize: 9, letterSpacing: 0.5, color, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div className="meta" style={{ fontSize: 11, marginTop: 4 }}>{unit}</div>
    </div>
  )
}
