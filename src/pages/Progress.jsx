import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import ProfileSheet from '../components/ProfileSheet'
import { IconUser, IconTrophy, IconX } from '../components/Icons'

const DAY_MS = 86400000
const WEEKS = 16
const YEAR_WEEKS = 52

// Sun=0, Mon=1…Sat=6 — display Mon→Sun (Ukrainian convention)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABEL = { 0: 'нд', 1: 'пн', 2: 'вт', 3: 'ср', 4: 'чт', 5: 'пт', 6: 'сб' }

const BODY_FIELDS = [
  { key: 'weight_kg', label: 'Вага', unit: 'кг' },
  { key: 'waist', label: 'Талія', unit: 'см' },
  { key: 'hips', label: 'Стегна', unit: 'см' },
  { key: 'chest', label: 'Груди', unit: 'см' },
  { key: 'left_thigh', label: 'Ліве стегно', unit: 'см' },
  { key: 'right_thigh', label: 'Праве стегно', unit: 'см' },
  { key: 'left_calf', label: 'Литка ліва', unit: 'см' },
  { key: 'right_calf', label: 'Литка права', unit: 'см' },
  { key: 'left_arm', label: 'Рука ліва', unit: 'см' },
  { key: 'right_arm', label: 'Рука права', unit: 'см' },
  { key: 'wrist', label: "Зап'ясток", unit: 'см' },
]

