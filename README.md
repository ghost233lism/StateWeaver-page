# StateWeaver

Project website for *StateWeaver: Multi-Agent Coordination of Story-State Transitions for Long-Horizon Video Generation*. Explore seven selected films and their interactive production canvases in English and Chinese.

[Visit the film workshop](https://ghost233lism.github.io/StateWeaver-page/)

## Local preview

Run these commands from the repository root, then open [the local site](http://localhost:8000).

```sh
node scripts/prepare-pages.cjs public-preview
python3 -m http.server 8000 --directory public-preview
```

The preparation script writes to a new directory. Choose a fresh output directory for each build.

## Website source

Edit the landing page in `dist/` and the production canvas in `studio-source/`. To rebuild the canvas before preparing a preview, run `npm ci --prefix studio-source` and `npm run build --prefix studio-source`. The seven compressed production records and canvas index are in `dist/studio/`.

GitHub Actions builds and publishes the website on each push to `main`. Full films, reference images and candidate takes stream from the [exhibition media dataset](https://huggingface.co/datasets/ghost233lism/stateweaver-film-workshop-media). The release revision is pinned in `scripts/exhibit-media.json`.

The exhibition is marked [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/).
