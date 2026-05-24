import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconArrowLeft, IconPlay, IconNote, IconPlus, IconX, getProgramIcon } from '../components/Icons'

function ProgramIcon({ program }) {
  const PIcon = getProgramIcon(program)
  return (
    <div className="prog-icon" style={{ background: `${program.color ?? '#3f3f46'}18` }}>
      <PIcon size={20} style={{ color: program.color ?? 'var(--text-3)' }} />
    </div>
  )
}

const EX_FIELDS = [
  { key: 'default_sets',     label: 'Підходи',  min: 1, step: 1   },
  { key: 'default_reps',     label: 'Повтори',  min: 1, step: 1   },
  { key: 'default_weight',   label: 'Вага, кг', min: 0, step: 0.5 },
  { key: 'default_duration', label: 'Час, хв',  min: 0, step: 1   },
]

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [noteOpen, setNoteOpen] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [pending, setPending] = useState({})
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [editingDesc, setEditingDesc] = useState(null) // exerciseId

  useEffect(() => {
    async function load() {
      const [{ data: prog }, { data: exs }] = await Promise.all([
        supabase.from('mf_programs').select('*').eq('id', id).single(),
        supabase
          .from('mf_program_exercises')
          .select('id, order, default_sets, default_reps, default_weight, default_duration, exercise:mf_exercises(*)')
          .eq('program_id', id)
          .order('order'),
      ])
      setProgram(prog)
      setExercises(exs ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  function commitField(peId, field, raw) {
    const num = parseFloat(String(raw).replace(',', '.'))
    const value = isNaN(num) ? null : Math.max(0, num)
    setExercises(prev => prev.map(e => e.id === peId ? { ...e, [field]: value } : e))
    setPending(prev => ({ ...prev, [peId]: { ...(prev[peId] ?? {}), [field]: value } }))
    setEditingCell(null)
  }

  async function saveAllPending() {
    if (!Object.keys(pending).length) return
    setSaving(true)
    await Promise.all(
      Object.entries(pending).map(([peId, fields]) => {
        const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))
        if (!Object.keys(patch).length) return Promise.resolve()
        return supabase.from('mf_program_exercises').update(patch).eq('id', peId)
      })
    )
    setPending({})
    setSaving(false)
  }

  async function openPicker() {
    if (allExercises.length === 0) {
      const { data } = await supabase.from('mf_exercises').select('id, name').order('name')
      setAllExercises(data ?? [])
    }
    setSearch('')
    setPickerOpen(true)
  }

  async function addExercise(ex) {
    const nextOrder = exercises.length + 1
    const { data: row, error } = await supabase
      .from('mf_program_exercises')
      .insert({ program_id: id, exercise_id: ex.id, order: nextOrder, default_sets: 3, default_reps: 12, default_weight: 0 })
      .select('id, order, default_sets, default_reps, default_weight')
      .single()
    if (error) { console.error('addExercise:', error.message); return }
    const { data: fullEx } = await supabase.from('mf_exercises').select('*').eq('id', ex.id).single()
    setExercises(prev => [...prev, { ...row, exercise: fullEx ?? ex }])
    setPickerOpen(false)
  }

  async function createAndAdd(name) {
    setCreatingNew(true)
    const { data: user } = await supabase.auth.getUser()
    const { data: newEx } = await supabase
      .from('mf_exercises')
      .insert({ name, user_id: user.user.id })
      .select('id, name')
      .single()
    if (newEx) {
      setAllExercises(prev => [...prev, newEx])
      await addExercise(newEx)
    }
    setCreatingNew(false)
  }

  async function removeExercise(peId) {
    await supabase.from('mf_program_exercises').delete().eq('id', peId)
    setExercises(prev => prev.filter(e => e.id !== peId))
    setPending(prev => { const n = { ...prev }; delete n[peId]; return n })
  }

  async function saveDescription(exerciseId, text) {
    await supabase.from('mf_exercises').update({ description: text }).eq('id', exerciseId)
    setExercises(prev => prev.map(e =>
      e.exercise.id === exerciseId
        ? { ...e, exercise: { ...e.exercise, description: text } }
        : e
    ))
    setEditingDesc(null)
  }

  async function saveNote(exerciseId) {
    await supabase.from('mf_exercises').update({ personal_note: noteText }).eq('id', exerciseId)
    setExercises(prev => prev.map(item =>
      item.exercise.id === exerciseId
        ? { ...item, exercise: { ...item.exercise, personal_note: noteText } }
        : item
    ))
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
        <button type="button" className="icon-btn" onClick={() => navigate('/programs')}>
          <IconArrowLeft size={20} />
        </button>
        <div className="topbar-title" style={{ alignItems: 'center', textAlign: 'center', flex: 1 }}>
          <div className="label">Програма</div>
          <div className="h-3">{program.name}</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div className="page stack">
        <div className="card" style={{ padding: 18 }}>
          <div className="card-row" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProgramIcon program={program} />
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



        {exercises.map((row) => {
          const { exercise } = row
          return (
            <article key={exercise.id} className="program-card" style={{ overflow: 'hidden', padding: 0 }}>
              <div className="exercise-hero" style={{ aspectRatio: '16 / 8', border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0 }}>
                {exercise.machine_photo_url ? (
                  <img
                    src={exercise.machine_photo_url}
                    alt={exercise.name}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                ) : (
                  <span>Фото</span>
                )}
              </div>

              <div className="stack" style={{ gap: 12, padding: 18 }}>
                {/* Name + actions */}
                <div className="card-row" style={{ alignItems: 'flex-start' }}>
                  <div className="h-3" style={{ flex: 1 }}>{exercise.name}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {exercise.youtube_url && (
                      <a href={exercise.youtube_url} target="_blank" rel="noreferrer" className="icon-btn">
                        <IconPlay size={18} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => { setNoteOpen(exercise.id); setNoteText(exercise.personal_note ?? '') }}
                    >
                      <IconNote size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => removeExercise(row.id)}
                    >
                      <IconX size={18} />
                    </button>
                  </div>
                </div>

                {/* Editable fields */}
                <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {EX_FIELDS.map((f, i) => {
                    const val = row[f.key]
                    const isEditing = editingCell?.peId === row.id && editingCell?.field === f.key
                    return (
                      <div
                        key={f.key}
                        style={{
                          flex: 1,
                          borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                          padding: '10px 8px',
                          textAlign: 'center',
                          background: 'var(--surface-2)',
                        }}
                      >
                        <div className="meta" style={{ fontSize: 10, marginBottom: 4 }}>{f.label}</div>
                        {isEditing ? (
                          <input
                            type="number"
                            step={f.step}
                            defaultValue={val ?? ''}
                            autoFocus
                            className="set-inline-input"
                            style={{ width: '100%', textAlign: 'center' }}
                            onBlur={e => commitField(row.id, f.key, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitField(row.id, f.key, e.currentTarget.value)
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="set-edit-btn num"
                            style={{ width: '100%', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}
                            onClick={() => setEditingCell({ peId: row.id, field: f.key })}
                          >
                            {val ?? '—'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Description */}
                {(exercise.description || editingDesc === exercise.id) && (
                  <div className="card" style={{ background: 'var(--surface-2)', padding: 14 }}>
                    <div className="label" style={{ marginBottom: 6 }}>Опис</div>
                    {editingDesc === exercise.id ? (
                      <textarea
                        defaultValue={exercise.description ?? ''}
                        autoFocus
                        rows={4}
                        className="textarea-field"
                        style={{ fontSize: 13, background: 'transparent', border: 'none', padding: 0, width: '100%' }}
                        onBlur={e => saveDescription(exercise.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') setEditingDesc(null)
                        }}
                      />
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)', cursor: 'text' }}
                        onClick={() => setEditingDesc(exercise.id)}
                        onKeyDown={e => e.key === 'Enter' && setEditingDesc(exercise.id)}
                      >
                        {exercise.description}
                      </div>
                    )}
                  </div>
                )}

                {/* Personal note */}
                {exercise.personal_note && (
                  <button
                    type="button"
                    className="card"
                    style={{ background: 'var(--surface-2)', padding: 14, textAlign: 'left', width: '100%', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer' }}
                    onClick={() => { setNoteOpen(exercise.id); setNoteText(exercise.personal_note ?? '') }}
                  >
                    <div className="label" style={{ marginBottom: 6 }}>Мої налаштування</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>{exercise.personal_note}</div>
                  </button>
                )}
              </div>
            </article>
          )
        })}
        <button
          type="button"
          className="program-card"
          onClick={openPicker}
          style={{ textAlign: 'left', borderStyle: 'dashed' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="prog-icon" style={{ background: 'var(--surface-2)' }}>
              <IconPlus size={20} style={{ color: 'var(--text-3)' }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Додати вправу</div>
          </div>
        </button>

        <div style={{ height: 4 }} />
      </div>

      <div className="finish-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate(`/programs/${id}/edit`)}>
          Редагувати
        </button>
        {Object.keys(pending).length > 0 ? (
          <button type="button" className="btn btn-primary btn-block" onClick={saveAllPending} disabled={saving}>
            {saving ? 'Зберігаємо...' : 'Зберегти зміни'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(`/workout/${id}`, { state: { fromApp: true, preview: true } })}>
            Переглянути
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="sheet-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="sheet" style={{ maxHeight: '80dvh' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack" style={{ gap: 14 }}>
              <div className="h-3">Додати вправу</div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук..."
                className="field"
                style={{ width: '100%' }}
                autoFocus
              />
              <div className="stack" style={{ gap: 6, maxHeight: '50dvh', overflowY: 'auto' }}>
                {search.trim() && !allExercises.some(e => e.name.toLowerCase() === search.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="program-card"
                    style={{ textAlign: 'left', borderStyle: 'dashed', opacity: creatingNew ? 0.6 : 1 }}
                    onClick={() => createAndAdd(search.trim())}
                    disabled={creatingNew}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <IconPlus size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Створити «{search.trim()}»</div>
                        <div className="meta" style={{ fontSize: 12, marginTop: 2 }}>Нова вправа буде збережена в базі</div>
                      </div>
                    </div>
                  </button>
                )}
                {allExercises
                  .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
                  .map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      className="program-card"
                      style={{ textAlign: 'left', opacity: exercises.find(e => e.exercise.id === ex.id) ? 0.4 : 1 }}
                      onClick={() => addExercise(ex)}
                    >
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{ex.name}</div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {noteOpen && (
        <div className="sheet-backdrop" onClick={() => setNoteOpen(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack">
              <div className="h-3">Мої налаштування</div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
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