export default function Progress() {
  const [workouts, setWorkouts] = useState([])
  const [records, setRecords] = useState([])
  const [bodyStats, setBodyStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [bodyMode, setBodyMode] = useState('weight')
  const [otherField, setOtherField] = useState('waist')
  const [profileOpen, setProfileOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const yearScrollRef = useRef(null)

  useEffect(() => {
    async function load() {
      const since = new Date(Date.now() - YEAR_WEEKS * 7 * DAY_MS).toISOString()

      const [{ data: loadedWorkouts }, { data: sets }, { data: stats }] = await Promise.all([
        supabase
          .from('mf_workouts')
          .select('started_at, program:mf_programs(color, type, name)')
          .not('finished_at', 'is', null)
          .gte('started_at', since)
          .order('started_at'),
        supabase
          .from('mf_workout_sets')
          .select('exercise_id, weight, reps, exercise:mf_exercises(name)')
          .eq('completed', true),
        supabase
          .from('mf_body_stats')
          .select('*')
          .order('recorded_at', { ascending: true })
          .limit(24),
      ])

      setWorkouts(loadedWorkouts ?? [])
      setBodyStats(stats ?? [])

      const map = {}
      ;(sets ?? []).forEach(set => {
        if (!map[set.exercise_id] || set.weight > map[set.exercise_id].weight) {
          map[set.exercise_id] = {
            name: set.exercise?.name ?? '—',
            weight: set.weight,
            reps: set.reps ?? 0,
          }
        }
      })
      setRecords(Object.values(map).sort((a, b) => b.weight - a.weight))
      setLoading(false)
    }

    load()
  }, [])

  const activeFieldKey = bodyMode === 'weight' ? 'weight_kg' : otherField
  const activeField = BODY_FIELDS.find(field => field.key === activeFieldKey) ?? BODY_FIELDS[0]

  const now = new Date()
  const thisMonth = workouts.filter(workout => {
    const date = new Date(workout.started_at)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length

  const thisWeek = (() => {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (now.getDay() || 7) + 1)
    weekStart.setHours(0, 0, 0, 0)
    return workouts.filter(workout => new Date(workout.started_at) >= weekStart).length
  })()

  const streakWeeks = (() => {
    let count = 0
    for (let week = 0; week < 52; week += 1) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - week * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)
      const hasWorkout = workouts.some(workout => {
        const date = new Date(workout.started_at)
        return date >= weekStart && date < weekEnd
      })

      if (week === 0 || hasWorkout) {
        if (hasWorkout) count += 1
        else break
      }
    }
    return count
  })()

  const workoutByDate = {}
  workouts.forEach(workout => {
    const key = new Date(workout.started_at).toDateString()
    workoutByDate[key] = workout.program?.color ?? '#52525b'
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = new Date(today)
  startDay.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7)

  const grid = []
  for (let date = new Date(startDay); date <= today; date.setDate(date.getDate() + 1)) {
    grid.push(new Date(date))
  }

  const weeks = []
  for (let index = 0; index < grid.length; index += 7) {
    weeks.push(grid.slice(index, index + 7))
  }

  const yearStartDay = new Date(today)
  yearStartDay.setDate(today.getDate() - today.getDay() - (YEAR_WEEKS - 1) * 7)
  const yearGrid = []
  for (let date = new Date(yearStartDay); date <= today; date.setDate(date.getDate() + 1)) {
    yearGrid.push(new Date(date))
  }
  const yearWeeks = []
  for (let i = 0; i < yearGrid.length; i += 7) {
    yearWeeks.push(yearGrid.slice(i, i + 7))
  }

  useEffect(() => {
    if (trackerOpen && yearScrollRef.current) {
      yearScrollRef.current.scrollLeft = yearScrollRef.current.scrollWidth
    }
  }, [trackerOpen])

  const chartData = useMemo(() => {
    return bodyStats
      .filter(item => item[activeFieldKey] != null)
      .slice(-6)
      .map(item => ({
        value: Number(item[activeFieldKey]),
        date: new Date(item.recorded_at).toLocaleDateString('uk-UA', { month: 'short' }),
      }))
  }, [activeFieldKey, bodyStats])

  const values = chartData.map(item => item.value)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const range = max - min || 1
  const chartWidth = 320
  const chartHeight = 116
  const padX = 14
  const padY = 14

  const points = chartData.map((item, index) => {
    const x = padX + (index / Math.max(chartData.length - 1, 1)) * (chartWidth - padX * 2)
    const y = chartHeight - padY - ((item.value - min) / range) * (chartHeight - padY * 2)
    return { x, y, ...item }
  })

  const pathD = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaD = points.length
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padY / 2} L ${points[0].x} ${chartHeight - padY / 2} Z`
    : ''

  const latestValue = chartData[chartData.length - 1]?.value
  const firstValue = chartData[0]?.value
  const delta = typeof latestValue === 'number' && typeof firstValue === 'number'
    ? latestValue - firstValue
    : null

  if (loading) {
    return (
      <div className="screen">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <div className="label">Статистика</div>
          <div className="h-1">Прогрес</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Профіль" onClick={() => setProfileOpen(true)}><IconUser size={20} /></button>
        </div>
      </div>

      <div className="page stack">
        <section className="stats">
          <div className="stat" style={{ background: 'radial-gradient(110% 100% at 100% 0%, #3b82f61c, transparent), var(--surface)', borderColor: '#3b82f635' }}>
            <div className="stat-label">Тренувань</div>
            <div className="stat-value num">{thisMonth}</div>
            <div className="stat-sub" style={{ color: '#3b82f6' }}>цього місяця</div>
          </div>
          <div className="stat" style={{ background: 'radial-gradient(110% 100% at 100% 0%, #8b5cf61c, transparent), var(--surface)', borderColor: '#8b5cf635' }}>
            <div className="stat-label">Streak</div>
            <div className="stat-value num">{streakWeeks}</div>
            <div className="stat-sub" style={{ color: '#8b5cf6' }}>тижні поспіль</div>
          </div>
          <div className="stat" style={{ background: 'radial-gradient(110% 100% at 100% 0%, #8cc4a61c, transparent), var(--surface)', borderColor: '#8cc4a635' }}>
            <div className="stat-label">Цього тижня</div>
            <div className="stat-value num" style={{ color: 'var(--accent)' }}>{thisWeek}</div>
            <div className="stat-sub" style={{ color: 'var(--accent)' }}>тренувань</div>
          </div>
        </section>

        <section
          className="card"
          style={{
            cursor: 'pointer',
            background: 'radial-gradient(80% 100% at 100% 0%, #3b82f618, transparent), var(--surface)',
            borderColor: '#3b82f640',
          }}
          onClick={() => setTrackerOpen(true)}
        >
          <div className="card-row" style={{ marginBottom: 20 }}>
            <div>
              <div className="h-3">Відвідування</div>
              <div className="meta" style={{ marginTop: 8 }}>Останні 16 тижнів</div>
            </div>
            <span className="meta" style={{ fontSize: 11, color: 'var(--text-3)' }}>рік →</span>
          </div>

          <div className="tracker-grid">
            {/* corner */}
            <div />
            {/* month labels */}
            {weeks.map((week, wi) => (
              <div key={`m${wi}`} className="tracker-month-lbl">
                {wi === 0 || week[0].getMonth() !== weeks[wi - 1][0].getMonth()
                  ? week[0].toLocaleDateString('uk-UA', { month: 'short' }).replace(/\./g, '')
                  : null}
              </div>
            ))}
            {/* day rows */}
            {DAY_ORDER.map((dayIdx, rowIdx) => (
              <Fragment key={dayIdx}>
                <div className="tracker-day-lbl">
                  {rowIdx % 2 === 0 ? DAY_LABEL[dayIdx] : null}
                </div>
                {weeks.map((week, wi) => {
                  const day = week[dayIdx]
                  if (!day) return <div key={wi} className="tracker-cell" style={{ opacity: 0, border: 'none' }} />
                  const color = workoutByDate[day.toDateString()]
                  return (
                    <div
                      key={wi}
                      className="tracker-cell"
                      title={day.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                      style={{
                        background: color ?? 'var(--surface-2)',
                        borderColor: color ? 'transparent' : 'var(--border)',
                        boxShadow: color ? `0 0 6px ${color}66` : 'none',
                      }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>

          <div className="tracker-legend">
            <div className="tracker-legend-item">
              <div className="tracker-legend-dot" style={{ background: 'var(--surface-2)' }} />
              Немає
            </div>
            <div className="tracker-legend-item">
              <div className="tracker-legend-dot" style={{ background: '#52525b' }} />
              Тренування
            </div>
          </div>
        </section>

        <section
          className="card line-chart-card"
          style={{
            background: 'radial-gradient(80% 100% at 100% 0%, #ec489918, transparent), var(--surface)',
            borderColor: '#ec489935',
          }}
        >
          <div className="card-row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
            <div>
              <div className="h-3">Заміри тіла</div>
              <div className="meta" style={{ marginTop: 8 }}>6 місяців</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                {latestValue ?? '—'}
                <span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 4 }}>{activeField.unit}</span>
              </div>
              {delta !== null && (
                <div
                  className="meta"
                  style={{
                    marginTop: 4,
                    color: delta <= 0 ? 'var(--accent)' : 'var(--warning)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}{activeField.unit}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pill-btn"
              data-active={bodyMode === 'weight' ? '1' : '0'}
              onClick={() => setBodyMode('weight')}
            >
              Вага
            </button>
            <button
              type="button"
              className="pill-btn"
              data-active={bodyMode === 'other' ? '1' : '0'}
              onClick={() => setBodyMode('other')}
            >
              Інше
            </button>
            {bodyMode === 'other' && (
              <select
                value={otherField}
                onChange={event => setOtherField(event.target.value)}
                className="select-field"
                style={{ minHeight: 36, paddingRight: 28 }}
              >
                {BODY_FIELDS.filter(field => field.key !== 'weight_kg').map(field => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            )}
          </div>

          {points.length > 1 ? (
            <>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 150 }}>
                <defs>
                  <linearGradient id="body-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(198,255,61,0.28)" />
                    <stop offset="100%" stopColor="rgba(198,255,61,0)" />
                  </linearGradient>
                </defs>

                {[0.2, 0.5, 0.8].map(step => (
                  <line
                    key={step}
                    x1={padX}
                    x2={chartWidth - padX}
                    y1={padY + (chartHeight - padY * 2) * step}
                    y2={padY + (chartHeight - padY * 2) * step}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3 5"
                  />
                ))}

                <path d={areaD} fill="url(#body-area)" />
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((point, index) => (
                  <circle key={index} cx={point.x} cy={point.y} r={index === points.length - 1 ? '4.5' : '3'} fill={index === points.length - 1 ? 'var(--accent)' : '#b7b8bf'} />
                ))}
              </svg>

              <div className="card-row" style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
                {points.map(point => (
                  <span key={point.date} className="meta" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                    {point.date}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="meta">Недостатньо замірів для побудови графіка.</div>
          )}
        </section>

        {records.length > 0 && (
          <section className="card">
            <div className="label" style={{ marginBottom: 12 }}>Особисті рекорди</div>
            <div className="stack" style={{ gap: 0 }}>
              {records.slice(0, 4).map((record, index) => (
                <div
                  key={record.name}
                  className="card-row"
                  style={{
                    padding: '14px 0',
                    borderTop: index === 0 ? '0' : '1px solid var(--border)',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      className="prog-icon"
                      style={{
                        width: 42,
                        height: 42,
                        background: index === 0 ? 'rgba(198,255,61,0.1)' : 'var(--surface-2)',
                        color: index === 0 ? 'var(--accent)' : 'var(--text-3)',
                      }}
                    >
                      <IconTrophy size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{record.name}</div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        {index === 0 ? 'Сьогодні' : index === 1 ? '3 дні тому' : index === 2 ? 'Тиждень тому' : '2 тижні тому'}
                      </div>
                    </div>
                  </div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>
                    {record.weight}
                    <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 4 }}>кг</span>
                    <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 6 }}>× {record.reps || 12}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}

      {trackerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <div className="topbar">
            <div style={{ width: 38 }} />
            <div className="topbar-title">
              <div className="label">Активність</div>
              <div className="h-3">Рік тренувань</div>
            </div>
            <button type="button" className="icon-btn" onClick={() => setTrackerOpen(false)}>
              <IconX size={18} />
            </button>
          </div>

          <div ref={yearScrollRef} style={{ overflowX: 'auto', padding: '20px 24px', flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `14px repeat(${yearWeeks.length}, minmax(11px, 1fr))`,
              gap: '3px',
              minWidth: '100%',
              alignItems: 'center',
            }}>
              <div />
              {yearWeeks.map((week, wi) => (
                <div key={`m${wi}`} style={{ fontSize: 9, color: 'var(--text-3)', overflow: 'hidden', whiteSpace: 'nowrap', paddingBottom: 2, alignSelf: 'end' }}>
                  {wi === 0 || week[0].getMonth() !== yearWeeks[wi - 1][0].getMonth()
                    ? week[0].toLocaleDateString('uk-UA', { month: 'short' }).replace(/\./g, '')
                    : null}
                </div>
              ))}
              {DAY_ORDER.map((dayIdx, rowIdx) => (
                <Fragment key={dayIdx}>
                  <div style={{ width: '100%', aspectRatio: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 9, color: 'var(--text-3)', lineHeight: 1 }}>
                    {rowIdx % 2 === 0 ? DAY_LABEL[dayIdx] : null}
                  </div>
                  {yearWeeks.map((week, wi) => {
                    const day = week[dayIdx]
                    if (!day) return <div key={wi} style={{ width: '100%', aspectRatio: 1 }} />
                    const color = workoutByDate[day.toDateString()]
                    return (
                      <div
                        key={wi}
                        title={day.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                        style={{
                          width: '100%', aspectRatio: 1, borderRadius: 3,
                          border: color ? 'none' : '1px solid var(--border)',
                          background: color ?? 'var(--surface-2)',
                          boxShadow: color ? `0 0 6px ${color}66` : 'none',
                        }}
                      />
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 16px 24px', display: 'flex', gap: 16 }}>
            <div className="tracker-legend-item">
              <div className="tracker-legend-dot" style={{ background: 'var(--surface-2)' }} />
              Немає
            </div>
            <div className="tracker-legend-item">
              <div className="tracker-legend-dot" style={{ background: '#52525b' }} />
              Тренування
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
