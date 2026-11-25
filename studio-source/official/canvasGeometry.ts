export type Point = { x: number; y: number }
export type Bounds = Point & { width: number; height: number }
export type PortSide = 'left' | 'right' | 'top' | 'bottom'
export const DEPENDENCY_LANE_GAP = 24
const axisTolerance = 0.000001

export function connectionPoint(bounds: Bounds, side: PortSide, offset = 50): Point {
  return { x: bounds.x + (side === 'left' ? 0 : side === 'right' ? bounds.width : bounds.width * offset / 100),
    y: bounds.y + (side === 'top' ? 0 : side === 'bottom' ? bounds.height : bounds.height * offset / 100) }
}

export function overlaps(a: Bounds, b: Bounds, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
}

/** Resolve display collisions from immutable anchors, never from the previous reflow. */
export function placeAround(anchor: Bounds, occupied: Bounds[], gap: number): Point {
  if (!occupied.some((rect) => overlaps(anchor, rect, gap))) return { x: anchor.x, y: anchor.y }
  const xs = [anchor.x, ...occupied.map((rect) => rect.x + rect.width + gap)]
  const ys = [anchor.y, ...occupied.map((rect) => rect.y + rect.height + gap)]
  let best = { x: Math.max(anchor.x, ...xs), y: anchor.y }
  let bestCost = Infinity
  for (const x of xs) for (const y of ys) {
    // A growing card pushes neighbours forward; collapsing restores their anchors.
    if (x < anchor.x || y < anchor.y) continue
    const cost = x - anchor.x + (y - anchor.y) * 1.1
    if (cost >= bestCost || occupied.some((rect) => overlaps({ ...anchor, x, y }, rect, gap))) continue
    best = { x, y }; bestCost = cost
  }
  return best
}

export function segmentCrosses(start: Point, end: Point, rect: Bounds): boolean {
  return Math.abs(start.x - end.x) < axisTolerance
    ? start.x > rect.x && start.x < rect.x + rect.width && Math.max(start.y, end.y) > rect.y && Math.min(start.y, end.y) < rect.y + rect.height
    : start.y > rect.y && start.y < rect.y + rect.height && Math.max(start.x, end.x) > rect.x && Math.min(start.x, end.x) < rect.x + rect.width
}
const length = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const direction: Record<PortSide, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } }
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

function simplify(points: Point[]) {
  const result: Point[] = []
  for (const point of points) {
    if (result.length && same(result[result.length - 1], point)) continue
    while (result.length > 1) {
      const a = result[result.length - 2], b = result[result.length - 1]
      if ((a.x === b.x && b.x === point.x && (b.y - a.y) * (point.y - b.y) >= 0)
        || (a.y === b.y && b.y === point.y && (b.x - a.x) * (point.x - b.x) >= 0)) result.pop()
      else break
    }
    result.push(point)
  }
  return result
}
const isClear = (points: Point[], obstacles: Bounds[]) => points.slice(1).every((end, index) => !obstacles.some((rect) => segmentCrosses(points[index], end, rect)))
export const routeCost = (points: Point[]) => points.slice(1).reduce((sum, end, index) => sum + length(points[index], end), Math.max(0, points.length - 2) * 34)

/** Sparse routes cover normal gutters. A visibility grid handles staggered/manual layouts. */
function visibilityRoute(start: Point, end: Point, obstacles: Bounds[]): Point[] | undefined {
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((rect) => [rect.x - 1, rect.x + rect.width + 1])])].sort((a, b) => a - b)
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap((rect) => [rect.y - 1, rect.y + rect.height + 1])])].sort((a, b) => a - b)
  const width = xs.length
  const points = ys.flatMap((y) => xs.map((x) => ({ x, y })))
  const blocked = points.map((point) => obstacles.some((rect) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height))
  const startIndex = ys.indexOf(start.y) * width + xs.indexOf(start.x)
  const endIndex = ys.indexOf(end.y) * width + xs.indexOf(end.x)
  if (blocked[startIndex] || blocked[endIndex]) return
  // The incoming axis is part of state so the shortest route can favour fewer bends.
  type Step = { index: number; axis: number; cost: number; score: number; previous?: Step }
  const open: Step[] = [{ index: startIndex, axis: 0, cost: 0, score: length(start, end) }]
  const costs = new Map<number, number>([[startIndex * 3, 0]])
  while (open.length) {
    let bestIndex = 0
    for (let index = 1; index < open.length; index++) if (open[index].score < open[bestIndex].score) bestIndex = index
    const current = open.splice(bestIndex, 1)[0]
    if (current.cost !== costs.get(current.index * 3 + current.axis)) continue
    if (current.index === endIndex) {
      const route: Point[] = []
      let step: Step | undefined = current
      while (step) { route.push(points[step.index]); step = step.previous }
      return simplify(route.reverse())
    }
    const x = current.index % width
    const neighbours = [x > 0 ? current.index - 1 : -1, x < width - 1 ? current.index + 1 : -1,
      current.index - width, current.index + width]
    for (const index of neighbours) {
      if (index < 0 || index >= points.length || blocked[index]) continue
      const point = points[index], from = points[current.index]
      if (obstacles.some((rect) => segmentCrosses(from, point, rect))) continue
      const axis = from.x === point.x ? 2 : 1
      const cost = current.cost + length(from, point) + (current.axis && current.axis !== axis ? 34 : 0)
      const key = index * 3 + axis
      if (cost >= (costs.get(key) ?? Infinity)) continue
      costs.set(key, cost)
      open.push({ index, axis, cost, score: cost + length(point, end), previous: current })
    }
  }
}

