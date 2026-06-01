import { IconDumbbell, IconLayers, IconLeaf } from './Icons'
import { getProgramIconName } from '../lib/programIcons'

const ICONS = {
  dumbbell: IconDumbbell,
  layers: IconLayers,
  leaf: IconLeaf,
}

export default function ProgramGlyph({ program, ...props }) {
  const IconComponent = ICONS[getProgramIconName(program)] ?? IconDumbbell
  return <IconComponent {...props} />
}
