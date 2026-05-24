import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  IconArrowLeft, IconMore, IconX, IconCheck, IconFlame, IconDumbbell,
  IconCamera, IconPlay, IconNote, IconRotate, IconTired, IconFlex, IconLeaf,
} from '../components/Icons'

function getLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v) } catch { return fallback }
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatProgramTitle(name = '') {
  return name
    .replace(/\s+—\s+/g, ' · ')
    .toUpperCase()
}

export default function ActiveWorkout() {
  const { programId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prevSets, setPrevSets] = useState({})
  const [workoutId, setWorkoutId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [rest, setRest] = useState(null)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [selectedMood, setSelectedMood] = useState('нормально')
  const [cardio, setCardio] = useState({ type: 'Еліпс', duration: 30, done: false })
  const [rpe, setRpe] = useState({})
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [replacedExercises, setReplacedExercises] = useState({})
  const [originalSets, setOriginalSets] = useState({})
  const [menuExerciseId, setMenuExerciseId] = useState(null)
  const [menuSection, setMenuSection] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [noteEdit, setNoteEdit] = useState(null)

  const wakeLockRef = useRef(null)
  const elapsedRef = useRef(null)
  const restRef = useRef(null)
  const restTotalRef = useRef(getLS('mf_rest_seconds', 90))

  const isPreview = !!window.history.state?.usr?.preview

  useEffect(() => {
    if (!window.history.state?.usr?.fromApp) {
      navigate('/')
      return
    }

    async function load() {
      const { data: user } = await supabase.auth.getUser()
      const uid = user.user.id

      const [{ data: prog }, { data: exRows }, { data: lastWorkout }] = await Promise.all([
        supabase.from('mf_programs').select('*').eq('id', programId).single(),
        supabase
          .from('mf_program_exercises')
          .select('*, exercise:mf_exercises(*)')
          .eq('program_id', programId)
          .order('order'),
        supabase
          .from('mf_workouts')
          .select('id')
          .eq('program_id', programId)
          .eq('user_id', uid)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      setProgram(prog)

      let prev = {}
      if (lastWorkout) {
        const { data: lastSets } = await supabase
          .from('mf_workout_sets')
          .select('exercise_id, weight, reps, set_number')
          .eq('workout_id', lastWorkout.id)
          .order('set_number')
        ;(lastSets ?? []).forEach(set => {
          if (!prev[set.exercise_id]) prev[set.exercise_id] = []
          prev[set.exercise_id].push({ weight: set.weight, reps: set.reps })
        })
      }
      setPrevSets(prev)

      const exList = (exRows ?? []).map(row => ({
        exercise: row.exercise,
        defaultSets: row.default_sets,
        defaultReps: row.default_reps,
        defaultWeight: row.default_weight,
        alternatives: [],
        hasWarmup: (row.default_weight ?? 0) > 0,
        warmupDone: false,
        sets: Array.from({ length: row.default_sets }, (_, i) => ({
          weight: prev[row.exercise.id]?.[i]?.weight ?? row.default_weight,
          reps: prev[row.exercise.id]?.[i]?.reps ?? row.default_reps,
          completed: false,
        })),
      }))

      if (exList.length > 0) {
        const exIds = exList.map(item => item.exercise.id)
        const { data: altRows } = await supabase
          .from('mf_alternative_exercises')
          .select('exercise_id, alt_default_sets, alt_default_reps, alt_default_weight, alt:mf_exercises!alternative_exercise_id(id, name, youtube_url, machine_photo_url, personal_note, description)')
          .in('exercise_id', exIds)

        if (altRows?.length) {
          const altMap = {}
          altRows.forEach(row => {
            if (!altMap[row.exercise_id]) altMap[row.exercise_id] = []
            if (row.alt) {
              altMap[row.exercise_id].push({
                ...row.alt,
                altDefaultSets: row.alt_default_sets,
                altDefaultReps: row.alt_default_reps,
                altDefaultWeight: row.alt_default_weight,
              })
            }
          })
          exList.forEach(item => {
            item.alternatives = altMap[item.exercise.id] ?? []
          })
        }
      }

      setExercises(exList)

      if (!isPreview) {
        const { data: existingWorkout } = await supabase
          .from('mf_workouts')
          .select('id')
          .eq('user_id', uid)
          .eq('program_id', programId)
          .is('finished_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingWorkout) {
          setWorkoutId(existingWorkout.id)
          localStorage.setItem('mf_current_workout', JSON.stringify({ id: existingWorkout.id, programId }))
        } else {
          const saved = JSON.parse(localStorage.getItem('mf_current_workout') || 'null')
          const localId = (saved?.programId === programId) ? saved.id : crypto.randomUUID()
          setWorkoutId(localId)
          localStorage.setItem('mf_current_workout', JSON.stringify({ id: localId, programId }))
          supabase.from('mf_workouts').insert({ id: localId, user_id: uid, program_id: programId })
        }
      }

      setLoading(false)
    }

    load()
  }, [programId])

  useEffect(() => {
    if (!getLS('mf_wake_lock_enabled', true)) return

    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }

    acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      wakeLockRef.current?.release()
    }
  }, [])

  useEffect(() => {
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  useEffect(() => {
    if (loading || isPreview) return
    elapsedRef.current = setInterval(() => setElapsed(value => value + 1), 1000)
    return () => clearInterval(elapsedRef.current)
  }, [loading])

  useEffect(() => {
    if (rest === null) return
    if (rest === 0) {
      if (getLS('mf_sound_enabled', true)) playBeep()
      if (getLS('mf_vibration_enabled', true) && navigator.vibrate) navigator.vibrate([300, 100, 300])
      setRest(null)
      return
    }

    restRef.current = setTimeout(() => setRest(value => value - 1), 1000)
    return () => clearTimeout(restRef.current)
  }, [rest])

  function playBeep() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start()
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }

  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => prev.map((exercise, i) => (
      i !== exIdx
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set, j) => (
              j === setIdx ? { ...set, [field]: value } : set
            )),
          }
    )))
  }

  function adjustWeight(exIdx, setIdx, delta) {
    const value = exercises[exIdx].sets[setIdx].weight
    updateSet(exIdx, setIdx, 'weight', Math.max(0, +(value + delta).toFixed(1)))
  }

  function adjustReps(exIdx, setIdx, delta) {
    const value = exercises[exIdx].sets[setIdx].reps
    updateSet(exIdx, setIdx, 'reps', Math.max(1, value + delta))
  }

  function removeLastSet(exIdx) {
    setExercises(prev => prev.map((exercise, i) => {
      if (i !== exIdx || exercise.sets.length <= 1) return exercise
      return { ...exercise, sets: exercise.sets.slice(0, -1) }
    }))
  }

  function enqueuePendingSet(data) {
    try {
      const q = JSON.parse(localStorage.getItem('mf_pending_sets') || '[]')
      q.push(data)
      localStorage.setItem('mf_pending_sets', JSON.stringify(q))
    } catch {}
  }

  async function completeWarmup(exIdx) {
    setExercises(prev => prev.map((ex, i) => (
      i !== exIdx ? ex : { ...ex, warmupDone: true }
    )))
    const restSecs = getLS('mf_rest_seconds', 90)
    restTotalRef.current = restSecs
    setRest(restSecs)
    if (!workoutId || isPreview) return
    const ex = exercises[exIdx]
    const displayExercise = replacedExercises[ex.exercise.id] ?? ex.exercise
    const setData = {
      workout_id: workoutId,
      exercise_id: displayExercise.id,
      set_number: 0,
      weight: Math.round((ex.sets[0]?.weight ?? ex.defaultWeight ?? 0) * 0.5),
      reps: ex.sets[0]?.reps ?? ex.defaultReps,
      completed: true,
    }
    const { error } = await supabase.from('mf_workout_sets').insert(setData)
    if (error) enqueuePendingSet(setData)
  }

  async function saveNote(exerciseId, text) {
    await supabase.from('mf_exercises').update({ personal_note: text }).eq('id', exerciseId)
    setExercises(prev => prev.map(item =>
      item.exercise.id === exerciseId
        ? { ...item, exercise: { ...item.exercise, personal_note: text } }
        : item
    ))
    setNoteEdit(null)
  }

  function addSet(exIdx) {
    setExercises(prev => prev.map((exercise, i) => {
      if (i !== exIdx) return exercise
      const last = exercise.sets[exercise.sets.length - 1]
      return {
        ...exercise,
        sets: [
          ...exercise.sets,
          {
            weight: last?.weight ?? 0,
            reps: last?.reps ?? 10,
            completed: false,
          },
        ],
      }
    }))
  }

  function startEditing(exerciseId, setIdx, field) {
    setEditingCell({ exerciseId, setIdx, field })
  }

  function stopEditing() {
    setEditingCell(null)
  }

  function parseCellValue(field, rawValue, fallback) {
    if (field === 'weight') {
      const value = Number(rawValue.replace(',', '.'))
      return Number.isNaN(value) ? fallback : Math.max(0, value)
    }

    const value = Number(rawValue)
    return Number.isNaN(value) ? fallback : Math.max(1, Math.round(value))
  }

  async function completeSet(exIdx, setIdx) {
    updateSet(exIdx, setIdx, 'completed', true)
    const restSecs = getLS('mf_rest_seconds', 90)
    restTotalRef.current = restSecs
    setRest(restSecs)
    if (!workoutId) return

    const set = exercises[exIdx].sets[setIdx]
    const displayExercise = replacedExercises[exercises[exIdx].exercise.id] ?? exercises[exIdx].exercise

    if (isPreview) return
    const setData = {
      workout_id: workoutId,
      exercise_id: displayExercise.id,
      set_number: setIdx + 1,
      weight: set.weight,
      reps: set.reps,
      completed: true,
    }
    const { error } = await supabase.from('mf_workout_sets').insert(setData)
    if (error) enqueuePendingSet(setData)
  }

  async function finishWorkout(intensity) {
    if (!workoutId) return

    try {
      const pending = JSON.parse(localStorage.getItem('mf_pending_sets') || '[]')
      if (pending.length > 0) {
        const { error } = await supabase.from('mf_workout_sets').insert(pending)
        if (!error) localStorage.removeItem('mf_pending_sets')
      }
    } catch {}

    const calories = Math.round(
      ({ важко: 8, нормально: 6, легко: 4 }[intensity] ?? 6) * 70 * (elapsed / 3600)
    )

    await supabase
      .from('mf_workouts')
      .update({
        finished_at: new Date().toISOString(),
        duration_minutes: Math.round(elapsed / 60),
        intensity,
        calories_burned: calories,
      })
      .eq('id', workoutId)

    localStorage.removeItem('mf_current_workout')
    wakeLockRef.current?.release()
    navigate('/')
  }

  function requestFinish() {
    if (allDone) {
      setSummaryOpen(true)
      return
    }
    setConfirmFinish(true)
  }

  if (loading) {
    return (
      <div className="screen screen--no-nav">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  const allDone = exercises.every(exercise => exercise.sets.every(set => set.completed))
  const completedSets = exercises.reduce(
    (total, exercise) => total + exercise.sets.filter(set => set.completed).length,
    0,
  )
  const totalSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
  const progress = totalSets ? Math.round((completedSets / totalSets) * 100) : 0
  const totalVolume = exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter(set => set.completed).reduce((acc, set) => acc + set.weight * set.reps, 0),
    0,
  )
  const burnedCalories = Math.round((elapsed / 60) * 5.4)
  const menuExercise = exercises.find(exercise => exercise.exercise.id === menuExerciseId)
  const menuDisplayExercise = menuExercise
    ? (replacedExercises[menuExercise.exercise.id] ?? menuExercise.exercise)
    : null

  if (summaryOpen) {
    return (
      <div className="screen screen--no-nav">
        <div className="page page-top stack" style={{ gap: 32, justifyContent: 'space-between', minHeight: '100%' }}>
          <div className="stack" style={{ gap: 28 }}>
            <div className="card-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="label">Тренування завершено</div>
              </div>
              <button type="button" className="icon-btn" onClick={() => navigate('/')}><IconX size={18} /></button>
            </div>

            <div className="summary-check" style={{ marginTop: 8 }}><IconCheck size={56} /></div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div className="h-1">Чудова робота!</div>
            </div>

            <div className="summary-grid">
              <div className="summary-stat">
                <div className="label" style={{ marginBottom: 14 }}>Тривалість</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                  {Math.max(1, Math.round(elapsed / 60))}
                  <span style={{ fontSize: 15, color: 'var(--text-3)', marginLeft: 4 }}>хв</span>
                </div>
              </div>
              <div className="summary-stat">
                <div className="label" style={{ marginBottom: 14 }}>Підходи</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                  {completedSets}
                  <span style={{ fontSize: 15, color: 'var(--text-3)', marginLeft: 4 }}>/ {totalSets}</span>
                </div>
              </div>
              <div className="summary-stat">
                <div className="label" style={{ marginBottom: 14 }}>Об'єм</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                  {totalVolume}
                  <span style={{ fontSize: 15, color: 'var(--text-3)', marginLeft: 4 }}>кг</span>
                </div>
              </div>
              <div className="summary-stat summary-stat--accent">
                <div className="label" style={{ marginBottom: 14, color: 'var(--accent)' }}>≈ Спалено</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                  {burnedCalories}
                  <span style={{ fontSize: 15, marginLeft: 4 }}>ккал</span>
                </div>
              </div>
            </div>

            <div className="stack" style={{ gap: 12 }}>
              <div className="label" style={{ textAlign: 'center' }}>Як відчувалось?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {[
                  { key: 'важко', label: 'Важко', Icon: IconTired },
                  { key: 'нормально', label: 'Нормально', Icon: IconFlex },
                  { key: 'легко', label: 'Легко', Icon: IconLeaf },
                ].map(option => (
                  <button
                    key={option.key}
                    type="button"
                    className="emoji-choice"
                    data-active={selectedMood === option.key ? '1' : '0'}
                    onClick={() => setSelectedMood(option.key)}
                  >
                    <option.Icon size={32} />
                    <span className="meta" style={{ fontSize: 12 }}>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {Object.keys(rpe).length > 0 && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="label" style={{ textAlign: 'center' }}>Оцінки вправ</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { key: 'easy', label: 'Легко', color: '#4fc66a' },
                  { key: 'normal', label: 'Нормально', color: '#FFC107' },
                  { key: 'hard', label: 'На межі', color: '#ff5050' },
                ].map(({ key, label, color }) => {
                  const count = Object.values(rpe).filter(v => v === key).length
                  if (!count) return null
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                      {count}× {label}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              finishWorkout(selectedMood)
            }}
          >
            На головну
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen screen--no-nav" style={{ overflow: 'hidden', paddingBottom: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
      <div className="topbar" style={{ paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => {
            if (isPreview) { navigate(-1); return }
            if (confirm('Скасувати тренування?')) navigate('/')
          }}
          className="icon-btn"
          aria-label="Назад"
        >
          <IconArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div className="label" style={{ textAlign: 'center' }}>
            {isPreview ? 'ПЕРЕГЛЯД' : formatProgramTitle(program?.name ?? 'Тренування')}
          </div>
          {!isPreview && <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{fmtTime(elapsed)}</div>}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Завершити або параметри"
          onClick={requestFinish}
        >
          <IconMore size={20} />
        </button>
      </div>

      <div className="page stack">
        {!isOnline && !isPreview && (
          <div style={{
            background: 'rgba(255,181,71,0.08)',
            border: '1px solid rgba(255,181,71,0.2)',
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 12,
            color: 'var(--warning)',
            marginBottom: -4,
          }}>
            Офлайн — підходи збережуться коли з'явиться зв'язок
          </div>
        )}

        {!isPreview && (
          <section className="stack" style={{ gap: 10 }}>
            <div className="progress-strip">
              <div className="progress-strip-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="top-meta-bar">
              <span>{completedSets} з {totalSets} підходів</span>
              <span className="num">{progress}%</span>
            </div>
          </section>
        )}

        <div className="card-row card" style={{ padding: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <div className="prog-icon" style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.05)' }}><IconFlame size={20} /></div>
            <div style={{ flex: 1 }}>
              <div className="h-3" style={{ fontSize: 15 }}>Кардіо розминка</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <select
                  value={cardio.type}
                  onChange={event => setCardio(value => ({ ...value, type: event.target.value }))}
                  className="select-field"
                >
                  {['Сходи', 'Еліпс', 'Бігова доріжка', 'Велотренажер'].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    value={cardio.duration}
                    onChange={event => setCardio(value => ({ ...value, duration: Number(event.target.value) || 0 }))}
                    className="field"
                    style={{ width: 62, textAlign: 'center' }}
                  />
                  <span className="meta">хв</span>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCardio(value => ({ ...value, done: !value.done }))}
            className="icon-btn"
            style={{
              background: cardio.done ? 'var(--accent)' : 'var(--surface-2)',
              color: cardio.done ? 'var(--accent-text)' : 'var(--text-2)',
              borderColor: cardio.done ? 'transparent' : 'var(--border)',
            }}
            aria-label="Завершити розминку"
          >
            {cardio.done ? <IconCheck size={18} /> : ''}
          </button>
        </div>

        {rest !== null && (
          <div className="timer-bar" style={{ '--p': `${Math.max(0, 100 - (rest / restTotalRef.current) * 100)}%` }}>
            <div>
              <div className="label" style={{ color: 'rgba(198,255,61,0.85)' }}>Відпочинок</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>
                {fmtTime(rest)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-dark btn-sm" onClick={() => setRest(value => (value ?? 0) + 15)}>
                +15с
              </button>
              <button type="button" className="btn btn-dark btn-sm" onClick={() => setRest(null)}>
                Пропустити
              </button>
            </div>
          </div>
        )}

        <div className="stack" style={{ gap: 12 }}>
          {exercises.map((exercise, exerciseIndex) => {
            const displayExercise = replacedExercises[exercise.exercise.id] ?? exercise.exercise
            const isReplaced = !!replacedExercises[exercise.exercise.id]
            const workingWeight = exercise.sets[0]?.weight ?? exercise.defaultWeight ?? 0
            const warmupWeight = workingWeight > 0 ? Math.round(workingWeight * 0.5) : 0
            const exerciseDone = exercise.sets.every(set => set.completed)

            return (
              <div key={exercise.exercise.id} className="ex-card" data-done={exerciseDone ? '1' : '0'}>
                <div className="ex-head">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
                    <div className="ex-machine-photo">
                      {displayExercise.machine_photo_url ? (
                        <img
                          src={displayExercise.machine_photo_url}
                          alt={displayExercise.name}
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <IconDumbbell size={20} style={{ color: 'var(--text-3)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="ex-name">{displayExercise.name}</div>
                        {isReplaced && <span className="inline-badge">заміна</span>}
                      </div>
                      <div className="ex-note">{displayExercise.muscle_group ?? 'Тренажер'}</div>
                      {displayExercise.personal_note && (
                        <div className="ex-note" style={{ color: 'var(--text-4)' }}>
                          {displayExercise.personal_note}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 32, height: 32, borderRadius: 10 }}
                    onClick={() => {
                      setMenuExerciseId(exercise.exercise.id)
                      setMenuSection(null)
                    }}
                  >
                    <IconMore size={18} />
                  </button>
                </div>

                <div className="ex-table">
                  <div className="ex-row ex-row-head">
                    <div>#</div>
                    <div>Минулого</div>
                    <div>Вага</div>
                    <div>Повт.</div>
                    <div />
                  </div>

                  {exercise.hasWarmup && (
                    <div className="ex-row" data-done={exercise.warmupDone ? '1' : '0'}>
                      <div className="set-num set-num--warmup">Р</div>
                      <div className="set-last">розм.</div>
                      <div className="set-value num">{warmupWeight}</div>
                      <div className="set-value num">{exercise.sets[0]?.reps ?? exercise.defaultReps}</div>
                      <button
                        type="button"
                        className="set-check"
                        data-done={exercise.warmupDone ? '1' : '0'}
                        onClick={() => completeWarmup(exerciseIndex)}
                      >
                        {exercise.warmupDone ? <IconCheck size={16} /> : ''}
                      </button>
                    </div>
                  )}

                  {exercise.sets.map((set, setIndex) => {
                    const prev = prevSets[exercise.exercise.id]?.[setIndex]

                    return (
                      <div key={setIndex} className="ex-row" data-done={set.completed ? '1' : '0'}>
                        <div className="set-num">{setIndex + 1}</div>
                        <div className="set-last">{prev ? `${prev.weight}×${prev.reps}` : (warmupWeight > 0 ? `${exercise.defaultWeight ?? 0}×${exercise.defaultReps ?? 12}` : '—')}</div>
                        <div className="set-value num">
                          {editingCell?.exerciseId === exercise.exercise.id && editingCell?.setIdx === setIndex && editingCell?.field === 'weight' ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              autoFocus
                              defaultValue={String(set.weight)}
                              className="set-inline-input"
                              onBlur={event => {
                                updateSet(
                                  exerciseIndex,
                                  setIndex,
                                  'weight',
                                  parseCellValue('weight', event.target.value, set.weight),
                                )
                                stopEditing()
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  updateSet(
                                    exerciseIndex,
                                    setIndex,
                                    'weight',
                                    parseCellValue('weight', event.currentTarget.value, set.weight),
                                  )
                                  stopEditing()
                                }
                                if (event.key === 'Escape') {
                                  stopEditing()
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="set-edit-btn num"
                              onClick={() => startEditing(exercise.exercise.id, setIndex, 'weight')}
                            >
                              {set.weight}
                            </button>
                          )}
                        </div>
                        <div className="set-value num">
                          {editingCell?.exerciseId === exercise.exercise.id && editingCell?.setIdx === setIndex && editingCell?.field === 'reps' ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              defaultValue={String(set.reps)}
                              className="set-inline-input"
                              onBlur={event => {
                                updateSet(
                                  exerciseIndex,
                                  setIndex,
                                  'reps',
                                  parseCellValue('reps', event.target.value, set.reps),
                                )
                                stopEditing()
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  updateSet(
                                    exerciseIndex,
                                    setIndex,
                                    'reps',
                                    parseCellValue('reps', event.currentTarget.value, set.reps),
                                  )
                                  stopEditing()
                                }
                                if (event.key === 'Escape') {
                                  stopEditing()
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="set-edit-btn num"
                              onClick={() => startEditing(exercise.exercise.id, setIndex, 'reps')}
                            >
                              {set.reps}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="set-check"
                          data-done={set.completed ? '1' : '0'}
                          onClick={() => completeSet(exerciseIndex, setIndex)}
                        >
                          {set.completed ? <IconCheck size={16} /> : ''}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {exerciseDone && (
                  <div className="ex-rpe">
                    <div className="label" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Як вправа?</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { key: 'easy', label: 'Легко', bg: 'rgba(79,198,106,0.15)', border: '#4fc66a', dot: '#4fc66a' },
                        { key: 'normal', label: 'Нормально', bg: 'rgba(255,193,7,0.15)', border: '#FFC107', dot: '#FFC107' },
                        { key: 'hard', label: 'На межі', bg: 'rgba(255,80,80,0.15)', border: '#ff5050', dot: '#ff5050' },
                      ].map(({ key, label, bg, border, dot }) => {
                        const isActive = rpe[exercise.exercise.id] === key
                        return (
                          <button
                            key={key}
                            type="button"
                            className="rpe-btn"
                            style={isActive ? { background: bg, borderColor: border, color: 'var(--text)' } : {}}
                            onClick={() => setRpe(prev => ({ ...prev, [exercise.exercise.id]: key }))}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="ex-footer">
                  <button
                    type="button"
                    className="ex-action-btn"
                    onClick={() => setNoteEdit({ exerciseId: displayExercise.id, text: displayExercise.personal_note ?? '' })}
                  >
                    <IconNote size={15} /> Нотатки
                    {!!displayExercise.personal_note && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent)', flexShrink: 0,
                      }} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="ex-action-btn"
                    onClick={() => addSet(exerciseIndex)}
                  >
                    + Підхід
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      className="ex-action-btn"
                      onClick={() => removeLastSet(exerciseIndex)}
                    >
                      − Підхід
                    </button>
                  )}
                  {exercise.alternatives.length > 0 && (
                    <button
                      type="button"
                      className="ex-action-btn"
                      onClick={() => {
                        const alt = exercise.alternatives[0]
                        if (isReplaced) {
                          setReplacedExercises(prev => {
                            const next = { ...prev }
                            delete next[exercise.exercise.id]
                            return next
                          })
                          setExercises(prev => prev.map((item, index) => (
                            index !== exerciseIndex
                              ? item
                              : { ...item, sets: originalSets[item.exercise.id] ?? item.sets }
                          )))
                          setOriginalSets(prev => {
                            const next = { ...prev }
                            delete next[exercise.exercise.id]
                            return next
                          })
                        } else {
                          setOriginalSets(prev => ({ ...prev, [exercise.exercise.id]: exercise.sets }))
                          setReplacedExercises(prev => ({ ...prev, [exercise.exercise.id]: alt }))
                          setExercises(prev => prev.map((item, index) => (
                            index !== exerciseIndex
                              ? item
                              : {
                                  ...item,
                                  sets: Array.from({ length: alt.altDefaultSets ?? 3 }, () => ({
                                    weight: alt.altDefaultWeight ?? 0,
                                    reps: alt.altDefaultReps ?? 12,
                                    completed: false,
                                  })),
                                }
                          )))
                        }
                      }}
                    >
                      <IconRotate size={15} /> {isReplaced ? 'Повернути' : 'Замінити'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>

      <div className="finish-bar">
        {isPreview ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate(-1)}>
            Закрити перегляд
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={requestFinish}
            style={{ opacity: 1 }}
          >
            Завершити тренування
          </button>
        )}
      </div>

      {menuExercise && (
        <div className="sheet-backdrop" onClick={() => { setMenuExerciseId(null); setMenuSection(null) }}>
          <div className="sheet" onClick={event => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div className="h-3">{menuDisplayExercise?.name}</div>
                <div className="meta" style={{ marginTop: 4 }}>Швидкі дії для вправи</div>
              </div>

              <button
                type="button"
                className="prog-select-card"
                onClick={() => setMenuSection(menuSection === 'photo' ? null : 'photo')}
              >
                <div className="prog-icon" style={{ background: 'rgba(255,255,255,0.04)' }}><IconCamera size={20} /></div>
                <div>
                  <div style={{ fontWeight: 600 }}>Фото</div>
                  <div className="meta">{menuDisplayExercise?.machine_photo_url ? 'Показати фото' : 'Фото ще не додано'}</div>
                </div>
              </button>

              <button
                type="button"
                className="prog-select-card"
                onClick={() => {
                  if (menuDisplayExercise?.youtube_url) {
                    window.open(menuDisplayExercise.youtube_url, '_blank')
                  }
                }}
              >
                <div className="prog-icon" style={{ background: 'rgba(255,255,255,0.04)' }}><IconPlay size={20} /></div>
                <div>
                  <div style={{ fontWeight: 600 }}>Відео техніки</div>
                  <div className="meta">{menuDisplayExercise?.youtube_url ? 'Відкрити YouTube' : 'Відео ще не додано'}</div>
                </div>
              </button>

              <button
                type="button"
                className="prog-select-card"
                onClick={() => setMenuSection(menuSection === 'description' ? null : 'description')}
              >
                <div className="prog-icon" style={{ background: 'rgba(255,255,255,0.04)' }}><IconNote size={20} /></div>
                <div>
                  <div style={{ fontWeight: 600 }}>Техніка виконання</div>
                  <div className="meta">
                    {menuDisplayExercise?.description
                      ? `${menuDisplayExercise.description.slice(0, 56)}${menuDisplayExercise.description.length > 56 ? '…' : ''}`
                      : 'Ще не додано'}
                  </div>
                </div>
              </button>

              {menuSection === 'photo' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="exercise-hero" style={{ minHeight: 180, border: 0, borderRadius: 0 }}>
                    {menuDisplayExercise?.machine_photo_url ? (
                      <img src={menuDisplayExercise.machine_photo_url} alt={menuDisplayExercise.name} onError={e => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <span>Фото</span>
                    )}
                  </div>
                </div>
              )}

              {menuSection === 'description' && (
                <div className="card">
                  <div className="label" style={{ marginBottom: 8 }}>Техніка</div>
                  <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-2)' }}>
                    {menuDisplayExercise?.description ?? 'Опис техніки ще не додано.'}
                  </div>
                  {menuDisplayExercise?.personal_note && (
                    <div style={{ marginTop: 12 }}>
                      <div className="label" style={{ marginBottom: 8 }}>Мої нотатки</div>
                      <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-2)' }}>
                        {menuDisplayExercise.personal_note}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmFinish && (
        <div className="modal-backdrop" onClick={() => setConfirmFinish(false)}>
          <div className="modal-card" onClick={event => event.stopPropagation()} style={{ maxWidth: 380, padding: 22 }}>
            <div className="stack" style={{ gap: 18 }}>
              <div className="sheet-header">
                <p className="sheet-title">Не всі підходи завершені</p>
                <p className="sheet-subtitle">Точно завершити тренування зараз?</p>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: 'rgba(255,181,71,0.08)',
                  border: '1px solid rgba(255,181,71,0.22)',
                  color: 'var(--warning)',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                У тебе виконано {completedSets} з {totalSets} підходів. Можеш повернутись і догнати, або завершити вже зараз.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmFinish(false)}>
                  Продовжити
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setConfirmFinish(false)
                    setSummaryOpen(true)
                  }}
                >
                  Завершити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {noteEdit && (
        <div className="sheet-backdrop" onClick={() => setNoteEdit(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack">
              <div className="h-3">Мої нотатки</div>
              <textarea
                value={noteEdit.text}
                onChange={e => setNoteEdit(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Висота сидіння, позиція валиків..."
                rows={4}
                className="textarea-field"
                autoFocus
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-block" onClick={() => setNoteEdit(null)}>
                  Скасувати
                </button>
                <button type="button" className="btn btn-primary btn-block" onClick={() => saveNote(noteEdit.exerciseId, noteEdit.text)}>
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
