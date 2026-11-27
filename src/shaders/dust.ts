import fragment from './dust.frag.glsl?raw'
import vertex from './dust.vert.glsl?raw'
import beamCurves from './rays.common.glsl?raw'

export const dustVertexShader = `${beamCurves}\n${vertex}`
export const dustFragmentShader = fragment
