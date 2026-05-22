import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="stack" style={{ gap: 20 }}>
          <div>
            <div className="label">MintoFit</div>
            <div className="h-1" style={{ marginTop: 8 }}>
              {sent ? 'Перевір пошту' : 'Вхід у застосунок'}
            </div>
            <div className="meta" style={{ marginTop: 8 }}>
              {sent
                ? <>Надіслали посилання на <span style={{ color: 'var(--text)' }}>{email}</span></>
                : 'Увійди через email, щоб синхронізувати тренування та прогрес.'}
            </div>
          </div>

          {!sent && (
            <form onSubmit={handleSubmit} className="stack">
              <input
                type="email"
                required
                placeholder="твій email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="field"
                style={{ minHeight: 52 }}
              />
              <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Надсилаємо...' : 'Увійти'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
