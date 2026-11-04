import { Leva } from 'leva'

/** Dev-only: owns the Leva panel's visibility. `?panel=0` hides it. */
export default function DevPanel() {
  const hidden = new URLSearchParams(window.location.search).get('panel') === '0'
  return <Leva hidden={hidden} />
}
