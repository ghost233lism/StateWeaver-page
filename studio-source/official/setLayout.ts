import type { Point } from './canvasGeometry'

type Size = { width: number; height: number }
export type SetLayoutItem = Size & { id: string; dependsOn: readonly string[]; compactSize?: Size }
type Component = Size & { positions: Map<string, Point> }
type Layout = { compact: Component; actual: Component }
type Run = Layout & { id: string; items: SetLayoutItem[] }
type Graph = Map<string, string[]>
const columnGap = 88
const rowGap = 96
const targetAspect = 1.7
const shapeCost = ({ width, height }: Size, aspect = targetAspect) => width * height * (1 + Math.abs(Math.log(width / height / aspect)))
const compactSize = (item: SetLayoutItem): Size => item.compactSize ?? item

/** Shortcuts still render, but do not break an otherwise continuous layout run. */
function layoutParents(parents: Graph, children: Graph): Graph {
  const ancestors = new Map<string, Set<string>>()
  const remaining = new Map([...parents].map(([id, previous]) => [id, previous.length]))
  const ready = [...parents.keys()].filter((id) => !remaining.get(id))
  for (let cursor = 0; cursor < ready.length; cursor++) {
    const id = ready[cursor], inherited = new Set<string>()
    for (const parent of parents.get(id)!) {
      inherited.add(parent)
      for (const ancestor of ancestors.get(parent)!) inherited.add(ancestor)
    }
    ancestors.set(id, inherited)
    for (const child of children.get(id)!) {
      remaining.set(child, remaining.get(child)! - 1)
      if (!remaining.get(child)) ready.push(child)
    }
  }
  // Leave cyclic/unresolved historical portions unchanged. This is a display
  // constraint graph; scheduling and the original dependency list stay intact.
  return new Map([...parents].map(([id, previous]) => [id, ancestors.has(id)
    ? previous.filter((parent) => !previous.some((other) => other !== parent && ancestors.get(other)?.has(parent))) : previous]))
}

/** Presentation only. The input order breaks ties; it never creates an edge. */
export function layoutSetDependencies(items: readonly SetLayoutItem[], origin: Point): Map<string, Point> {
  if (!items.length) return new Map()
  const index = new Map(items.map((item, i) => [item.id, i]))
  let parents = new Map(items.map((item) => [item.id, [...new Set(item.dependsOn)].filter((id) => id !== item.id && index.has(id))]))
  const children = new Map(items.map((item) => [item.id, [] as string[]]))
  for (const item of items) for (const parent of parents.get(item.id)!) children.get(parent)!.push(item.id)
  parents = layoutParents(parents, children)
  for (const id of children.keys()) children.set(id, [])
  for (const item of items) for (const parent of parents.get(item.id)!) children.get(parent)!.push(item.id)
  const seen = new Set<string>()
  const components: Layout[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    const members: SetLayoutItem[] = []
    const pending = [item.id]
    seen.add(item.id)
    while (pending.length) {
      const id = pending.pop()!
      members.push(items[index.get(id)!])
      for (const neighbour of [...parents.get(id)!, ...children.get(id)!]) if (!seen.has(neighbour)) {
        seen.add(neighbour); pending.push(neighbour)
      }
    }
    members.sort((a, b) => index.get(a.id)! - index.get(b.id)!)
    components.push(layoutComponent(members, parents, children))
  }

  // Choose packing from compact sizes once per graph, then stretch the same rows
  // for open groups. Opening a ProductionSet must not repack unrelated components.
  const widest = Math.max(...components.map(({ compact }) => compact.width))
  const area = components.reduce((sum, { compact }) => sum + (compact.width + columnGap) * (compact.height + rowGap), 0)
  const ideal = Math.sqrt(area * targetAspect)
  // Put substantial dependency groups first, then keep smaller independent
  // groups together. A single card beside a tall component otherwise reserves
  // a mostly empty column and appears stranded at the upper-right corner.
  const packingOrder = components.map((_, i) => i).sort((a, b) => components[b].compact.height - components[a].compact.height || a - b)
  const pack = (limit: number) => {
    const rows: number[][] = [[]]
    let x = 0, y = 0, rowHeight = 0, width = 0
    packingOrder.forEach((i) => {
      const { compact } = components[i]
      if (x && (x + compact.width > limit || compact.height + rowGap < rowHeight / 2)) {
        rows.push([]); x = 0; y += rowHeight + rowGap; rowHeight = 0
      }
      rows[rows.length - 1].push(i)
      x += compact.width + columnGap
      rowHeight = Math.max(rowHeight, compact.height)
      width = Math.max(width, x - columnGap)
    })
    return { rows, cost: shapeCost({ width, height: y + rowHeight }) }
  }
  const packed = [0.8, 1, 1.25, 1.6].map((factor) => pack(Math.max(widest, ideal * factor))).sort((a, b) => a.cost - b.cost)[0]
  const result = new Map<string, Point>()
  let y = origin.y
  for (const row of packed.rows) {
    let x = origin.x
    for (const i of row) {
      const component = components[i].actual
      for (const [id, position] of component.positions) result.set(id, { x: x + position.x, y: y + position.y })
      x += component.width + columnGap
    }
    y += Math.max(...row.map((i) => components[i].actual.height)) + rowGap
  }
  return result
}

