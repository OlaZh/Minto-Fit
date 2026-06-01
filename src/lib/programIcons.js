export function getProgramIconName(program) {
  const name = (program?.name ?? '').toLowerCase()

  if (name.startsWith('мікс')) return 'layers'
  if (name.startsWith('легке')) return 'leaf'

  return 'dumbbell'
}
