import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Film,
  Focus,
  GitBranch,
  GripHorizontal,
  ListTree,
  Maximize2,
  Play,
  X,
  Boxes,
  ClipboardList,
  Layers3,
} from "lucide-react";
import {
  buildStudioProjection,
  STUDIO_CARD_WIDTH as W,
  STUDIO_CARD_HEIGHT as H,
} from "./official/projection";
import { routeDependencyGraph } from "./official/dependencyRouting";
import {
  prepareFilm,
  safePath,
  poster,
  timestamp,
  tellParent,
  projectFor,
} from "./adapter";
import "@xyflow/react/dist/style.css";
import "./official/base.css";
import "./official/theme.css";
import "./official/studio.css";
import "./official/CanvasWorkspace.css";
import { GlobalMemoryNode } from "./GlobalMemory";
import { ArchiveBrowser } from "./ArchiveBrowser";
import { archiveIndex, useFilmArchive } from "./archive";
import "./board.css";
import "./studio-dark.css";

const cardPorts = [
  { id: "left", side: Position.Left, type: "target", offset: 50 },
  { id: "right", side: Position.Right, type: "source", offset: 50 },
  { id: "top", side: Position.Top, type: "target", offset: 50 },
  { id: "bottom", side: Position.Bottom, type: "source", offset: 50 },
];
function Ports() {
  return cardPorts.map(p => <Handle key={p.id} id={p.id} type={p.type} position={p.side} />);
}
function projectedHandles(node) {
  const ports = node.type === "setGroup" ? node.data.ports : cardPorts;
  if (node.type === "globalMemory") return [];
  return ports.map(({ id, side, type, offset }) => {
    const horizontal = side === "top" || side === "bottom";
    const x = horizontal ? node.width * offset / 100 : side === "left" ? 0 : node.width;
    const y = horizontal ? (side === "top" ? 0 : node.height) : node.height * offset / 100;
    return { id, type, position: side, x, y, width: 0, height: 0 };
  });
}
// The published view keeps Studio's port IDs, card classes and nested Set frames.
function NodeCard({ data, group = false }) {
  const { en, selection, thumb, open } = data;
  return (
    <div
      className={`studio-node studio-node--${selection.kind}${group ? " is-expandable" : ""}${data.current ? " current-clip" : ""}`}
      style={{ width: W, height: H }}
    >
      {!group && <Ports />}
      <div className="studio-node-grip" aria-hidden="true">
        <GripHorizontal size={17} />
      </div>
      <button
        className="studio-node-main nodrag"
        onClick={() => open(data)}
        aria-label={`${data.eyebrow} · ${data.title}`}
      >
        <div className="studio-node-heading">
          <span>{data.eyebrow}</span>
        </div>
        <strong>
          {selection.kind === "memory" && <BookOpen size={18} />}
          <span>{data.title}</span>
        </strong>
        <div
          className={"studio-node-preview" + (thumb ? " has-thumbnail" : "")}
        >
          {thumb && <img className="studio-node-frame" src={thumb} alt="" />}
          <p>{data.description}</p>
        </div>
        <footer>
          <span className="studio-node-progress">{data.progress}</span>
        </footer>
      </button>
      {group && (
        <button
          className="studio-set-toggle studio-node-toggle nodrag"
          aria-expanded="false"
          aria-label={`${en ? "Expand" : "展开"} ${data.title}`}
          onClick={() => data.toggle(data.setId)}
        >
          <ChevronDown size={21} />
        </button>
      )}
    </div>
  );
}
function GroupNode({ id, data }) {
  const update = useUpdateNodeInternals();
  const ports = data.ports ?? [];
  const signature = ports.map((p) => `${p.id}${p.side}${p.offset}`).join(",");
  useEffect(() => {
    update(id);
  }, [update, id, signature, data.expanded]);
  return (
    <div className={`studio-set-group${data.expanded ? " is-expanded" : ""}`}>
      {ports.map((p) => (
        <Handle
          key={p.id}
          id={p.id}
          type={p.type}
          position={p.side}
          className="studio-set-port"
          style={
            ["left", "right"].includes(p.side)
              ? { top: `${p.offset}%` }
              : { left: `${p.offset}%` }
          }
        />
      ))}
      {data.expanded ? (
        <div className="studio-set-drag">
          <GripHorizontal size={17} />
          <span>Set {data.setId}</span>
          <strong>{data.title}</strong>
          <button
            className="studio-set-toggle nodrag"
            aria-expanded="true"
            aria-label={`${data.en ? "Collapse" : "收起"} ${data.title}`}
            onClick={() => data.toggle(data.setId)}
          >
            <ChevronUp size={20} />
          </button>
        </div>
      ) : (
        <NodeCard data={data} group />
      )}
    </div>
  );
}
function StudioEdge(props) {
  const points = props.data?.route;
  const path = points
    ? points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")
    : getSmoothStepPath(props)[0];
  return (
    <g>
      <title>{props.data?.label}</title>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} />
    </g>
  );
}
const nodeTypes = {
  globalMemory: GlobalMemoryNode,
  studio: NodeCard,
  setGroup: GroupNode,
  setPreview: NodeCard,
};
const edgeTypes = { workspace: StudioEdge };
function cardBounds(nodes) {
  const left = Math.min(...nodes.map(n => n.position.x));
  const top = Math.min(...nodes.map(n => n.position.y));
  const right = Math.max(...nodes.map(n => n.position.x + n.width));
  const bottom = Math.max(...nodes.map(n => n.position.y + n.height));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
const fitMargin = (width, height) => Math.min(20, width / 16, height / 16);
function Board({ data, lang, requested, go, index, zoom }) {
  const { filmId, groups, clips, byNumber, archivedLayout } = data;
  const initial = byNumber.has(requested.number)
    ? byNumber.get(requested.number)
    : clips[0];
  const [selected, setSelected] = useState(initial.number),
    [expandedSets, setExpandedSets] = useState(() => new Set<string>()),
    [focusedSet, setFocusedSet] = useState(requested.number ? initial.set : null),
    [inspector, setInspector] = useState(
      requested.inspect ? { kind: "clip", id: initial.number } : null,
    ),
    [dependencies, setDependencies] = useState(true),
    [viewRequest, requestView] = useState(0);
  const en = lang === "en",
    i = en ? 0 : 1;
  const t = (enText, zhText) => (en ? enText : zhText);
  const flow = useReactFlow();
  const surface = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false),
    [mobile, setMobile] = useState(
      () => matchMedia("(max-width:700px)").matches,
    ),
    [mobileList, setMobileList] = useState(false);
  const [offsets, setOffsets] = useState({});
  const [dragged, setDragged] = useState({});
  const revealSet = useCallback((id) => {
    setExpandedSets(prev => prev.has(id) ? prev : new Set([...prev, id]));
    setFocusedSet(id);
    setMobileList(false);
    requestView(v => v + 1);
  }, []);
  const fitCards = useCallback(() => {
    setFocusedSet(null);
    setInspector(null);
    setMobileList(false);
    requestView(v => v + 1);
  }, []);
  const setClip = useCallback(
    (n, broadcast = true, inspect = false) => {
      const c = byNumber.get(n);
      if (!c) return;
      setSelected(n);
      revealSet(c.set);
      if (inspect) setInspector({ kind: "clip", id: n });
      else setInspector(null);
      if (broadcast)
        tellParent({ type: "stateweaver-select-shot", filmId, number: n });
    },
    [filmId, byNumber, revealSet],
  );
  const toggle = useCallback((id) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    fitCards();
  }, [fitCards]);
  function open(data) {
    const kind = data.selection.kind,
      id = data.selection.id;
    if (kind === "clip") {
      setClip(id, true, true);
      return;
    }
    if (data.setId && kind === "actor" && !data.expanded) {
      toggle(data.setId);
      return;
    }
    if (!data.setId && kind === "actor") {
      go({ page: "records", cat: "actors", id: `actor:${id}` });
      return;
    }
    if (kind === "memory") {
      go({
        page: "memory",
        scope: data.setId ? `set:${data.setId}` : "global",
      });
      return;
    }
    if (data.setId && kind === "actor") {
      go({ page: "records", cat: "sets", id: `set:${data.setId}` });
      return;
    }
    if (data.setId) {
      setInspector({
        kind: kind === "set-preview" ? "preview" : kind,
        id: data.setId,
      });
      revealSet(data.setId);
      return;
    }
  }
  useEffect(() => {
    document.documentElement.lang = en ? "en" : "zh-CN";
    document.title = `AgentVideo Studio · ${data.film.title[i]}`;
  }, [en, i, data]);
  useEffect(() => {
    const q = matchMedia("(max-width:700px)");
    const onSize = () => setMobile(q.matches);
    q.addEventListener("change", onSize);
    return () => q.removeEventListener("change", onSize);
  }, []);
  const selectionRef = useRef(selected);
  selectionRef.current = selected;
  useEffect(() => {
    const c = byNumber.get(requested.number);
    if (c) setClip(c.number, false, !!requested.inspect);
    else {
      setExpandedSets(prev => prev.size ? new Set<string>() : prev);
      fitCards();
    }
  }, [requested, byNumber, setClip, fitCards]);
  const project = useMemo(() => projectFor(data, i), [data, i]);
  const projection = useMemo(() => {
    const nodesMap = { ...archivedLayout?.nodes, ...offsets };
    const result = buildStudioProjection(
      project,
      expandedSets,
      dependencies,
      { nodes: nodesMap },
      {},
      true,
    );
    const nodes = result.nodes.filter(n => !n.hidden);
    const production = nodes.filter(n => !n.parentId && n.type !== "globalMemory");
    const routes = routeDependencyGraph(
      production
        .map((n) => ({
          id: n.id,
          ...n.position,
          width: n.width,
          height: n.height,
          anchorWidth: W,
          anchorHeight: H,
        })),
      result.edges.filter((e) => e.id.startsWith("dependency:")),
    );
    const edges = (dependencies ? result.edges : []).map((e) => {
      const route = routes.get(e.id);
      if (route) {
        const a = nodes.find((n) => n.id === e.source),
          b = nodes.find((n) => n.id === e.target);
        a.data.ports.push({
          id: e.sourceHandle,
          type: "source",
          ...route.source,
        });
        b.data.ports.push({
          id: e.targetHandle,
          type: "target",
          ...route.target,
        });
      }
      return { ...e, data: { route: route?.points, label: e.ariaLabel } };
    });
    return { nodes, edges, production };
  }, [project, dependencies, expandedSets, offsets, archivedLayout]);
  // Reserve a readable strip above the fitted production cards, including when a Set changes size.
  const model = useMemo(() => {
    const bounds = cardBounds(projection.production);
    const { width, height } = canvasSize;
    const margin = fitMargin(width, height);
    const stripHeight = Math.min(width < 520 ? 152 : 184, height * 0.43);
    const gap = Math.min(12, height * 0.035);
    const scale = width && height ? Math.max(0.01, Math.min(
      1, (width - 2 * margin) / bounds.width,
      (height - 2 * margin - stripHeight - gap) / bounds.height,
    )) : 1;
    const memoryHeight = stripHeight ? stripHeight / scale : H;
    const nodes = projection.nodes.map(n => n.type !== "globalMemory" ? n : {
      ...n,
      width: bounds.width, height: memoryHeight,
      style: { width: bounds.width, height: memoryHeight },
      position: offsets[n.id] ?? { x: bounds.left, y: bounds.top - memoryHeight - gap / scale },
      data: { ...n.data, fitScale: scale },
      dragHandle: ".overview-grip", zIndex: 4,
    });
    return { nodes, edges: projection.edges };
  }, [projection, canvasSize, offsets]);
  const nodes = model.nodes.map((node) => {
    const d = { ...node.data, en, open, toggle };
    const set = groups.find((g) => g.number === d.setId);
    const list = clips.filter((c) => c.set === d.setId);
    const n = d.selection.id;
    const c = byNumber.get(n);
    if (c && d.selection.kind === "clip") {
      d.title = c.title[i];
      d.eyebrow = `Clip ${c.number}`;
      d.thumb = poster(c);
      d.progress = `${timestamp(c.start)} · ${c.duration.toFixed(1)} s`;
      d.current = n === selected;
    } else if (d.selection.kind === "actor" && !set) {
      const writer = n === "writer";
      d.title = writer
        ? t("Screenwriter", "编剧")
        : t("Executive director", "总导演");
      d.eyebrow = writer
        ? t("Story development", "创作入口")
        : t("Film coordination", "全片统筹");
      d.description = data.film.title[i];
      d.progress = "";
    } else if (d.selection.kind === "actor") {
      d.eyebrow = `Set ${set.number} · ${t("Set director", "片场导演")}`;
      d.title = set.title[i];
      d.description = set.summary[i];
      d.progress = `${list.length} ${t("clips", "个片段")}`;
      d.thumb = poster(list.find((c) => c.number === selected) ?? list[0]);
    } else if (d.selection.kind === "memory" && !set) {
      Object.assign(d, { i, index, open: go, projectData: data });
    } else if (d.selection.kind === "memory") {
      d.eyebrow = `Set ${set.number}`;
      d.title = t("Set memory", "片场记忆");
      const assets = [
        ...new Set(list.flatMap((c) => c.assets.map((a) => a[i]))),
      ];
      d.description = assets.slice(0, 4).join(en ? " · " : "、");
      d.progress = t(
        `${assets.length} visual assets`,
        `${assets.length} 项视觉资产`,
      );
      d.thumb = safePath(list.find((c) => c.ref)?.ref);
    } else if (d.selection.kind === "set-preview") {
      d.eyebrow = `Set ${set.number}`;
      d.title = t("Set preview", "片场连播");
      d.description = t(
        "Play the selected clips in sequence.",
        "按片场顺序播放已选用片段。",
      );
      d.progress = `${list.length} ${t("clips", "个片段")}`;
      d.thumb = poster(list[0]);
    }
    return {
      ...node,
      handles: projectedHandles(node),
      measured: { width: node.width, height: node.height },
      position: dragged[node.id] ?? node.position,
      selected: d.current || false,
      data: d,
    };
  });
  const modelRef = useRef(model);
  modelRef.current = model;
  const center = useCallback(() => {
    const w = surface.current?.clientWidth,
      h = surface.current?.clientHeight;
    if (!ready || !w || !h) return;
    const nodes = modelRef.current.nodes;
    const candidates = focusedSet
      ? nodes.filter(n => n.id === `set:${focusedSet}`)
      : nodes.filter(n => !n.parentId);
    // The projection sizes every Set frame to enclose its nested cards.
    if (!candidates.length) return;
    const { left, top, right, bottom } = cardBounds(candidates);
    const margin = fitMargin(w, h);
    let zoom = Math.min(1, (w - 2 * margin) / (right - left), (h - 2 * margin) / (bottom - top));
    let centerY = (top + bottom) / 2;
    if (focusedSet) {
      zoom = Math.min(0.8, (w - 2 * margin) / (right - left));
      const members = nodes.filter(
        (n) =>
          n.parentId === `set:${focusedSet}` && n.data.selection.kind === "clip",
      );
      const focus =
        members.find((n) => n.data.selection.id === selectionRef.current) ??
        members[0];
      if (focus) {
        const half = h / (2 * zoom);
        centerY = Math.max(
          top + half - 18,
          Math.min(
            bottom - half + 18,
            top + focus.position.y + focus.height / 2,
          ),
        );
      }
    }
    flow.setViewport(
      {
        zoom,
        x: (w - (right - left) * zoom) / 2 - left * zoom,
        y: h / 2 - centerY * zoom,
      },
      { duration: 0 },
    );
  }, [flow, ready, focusedSet]);
  useEffect(() => {
    const element = surface.current;
    if (!element || mobileList) return;
    const measure = () => {
      const width = element.clientWidth, height = element.clientHeight;
      setCanvasSize(prev => prev.width === width && prev.height === height ? prev : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [mobileList]);
  useEffect(() => {
    if (!mobileList) center();
  }, [center, canvasSize, mobileList, viewRequest]);
  const focusSet = (n) => {
    revealSet(n);
    setInspector(null);
  };
  const inspectorClip = byNumber.get(inspector?.id);
  const inspectorSet = groups.find((g) => g.number === inspector?.id);
  const roleTitle =
    inspector?.id === "writer"
      ? t("Screenwriter", "编剧")
      : t("Executive director", "总导演");
  const [playIndex, setPlayIndex] = useState(0);
  useEffect(() => {
    setPlayIndex(0);
  }, [inspector?.id, inspector?.kind]);
  const playlist = clips.filter((c) => c.set === inspector?.id);
  const activeVideo =
    inspectorClip ??
    (inspector?.kind === "preview" ? playlist[playIndex] : null);
  const clipRows = (list) =>
    list.map((c) => (
      <button
        className={`tree-clip${c.number === selected ? " chosen" : ""}`}
        key={c.number}
        onClick={() => setClip(c.number, true, true)}
      >
        <span>{c.number}</span>
        <span>{c.title[i]}</span>
        <Play size={12} />
      </button>
    ));
  return (
    <div
      className="studio-root focused-studio"
      data-selected={selected}
      data-film={filmId}
    >
      <header className="board-header">
        <div className="studio-brand">
          <Clapperboard size={20} />
          <b>AgentVideo</b>
          <span>Studio</span>
        </div>
        <span className="project-title">{project.title}</span>
      </header>
      <div className="board-body">
        {!mobile && (
          <aside className="board-outline">
            <div className="studio-outline-progress">
              <span>{t("Production progress", "制作进度")}</span>
              <strong>
                {data.accepted}
                <small>
                  {" "}
                  / {clips.length} {t("selected", "已选用")}
                </small>
              </strong>
              <progress value={data.accepted} max={clips.length} />
            </div>
            <div className="outline-label">{t("Sets", "片场")}</div>
            <div className="outline-scroll">
              {groups.map((g) => (
                <div key={g.number}>
                  <button
                    onClick={() =>
                      focusedSet === g.number
                        ? toggle(g.number)
                        : focusSet(g.number)
                    }
                    className={`outline-set${focusedSet === g.number ? " chosen" : ""}`}
                    aria-expanded={focusedSet === g.number}
                  >
                    <span>{g.number}</span>
                    <b>{g.title[i]}</b>
                    <ChevronDown size={13} />
                  </button>
                  {focusedSet === g.number && (
                    <div className="outline-clips">
                      {clipRows(clips.filter((c) => c.set === g.number))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
        <main className="studio-canvas studio-canvas-workspace">
          <div className="studio-canvas-toolbar">
            <div>
              <Film size={18} />
              <h2>{t("Production canvas", "制作画布")}</h2>
            </div>
            <div>
              {mobile && (
                <button className="tool icon" onClick={() => setMobileList(!mobileList)}
                  aria-label={t("Set list", "片场列表")} aria-expanded={mobileList}>
                  <ListTree size={16} />
                </button>
              )}
              <button className={"tool" + (dependencies ? " active" : "")}
                aria-label={t("Connections", "连线")} aria-pressed={dependencies}
                onClick={() => setDependencies(!dependencies)}>
                <GitBranch size={15} />
                {!mobile && t("Connections", "连线")}
              </button>
              <button className="tool" onClick={fitCards}
                aria-label={t("Fit all cards", "适应全部卡片")} title={t("Fit all cards", "适应全部卡片")}>
                <Maximize2 size={16} />{!mobile && t("Fit all cards", "适应全部卡片")}
              </button>
              <button className="tool icon" onClick={() => focusSet(byNumber.get(selected).set)}
                aria-label={t("Focus selected clip", "聚焦选中片段")}>
                <Focus size={17} />
              </button>
            </div>
          </div>
          {mobile && mobileList ? (
            <div className="mobile-outline">
              <div className="mobile-sets">
                {groups.map(g => (
                  <button key={g.number} onClick={() => focusSet(g.number)}>
                    <span>Set {g.number}</span><b>{g.title[i]}</b><ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flow-wrap" ref={surface}>
              <ReactFlow
                nodes={nodes}
                edges={model.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={() => setReady(true)}
                minZoom={0.01}
                maxZoom={1.7}
                onlyRenderVisibleElements={false}
                nodesDraggable
                nodesConnectable={false}
                onNodesChange={(changes) => {
                  const moved = changes.filter(
                    (c) => c.type === "position" && c.dragging && c.position,
                  );
                  if (!moved.length) return;
                  setDragged((prev) => ({
                    ...prev,
                    ...Object.fromEntries(moved.map((c) => [c.id, c.position])),
                  }));
                }}
                onNodeDragStop={(_, n) => {
                  setOffsets((v) => ({
                    ...v,
                    [n.id]: { ...v[n.id], x: n.position.x, y: n.position.y },
                  }));
                  setDragged({});
                }}
                elementsSelectable={false}
                panOnDrag
                panOnScroll={false}
                zoomOnScroll={false}
                zoomOnPinch
                deleteKeyCode={null}
                preventScrolling={false}
              >
                <Background
                  variant={BackgroundVariant.Lines}
                  gap={40}
                  lineWidth={0.8}
                  color="var(--studio-grid)"
                />
                <Controls showInteractive={false} showFitView={false} />
              </ReactFlow>
            </div>
          )}
          {inspector && (
            <aside
              className="board-inspector"
              role="region"
              aria-label={t("Selection details", "选中项详情")}
            >
              <header>
                <div>
                  <small>
                    {inspectorClip
                      ? `Clip ${inspectorClip.number}`
                      : inspectorSet
                        ? `Set ${inspectorSet.number}`
                        : project.title}
                  </small>
                  <h3>
                    {inspectorClip?.title[i] ??
                      (inspector.kind === "memory"
                        ? t("Set memory", "片场记忆")
                        : inspector.kind === "preview"
                          ? t("Set preview", "片场连播")
                          : inspectorSet
                            ? inspectorSet.title[i]
                            : roleTitle)}
                  </h3>
                </div>
                <button
                  className="tool icon"
                  aria-label={t("Close details", "关闭详情")}
                  onClick={() => setInspector(null)}
                >
                  <X size={18} />
                </button>
              </header>
              {activeVideo && safePath(activeVideo.src) && (
                <Player
                  key={activeVideo.number}
                  clip={activeVideo}
                  autoplay={inspector.kind === "preview" && playIndex > 0}
                  advance={() => {
                    if (
                      inspector.kind === "preview" &&
                      playIndex + 1 < playlist.length
                    )
                      setPlayIndex(playIndex + 1);
                  }}
                />
              )}
              <div className="inspector-body">
                {inspectorClip && (
                  <div className="detail-actions">
                    <button
                      className="sub-button"
                      onClick={() =>
                        go({
                          page: "records",
                          cat: "clips",
                          id: `clip:${inspectorClip.number}`,
                        })
                      }
                    >
                      {t("Clip record", "镜头档案")} <ChevronRight size={13} />
                    </button>
                    <button
                      className="sub-button"
                      onClick={() =>
                        go({
                          page: "memory",
                          scope: `clip:${inspectorClip.number}`,
                        })
                      }
                    >
                      {t("Clip memory", "镜头记忆")} <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                {inspector.kind === "role" ? (
                  <>
                    <p>{roleTitle}</p>
                  </>
                ) : inspectorClip ? (
                  <>
                    <p className="metadata">
                      {timestamp(inspectorClip.start)} ·{" "}
                      {inspectorClip.duration.toFixed(2)} s
                    </p>
                    <p>{inspectorClip.caption?.[i]}</p>
                    {inspectorClip.assets.length > 0 && (
                      <details>
                        <summary>{t("Visual assets", "视觉资产")}</summary>
                        <p>
                          {inspectorClip.assets
                            .map((a) => a[i])
                            .join(en ? " · " : "、")}
                        </p>
                      </details>
                    )}
                    {inspectorClip.brief?.[i] && (
                      <details>
                        <summary>{t("Shot brief", "分镜要求")}</summary>
                        <p>{inspectorClip.brief[i]}</p>
                      </details>
                    )}
                    {(inspectorClip.refs?.length ||
                      safePath(inspectorClip.ref)) && (
                      <details>
                        <summary>{t("Visual references", "视觉参考")}</summary>
                        {(
                          inspectorClip.refs ?? [
                            {
                              src: inspectorClip.ref,
                              label: inspectorClip.refLabel,
                            },
                          ]
                        )
                          .filter((item) => safePath(item.src))
                          .map((item) => (
                            <figure className="asset-figure" key={item.src}>
                              <button
                                className="field-image"
                                onClick={() =>
                                  zoom(safePath(item.src), item.label?.[i])
                                }
                              >
                                <img
                                  src={safePath(item.src)}
                                  alt={item.label?.[i] ?? ""}
                                />
                              </button>
                              <figcaption>{item.label?.[i]}</figcaption>
                            </figure>
                          ))}
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p>{inspectorSet.summary[i]}</p>
                    {inspector.kind === "memory" && (
                      <div className="ref-list">
                        <p>
                          {[
                            ...new Set(
                              playlist.flatMap((c) =>
                                c.assets.map((a) => a[i]),
                              ),
                            ),
                          ].join(en ? " · " : "、")}
                        </p>
                        {playlist
                          .filter((c) => safePath(c.ref))
                          .map((c) => (
                            <figure key={c.number}>
                              <img src={safePath(c.ref)} alt="" />
                              <figcaption>
                                {c.number} · {c.refLabel?.[i]}
                              </figcaption>
                            </figure>
                          ))}
                      </div>
                    )}
                    {clipRows(playlist)}
                  </>
                )}
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
function Player({ clip, advance, autoplay = false }) {
  const ref = useRef(null);
  const limit = Number(clip.playEnd);
  const start = Number(clip.playStart ?? 0);
  const finish = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    advance?.();
  };
  return (
    <video
      ref={ref}
      src={safePath(clip.src)}
      poster={poster(clip)}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={() => {
        const v = ref.current;
        if (!v) return;
        v.currentTime = start;
        if (autoplay) v.play().catch(() => {});
      }}
      onSeeking={() => {
        const v = ref.current;
        if (!v) return;
        if (v.currentTime < start - 0.08) v.currentTime = start;
        else if (Number.isFinite(limit) && v.currentTime > limit + 0.1) {
          v.pause();
          v.currentTime = limit;
        }
      }}
      onPlay={() => {
        const v = ref.current;
        if (
          v &&
          (v.currentTime < start - 0.12 ||
            (Number.isFinite(limit) && v.currentTime >= limit - 0.08))
        )
          v.currentTime = start;
      }}
      onTimeUpdate={() => {
        const v = ref.current;
        if (v && !v.paused && Number.isFinite(limit) && v.currentTime >= limit)
          finish();
      }}
      onEnded={finish}
    />
  );
}
const navItems = [
  ["canvas", GitBranch, "Production", "制作"],
  ["screenplay", BookOpen, "Screenplay", "剧本"],
  ["memory", Layers3, "Memory", "记忆"],
  ["assets", Boxes, "Assets", "资产"],
  ["records", ClipboardList, "Records", "制作记录"],
  ["final", Film, "Final film", "成片"],
];
function Studio({ data, lang, intent }) {
  const i = lang === "zh" ? 1 : 0,
    t = (a, b) => (i ? b : a);
  const [stack, setStack] = useState([{ page: "canvas" }]);
  const route = stack.at(-1);
  const detailed = route.page !== "canvas";
  const { archive, error, retry } = useFilmArchive(data.filmId, detailed);
  const index = useMemo(() => archiveIndex(archive), [archive]);
  const [photo, setPhoto] = useState(null);
  const go = useCallback((r, replace = false) => {
    setPhoto(null);
    setStack((s) => {
      const current = s.at(-1);
      if (JSON.stringify(current) === JSON.stringify(r)) return s;
      return replace ? [...s.slice(0, -1), r] : [...s, r];
    });
  }, []);
  const root = (page) => {
    setPhoto(null);
    setStack([{ page }]);
  };
  const back = () => {
    setPhoto(null);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ page: "canvas" }]));
  };
  const zoom = (src, title) => {
    if (src) setPhoto({ src, title });
  };
  const selectClip = (number, broadcast = true) => {
    if (!data.byNumber.has(number)) return;
    go({ page: "canvas", number, inspect: true });
    if (broadcast)
      tellParent({
        type: "stateweaver-select-shot",
        filmId: data.filmId,
        number,
      });
  };
  useEffect(() => {
    if (intent.filmId !== data.filmId) return;
    if (intent.focus === "canvas") root("canvas");
    else if (intent.focus === "clip" && data.byNumber.has(intent.number)) {
      setPhoto(null);
      setStack([
        { page: "canvas" },
        { page: "canvas", number: intent.number, inspect: true },
      ]);
    }
  }, [intent, data]);
  useEffect(() => {
    document.documentElement.lang = i ? "zh-CN" : "en";
    document.title = `AgentVideo Studio · ${data.film.title[i]}`;
  }, [data, i]);
  useEffect(() => {
    const key = (e) => {
      if (e.key !== "Escape") return;
      if (photo) setPhoto(null);
      else tellParent({ type: "stateweaver-close-board" });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [photo]);
  return (
    <div
      className="studio-root new-studio"
      data-film={data.filmId}
      data-page={route.page}
    >
      <header className="production-head">
        <div className="studio-sign">
          <Clapperboard size={20} />
          <b>AgentVideo</b>
          <span>Studio</span>
        </div>
        <span className="production-film">{data.film.title[i]}</span>
      </header>
      <nav className="stage-tabs" aria-label={t("Studio views", "工作区视图")}>
        {navItems.map(([page, Icon, en, zh]) => (
          <button
            aria-current={
              route.page === page
                ? "page"
                : undefined
            }
            key={page}
            onClick={() => root(page)}
          >
            <Icon size={15} />
            <span>{t(en, zh)}</span>
          </button>
        ))}
      </nav>
      {route.page === "canvas" ? (
        <Board
          data={data}
          lang={lang}
          requested={route}
          go={go}
          index={index}
          zoom={zoom}
        />
      ) : (
        <ArchiveBrowser
          archive={archive}
          index={index}
          data={data}
          i={i}
          route={route}
          go={go}
          back={back}
          selectClip={selectClip}
          zoom={zoom}
          error={error}
          retry={retry}
          Player={Player}
        />
      )}
      {photo && <ImageViewer item={photo} close={() => setPhoto(null)} i={i} />}
    </div>
  );
}
function ImageViewer({ item, close, i }) {
  const ref = useRef(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const d = ref.current;
    const node = document.activeElement;
    d.showModal();
    return () => {
      d.close();
      if (node?.isConnected) node.focus();
    };
  }, []);
  return (
    <dialog
      className="image-viewer"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <header>
        <span>{item.title}</span>
        <button onClick={() => setFull((v) => !v)} aria-pressed={full}>
          <Maximize2 size={17} />
          {i ? "原始比例" : "Actual size"}
        </button>
        <button onClick={close} aria-label={i ? "关闭" : "Close"}>
          <X size={20} />
        </button>
      </header>
      <div className={full ? "image-viewport full-image" : "image-viewport"}>
        <img src={item.src} alt={item.title ?? ""} />
      </div>
    </dialog>
  );
}
function App() {
  const films = window.FILMS ?? [],
    records = window.STUDIO_RECORDS ?? {},
    curated = window.CURATED ?? {};
  const params = new URLSearchParams(location.search);
  const initial = params.get("filmId");
  const [filmId, setFilm] = useState(
    records[initial] ? initial : films.find((f) => records[f.id])?.id,
  );
  const [lang, setLang] = useState(params.get("lang") === "zh" ? "zh" : "en");
  const [intent, setIntent] = useState({
    filmId,
    number: params.get("number"),
    focus: params.has("number") ? "clip" : "canvas",
  });
  const data = useMemo(
    () =>
      prepareFilm(
        filmId,
        records[filmId],
        films.find((f) => f.id === filmId),
        curated[filmId],
      ),
    [filmId],
  );
  const currentFilm = useRef(filmId);
  currentFilm.current = filmId;
  useEffect(() => {
    const msg = (e) => {
      if (
        e.source !== window.parent ||
        (location.protocol !== "file:" && e.origin !== location.origin) ||
        e.data?.type !== "stateweaver-board-state"
      )
        return;
      const m = e.data;
      if (m.lang === "en" || m.lang === "zh") setLang(m.lang);
      if (m.filmId && !records[m.filmId]) return;
      const target = m.filmId ?? currentFilm.current;
      const changed = target !== currentFilm.current;
      if (changed) {
        currentFilm.current = target;
        setFilm(target);
      }
      if (m.focus === "clip" || m.focus === "canvas" || m.focus === "overview" || changed)
        setIntent({
          filmId: target,
          number: String(m.number ?? ""),
          focus: m.focus === "clip" ? "clip" : "canvas",
        });
    };
    window.addEventListener("message", msg);
    tellParent({ type: "stateweaver-board-ready" });
    return () => window.removeEventListener("message", msg);
  }, []);
  if (!data?.clips.length)
    return (
      <div className="studio-root empty-board">
        {lang === "en" ? "Production record unavailable" : "制作记录暂不可用"}
      </div>
    );
  return (
    <ReactFlowProvider key={filmId}>
      <Studio data={data} lang={lang} intent={intent} />
    </ReactFlowProvider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
