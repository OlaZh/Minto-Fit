import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Workout from './pages/Workout'
import Progress from './pages/Progress'
import Programs from './pages/Programs'
import ProgramDetail from './pages/ProgramDetail'
import ActiveWorkout from './pages/ActiveWorkout'
import BodyStats from './pages/BodyStats'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div className="pb-20" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Workout />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/:id" element={<ProgramDetail />} />
          <Route path="/workout/:programId" element={<ActiveWorkout />} />
          <Route path="/progress/body" element={<BodyStats />} />
        </Routes>
      </div>
      <BottomNav />
    </BrowserRouter>
  )
}
