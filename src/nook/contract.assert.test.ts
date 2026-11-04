import { Group, Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { assertContract, REQUIRED_NODE_NAMES } from './contract.ts'

function stubScene(skip?: string): Group {
  const root = new Group()
  for (const name of REQUIRED_NODE_NAMES) {
    if (name === skip) continue
    const node = new Object3D()
    node.name = name
    root.add(node)
  }
  return root
}

describe('assertContract', () => {
  it('does not throw for a complete graph', () => {
    expect(() => assertContract(stubScene())).not.toThrow()
  })

  it('throws an error naming the missing node', () => {
    expect(() => assertContract(stubScene('Steam_Kettle'))).toThrow(/Steam_Kettle/)
  })
})
