import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Workout from './pages/Workout'
import Progress from './pages/Progress'
import Programs from './pages/Programs'
import ProgramDetail from './pages/ProgramDetail'
import ProgramEdit from './pages/ProgramEdit'
import ActiveWorkout from './pages/ActiveWorkout'
import BodyStats from './pages/BodyStats'

function AppRoutes() {
  const location = useLocation()
  const hideNav =
    location.pathname.startsWith('/workout/') ||
    location.pathname.startsWith('/programs/') ||
    location.pathname === '/progress/body'

  return (
    <div className="stage">
      <div className="app-shell">
        <div className="route-frame">
          <Routes>
            <Route path="/" element={<Workout />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/programs/new" element={<ProgramEdit />} />
            <Route path="/programs/:id" element={<ProgramDetail />} />
            <Route path="/programs/:id/edit" element={<ProgramEdit />} />
            <Route path="/workout/:programId" element={<ActiveWorkout />} />
            <Route path="/progress/body" element={<BodyStats />} />
          </Routes>
        </div>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  )
}

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
      <AppRoutes />
    </BrowserRouter>
  )
}
