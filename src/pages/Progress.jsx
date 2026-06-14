import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import LoadErrorState from '../components/LoadErrorState'
import ProfileSheet from '../components/ProfileSheet'
import {
  IconUser, IconTrophy, IconX,
  IconBodyWeight, IconBodyChest, IconBodyWaist, IconBodyThigh,
  IconBodyNeck, IconBodyGlutes, IconBodyBiceps, IconBodyCalf,
} from '../components/Icons'
import { BODY_FIELDS, CHART_FIELDS } from '../lib/bodyFields'

const DAY_MS = 86400000

// Мапінг ключа іконки (з CHART_FIELDS.icon) на компонент.
const BODY_ICONS = {
  weight: IconBodyWeight,
  chest: IconBodyChest,
  waist: IconBodyWaist,
  thigh: IconBodyThigh,
  neck: IconBodyNeck,
  glutes: IconBodyGlutes,
  biceps: IconBodyBiceps,
  calf: IconBodyCalf,
}

function formatRecordDate(dateStr) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / DAY_MS)
  if (diff === 0) return 'Сьогодні'
  if (diff === 1) return 'Вчора'
  if (diff < 7) return `${diff} дн. тому`
  if (diff < 30) return `${Math.floor(diff / 7)} тиж. тому`
  return new Date(dateStr).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}
const YEAR_WEEKS = 52

