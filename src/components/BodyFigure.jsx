// Б2 — фігура тіла з виносками (основний UI вводу замірів).
// Фігура по центру; навколо — картки полів, від кожної тонка лінія-виноска
// до точки (anchor) на тілі. Розкладка — у відсотках контейнера, щоб лягала
// на фонову картинку незалежно від її розміру.
//
// Картинку клади у public/body-figure.png (front view). Поки файлу немає —
// показуємо градієнтний placeholder, розкладка від цього не залежить.

import bodyImg from '../assets/body-figure.png'

// Кожне поле: де його anchor-точка на тілі (% від ширини/висоти контейнера),
// з якого боку картка (left/right/bottom) і вертикальна позиція картки.
// side впливає на те, з якого краю картки виходить виноска.
const FIELD_LAYOUT = {
  chest:      { anchor: [50, 27], card: { side: 'left',   top: '8%'  } },
  neck:       { anchor: [52, 16], card: { side: 'right',  top: '8%'  } },
  left_arm:   { anchor: [35, 32], card: { side: 'left',   top: '27%' } },
  waist:      { anchor: [50, 40], card: { side: 'right',  top: '27%' } },
  hips:       { anchor: [39, 47], card: { side: 'left',   top: '46%' } },
  right_thigh:{ anchor: [60, 55], card: { side: 'right',  top: '46%' } },
  left_calf:  { anchor: [41, 77], card: { side: 'left',   top: '66%' } },
  weight_kg:  { anchor: [50, 95], card: { side: 'bottom', top: '86%' } },
}

export default function BodyFigure({ form, onChange, fields, activeKey, onFocusField }) {
  // Лишаємо тільки поля, для яких є позиція в розкладці (по одному на зону).
  const placed = fields.filter(field => FIELD_LAYOUT[field.key])

  return (
    <div className="body-callout">
      <img src={bodyImg} alt="Фігура тіла" className="body-callout-img" draggable={false} />

      {/* Виноски (SVG поверх усього контейнера, у % координатах) */}
      <svg className="body-callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {placed.map(field => {
          const { anchor, card } = FIELD_LAYOUT[field.key]
          const [ax, ay] = anchor
          // Точка приєднання виноски — внутрішній край картки.
          // Картки 38% завширшки притиснуті до краю; +2% на середину рядка.
          const cardX = card.side === 'left' ? 38 : card.side === 'right' ? 62 : 50
          const cardY = parseFloat(card.top) + 6 // приблизно центр картки по висоті
          const isActive = activeKey === field.key
          return (
            <line
              key={field.key}
              x1={cardX} y1={cardY} x2={ax} y2={ay}
              stroke={isActive ? 'var(--accent)' : 'var(--border-bright)'}
              strokeWidth={isActive ? 0.5 : 0.3}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      {/* Anchor-точки на тілі */}
      {placed.map(field => {
        const [ax, ay] = FIELD_LAYOUT[field.key].anchor
        const isActive = activeKey === field.key
        return (
          <button
            key={`dot-${field.key}`}
            type="button"
            className="body-callout-dot"
            data-active={isActive ? '1' : '0'}
            style={{ left: `${ax}%`, top: `${ay}%` }}
            onClick={() => onFocusField?.(field.key)}
            aria-label={field.label}
          />
        )
      })}

      {/* Картки полів */}
      {placed.map(field => {
        const { card } = FIELD_LAYOUT[field.key]
        const isActive = activeKey === field.key
        return (
          <div
            key={`card-${field.key}`}
            className="body-callout-card"
            data-side={card.side}
            data-active={isActive ? '1' : '0'}
            style={{ top: card.top }}
          >
            <div className="body-callout-label">{field.label}</div>
            <div className="body-callout-input">
              <input
                type="number"
                step={field.step}
                value={form[field.key] ?? ''}
                onChange={event => onChange(field.key, event.target.value)}
                onFocus={() => onFocusField?.(field.key)}
                placeholder="0.0"
                inputMode="decimal"
              />
              <span>{field.unit}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
