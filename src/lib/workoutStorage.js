function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCurrentWorkout() {
  return readJson('mf_current_workout', null)
}

export function setCurrentWorkout(workout) {
  writeJson('mf_current_workout', workout)
}

export function clearCurrentWorkout() {
  localStorage.removeItem('mf_current_workout')
}

export function getPendingFinish() {
  return readJson('mf_pending_finish', null)
}

export function setPendingFinish(finishData) {
  writeJson('mf_pending_finish', finishData)
}

export function clearPendingFinish(workoutId = null) {
  const pendingFinish = getPendingFinish()
  if (!pendingFinish) return
  if (workoutId !== null && pendingFinish.id !== workoutId) return
  localStorage.removeItem('mf_pending_finish')
}

export function getPendingSets() {
  const pendingSets = readJson('mf_pending_sets', [])
  return Array.isArray(pendingSets) ? pendingSets : []
}

export function appendPendingSet(setData) {
  const pendingSets = getPendingSets()
  const nextPendingSets = pendingSets.filter(item => item?.id !== setData?.id)
  nextPendingSets.push(setData)
  writeJson('mf_pending_sets', nextPendingSets)
}

export function getPendingSetsForWorkout(workoutId) {
  return getPendingSets().filter(setData => setData?.workout_id === workoutId)
}

export function clearPendingSetsForWorkout(workoutId) {
  if (!workoutId) return
  const remaining = getPendingSets().filter(setData => setData?.workout_id !== workoutId)
  if (remaining.length > 0) writeJson('mf_pending_sets', remaining)
  else localStorage.removeItem('mf_pending_sets')
}

export async function syncPendingSetsForWorkout(supabase, workoutId) {
  const pendingSets = getPendingSetsForWorkout(workoutId)
  if (!workoutId || pendingSets.length === 0) {
    return { ok: true, syncedCount: 0 }
  }

  const { error } = await supabase
    .from('mf_workout_sets')
    .upsert(pendingSets, { onConflict: 'id', ignoreDuplicates: true })
  if (error) {
    return { ok: false, error, syncedCount: 0 }
  }

  clearPendingSetsForWorkout(workoutId)
  return { ok: true, syncedCount: pendingSets.length }
}