/** Only edges without an intervening fork/merge may belong to the same run. */
function layoutComponent(items: SetLayoutItem[], parents: Graph, children: Graph): Layout {
  const byId = new Map(items.map((item) => [item.id, item]))
  const starts = items.filter((item) => {
    const previous = parents.get(item.id)!
    return previous.length !== 1 || children.get(previous[0])!.length !== 1
  })
  const seen = new Set<string>()
  const chains: SetLayoutItem[][] = []
  for (const start of [...starts, ...items]) {
    if (seen.has(start.id)) continue
    const chain: SetLayoutItem[] = []
    let item = start
    while (!seen.has(item.id)) {
      seen.add(item.id); chain.push(item)
      const next = children.get(item.id)!
      if (next.length !== 1 || parents.get(next[0])!.length !== 1) break
      item = byId.get(next[0])!
    }
    chains.push(chain)
  }
  const owner = new Map(chains.flatMap((chain) => chain.map((item) => [item.id, chain[0].id] as const)))
  const runParents: Graph = new Map(), runChildren: Graph = new Map()
  for (const chain of chains) {
    const id = chain[0].id
    const neighbours = (graph: Graph) => [...new Set(chain.flatMap((item) => graph.get(item.id)!.map((other) => owner.get(other)!)))].filter((other) => other !== id)
    runParents.set(id, neighbours(parents)); runChildren.set(id, neighbours(children))
  }
  const runs: Run[] = chains.map((chain) => {
    const cyclic = parents.get(chain[0].id)!.includes(chain[chain.length - 1].id)
    return { id: chain[0].id, items: chain, ...layoutRun(chain, Boolean(runChildren.get(chain[0].id)!.length), cyclic,
      Math.max(1, targetAspect / Math.sqrt(chains.length))) }
  })

  const remaining = new Map(runs.map((run) => [run.id, runParents.get(run.id)!.length]))
  const rank = new Map(runs.map((run) => [run.id, 0]))
  const ready = runs.filter((run) => !remaining.get(run.id)).map((run) => run.id)
  const visited = new Set<string>()
  for (let cursor = 0; cursor < ready.length; cursor++) {
    const id = ready[cursor]
    visited.add(id)
    for (const child of runChildren.get(id)!) {
      rank.set(child, Math.max(rank.get(child)!, rank.get(id)! + 1))
      remaining.set(child, remaining.get(child)! - 1)
      if (!remaining.get(child)) ready.push(child)
    }
  }
  // Keep malformed historical graphs visible without repairing production edges.
  let fallback = Math.max(...rank.values()) + 1
  for (const run of runs) if (!visited.has(run.id)) rank.set(run.id, fallback++)
  const layers = new Map<number, Run[]>()
  for (const run of runs) {
    const level = rank.get(run.id)!
    if (!layers.has(level)) layers.set(level, [])
    layers.get(level)!.push(run)
  }
  const orderedLayers = [...layers.entries()].sort(([a], [b]) => a - b).map(([, layer]) => layer)
  const lanes = new Map<string, number>()
  for (const layer of orderedLayers) {
    const preferred = (id: string) => {
      const values = runParents.get(id)!.flatMap((parent) => lanes.has(parent) ? [lanes.get(parent)!] : []).sort((a, b) => a - b)
      return values.length ? values[Math.floor((values.length - 1) / 2)] : 0
    }
    const occupied = new Set<number>()
    for (const run of [...layer].sort((a, b) => preferred(a.id) - preferred(b.id))) {
      const target = preferred(run.id)
      let lane = target
      for (let distance = 1; occupied.has(lane); distance++) {
        lane = target >= distance && !occupied.has(target - distance) ? target - distance : target + distance
      }
      occupied.add(lane); lanes.set(run.id, lane)
    }
  }
  // A short terminal run can turn down after a merge. Judge that turn against
  // the entire component. Standalone short sequences still read left to right.
  if (runs.length > 1) for (const run of runs) {
    if (runChildren.get(run.id)!.length || run.items.length < 2 || run.items.length > 4) continue
    let best: Layout = { compact: run.compact, actual: run.actual }
    let cost = shapeCost(arrangeRuns(orderedLayers, lanes, runParents, true))
    for (let rows = 2; rows <= run.items.length; rows++) {
      Object.assign(run, layoutRun(run.items, false, false, targetAspect, rows))
      const nextCost = shapeCost(arrangeRuns(orderedLayers, lanes, runParents, true)) * (1 + (rows - 1) * 0.025)
      if (nextCost < cost) { best = { compact: run.compact, actual: run.actual }; cost = nextCost }
    }
    Object.assign(run, best)
  }
  return {
    compact: arrangeRuns(orderedLayers, lanes, runParents, true),
    actual: arrangeRuns(orderedLayers, lanes, runParents, false),
  }
}

