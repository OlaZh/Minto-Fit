import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadErrorState from '../components/LoadErrorState'
import {
  appendPendingSet,
  clearCurrentWorkout,
  clearPendingFinish,
  clearPendingSetsForWorkout,
  getCurrentWorkout,
  getPendingSetsForWorkout,
  setCurrentWorkout,
  setPendingFinish,
  syncPendingSetsForWorkout,
} from '../lib/workoutStorage'
import {
  IconArrowLeft, IconMore, IconX, IconCheck, IconFlame, IconDumbbell,
  IconCamera, IconPlay, IconNote, IconRotate, IconTired, IconFlex, IconLeaf,
} from '../components/Icons'

const MET_TABLE = {
  силове:        { легко: 3,   нормально: 5,   важко: 6  },
  кардіо:        { легко: 6,   нормально: 8,   важко: 10 },
  hiit:          { легко: 7,   нормально: 9,   важко: 12 },
  функціональне: { легко: 4,   нормально: 5.5, важко: 7  },
  йога:          { легко: 2,   нормально: 3,   важко: 4  },
  пілатес:       { легко: 2.5, нормально: 3.5, важко: 4.5},
  ходьба:        { легко: 3,   нормально: 4,   важко: 5  },
  розтяжка:      { легко: 1.5, нормально: 2,   важко: 2.5},
}

function getLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v) } catch { return fallback }
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function nowMs() {
  return new Date().getTime()
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
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prevSets, setPrevSets] = useState({})
  const [hasStarted, setHasStarted] = useState(false)
  const [workoutId, setWorkoutId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [rest, setRest] = useState(null)
  const [restTotal, setRestTotal] = useState(() => getLS('mf_rest_seconds', 90))
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [sessionError, setSessionError] = useState(null)
  const [selectedMood, setSelectedMood] = useState('нормально')
  const [cardio, setCardio] = useState({ type: 'Еліпс', startedAt: null, elapsedSec: 0, done: false })
  const [cardioFinish, setCardioFinish] = useState({ type: 'Еліпс', startedAt: null, elapsedSec: 0, done: false })
  const [, setCardioTick] = useState(0)
  const [rpe, setRpe] = useState({})
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [replacedExercises, setReplacedExercises] = useState({})
  const [originalSets, setOriginalSets] = useState({})
  const [bodyWeight, setBodyWeight] = useState(70)
  const [menuExerciseId, setMenuExerciseId] = useState(null)
  const [menuSection, setMenuSection] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [noteEdit, setNoteEdit] = useState(null)
  const [restMissedSecs, setRestMissedSecs] = useState(null)

  const wakeLockRef = useRef(null)
  const elapsedRef = useRef(null)
  const startedAtRef = useRef(null)
  const restRef = useRef(null)
  const restStartedAtRef = useRef(null)

  const isPreview = !!window.history.state?.usr?.preview

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
    } catch {
      /* ignore audio playback errors */
    }
  }

  function startRestTimer(seconds, startedAt = nowMs()) {
    setRestTotal(seconds)
    restStartedAtRef.current = startedAt
    setRestMissedSecs(null)
    setRest(seconds)
  }

  // Жива секундна тривалість кардіо: базовий накопичений час + поточний відрізок.
  function cardioLiveSec(c) {
    return c.elapsedSec + (c.startedAt ? Math.floor((nowMs() - c.startedAt) / 1000) : 0)
  }

  // Старт / стоп кардіо-таймера. setter — setCardio або setCardioFinish.
  function toggleCardioTimer(setter) {
    if (isPreview || !hasStarted) return
    setter(c => {
      if (c.startedAt) {
        // Стоп: фіксуємо накопичений час, позначаємо виконаним.
        return { ...c, startedAt: null, elapsedSec: cardioLiveSec(c), done: true }
      }
      return { ...c, startedAt: nowMs(), done: false }
    })
  }

  useEffect(() => {
    if (!window.history.state?.usr?.fromApp) {
      navigate('/')
      return
    }

    async function load() {
      setLoadError(null)
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user?.id) throw userError ?? new Error('No user')
        const uid = userData.user.id

        const [
          { data: prog, error: progError },
          { data: exRows, error: exRowsError },
          { data: lastWorkout, error: lastWorkoutError },
          { data: lastStat, error: lastStatError },
        ] = await Promise.all([
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
          supabase
            .from('mf_body_stats')
            .select('weight_kg')
            .eq('user_id', uid)
            .not('weight_kg', 'is', null)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (progError || exRowsError || lastWorkoutError || lastStatError) {
          throw progError ?? exRowsError ?? lastWorkoutError ?? lastStatError
        }
        if (!prog) throw new Error('Program not found')

        if (lastStat?.weight_kg) setBodyWeight(lastStat.weight_kg)

        setProgram(prog)

        let existingWorkout = null
        let currentSetMap = {}
        if (!isPreview) {
          // Підхоплюємо лише свіже незавершене тренування, щоб старий запис не залипав у новий вхід.
          const resumeCutoff = new Date(nowMs() - 12 * 60 * 60 * 1000).toISOString()
          const { data: unfinishedWorkout, error: existingWorkoutError } = await supabase
            .from('mf_workouts')
            .select('id, started_at')
            .eq('user_id', uid)
            .eq('program_id', programId)
            .is('finished_at', null)
            .gte('started_at', resumeCutoff)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (existingWorkoutError) throw existingWorkoutError

          existingWorkout = unfinishedWorkout

          if (existingWorkout?.id) {
            const { data: dbSets, error: currentSetsError } = await supabase
              .from('mf_workout_sets')
              .select('id, exercise_id, weight, reps, duration_seconds, set_number, completed')
              .eq('workout_id', existingWorkout.id)
              .order('set_number')
            if (currentSetsError) throw currentSetsError

            const mergedSets = [
              ...(dbSets ?? []),
              ...getPendingSetsForWorkout(existingWorkout.id),
            ]

            mergedSets.forEach(set => {
              if (!set?.exercise_id) return
              if (!currentSetMap[set.exercise_id]) currentSetMap[set.exercise_id] = {}
              currentSetMap[set.exercise_id][set.set_number] = set
            })
          }
        }

        let prev = {}
        if (lastWorkout) {
          const { data: lastSets, error: lastSetsError } = await supabase
            .from('mf_workout_sets')
            .select('exercise_id, weight, reps, duration_seconds, set_number')
            .eq('workout_id', lastWorkout.id)
            .order('set_number')
          if (lastSetsError) throw lastSetsError
          ;(lastSets ?? []).forEach(set => {
            if (!prev[set.exercise_id]) prev[set.exercise_id] = []
            prev[set.exercise_id].push({ weight: set.weight, reps: set.reps, duration: set.duration_seconds })
          })
        }
        setPrevSets(prev)

        const exList = (exRows ?? []).map(row => {
          const mode = row.exercise_mode === 'time' ? 'time' : 'reps'
          const tracksWeight = row.tracks_weight !== false
          const resumedSets = currentSetMap[row.exercise.id] ?? {}
          const resumedWorkSets = Object.values(resumedSets).filter(set => set.set_number > 0)
          const totalSetCount = Math.max(row.default_sets, resumedWorkSets.length)
          return {
            exercise: row.exercise,
            mode,
            tracksWeight,
            defaultSets: row.default_sets,
            defaultReps: row.default_reps,
            defaultWeight: row.default_weight,
            defaultDuration: row.default_duration,
            alternatives: [],
            // Розминка має сенс лише для силових вправ із вагою.
            hasWarmup: mode === 'reps' && tracksWeight && (row.default_weight ?? 0) > 0,
            warmupDone: !!resumedSets[0]?.completed,
            sets: Array.from({ length: totalSetCount }, (_, i) => {
              const resumedSet = resumedSets[i + 1]
              return {
                weight: resumedSet?.weight ?? prev[row.exercise.id]?.[i]?.weight ?? row.default_weight,
                reps: resumedSet?.reps ?? prev[row.exercise.id]?.[i]?.reps ?? row.default_reps,
                duration: resumedSet?.duration_seconds ?? prev[row.exercise.id]?.[i]?.duration ?? row.default_duration ?? 0,
                completed: resumedSet?.completed ?? false,
              }
            }),
          }
        })

        if (exList.length > 0) {
          const exIds = exList.map(item => item.exercise.id)
          const { data: altRows, error: altRowsError } = await supabase
            .from('mf_alternative_exercises')
            .select('exercise_id, alt_default_sets, alt_default_reps, alt_default_weight, alt:mf_exercises!alternative_exercise_id(id, name, youtube_url, machine_photo_url, personal_note, description)')
            .in('exercise_id', exIds)
          if (altRowsError) throw altRowsError

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
          if (existingWorkout) {
            // Незавершене тренування вже існує в БД — продовжуємо його разом із записаними сетами.
            setHasStarted(true)
            setWorkoutId(existingWorkout.id)
            startedAtRef.current = new Date(existingWorkout.started_at).getTime()
            setCurrentWorkout({ id: existingWorkout.id, programId, startedAt: existingWorkout.started_at })
          } else {
            setHasStarted(false)
            setWorkoutId(null)
          }
        }
      } catch (error) {
        console.error('loadActiveWorkout:', error)
        setLoadError('Не вдалося завантажити тренування. Спробуй повернутися і відкрити програму ще раз.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [isPreview, navigate, programId, reloadKey])

  useEffect(() => {
    if (!getLS('mf_wake_lock_enabled', true)) return

    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* wake lock is optional */
      }
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
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (restStartedAtRef.current === null) return
      const remaining = restTotal - Math.floor((nowMs() - restStartedAtRef.current) / 1000)
      if (remaining <= 0) {
        setRestMissedSecs(Math.abs(remaining))
        setRest(null)
        restStartedAtRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [restTotal])

  // Поки якийсь кардіо-таймер запущено — оновлюємо екран щосекунди.
  useEffect(() => {
    if (!cardio.startedAt && !cardioFinish.startedAt) return
    const id = setInterval(() => setCardioTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [cardio.startedAt, cardioFinish.startedAt])

  useEffect(() => {
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  useEffect(() => {
    if (loading || isPreview || !hasStarted) return
    const savedWorkout = getCurrentWorkout()
    startedAtRef.current = savedWorkout?.programId === programId && savedWorkout?.startedAt
      ? new Date(savedWorkout.startedAt).getTime()
      : startedAtRef.current ?? nowMs()
    setElapsed(Math.floor((nowMs() - startedAtRef.current) / 1000))
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((nowMs() - startedAtRef.current) / 1000))
    }, 1000)
    return () => {
      clearInterval(elapsedRef.current)
    }
  }, [hasStarted, isPreview, loading, programId])

  useEffect(() => {
    if (rest === null) {
      restStartedAtRef.current = null
      return
    }

    if (restStartedAtRef.current === null) {
      restStartedAtRef.current = nowMs()
    }

    const tick = () => {
      const remaining = restTotal - Math.floor((nowMs() - restStartedAtRef.current) / 1000)
      if (remaining <= 0) {
        if (getLS('mf_sound_enabled', true)) playBeep()
        if (getLS('mf_vibration_enabled', true) && navigator.vibrate) navigator.vibrate([300, 100, 300])
        setRest(null)
      } else {
        setRest(remaining)
      }
    }

    restRef.current = setTimeout(tick, 1000)
    return () => clearTimeout(restRef.current)
  }, [rest, restTotal])

  async function startWorkout() {
    if (isPreview || hasStarted || starting) return true

    setStarting(true)
    setSessionError(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const startedAt = new Date().toISOString()
      const { data: createdWorkout, error } = await supabase
        .from('mf_workouts')
        .insert({ user_id: userData.user.id, program_id: programId, started_at: startedAt })
        .select('id, started_at')
        .single()

      if (error || !createdWorkout?.id) {
        throw error ?? new Error('Failed to create workout')
      }

      startedAtRef.current = new Date(createdWorkout.started_at).getTime()
      setElapsed(0)
      setWorkoutId(createdWorkout.id)
      setHasStarted(true)
      setCurrentWorkout({
        id: createdWorkout.id,
        programId,
        startedAt: createdWorkout.started_at,
      })
      return true
    } catch (error) {
      console.error('startWorkout:', error)
      setSessionError('Не вдалося почати тренування. Спробуй ще раз.')
      return false
    } finally {
      setStarting(false)
    }
  }

  async function cancelStartedWorkout() {
    if (!workoutId) {
      navigate('/')
      return
    }

    setSessionError(null)
    const { error } = await supabase.from('mf_workouts').delete().eq('id', workoutId)
    if (error) {
      console.error('cancelStartedWorkout:', error)
      setSessionError('Не вдалося скасувати тренування. Спробуй ще раз.')
      return
    }

    clearCurrentWorkout()
    clearPendingSetsForWorkout(workoutId)
    clearPendingFinish(workoutId)
    wakeLockRef.current?.release()
    navigate('/')
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

  async function persistWorkoutSet(setData) {
    const { error } = await supabase
      .from('mf_workout_sets')
      .upsert(setData, { onConflict: 'id', ignoreDuplicates: true })
    if (error) appendPendingSet(setData)
  }

  function removeLastSet(exIdx) {
    setExercises(prev => prev.map((exercise, i) => {
      if (i !== exIdx || exercise.sets.length <= 1) return exercise
      return { ...exercise, sets: exercise.sets.slice(0, -1) }
    }))
  }

  async function completeWarmup(exIdx) {
    if (isPreview || !hasStarted || !workoutId) return

    setExercises(prev => prev.map((ex, i) => (
      i !== exIdx ? ex : { ...ex, warmupDone: true }
    )))
    const restSecs = getLS('mf_rest_seconds', 90)
    startRestTimer(restSecs)
    const ex = exercises[exIdx]
    const displayExercise = replacedExercises[ex.exercise.id] ?? ex.exercise
    const setData = {
      id: crypto.randomUUID(),
      workout_id: workoutId,
      exercise_id: displayExercise.id,
      set_number: 0,
      weight: Math.round((ex.sets[0]?.weight ?? ex.defaultWeight ?? 0) * 0.5),
      reps: ex.sets[0]?.reps ?? ex.defaultReps,
      duration_seconds: 0,
      completed: true,
    }
    await persistWorkoutSet(setData)
  }

  async function saveNote(exerciseId, text) {
    setSessionError(null)
    const { error } = await supabase.from('mf_exercises').update({ personal_note: text }).eq('id', exerciseId)
    if (error) {
      console.error('saveNote:', error)
      setSessionError('Не вдалося зберегти нотатку вправи. Спробуй ще раз.')
      return
    }
    setExercises(prev => prev.map(item =>
      item.exercise.id === exerciseId
        ? { ...item, exercise: { ...item.exercise, personal_note: text } }
        : item
    ))
    setNoteEdit(null)
  }

  function toggleWarmup(exIdx) {
    setExercises(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, hasWarmup: !ex.hasWarmup, warmupDone: false }
    ))
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
            duration: last?.duration ?? 0,
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
    if (isPreview || !hasStarted || !workoutId) return

    updateSet(exIdx, setIdx, 'completed', true)
    const restSecs = getLS('mf_rest_seconds', 90)
    startRestTimer(restSecs)

    const set = exercises[exIdx].sets[setIdx]
    const displayExercise = replacedExercises[exercises[exIdx].exercise.id] ?? exercises[exIdx].exercise

    const exercise = exercises[exIdx]
    const setData = {
      id: crypto.randomUUID(),
      workout_id: workoutId,
      exercise_id: displayExercise.id,
      set_number: setIdx + 1,
      weight: exercise.tracksWeight === false ? 0 : set.weight,
      reps: exercise.mode === 'time' ? 0 : set.reps,
      duration_seconds: exercise.mode === 'time' ? (set.duration ?? 0) : 0,
      completed: true,
    }
    await persistWorkoutSet(setData)
  }

  async function finishWorkout(intensity) {
    if (!hasStarted || !workoutId || finishing) {
      return
    }

    setFinishing(true)
    setSessionError(null)

    try {
      const pendingSync = await syncPendingSetsForWorkout(supabase, workoutId)
      if (!pendingSync.ok) {
        setSessionError('Не вдалося дозберегти підходи. Спробуй завершити тренування ще раз.')
        return
      }
      const calories = burnedCalories
      // Обмежуємо тривалість 6 годинами — захист від кривого elapsed,
      // якщо started_at виявився старим (підхоплений запис із минулого дня).
      const durationMinutes = Math.min(360, Math.max(1, Math.round(elapsed / 60)))
      // Кардіо відбувається в межах загального elapsed, тож не додаємо його зверху —
      // зберігаємо окремо для статистики/summary.
      const cardioWarmupMin = Math.round(cardioLiveSec(cardio) / 60)
      const cardioFinishMin = Math.round(cardioLiveSec(cardioFinish) / 60)
      const finishData = {
        id: workoutId,
        finished_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
        intensity,
        calories_burned: calories,
        cardio_warmup_minutes: cardioWarmupMin,
        cardio_finish_minutes: cardioFinishMin,
      }
      setPendingFinish(finishData)

      const { data: finishedWorkout, error } = await supabase
        .from('mf_workouts')
        .update({
          finished_at: finishData.finished_at,
          duration_minutes: finishData.duration_minutes,
          intensity,
          calories_burned: calories,
          cardio_warmup_minutes: cardioWarmupMin,
          cardio_finish_minutes: cardioFinishMin,
        })
        .eq('id', workoutId)
        .select('id')
        .maybeSingle()

      if (error || !finishedWorkout?.id) {
        setSessionError('Не вдалося завершити тренування. Спробуй ще раз.')
        return
      }

      clearPendingFinish(workoutId)
      clearCurrentWorkout()
      wakeLockRef.current?.release()
      navigate('/')
    } catch {
      setSessionError('Не вдалося дозберегти підходи. Спробуй завершити тренування ще раз.')
      return
    } finally {
      setFinishing(false)
    }
  }

  function requestFinish() {
    if (!hasStarted || finishing) return
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

  if (loadError) {
    return (
      <div className="screen screen--no-nav">
        <LoadErrorState message={loadError} onRetry={() => setReloadKey(value => value + 1)} />
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
    (sum, exercise) => (exercise.mode === 'time' || exercise.tracksWeight === false)
      ? sum
      : sum + exercise.sets.filter(set => set.completed).reduce((acc, set) => acc + set.weight * set.reps, 0),
    0,
  )
  const metValues = MET_TABLE[program?.activity_type] ?? MET_TABLE.силове
  const burnedCalories = Math.round((metValues[selectedMood] ?? metValues.нормально) * bodyWeight * (elapsed / 3600))
  const menuExercise = exercises.find(exercise => exercise.exercise.id === menuExerciseId)
  const menuDisplayExercise = menuExercise
    ? (replacedExercises[menuExercise.exercise.id] ?? menuExercise.exercise)
    : null
  const interactionLocked = isPreview || !hasStarted

  if (summaryOpen) {
    return (
      <div className="screen screen--no-nav">
        <div className="page page-top stack" style={{ gap: 32, justifyContent: 'space-between', minHeight: '100%' }}>
          <div className="stack" style={{ gap: 28 }}>
            <div className="card-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="label">Тренування завершено</div>
              </div>
              <button type="button" className="icon-btn" onClick={() => finishWorkout(selectedMood)} disabled={finishing}><IconX size={18} /></button>
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
          disabled={finishing}
        >
            {finishing ? 'Завершуємо...' : 'На головну'}
        </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen screen--no-nav" style={{ overflow: 'hidden', paddingBottom: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', minHeight: 0, paddingBottom: rest !== null ? 90 : 0 }}>
      <div className="topbar" style={{ paddingBottom: 0 }}>
        <button
          type="button"
          onClick={async () => {
            if (isPreview) { navigate(-1); return }
            if (!hasStarted) { navigate('/'); return }
            if (!confirm('Скасувати тренування? Усі незбережені зміни буде втрачено.')) return
            await cancelStartedWorkout()
          }}
          className="icon-btn"
          aria-label="Назад"
        >
          <IconArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div className="label" style={{ textAlign: 'center' }}>
            {isPreview
              ? 'ПЕРЕГЛЯД'
              : hasStarted
              ? formatProgramTitle(program?.name ?? 'Тренування')
              : 'ГОТОВО ДО СТАРТУ'}
          </div>
          {!isPreview && (
            hasStarted
              ? <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{fmtTime(elapsed)}</div>
              : <div className="meta" style={{ fontSize: 12 }}>Перевір вправи перед стартом</div>
          )}
        </div>
        {hasStarted && !isPreview ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Завершити або параметри"
            onClick={requestFinish}
          >
            <IconMore size={20} />
          </button>
        ) : (
          <div style={{ width: 38, height: 38 }} />
        )}
      </div>

      <div className="page stack">
        {sessionError && (
          <div style={{
            background: 'rgba(255,90,95,0.1)',
            border: '1px solid rgba(255,90,95,0.25)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            color: 'var(--danger)',
            marginBottom: -4,
          }}>
            {sessionError}
          </div>
        )}

        {!isOnline && hasStarted && !isPreview && (
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

        {restMissedSecs !== null && (
          <button
            type="button"
            onClick={() => setRestMissedSecs(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(198,255,61,0.1)',
              border: '1px solid rgba(198,255,61,0.35)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: -4,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                Відпочинок завершено
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {restMissedSecs < 60
                  ? `${restMissedSecs} сек тому — час до підходу!`
                  : `${Math.round(restMissedSecs / 60)} хв тому — час до підходу!`}
              </div>
            </div>
            <IconX size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          </button>
        )}

        {hasStarted && !isPreview && (
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

        {program?.has_cardio !== false && (
          <CardioBlock
            title="Кардіо розминка"
            state={cardio}
            setState={setCardio}
            liveSec={cardioLiveSec(cardio)}
            onToggle={() => toggleCardioTimer(setCardio)}
            disabled={interactionLocked}
          />
        )}


        <div className="stack" style={{ gap: 12 }}>
          {exercises.map((exercise, exerciseIndex) => {
            const displayExercise = replacedExercises[exercise.exercise.id] ?? exercise.exercise
            const isReplaced = !!replacedExercises[exercise.exercise.id]
            const workingWeight = exercise.sets[0]?.weight ?? exercise.defaultWeight ?? 0
            const warmupWeight = workingWeight > 0 ? Math.round(workingWeight * 0.5) : 0
            const exerciseDone = exercise.sets.every(set => set.completed)
            const isTime = exercise.mode === 'time'
            const showWeight = exercise.tracksWeight !== false
            // # | Минулого | [Вага] | Повт./Час | ✓
            const rowCols = showWeight
              ? '28px 64px 1fr 1fr 36px'
              : '28px 64px 1fr 36px'
            const valueField = isTime ? 'duration' : 'reps'
            const fmtPrev = p => isTime
              ? `${p.duration ?? 0}с`
              : (showWeight ? `${p.weight}×${p.reps}` : `${p.reps}`)

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
                      {displayExercise.about && (
                        <div className="ex-note" style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>
                          {displayExercise.about}
                        </div>
                      )}
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
                  <div className="ex-row ex-row-head" style={{ gridTemplateColumns: rowCols }}>
                    <div>#</div>
                    <div>Минулого</div>
                    {showWeight && <div>Вага</div>}
                    <div>{isTime ? 'Час, с' : 'Повт.'}</div>
                    <div />
                  </div>

                  {exercise.hasWarmup && (
                    <div className="ex-row" data-done={exercise.warmupDone ? '1' : '0'} style={{ gridTemplateColumns: rowCols }}>
                      <div className="set-num set-num--warmup">Р</div>
                      <div className="set-last">розм.</div>
                      {showWeight && <div className="set-value num">{warmupWeight}</div>}
                      <div className="set-value num">{exercise.sets[0]?.reps ?? exercise.defaultReps}</div>
                      <button
                        type="button"
                        className="set-check"
                        data-done={exercise.warmupDone ? '1' : '0'}
                        onClick={() => completeWarmup(exerciseIndex)}
                        disabled={interactionLocked}
                      >
                        {exercise.warmupDone ? <IconCheck size={16} /> : ''}
                      </button>
                    </div>
                  )}

                  {exercise.sets.map((set, setIndex) => {
                    const prev = prevSets[exercise.exercise.id]?.[setIndex]

                    return (
                      <div key={setIndex} className="ex-row" data-done={set.completed ? '1' : '0'} style={{ gridTemplateColumns: rowCols }}>
                        <div className="set-num">{setIndex + 1}</div>
                        <div className="set-last">{prev ? fmtPrev(prev) : (warmupWeight > 0 ? `${exercise.defaultWeight ?? 0}×${exercise.defaultReps ?? 12}` : '—')}</div>
                        {showWeight && (
                          <div className="set-value num">
                            {editingCell?.exerciseId === exercise.exercise.id && editingCell?.setIdx === setIndex && editingCell?.field === 'weight' ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                defaultValue={String(set.weight)}
                                className="set-inline-input"
                                onBlur={event => {
                                  updateSet(exerciseIndex, setIndex, 'weight', parseCellValue('weight', event.target.value, set.weight))
                                  stopEditing()
                                }}
                                onKeyDown={event => {
                                  if (event.key === 'Enter') {
                                    updateSet(exerciseIndex, setIndex, 'weight', parseCellValue('weight', event.currentTarget.value, set.weight))
                                    stopEditing()
                                  }
                                  if (event.key === 'Escape') stopEditing()
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="set-edit-btn num"
                                onClick={() => startEditing(exercise.exercise.id, setIndex, 'weight')}
                                disabled={interactionLocked}
                              >
                                {set.weight}
                              </button>
                            )}
                          </div>
                        )}
                        <div className="set-value num">
                          {editingCell?.exerciseId === exercise.exercise.id && editingCell?.setIdx === setIndex && editingCell?.field === valueField ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              defaultValue={String(set[valueField] ?? 0)}
                              className="set-inline-input"
                              onBlur={event => {
                                updateSet(exerciseIndex, setIndex, valueField, parseCellValue('reps', event.target.value, set[valueField] ?? 0))
                                stopEditing()
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  updateSet(exerciseIndex, setIndex, valueField, parseCellValue('reps', event.currentTarget.value, set[valueField] ?? 0))
                                  stopEditing()
                                }
                                if (event.key === 'Escape') stopEditing()
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="set-edit-btn num"
                              onClick={() => startEditing(exercise.exercise.id, setIndex, valueField)}
                              disabled={interactionLocked}
                            >
                              {set[valueField] ?? 0}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="set-check"
                          data-done={set.completed ? '1' : '0'}
                          onClick={() => completeSet(exerciseIndex, setIndex)}
                          disabled={interactionLocked}
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
                            disabled={interactionLocked}
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
                    <IconNote size={15} />
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
                    data-active={exercise.hasWarmup ? '1' : '0'}
                    style={exercise.hasWarmup ? {
                      background: 'rgba(198,255,61,0.12)',
                      borderColor: 'rgba(198,255,61,0.4)',
                      color: 'var(--accent)',
                    } : {}}
                    onClick={() => toggleWarmup(exerciseIndex)}
                    disabled={interactionLocked}
                  >
                    Р
                  </button>
                  <button
                    type="button"
                    className="ex-action-btn"
                    onClick={() => addSet(exerciseIndex)}
                    disabled={interactionLocked}
                  >
                    + Підхід
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      className="ex-action-btn"
                      onClick={() => removeLastSet(exerciseIndex)}
                      disabled={interactionLocked}
                    >
                      − Підхід
                    </button>
                  )}
                  {exercise.alternatives.length > 0 && (
                    <button
                      type="button"
                      className="ex-action-btn"
                      disabled={interactionLocked}
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
                                    duration: 0,
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

        {program?.has_cardio_finish && !isPreview && (
          <CardioBlock
            title="Кардіо після тренування"
            state={cardioFinish}
            setState={setCardioFinish}
            liveSec={cardioLiveSec(cardioFinish)}
            onToggle={() => toggleCardioTimer(setCardioFinish)}
            disabled={interactionLocked}
          />
        )}
      </div>
      </div>

      <div className="finish-bar">
        {isPreview ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)} style={{ flex: 1 }}>
              Закрити перегляд
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/workout/${programId}`, { state: { fromApp: true }, replace: true })}
              style={{ flex: 1 }}
            >
              До старту
            </button>
          </div>
        ) : !hasStarted ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => { void startWorkout() }}
            disabled={starting}
          >
            {starting ? 'Запускаємо...' : 'Почати тренування'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={requestFinish}
            disabled={finishing}
            style={{ opacity: 1 }}
          >
            {finishing ? 'Завершуємо...' : 'Завершити тренування'}
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

      {rest !== null && (
        <div
          className="timer-bar"
          style={{
            '--p': `${Math.max(0, 100 - (rest / restTotal) * 100)}%`,
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            borderRadius: '16px 16px 0 0',
            margin: 0,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div>
            <div className="label" style={{ color: 'rgba(198,255,61,0.85)' }}>Відпочинок</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>
              {fmtTime(rest)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => {
              restStartedAtRef.current = nowMs() - ((restTotal - (rest ?? 0) - 15) * 1000)
              setRestTotal(value => value + 15)
              setRest(value => (value ?? 0) + 15)
            }}>
              +15с
            </button>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => {
              restStartedAtRef.current = null
              setRest(null)
            }}>
              Пропустити
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const CARDIO_TYPES = ['Сходи', 'Еліпс', 'Бігова доріжка', 'Велотренажер']

function CardioBlock({ title, state, setState, liveSec, onToggle, disabled = false }) {
  const running = !!state.startedAt
  const done = state.done && !running

  // Текст і вигляд кнопки залежно від стану: ще не почато / йде / завершено.
  let btnLabel = 'Старт'
  let btnIcon = <IconPlay size={16} />
  if (running) { btnLabel = 'Стоп'; btnIcon = null }
  else if (done) { btnLabel = 'Готово'; btnIcon = <IconCheck size={16} /> }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="prog-icon" style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <IconFlame size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-3" style={{ fontSize: 15 }}>{title}</div>
          <select
            value={state.type}
            onChange={event => setState(value => ({ ...value, type: event.target.value }))}
            className="select-field"
            disabled={running || disabled}
            style={{ marginTop: 6 }}
          >
            {CARDIO_TYPES.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {running && (
            <span style={{
              width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)',
              animation: 'cardioPulse 1s ease-in-out infinite', flexShrink: 0,
            }} />
          )}
          <div
            className="num"
            style={{
              fontSize: 30, fontWeight: 700, lineHeight: 1,
              color: running ? 'var(--accent)' : done ? 'var(--text)' : 'var(--text-3)',
            }}
          >
            {fmtTime(liveSec)}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="btn btn-sm"
          disabled={disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            minWidth: 96, justifyContent: 'center',
            background: running ? 'var(--danger, #ff5a5f)' : done ? 'var(--surface-2)' : 'var(--accent)',
            color: running ? '#fff' : done ? 'var(--text-2)' : 'var(--accent-text)',
            border: done ? '1px solid var(--border)' : 'none',
            fontWeight: 600,
          }}
        >
          {btnIcon}
          {btnLabel}
        </button>
      </div>
    </div>
  )
}
