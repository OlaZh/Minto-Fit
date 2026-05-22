import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
    setExercises(prev => prev.map(item => (
      item.exercise.id === exerciseId
        ? { ...item, exercise: { ...item.exercise, personal_note: noteText } }
        : item
    )))
    setNoteOpen(null)
  }

  if (loading) {
    return (
      <div className="screen screen--no-nav">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="screen screen--no-nav">
        <div className="page page-top meta">Програму не знайдено</div>
      </div>
    )
  }

  return (
    <div className="screen screen--no-nav">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/programs')}>←</button>
        <div className="topbar-title" style={{ alignItems: 'center', textAlign: 'center', flex: 1 }}>
          <div className="label">Програма</div>
          <div className="h-3">{program.name}</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div className="page stack" style={{ paddingTop: 8, gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="card-row" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                className="prog-icon"
                style={{ background: `${program.color ?? '#3f3f46'}18` }}
              >
                <span>{program.emoji ?? '💪'}</span>
              </div>
              <div>
                <div className="h-3">{program.name.replace(/\s+—.+$/, '')}</div>
                <div className="meta" style={{ marginTop: 2 }}>
                  {program.name.match(/—\s*(.+)$/)?.[1] ?? 'Добірка вправ'}
                </div>
              </div>
            </div>
            <span className="chip-dot" style={{ width: 10, height: 10, background: program.color ?? '#71717a' }} />
          </div>
        </div>

        {exercises.length === 0 && (
          <div className="card">
            <div className="meta">У цій програмі ще немає вправ.</div>
          </div>
        )}

        {exercises.map(({ exercise, default_sets, default_reps, default_weight }) => (
          <article key={exercise.id} className="program-card" style={{ overflow: 'hidden', padding: 0 }}>
            <div className="exercise-hero" style={{ aspectRatio: '16 / 8', border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0 }}>
              {exercise.machine_photo_url ? (
                <img src={exercise.machine_photo_url} alt={exercise.name} />
              ) : (
                <span>Фото тренажера</span>
              )}
            </div>

            <div className="stack" style={{ gap: 12, padding: 18 }}>
              <div className="card-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="h-3">{exercise.name}</div>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {default_sets} підходи · {default_reps} повторень · {default_weight} кг
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {exercise.youtube_url && (
                    <a href={exercise.youtube_url} target="_blank" rel="noreferrer" className="icon-btn">
                      ▶️
                    </a>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setNoteOpen(exercise.id)
                      setNoteText(exercise.personal_note ?? '')
                    }}
                  >
                    📝
                  </button>
                </div>
              </div>

              {exercise.personal_note && (
                <div className="card" style={{ background: 'var(--surface-2)', padding: 14 }}>
                  <div className="label" style={{ marginBottom: 6 }}>Мої налаштування</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>{exercise.personal_note}</div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {noteOpen && (
        <div className="sheet-backdrop" onClick={() => setNoteOpen(null)}>
          <div className="sheet" onClick={event => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack">
              <div className="h-3">Нотатка про тренажер</div>
              <textarea
                value={noteText}
                onChange={event => setNoteText(event.target.value)}
                placeholder="Висота сидіння, позиція валиків..."
                rows={4}
                className="textarea-field"
                autoFocus
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-block" onClick={() => setNoteOpen(null)}>
                  Скасувати
                </button>
                <button type="button" className="btn btn-primary btn-block" onClick={() => saveNote(noteOpen)}>
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
