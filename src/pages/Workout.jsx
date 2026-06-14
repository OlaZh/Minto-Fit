import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  clearCurrentWorkout,
  clearPendingFinish,
  clearPendingSetsForWorkout,
  getCurrentWorkout,
  getPendingFinish,
  syncPendingSetsForWorkout,
} from '../lib/workoutStorage'
import LoadErrorState from '../components/LoadErrorState'
import ProfileSheet from '../components/ProfileSheet'
import { IconUser, IconPlay } from '../components/Icons'
import ProgramGlyph from '../components/ProgramGlyph'

const WEEK_LABELS = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд']

function getWeekDays(offset = 0) {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
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

function nowMs() {
  return new Date().getTime()
}

function formatStartedAt(dateStr) {
  const d = new Date(dateStr)
  const isToday = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Почато сьогодні о ${time}`
  const day = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  return `Почато ${day} о ${time}`
}

export default function Workout() {
  const [programs, setPrograms] = useState([])
  const [nextProgram, setNextProgram] = useState(null)
  const [progStats, setProgStats] = useState({ exercises: 0, sets: 0, est: 0 })
  const [stats, setStats] = useState({ count: 0, hours: 0, streak: 0 })
  const [allWeekWos, setAllWeekWos] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [unfinished, setUnfinished] = useState(null)
  const [recovering, setRecovering] = useState(false)
  const touchStartX = useRef(null)
  const initialWeekStartRef = useRef(getWeekDays(0)[0])
  const navigate = useNavigate()

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  const weekMap = useMemo(() => {
    const wm = {}
    for (const w of allWeekWos) {
      const key = new Date(w.started_at).toDateString()
      wm[key] = { color: w.program?.color ?? '#22c55e' }
    }
    return wm
  }, [allWeekWos])

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'ЦЬОГО ТИЖНЯ'
    if (weekOffset === -1) return 'МИНУЛИЙ ТИЖДЕНЬ'
    const s = weekDays[0].toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }).replace(' р.', '')
    const e = weekDays[6].toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }).replace(' р.', '')
    return `${s} — ${e}`
  }, [weekOffset, weekDays])

  async function loadProgStats(programId) {
    const [{ data: exs, error: exsError }, { data: lastWo, error: lastWoError }] = await Promise.all([
      supabase.from('mf_program_exercises').select('default_sets').eq('program_id', programId),
      supabase.from('mf_workouts').select('duration_minutes').eq('program_id', programId).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (exsError || lastWoError) throw exsError ?? lastWoError
    const exercises = exs?.length ?? 0
    const sets = (exs ?? []).reduce((s, e) => s + (e.default_sets ?? 3), 0)
    const isEstimate = !lastWo?.duration_minutes
    const est = lastWo?.duration_minutes ?? sets * 3
    setProgStats({ exercises, sets, est, isEstimate })
  }

  async function selectProgram(prog) {
    setLoadError(null)
    try {
      setNextProgram(prog)
      setPickerOpen(false)
      await loadProgStats(prog.id)
    } catch (error) {
      console.error('selectProgram:', error)
      setLoadError('Не вдалося завантажити дані програми. Спробуй оновити екран.')
    }
  }

  // Продовжити незавершене тренування: ведемо на активний екран тієї ж
  // програми (НЕ preview) — там resume сам підхопить запис по workout_id.
  function resumeUnfinished() {
    if (!unfinished?.programId) return
    navigate(`/workout/${unfinished.programId}`)
  }

  // Завершити незавершене тренування свідомо: ставимо finished_at = зараз,
  // тривалість = реальний проміжок від старту. Не чіпаємо локальний стан,
  // поки БД не підтвердила оновлення.
  async function finishUnfinished() {
    if (!unfinished?.id || recovering) return
    setRecovering(true)
    try {
      const sync = await syncPendingSetsForWorkout(supabase, unfinished.id)
      if (!sync.ok) throw sync.error ?? new Error('pending sync failed')

      const durationMs = nowMs() - new Date(unfinished.startedAt).getTime()
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000))
      const { data: finished, error } = await supabase
        .from('mf_workouts')
        .update({ finished_at: new Date().toISOString(), duration_minutes: durationMinutes })
        .eq('id', unfinished.id)
        .is('finished_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw error

      if (finished?.id) clearCurrentWorkout()
      setUnfinished(null)
      setReloadKey(value => value + 1)
    } catch (error) {
      console.error('finishUnfinished:', error)
      setLoadError('Не вдалося завершити незавершене тренування. Спробуй ще раз.')
    } finally {
      setRecovering(false)
    }
  }

  // Скасувати незавершене тренування: явний DELETE запису в БД + чистка
  // локального стану й pending-сетів. Не лишаємо висячих finished_at = null.
  async function cancelUnfinished() {
    if (!unfinished?.id || recovering) return
    setRecovering(true)
    try {
      const { error } = await supabase
        .from('mf_workouts')
        .delete()
        .eq('id', unfinished.id)
        .is('finished_at', null)
      if (error) throw error

      clearPendingSetsForWorkout(unfinished.id)
      clearPendingFinish(unfinished.id)
      clearCurrentWorkout()
      setUnfinished(null)
      setReloadKey(value => value + 1)
    } catch (error) {
      console.error('cancelUnfinished:', error)
      setLoadError('Не вдалося скасувати незавершене тренування. Спробуй ще раз.')
    } finally {
      setRecovering(false)
    }
  }

  useEffect(() => {
    async function loadAll() {
      setLoadError(null)
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user?.id) throw userError ?? new Error('No user')
        const uid = userData.user.id

        const pendingFinish = getPendingFinish()
        if (pendingFinish?.id) {
          const pendingSync = await syncPendingSetsForWorkout(supabase, pendingFinish.id)
          if (!pendingSync.ok) {
            console.error('pending finish sync failed:', pendingSync.error)
          } else {
            const { error } = await supabase.from('mf_workouts').update({
              finished_at: pendingFinish.finished_at,
              duration_minutes: pendingFinish.duration_minutes,
              intensity: pendingFinish.intensity,
              calories_burned: pendingFinish.calories_burned,
              cardio_warmup_minutes: pendingFinish.cardio_warmup_minutes,
              cardio_finish_minutes: pendingFinish.cardio_finish_minutes,
            }).eq('id', pendingFinish.id).is('finished_at', null)
            if (!error) clearPendingFinish(pendingFinish.id)
          }
        }

        // Незавершене тренування НЕ закриваємо тихо. Лише перевіряємо, що воно
        // справді існує в БД і ще не фінішоване, і пропонуємо явний вибір
        // (Продовжити / Завершити / Скасувати) — див. модалку нижче.
        const current = getCurrentWorkout()
        if (current?.id && current?.startedAt) {
          const { data: liveWorkout, error: liveError } = await supabase
            .from('mf_workouts')
            .select('id, program_id, started_at, finished_at, program:mf_programs(name, color)')
            .eq('id', current.id)
            .maybeSingle()

          if (liveError) {
            console.error('unfinished workout check failed:', liveError)
          } else if (liveWorkout?.id && !liveWorkout.finished_at) {
            setUnfinished({
              id: liveWorkout.id,
              programId: liveWorkout.program_id ?? current.programId,
              startedAt: liveWorkout.started_at ?? current.startedAt,
              programName: liveWorkout.program?.name ?? 'Тренування',
              color: liveWorkout.program?.color ?? '#22c55e',
            })
          } else {
            // Запис уже фінішований або зник у БД — локальний слід не потрібен.
            clearCurrentWorkout()
          }
        }

        const eightWeeksAgo = new Date(initialWeekStartRef.current)
        eightWeeksAgo.setDate(initialWeekStartRef.current.getDate() - 7 * 7)

        const [
          { data: progs, error: progsError },
          { data: lastWo, error: lastWoError },
          { data: allWos, error: allWosError },
          { data: weekWos, error: weekWosError },
        ] = await Promise.all([
          supabase.from('mf_programs').select('*').order('type').order('name'),
          supabase.from('mf_workouts').select('program_id').eq('user_id', uid).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('mf_workouts').select('started_at, duration_minutes').eq('user_id', uid).not('finished_at', 'is', null),
          supabase.from('mf_workouts').select('started_at, program:mf_programs(name, color)').eq('user_id', uid).not('finished_at', 'is', null).gte('started_at', eightWeeksAgo.toISOString()),
        ])
        if (progsError || lastWoError || allWosError || weekWosError) {
          throw progsError ?? lastWoError ?? allWosError ?? weekWosError
        }

        const programList = progs ?? []
        setPrograms(programList)

        const totalCount = allWos?.length ?? 0
        const totalMinutes = (allWos ?? []).reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
        const streak = calcStreak(allWos ?? [])
        setStats({ count: totalCount, hours: Math.round(totalMinutes / 60 * 10) / 10, streak })

        setAllWeekWos(weekWos ?? [])

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
      } catch (error) {
        console.error('loadAll:', error)
        setLoadError('Не вдалося завантажити головний екран. Спробуй оновити застосунок.')
      } finally {
        setLoading(false)
      }
    }

    void loadAll()
  }, [reloadKey])

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

  const progColor = nextProgram?.color ?? '#3b82f6'

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

      <div className="page stack">

        {/* ── BLOCK 1: next workout ── */}
        {nextProgram ? (
          <div
            className="card"
            style={{
              padding: 20,
              background: `radial-gradient(130% 110% at 105% 0%, ${progColor}28, transparent 60%), var(--surface)`,
              borderColor: `${progColor}55`,
              boxShadow: `0 6px 24px ${progColor}20`,
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
                onClick={() => navigate(`/workout/${nextProgram.id}`, { state: { fromApp: true, preview: true } })}
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    className="prog-icon"
                    style={{ width: 52, height: 52, borderRadius: 16, background: `${progColor}22`, flexShrink: 0 }}
                  >
                    <ProgramGlyph program={nextProgram} size={26} style={{ color: progColor }} />
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
                  { val: progStats.isEstimate ? `≈${progStats.est}` : progStats.est, lbl: 'ХВ' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none', paddingLeft: i ? 0 : 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                    <div className="label" style={{ fontSize: 9, letterSpacing: 0.5 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate(`/workout/${nextProgram.id}`, { state: { fromApp: true, preview: true } })}
                  style={{ flex: 1 }}
                >
                  Переглянути
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate(`/workout/${nextProgram.id}`, { state: { fromApp: true } })}
                  style={{ flex: 1, gap: 8, fontSize: 15 }}
                >
                  <IconPlay size={15} /> До старту
                </button>
              </div>
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
          <StatCard
            value={stats.hours >= 1 ? stats.hours : Math.round(stats.hours * 60)}
            unit={stats.hours >= 1 ? 'годин' : 'хвилин'}
            label="ЧАС"
            color="#8b5cf6"
          />
          <StatCard value={stats.streak} unit="днів"       label="СЕРІЯ"   color="#22c55e" />
        </div>

        {/* ── BLOCK 3: week ── */}
        <div
          className="card"
          style={{ padding: '14px 12px', userSelect: 'none' }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return
            const dx = e.changedTouches[0].clientX - touchStartX.current
            touchStartX.current = null
            if (Math.abs(dx) < 40) return
            if (dx < 0) setWeekOffset(prev => Math.max(prev - 1, -7))
            else setWeekOffset(prev => Math.min(prev + 1, 0))
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setWeekOffset(prev => Math.max(prev - 1, -7))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0 4px', fontSize: 16, lineHeight: 1 }}
            >‹</button>
            <div className="label" style={{ fontSize: 10, letterSpacing: 0.5 }}>{weekLabel}</div>
            <button
              type="button"
              onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: weekOffset === 0 ? 'transparent' : 'var(--text-3)', padding: '0 4px', fontSize: 16, lineHeight: 1, pointerEvents: weekOffset === 0 ? 'none' : 'auto' }}
            >›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {weekDays.map((day, i) => {
              const key = day.toDateString()
              const isToday = weekOffset === 0 && key === new Date().toDateString()
              const entry = weekMap[key]
              const hasWorkout = !!entry
              const wColor = entry?.color ?? '#22c55e'

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '8px 2px',
                    borderRadius: 12,
                    background: hasWorkout
                      ? `${wColor}18`
                      : isToday
                      ? 'var(--surface-2)'
                      : 'transparent',
                    border: `1px solid ${hasWorkout ? `${wColor}40` : isToday ? 'var(--border)' : 'transparent'}`,
                    boxShadow: hasWorkout ? `0 2px 10px ${wColor}25` : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    fontSize: 10,
                    color: isToday ? 'var(--text)' : 'var(--text-3)',
                    fontWeight: isToday ? 700 : 400,
                    letterSpacing: 0.2,
                  }}>
                    {WEEK_LABELS[i]}
                  </div>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: hasWorkout ? `${wColor}28` : 'transparent',
                    fontSize: 12,
                    fontWeight: hasWorkout || isToday ? 700 : 400,
                    color: hasWorkout ? wColor : isToday ? 'var(--text)' : 'var(--text-3)',
                  }}>
                    {day.getDate()}
                  </div>
                  {hasWorkout && (
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: wColor,
                      boxShadow: `0 0 5px ${wColor}`,
                    }} />
                  )}
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
                        <ProgramGlyph program={prog} size={18} style={{ color: c }} />
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

      {unfinished && (
        <div className="sheet-backdrop">
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="stack" style={{ gap: 6 }}>
              <div className="label" style={{ color: unfinished.color }}>Незавершене тренування</div>
              <div className="h-3">{unfinished.programName}</div>
              <div className="meta" style={{ marginTop: 2 }}>{formatStartedAt(unfinished.startedAt)}</div>
            </div>

            <div className="stack" style={{ gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={recovering}
                onClick={resumeUnfinished}
              >
                Продовжити
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={recovering}
                onClick={finishUnfinished}
              >
                Завершити
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={recovering}
                onClick={cancelUnfinished}
                style={{ color: 'var(--danger, #ef4444)' }}
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
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
        boxShadow: `0 4px 16px ${color}18`,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.boxShadow = `0 2px 8px ${color}10` }}
      onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 16px ${color}18` }}
      onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 16px ${color}18` }}
    >
      <div className="label" style={{ fontSize: 9, letterSpacing: 0.5, color, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div className="meta" style={{ fontSize: 11, marginTop: 4 }}>{unit}</div>
    </div>
  )
}