export type RoutingOptions = {
  sourceSide: PortSide
  targetSide: PortSide
  lane?: number
  laneGap?: number
  occupiedRoutes?: readonly Point[][]
  sharedRoutes?: readonly Point[][]
  fallback?: boolean
}

/** A clear facing connection stays straight, even in a narrow or busy gutter. */
export function canConnectDirectly(source: Point, target: Point, bounds: Bounds[], options: Pick<RoutingOptions, 'sourceSide' | 'targetSide'>) {
  const horizontal = Math.abs(source.y - target.y) < axisTolerance
    && (options.sourceSide === 'right' && options.targetSide === 'left' && target.x > source.x
      || options.sourceSide === 'left' && options.targetSide === 'right' && target.x < source.x)
  const vertical = Math.abs(source.x - target.x) < axisTolerance
    && (options.sourceSide === 'bottom' && options.targetSide === 'top' && target.y > source.y
      || options.sourceSide === 'top' && options.targetSide === 'bottom' && target.y < source.y)
  return (horizontal || vertical) && isClear([source, target], bounds)
}

/** Penalise unrelated crossings/overlap, while letting a source share its trunk. */
function interactionCost(points: Point[], routes: readonly Point[][], shared = false) {
  let cost = 0
  for (let i = 1; i < points.length; i++) for (const route of routes) for (let j = 1; j < route.length; j++) {
    const a = points[i - 1], b = points[i], c = route[j - 1], d = route[j]
    const vertical = Math.abs(a.x - b.x) < axisTolerance, otherVertical = Math.abs(c.x - d.x) < axisTolerance
    if (vertical === otherVertical) {
      if (vertical ? a.x !== c.x : a.y !== c.y) continue
      const overlap = vertical
        ? Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
        : Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
      cost += Math.max(0, overlap) * (shared ? -0.25 : 6)
    } else if (!shared) {
      const v1 = vertical ? a : c, v2 = vertical ? b : d, h1 = vertical ? c : a, h2 = vertical ? d : b
      if (v1.x > Math.min(h1.x, h2.x) && v1.x < Math.max(h1.x, h2.x)
        && h1.y > Math.min(v1.y, v2.y) && h1.y < Math.max(v1.y, v2.y)) cost += 240
    }
  }
  return cost
}

function escapePort(point: Point, side: PortSide, bounds: Bounds[], clearance: number): Point {
  const normal = direction[side]
  const result = { x: point.x + normal.x * (clearance + 2), y: point.y + normal.y * (clearance + 2) }
  let closest = 8
  for (const rect of bounds) {
    const horizontal = side === 'left' || side === 'right'
    if (horizontal ? point.y < rect.y || point.y > rect.y + rect.height : point.x < rect.x || point.x > rect.x + rect.width) continue
    const boundary = side === 'left' ? rect.x : side === 'right' ? rect.x + rect.width : side === 'top' ? rect.y : rect.y + rect.height
    const offset = Math.abs((horizontal ? point.x : point.y) - boundary)
    if (offset >= closest) continue
    closest = offset
    // Handles sit just outside their frame. Escape from the actual frame edge,
    // otherwise that extra handle width consumes the opposite gutter margin.
    if (horizontal) result.x = boundary + normal.x * (clearance + 2)
    else result.y = boundary + normal.y * (clearance + 2)
  }
  return result
}

