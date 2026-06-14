const Icon = ({ size = 22, sw = 1.6, children, className, style }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const IconDumbbell = (p) => (
  <Icon {...p}>
    <path d="M3 12h2M19 12h2M6 8v8M18 8v8M9 6.5v11M15 6.5v11M9 12h6" />
  </Icon>
)

export const IconChart = (p) => (
  <Icon {...p}>
    <path d="M4 19h16" />
    <path d="M7 16V11" />
    <path d="M12 16V7" />
    <path d="M17 16v-3" />
  </Icon>
)

export const IconLayers = (p) => (
  <Icon {...p}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 18l9 5 9-5" />
  </Icon>
)

export const IconPlay = (p) => (
  <Icon {...p} sw={1.8}>
    <path d="M7 5v14l12-7-12-7Z" fill="currentColor" />
  </Icon>
)

export const IconPlus = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconCheck = (p) => (
  <Icon {...p} sw={2.2}>
    <path d="M5 12.5 10 17.5 19 7" />
  </Icon>
)

export const IconFlame = (p) => (
  <Icon {...p}>
    <path d="M12 3c1.5 3 4 4.5 4 8a4 4 0 1 1-8 0c0-1.5.5-2 1.5-3C10 6.5 11 5 12 3Z" />
  </Icon>
)

export const IconChevronRight = (p) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
)

export const IconX = (p) => (
  <Icon {...p} sw={1.8}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconMore = (p) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </Icon>
)

export const IconTrophy = (p) => (
  <Icon {...p}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </Icon>
)

export const IconArrowLeft = (p) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const IconRotate = (p) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
)

export const IconTired = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="7.4" y1="10.5" x2="10.2" y2="10.5" />
    <line x1="13.8" y1="10.5" x2="16.6" y2="10.5" />
    <path d="M8.5 17c1-1.5 2-2 3.5-2s2.5.5 3.5 2" />
    <path d="M18.6 5c-1 1.4-1.5 2.3-1.5 2.9 0 .8.7 1.4 1.5 1.4s1.5-.6 1.5-1.4c0-.6-.5-1.5-1.5-2.9Z" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconFlex = (p) => (
  <Icon {...p}>
    <path d="M4 21V9a2 2 0 0 1 2-2h2" />
    <path d="M4 9c5 0 8 1 11 5" />
    <path d="M4 14h8" />
    <path d="M15 14V7" />
    <circle cx="15" cy="4.5" r="2.2" />
  </Icon>
)

export const IconLeaf = (p) => (
  <Icon {...p}>
    <path d="M20 4c-2.5 0-8 1-11 4S5 17 5 19c2 0 8-1 11-4s4-8.5 4-11Z" />
    <path d="M5 19l9-9" />
  </Icon>
)

export const IconBell = (p) => (
  <Icon {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
    <path d="M10 19.5a2 2 0 0 0 4 0" />
  </Icon>
)

export const IconVibration = (p) => (
  <Icon {...p}>
    <rect x="9" y="4" width="6" height="16" rx="1.5" />
    <line x1="11" y1="6.5" x2="13" y2="6.5" />
    <path d="M6 9.5c-.8 1-.8 3.5 0 5" />
    <path d="M18 9.5c.8 1 .8 3.5 0 5" />
    <path d="M3.5 7.5c-1.5 2-1.5 7 0 9" />
    <path d="M20.5 7.5c1.5 2 1.5 7 0 9" />
  </Icon>
)

export const IconBrightness = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <line x1="12" y1="2.5" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="21.5" y2="12" />
    <line x1="5.3" y1="5.3" x2="7.1" y2="7.1" />
    <line x1="16.9" y1="16.9" x2="18.7" y2="18.7" />
    <line x1="5.3" y1="18.7" x2="7.1" y2="16.9" />
    <line x1="16.9" y1="7.1" x2="18.7" y2="5.3" />
  </Icon>
)

