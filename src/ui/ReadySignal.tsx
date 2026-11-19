import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useStore } from '../store/useStore.ts'

/**
 * Mount it inside the same Suspense boundary as `Nook`, after it: it only mounts once the model has loaded. It sets
 * `sceneReady` after two rendered frames, so the loader never lifts before the first image is on screen. Works in
 * production (the dev `data-nook-ready` flag is not available there).
 */
export function ReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current > 2) return
    frames.current += 1
    if (frames.current === 2) useStore.getState().setSceneReady()
  })
  return null
}
