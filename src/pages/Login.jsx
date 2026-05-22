import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <p className="text-2xl">Перевір пошту</p>
        <p className="text-zinc-400 text-center">
          Надіслали посилання на <span className="text-zinc-200">{email}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6">
      <p className="text-3xl font-semibold tracking-tight">MintoFit</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="email"
          required
          placeholder="твій email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-base outline-none focus:border-zinc-400 placeholder:text-zinc-600"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-zinc-100 text-zinc-950 rounded-xl px-4 py-3 text-base font-medium disabled:opacity-50"
        >
          {loading ? 'Надсилаємо...' : 'Увійти'}
        </button>
      </form>
    </div>
  )
}
