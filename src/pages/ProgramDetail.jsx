import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [noteOpen, setNoteOpen] = useState(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: prog }, { data: exs }] = await Promise.all([
        supabase.from('mf_programs').select('*').eq('id', id).single(),
        supabase
          .from('mf_program_exercises')
          .select('*, exercise:mf_exercises(*)')
          .eq('program_id', id)
          .order('order'),
      ])
      setProgram(prog)
      setExercises(exs ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function saveNote(exerciseId) {
    await supabase.from('mf_exercises').update({ personal_note: noteText }).eq('id', exerciseId)
    setExercises(prev =>
      prev.map(e =>
        e.exercise.id === exerciseId
          ? { ...e, exercise: { ...e.exercise, personal_note: noteText } }
          : e
      )
    )
    setNoteOpen(null)
  }

  if (loading) return <div className="p-6 text-zinc-500">Завантаження...</div>
  if (!program) return <div className="p-6 text-zinc-500">Програму не знайдено</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/programs')} className="text-zinc-400 text-2xl leading-none">‹</button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: program.color ?? '#27272a' }}
        >
          {program.emoji ?? '💪'}
        </div>
        <h1 className="text-xl font-semibold">{program.name}</h1>
      </div>

      {exercises.length === 0 && (
        <p className="text-zinc-500 text-sm">Вправ ще немає</p>
      )}

      <div className="space-y-3">
        {exercises.map(({ exercise, default_sets, default_reps, default_weight }) => (
          <div key={exercise.id} className="bg-zinc-900 rounded-2xl overflow-hidden">
            {exercise.machine_photo_url ? (
              <img
                src={exercise.machine_photo_url}
                alt={exercise.name}
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="w-full h-32 bg-zinc-800 flex items-center justify-center text-zinc-600 text-sm">
                фото тренажера
              </div>
            )}

            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-100">{exercise.name}</p>
                <div className="flex items-center gap-3">
                  {exercise.youtube_url && (
                    <a
                      href={exercise.youtube_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 text-lg"
                    >
                      ▶️
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setNoteOpen(exercise.id)
                      setNoteText(exercise.personal_note ?? '')
                    }}
                    className="text-zinc-400 text-lg"
                  >
                    📝
                  </button>
                </div>
              </div>

              <p className="text-sm text-zinc-500">
                {default_sets} підходи · {default_reps} повторень · {default_weight} кг
              </p>

              {exercise.personal_note && (
                <p className="text-sm text-zinc-400 bg-zinc-800 rounded-xl px-3 py-2">
                  {exercise.personal_note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {noteOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setNoteOpen(null)}>
          <div
            className="bg-zinc-900 w-full rounded-t-3xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-medium">Нотатка про тренажер</p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Висота сидіння, позиція валиків..."
              rows={4}
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none resize-none placeholder:text-zinc-600"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setNoteOpen(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm"
              >
                Скасувати
              </button>
              <button
                onClick={() => saveNote(noteOpen)}
                className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-950 text-sm font-medium"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
