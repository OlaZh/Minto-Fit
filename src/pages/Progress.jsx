import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DAY_MS = 86400000
const WEEKS = 16

export default function Progress() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date(Date.now() - WEEKS * 7 * DAY_MS).toISOString()

      const [{ data: wks }, { data: sets }] = await Promise.all([
        supabase
          .from('mf_workouts')
          .select('started_at, program:mf_programs(color, type, name)')
          .not('finished_at', 'is', null)
          .gte('started_at', since)
          .order('started_at'),
        supabase
          .from('mf_workout_sets')
          .select('exercise_id, weight, exercise:mf_exercises(name)')
          .eq('completed', true),
      ])

      setWorkouts(wks ?? [])

      // Personal records: max weight per exercise
      const map = {}
      ;(sets ?? []).forEach(s => {
        if (!map[s.exercise_id] || s.weight > map[s.exercise_id].weight) {
          map[s.exercise_id] = { name: s.exercise?.name ?? '—', weight: s.weight }
        }
      })
      setRecords(Object.values(map).sort((a, b) => b.weight - a.weight))

      setLoading(false)
    }
    load()
  }, [])

  // ── Stats ──────────────────────────────────────────────────
  const now = new Date()
  const thisMonth = workouts.filter(w => {
    const d = new Date(w.started_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const streakWeeks = (() => {
    let count = 0
    for (let w = 0; w < 52; w++) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - w * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)
      const hasWorkout = workouts.some(wk => {
        const d = new Date(wk.started_at)
        return d >= weekStart && d < weekEnd
      })
      if (w === 0 || hasWorkout) { if (hasWorkout) count++; else break }
    }
    return count
  })()

  // ── Heatmap ────────────────────────────────────────────────
  const workoutByDate = {}
  workouts.forEach(w => {
    const key = new Date(w.started_at).toDateString()
    workoutByDate[key] = w.program?.color ?? '#52525b'
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = new Date(today)
  startDay.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7)

  const grid = []
  for (let d = new Date(startDay); d <= today; d.setDate(d.getDate() + 1)) {
    grid.push(new Date(d))
  }

  const weeks = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))

  if (loading) return <div className="p-6 text-zinc-500">Завантаження...</div>

  return (
    <div className="p-4 space-y-6 pb-8">
      <h1 className="text-2xl font-semibold tracking-tight">Прогрес</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-3xl font-bold text-zinc-100">{streakWeeks}</p>
          <p className="text-sm text-zinc-500 mt-1">тижнів поспіль</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-3xl font-bold text-zinc-100">{thisMonth}</p>
          <p className="text-sm text-zinc-500 mt-1">тренувань цього місяця</p>
        </div>
      </div>

      {/* Heatmap */}
      <section className="space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-widest">Відвідування</p>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => {
                const color = workoutByDate[day.toDateString()]
                const isToday = day.toDateString() === today.toDateString()
                return (
                  <div
                    key={di}
                    title={day.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                    className={`w-4 h-4 rounded-sm ${isToday ? 'ring-1 ring-zinc-400' : ''}`}
                    style={{ backgroundColor: color ?? '#18181b' }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap mt-1">
          {[
            { label: 'Немає', color: '#18181b' },
            { label: 'Тренування', color: '#52525b' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-zinc-600">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Body stats button */}
      <button
        onClick={() => navigate('/progress/body')}
        className="w-full flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-4"
      >
        <div>
          <p className="font-medium text-zinc-100">Зміни</p>
          <p className="text-sm text-zinc-500">Вага, заміри тіла, графіки</p>
        </div>
        <span className="text-zinc-600 text-lg">›</span>
      </button>

      {/* Personal records */}
      {records.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Особисті рекорди</p>
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.name} className="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
                <p className="text-sm text-zinc-200">{r.name}</p>
                <p className="text-sm font-semibold text-zinc-100">{r.weight} кг</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
