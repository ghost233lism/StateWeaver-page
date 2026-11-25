import { overlaps, placeAround, type Bounds, type Point } from './canvasGeometry'

type Frame = { id: string; anchor: Bounds; width: number; height: number }
type Constraint = { from: string; to: string; axis: 'x' | 'y'; gap: number }

/** Reflow from the compact layout, never from a previous expanded rendering.
 * Local separation constraints push only overlapping neighbours forward. A
 * distant node doesn't move merely because it shares a packed row/component. */
export function reflowExpandedFrames(frames: Frame[], fixed: Bounds[], gap = 64): Map<string, Point> {
  const sorted = [...frames].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x || a.id.localeCompare(b.id))
  const byId = new Map(frames.map((frame) => [frame.id, frame]))
  const positions = new Map(frames.map((frame) => [frame.id, { x: frame.anchor.x, y: frame.anchor.y }]))
  const constraints = new Map<string, Constraint>()
  const bounds = (frame: Frame): Bounds => ({ ...positions.get(frame.id)!, width: frame.width, height: frame.height })
  const separation = (a: Frame, b: Frame, axis: 'x' | 'y'): Constraint | undefined => {
    const size = axis === 'x' ? 'width' : 'height'
    const [from, to] = a.anchor[axis] <= b.anchor[axis] ? [a, b] : [b, a]
    const distance = to.anchor[axis] - from.anchor[axis] - from.anchor[size]
    if (distance < 0) return
    return { from: from.id, to: to.id, axis, gap: Math.max(gap, Math.min(96, distance)) }
  }
  const add = (value: Constraint) => constraints.set(`${value.axis}:${value.from}:${value.to}`, value)
  // Retain the orientation of compact neighbours. Large unrelated gaps remain
  // available for expansion instead of forcing an entire row to translate.
  for (let i = 0; i < sorted.length; i++) for (const b of sorted.slice(i + 1)) {
    const a = sorted[i], horizontal = separation(a, b, 'x'), vertical = separation(a, b, 'y')
    if (horizontal && !vertical) add(horizontal)
    if (vertical && !horizontal) add(vertical)
  }
  const displacement = ({ from, to, axis, gap: space }: Constraint) => {
    const frame = byId.get(from)!
    return positions.get(from)![axis] + (axis === 'x' ? frame.width : frame.height) + space - positions.get(to)![axis]
  }
  for (let pass = 0; pass <= frames.length * 2; pass++) {
    let changed = false
    for (const constraint of constraints.values()) {
      const delta = displacement(constraint)
      if (delta > 0) { positions.get(constraint.to)![constraint.axis] += delta; changed = true }
    }
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      const clear = placeAround(bounds(a), fixed, gap)
      if (clear.x !== positions.get(a.id)!.x || clear.y !== positions.get(a.id)!.y) { positions.set(a.id, clear); changed = true }
      for (const b of sorted.slice(i + 1)) {
        if (!overlaps(bounds(a), bounds(b), gap)) continue
        const choices = [separation(a, b, 'x'), separation(a, b, 'y')].filter((value): value is Constraint => Boolean(value))
        choices.sort((left, right) => displacement(left) - displacement(right))
        if (choices[0]) { add(choices[0]); changed = true }
      }
    }
    if (!changed) break
  }
  return positions
}