/** Candidate stubs leave their frames outward; the middle avoids every frame. */
export function workspaceRouteCandidates(source: Point, target: Point, bounds: Bounds[], options: RoutingOptions): Point[][] {
  if (canConnectDirectly(source, target, bounds, options)) return [[source, target]]
  const clearance = 18 + ((options.lane ?? 0) % 4) * 4
  const obstacles = bounds.map((rect) => ({ x: rect.x - clearance, y: rect.y - clearance, width: rect.width + clearance * 2, height: rect.height + clearance * 2 }))
  const start = escapePort(source, options.sourceSide, bounds, clearance)
  const end = escapePort(target, options.targetSide, bounds, clearance)
  const candidates: Point[][] = [
    [start, { x: start.x, y: end.y }, end], [start, { x: end.x, y: start.y }, end],
  ]
  const occupied = options.occupiedRoutes ?? [], shared = options.sharedRoutes ?? []
  const spacing = options.laneGap ?? 12
  const lanes = options.laneGap ? [0, spacing, spacing * 2] : [0]
  const routeXs = occupied.flatMap((route) => route.flatMap((p) => [p.x - spacing, p.x + spacing]))
  const routeYs = occupied.flatMap((route) => route.flatMap((p) => [p.y - spacing, p.y + spacing]))
  for (const x of new Set([(start.x + end.x) / 2, ...obstacles.flatMap((rect) => lanes.flatMap((offset) => [rect.x - 1 - offset, rect.x + rect.width + 1 + offset])), ...routeXs, ...shared.flatMap((r) => r.map((p) => p.x))])) {
    candidates.push([start, { x, y: start.y }, { x, y: end.y }, end])
  }
  for (const y of new Set([(start.y + end.y) / 2, ...obstacles.flatMap((rect) => lanes.flatMap((offset) => [rect.y - 1 - offset, rect.y + rect.height + 1 + offset])), ...routeYs, ...shared.flatMap((r) => r.map((p) => p.y))])) {
    candidates.push([start, { x: start.x, y }, { x: end.x, y }, end])
  }
  const clear = candidates.filter((points) => isClear(points, obstacles)).map((points) => simplify([source, ...points, target]))
  if (clear.length || options.fallback === false) return clear
  const routed = visibilityRoute(start, end, obstacles)
  if (routed) return [simplify([source, ...routed, target])]
  // Overlapping manually positioned endpoints can make a clear route impossible.
  // Keep endpoints/direction intact and choose the least obstructed detour.
  return [candidates.map((points) => simplify([source, ...points, target])).sort((a, b) => {
    const cost = (points: Point[]) => routeCost(points) + points.slice(2, -1).reduce((sum, end, index) => sum + obstacles.filter((rect) => segmentCrosses(points[index + 1], end, rect)).length * 100000, 0)
    return cost(a) - cost(b)
  })[0]]
}

export function routeWorkspacePoints(source: Point, target: Point, bounds: Bounds[], options: RoutingOptions): Point[] {
  const candidates = workspaceRouteCandidates(source, target, bounds, options)
  // Count a shared trunk once, regardless of how many earlier branches use it.
  const score = (points: Point[]) => routeCost(points) + interactionCost(points, options.occupiedRoutes ?? [])
    + Math.min(0, ...(options.sharedRoutes ?? []).map((route) => interactionCost(points, [route], true)))
  return candidates.sort((a, b) => score(a) - score(b))[0]
}

/** A bounded graph pass calls this only for remaining long-line conflicts.
 * Thin line obstacles allow several gutter turns around expanded frames. */
export function routeAvoidingLines(source: Point, target: Point, bounds: Bounds[], lines: readonly Point[][],
  options: Pick<RoutingOptions, 'sourceSide' | 'targetSide' | 'laneGap'>): Point[] | undefined {
  const clearance = 18
  const obstacles = bounds.map((rect) => ({ x: rect.x - clearance, y: rect.y - clearance, width: rect.width + clearance * 2, height: rect.height + clearance * 2 }))
  const lineMargin = options.laneGap ?? 5
  const lineBounds = lines.flatMap((line) => line.slice(1).map((end, i) => ({
    x: Math.min(line[i].x, end.x) - lineMargin, y: Math.min(line[i].y, end.y) - lineMargin,
    width: Math.abs(end.x - line[i].x) + lineMargin * 2, height: Math.abs(end.y - line[i].y) + lineMargin * 2,
  })))
  const start = escapePort(source, options.sourceSide, bounds, clearance)
  const end = escapePort(target, options.targetSide, bounds, clearance)
  const routed = visibilityRoute(start, end, [...obstacles, ...lineBounds])
  const points = routed && simplify([source, ...routed, target])
  return points && isClear(points, [...bounds, ...lineBounds]) ? points : undefined
}

export function routeWorkspaceEdge(source: Point, target: Point, bounds: Bounds[], options: RoutingOptions | boolean) {
  const route = routeWorkspacePoints(source, target, bounds, typeof options === 'boolean'
    ? { sourceSide: options ? 'bottom' : 'right', targetSide: options ? 'top' : 'left' } : options)
  return route.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
}
