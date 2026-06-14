import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      console.error('handleGoogle:', error)
      setError('Не вдалося почати вхід через Google. Спробуй ще раз.')
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="stack" style={{ gap: 24 }}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="label">MintoFit</div>
            <div className="h-1">Вхід у застосунок</div>
            <div className="meta">
              Увійди через Google — застосунок тебе запам'ятає.
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,90,95,0.1)',
              border: '1px solid rgba(255,90,95,0.25)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="btn btn-ghost btn-block"
            style={{ gap: 12, opacity: loading ? 0.7 : 1 }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <path d="M43.6 20.5H42V20.5H24V27.5H35.3C33.7 32 29.3 35 24 35C17.4 35 12 29.6 12 23C12 16.4 17.4 11 24 11C27 11 29.8 12.1 31.9 14L37 8.9C33.5 5.7 29 3.5 24 3.5C13.5 3.5 5 12 5 22.5C5 33 13.5 41.5 24 41.5C34.5 41.5 43 33 43 22.5C43 21.8 42.9 21.1 43.6 20.5Z" fill="#FFC107"/>
              <path d="M6.3 14.7L12.3 19.1C14.1 14.7 18.7 11 24 11C27 11 29.8 12.1 31.9 14L37 8.9C33.5 5.7 29 3.5 24 3.5C16.3 3.5 9.7 8.2 6.3 14.7Z" fill="#FF3D00"/>
              <path d="M24 41.5C28.9 41.5 33.3 39.4 36.8 36.1L31.2 31.4C29.2 32.9 26.7 33.8 24 33.8C18.8 33.8 14.4 30.8 12.7 26.4L6.7 31C10 37.6 16.5 41.5 24 41.5Z" fill="#4CAF50"/>
              <path d="M43.6 20.5H42V20.5H24V27.5H35.3C34.5 29.8 33 31.7 31.2 33L31.2 33L36.8 37.7C36.4 38.1 43 33 43 22.5C43 21.8 42.9 21.1 43.6 20.5Z" fill="#1976D2"/>
            </svg>
            {loading ? 'Переходимо...' : 'Увійти через Google'}
          </button>
        </div>
      </div>
    </div>
  )
}
