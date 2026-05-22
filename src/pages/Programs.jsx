import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) =>
      console.log('current user id:', u?.user?.id)
    )
    supabase
      .from('mf_programs')
      .select('*')
      .order('type')
      .then(({ data, error }) => {
        console.log('programs data:', data, 'error:', error)
        setPrograms(data ?? [])
        setLoading(false)
      })
  }, [])

  const main = programs.filter(p => p.type === 'основна')
  const extra = programs.filter(p => p.type === 'додаткова')

  if (loading) return <div className="p-6 text-zinc-500">Завантаження...</div>

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Програми</h1>
        <button className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 text-lg">
          👤
        </button>
      </div>

      {programs.length === 0 && (
        <p className="text-zinc-500 text-sm">Програм ще немає</p>
      )}

      {main.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Основні</p>
          <div className="space-y-2">
            {main.map(p => (
              <ProgramCard key={p.id} program={p} onClick={() => navigate(`/programs/${p.id}`)} />
            ))}
          </div>
        </section>
      )}

      {extra.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Додаткові</p>
          <div className="space-y-2">
            {extra.map(p => (
              <ProgramCard key={p.id} program={p} onClick={() => navigate(`/programs/${p.id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ProgramCard({ program, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-zinc-900 rounded-2xl px-4 py-4 text-left active:scale-[0.98] transition-transform"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
        style={{ backgroundColor: program.color ?? '#27272a' }}
      >
        {program.emoji ?? '💪'}
      </div>
      <div>
        <p className="font-medium text-zinc-100">{program.name}</p>
      </div>
      <span className="ml-auto text-zinc-600 text-lg">›</span>
    </button>
  )
}
