import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Тренування', icon: '🏋️' },
  { to: '/progress', label: 'Прогрес', icon: '📊' },
  { to: '/programs', label: 'Програми', icon: '🗂️' },
]

export default function BottomNav() {
  return (
    <div className="nav">
      <nav className="nav-inner" aria-label="Основна навігація">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => `nav-btn${isActive ? ' nav-btn--active' : ''}`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
