import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { TEAS } from '../config/look.ts'
import { useStore } from '../store/useStore.ts'

const FADE_MS = 600

function Loader() {
  const ready = useStore((s) => s.sceneReady)
  const progress = useProgress((s) => s.progress)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setGone(true), FADE_MS)
    return () => window.clearTimeout(id)
  }, [ready])
  if (gone) return null
  return (
    <div className="loader" data-ready={ready} role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <div className="loader-title">Tea Nook</div>
      <div className="loader-track">
        <div className="loader-bar" style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }} />
      </div>
    </div>
  )
}

/**
 * Tea name after a click. Every click moves `teaIndex` (the tea cycles through 4), so a change of `teaIndex` equals a
 * click; the first render shows nothing. The `key` restarts the CSS fade on every change.
 */
function TeaName() {
  const teaIndex = useStore((s) => s.teaIndex)
  const [seen, setSeen] = useState({ index: teaIndex, count: 0 })
  if (seen.index !== teaIndex) setSeen({ index: teaIndex, count: seen.count + 1 })
  if (seen.count === 0) return null
  return (
    <div key={seen.count} className="pill tea-name" aria-live="polite">
      {TEAS[teaIndex]?.name}
    </div>
  )
}

/** The hint fades out after the first click (the first change of `teaIndex`) and stays gone (D-137, Manuel's choice in the phase 3 review). */
function Hint() {
  const teaIndex = useStore((s) => s.teaIndex)
  const [first] = useState(teaIndex)
  const [used, setUsed] = useState(false)
  if (!used && teaIndex !== first) setUsed(true)
  return (
    <p className="pill hint" data-gone={used}>
      Drag to orbit · Click the mug to change tea
    </p>
  )
}

export function Overlay() {
  return (
    <div className="overlay">
      <h1 className="title">Tea Nook</h1>
      <TeaName />
      <Hint />
      <Loader />
    </div>
  )
}
