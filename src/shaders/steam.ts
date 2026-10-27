import common from './steam.common.glsl?raw'
import fragment from './steam.frag.glsl?raw'
import vertex from './steam.vert.glsl?raw'

export const steamVertexShader = `${common}\n${vertex}`
export const steamFragmentShader = `${common}\n${fragment}`
