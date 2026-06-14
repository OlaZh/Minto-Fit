// Єдине джерело правди для полів замірів тіла (mf_body_stats).
// Лейбли — за референсами користувача. НЕ дублювати цей список в інших файлах:
// імпортувати звідси, щоб набір ніколи не розʼїжджався.
//
// group — для майбутньої фігури тіла (Б2/Б3): поля з одним group можна
// показувати разом / підсвічувати ту саму зону.

export const BODY_FIELDS = [
  { key: 'weight_kg',   label: 'Вага',          short: 'Вага',    unit: 'кг', step: 0.1, group: 'weight' },
  { key: 'neck',        label: 'Шия',           short: 'Шия',     unit: 'см', step: 0.5, group: 'neck' },
  { key: 'chest',       label: 'Груди',         short: 'Груди',   unit: 'см', step: 0.5, group: 'chest' },
  { key: 'waist',       label: 'Живіт',         short: 'Живіт',   unit: 'см', step: 0.5, group: 'waist' },
  { key: 'hips',        label: 'Сідниці',       short: 'Сідниці', unit: 'см', step: 0.5, group: 'hips' },
  { key: 'left_arm',    label: 'Біцепс лівий',  short: 'Біцепс',  unit: 'см', step: 0.5, group: 'arm', side: 'left' },
  { key: 'right_arm',   label: 'Біцепс правий', short: 'Біцепс',  unit: 'см', step: 0.5, group: 'arm', side: 'right' },
  { key: 'left_thigh',  label: 'Стегно ліве',   short: 'Стегно',  unit: 'см', step: 0.5, group: 'thigh', side: 'left' },
  { key: 'right_thigh', label: 'Стегно праве',  short: 'Стегно',  unit: 'см', step: 0.5, group: 'thigh', side: 'right' },
  { key: 'left_calf',   label: 'Гомілка ліва',  short: 'Гомілка', unit: 'см', step: 0.5, group: 'calf', side: 'left' },
  { key: 'right_calf',  label: 'Гомілка права', short: 'Гомілка', unit: 'см', step: 0.5, group: 'calf', side: 'right' },
  { key: 'wrist',       label: 'Запʼясток',     short: 'Запʼясток', unit: 'см', step: 0.1, group: 'wrist' },
]

// Поля для графіків/пілсів: вага + по одному репрезентативному обхвату на зону
// (щоб не дублювати ліво/право в перемикачі). Ліву сторону беремо як основну.
export const CHART_FIELDS = [
  { key: 'weight_kg',  label: 'Вага' },
  { key: 'neck',       label: 'Шия' },
  { key: 'chest',      label: 'Груди' },
  { key: 'waist',      label: 'Живіт' },
  { key: 'hips',       label: 'Сідниці' },
  { key: 'left_arm',   label: 'Біцепс' },
  { key: 'left_thigh', label: 'Стегно' },
  { key: 'left_calf',  label: 'Гомілка' },
]

export const bodyFieldByKey = Object.fromEntries(BODY_FIELDS.map(f => [f.key, f]))
