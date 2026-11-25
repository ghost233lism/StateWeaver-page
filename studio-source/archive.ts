import { gunzipSync } from "fflate";
import { useEffect, useState } from "react";
import { chineseAssetNames, chineseStateNames } from "./asset-names";

const loads = new Map();
async function fromDisk(id) {
  const payload = await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `archive-local/${id}.js`;
    script.onload = () => {
      const pack = window.STUDIO_PACKS?.[id];
      script.remove();
      if (pack) {
        delete window.STUDIO_PACKS[id];
        resolve(pack);
      } else reject(new Error("Film data unavailable"));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Film data unavailable"));
    };
    document.head.append(script);
  });
  const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  return unpackFilm(new Response(bytes));
}
async function unpackFilm(response) {
  if (typeof DecompressionStream === "function" && response.body) {
    return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json();
  }
  const bytes = gunzipSync(new Uint8Array(await response.arrayBuffer()));
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function fetchFilm(id) {
  const response = await fetch(`archive-data/${id}.pack`);
  if (!response.ok) throw new Error("Film data unavailable");
  return unpackFilm(response);
}
function loadFilm(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error("Unknown film"));
  if (!loads.has(id)) {
    if (loads.size >= 2) loads.delete(loads.keys().next().value);
    const load = location.protocol === "file:" ? fromDisk(id) : fetchFilm(id);
    const cached = load.catch(error => {
      if (loads.get(id) === cached) loads.delete(id);
      throw error;
    });
    loads.set(id, cached);
  }
  return loads.get(id);
}
export function useFilmArchive(id, detailed) {
  const [state, setState] = useState({ id: null, archive: null, error: false });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!detailed) return;
    let active = true;
    loadFilm(id)
      .then(archive => { if (active) setState({ id, archive, error: false }); })
      .catch(() => { if (active) setState({ id, archive: null, error: true }); });
    return () => { active = false; };
  }, [id, detailed, attempt]);
  return {
    archive: detailed ? (state.id === id ? state.archive : null) : window.STUDIO_OVERVIEWS[id],
    error: detailed && state.id === id && state.error,
    retry: () => { setState({ id, archive: null, error: false }); retry(n => n + 1); },
  };
}
export const categories = {
  facts: ["Screenplay facts", "剧本事实"],
  events: ["Story events", "剧情事件"],
  sets: ["Sets", "片场"],
  clips: ["Clips", "镜头"],
  actors: ["Crew", "制作团队"],
  assets: ["Visual assets", "视觉资产"],
  states: ["Asset states", "资产状态"],
  references: ["Reference versions", "参考版本"],
  media: ["Media library", "素材库"],
  candidates: ["Candidate takes", "候选片段"],
  referencePlans: ["Reference plans", "参考计划"],
  scopes: ["Memory scopes", "记忆范围"],
  entries: ["Memory entries", "记忆条目"],
  stateLinks: ["Memory states", "记忆状态"],

};
export const categoryFields = {
  facts: "project.screenplay.facts",
  scopes: "memory.scopes",
  entries: "memory.entries",
  stateLinks: "memory.stateLinks",
};
export const label = (v, i) => (Array.isArray(v) ? (v[i] ?? v[0]) : v);
export const human = (s) =>
  String(s ?? "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
export const nonEmpty = (v) =>
  v !== null &&
  v !== undefined &&
  v !== "" &&
  (!Array.isArray(v) || v.length > 0) &&
  (typeof v !== "object" || Object.keys(v).length > 0);
export function rowsOf(archive, cat) {
  const path = categoryFields[cat] ?? cat;
  return path.split(".").reduce((acc, k) => acc?.[k], archive) ?? [];
}
const indices = new WeakMap();
export function archiveIndex(archive) {
  if (archive && indices.has(archive)) return indices.get(archive);
  const lookup = new Map(),
    groups = {},
    backlinks = new Map();
  if (!archive) return { lookup, groups, backlinks };
  for (const cat of Object.keys(categories)) {
    const raw = rowsOf(archive, cat);
    const rows = Array.isArray(raw)
      ? raw
      : Object.entries(raw).map(([id, r]) =>
          typeof r === "object" ? { id, ...r } : { id, title: r },
        );
    groups[cat] = rows;
    for (const row of rows)
      if (row.id && !lookup.has(row.id)) lookup.set(row.id, { cat, row });
  }
  function walk(value, refset) {
    if (typeof value === "string") {
      if (lookup.has(value)) refset.add(value);
    } else if (Array.isArray(value)) {
      value.forEach((x) => walk(x, refset));
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value))
        if (k !== "id") walk(v, refset);
    }
  }
  for (const [id, { cat, row }] of lookup) {
    const refs = new Set();
    walk(row, refs);
    refs.delete(id);
    for (const ref of refs) {
      if (!backlinks.has(ref)) backlinks.set(ref, []);
      backlinks.get(ref).push({ cat, row });
    }
  }
  const index = { lookup, groups, backlinks };
  indices.set(archive, index);
  return index;
}
export function assetPreviewPath(asset, index) {
  if (asset.thumbnail) return asset.thumbnail;
  const states = (index.groups.states ?? []).filter(s => s.asset_id === asset.id);
  const covers = states.find(s => s.thumbnail);
  if (covers) return covers.thumbnail;
  const ids = new Set(states.map(s => s.id));
  return index.groups.references?.find(r => ids.has(r.state_id) && r.thumbnail)?.thumbnail;
}
export function recordTitle(row, cat, i, model, index) {
  if (!row) return "";
  const id = String(row.id ?? "");
  if (i && cat === "assets" && chineseAssetNames[row.name])
    return chineseAssetNames[row.name];
  if (i && cat === "states" && chineseStateNames[row.label])
    return chineseStateNames[row.label];
  if (cat === "candidates") {
    const number = String(row.clip_id ?? "").replace(/^clip:/, ""),
      clip = model.byNumber.get(number),
      archived = index?.lookup.get(row.clip_id)?.row,
      shot = clip?.title?.[i] ?? archived?.title ?? "";
    return `${number} ${shot} · ${i ? "版本" : "Take"} ${String(row.take ?? "").padStart(2, "0")}`.trim();
  }
  if (cat === "references" && index) {
    const st = index.lookup.get(row.state_id)?.row,
      asset = st && index.lookup.get(st.asset_id)?.row;
    const title = asset ? recordTitle(asset, "assets", i, model, index) : "";
    return [title, human(row.view)].filter(Boolean).join(" · ");
  }
  if (cat === "stateLinks" && index) {
    const state = index.lookup.get(row.state_id)?.row;
    if (state) return recordTitle(state, "states", i, model, index);
  }
  if (cat === "scopes") {
    if (id === "global") return i ? "全局记忆" : "Global memory";
    const g = model.groups.find((g) => `set:${g.number}` === id);
    if (g) return `Set ${g.number} · ${g.title[i]}`;
    return i ? "局部记忆" : "Scoped memory";
  }
  if (cat === "entries") {
    const raw = row.text ?? row.title ?? "";
    return excerpt(raw.split(/[。\n]/)[0], 82) || human(row.section ?? "Entry");
  }
  if (cat === "stateLinks") {
    const scope =
      row.scope === "global"
        ? i
          ? "全局"
          : "Global"
        : row.scope?.replace("set:", "Set ");
    return [
      scope,
      i ? "资产状态" : "Asset state",
      String(Number(row.position ?? 0) + 1),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const clip =
    cat === "clips" ? model.byNumber.get(id.replace(/^clip:/, "")) : null;
  const set =
    cat === "sets" ? model.groups.find((g) => `set:${g.number}` === id) : null;
  if (clip) return clip.title[i];
  if (set) return set.title[i];
  return (
    label(row.title ?? row.name ?? row.label, i) ??
    (row.role ? human(row.role) : null) ??
    (row.kind ? human(row.kind) : null) ??
    (row.view ? human(row.view) : null) ??
    categories[cat]?.[i] ??
    human(cat)
  );
}
export const excerpt = (s, n = 148) => {
  const str = typeof s === "string" ? s.trim() : "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
};
export const recordNote = (row) =>
  [
    row?.description,
    row?.text,
    row?.summary,
    row?.reason,
    row?.goal,
    row?.content,
    row?.body,
  ].find((v) => typeof v === "string" && v.trim()) ?? "";