export default function Progress() {
  const [workouts, setWorkouts] = useState([])
  const [records, setRecords] = useState([])
  const [bodyStats, setBodyStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [chartView, setChartView] = useState('graph') // 'graph' | 'table'
  const [activeFieldKey, setActiveFieldKey] = useState('weight_kg')
  const [profileOpen, setProfileOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const yearScrollRef = useRef(null)

  useEffect(() => {
    async function load() {
      setLoadError(null)
      try {
        const since = new Date(Date.now() - YEAR_WEEKS * 7 * DAY_MS).toISOString()

        const [
          { data: loadedWorkouts, error: workoutsError },
          { data: sets, error: setsError },
          { data: stats, error: statsError },
        ] = await Promise.all([
          supabase
            .from('mf_workouts')
            .select('started_at, program:mf_programs(color, type, name)')
            .not('finished_at', 'is', null)
            .gte('started_at', since)
            .order('started_at'),
          supabase
            .from('mf_workout_sets')
            .select('exercise_id, weight, reps, created_at, exercise:mf_exercises(name)')
            .eq('completed', true),
          supabase
            .from('mf_body_stats')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(24),
        ])
        if (workoutsError || setsError || statsError) throw workoutsError ?? setsError ?? statsError

        setWorkouts(loadedWorkouts ?? [])
        setBodyStats((stats ?? []).slice().reverse())

        const map = {}
        ;(sets ?? []).forEach(set => {
          if (!map[set.exercise_id] || set.weight > map[set.exercise_id].weight) {
            map[set.exercise_id] = {
              name: set.exercise?.name ?? '—',
              weight: set.weight,
              reps: set.reps ?? 0,
              date: set.created_at,
            }
          }
        })
        setRecords(Object.values(map).sort((a, b) => b.weight - a.weight))
      } catch (error) {
        console.error('loadProgress:', error)
        setLoadError('Не вдалося завантажити прогрес. Спробуй оновити застосунок.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [reloadKey])

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
      weekStart.setDate(now.getDate() - (now.getDay() || 7) + 1 - week * 7)
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

  const workoutByDay = {}
  workouts.forEach(workout => {
    const key = new Date(workout.started_at).toDateString()
    workoutByDay[key] = { color: workout.program?.color ?? '#52525b', name: workout.program?.name ?? 'Тренування' }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Місячний календар поточного місяця: тижні пн→нд, з порожніми
  // комірками на початку/кінці, щоб числа стояли під правильними днями.
  const monthFirst = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthLast = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const leadBlanks = (monthFirst.getDay() || 7) - 1 // пн=0 порожніх, нд=6
  const monthCells = []
  for (let i = 0; i < leadBlanks; i++) monthCells.push(null)
  for (let d = 1; d <= monthLast.getDate(); d++) {
    monthCells.push(new Date(today.getFullYear(), today.getMonth(), d))
  }
  while (monthCells.length % 7 !== 0) monthCells.push(null)
  const monthTitle = monthFirst.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })

  // Які програми реально були цього місяця — для легенди.
  const monthPrograms = {}
  monthCells.forEach(day => {
    if (!day) return
    const info = workoutByDay[day.toDateString()]
    if (info?.color) monthPrograms[info.color] = info.name
  })

  // Понеділок поточного тижня (getDay: нд=0 → зсув 6, пн=1 → зсув 0).
  const mondayOffset = (today.getDay() + 6) % 7
  const yearStartDay = new Date(today)
  yearStartDay.setDate(today.getDate() - mondayOffset - (YEAR_WEEKS - 1) * 7)
  const yearGrid = []
  for (let date = new Date(yearStartDay); date <= today; date.setDate(date.getDate() + 1)) {
    yearGrid.push(new Date(date))
  }
  // Кожен тиждень: [пн, вт, ср, чт, пт, сб, нд].
  const yearWeeks = []
  for (let i = 0; i < yearGrid.length; i += 7) {
    yearWeeks.push(yearGrid.slice(i, i + 7))
  }

  useEffect(() => {
    if (trackerOpen && yearScrollRef.current) {
      setTimeout(() => {
        yearScrollRef.current.scrollTop = yearScrollRef.current.scrollHeight
      }, 0)
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

  const goalWeight = (() => {
    try {
      if (activeFieldKey !== 'weight_kg') return null
      const v = localStorage.getItem('mf_goal_weight')
      return v ? parseFloat(JSON.parse(v)) : null
    } catch { return null }
  })()

  const values = chartData.map(item => item.value)
  const allValuesForRange = goalWeight != null ? [...values, goalWeight] : values
  const min = allValuesForRange.length ? Math.min(...allValuesForRange) : 0
  const max = allValuesForRange.length ? Math.max(...allValuesForRange) : 0
  const range = max - min || 1
  const chartWidth = 320
  const chartHeight = 116
  const padX = 14
  const padY = 14

  const points = chartData.map((item, index) => {
    const x = chartData.length === 1
      ? chartWidth / 2
      : padX + (index / (chartData.length - 1)) * (chartWidth - padX * 2)
    const y = chartHeight - padY - ((item.value - min) / range) * (chartHeight - padY * 2)
    return { x, y, ...item }
  })

  const goalY = goalWeight != null
    ? chartHeight - padY - ((goalWeight - min) / range) * (chartHeight - padY * 2)
    : null

  const pathD = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaD = points.length
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padY / 2} L ${points[0].x} ${chartHeight - padY / 2} Z`
    : ''

  const latestValue = chartData[chartData.length - 1]?.value
  const firstValue = chartData[0]?.value
  const delta = typeof latestValue === 'number' && typeof firstValue === 'number'
    ? latestValue - firstValue
    : null

  // Рядки таблиці: від найновіших до найстаріших (bodyStats — за зростанням).
  const tableRows = bodyStats.slice().reverse().map(item => ({
    date: new Date(item.recorded_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    values: item,
  }))

  if (loading) {
    return (
      <div className="screen">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="screen">
        <LoadErrorState message={loadError} onRetry={() => setReloadKey(value => value + 1)} />
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
          <div className="card-row" style={{ marginBottom: 16 }}>
            <div>
              <div className="h-3">Відвідування</div>
              <div className="meta" style={{ marginTop: 6, textTransform: 'capitalize' }}>{monthTitle}</div>
            </div>
            <span className="meta" style={{ fontSize: 11, color: 'var(--text-3)' }}>рік →</span>
          </div>

          <div className="month-cal">
            {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'].map(d => (
              <div key={d} className="month-cal-dow">{d}</div>
            ))}
            {monthCells.map((day, idx) => {
              if (!day) return <div key={idx} className="month-cal-cell" />
              const isFuture = day > today
              const isToday = day.toDateString() === today.toDateString()
              const info = workoutByDay[day.toDateString()]
              const color = info?.color
              return (
                <div
                  key={idx}
                  className="month-cal-cell"
                  title={info ? info.name : day.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                >
                  <div
                    className="month-cal-day"
                    data-today={isToday ? '1' : '0'}
                    style={{
                      background: color || 'transparent',
                      color: color ? '#fff' : isFuture ? 'var(--text-4)' : 'var(--text-2)',
                      boxShadow: color ? `0 0 8px ${color}66` : 'none',
                      opacity: isFuture ? 0.4 : 1,
                    }}
                  >
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="tracker-legend">
            {Object.keys(monthPrograms).length === 0 ? (
              <div className="tracker-legend-item">
                <div className="tracker-legend-dot" style={{ background: 'var(--surface-2)' }} />
                Цього місяця тренувань ще немає
              </div>
            ) : (
              Object.entries(monthPrograms).map(([color, name]) => (
                <div key={color} className="tracker-legend-item">
                  <div className="tracker-legend-dot" style={{ background: color, borderRadius: '50%' }} />
                  {name}
                </div>
              ))
            )}
          </div>
        </section>

        <section
          className="card line-chart-card"
          style={{
            background: 'radial-gradient(80% 100% at 100% 0%, #ec489918, transparent), var(--surface)',
            borderColor: '#ec489935',
          }}
        >
          <div className="card-row" style={{ marginBottom: 16, alignItems: 'center' }}>
            <div className="h-3">Заміри тіла</div>
            <div className="seg-toggle">
              <button
                type="button"
                className="seg-toggle-btn"
                data-active={chartView === 'graph' ? '1' : '0'}
                onClick={() => setChartView('graph')}
              >
                Графік
              </button>
              <button
                type="button"
                className="seg-toggle-btn"
                data-active={chartView === 'table' ? '1' : '0'}
                onClick={() => setChartView('table')}
              >
                Таблиця
              </button>
            </div>
          </div>

          {chartView === 'graph' ? (
            <>
              {/* Назва показника + дельта зміни */}
              <div style={{ marginBottom: 4 }}>
                <div className="h-2" style={{ fontSize: 24 }}>{activeField.label}</div>
                {delta !== null && (
                  <div
                    style={{
                      marginTop: 2,
                      color: delta <= 0 ? 'var(--accent)' : 'var(--warning)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} {activeField.unit} {delta <= 0 ? '↓' : '↑'}
                  </div>
                )}
              </div>

              {points.length >= 1 ? (
                <>
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 180, marginTop: 8 }}>
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

                    {goalY != null && (
                      <>
                        <line
                          x1={padX}
                          x2={chartWidth - padX}
                          y1={goalY}
                          y2={goalY}
                          stroke="rgba(96,165,250,0.7)"
                          strokeWidth="1.5"
                          strokeDasharray="5 4"
                        />
                        <text
                          x={chartWidth - padX - 2}
                          y={goalY - 4}
                          textAnchor="end"
                          fill="rgba(96,165,250,0.9)"
                          fontSize="10"
                          fontWeight="600"
                        >
                          {goalWeight} кг
                        </text>
                      </>
                    )}

                    {points.length > 1 && <path d={areaD} fill="url(#body-area)" />}
                    {points.length > 1 && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Підписані значення над кожною точкою */}
                    {points.map((point, index) => (
                      <text
                        key={`v-${index}`}
                        x={point.x}
                        y={point.y - 8}
                        textAnchor="middle"
                        fill="var(--text-2)"
                        fontSize="9"
                        fontWeight="600"
                      >
                        {point.value}
                      </text>
                    ))}
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
                <div className="meta" style={{ padding: '32px 0', textAlign: 'center' }}>
                  Недостатньо замірів для побудови графіка.
                </div>
              )}

              {/* Пілси-іконки для вибору показника */}
              <div className="measure-pills">
                {CHART_FIELDS.map(field => {
                  const PillIcon = BODY_ICONS[field.icon]
                  const active = activeFieldKey === field.key
                  return (
                    <button
                      key={field.key}
                      type="button"
                      className="measure-pill"
                      data-active={active ? '1' : '0'}
                      onClick={() => setActiveFieldKey(field.key)}
                    >
                      <span className="measure-pill-dot">
                        {PillIcon ? <PillIcon size={22} /> : null}
                      </span>
                      <span className="measure-pill-label">{field.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <MeasureTable rows={tableRows} columns={CHART_FIELDS} />
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
                        {formatRecordDate(record.date)}
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

          <div ref={yearScrollRef} style={{ overflowY: 'auto', padding: '8px 16px 24px', flex: 1 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `28px repeat(7, 1fr)`,
              gap: '3px',
            }}>
              {/* Header row: empty + day labels (пн→нд) */}
              <div />
              {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'].map(d => (
                <div key={d} style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', paddingBottom: 6 }}>
                  {d}
                </div>
              ))}

              {/* Week rows — кожен тиждень уже [пн..нд], рендеримо по порядку */}
              {yearWeeks.map((week, wi) => (
                <Fragment key={wi}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', display: 'flex', alignItems: 'center', paddingRight: 4, whiteSpace: 'nowrap' }}>
                    {wi === 0 || week[0].getMonth() !== yearWeeks[wi - 1][0].getMonth()
                      ? week[0].toLocaleDateString('uk-UA', { month: 'short' }).replace(/\./g, '')
                      : null}
                  </div>
                  {week.map((day, di) => {
                    if (!day) return <div key={di} style={{ aspectRatio: 1, borderRadius: 3 }} />
                    const info = workoutByDay[day.toDateString()]
                    const color = info?.color
                    const isFuture = day > today
                    return (
                      <div
                        key={di}
                        onClick={() => info && setSelectedDay({ date: day, ...info })}
                        title={day.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                        style={{
                          aspectRatio: 1, borderRadius: 3,
                          border: color ? 'none' : '1px solid var(--border)',
                          background: color ?? (isFuture ? 'transparent' : 'var(--surface-2)'),
                          boxShadow: color ? `0 0 8px ${color}88` : 'none',
                          opacity: isFuture ? 0.25 : 1,
                          cursor: color ? 'pointer' : 'default',
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

      {selectedDay && (
        <div
          onClick={() => setSelectedDay(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.45)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', padding: '24px 24px 40px', width: '100%', borderRadius: '16px 16px 0 0', border: '1px solid var(--border)' }}
          >
            <div className="label" style={{ marginBottom: 8 }}>
              {selectedDay.date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="h-3" style={{ color: selectedDay.color }}>
              {selectedDay.name}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Таблиця замірів: дата × показники. Колонка «Дата» липка зліва,
// решта показників горизонтально скролиться (як ексель).
function MeasureTable({ rows, columns }) {
  const fieldByKey = Object.fromEntries(BODY_FIELDS.map(f => [f.key, f]))

  if (rows.length === 0) {
    return (
      <div className="meta" style={{ padding: '32px 0', textAlign: 'center' }}>
        Ще немає збережених замірів.
      </div>
    )
  }

  return (
    <div className="measure-table-wrap">
      <table className="measure-table">
        <thead>
          <tr>
            <th className="measure-table-date">Дата</th>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="measure-table-date">{row.date}</td>
              {columns.map(col => {
                const value = row.values[col.key]
                const unit = fieldByKey[col.key]?.unit ?? ''
                return (
                  <td key={col.key}>
                    {value != null ? `${value} ${unit}` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
