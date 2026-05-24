import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconArrowLeft, IconPlus, IconX, IconCheck, getProgramIcon } from '../components/Icons'

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899']

const NUM_FIELDS = [
  { key: 'sets',   label: 'Підходи',    placeholder: '—' },
  { key: 'reps',   label: 'Повтори',    placeholder: '—' },
  { key: 'weight', label: 'Вага, кг',   placeholder: '—' },
  { key: 'duration', label: 'Час, хв',  placeholder: '—' },
]

function toNum(v) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

export default function ProgramEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [type, setType] = useState('основна')
  const [color, setColor] = useState('#3b82f6')
  const [existingGroups, setExistingGroups] = useState([])
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)

  useEffect(() => {
    supabase.from('mf_programs').select('type').then(({ data }) => {
      const unique = [...new Set((data ?? []).map(p => p.type).filter(Boolean))]
      setExistingGroups(unique)
    })
  }, [])

  useEffect(() => {
    if (!isNew) {
      Promise.all([
        supabase.from('mf_programs').select('*').eq('id', id).single(),
        supabase.from('mf_program_exercises')
          .select('*, exercise:mf_exercises(id,name,description,machine_photo_url)')
          .eq('program_id', id)
          .order('order'),
      ]).then(([{ data: prog }, { data: exs }]) => {
        if (prog) {
          setName(prog.name ?? '')
          setType(prog.type ?? 'основна')
          setColor(prog.color ?? '#3b82f6')
        }
        setExercises((exs ?? []).map(e => ({
          exercise_id: e.exercise.id,
          name: e.exercise.name,
          sets:     e.default_sets   != null ? String(e.default_sets)   : '',
          reps:     e.default_reps   != null ? String(e.default_reps)   : '',
          weight:   e.default_weight != null ? String(e.default_weight) : '',
          duration: e.default_duration != null ? String(e.default_duration) : '',
          description: e.exercise.description ?? '',
          photo_url: e.exercise.machine_photo_url ?? '',
        })))
        setLoading(false)
      })
    }
  }, [id, isNew])

  async function openPicker() {
    if (allExercises.length === 0) {
      const { data } = await supabase.from('mf_exercises').select('id, name').order('name')
      setAllExercises(data ?? [])
    }
    setSearch('')
    setPickerOpen(true)
  }

  function addExercise(ex) {
    if (!exercises.find(e => e.exercise_id === ex.id)) {
      setExercises(prev => [...prev, {
        exercise_id: ex.id,
        name: ex.name,
        sets: '', reps: '', weight: '', duration: '',
        description: ex.description ?? '',
        photo_url: ex.machine_photo_url ?? '',
      }])
    }
    setPickerOpen(false)
  }

  async function createAndAdd() {
    const trimmed = search.trim()
    if (!trimmed) return
    setCreatingNew(true)
    const { data: user } = await supabase.auth.getUser()
    const { data: newEx } = await supabase
      .from('mf_exercises')
      .insert({ name: trimmed, user_id: user.user.id })
      .select('id, name')
      .single()
    if (newEx) {
      setAllExercises(prev => [...prev, newEx])
      addExercise(newEx)
    }
    setCreatingNew(false)
  }

  function removeExercise(idx) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function updateField(idx, field, value) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)

    const buildRow = (e, i, progId) => ({
      program_id: progId,
      exercise_id: e.exercise_id,
      order: i + 1,
      default_sets:     toNum(e.sets),
      default_reps:     toNum(e.reps),
      default_weight:   toNum(e.weight),
      default_duration: toNum(e.duration),
    })

    const saveExerciseMeta = async (e) => {
      const patch = {}
      if (e.description.trim()) patch.description = e.description.trim()
      if (e.photo_url.trim()) patch.machine_photo_url = e.photo_url.trim()
      if (!Object.keys(patch).length) return null
      const { error } = await supabase.from('mf_exercises').update(patch).eq('id', e.exercise_id)
      if (error) console.warn('exercise meta update failed:', error.message)
      return error
    }

    try {
      if (isNew) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: prog, error: progErr } = await supabase
          .from('mf_programs')
          .insert({ name: name.trim(), type, color, user_id: user.id })
          .select()
          .single()
        if (progErr) throw new Error(progErr.message)

        const rows = exercises.map((e, i) => buildRow(e, i, prog.id))
        const { error: exErr } = rows.length
          ? await supabase.from('mf_program_exercises').insert(rows)
          : { error: null }
        if (exErr) throw new Error(exErr.message)

        await Promise.all(exercises.map(saveExerciseMeta))
        navigate(`/programs/${prog.id}`)
      } else {
        const { error: updErr } = await supabase.from('mf_programs').update({ name: name.trim(), type, color }).eq('id', id)
        if (updErr) throw new Error(updErr.message)

        await supabase.from('mf_program_exercises').delete().eq('program_id', id)
        const rows = exercises.map((e, i) => buildRow(e, i, id))
        const { error: exErr } = rows.length
          ? await supabase.from('mf_program_exercises').insert(rows)
          : { error: null }
        if (exErr) throw new Error(exErr.message)

        await Promise.all(exercises.map(saveExerciseMeta))
        navigate(`/programs/${id}`)
      }
    } catch (err) {
      setSaveError(err.message || 'Помилка збереження')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="screen screen--no-nav">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  const filtered = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )
  const PIcon = getProgramIcon({ name })

  return (
    <div className="screen screen--no-nav">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(isNew ? '/programs' : `/programs/${id}`)}>
          <IconArrowLeft size={20} />
        </button>
        <div className="topbar-title" style={{ alignItems: 'center', textAlign: 'center', flex: 1 }}>
          <div className="label">{isNew ? 'Нова програма' : 'Редагувати'}</div>
          <div className="h-3">{name || '—'}</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div className="page stack">

        <div className="card" style={{ padding: 18 }}>
          <div className="stack" style={{ gap: 14 }}>
            <div className="stack" style={{ gap: 6 }}>
              <div className="label">Назва програми</div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Наприклад: А — Груди і трицепс"
                className="field"
                style={{ width: '100%' }}
              />
            </div>

            <div className="stack" style={{ gap: 6 }}>
              <div className="label">Група</div>
              <input
                type="text"
                value={type}
                onChange={e => setType(e.target.value)}
                placeholder="основна, легка, йога, вдома..."
                className="field"
                style={{ width: '100%' }}
              />
              {existingGroups.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {existingGroups.map(g => (
                    <button
                      key={g}
                      type="button"
                      className="pill-btn"
                      data-active={type === g ? '1' : '0'}
                      onClick={() => setType(g)}
                      style={{ fontSize: 12 }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="stack" style={{ gap: 6 }}>
              <div className="label">Колір</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: c, border: 'none', cursor: 'pointer',
                      outline: color === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 2,
                      position: 'relative',
                    }}
                  >
                    {color === c && (
                      <IconCheck size={14} style={{ color: '#fff', position: 'absolute', inset: 0, margin: 'auto' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="prog-icon" style={{ background: `${color}18` }}>
                <PIcon size={20} style={{ color }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{name.replace(/\s+—.+$/, '') || 'Назва'}</div>
                <div className="meta" style={{ marginTop: 2 }}>{name.match(/—\s*(.+)$/)?.[1] ?? 'Добірка вправ'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-head" style={{ marginBottom: 0 }}>
          <div className="label">Вправи ({exercises.length})</div>
        </div>

        {exercises.map((ex, idx) => (
          <article key={ex.exercise_id} className="card" style={{ padding: 14 }}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="card-row" style={{ alignItems: 'flex-start' }}>
                <div className="h-3" style={{ flex: 1, fontSize: 14 }}>{ex.name}</div>
                <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => removeExercise(idx)}>
                  <IconX size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {NUM_FIELDS.map(f => (
                  <div key={f.key} className="stack" style={{ gap: 4 }}>
                    <div className="meta" style={{ fontSize: 11 }}>{f.label}</div>
                    <input
                      type="number"
                      value={ex[f.key]}
                      onChange={e => updateField(idx, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="field"
                      style={{ textAlign: 'center', width: '100%', padding: '8px 4px' }}
                    />
                  </div>
                ))}
              </div>

              <div className="stack" style={{ gap: 4 }}>
                <div className="meta" style={{ fontSize: 11 }}>Фото (URL)</div>
                <input
                  type="url"
                  value={ex.photo_url}
                  onChange={e => updateField(idx, 'photo_url', e.target.value)}
                  placeholder="https://..."
                  className="field"
                  style={{ width: '100%', fontSize: 13 }}
                />
                {ex.photo_url.trim() && (
                  <img
                    src={ex.photo_url.trim()}
                    alt="preview"
                    style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', borderRadius: 10, marginTop: 4 }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                )}
              </div>

              <div className="stack" style={{ gap: 4 }}>
                <div className="meta" style={{ fontSize: 11 }}>Опис / техніка</div>
                <textarea
                  value={ex.description}
                  onChange={e => updateField(idx, 'description', e.target.value)}
                  placeholder="Як виконувати, на що звернути увагу..."
                  rows={3}
                  className="textarea-field"
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          </article>
        ))}

        <button
          type="button"
          className="program-card"
          onClick={openPicker}
          style={{ textAlign: 'left', borderStyle: 'dashed' }}
        >
          <div className="card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="prog-icon" style={{ background: 'var(--surface-2)' }}>
                <IconPlus size={20} style={{ color: 'var(--text-3)' }} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Додати вправу</div>
            </div>
          </div>
        </button>

        <div style={{ height: 80 }} />
      </div>

      <div className="finish-bar">
        {saveError && (
          <div style={{
            fontSize: 12, color: 'var(--danger)', marginBottom: 8,
            padding: '6px 10px', background: 'rgba(255,90,95,0.08)',
            borderRadius: 8, border: '1px solid rgba(255,90,95,0.2)',
          }}>
            {saveError}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Зберігаємо...' : 'Зберегти програму'}
        </button>
      </div>

      {pickerOpen && (
        <div className="sheet-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="sheet" style={{ maxHeight: '80dvh' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="stack" style={{ gap: 14 }}>
              <div className="h-3">Вибрати вправу</div>
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
                {search.trim() && !filtered.some(e => e.name.toLowerCase() === search.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="program-card"
                    style={{ textAlign: 'left', borderStyle: 'dashed', opacity: creatingNew ? 0.6 : 1 }}
                    onClick={createAndAdd}
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
                {filtered.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    className="program-card"
                    style={{ textAlign: 'left', opacity: exercises.find(e => e.exercise_id === ex.id) ? 0.4 : 1 }}
                    onClick={() => addExercise(ex)}
                  >
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{ex.name}</div>
                  </button>
                ))}
                {filtered.length === 0 && !search.trim() && (
                  <div className="meta">Введи назву для пошуку</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
