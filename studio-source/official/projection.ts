import { MarkerType, type Edge, type Node } from '@xyflow/react'
import { overlaps, placeAround, type Bounds, type PortSide } from './canvasGeometry'
import { routeDependencyGraph } from './dependencyRouting'
import { STUDIO_CARD_HEIGHT, STUDIO_CARD_WIDTH } from './canvasMetrics'
export { STUDIO_CARD_HEIGHT, STUDIO_CARD_WIDTH } from './canvasMetrics'
import { layoutSetDependencies } from './setLayout'
import { reflowExpandedFrames } from './expandedLayout'
import { unitDisplayTitle, unitLabel, entries, generationDependencies, newestCandidate, orderedSets, setClips, type Selection, type StudioProject, type WorkspaceLayout } from './model'
export { routeWorkspaceEdge } from './canvasGeometry'
export type { Bounds as RouteObstacle } from './canvasGeometry'

export type StudioNodeData = Record<string, unknown> & {
  selection: Selection
  title: string
  displayTitle?: string
  eyebrow: string
  description: string
  status?: string
  progress?: string
  thumbnail?: string
  project?: StudioProject
  assetOrder?: Record<string, string[]>
  onAssetOrderChange?: (kind: string, ids: string[]) => void
  onSizeChange?: (width: number, height: number | null) => void
  selectedClipId?: string
  storyWidth?: number | null
  onStoryWidthChange?: (width: number | null) => void
  manualHeight?: number | null
  temporarySelection?: boolean
  compromiseSelection?: boolean
  systemFallbackSelection?: boolean
  expanded?: boolean
  onSelect?: (selection: Selection) => void
  onToggle?: (setId: string) => void
  setId?: string
  ports?: { id: string; side: PortSide; type: 'source' | 'target'; offset: number }[]
}
export type StudioNode = Node<StudioNodeData, 'studio' | 'setGroup' | 'globalMemory' | 'setPreview'>
export type NodeMeasurements = Record<string, { width: number; height: number }>
// Ordinary cards share a wide, bounded preview; content remains available in details.
const cardRowGap = 56
const cardColumnGap = 48
const collapsedSetWidth = STUDIO_CARD_WIDTH
const collapsedSetHeight = STUDIO_CARD_HEIGHT
export const STUDIO_MEMORY_WIDTH = 1440
const initialMemoryHeight = 1200
const nodeSize = (node: StudioNode, measurements: NodeMeasurements) => ({
  width: node.width ?? measurements[node.id]?.width ?? STUDIO_CARD_WIDTH,
  height: node.type === 'studio' ? STUDIO_CARD_HEIGHT : node.height ?? measurements[node.id]?.height ?? 220,
})
const boundsFor = (node: StudioNode, measurements: NodeMeasurements): Bounds => ({ ...node.position, ...nodeSize(node, measurements) })
/** Child positions are relative to their ProductionSet frame; layout never changes scheduling. */
export function buildStudioProjection(project: StudioProject, expanded: ReadonlySet<string>, dependencies = true,
  layout?: WorkspaceLayout, measurements: NodeMeasurements = {}, deferDependencies = false) {
  const nodes: StudioNode[] = []
  const edges: Edge[] = []
  const actors = entries(project.actors)
  const add = (id: string, x: number, y: number, data: StudioNodeData, extra: Partial<StudioNode> = {}) => {
    const saved = layout?.nodes?.[id]
    const node: StudioNode = { id, type: 'studio', position: saved ? { x: saved.x, y: saved.y } : { x, y },
      data, draggable: true, width: STUDIO_CARD_WIDTH, height: STUDIO_CARD_HEIGHT, dragHandle: '.studio-node-grip', ...extra }
    nodes.push(node)
    return node
  }
  const writer = actors.find((actor) => actor.role === 'screenwriter')
  const executive = actors.find((actor) => actor.role === 'executive')
  if (writer) add(`actor:${writer.id}`, 0, 0, {
    selection: { kind: 'actor', id: writer.id }, title: '编剧', eyebrow: '创作入口',
    description: writer.summary, status: writer.paused ? 'paused' : writer.status,
    progress: project.screenplay?.confirmed_at ? '剧本已确认' : '确认剧本后开始制作',
  })
  if (executive) add(`actor:${executive.id}`, STUDIO_CARD_WIDTH + cardColumnGap, 0, {
    selection: { kind: 'actor', id: executive.id }, title: '总导演', eyebrow: '全片统筹',
    description: executive.summary, status: executive.paused ? 'paused' : executive.status,
    progress: project.catalog_frozen_at ? project.harness_version === 'adaptive-v2' ? '初始资产已规划，可按需增补' : '资产目录已冻结' : '准备全局记忆与资产',
  })
  const savedMemory = layout?.nodes?.['memory:global']
  // An explicit null is the user's fit-to-content choice. Only an untouched
  // memory panel gets the bounded, independently scrollable overview size.
  const memoryHeight = savedMemory ? savedMemory.height ?? null : initialMemoryHeight
  const creatorNodes = nodes.filter((node) => node.data.selection.kind === 'actor')
  const creatorHeight = Math.max(0, ...creatorNodes.map((node) => nodeSize(node, measurements).height))
  if (creatorNodes.every((node) => !layout?.nodes?.[node.id])) {
    for (const node of creatorNodes) node.position.y = (creatorHeight - nodeSize(node, measurements).height) / 2
  }
  // Older saved anchors may be closer than the wider cards. Resolve only actual
  // creator collisions in the projection; never rewrite those saved positions.
  const creatorBounds: Bounds[] = []
  for (const node of creatorNodes) {
    const bounds = boundsFor(node, measurements)
    if (creatorBounds.some((rect) => overlaps(bounds, rect))) node.position = placeAround(bounds, creatorBounds, cardColumnGap)
    creatorBounds.push(boundsFor(node, measurements))
  }
  // Screenplay confirmation is a real prerequisite; film order alone is not a dependency.
  if (writer && executive) edges.push({
    id: 'workflow:screenplay', source: `actor:${writer.id}`, target: `actor:${executive.id}`,
    sourceHandle: 'right', targetHandle: 'left', type: 'workspace',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--studio-edge)', width: 18, height: 18 },
    ariaLabel: '确认剧本后交给总导演', className: 'studio-workflow-edge',
  })
  const sets = orderedSets(project)
  const groups: StudioNode[] = []
  for (const set of sets) {
      const actor = actors.find((candidate) => candidate.id === set.actor_id)
      const clips = setClips(project, set.id)
      const accepted = clips.filter((clip) => clip.status === 'accepted').length
      const open = expanded.has(set.id)
      const actorId = actor?.id ?? set.actor_id
      // Saved anchors are restored verbatim; automatic cells are centred below
      // once their measured dimensions are known. Neither step writes a layout.
      const group = add(`set:${set.id}`, 0, 0, {
        selection: { kind: 'actor', id: actorId }, title: set.title, displayTitle: unitDisplayTitle(set),
        eyebrow: `Set ${String(set.order + 1).padStart(2, '0')}`, description: set.description,
        expanded: open, setId: set.id, ports: [],
      }, { type: 'setGroup', width: open ? STUDIO_CARD_WIDTH * 2 + cardColumnGap + 32 : collapsedSetWidth, height: collapsedSetHeight,
        dragHandle: open ? '.studio-set-drag' : '.studio-node-grip', selectable: false, zIndex: -1 })
      const children: StudioNode[] = []
      groups.push(group)
      const child = (id: string, x: number, y: number, data: StudioNodeData) => {
        // The projection owns group geometry. React Flow's expandParent emits
        // synthetic position changes that otherwise overwrite saved anchors.
        const node = add(id, x, y, data, { parentId: group.id, expandParent: false, draggable: open })
        node.position = { x: Math.max(16, node.position.x), y: Math.max(64, node.position.y) }
        if (!open) node.position = { x: 16, y: 64 }
        children.push(node)
        return node
      }
      const director = child(`actor:${actorId}`, 16, 64, {
        selection: { kind: 'actor', id: actorId }, title: set.title, displayTitle: unitDisplayTitle(set),
        eyebrow: `Set ${String(set.order + 1).padStart(2, '0')} · 片场导演`,
        description: actor?.summary ?? set.description, status: actor?.paused ? 'paused' : actor?.status ?? set.status,
        progress: `${accepted} / ${clips.length} Clip 已选用`, expanded: open, setId: set.id,
      })
      // The collapsed group IS the director card. Keep its semantic child ID
      // and saved local anchor for reopening and the mobile outline.
      director.hidden = !open
      group.data = { ...director.data, ports: [] }
      if (open) {
        const memory = child(`memory:${set.id}`, 16, director.position.y + nodeSize(director, measurements).height + cardRowGap, {
          selection: { kind: 'memory', id: set.id }, title: `${unitLabel(project)}记忆`, eyebrow: set.title,
          description: '剧情记忆与视觉资产', progress: '计划、实际观察与绑定的资产', setId: set.id,
        })
        const preview = child(`preview:${set.id}`, 16, memory.position.y + STUDIO_CARD_HEIGHT + cardRowGap, {
          selection: { kind: 'set-preview', id: set.id }, title: `${unitLabel(project)}连播`, eyebrow: set.title,
          description: '顺序播放当前已选用的 Clip', progress: `${accepted} / ${clips.length} Clip 已选用`, setId: set.id,
        })
        preview.type = 'setPreview'
        let clipY = 64
        clips.forEach((clip, index) => {
          const candidate = newestCandidate(project, clip)
          const userSelection = candidate?.analysis?.user_selection
          const frame = candidate?.end_state?.frame_media_id
          const thumbnail = frame ? project.media?.[frame]?.url : undefined
          const clipNode = child(`clip:${clip.id}`, 16 + STUDIO_CARD_WIDTH + cardColumnGap, clipY, {
            selection: { kind: 'clip', id: clip.id }, title: clip.title,
            eyebrow: `Clip ${String(clip.order + 1).padStart(2, '0')}`, description: clip.description,
            status: clip.status, progress: `${clip.duration} 秒 · 修复 ${clip.repair_count ?? 0} 次`, thumbnail,
            temporarySelection: Boolean(userSelection && typeof userSelection === 'object' && (userSelection as Record<string, unknown>).temporary === true), setId: set.id,
            compromiseSelection: candidate?.selection?.kind === 'director_compromise',
            systemFallbackSelection: candidate?.selection?.kind === 'system_fallback',
          })
          clipY = clipNode.position.y + nodeSize(clipNode, measurements).height + cardRowGap
          if (index > 0) edges.push({
            id: `sequence:${clips[index - 1].id}:${clip.id}`, source: `clip:${clips[index - 1].id}`, target: `clip:${clip.id}`,
            sourceHandle: 'bottom', targetHandle: 'top', type: 'workspace',
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--studio-sequence)', width: 18, height: 18 },
            ariaLabel: `${clips[index - 1].title} 接续 ${clip.title}`, className: 'studio-sequence-edge',
          })
        })
      }
      const childBounds: Bounds[] = []
      const visibleChildren = children.filter((node) => !node.hidden)
      for (const node of [...visibleChildren].sort((a, b) => Number(Boolean(layout?.nodes?.[b.id])) - Number(Boolean(layout?.nodes?.[a.id])))) {
        node.position = placeAround(boundsFor(node, measurements), childBounds, cardColumnGap)
        childBounds.push(boundsFor(node, measurements))
      }
      group.width = Math.max(group.width!, ...visibleChildren.map((node) => node.position.x + nodeSize(node, measurements).width + 16))
      group.height = Math.max(collapsedSetHeight, ...visibleChildren.map((node) => node.position.y + nodeSize(node, measurements).height + 20))
      group.style = { width: group.width, height: group.height }
  }
  // Shared memory is an independent layer: its position, size and folded content
  // must never displace production cards or change the default ProductionSet origin.
  const occupied = nodes.filter((node) => !node.parentId && node.type !== 'setGroup' && node.type !== 'globalMemory').map((node) => boundsFor(node, measurements))
  const originX = Math.max(1040, ...occupied.map((rect) => rect.x + rect.width + 120))
  const defaults = layoutSetDependencies(sets.map((set) => ({
    id: set.id, dependsOn: generationDependencies(project, set), width: collapsedSetWidth, height: collapsedSetHeight,
    compactSize: { width: collapsedSetWidth, height: collapsedSetHeight },
  })), { x: originX, y: 0 })
  for (const [index, group] of groups.entries()) if (!layout?.nodes?.[group.id]) {
    group.position = defaults.get(sets[index].id)!
  }
  // User-positioned groups have priority over automatic anchors. All coordinates
  // still originate in the saved map so repeated expand/collapse cannot drift.
  const placementOrder = [...groups].sort((a, b) => Number(Boolean(layout?.nodes?.[b.id])) - Number(Boolean(layout?.nodes?.[a.id])))
  const fixed = [...occupied]
  const compactAnchors = new Map<string, Bounds>()
  for (const group of placementOrder) {
    const bounds = { ...group.position, width: collapsedSetWidth, height: collapsedSetHeight }
    group.position = placeAround(bounds, occupied, 64)
    occupied.push({ ...bounds, ...group.position })
    compactAnchors.set(group.id, { ...bounds, ...group.position })
  }
  const reflow = reflowExpandedFrames(groups.map((group) => ({ id: group.id, anchor: compactAnchors.get(group.id)!, width: group.width!, height: group.height! })), fixed)
  for (const group of groups) group.position = reflow.get(group.id)!
  if (dependencies) for (const set of sets) for (const dependency of generationDependencies(project, set)) {
    const source = sets.find((candidate) => candidate.id === dependency)
    const sourceGroup = groups.find((candidate) => candidate.id === `set:${source?.id}`)
    const targetGroup = groups.find((candidate) => candidate.id === `set:${set.id}`)
    if (source && sourceGroup && targetGroup) {
      const id = `dependency:${source.id}:${set.id}`
      const inheritances = (project.handoff_policy === 'observed-v1' ? set.asset_handoffs ?? [] : []).filter((item) => item.mode === 'observed' && item.source_set_id === source.id)
      const assetNames = [...new Set(inheritances.map((item) => project.assets?.[item.asset_id]?.name ?? item.asset_id))]
      const description = assetNames.length ? `${source.title} → ${set.title}：继承${assetNames.join('、')}的实拍状态，等待对应剧情事件的选片和总导演确认` : `${source.title} 是 ${set.title} 的前置${unitLabel(project)}`
      edges.push({
      id, source: sourceGroup.id, target: targetGroup.id,
      sourceHandle: `${id}:out`, targetHandle: `${id}:in`, type: 'workspace', data: { description },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--studio-dependency)', width: 20, height: 20 },
      ariaLabel: description, className: 'studio-dependency-edge',
      })
    }
  }
  const routes = deferDependencies ? new Map() : routeDependencyGraph(nodes.filter((node) => !node.parentId && node.type !== 'globalMemory')
    .map((node) => ({ id: node.id, ...boundsFor(node, measurements), anchorWidth: STUDIO_CARD_WIDTH, anchorHeight: STUDIO_CARD_HEIGHT })), edges.filter((edge) => edge.id.startsWith('dependency:')))
  for (const edge of edges) {
    const route = routes.get(edge.id)
    if (!route) continue
    groups.find((group) => group.id === edge.source)!.data.ports!.push({ id: edge.sourceHandle!, type: 'source', ...route.source })
    groups.find((group) => group.id === edge.target)!.data.ports!.push({ id: edge.targetHandle!, type: 'target', ...route.target })
  }
  // Measure the finished production layout, including temporarily expanded
  // frames, then span its outer edges. Memory never participates in placement
  // or routing, and explicit saved positions and dimensions remain authoritative.
  const production = nodes.filter((node) => !node.parentId && !node.hidden).map((node) => boundsFor(node, measurements))
  const left = production.length ? Math.min(...production.map((rect) => rect.x)) : 0
  const right = production.length ? Math.max(...production.map((rect) => rect.x + rect.width)) : STUDIO_MEMORY_WIDTH
  const memoryWidth = Math.max(680, savedMemory?.width ?? right - left)
  const memoryTop = production.length ? Math.min(...production.map((rect) => rect.y)) - initialMemoryHeight - 96 : 0
  const globalMemory = add('memory:global', left, memoryTop, {
    selection: { kind: 'memory', id: 'global' }, title: '全局记忆', eyebrow: '全片共享',
    description: '剧情记忆与视觉资产', progress: `${Object.keys(project.assets ?? {}).length} 项资产`, manualHeight: memoryHeight,
  }, { type: 'globalMemory', width: memoryWidth, height: memoryHeight ?? undefined,
    // Keep a manually moved memory panel above ordinary cards without changing
    // their selection or drag behaviour.
    zIndex: 2000, style: { width: memoryWidth, height: memoryHeight ?? undefined }, dragHandle: '.studio-memory-drag' })
  // The mobile reading order follows the same top-to-bottom hierarchy.
  nodes.pop()
  nodes.unshift(globalMemory)
  return { nodes, edges }
}
