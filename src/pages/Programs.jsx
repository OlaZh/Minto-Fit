import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProfileSheet from '../components/ProfileSheet'
import { IconUser, IconChevronRight, IconPlus, getProgramIcon } from '../components/Icons'

function splitPrograms(programs) {
  return {
    main: programs.filter(program => program.type === 'основна'),
    light: programs.filter(program => program.type === 'додаткова' && program.name?.toLowerCase().startsWith('легке')),
    mix: programs.filter(program => program.type === 'додаткова' && program.name?.toLowerCase().startsWith('мікс')),
  }
}

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
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
          <div className="label">{programs.length} програм</div>
          <div className="h-1">Програми</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Профіль" onClick={() => setProfileOpen(true)}><IconUser size={20} /></button>
        </div>
      </div>

      <div className="page stack" style={{ paddingTop: 20, gap: 24 }}>
        {main.length > 0 && (
          <ProgramSection title="Основні — 4 дні на тиждень" programs={main} onOpen={navigate} />
        )}
        {light.length > 0 && (
          <ProgramSection title="Легкі" programs={light} onOpen={navigate} />
        )}
        {mix.length > 0 && (
          <ProgramSection title="Міксові" programs={mix} onOpen={navigate} />
        )}

        <button
          type="button"
          className="program-card"
          onClick={() => navigate('/programs/new')}
          style={{ textAlign: 'left', borderStyle: 'dashed' }}
        >
          <div className="card-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="prog-icon" style={{ background: 'var(--surface-2)' }}>
                <IconPlus size={20} style={{ color: 'var(--text-3)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Створити нову програму</div>
                <div className="meta" style={{ marginTop: 2 }}>З нуля або з шаблону</div>
              </div>
            </div>
          </div>
        </button>
      </div>
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function ProgramSection({ title, programs, onOpen }) {
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div className="label">{title}</div>
      </div>
      {programs.map(program => (
        <ProgramRow key={program.id} program={program} onOpen={onOpen} />
      ))}
    </section>
  )
}

function ProgramRow({ program, onOpen }) {
  const PIcon = getProgramIcon(program)
  return (
    <button
      type="button"
      className="program-card"
      onClick={() => onOpen(`/programs/${program.id}`)}
      style={{
        background: `radial-gradient(80% 70% at 100% 0%, ${program.color ?? '#3f3f46'}14, transparent), var(--surface)`,
        borderColor: `${program.color ?? '#3f3f46'}40`,
        textAlign: 'left',
      }}
    >
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PIcon size={20} style={{ color: program.color ?? 'var(--text-3)', flexShrink: 0 }} />
            <div className="h-2">{trimProgramName(program.name)}</div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: program.color ?? '#71717a', flexShrink: 0 }} />
          </div>
          <div className="meta" style={{ marginTop: 4 }}>{extractProgramDescription(program.name)}</div>
        </div>
        <span className="icon-btn" style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconChevronRight size={18} />
        </span>
      </div>
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
