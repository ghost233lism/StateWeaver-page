import { canConnectDirectly, connectionPoint, DEPENDENCY_LANE_GAP, routeAvoidingLines, routeCost, routeWorkspacePoints, workspaceRouteCandidates, type Bounds, type Point, type PortSide } from './canvasGeometry'

export type DependencyLink = { id: string; source: string; target: string }
export type DependencyBox = Bounds & { id: string; anchorWidth?: number; anchorHeight?: number }
type Port = { side: PortSide; offset: number }
export type DependencyRoute = { points: Point[]; source: Port; target: Port }
const sides: PortSide[] = ['right', 'bottom', 'left', 'top']
const epsilon = 0.000001
const near = (a: number, b: number) => Math.abs(a - b) < epsilon
const same = (a: Point, b: Point) => near(a.x, b.x) && near(a.y, b.y)
const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const vertical = (a: Point, b: Point) => near(a.x, b.x)
const between = (x: number, a: number, b: number) => x >= Math.min(a, b) - epsilon && x <= Math.max(a, b) + epsilon
const onSegment = (p: Point, a: Point, b: Point) => vertical(a, b)
  ? near(p.x, a.x) && between(p.y, a.y, b.y) : near(p.y, a.y) && between(p.x, a.x, b.x)

/** Only the contiguous common prefix/suffix is a shared trunk. A later crossing
 * between two branches from the same source must still count as a crossing. */
function commonTrunk(a: Point[], b: Point[]): [Point, Point][] {
  if (!same(a[0], b[0])) return []
  const result: [Point, Point][] = [[a[0], a[0]]]
  let p = a[0], i = 1, j = 1
  while (i < a.length && j < b.length) {
    const endA = a[i], endB = b[j]
    if (vertical(p, endA) !== vertical(p, endB)
      || Math.sign(endA.x - p.x) !== Math.sign(endB.x - p.x)
      || Math.sign(endA.y - p.y) !== Math.sign(endB.y - p.y)) break
    const end = distance(p, endA) < distance(p, endB) ? endA : endB
    result.push([p, end]); p = end
    if (same(p, endA)) i++
    if (same(p, endB)) j++
  }
  return result
}

/** Includes ambiguous corner touches and unrelated overlap, not just strict X
 * intersections. Parallel runs need visible space even if they never intersect.
 * Identical source/target trunks remain intentional junctions. */
export function routeInteraction(a: Point[], b: Point[], sharedSource = false, sharedTarget = false) {
  const trunks = [...(sharedSource ? commonTrunk(a, b) : []), ...(sharedTarget ? commonTrunk([...a].reverse(), [...b].reverse()) : [])]
  const allowed = (point: Point) => trunks.some(([start, end]) => onSegment(point, start, end))
  const crossings = new Map<string, Point>()
  let overlap = 0, crowding = 0
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
    const p = a[i - 1], q = a[i], r = b[j - 1], s = b[j]
    const av = vertical(p, q), bv = vertical(r, s)
    if (av === bv) {
      const separation = Math.abs(av ? p.x - r.x : p.y - r.y)
      if (separation >= DEPENDENCY_LANE_GAP - epsilon) continue
      const low = Math.max(Math.min(av ? p.y : p.x, av ? q.y : q.x), Math.min(av ? r.y : r.x, av ? s.y : s.x))
      const high = Math.min(Math.max(av ? p.y : p.x, av ? q.y : q.x), Math.max(av ? r.y : r.x, av ? s.y : s.x))
      if (high <= low + epsilon) continue
      if (separation > epsilon) {
        crowding += (high - low) * (1 - separation / DEPENDENCY_LANE_GAP)
        continue
      }
      const start = av ? { x: p.x, y: low } : { x: low, y: p.y }
      const end = av ? { x: p.x, y: high } : { x: high, y: p.y }
      if (!allowed(start) || !allowed(end)) overlap += high - low
    } else {
      const point = av ? { x: p.x, y: r.y } : { x: r.x, y: p.y }
      if (onSegment(point, p, q) && onSegment(point, r, s) && !allowed(point)) crossings.set(`${point.x.toFixed(5)}:${point.y.toFixed(5)}`, point)
    }
  }
  return { crossings: [...crossings.values()], overlap, crowding,
    cost: crossings.size * 100000 + (overlap ? 100000 + overlap * 24 : 0) + (crowding ? 1000 + crowding * 16 : 0) }
}

