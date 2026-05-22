import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const REST_SECONDS = 90

export default function ActiveWorkout() {
  const { programId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prevSets, setPrevSets] = useState({})
  const [workoutId, setWorkoutId] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [rest, setRest] = useState(null)
  const [finishing, setFinishing] = useState(false)

  // Нові стани
  const [cardio, setCardio] = useState({ type: 'Еліпс', duration: 30, done: false })
  const [rpe, setRpe] = useState({})                    // exId → '🟢'|'🟡'|'🔴'
  const [replacedExercises, setReplacedExercises] = useState({}) // exId → altExercise object
  const [originalSets, setOriginalSets] = useState({})           // exId → sets before replacement
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const wakeLockRef = useRef(null)
  const elapsedRef = useRef(null)
  const restRef = useRef(null)

  // ── Load ──────────────────────────────────────────────────
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

      // Минулі підходи
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
        alternatives: [],
        sets: Array.from({ length: row.default_sets }, (_, i) => ({
          weight: prev[row.exercise.id]?.[i]?.weight ?? row.default_weight,
          reps: prev[row.exercise.id]?.[i]?.reps ?? row.default_reps,
          completed: false,
        })),
      }))

      // Завантажуємо альтернативи
      if (exList.length > 0) {
        const exIds = exList.map(e => e.exercise.id)
        const { data: altRows } = await supabase
          .from('mf_alternative_exercises')
          .select('exercise_id, alt_default_sets, alt_default_reps, alt_default_weight, alt:mf_exercises!alternative_exercise_id(id, name, youtube_url, machine_photo_url, personal_note, description)')
          .in('exercise_id', exIds)

        if (altRows?.length) {
          const altMap = {}
          altRows.forEach(r => {
            if (!altMap[r.exercise_id]) altMap[r.exercise_id] = []
            if (r.alt) altMap[r.exercise_id].push({
              ...r.alt,
              altDefaultSets: r.alt_default_sets,
              altDefaultReps: r.alt_default_reps,
              altDefaultWeight: r.alt_default_weight,
            })
          })
          exList.forEach(e => { e.alternatives = altMap[e.exercise.id] ?? [] })
        }
      }

      setExercises(exList)

      // Створюємо запис тренування
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

  // ── Wake Lock ─────────────────────────────────────────────
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator)
          wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {}
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      wakeLockRef.current?.release()
    }
  }, [])

  // ── Elapsed ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(elapsedRef.current)
  }, [loading])

  // ── Rest timer ────────────────────────────────────────────
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

  function fmtTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  // ── Set actions ───────────────────────────────────────────
  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => prev.map((e, i) =>
      i !== exIdx ? e : { ...e, sets: e.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s) }
    ))
  }

  function adjustWeight(exIdx, setIdx, delta) {
    const val = exercises[exIdx].sets[setIdx].weight
    updateSet(exIdx, setIdx, 'weight', Math.max(0, +(val + delta).toFixed(1)))
  }

  function adjustReps(exIdx, setIdx, delta) {
    const val = exercises[exIdx].sets[setIdx].reps
    updateSet(exIdx, setIdx, 'reps', Math.max(1, val + delta))
  }

  function addSet(exIdx) {
    setExercises(prev => prev.map((e, i) => {
      if (i !== exIdx) return e
      const last = e.sets[e.sets.length - 1]
      return { ...e, sets: [...e.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 10, completed: false }] }
    }))
  }

  async function completeSet(exIdx, setIdx) {
    updateSet(exIdx, setIdx, 'completed', true)
    setRest(REST_SECONDS)
    if (!workoutId) return
    const s = exercises[exIdx].sets[setIdx]
    const displayEx = replacedExercises[exercises[exIdx].exercise.id] ?? exercises[exIdx].exercise
    supabase.from('mf_workout_sets').insert({
      workout_id: workoutId,
      exercise_id: displayEx.id,
      set_number: setIdx + 1,
      weight: s.weight,
      reps: s.reps,
      completed: true,
    })
  }

  async function finishWorkout(intensity) {
    if (!workoutId) return
    const calories = Math.round(
      ({ важко: 8, нормально: 6, легко: 4 }[intensity] ?? 6) * 70 * (elapsed / 3600)
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

  // ── Render ────────────────────────────────────────────────
  if (loading) return <div className="p-6 text-zinc-500">Завантаження...</div>

  const cur = exercises[currentIdx]
  if (!cur) return null

  const allDone = exercises.every(e => e.sets.every(s => s.completed))
  const curAllDone = cur.sets.every(s => s.completed)
  const displayEx = replacedExercises[cur.exercise.id] ?? cur.exercise
  const isReplaced = !!replacedExercises[cur.exercise.id]
  const warmupWeight = cur.defaultWeight > 0 ? Math.round(cur.defaultWeight * 0.5) : 0

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
        <button onClick={() => setFinishing(true)} className="text-zinc-100 text-sm font-medium">
          Завершити
        </button>
      </div>

      {/* Кардіо-розминка */}
      <div className="px-4 pb-3">
        <div className="bg-zinc-900 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl shrink-0">🏃</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-300 mb-1.5">Кардіо розминка</p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={cardio.type}
                onChange={e => setCardio(c => ({ ...c, type: e.target.value }))}
                className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1 border border-zinc-700 outline-none"
              >
                {['Сходи', 'Еліпс', 'Бігова доріжка', 'Велотренажер'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={cardio.duration}
                  onChange={e => setCardio(c => ({ ...c, duration: Number(e.target.value) || 0 }))}
                  className="w-12 bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1 text-center border border-zinc-700 outline-none"
                />
                <span className="text-zinc-500 text-xs">хв</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCardio(c => ({ ...c, done: !c.done }))}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 transition-colors ${
              cardio.done ? 'bg-green-500 text-white' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
          >
            {cardio.done ? '✓' : ''}
          </button>
        </div>
      </div>

      {/* Табуляція вправ */}
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

      {/* Картка вправи */}
      <div className="flex-1 px-4 space-y-4 pb-8">

        {/* Фото */}
        {displayEx.machine_photo_url ? (
          <img src={displayEx.machine_photo_url} alt={displayEx.name} className="w-full h-44 object-cover rounded-2xl" />
        ) : (
          <div className="w-full h-32 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-600 text-sm">
            фото тренажера
          </div>
        )}

        {/* Назва + ⋯ меню + Замінити */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xl font-semibold truncate">{displayEx.name}</h2>
            {isReplaced && (
              <span className="shrink-0 text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">заміна</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {cur.alternatives.length > 0 && (
              <button
                onClick={() => {
                  const alt = cur.alternatives[0]
                  if (isReplaced) {
                    setReplacedExercises(r => { const n = { ...r }; delete n[cur.exercise.id]; return n })
                    setExercises(prev => prev.map((e, i) =>
                      i !== currentIdx ? e : { ...e, sets: originalSets[e.exercise.id] ?? e.sets }
                    ))
                    setOriginalSets(o => { const n = { ...o }; delete n[cur.exercise.id]; return n })
                  } else {
                    setOriginalSets(o => ({ ...o, [cur.exercise.id]: cur.sets }))
                    setReplacedExercises(r => ({ ...r, [cur.exercise.id]: alt }))
                    setExercises(prev => prev.map((e, i) =>
                      i !== currentIdx ? e : {
                        ...e,
                        sets: Array.from({ length: alt.altDefaultSets ?? 3 }, () => ({
                          weight: alt.altDefaultWeight ?? 0,
                          reps: alt.altDefaultReps ?? 12,
                          completed: false,
                        }))
                      }
                    ))
                  }
                }}
                className="text-xs text-zinc-400 border border-zinc-700 px-2 py-1 rounded-lg"
              >
                {isReplaced ? 'Повернутись' : '⇄ Замінити'}
              </button>
            )}
            <button
              onClick={() => { setMenuOpen(true); setNoteOpen(false) }}
              className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 text-lg leading-none"
            >
              ···
            </button>
          </div>
        </div>

        {/* Техніка (відкривається з меню) */}
        {noteOpen && (
          <div className="bg-zinc-900 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Техніка</p>
            {displayEx.description ? (
              <p className="text-sm text-zinc-300 leading-relaxed">{displayEx.description}</p>
            ) : (
              <p className="text-sm text-zinc-600 italic">Опис техніки ще не додано.</p>
            )}
            {displayEx.personal_note && (
              <>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-3 mb-1">Мої налаштування</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{displayEx.personal_note}</p>
              </>
            )}
          </div>
        )}

        {/* Підходи */}
        <div className="space-y-3">

          {/* Розминочний підхід 50% */}
          {warmupWeight > 0 && (
            <div className="bg-zinc-900/60 rounded-2xl px-4 py-3 flex items-center justify-between border border-dashed border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">W</span>
                <span className="text-sm text-zinc-500">Розминка</span>
              </div>
              <span className="text-sm text-zinc-500 font-mono">{warmupWeight} кг × 10</span>
            </div>
          )}

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
                      минулого: {prev.weight} кг × {prev.reps}
                    </span>
                  )}
                </div>

                {/* Вага */}
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

                {/* Повтори */}
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
                    Підхід виконано ✓
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Додати підхід */}
        <button
          onClick={() => addSet(currentIdx)}
          className="w-full py-3 rounded-xl border border-zinc-800 text-zinc-500 text-sm"
        >
          + Додати підхід
        </button>

        {/* RPE — з'являється коли всі підходи вправи виконані */}
        {curAllDone && (
          <div className="bg-zinc-900 rounded-2xl px-4 py-3">
            <p className="text-sm text-zinc-500 mb-2">Як було?</p>
            <div className="flex gap-2">
              {[['🟢', 'Легко'], ['🟡', 'Нормально'], ['🔴', 'Важко']].map(([icon, label]) => (
                <button
                  key={icon}
                  onClick={() => setRpe(r => ({ ...r, [cur.exercise.id]: r[cur.exercise.id] === icon ? null : icon }))}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-2xl transition-colors ${
                    rpe[cur.exercise.id] === icon
                      ? 'bg-zinc-700 border border-zinc-500'
                      : 'bg-zinc-800 border border-transparent'
                  }`}
                >
                  {icon}
                  <span className="text-xs text-zinc-400">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ⋯ Меню вправи */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setMenuOpen(false)}>
          <div
            className="bg-zinc-900 w-full rounded-t-3xl p-6 space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
            <p className="text-sm font-medium text-zinc-400 mb-3">{displayEx.name}</p>

            {/* Фото */}
            <button
              onClick={() => { setMenuOpen(false) }}
              className="w-full flex items-center gap-4 py-3 px-4 bg-zinc-800 rounded-2xl text-left"
            >
              <span className="text-2xl">📷</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">Фото тренажера</p>
                <p className="text-xs text-zinc-500">
                  {displayEx.machine_photo_url ? 'Фото показано вгорі' : 'Фото ще не додано'}
                </p>
              </div>
            </button>

            {/* Відео */}
            <button
              onClick={() => {
                setMenuOpen(false)
                if (displayEx.youtube_url) window.open(displayEx.youtube_url, '_blank')
              }}
              className="w-full flex items-center gap-4 py-3 px-4 bg-zinc-800 rounded-2xl text-left"
            >
              <span className="text-2xl">▶️</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">Відео техніки</p>
                <p className="text-xs text-zinc-500">
                  {displayEx.youtube_url ? 'Відкрити YouTube' : 'Відео ще не додано'}
                </p>
              </div>
            </button>

            {/* Техніка */}
            <button
              onClick={() => { setNoteOpen(v => !v); setMenuOpen(false) }}
              className="w-full flex items-center gap-4 py-3 px-4 bg-zinc-800 rounded-2xl text-left"
            >
              <span className="text-2xl">📝</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">Техніка виконання</p>
                <p className="text-xs text-zinc-500">
                  {displayEx.description
                    ? displayEx.description.slice(0, 50) + (displayEx.description.length > 50 ? '…' : '')
                    : 'Ще не додано'}
                </p>
              </div>
            </button>

            <button
              onClick={() => setMenuOpen(false)}
              className="w-full py-3 text-zinc-500 text-sm mt-2"
            >
              Закрити
            </button>
          </div>
        </div>
      )}

      {/* Таймер відпочинку */}
      {rest !== null && (
        <div
          className="fixed inset-0 bg-zinc-950/95 flex flex-col items-center justify-center gap-6 z-40"
          onClick={() => setRest(null)}
        >
          <p className="text-zinc-400 text-lg">Відпочинок</p>
          <span className="text-8xl font-mono font-bold text-zinc-100">{rest}</span>
          <div className="flex gap-3">
            <button
              onClick={e => { e.stopPropagation(); setRest(r => (r ?? 0) + 15) }}
              className="px-4 py-2 bg-zinc-800 rounded-xl text-zinc-300 text-sm"
            >
              +15с
            </button>
            <button
              onClick={() => setRest(null)}
              className="px-4 py-2 bg-zinc-800 rounded-xl text-zinc-300 text-sm"
            >
              Пропустити
            </button>
          </div>
        </div>
      )}

      {/* Завершити */}
      {finishing && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-zinc-900 w-full rounded-t-3xl p-6 space-y-6">
            <div>
              <p className="text-lg font-semibold">Як тренування?</p>
              <p className="text-zinc-500 text-sm">
                {fmtTime(elapsed)} · {exercises.reduce((acc, e) => acc + e.sets.filter(s => s.completed).length, 0)} підходів
              </p>
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
