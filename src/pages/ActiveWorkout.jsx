import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const REST_SECONDS = 90

export default function ActiveWorkout() {
  const { programId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([]) // [{exercise, sets:[{weight,reps,completed}], defaultSets, defaultReps, defaultWeight}]
  const [prevSets, setPrevSets] = useState({}) // exerciseId → [{weight,reps}]
  const [workoutId, setWorkoutId] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [rest, setRest] = useState(null) // seconds remaining or null
  const [finishing, setFinishing] = useState(false)

  const wakeLockRef = useRef(null)
  const elapsedRef = useRef(null)
  const restRef = useRef(null)
  const audioCtxRef = useRef(null)

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
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

      // Load previous sets if a last workout exists
      let prev = {}
      if (lastWorkout) {
        const { data: lastSets } = await supabase
          .from('mf_workout_sets')
          .select('exercise_id, weight, reps, set_number')
          .eq('workout_id', lastWorkout.id)
          .order('set_number')
        ;(lastSets ?? []).forEach(s => {
          if (!prev[s.exercise_id]) prev[s.exercise_id] = []
          prev[s.exercise_id].push({ weight: s.weight, reps: s.reps })
        })
      }
      setPrevSets(prev)

      const exList = (exRows ?? []).map(row => ({
        exercise: row.exercise,
        defaultSets: row.default_sets,
        defaultReps: row.default_reps,
        defaultWeight: row.default_weight,
        sets: Array.from({ length: row.default_sets }, (_, i) => ({
          weight: prev[row.exercise.id]?.[i]?.weight ?? row.default_weight,
          reps: prev[row.exercise.id]?.[i]?.reps ?? row.default_reps,
          completed: false,
        })),
      }))
      setExercises(exList)

      // Create workout record
      const { data: wk } = await supabase
        .from('mf_workouts')
        .insert({ user_id: uid, program_id: programId })
        .select('id')
        .single()
      setWorkoutId(wk.id)

      setLoading(false)
    }
    load()
  }, [programId])

  // ── Wake Lock ──────────────────────────────────────────────
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(lock => { wakeLockRef.current = lock })
    }
    return () => { wakeLockRef.current?.release() }
  }, [])

  // ── Elapsed timer ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(elapsedRef.current)
  }, [loading])

  // ── Rest timer ─────────────────────────────────────────────
  useEffect(() => {
    if (rest === null) return
    if (rest === 0) {
      playBeep()
      if (navigator.vibrate) navigator.vibrate([300, 100, 300])
      setRest(null)
      return
    }
    restRef.current = setTimeout(() => setRest(r => r - 1), 1000)
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

  // ── Helpers ────────────────────────────────────────────────
  function fmtTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  const cur = exercises[currentIdx]

  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => {
      const next = prev.map((e, i) => {
        if (i !== exIdx) return e
        const sets = e.sets.map((s, j) =>
          j === setIdx ? { ...s, [field]: value } : s
        )
        return { ...e, sets }
      })
      return next
    })
  }

  function adjustWeight(exIdx, setIdx, delta) {
    const cur = exercises[exIdx].sets[setIdx].weight
    updateSet(exIdx, setIdx, 'weight', Math.max(0, +(cur + delta).toFixed(1)))
  }

  function adjustReps(exIdx, setIdx, delta) {
    const cur = exercises[exIdx].sets[setIdx].reps
    updateSet(exIdx, setIdx, 'reps', Math.max(1, cur + delta))
  }

  async function completeSet(exIdx, setIdx) {
    updateSet(exIdx, setIdx, 'completed', true)
    setRest(REST_SECONDS)

    if (!workoutId) return
    const s = exercises[exIdx].sets[setIdx]
    supabase.from('mf_workout_sets').insert({
      workout_id: workoutId,
      exercise_id: exercises[exIdx].exercise.id,
      set_number: setIdx + 1,
      weight: s.weight,
      reps: s.reps,
      completed: true,
    })
  }

  async function finishWorkout(intensity) {
    if (!workoutId) return
    const calories = Math.round(
      ({ важко: 8, нормально: 6, легко: 4 }[intensity] ?? 6) *
      70 * (elapsed / 3600)
    )
    await supabase.from('mf_workouts').update({
      finished_at: new Date().toISOString(),
      duration_minutes: Math.round(elapsed / 60),
      intensity,
      calories_burned: calories,
    }).eq('id', workoutId)

    wakeLockRef.current?.release()
    navigate('/')
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading) return <div className="p-6 text-zinc-500">Завантаження...</div>
  if (!cur) return null

  const allDone = exercises.every(e => e.sets.every(s => s.completed))

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => { if (confirm('Скасувати тренування?')) navigate('/') }}
          className="text-zinc-500 text-sm"
        >
          Скасувати
        </button>
        <span className="text-zinc-300 font-mono text-lg">{fmtTime(elapsed)}</span>
        <button
          onClick={() => setFinishing(true)}
          className="text-zinc-100 text-sm font-medium"
        >
          Завершити
        </button>
      </div>

      {/* Exercise tabs */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
        {exercises.map((e, i) => {
          const done = e.sets.every(s => s.completed)
          const partial = e.sets.some(s => s.completed)
          return (
            <button
              key={e.exercise.id}
              onClick={() => setCurrentIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
                i === currentIdx
                  ? 'bg-zinc-100 text-zinc-950 font-medium'
                  : done
                  ? 'bg-green-900/60 text-green-300'
                  : partial
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {e.exercise.name}
            </button>
          )
        })}
      </div>

      {/* Main card */}
      <div className="flex-1 px-4 space-y-4 pb-8">

        {/* Photo */}
        {cur.exercise.machine_photo_url ? (
          <img
            src={cur.exercise.machine_photo_url}
            alt={cur.exercise.name}
            className="w-full h-44 object-cover rounded-2xl"
          />
        ) : (
          <div className="w-full h-32 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-600 text-sm">
            фото тренажера
          </div>
        )}

        {/* Exercise name + YouTube */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{cur.exercise.name}</h2>
          {cur.exercise.youtube_url && (
            <a href={cur.exercise.youtube_url} target="_blank" rel="noreferrer" className="text-2xl">▶️</a>
          )}
        </div>

        {/* Personal note */}
        {cur.exercise.personal_note && (
          <p className="text-sm text-zinc-400 bg-zinc-900 rounded-xl px-3 py-2">
            {cur.exercise.personal_note}
          </p>
        )}

        {/* Sets */}
        <div className="space-y-3">
          {cur.sets.map((set, si) => {
            const prev = prevSets[cur.exercise.id]?.[si]
            return (
              <div
                key={si}
                className={`bg-zinc-900 rounded-2xl px-4 py-3 space-y-3 transition-opacity ${
                  set.completed ? 'opacity-40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Підхід {si + 1}</span>
                  {prev && (
                    <span className="text-xs text-zinc-600">
                      минулого разу: {prev.weight} кг × {prev.reps}
                    </span>
                  )}
                </div>

                {/* Weight row */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustWeight(currentIdx, si, -2.5)}
                    className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xl flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-semibold">{set.weight}</span>
                    <span className="text-zinc-500 text-sm ml-1">кг</span>
                  </div>
                  <button
                    onClick={() => adjustWeight(currentIdx, si, 2.5)}
                    className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xl flex items-center justify-center"
                  >+</button>
                </div>

                {/* Reps row */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustReps(currentIdx, si, -1)}
                    className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xl flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-semibold">{set.reps}</span>
                    <span className="text-zinc-500 text-sm ml-1">повт.</span>
                  </div>
                  <button
                    onClick={() => adjustReps(currentIdx, si, 1)}
                    className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 text-xl flex items-center justify-center"
                  >+</button>
                </div>

                {!set.completed && (
                  <button
                    onClick={() => completeSet(currentIdx, si)}
                    className="w-full py-3 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-sm"
                  >
                    Підхід виконано
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add set */}
        <button
          onClick={() => {
            setExercises(prev => prev.map((e, i) => {
              if (i !== currentIdx) return e
              const last = e.sets[e.sets.length - 1]
              return { ...e, sets: [...e.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 10, completed: false }] }
            }))
          }}
          className="w-full py-3 rounded-xl border border-zinc-800 text-zinc-500 text-sm"
        >
          + Додати підхід
        </button>
      </div>

      {/* Rest timer overlay */}
      {rest !== null && (
        <div
          className="fixed inset-0 bg-zinc-950/95 flex flex-col items-center justify-center gap-6 z-40"
          onClick={() => setRest(null)}
        >
          <p className="text-zinc-400 text-lg">Відпочинок</p>
          <span className="text-8xl font-mono font-bold text-zinc-100">{rest}</span>
          <p className="text-zinc-600 text-sm">Натисни щоб пропустити</p>
        </div>
      )}

      {/* Finish modal */}
      {finishing && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-zinc-900 w-full rounded-t-3xl p-6 space-y-6">
            <div>
              <p className="text-lg font-semibold">Як тренування?</p>
              <p className="text-zinc-500 text-sm">{fmtTime(elapsed)} · {exercises.reduce((acc, e) => acc + e.sets.filter(s => s.completed).length, 0)} підходів</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'важко', label: 'Важко', icon: '😤' },
                { key: 'нормально', label: 'Нормально', icon: '💪' },
                { key: 'легко', label: 'Легко', icon: '🌿' },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => finishWorkout(key)}
                  className="flex flex-col items-center gap-2 bg-zinc-800 rounded-2xl py-5 text-2xl active:scale-95 transition-transform"
                >
                  <span>{icon}</span>
                  <span className="text-xs text-zinc-400">{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setFinishing(false)}
              className="w-full py-3 text-zinc-500 text-sm"
            >
              Продовжити тренування
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