function layoutRun(items: SetLayoutItem[], hasSuccessors: boolean, cyclic: boolean, aspect: number, fixedRows?: number): Layout {
  const makeCells = (rowCount: number) => {
    const columns = Math.ceil(items.length / rowCount)
    const cells: { row: number; column: number }[] = []
    let remaining = items.length
    for (let row = 0; row < rowCount; row++) {
      const count = Math.ceil(remaining / (rowCount - row))
      for (let i = 0; i < count; i++) {
        // Intermediate rows reach both edges. The final terminal row may stop
        // early. A single last cell stays aligned with the turn above; its
        // empty trailing cells leave a clear exit toward any successor.
        const column = row < rowCount - 1 || hasSuccessors
          ? count === 1 ? 0 : Math.round(i * (columns - 1) / (count - 1)) : i
        cells.push({ row, column: row % 2 ? columns - 1 - column : column })
      }
      remaining -= count
    }
    return cells
  }
  const arrange = (cells: ReturnType<typeof makeCells>, compact: boolean): Component => {
    const widths: number[] = [], heights: number[] = []
    items.forEach((item, i) => {
      const size = compact ? compactSize(item) : item, cell = cells[i]
      widths[cell.column] = Math.max(widths[cell.column] ?? 0, size.width)
      heights[cell.row] = Math.max(heights[cell.row] ?? 0, size.height)
    })
    let width = 0, height = 0
    const xs = widths.map((value) => { const centre = width + value / 2; width += value + columnGap; return centre })
    const ys = heights.map((value) => { const centre = height + value / 2; height += value + rowGap; return centre })
    return { width: width - columnGap, height: height - rowGap, positions: new Map(items.map((item, i) => {
      const size = compact ? compactSize(item) : item, cell = cells[i]
      return [item.id, { x: xs[cell.column] - size.width / 2, y: ys[cell.row] - size.height / 2 }]
    })) }
  }
  if (fixedRows) { const cells = makeCells(fixedRows); return { compact: arrange(cells, true), actual: arrange(cells, false) } }
  let cells = makeCells(1), compact = arrange(cells, true), cost = shapeCost(compact, aspect)
  if (!cyclic && items.length >= 5) for (let rows = 2; rows <= Math.ceil(items.length / 2); rows++) {
    if (hasSuccessors && rows % 2 === 0) continue
    const candidateCells = makeCells(rows), candidate = arrange(candidateCells, true)
    const nextCost = shapeCost(candidate, aspect) * (1 + (rows - 1) * 0.08)
    if (nextCost < cost) { cells = candidateCells; compact = candidate; cost = nextCost }
  }
  return { compact, actual: arrange(cells, false) }
}

function arrangeRuns(layers: Run[][], lanes: Map<string, number>, parents: Graph, compact: boolean): Component {
  const runs = new Map(layers.flat().map((run) => [run.id, run]))
  const offsets = new Map<string, Point>()
  const dimension = (run: Run) => compact ? run.compact : run.actual
  const centreY = (run: Run, last: boolean) => {
    const item = run.items[last ? run.items.length - 1 : 0]
    return dimension(run).positions.get(item.id)!.y + (compact ? compactSize(item) : item).height / 2
  }
  let width = 0
  for (const layer of layers) {
    const columnWidth = Math.max(...layer.map((run) => dimension(run).width))
    let bottom = -Infinity
    for (const run of [...layer].sort((a, b) => lanes.get(a.id)! - lanes.get(b.id)!)) {
      const lane = lanes.get(run.id)!
      const allPrevious = parents.get(run.id)!.filter((id) => offsets.has(id))
      const sameLane = allPrevious.filter((id) => lanes.get(id) === lane)
      const previous = sameLane.length ? sameLane : allPrevious
      const preferredY = previous.length ? Math.max(...previous.map((id) => offsets.get(id)!.y + centreY(runs.get(id)!, true))) - centreY(run, false) : 0
      // Reserve vertical space only among siblings here. A later merge must not
      // push a small parallel branch below the entire component.
      const y = Math.max(preferredY, bottom + rowGap)
      offsets.set(run.id, { x: width, y })
      bottom = y + dimension(run).height
    }
    width += columnWidth + columnGap
  }
  const top = Math.min(...[...offsets.values()].map((point) => point.y))
  const height = Math.max(...[...runs.values()].map((run) => offsets.get(run.id)!.y + dimension(run).height)) - top
  const positions = new Map<string, Point>()
  for (const run of runs.values()) {
    const offset = offsets.get(run.id)!
    for (const [id, position] of dimension(run).positions) positions.set(id, {
      x: offset.x + position.x, y: offset.y - top + position.y,
    })
  }
  return { width: width - columnGap, height, positions }
}
