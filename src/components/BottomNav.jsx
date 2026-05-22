import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Тренування', icon: '🏋️' },
  { to: '/progress', label: 'Прогрес', icon: '📊' },
  { to: '/programs', label: 'Програми', icon: '⚙️' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex bottom-safe" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
              isActive ? 'text-zinc-100' : 'text-zinc-500'
            }`
          }
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
