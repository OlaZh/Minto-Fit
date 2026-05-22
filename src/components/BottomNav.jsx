import { NavLink } from 'react-router-dom'
import { IconDumbbell, IconChart, IconLayers } from './Icons'

const tabs = [
  { to: '/', label: 'Тренування', Icon: IconDumbbell },
  { to: '/progress', label: 'Прогрес', Icon: IconChart },
  { to: '/programs', label: 'Програми', Icon: IconLayers },
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
            <tab.Icon />
            <span className="nav-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
