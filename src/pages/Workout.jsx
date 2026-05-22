import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function formatToday() {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date())
}

function splitPrograms(programs) {
  const main = []
  const light = []
  const mix = []

  programs.forEach(program => {
    if (program.type === 'основна') {
      main.push(program)
      return
    }

    if (program.name?.toLowerCase().startsWith('легке')) {
      light.push(program)
      return
    }

    if (program.name?.toLowerCase().startsWith('мікс')) {
      mix.push(program)
      return
    }

    light.push(program)
  })

  return { main, light, mix }
}

export default function Workout() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('mf_programs')
      .select('*')
      .order('type')
      .then(({ data }) => {
        setPrograms(data ?? [])
        setLoading(false)
      })
  }, [])

  const { main, light, mix } = splitPrograms(programs)

  if (loading) {
    return (
      <div className="screen">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <div className="label">{formatToday()}</div>
          <div className="h-1">Тренування</div>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" type="button" aria-label="Календар">🗓️</button>
        </div>
      </div>

      <div className="page stack" style={{ paddingTop: 6, gap: 20 }}>
        {!programs.length && (
          <div className="card">
            <div className="h-3">Програм ще немає</div>
            <div className="meta" style={{ marginTop: 6 }}>
              Додай програми у вкладці «Програми», і тут зʼявиться красивий список.
            </div>
          </div>
        )}

        {main.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <div className="section-head" style={{ marginBottom: 2 }}>
              <div className="label">Основні</div>
              <span className="meta num">{main.length} дні / тиждень</span>
            </div>
            {main.map(program => (
              <ProgramCard
                key={program.id}
                program={program}
                onClick={() => navigate(`/workout/${program.id}`)}
              />
            ))}
          </section>
        )}

        {(light.length > 0 || mix.length > 0) && <div className="prog-divider" />}

        {light.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <div className="section-head" style={{ marginBottom: 2 }}>
              <div className="label">Легкі</div>
              <span className="meta" style={{ fontSize: 11 }}>коли немає сил</span>
            </div>
            {light.map(program => (
              <ProgramCard
                key={program.id}
                program={program}
                onClick={() => navigate(`/workout/${program.id}`)}
              />
            ))}
          </section>
        )}

        {mix.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <div className="section-head" style={{ marginBottom: 2 }}>
              <div className="label">Міксові</div>
              <span className="meta" style={{ fontSize: 11 }}>різноманіття</span>
            </div>
            <div className="program-grid">
              {mix.map(program => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  compact
                  onClick={() => navigate(`/workout/${program.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ProgramCard({ program, onClick, compact = false }) {
  const description = program.description ?? extractProgramDescription(program.name)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`prog-select-card${compact ? ' prog-select-card--compact' : ''}`}
    >
      {compact ? (
        <>
          <span style={{ fontSize: 22 }}>{program.emoji ?? '✨'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{trimProgramName(program.name)}</div>
            <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{description}</div>
          </div>
        </>
      ) : (
        <>
          <div
            className="prog-icon"
            style={{ background: `${program.color ?? '#3f3f46'}18` }}
          >
            <span>{program.emoji ?? '💪'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{trimProgramName(program.name)}</span>
              <span className="chip-dot" style={{ background: program.color ?? '#71717a' }} />
            </div>
            <div className="meta" style={{ marginTop: 2 }}>{description}</div>
          </div>
          <span style={{ color: 'var(--text-3)', fontSize: 18 }}>›</span>
        </>
      )}
    </button>
  )
}

function trimProgramName(name = '') {
  return name.replace(/\s+—.+$/, '')
}

function extractProgramDescription(name = '') {
  const match = name.match(/—\s*(.+)$/)
  return match?.[1] ?? 'Персональна добірка вправ'
}