export const IconStopwatch = (p) => (
  <Icon {...p}>
    <line x1="10" y1="2.5" x2="14" y2="2.5" />
    <line x1="12" y1="2.5" x2="12" y2="4.5" />
    <line x1="18.5" y1="5.5" x2="20" y2="4" />
    <circle cx="12" cy="14" r="8" />
    <path d="M12 14V9" />
    <path d="M12 14l3-1.5" />
  </Icon>
)

export const IconUser = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </Icon>
)

export const IconCamera = (p) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <circle cx="12" cy="13.5" r="3.5" />
    <path d="M8 7l1.5-3h5L16 7" />
  </Icon>
)

export const IconNote = (p) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icon>
)

// ── Іконки частин тіла для пілсів-перемикачів графіка замірів ──

export const IconBodyWeight = (p) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 12l2-2.5" />
  </Icon>
)

export const IconBodyChest = (p) => (
  <Icon {...p}>
    <path d="M4 9c0-2 1.5-3 3.5-3 1.8 0 3 1.2 4.5 2 1.5-.8 2.7-2 4.5-2 2 0 3.5 1 3.5 3 0 3-2.5 5-4.5 5-1.6 0-2.5-1-3.5-2-1 1-1.9 2-3.5 2C6.5 14 4 12 4 9Z" />
    <path d="M8 11v.5M16 11v.5" />
  </Icon>
)

export const IconBodyWaist = (p) => (
  <Icon {...p}>
    <path d="M9 4c0 1.5-.5 2.5-1.5 3.5M15 4c0 1.5.5 2.5 1.5 3.5" />
    <path d="M9 4h6M9 20h6" />
    <path d="M8 8c1 1 1.5 2.5 1.5 4S9 14.5 8 16M16 8c-1 1-1.5 2.5-1.5 4s.5 3 1.5 4" />
    <path d="M8 16c0 2 .5 3 1 4M16 16c0 2-.5 3-1 4" />
    <path d="M12 9v6" />
  </Icon>
)

export const IconBodyThigh = (p) => (
  <Icon {...p}>
    <path d="M9 3c0 3 .5 5 1 7s1 4 .5 7.5" />
    <path d="M15 3c0 3-.5 5-1 7s-1 4-.5 7.5" />
    <path d="M9 3h6" />
    <path d="M10.5 17.5h3" />
  </Icon>
)

export const IconBodyNeck = (p) => (
  <Icon {...p}>
    <path d="M8 4c0 2.5 1 4 4 4s4-1.5 4-4" />
    <path d="M9 8c-.5 1.5-2 2.5-4 3M15 8c.5 1.5 2 2.5 4 3" />
    <path d="M5 11c2 .5 4 1 7 1s5-.5 7-1" />
    <path d="M12 12v7" />
  </Icon>
)

export const IconBodyGlutes = (p) => (
  <Icon {...p}>
    <path d="M12 4v9" />
    <path d="M12 13c-1.5-2-3.5-3-5-3-1.8 0-2.5 1.3-2.5 3 0 2.2 1.5 4 4 4 1.8 0 3-1.2 3.5-2.5" />
    <path d="M12 13c1.5-2 3.5-3 5-3 1.8 0 2.5 1.3 2.5 3 0 2.2-1.5 4-4 4-1.8 0-3-1.2-3.5-2.5" />
  </Icon>
)

export const IconBodyBiceps = (p) => (
  <Icon {...p}>
    <path d="M5 20V9a2.5 2.5 0 0 1 2.5-2.5H9" />
    <path d="M5 10c4.5 0 8 1.5 10.5 5" />
    <path d="M5 15h7.5" />
    <path d="M15.5 15V7.5" />
    <circle cx="15.5" cy="4.5" r="2.2" />
  </Icon>
)

export const IconBodyCalf = (p) => (
  <Icon {...p}>
    <path d="M10 3c-.5 3 0 5 1 7 1.5 3 1.5 5 1 7.5" />
    <path d="M10 6c2 .5 3.5 2 4 4.5.4 2-.5 3.5-2 4.5" />
    <path d="M11 18l-.5 3M12 18l1.5 3" />
  </Icon>
)
