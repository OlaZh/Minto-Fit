// Б2 — фігура тіла з виносками (UI вводу замірів).
// Фігура по центру; навколо — картки ЗОН, від кожної тонка лінія-виноска до
// точки (anchor) на тілі. Парні зони (рука/стегно/литка) — одна точка, але
// в картці два поля: Л / П. Розкладка у % контейнера, щоб лягала на картинку.
//
// Картинка: src/assets/body-figure.png (front view). Координати точок —
// ZONES[*].anchor; правити там, якщо точка зʼїхала.

import bodyImg from '../assets/body-figure.png'
import { BODY_FIELDS } from '../lib/bodyFields'

// Зони у порядку зверху вниз. keys — поля з bodyFields для цієї зони
// (одне для одиночних, [ліве, праве] для парних). anchor — точка на тілі (%),
// card.side — з якого боку картка, card.top — її вертикальна позиція.
const ZONES = [
  { id: 'neck',   label: 'Шия',       keys: ['neck'],                     anchor: [52, 16], card: { side: 'right',  top: '8%',  lineY: 13 } },
  { id: 'chest',  label: 'Груди',     keys: ['chest'],                    anchor: [50, 27], card: { side: 'left',   top: '8%',  lineY: 13 } },
  { id: 'arm',    label: 'Руки',      keys: ['left_arm', 'right_arm'],    anchor: [35, 32], card: { side: 'left',   top: '26%', lineY: 32 } },
  { id: 'waist',  label: 'Талія',     keys: ['waist'],                    anchor: [50, 40], card: { side: 'right',  top: '26%', lineY: 32 } },
  { id: 'hips',   label: 'Стегна',    keys: ['hips'],                     anchor: [39, 47], card: { side: 'left',   top: '44%', lineY: 49 } },
  { id: 'thigh',  label: 'Стегно',    keys: ['left_thigh', 'right_thigh'], anchor: [60, 55], card: { side: 'right', top: '44%', lineY: 49 } },
  { id: 'calf',   label: 'Литка',     keys: ['left_calf', 'right_calf'],  anchor: [41, 77], card: { side: 'left',   top: '65%', lineY: 70 } },
  { id: 'wrist',  label: "Зап'ясток", keys: ['wrist'],                    anchor: [30, 50], card: { side: 'right',  top: '65%', lineY: 70 } },
  { id: 'weight', label: 'Вага',      keys: ['weight_kg'],                anchor: [50, 95], card: { side: 'bottom', top: '84%', lineY: 84 } },
]

const fieldByKey = Object.fromEntries(BODY_FIELDS.map(f => [f.key, f]))

export default function BodyFigure({ form, onChange, activeKey, onFocusField }) {
  // Чи активна зона (підсвічуємо точку/виноску, якщо фокус на будь-якому її полі).
  const isZoneActive = zone => zone.keys.includes(activeKey)

  return (
    <div className="body-callout">
      <img src={bodyImg} alt="Фігура тіла" className="body-callout-img" draggable={false} />

      {/* Виноски */}
      <svg className="body-callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {ZONES.map(zone => {
          const [ax, ay] = zone.anchor
          const cardX = zone.card.side === 'left' ? 31.5 : zone.card.side === 'right' ? 68.5 : 50
          const cardY = zone.card.lineY ?? (parseFloat(zone.card.top) + 5)
          const active = isZoneActive(zone)
          return (
            <line
              key={zone.id}
              x1={cardX} y1={cardY} x2={ax} y2={ay}
              stroke={active ? 'var(--accent)' : 'var(--border-bright)'}
              strokeWidth={active ? 0.5 : 0.3}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      {/* Точки на тілі */}
      {ZONES.map(zone => {
        const [ax, ay] = zone.anchor
        return (
          <button
            key={`dot-${zone.id}`}
            type="button"
            className="body-callout-dot"
            data-active={isZoneActive(zone) ? '1' : '0'}
            style={{ left: `${ax}%`, top: `${ay}%` }}
            onClick={() => onFocusField?.(zone.keys[0])}
            aria-label={zone.label}
          />
        )
      })}

      {/* Картки зон */}
      {ZONES.map(zone => {
        const paired = zone.keys.length > 1
        const unit = fieldByKey[zone.keys[0]]?.unit ?? ''
        return (
          <div
            key={`card-${zone.id}`}
            className="body-callout-card"
            data-side={zone.card.side}
            data-active={isZoneActive(zone) ? '1' : '0'}
            style={{ top: zone.card.top }}
          >
            <div className="body-callout-label">
              {zone.label}<span className="body-callout-unit">{unit}</span>
            </div>
            <div className="body-callout-inputs" data-paired={paired ? '1' : '0'}>
              {zone.keys.map(key => {
                const field = fieldByKey[key]
                return (
                  <label key={key} className="body-callout-input">
                    {paired && <span className="body-callout-side">{field.side === 'left' ? 'Л' : 'П'}</span>}
                    <input
                      type="number"
                      step={field.step}
                      value={form[key] ?? ''}
                      onChange={event => onChange(key, event.target.value)}
                      onFocus={() => onFocusField?.(key)}
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
