const nameOnly = (title) =>
  String(title ?? "")
    .replace(
      /^\s*(?:(?:set|shot|clip|scene)\s*)?(?:\d{1,3}[a-z]?)\s*[|｜:：.–—\-]+\s*/i,
      "",
    )
    .trim();
const depNumber = (d) => String(d).replace(/^set:/, "");
export function prepareFilm(filmId, record, film, curated) {
  if (!record || !curated) return null;
  const notes = new Map(
    (curated.shots ?? []).map((s) => [String(s.number), s]),
  );
  const clips = [];
  for (const seg of record.segments ?? []) {
    const number = String(seg.key).replace(/^clip:/, "");
    const note = notes.get(number);
    const set = depNumber(seg.shot);
    const baseTitle = nameOnly(seg.title) || number;
    const caption = note?.caption ?? [baseTitle, baseTitle];
    const numberSeconds = Number(seg.cumulative_start);
    clips.push({
      ...note,
      number,
      set,
      title: note?.title ?? [baseTitle, baseTitle],
      scheduledTitle: baseTitle,
      caption,
      duration: Number(seg.source_duration),
      start: Number.isFinite(numberSeconds) ? numberSeconds : note?.timeSeconds,
      status: seg.status,
      references: seg.reference_count,
      assets: seg.assets ?? [],
      storyStart: seg.story_start,
      storyEnd: seg.story_end,
    });
  }
  const groups = (record.shots ?? []).map((s) => {
    const number = String(s.number);
    const list = clips.filter((c) => c.set === number);
    const first = list[0];
    const official = nameOnly(s.title) || `Set ${number}`;
    const hasChinese = /[\u3400-\u9fff]/.test(official);
    const translated = first?.title ?? [official, official];
    const title = [
      hasChinese ? translated[0] : official,
      hasChinese ? official : (s.translated ?? translated[1]),
    ];
    const depends = (s.depends_on ?? []).map(depNumber);
    const done =
      s.selected_clip_count ??
      list.filter((c) => c.status === "accepted").length;
    return {
      number,
      title,
      official,
      depends,
      status: s.status,
      selected: done,
      summary: [
        `${list.length} ${list.length === 1 ? "clip" : "clips"}${depends.length ? ` · Depends on Set ${depends.join(", ")}` : ""}`,
        `${list.length} 个片段${depends.length ? ` · 前置片场 ${depends.join("、")}` : ""}`,
      ],
    };
  });
  return {
    filmId,
    film,
    groups,
    clips,
    byNumber: new Map(clips.map((c) => [c.number, c])),
    archivedLayout: record.workspace_layout ?? { nodes: {} },
    actors: record.actors ?? [],
    accepted:
      record.accepted_clip_count ??
      clips.filter((c) => c.status === "accepted").length,
    selectionRule: record.selection_rule,
  };
}
export const safePath = (path) =>
  typeof path === "string" &&
  /^media\/(?:production|films|studio-archive)\/[a-zA-Z0-9_./-]+\.(?:webp|jpe?g|png|avif|mp4|webm|m4a|mp3|wav)$/i.test(
    path,
  ) &&
  !path.includes("..")
    ? window.exhibitMedia(path, "../")
    : undefined;
export const poster = (clip) => safePath(clip?.poster);
export function timestamp(value) {
  if (!Number.isFinite(value)) return "—";
  const s = Math.floor(value);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function tellParent(message) {
  if (window.parent !== window)
    window.parent.postMessage(
      message,
      location.protocol === "file:" ? "*" : location.origin,
    );
}
export function projectFor(model, i) {
  const sets = {},
    actors = {},
    clipRows = {},
    candidates = {};
  const { groups, clips } = model;
  groups.forEach((g, order) => {
    const id = g.number,
      items = clips.filter((c) => c.set === id),
      actor = `director-${id}`;
    sets[id] = {
      id,
      actor_id: actor,
      order,
      title: g.title[i],
      description: g.summary[i],
      status: g.status,
      depends_on: g.depends,
      clip_ids: items.map((c) => c.number),
    };
    const role = model.actors.find((a) => a.key === `actor:${actor}`);
    if (role)
      actors[actor] = {
        id: actor,
        role: role.role,
        status: role.status,
        paused: role.paused,
        summary: g.summary[i],
      };
    items.forEach((c, order) => {
      clipRows[c.number] = {
        id: c.number,
        set_id: id,
        order,
        title: c.title[i],
        description: c.caption?.[i] ?? g.summary[i],
        status: c.status,
        duration: c.duration,
        accepted_candidate_id: `take-${c.number}`,
      };
      candidates[`take-${c.number}`] = {
        id: `take-${c.number}`,
        clip_id: c.number,
      };
    });
  });
  for (const actor of model.actors) {
    if (["screenwriter", "executive"].includes(actor.role)) {
      const id = actor.role === "screenwriter" ? "writer" : "executive";
      actors[id] = {
        id,
        role: actor.role,
        paused: actor.paused,
        status: actor.status,
        summary: "",
      };
    }
  }
  return {
    id: model.filmId,
    title: model.film.title[i],
    sets,
    actors,
    clips: clipRows,
    candidates,
  };
}
