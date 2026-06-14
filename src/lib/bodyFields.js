// Єдине джерело правди для полів замірів тіла (mf_body_stats).
// Лейбли — за референсами користувача. НЕ дублювати цей список в інших файлах:
// імпортувати звідси, щоб набір ніколи не розʼїжджався.
//
// group — для майбутньої фігури тіла (Б2/Б3): поля з одним group можна
// показувати разом / підсвічувати ту саму зону.

export const BODY_FIELDS = [
  { key: 'weight_kg',   label: 'Вага',         short: 'Вага',     unit: 'кг', step: 0.1, group: 'weight' },
  { key: 'neck',        label: 'Шия',          short: 'Шия',      unit: 'см', step: 0.5, group: 'neck' },
  { key: 'chest',       label: 'Груди',        short: 'Груди',    unit: 'см', step: 0.5, group: 'chest' },
  { key: 'waist',       label: 'Талія',        short: 'Талія',    unit: 'см', step: 0.5, group: 'waist' },
  { key: 'hips',        label: 'Стегна',       short: 'Стегна',   unit: 'см', step: 0.5, group: 'hips' },
  { key: 'left_arm',    label: 'Рука ліва',    short: 'Рука',     unit: 'см', step: 0.5, group: 'arm', side: 'left' },
  { key: 'right_arm',   label: 'Рука права',   short: 'Рука',     unit: 'см', step: 0.5, group: 'arm', side: 'right' },
  { key: 'left_thigh',  label: 'Ліве стегно',  short: 'Стегно',   unit: 'см', step: 0.5, group: 'thigh', side: 'left' },
  { key: 'right_thigh', label: 'Праве стегно', short: 'Стегно',   unit: 'см', step: 0.5, group: 'thigh', side: 'right' },
  { key: 'left_calf',   label: 'Литка ліва',   short: 'Литка',    unit: 'см', step: 0.5, group: 'calf', side: 'left' },
  { key: 'right_calf',  label: 'Литка права',  short: 'Литка',    unit: 'см', step: 0.5, group: 'calf', side: 'right' },
  { key: 'wrist',       label: "Зап'ясток",    short: "Зап'ясток", unit: 'см', step: 0.1, group: 'wrist' },
]

// Поля для графіків/пілсів: вага + по одному репрезентативному обхвату на зону
// (щоб не дублювати ліво/право в перемикачі). Ліву сторону беремо як основну.
// icon — ключ іконки частини тіла (мапінг ключ→компонент у Progress.jsx).
export const CHART_FIELDS = [
  { key: 'weight_kg',  label: 'Вага',   icon: 'weight' },
  { key: 'chest',      label: 'Груди',  icon: 'chest' },
  { key: 'waist',      label: 'Талія',  icon: 'waist' },
  { key: 'hips',       label: 'Стегна', icon: 'glutes' },
  { key: 'left_thigh', label: 'Стегно', icon: 'thigh' },
  { key: 'neck',       label: 'Шия',    icon: 'neck' },
  { key: 'left_arm',   label: 'Біцепс', icon: 'biceps' },
  { key: 'left_calf',  label: 'Литка',  icon: 'calf' },
]

export const bodyFieldByKey = Object.fromEntries(BODY_FIELDS.map(f => [f.key, f]))
