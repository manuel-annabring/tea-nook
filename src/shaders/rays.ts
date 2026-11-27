import common from './rays.common.glsl?raw'
import fragment from './rays.frag.glsl?raw'
import vertex from './rays.vert.glsl?raw'

export const raysVertexShader = vertex
export const raysFragmentShader = `${common}\n${fragment}`