export function dependencyGeometryKey(boxes: readonly DependencyBox[], links: readonly DependencyLink[]) {
  return boxes.map((box) => `${box.id}:${box.x},${box.y},${box.width},${box.height},${box.anchorWidth ?? ''},${box.anchorHeight ?? ''}`).sort().join('|')
    + '/' + links.map((link) => `${link.id}:${link.source}:${link.target}`).sort().join('|')
}

/** Clear only an actual crossing underneath the later-painted edge. A full-path
 * halo erases nearby parallel lines and cuts real shared branch junctions. */
export function dependencyCrossingGaps(links: readonly DependencyLink[], routes: ReadonlyMap<string, Point[]>): Map<string, Point[][]> {
  const gaps = new Map<string, Point[][]>()
  for (const [index, link] of links.entries()) {
    const points = routes.get(link.id)
    if (!points) continue
    const crossings = links.slice(0, index).flatMap((other) => {
      const previous = routes.get(other.id)
      return previous ? routeInteraction(points, previous, link.source === other.source, link.target === other.target).crossings : []
    })
    if (!crossings.length) continue
    const lengths = [0]
    points.slice(1).forEach((point, i) => lengths.push(lengths[i] + distance(points[i], point)))
    const intervals = crossings.flatMap((point) => {
      const i = points.findIndex((start, i) => i + 1 < points.length && onSegment(point, start, points[i + 1]))
      if (i < 0) return []
      const offset = lengths[i] + distance(points[i], point)
      return [[Math.max(0, offset - 6), Math.min(lengths.at(-1)!, offset + 6)]]
    }).sort((a, b) => a[0] - b[0])
    const merged: number[][] = []
    for (const interval of intervals) {
      const previous = merged.at(-1)
      if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1])
      else merged.push([...interval])
    }
    gaps.set(link.id, merged.map(([start, end]) => {
      const slice: Point[] = []
      for (let i = 1; i < points.length; i++) {
        const low = Math.max(start, lengths[i - 1]), high = Math.min(end, lengths[i])
        if (high <= low) continue
        const from = points[i - 1], to = points[i]
        for (const offset of [low, high]) {
          const along = offset - lengths[i - 1]
          const point = { x: from.x + Math.sign(to.x - from.x) * along, y: from.y + Math.sign(to.y - from.y) * along }
          if (!slice.length || !same(slice.at(-1)!, point)) slice.push(point)
        }
      }
      return slice
    }))
  }
  return gaps
}

function portOffset(box: DependencyBox, side: PortSide) {
  const horizontal = side === 'left' || side === 'right'
  const size = horizontal ? box.height : box.width
  return Math.min(size, (horizontal ? box.anchorHeight : box.anchorWidth) ?? size) / size * 50
}

function directRoute(source: DependencyBox, target: DependencyBox, obstacles: Bounds[]): DependencyRoute | undefined {
  for (const [from, to] of [['right', 'left'], ['left', 'right'], ['bottom', 'top'], ['top', 'bottom']] as [PortSide, PortSide][]) {
    const horizontal = from === 'right' || from === 'left'
    const sourceStart = horizontal ? source.y : source.x, targetStart = horizontal ? target.y : target.x
    const sourceSize = horizontal ? source.height : source.width, targetSize = horizontal ? target.height : target.width
    const low = Math.max(sourceStart + Math.min(24, sourceSize * .12), targetStart + Math.min(24, targetSize * .12))
    const high = Math.min(sourceStart + sourceSize - Math.min(24, sourceSize * .12), targetStart + targetSize - Math.min(24, targetSize * .12))
    if (low > high) continue
    const axis = Math.max(low, Math.min(high, sourceStart + sourceSize * portOffset(source, from) / 100))
    const sourcePort = { side: from, offset: (axis - sourceStart) / sourceSize * 100 }
    const targetPort = { side: to, offset: (axis - targetStart) / targetSize * 100 }
    const start = connectionPoint(source, from, sourcePort.offset), end = connectionPoint(target, to, targetPort.offset)
    if (canConnectDirectly(start, end, obstacles, { sourceSide: from, targetSide: to })) return { source: sourcePort, target: targetPort, points: [start, end] }
  }
}

type RouteItem = DependencyLink & { sourceBox: DependencyBox; targetBox: DependencyBox; direct?: DependencyRoute; pool?: DependencyRoute[] }
const cache = new Map<string, Map<string, DependencyRoute>>()

/** Route the full graph with movable ports and bounded global improvement.
 * Clear neighbours are reserved first. Long links can approach a merge from
 * another face instead of cutting through its adjacent incoming/outgoing lines. */
