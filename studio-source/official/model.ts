// Canvas-facing Studio contracts for the standalone presentation build.
export type Selection = {
  kind: "actor" | "memory" | "clip" | "set-preview";
  id: string;
};
type Actor = {
  id: string;
  role: string;
  status: string;
  summary?: string;
  paused?: boolean;
};
type ProductionSet = {
  id: string;
  title: string;
  order: number;
  actor_id: string;
  description?: string;
  status: string;
  clip_ids?: string[];
  depends_on?: string[];
  asset_handoffs?: { mode: string; source_set_id?: string; asset_id: string }[];
};
type Clip = {
  id: string;
  set_id: string;
  title: string;
  description: string;
  order: number;
  status: string;
  duration: number;
  repair_count?: number;
  accepted_candidate_id?: string;
  archived_at?: string;
};
type Candidate = {
  id: string;
  clip_id: string;
  created_at?: string;
  selection?: { kind: string };
  end_state?: { frame_media_id?: string };
  analysis?: { user_selection?: unknown };
};
export type StudioProject = {
  id: string;
  title: string;
  sets?: Record<string, ProductionSet>;
  actors?: Record<string, Actor>;
  clips?: Record<string, Clip>;
  candidates?: Record<string, Candidate>;
  media?: Record<string, { url: string }>;
  assets?: Record<string, { name: string }>;
  screenplay?: { confirmed_at?: string };
  catalog_frozen_at?: string;
  harness_version?: string;
  workflow_version?: string;
  handoff_policy?: string;
};
export type WorkspaceLayout = {
  nodes?: Record<
    string,
    { x: number; y: number; width?: number | null; height?: number | null }
  >;
};
export function entries<T extends { id?: string }>(
  record: Record<string, T> | undefined,
): (T & { id: string })[] {
  return Object.entries(record ?? {}).map(([id, value]) => ({
    ...value,
    id: value.id ?? id,
  }));
}

export function orderedSets(project: StudioProject) {
  return entries(project.sets).sort((a, b) => a.order - b.order);
}

export function generationDependencies(
  project: StudioProject,
  set: ProductionSet,
): string[] {
  return [
    ...new Set([
      ...(set.depends_on ?? []),
      ...(project.handoff_policy === "observed-v1"
        ? (set.asset_handoffs ?? [])
            .filter((item) => item.mode === "observed" && item.source_set_id)
            .map((item) => item.source_set_id!)
        : []),
    ]),
  ];
}

export function setClips(project: StudioProject, setId: string) {
  const activeIds = new Set(project.sets?.[setId]?.clip_ids ?? []);
  return entries(project.clips)
    .filter(
      (clip) =>
        clip.set_id === setId && activeIds.has(clip.id) && !clip.archived_at,
    )
    .sort((a, b) => a.order - b.order);
}

export function activeClips(project: StudioProject) {
  return orderedSets(project).flatMap((set) => setClips(project, set.id));
}

export function unitLabel(_project: Pick<StudioProject, "workflow_version">) {
  return "片场";
}

/** Keep original names for links/history; omit only a matching padded prefix. */
export function unitDisplayTitle(set: Pick<ProductionSet, "title" | "order">) {
  const prefix = set.title.match(/^(\d{2,3})[\s·.、:：\-–—]+(.+)$/u);
  return prefix && prefix[1] === String(set.order + 1).padStart(2, "0")
    ? prefix[2]
    : set.title;
}

export function newestCandidate(project: StudioProject, clip: Clip) {
  const candidates = entries(project.candidates).filter(
    (candidate) => candidate.clip_id === clip.id,
  );
  return (
    candidates.find(
      (candidate) => candidate.id === clip.accepted_candidate_id,
    ) ??
    candidates
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .at(-1)
  );
}
