(() => {
  function hosted(path, scope) {
    const screening = /^media\/films\/(?!(?:hero|loop|loop-small)\.mp4$)[a-z0-9-]+\.mp4$/.test(path);
    if (screening || scope === 'films') return screening;
    return path.startsWith('media/studio-archive/') || path === 'media/production/sun-chamber-full.mp4';
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hosted };
    return;
  }
  const { mediaBase, mediaScope } = document.currentScript.dataset;
  window.exhibitMedia = (path, localPrefix = '') =>
    mediaBase && hosted(path, mediaScope) ? new URL(path, mediaBase).href : localPrefix + path;
})();
