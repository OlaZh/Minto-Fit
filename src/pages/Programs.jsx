import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProfileSheet from '../components/ProfileSheet'
import { IconUser, IconChevronRight, IconPlus } from '../components/Icons'
import ProgramGlyph from '../components/ProgramGlyph'

function resolveGroup(program) {
  const t = program.type ?? 'інше'
  // backwards-compat: split legacy 'додаткова' by name prefix
  if (t === 'додаткова') {
    const n = program.name?.toLowerCase() ?? ''
    if (n.startsWith('легке') || n.startsWith('легк')) return 'легка'
    if (n.startsWith('мікс')) return 'мікс'
    return 'додаткова'
  }
  return t
}

function groupPrograms(programs) {
  const ORDER = ['основна', 'легка', 'мікс', 'додаткова']
  const map = {}
  programs.forEach(p => {
    const key = resolveGroup(p)
    if (!map[key]) map[key] = []
    map[key].push(p)
  })
  const sorted = {}
  ;[...ORDER, ...Object.keys(map).filter(k => !ORDER.includes(k))]
    .filter(k => map[k])
    .forEach(k => { sorted[k] = map[k] })
  return sorted
}

const GROUP_META = {
  'основна':   { label: 'Основні',    color: '#3b82f6' },
  'легка':     { label: 'Легкі',      color: '#22c55e' },
  'мікс':      { label: 'Міксові',    color: '#f97316' },
  'додаткова': { label: 'Додаткові',  color: '#8b5cf6' },
}

function groupMeta(key) {
  return GROUP_META[key] ?? { label: key, color: '#3b82f6' }
}

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('mf_programs')
      .select('*')
      .order('type')
      .order('name')
      .then(({ data }) => {
        const list = data ?? []
        setPrograms(list)
        setCollapsed(new Set(Object.keys(groupPrograms(list))))
        setLoading(false)
      })
  }, [])

  function toggleGroup(key) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="page page-top meta">Завантаження...</div>
      </div>
    )
  }

  const groups = groupPrograms(programs)
  const groupKeys = Object.keys(groups)

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">
          <div className="label">{programs.length} програм</div>
          <div className="h-1">Програми</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Профіль" onClick={() => setProfileOpen(true)}>
            <IconUser size={20} />
          </button>
        </div>
      </div>

      <div className="page stack">
        {groupKeys.map(key => {
          const isCollapsed = collapsed.has(key)
          const list = groups[key]
          const { label, color } = groupMeta(key)
          return (
            <section key={key} className="stack" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: `radial-gradient(120% 100% at 100% 0%, ${color}22, transparent 65%), var(--surface)`,
                  border: `1px solid ${color}45`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  padding: '14px 18px',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    background: `${color}22`,
                    border: `1px solid ${color}40`,
                    borderRadius: 20,
                    padding: '2px 8px',
                    color,
                  }}>
                    {list.length}
                  </span>
                </div>
                <span style={{
                  color, fontSize: 16,
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  display: 'inline-block',
                }}>∨</span>
              </button>

              {!isCollapsed && list.map(program => (
                <ProgramRow key={program.id} program={program} onOpen={navigate} />
              ))}
            </section>
          )
        })}

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

function ProgramRow({ program, onOpen }) {
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <ProgramGlyph program={program} size={20} style={{ color: program.color ?? 'var(--text-3)', flexShrink: 0, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-2">{trimProgramName(program.name)}</div>
            <div className="meta" style={{ marginTop: 3 }}>{extractProgramDescription(program.name)}</div>
          </div>
        </div>
        <span className="icon-btn" style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
