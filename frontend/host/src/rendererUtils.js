export const OBSTACLE_STYLES = {
  BUG: { color: 0xf85149, label: 'BUG' },
  MERGE_CONFLICT: { color: 0xd29922, label: 'CONFLICT' },
  SCOPE_CREEP: { color: 0xa371f7, label: 'SCOPE' },
  SLACK_NOTIFICATION: { color: 0x1f6feb, label: 'SLACK' },
  ESPRESSO_SHOT: { color: 0x3fb950, label: 'ESPRESSO' },
}

export const FALLBACK_STYLE = { color: 0x8b949e, label: '?' }
export const styleFor = (type) => OBSTACLE_STYLES[type] ?? FALLBACK_STYLE

export function disposeObject(root) {
  root.traverse((node) => {
    if (node.geometry && !node.geometry.userData.shared) node.geometry.dispose()
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    materials.forEach((material) => material?.dispose())
  })
}
