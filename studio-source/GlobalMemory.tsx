import { useState } from "react";
import { BookOpen, Boxes, GripHorizontal, Layers3 } from "lucide-react";
import { assetPreviewPath, human, recordTitle } from "./archive";
import { safePath } from "./adapter";

const kindNames = {
  person: "人物", character: "角色", animal: "动物", scene: "场景", location: "地点",
  object: "物体", prop: "道具", auxiliary: "辅助资产", other: "其他",
  target_frame: "目标画面", layout: "布局",
};

export function GlobalMemoryNode({ data }) {
  const [kind, setKind] = useState("");
  const { i, open, index, fitScale } = data;
  const t = (en, zh) => i ? zh : en;
  const assets = index.groups.assets ?? [];
  const kinds = [...new Set(assets.map(asset => asset.kind))];
  const global = index.groups.scopes?.find(s => s.id === "global");
  const visible = kind ? assets.filter(asset => asset.kind === kind) : assets;
  const openMemory = () => open({ page: "memory", scope: "global" });
  return (
    <div className="global-map" style={{
      width: `${100 * fitScale}%`, height: `${100 * fitScale}%`,
      transform: `scale(${1 / fitScale})`,
    }}>
      <header className="global-memory-head">
        <button className="global-map-title nodrag" onClick={openMemory}>
          <Layers3 size={18} />{t("Global memory", "全局记忆")}
        </button>
        <button className="global-story nodrag" onClick={openMemory}>
          <BookOpen size={14} />{t("Story memory", "剧情记忆")} <small>{global?.entry_ids?.length ?? 0}</small>
        </button>
        <span className="overview-grip" title={t("Move global memory", "移动全局记忆")}><GripHorizontal size={16} /></span>
      </header>
      <div className="global-asset-head">
        <button className="global-catalog nodrag" onClick={() => open({ page: "assets" })}>
          <Boxes size={15} /><strong>{t("Visual assets", "视觉资产")}</strong><small>{assets.length}</small>
        </button>
        <select className="nodrag nopan nowheel" aria-label={t("Asset category", "资产类别")}
          value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">{t("All assets", "全部资产")}</option>
          {kinds.map(k => <option key={k} value={k}>{i ? kindNames[k] ?? human(k) : human(k)}</option>)}
        </select>
      </div>
      <div className="global-asset-strip nodrag nopan nowheel" key={kind}>
        {visible.map(asset => {
          const title = recordTitle(asset, "assets", i, data.projectData, index);
          const cover = safePath(assetPreviewPath(asset, index));
          return (
            <button key={asset.id} className="global-asset-tile" title={title}
              onClick={() => open({ page: "records", cat: "assets", id: asset.id })}>
              {cover ? <img src={cover} alt="" loading="lazy" decoding="async" />
                : <span className="asset-without-cover"><Boxes size={19} /></span>}
              <span className="asset-caption">{title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
