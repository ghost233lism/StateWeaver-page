import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
const target = new URL("../dist/studio/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["board.js", "style.css"])
  await copyFile(
    new URL(`compiled/${file}`, import.meta.url),
    new URL(file, target),
  );
await copyFile(
  new URL("index.html", import.meta.url),
  new URL("index.html", target),
);
await copyFile(
  new URL("records.js", import.meta.url),
  new URL("records.js", target),
);

const catalogText = await readFile(new URL("../dist/curated.js", import.meta.url), "utf8");
const catalog = JSON.parse(catalogText.replace(/^window\.CURATED\s*=\s*/, "").replace(/;\s*$/, ""));
const fields = ["number", "time", "timeSeconds", "endSeconds", "playStart", "playEnd", "src", "poster", "title", "caption", "tracks"];
const screening = Object.fromEntries(Object.entries(catalog).map(([film, {title, tracks, shots}]) =>
  [film, { title, tracks, shots: shots.map(shot =>
    Object.fromEntries(fields.filter(key => key in shot).map(key => [key, shot[key]]))
  ) }]
));
await writeFile(new URL("../dist/screening.js", import.meta.url), `window.SCREENING=${JSON.stringify(screening)};\n`);
