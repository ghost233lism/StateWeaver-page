import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Film,
  FolderOpen,
  ImageIcon,
  Layers3,
  ListTree,
  Maximize2,
  Search,
  X,
} from "lucide-react";
import {
  assetPreviewPath,
  categories,
  excerpt,
  human,
  label,
  nonEmpty,
  recordNote,
  recordTitle,
} from "./archive";
import { safePath, poster, timestamp } from "./adapter";

const Ctx = createContext(null);
const read = () => useContext(Ctx);
const fields = {
  title: "标题",
  name: "名称",
  text: "内容",
  content: "正文",
  body: "正文",
  summary: "摘要",
  description: "描述",
  goal: "目标",
  status: "状态",
  kind: "类别",
  role: "职责",
  scope: "适用范围",
  scopes: "记忆范围",
  section: "分区",
  basis: "依据",
  assets: "视觉资产",
  orders: "顺序",
  order: "顺序",
  duration: "时长",
  version: "版本",
  revision: "修订",
  view: "视图",
  reason: "说明",
  action: "动作",
  space: "空间",
  camera: "摄影",
  identity: "身份",
  events: "剧情事件",
  starts_at: "开始事件",
  ends_at: "结束事件",
  text_content: "正文",
  actor_id: "负责人",
  set_id: "片场",
  set_ids: "片场",
  clip_id: "镜头",
  clip_ids: "镜头",
  state_id: "状态",
  state_ids: "状态",
  asset_id: "资产",
  asset_ids: "资产",
  revision_id: "参考版本",
  reference_id: "视觉参考",
  selected_revisions: "选定版本",
  previous_candidate_id: "前一版候选",
  accepted_candidate_id: "成片采用",
  target_id: "目标",
  source_set_id: "交接片场",
  story_event_ids: "剧情事件",
  depends_on: "依赖片场",
  source_event_id: "来源事件",
  parent_state_id: "前一状态",
  required_views: "需要的视图",
  source_revision_ids: "来源版本",
  source_candidate_id: "来源候选",
  attributes: "属性",
  evolution: "状态演变",
  parent_id: "上一级",
  story_goal: "剧情目标",
  entry_state: "起始状态",
  exit_state: "结束状态",
  opening_action: "起始动作",
  ending_action: "结束动作",
  handoff_history: "交接记录",
  history: "历史",
  preconditions: "前置状态",
  results: "结果",
  continuity: "连续性",
  bindings: "参考绑定",
  asset_plan: "资产计划",
  prompt: "生成要求",
  story_time: "故事时间",
  story_end_time: "故事结束时间",
  items: "条目",
  selected: "已选用",
  category: "分类",
  labels: "标签",
  references: "参考",
  created_at: "建立时间",
  updated_at: "更新时间",
  notes: "笔记",
  event_id: "事件",
  event_ids: "事件",
  duration_budget: "时长预算",
  required_materials: "所需素材",
  references_used: "使用的参考",
  uses: "用途",
  status_history: "状态历史",
  state_links: "状态索引",
  memory_id: "记忆条目",
  scope_id: "记忆范围",
  document_id: "文档",
  candidate_id: "候选片段",
  previous_id: "上一版本",
  selected_version: "选定版本",
  position: "位置",
  story_clock: "剧情时钟",
  basis_kind: "依据",
  certainty: "确定性",
  material_requests: "素材需求",
  reference_purpose: "参考用途",
  purpose: "用途",
  screenplay: "剧本",
  scene: "场景",
  narration: "旁白",
  dialogue: "对白",
  shots: "分镜",
  scenes: "场景",
  characters: "人物",
  subject: "主体",
  target_seconds: "目标时长",
  minimum_seconds: "最短时长",
  maximum_seconds: "最长时长",
  archived: "已归档",
  number: "编号",
  sets: "片场",
  clips: "镜头",
  stage: "阶段",
  source_duration: "源片时长",
  credits: "制作人员",
  parameters: "参数",
  ordered_clips: "成片顺序",
  resolution: "决议",
  decisions: "决定",
  expected_result: "预期结果",
  state: "状态",
  attributes_before: "初始属性",
  attributes_after: "最终属性",
};
const enums = {
  clip_actual: "镜头实际观察",
  clip_plan: "镜头计划",
  clip_continuation: "镜头接续",
  directives: "导演约定",
  auxiliary: "辅助资产",
  character: "人物",
  person: "人物",
  prop: "道具",
  object: "物体",
  scene: "场景",
  location: "地点",
  other: "其他",
  screenwriter: "编剧",
  executive: "总导演",
  set_director: "片场导演",
  shot_director: "分镜导演",
  material_executor: "素材执行",
  task_analyst: "任务分析",
  visual_analyst: "视觉分析",
  accepted: "已选用",
  selected: "已选用",
  complete: "已完成",
  completed: "已完成",
  archived: "已归档",
  rejected: "未选用",
  candidate: "候选",
  effective: "生效中",
  provisional: "暂定",
  fact: "事实",
  observed: "实际观察",
  plan: "计划",
  unknown: "待确认",
  screenplay: "剧本",
  constraint: "约束",
  full_body: "全身",
  close_up: "特写",
  three_view: "三视图",
  master: "主视图",
  full: "全片",
  global: "全局",
  set: "片场",
  clip: "镜头",
  draft: "初稿",
  superseded: "历史版本",
  event: "事件",
  start: "起始",
  target: "目标",
  base: "基础状态",
  image: "图像",
  video: "视频",
  reference: "参考",
  approved: "已采用",
  final: "定稿",
};
const technical = new Set([
  "id",
  "thumbnail",
  "src",
  "poster",
  "url",
  "filename",
  "path",
  "schemaVersion",
  "film",
  "public_id",
  "sha256",
  "source_verified",
  "schema_version",
]);
const enumKeys = new Set([
  "kind",
  "role",
  "status",
  "view",
  "section",
  "basis",
  "mode",
  "category",
  "certainty",
  "purpose",
  "decision",
  "source",
  "type",
]);
function word(key, i) {
  return i
    ? (fields[key] ?? enums[key] ?? human(key))
    : human(key.replace(/_ids?$/, ""));
}
function heading(row, cat, ctx) {
  return recordTitle(row, cat, ctx.i, ctx.data, ctx.index);
}
function rowNote(row) {
  return excerpt(recordNote(row), 120);
}
function browse(cat, id, ctx) {
  ctx.go({ page: "records", cat, id });
}
function Jump({ id, inline = false }) {
  const ctx = read();
  const item = ctx.index.lookup.get(id);
  if (!item) return null;
  return (
    <button
      className={inline ? "entity-ref" : "entity-jump"}
      onClick={() => browse(item.cat, id, ctx)}
    >
      {!inline && <small>{categories[item.cat]?.[ctx.i]}</small>}
      <span>{heading(item.row, item.cat, ctx)}</span>
      <ChevronRight size={13} />
    </button>
  );
}
function Fold({ title, count, children }) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="field-fold"
      onToggle={(e) => setOpened(e.currentTarget.open)}
    >
      <summary>
        {title}
        {count != null && <small>{count}</small>}
        <ChevronDown size={14} />
      </summary>
      {opened && children}
    </details>
  );
}
function ArrayValue({ value, field, level }) {
  const { t } = read();
  const [limit, setLimit] = useState(20);
  return (
    <>
      <ol className="field-list">
        {value.slice(0, limit).map((v, j) => (
          <li key={j}>
            <Value value={v} field={field} level={level + 1} />
          </li>
        ))}
      </ol>
      {value.length > limit && (
        <button className="sub-button" onClick={() => setLimit((n) => n + 20)}>
          {t("Show more", "展开更多")} · {value.length - limit}
        </button>
      )}
    </>
  );
}
function Value({ value, field, level = 0 }) {
  const ctx = read(),
    { i, t, index } = ctx;
  if (!nonEmpty(value)) return null;
  if (typeof value === "string") {
    if (index.lookup.has(value)) return <Jump id={value} inline />;
    const external = safePath(value);
    if (external) {
      if (/\.(?:mp4|webm)$/i.test(value))
        return <video controls playsInline preload="none" src={external} />;
      return (
        <button
          className="field-image"
          onClick={() => ctx.zoom(external, word(field, i))}
        >
          <img loading="lazy" src={external} alt={word(field, i)} />
        </button>
      );
    }
    const display = enumKeys.has(field)
      ? i
        ? (enums[value] ?? human(value))
        : human(value)
      : value;
    return <p className="archive-prose">{display}</p>;
  }
  if (typeof value === "number" || typeof value === "boolean")
    return (
      <span>
        {typeof value === "boolean"
          ? value
            ? t("Yes", "是")
            : t("No", "否")
          : String(value)}
      </span>
    );
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" && index.lookup.has(v)))
      return (
        <div className="reference-chips">
          {value.map((v, j) => (
            <Jump key={`${j}-${v}`} inline id={v} />
          ))}
        </div>
      );
    return <ArrayValue value={value} field={field} level={level} />;
  }
  return (
    <div className="record-fields">
      {Object.entries(value)
        .filter(([k, v]) => !technical.has(k) && nonEmpty(v))
        .map(([k, v]) => (
          <Field key={k} name={k} value={v} level={level + 1} />
        ))}
    </div>
  );
}
function Field({ name, value, level = 0 }) {
  const { i } = read();
  const complex =
    typeof value === "object" &&
    (Array.isArray(value)
      ? value.length > 3 || value.some((v) => v && typeof v === "object")
      : Object.keys(value).length > 2);
  const long = typeof value === "string" && value.length > 370;
  if (complex || long)
    return (
      <Fold
        title={word(name, i)}
        count={Array.isArray(value) ? value.length : null}
      >
        <Value field={name} value={value} level={level} />
      </Fold>
    );
  return (
    <div className="property">
      <dt>{word(name, i)}</dt>
      <dd>
        <Value field={name} value={value} level={level} />
      </dd>
    </div>
  );
}
function Fields({ row, omit = [] }) {
  return (
    <div className="record-fields">
      {Object.entries(row ?? {})
        .filter(
          ([k, v]) => !technical.has(k) && !omit.includes(k) && nonEmpty(v),
        )
        .map(([k, v]) => (
          <Field name={k} value={v} key={k} />
        ))}
    </div>
  );
}
function Photo({ row, cat }) {
  const ctx = read(),
    url = safePath(row?.thumbnail ?? row?.poster);
  if (!url) return null;
  const title = heading(row, cat, ctx);
  return (
    <button
      className="archive-photo"
      onClick={() =>
        ctx.zoom(
          /\.(?:webp|png|jpe?g|avif)$/i.test(row?.src ?? "")
            ? (safePath(row.src) ?? url)
            : url,
          title,
        )
      }
    >
      <img src={url} alt={title} loading="lazy" />
      <Maximize2 size={16} />
    </button>
  );
}
function Related({ title, rows, cat }) {
  const ctx = read();
  if (!rows?.length) return null;
  return (
    <details className="related-section">
      <summary>
        {title ?? categories[cat]?.[ctx.i]}
        <small>{rows.length}</small>
        <ChevronDown size={15} />
      </summary>
      <div className="relations">
        {rows.map((row) => (
          <button key={row.id} onClick={() => browse(cat, row.id, ctx)}>
            {safePath(row.thumbnail) && (
              <img src={safePath(row.thumbnail)} loading="lazy" alt="" />
            )}
            <span>{heading(row, cat, ctx)}</span>
            <ChevronRight size={14} />
          </button>
        ))}
      </div>
    </details>
  );
}
function PageTitle({ kicker, title, children }) {
  return (
    <header className="archive-head">
      {kicker && <small>{kicker}</small>}
      <h2>{title}</h2>
      {children}
    </header>
  );
}
function Tiles({ rows, cat }) {
  const ctx = read();
  return (
    <div className="record-tiles">
      {rows.map((row) => {
        const image = safePath(row.thumbnail ?? row.poster);
        return (
          <button key={row.id} onClick={() => browse(cat, row.id, ctx)}>
            {image && <img src={image} alt="" loading="lazy" />}
            <span>
              <strong>{heading(row, cat, ctx)}</strong>
              {rowNote(row) && <small>{rowNote(row)}</small>}
            </span>
            <ChevronRight size={14} />
          </button>
        );
      })}
    </div>
  );
}
function RecordsList({ rows, cat, name }) {
  const ctx = read(),
    { t, i } = ctx;
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(24);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? rows.filter((r) =>
          [
            heading(r, cat, ctx),
            recordNote(r),
            r.kind,
            r.status,
            r.role,
            r.view,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : rows;
  }, [rows, cat, query, i]);
  return (
    <>
      <PageTitle
        kicker={ctx.data.film.title[i]}
        title={name ?? categories[cat]?.[i]}
      >
        <span className="record-total">{rows.length}</span>
      </PageTitle>
      <label className="search-field">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(24);
          }}
          placeholder={t("Search this collection", "搜索此分类")}
          aria-label={t("Search this collection", "搜索此分类")}
        />
      </label>
      <Tiles rows={filtered.slice(0, limit)} cat={cat} />
      {!filtered.length && (
        <p className="quiet">{t("No matching entries.", "没有匹配的条目。")}</p>
      )}
      {filtered.length > limit && (
        <button className="sub-button" onClick={() => setLimit((n) => n + 24)}>
          {t("Show more", "展开更多")} <span>{filtered.length - limit}</span>
        </button>
      )}
    </>
  );
}
function Entity({ cat, id }) {
  const ctx = read(),
    { t, i, index, data } = ctx;
  const row =
    cat === "scopes"
      ? (index.groups.scopes ?? []).find((s) => s.id === id)
      : index.lookup.get(id)?.row;
  if (!row) return null;
  const note = recordNote(row);
  const clip =
    cat === "clips"
      ? data.byNumber.get(String(id).replace(/^clip:/, ""))
      : null;
  const related = index.backlinks.get(id) ?? [];
  const by = {};
  for (const r of related) (by[r.cat] ??= []).push(r.row);
  const selectedClip =
    cat === "candidates"
      ? (index.groups.clips ?? []).find((c) => c.accepted_candidate_id === id)
      : null;
  const selectedNote = selectedClip
    ? data.byNumber.get(selectedClip.id.replace(/^clip:/, ""))
    : null;
  const source = safePath(row.src);
  return (
    <>
      <PageTitle kicker={categories[cat]?.[i]} title={heading(row, cat, ctx)} />
      {clip ? (
        <>
          <ctx.Player clip={clip} />
          <div className="detail-actions">
            <button
              className="sub-button"
              onClick={() => ctx.selectClip(clip.number)}
            >
              <Clapperboard size={15} />
              {t("Locate on canvas", "在画布中定位")}
            </button>
          </div>
        </>
      ) : source &&
        (/\.(?:ogg|mp3|m4a|wav)$/i.test(source) ||
          row.mime_type?.startsWith("audio/")) ? (
        <audio controls preload="none" src={source} />
      ) : source && /\.(?:mp4|webm)$/i.test(source) ? (
        <video
          controls
          playsInline
          preload="metadata"
          poster={safePath(row.thumbnail)}
          src={source}
        />
      ) : selectedNote ? (
        <ctx.Player clip={selectedNote} />
      ) : (
        <Photo cat={cat} row={row} />
      )}
      {note && <p className="archive-prose lead-copy">{note}</p>}
      {cat === "assets" && <AssetStates asset={row} />}
      {Object.entries(by)
        .filter(([k]) => !(cat === "assets" && k === "states"))
        .sort(
          (a, b) =>
            [
              "states",
              "references",
              "candidates",
              "entries",
              "referencePlans",
            ].indexOf(b[0]) -
            [
              "states",
              "references",
              "candidates",
              "entries",
              "referencePlans",
            ].indexOf(a[0]),
        )
        .map(([k, rows]) => (
          <Related key={k} rows={rows} cat={k} />
        ))}
      <Fields
        row={row}
        omit={[
          "title",
          "name",
          "label",
          ...[
            "description",
            "text",
            "summary",
            "goal",
            "body",
            "content",
          ].filter((k) => row[k] === note),
        ]}
      />
    </>
  );
}
function AssetStates({ asset }) {
  const ctx = read(),
    { t, index, i } = ctx;
  const states = (index.groups.states ?? []).filter(
    (s) => s.asset_id === asset.id,
  );
  return (
    <div className="asset-states">
      {states.map((s) => {
        const refs = (index.groups.references ?? []).filter(
          (r) => r.state_id === s.id,
        );
        return (
          <section key={s.id}>
            <div className="asset-state-heading">
              <button onClick={() => browse("states", s.id, ctx)}>
                <Layers3 size={15} />
                <b>{heading(s, "states", ctx)}</b>
                <ChevronRight size={14} />
              </button>
              {refs.length > 0 && (
                <span>
                  {refs.length} {t("versions", "个参考版本")}
                </span>
              )}
            </div>
            {s.description && <p>{s.description}</p>}
            <div className="version-grid">
              {refs.map((r, j) => (
                <button
                  key={r.id}
                  onClick={() => browse("references", r.id, ctx)}
                >
                  {safePath(r.thumbnail) && (
                    <img src={safePath(r.thumbnail)} alt="" loading="lazy" />
                  )}
                  <span>
                    {i ? (enums[r.view] ?? human(r.view)) : human(r.view)} ·{" "}
                    {t("v", "版本 ")}
                    {r.version ??
                      r.revision ??
                      refs.slice(0, j + 1).filter((v) => v.view === r.view)
                        .length}
                    {Object.values(s.selected_revisions ?? {}).includes(r.id)
                      ? ` · ${t("Current", "当前")}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function AssetTree({ kinds, assets, states, refs }) {
  const ctx = read(),
    { i, t } = ctx;
  const showState = (node, siblings, visited) => {
    if (visited.has(node.id)) return null;
    const next = new Set(visited);
    next.add(node.id);
    const revisions = refs
      .filter((r) => r.state_id === node.id)
      .sort(
        (a, b) =>
          String(a.created_at ?? "").localeCompare(
            String(b.created_at ?? ""),
          ) || a.id.localeCompare(b.id),
      );
    const views = [...new Set(revisions.map((r) => r.view ?? "reference"))];
    const children = siblings.filter(
      (r) => r.evolution?.parent_state_id === node.id,
    );
    return (
      <details key={node.id} className="tree-state">
        <summary>
          <Layers3 size={13} />
          <span>{heading(node, "states", ctx)}</span>
          <small>{revisions.length}</small>
          <ChevronDown size={13} />
        </summary>
        <div className="asset-branch">
          <button
            className="tree-open"
            onClick={() => browse("states", node.id, ctx)}
          >
            {t("State details", "状态详情")} <ArrowUpRight size={12} />
          </button>
          {views.map((view) => (
            <details key={view} className="tree-version">
              <summary>
                <ImageIcon size={13} />
                <span>{i ? (enums[view] ?? human(view)) : human(view)}</span>
                <small>{revisions.filter((r) => r.view === view).length}</small>
                <ChevronDown size={13} />
              </summary>
              <div className="version-grid">
                {revisions
                  .filter((r) => r.view === view)
                  .map((r, j) => (
                    <button
                      key={r.id}
                      onClick={() => browse("references", r.id, ctx)}
                    >
                      {safePath(r.thumbnail) && (
                        <img
                          src={safePath(r.thumbnail)}
                          loading="lazy"
                          alt=""
                        />
                      )}
                      <span>
                        {t("Version", "版本")} {j + 1}
                        {Object.values(node.selected_revisions ?? {}).includes(
                          r.id,
                        )
                          ? ` · ${t("Current", "当前")}`
                          : ""}
                      </span>
                    </button>
                  ))}
              </div>
            </details>
          ))}
          {children.map((child) => showState(child, siblings, next))}
        </div>
      </details>
    );
  };
  return (
    <div className="archive-tree">
      {kinds.map((kind) => (
        <details className="tree-kind" key={kind} open>
          <summary>
            <FolderOpen size={16} />
            <b>{i ? (enums[kind] ?? human(kind)) : human(kind)}</b>
            <small>{assets.filter((a) => a.kind === kind).length}</small>
            <ChevronDown size={14} />
          </summary>
          <div className="asset-branch">
            {assets
              .filter((a) => a.kind === kind)
              .map((a) => {
                const children = states.filter((s) => s.asset_id === a.id),
                  roots = children.filter(
                    (s) =>
                      !children.some(
                        (o) => o.id === s.evolution?.parent_state_id,
                      ),
                  );
                const cover = safePath(assetPreviewPath(a, ctx.index));
                return (
                  <details className="tree-asset" key={a.id}>
                    <summary>
                      {cover && (
                        <img
                          src={cover}
                          loading="lazy"
                          alt=""
                        />
                      )}
                      <b>{heading(a, "assets", ctx)}</b>
                      <small>
                        {children.length} {t("states", "个状态")}
                      </small>
                      <ChevronDown size={14} />
                    </summary>
                    <div className="asset-branch">
                      <button
                        className="tree-open"
                        onClick={() => browse("assets", a.id, ctx)}
                      >
                        {t("Asset details", "资产详情")}{" "}
                        <ArrowUpRight size={12} />
                      </button>
                      {(roots.length ? roots : children).map((s) =>
                        showState(s, children, new Set()),
                      )}
                    </div>
                  </details>
                );
              })}
          </div>
        </details>
      ))}
    </div>
  );
}
function AssetLibrary() {
  const ctx = read(),
    { index, i, t, route, go } = ctx;
  const rows = index.groups.assets ?? [],
    states = index.groups.states ?? [],
    refs = index.groups.references ?? [];
  const [q, setQ] = useState("");
  const kinds = [...new Set(rows.map((r) => r.kind ?? "other"))];
  const filtered = rows.filter(
    (r) =>
      (!route.kind || r.kind === route.kind) &&
      [heading(r, "assets", ctx), r.name, r.title, r.description]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        kicker={ctx.data.film.title[i]}
        title={t("Visual assets", "视觉资产")}
      >
        <span className="record-total">{rows.length}</span>
      </PageTitle>
      <div className="library-tools">
        <div className="small-tabs">
          {["", ...kinds].map((k) => (
            <button
              key={k}
              aria-pressed={(route.kind ?? "") === k}
              onClick={() => go({ ...route, page: "assets", kind: k }, true)}
            >
              {k ? (i ? (enums[k] ?? human(k)) : human(k)) : t("All", "全部")}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={14} />
          <input
            aria-label={t("Search assets", "搜索资产")}
            placeholder={t("Search assets", "搜索资产")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className="tree-view-switch">
        <button
          aria-pressed={route.view !== "grid"}
          onClick={() => go({ ...route, view: "tree" }, true)}
        >
          <ListTree size={14} />
          {t("Asset tree", "资产树")}
        </button>
        <button
          aria-pressed={route.view === "grid"}
          onClick={() => go({ ...route, view: "grid" }, true)}
        >
          <Boxes size={14} />
          {t("Gallery", "图库")}
        </button>
      </div>
      {route.view !== "grid" ? (
        <AssetTree
          kinds={kinds.filter((k) => filtered.some((a) => a.kind === k))}
          assets={filtered}
          states={states}
          refs={refs}
        />
      ) : (
        <div className="asset-library">
          {filtered.map((a) => {
            const versions = states.filter((s) => s.asset_id === a.id);
            const refsForAsset = refs.filter((r) =>
              versions.some((s) => s.id === r.state_id),
            );
            const cover = safePath(assetPreviewPath(a, index));
            return (
              <button
                className="visual-asset"
                key={a.id}
                onClick={() => browse("assets", a.id, ctx)}
              >
                {cover ? (
                  <img src={cover} alt="" loading="lazy" />
                ) : (
                  <div className="no-thumb">
                    <Boxes size={25} />
                  </div>
                )}
                <div>
                  <small>
                    {i ? (enums[a.kind] ?? human(a.kind)) : human(a.kind)}
                  </small>
                  <strong>{heading(a, "assets", ctx)}</strong>
                  <span>
                    {versions.length} {t("states", "个状态")} ·{" "}
                    {refsForAsset.length} {t("references", "个参考版本")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {!filtered.length && (
        <p className="quiet">{t("No matching assets.", "没有匹配的资产。")}</p>
      )}
    </>
  );
}
function Story() {
  const ctx = read(),
    { t, archive, i, index, data } = ctx;
  const p = archive.project ?? {};
  const brief =
    typeof p.brief === "string" ? p.brief.split(/\n+Source shots\s*:/i)[0] : "";
  const story = p.screenplay ?? archive.screenplay;
  const events = index.groups.events ?? [];
  return (
    <>
      <PageTitle kicker={data.film.title[i]} title={t("Screenplay", "剧本")} />
      <p className="archive-prose lead-copy">
        {story?.manuscript?.logline ?? data.film.description?.[i] ?? brief}
      </p>
      {brief && (
        <details className="field-fold">
          <summary>
            {t("Project brief", "创作要求")}
            <ChevronDown size={15} />
          </summary>
          <p className="archive-prose">{brief}</p>
        </details>
      )}
      {story && (
        <details className="field-fold">
          <summary>
            {t("Screenplay text", "剧本文本")}
            <ChevronDown size={15} />
          </summary>
          <Value field="screenplay" value={story} />
        </details>
      )}
      {events.length > 0 && (
        <>
          <h3 className="archive-subhead">
            {t("Story timeline", "故事时间线")}
          </h3>
          <ol className="event-timeline">
            {events.map((event, j) => (
              <li key={event.id}>
                <span>{String(j + 1).padStart(2, "0")}</span>
                <button onClick={() => browse("events", event.id, ctx)}>
                  <strong>{heading(event, "events", ctx)}</strong>
                  <small>{rowNote(event)}</small>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
function ExportView() {
  const ctx = read(),
    { data, i, t, archive } = ctx;
  const full =
    archive.export?.src ??
    data.clips.find(
      (c) =>
        c.playStart === c.timeSeconds &&
        Math.abs(c.playEnd - c.playStart - c.duration) < 0.75,
    )?.src ??
    data.film.src;
  return (
    <>
      <PageTitle kicker={data.film.title[i]} title={t("Final film", "成片")} />
      <video
        className="final-film-player"
        controls
        playsInline
        preload="none"
        poster={safePath(data.film.poster)}
        src={safePath(full)}
      />
      <h3 className="archive-subhead">{t("Assembly order", "成片顺序")}</h3>
      <div className="assembly">
        {data.clips.map((c) => (
          <button key={c.number} onClick={() => ctx.selectClip(c.number)}>
            <img src={poster(c)} alt="" loading="lazy" />
            <span>
              <small>
                {c.number} · {timestamp(c.start)}
              </small>
              <strong>{c.title[i]}</strong>
            </span>
            <Film size={15} />
          </button>
        ))}
      </div>

    </>
  );
}
function Memory() {
  const ctx = read(),
    { index, i, t, route, go } = ctx;
  const scopes = index.groups.scopes ?? [],
    entries = index.groups.entries ?? [],
    links = index.groups.stateLinks ?? [];
  const [q, setQ] = useState(""),
    [history, setHistory] = useState(true),
    [section, setSection] = useState("");
  const scope = route.scope ?? "global",
    part = route.part ?? "entries",
    current = scopes.find((r) => r.id === scope),
    isClip = scope.startsWith("clip:"),
    owner = index.lookup.get(scope)?.row;
  const match = (r) =>
    scope === "all" ||
    r.owner === scope ||
    r.scope === scope ||
    r.scope?.clip_ids?.includes(scope) ||
    current?.entry_ids?.includes(r.id);
  const scoped = entries.filter(match);
  const sections = [...new Set(scoped.map((e) => e.section).filter(Boolean))];
  const filtered = scoped.filter(
    (e) =>
      (history || e.effective) &&
      (!section || e.section === section) &&
      (!q ||
        [e.text, e.title, recordNote(e)]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const chosen =
    part === "rules"
      ? filtered.filter((e) => ["screenplay", "directives"].includes(e.section))
      : filtered;
  const stateIds = isClip
    ? new Set(
        (owner?.asset_plan ?? [])
          .flatMap((a) => [a.start_state_id, a.end_state_id, a.state_id])
          .filter(Boolean),
      )
    : null;
  const localStates = isClip
    ? (index.groups.states ?? []).filter((s) => stateIds.has(s.id))
    : links.filter(match);
  const eventIds = new Set([
    ...(owner?.story_event_ids ?? []),
    ...scoped.flatMap((e) =>
      [
        ...(e.scope?.event_ids ?? []),
        e.scope?.starts_at?.event_id,
        e.scope?.ends_at?.event_id,
      ].filter(Boolean),
    ),
  ]);
  const eventRows = (index.groups.events ?? []).filter(
    (e) => scope === "all" || scope === "global" || eventIds.has(e.id),
  );
  const title =
    scope === "all"
      ? t("Story memory", "剧情记忆")
      : current
        ? heading(current, "scopes", ctx)
        : `${t("Clip memory", "镜头记忆")} · ${scope.replace("clip:", "")}`;
  const variants = [
    ["entries", "Entries", "条目"],
    ["timeline", "Event timeline", "事件时间线"],
    ["rules", "Film rules", "全片规则"],
    [
      "states",
      isClip ? "Bound states" : "State register",
      isClip ? "绑定状态" : "状态收录",
    ],
  ];
  return (
    <>
      <PageTitle kicker={ctx.data.film.title[i]} title={title} />
      <div className="scope-controls">
        <label>
          {t("Memory scope", "记忆范围")}{" "}
          <select
            value={scope}
            onChange={(e) => {
              setSection("");
              setQ("");
              go({ ...route, scope: e.target.value }, true);
            }}
          >
            <option value="all">{t("Every scope", "所有范围")}</option>
            {scopes.map((s) => (
              <option value={s.id} key={s.id}>
                {heading(s, "scopes", ctx)}
              </option>
            ))}
            <optgroup label={t("Clips", "镜头")}>
              {(index.groups.clips ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id.replace("clip:", "")} · {heading(c, "clips", ctx)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {current?.revision != null && (
          <span>
            {t("Revision", "修订")} {current.revision}
          </span>
        )}
      </div>
      <div className="library-tools">
        <div className="small-tabs">
          {variants.map(([key, en, zh]) => (
            <button
              key={key}
              aria-pressed={part === key}
              onClick={() => go({ ...route, part: key }, true)}
            >
              {t(en, zh)}
            </button>
          ))}
        </div>
      </div>
      {part !== "states" && (
        <div className="memory-tools">
          <label className="search-field">
            <Search size={13} />
            <input
              placeholder={t("Search memory", "搜索记忆")}
              aria-label={t("Search memory", "搜索记忆")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label={t("Memory section", "记忆分类")}
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="">{t("All sections", "全部分类")}</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {i ? (enums[s] ?? human(s)) : human(s)}
              </option>
            ))}
          </select>
          <label className="include-history">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />
            {t("Include history", "包含历史")}
          </label>
        </div>
      )}
      {part === "timeline" ? (
        <ol className="event-timeline">
          {eventRows.map((event, j) => {
            const records = filtered.filter(
              (e) =>
                e.scope?.event_ids?.includes(event.id) ||
                e.scope?.starts_at?.event_id === event.id ||
                e.scope?.ends_at?.event_id === event.id,
            );
            return (
              <li key={event.id}>
                <span>{String(j + 1).padStart(2, "0")}</span>
                <div>
                  <button onClick={() => browse("events", event.id, ctx)}>
                    <strong>{heading(event, "events", ctx)}</strong>
                    <small>{rowNote(event)}</small>
                  </button>
                  {records.length > 0 && (
                    <Related cat="entries" rows={records} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : part === "states" ? (
        <Tiles rows={localStates} cat={isClip ? "states" : "stateLinks"} />
      ) : (
        <Tiles rows={chosen} cat="entries" />
      )}
      {!(
        part === "timeline"
          ? eventRows
          : part === "states"
            ? localStates
            : chosen
      ).length && (
        <p className="quiet">
          {t("No entries in this view.", "此视图没有条目。")}
        </p>
      )}
      {current && (
        <Fold title={t("Scope details", "范围详情")}>
          <Fields row={current} />
        </Fold>
      )}
    </>
  );
}
export function ArchiveBrowser({
  archive,
  index,
  data,
  route,
  go,
  back,
  selectClip,
  zoom,
  i,
  Player,
  error,
  retry,
}) {
  const t = (a, b) => (i ? b : a);
  const ctx = {
    archive,
    index,
    data,
    route,
    go,
    back,
    selectClip,
    zoom,
    i,
    t,
    Player,
  };
  const { page, cat, id } = route;
  const activeCat = cat ?? "sets";
  const content = useRef(null);
  useEffect(() => {
    content.current?.scrollTo(0, 0);
  }, [page, cat, id, route.scope]);
  if (!archive)
    return (
      <section className="archive-loading" role="status">
        {error ? (
          <button className="sub-button" onClick={retry}>
            {t("Reload film records", "重新载入制作记录")}
          </button>
        ) : (
          t("Loading film records…", "正在载入制作记录…")
        )}
      </section>
    );
  return (
    <Ctx.Provider value={ctx}>
      <section className="archive-shell">
        {page === "records" && (
          <nav
            className="collection-nav"
            aria-label={t("Collections", "制作分类")}
          >
            {["sets", "clips", "actors", "candidates", "referencePlans", "media"]
              .filter((k) => index.groups[k]?.length)
              .map((k) => (
                <button
                  key={k}
                  aria-current={activeCat === k ? "page" : undefined}
                  onClick={() => go({ page: "records", cat: k })}
                >
                  <span>{categories[k][i]}</span>
                  <small>{index.groups[k].length}</small>
                </button>
              ))}
          </nav>
        )}
        <article ref={content} className="archive-scroll">
          {id && (
            <button className="archive-back" onClick={back}>
              <ArrowLeft size={14} />
              {t("Back", "返回")}
            </button>
          )}
          {id ? (
            <Entity cat={activeCat} id={id} />
          ) : page === "assets" ? (
            <AssetLibrary />
          ) : page === "screenplay" ? (
            <Story />
          ) : page === "memory" ? (
            <Memory />
          ) : page === "final" ? (
            <ExportView />
          ) : (
            <RecordsList
              key={activeCat}
              rows={index.groups[activeCat] ?? []}
              cat={activeCat}
            />
          )}
        </article>
      </section>
    </Ctx.Provider>
  );
}