export function routeDependencyGraph(boxes: readonly DependencyBox[], links: readonly DependencyLink[]): Map<string, DependencyRoute> {
  const key = dependencyGeometryKey(boxes, links)
  const cached = cache.get(key)
  if (cached) return cached
  const lookup = new Map(boxes.map((box) => [box.id, box]))
  const obstacles = [...boxes].sort((a, b) => a.id.localeCompare(b.id))
  const items: RouteItem[] = links.flatMap((link) => {
    const sourceBox = lookup.get(link.source), targetBox = lookup.get(link.target)
    return sourceBox && targetBox ? [{ ...link, sourceBox, targetBox, direct: directRoute(sourceBox, targetBox, obstacles) }] : []
  }).sort((a, b) => Number(Boolean(b.direct)) - Number(Boolean(a.direct))
    || (a.direct ? routeCost(a.direct.points) : distance(connectionPoint(a.sourceBox, 'right'), connectionPoint(a.targetBox, 'left')))
      - (b.direct ? routeCost(b.direct.points) : distance(connectionPoint(b.sourceBox, 'right'), connectionPoint(b.targetBox, 'left')))
    || a.id.localeCompare(b.id))
  const result = new Map<string, DependencyRoute>()
  const locked = new Set<string>()
  let spaceLanes = false
  const pairCost = (a: Point[], b: Point[], sharedSource = false, sharedTarget = false) => {
    const hit = routeInteraction(a, b, sharedSource, sharedTarget)
    return spaceLanes ? hit.cost : hit.crossings.length * 20000 + hit.overlap * 12
  }
  const interaction = (item: RouteItem, route: DependencyRoute) => {
    let cost = 0
    for (const other of items) {
      const previous = result.get(other.id)
      if (other.id !== item.id && previous) cost += pairCost(route.points, previous.points, item.source === other.source, item.target === other.target)
    }
    return cost
  }
  const needsWork = (item: RouteItem, route = result.get(item.id)!) => spaceLanes
    ? items.some((other) => {
      const previous = result.get(other.id)
      if (other.id === item.id || !previous) return false
      const hit = routeInteraction(route.points, previous.points, item.source === other.source, item.target === other.target)
      return hit.overlap > epsilon || hit.crowding > epsilon
    }) : interaction(item, route) > 0
  const makePool = (item: RouteItem): DependencyRoute[] => {
    const candidates: DependencyRoute[] = item.direct ? [item.direct] : []
    for (const sourceSide of sides) for (const targetSide of sides) {
      // Separate an incoming arrow from an outgoing port on the same face.
      // Source branches can share a trunk; target branches can share a suffix.
      const sourceAnchor = portOffset(item.sourceBox, sourceSide)
      const expandedSource = item.sourceBox.width > (item.sourceBox.anchorWidth ?? item.sourceBox.width)
        || item.sourceBox.height > (item.sourceBox.anchorHeight ?? item.sourceBox.height)
      const targetAnchor = portOffset(item.targetBox, targetSide)
      for (const sourceOffset of [...new Set(expandedSource ? [sourceAnchor, 35, 65] : [sourceAnchor])])
        for (const targetOffset of [...new Set([targetAnchor, 35, 65])]) {
        const start = connectionPoint(item.sourceBox, sourceSide, sourceOffset), end = connectionPoint(item.targetBox, targetSide, targetOffset)
        const options = { sourceSide, targetSide, lane: items.indexOf(item) % 3, fallback: false }
        const paths = workspaceRouteCandidates(start, end, obstacles, options)
        const spacedPaths = spaceLanes ? workspaceRouteCandidates(start, end, obstacles, { ...options, laneGap: DEPENDENCY_LANE_GAP }) : []
        // Keep several gutter choices for each port pair, not just its shortest
        // route. The global pass needs those alternatives to remove crossings.
        const seen = new Set<string>()
        for (const variants of [paths, spacedPaths]) {
          variants.sort((a, b) => routeCost(a) - routeCost(b))
          let count = 0
          for (const points of variants) {
            const signature = points.map((p) => `${p.x},${p.y}`).join(';')
            if (seen.has(signature)) continue
            seen.add(signature)
            candidates.push({ source: { side: sourceSide, offset: sourceOffset }, target: { side: targetSide, offset: targetOffset }, points })
            if (++count >= 8) break
          }
        }
      }
    }
    if (!candidates.length) {
      const sourceSide: PortSide = item.targetBox.x > item.sourceBox.x ? 'right' : 'left'
      const targetSide: PortSide = sourceSide === 'right' ? 'left' : 'right'
      candidates.push({ source: { side: sourceSide, offset: 50 }, target: { side: targetSide, offset: 50 },
        points: routeWorkspacePoints(connectionPoint(item.sourceBox, sourceSide), connectionPoint(item.targetBox, targetSide), obstacles, { sourceSide, targetSide }) })
    }
    return candidates
  }
  const choose = (item: RouteItem) => {
    item.pool ??= makePool(item)
    let best = result.get(item.id) ?? item.pool[0], score = routeCost(best.points) + interaction(item, best)
    for (const route of item.pool) {
      const base = routeCost(route.points)
      if (base >= score) continue
      const next = base + interaction(item, route)
      if (next < score - epsilon) { best = route; score = next }
    }
    result.set(item.id, best)
  }
  for (const item of items) {
    if (item.direct && interaction(item, item.direct) === 0) {
      result.set(item.id, item.direct)
      // Local neighbours keep their straight connection through later passes.
      if (distance(item.direct.points[0], item.direct.points[1]) <= 160) locked.add(item.id)
    } else choose(item)
  }
  const improve = () => {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false
      for (const item of [...items].reverse()) {
        if (locked.has(item.id) || !needsWork(item)) continue
        const before = result.get(item.id)
        choose(item)
        changed ||= before !== result.get(item.id)
      }
      if (!changed) break
    }
    // The first pass already handles crossings. Once lane clearance is restored,
    // don't repeat expensive visibility searches for an unchanged crossing.
    if (spaceLanes && !items.some((item) => needsWork(item))) return
    const totalCost = () => items.reduce((sum, item) => {
      const route = result.get(item.id)!
      return sum + routeCost(route.points) + interaction(item, route) / 2
    }, 0)
    const conflicted = new Set(items.filter((item) => needsWork(item)).map((item) => item.id))
    if (conflicted.size) {
      // A greedy short-link choice can enclose the exit of a later long link.
      // Reserve neighbouring straight links, then let long/conflicted links pick
      // their corridor first in two bounded coordinated attempts.
      let best = new Map(result), bestCost = totalCost()
      const movable = items.filter((item) => !locked.has(item.id))
      for (const order of [[...movable].reverse(), [...movable].sort((a, b) => Number(conflicted.has(b.id)) - Number(conflicted.has(a.id)))]) {
        for (const item of movable) result.delete(item.id)
        for (const item of order) choose(item)
        for (const item of [...order].reverse()) if (interaction(item, result.get(item.id)!)) choose(item)
        const cost = totalCost()
        if (cost < bestCost) { best = new Map(result); bestCost = cost }
      }
      result.clear()
      best.forEach((route, id) => result.set(id, route))
    }
    // Sparse gutter candidates are normally sufficient. Expansions can require
    // more than three bends; reroute only residual conflicts around other lines.
    for (const item of [...items].reverse()) {
      if (locked.has(item.id) || !needsWork(item)) continue
      const independent = items.filter((other) => other.id !== item.id && other.source !== item.source && other.target !== item.target)
      const current = result.get(item.id)!
      const ports = new Map<string, DependencyRoute>()
      for (const route of [current, ...(item.pool ?? makePool(item)).slice().sort((a, b) => routeCost(a.points) - routeCost(b.points))]) {
        const key = `${route.source.side}:${route.target.side}`
        if (!ports.has(key)) ports.set(key, route)
        if (ports.size >= (spaceLanes ? 16 : 4)) break
      }
      let best = current, score = routeCost(current.points) + interaction(item, current)
      for (const route of ports.values()) {
        const blocked = new Set(independent.filter((other) => pairCost(route.points, result.get(other.id)!.points)))
        for (let retry = 0; retry < 3; retry++) {
          const points = routeAvoidingLines(route.points[0], route.points.at(-1)!, obstacles,
            [...blocked].map((other) => result.get(other.id)!.points),
            { sourceSide: route.source.side, targetSide: route.target.side, laneGap: spaceLanes ? DEPENDENCY_LANE_GAP : undefined })
          if (!points) break
          const candidate = { ...route, points }, next = routeCost(points) + interaction(item, candidate)
          if (next < score) { best = candidate; score = next }
          const additional = independent.filter((other) => !blocked.has(other) && pairCost(points, result.get(other.id)!.points))
          if (!additional.length) break
          additional.forEach((other) => blocked.add(other))
        }
        if (!needsWork(item, best)) break
      }
      result.set(item.id, best)
    }
  }
  // Start with a feasible route, then spread the lanes without discarding it.
  // Extra short gutter choices must not displace the routes that avoided
  // crossings around an expanded frame in the first pass.
  improve()
  spaceLanes = true
  for (const item of items) item.pool = undefined
  improve()
  cache.set(key, result)
  if (cache.size > 8) cache.delete(cache.keys().next().value!)
  return result
}
