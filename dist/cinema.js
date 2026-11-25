/* A continuous, articulated strip. Every panel rotates around its shared edge. */
window.makeCinema = function (bench, labels) {
  const stage = document.querySelector('.stage');
  const section = document.querySelector('#screen');
  const ribbon = document.querySelector('#ribbon');
  const world = document.querySelector('#world');
  const copy = document.querySelector('.hero-copy');
  const end = document.querySelector('.fold-caption');
  const transport = document.querySelector('.transport');
  const seeks = document.querySelector('#hero-seek');
  const toggle = document.querySelector('#hero-toggle');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 700px)').matches;
  const cells = new Map();
  const groups = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  const connection = navigator.connection;
  const conserve = () => connection?.saveData || /^(slow-2g|2g)$/.test(connection?.effectiveType);
  const delayedStills = [], spliceStills = [];
  let video,
    playingWanted = !reduce.matches && !conserve(),
    visible = false,
    previewReady = false,
    queued = false,
    px = 0,
    py = 0;
  let manualView = 0,
    drag = null,
    dim = {};
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  const clock = (x) =>
    Number.isFinite(x)
      ? String(Math.floor(x / 60)).padStart(2, '0') +
        ':' +
        String(Math.floor(x % 60)).padStart(2, '0')
      : '00:00';
  const handoffShot = Math.max(
    0,
    bench.shots.findIndex((shot) => shot.timeSeconds <= 80 && shot.endSeconds > 80),
  );
  for (const n of groups) {
    const f = document.createElement('div');
    f.className = 'cel';
    f.dataset.n = n;
    const pick = bench.shots[(n + bench.shots.length + 2) % bench.shots.length];
    const neighbours = {
      '-2': 'hero-left-far',
      '-1': 'hero-left',
      1: 'hero-right',
      2: 'hero-right-far',
    };
    const image =
      n === 0
        ? (compact ? 'media/films/hero-small.webp' : 'media/films/hero.webp')
        : neighbours[n]
          ? 'media/films/' + neighbours[n] + (compact && Math.abs(n) === 1 ? '-small' : '') + '.webp'
          : pick.poster;
    const stock = document.createElement('div');
    stock.className = 'cell-stock';
    const ap = document.createElement('div');
    ap.className = 'aperture';
    const pic = document.createElement(n === 0 ? 'video' : 'img');
    if (n === 0) {
      video = pic;
      video.id = 'hero-video';
      video.defaultMuted = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      const still = document.createElement('img');
      still.className = 'hero-still';
      still.alt = '';
      still.fetchPriority = 'high';
      still.src = image;
      video.addEventListener('loadeddata', () => { still.hidden = true; }, { once: true });
      ap.append(still);
      video.preload = 'none';
      const backing = document.createElement('img');
      backing.src = image;
      backing.alt = '';
      backing.className = 'gate-backing';
      ap.append(backing);
    } else {
      if (Math.abs(n) === 1) pic.src = image;
      else delayedStills.push([pic, image]);
      pic.alt = '';
      pic.decoding = 'async';
    }
    ap.append(pic);
    const nextFrame = document.createElement('img');
    nextFrame.className = 'next-reel';
    spliceStills.push([nextFrame, bench.shots[Math.max(0, Math.min(bench.shots.length - 1, handoffShot + n))].poster]);
    nextFrame.alt = '';
    ap.append(nextFrame);
    stock.append(ap);
    for (const [text, sideClass] of [
      ['STATEWEAVER', ''],
      [n === 0 ? 'SCREENING ROOM' : String(Math.abs(n)).padStart(2, '0'), ' end'],
    ]) {
      const t = document.createElement('span');
      t.className = 'film-label' + sideClass;
      t.textContent = text;
      stock.append(t);
    }
    f.append(stock);
    ribbon.append(f);
    cells.set(n, f);
  }
  for (const img of stage.querySelectorAll('[data-frame]')) {
    const src = compact ? img.dataset.frame.replace('.webp', '-small.webp') : img.dataset.frame;
    delayedStills.push([img, src]);
  }
  function syncTime() {
    const d = video.duration || 19.916667;
    const t = video.currentTime || 0;
    document.querySelector('#hero-time').textContent = clock(t);
    document.querySelector('#hero-duration').textContent = clock(Math.round(d));
    seeks.value = d ? Math.round((t / d) * 1000) : 0;
    seeks.style.setProperty('--played', (d ? (t / d) * 100 : 0) + '%');
  }
  function syncButton() {
    labels.playButton(toggle, !video.paused);
  }
  function reconcile() {
    if (previewReady && playingWanted && visible && !document.querySelector('dialog[open]') && !document.hidden) {
      if (!video.hasAttribute('src')) {
        video.src = matchMedia('(max-width: 700px)').matches ? 'media/films/loop-small.mp4' : 'media/films/loop.mp4';
      }
      video.play().catch(() => syncButton());
    } else {
      video.pause();
    }
  }
  toggle.addEventListener('click', () => {
    previewReady = true;
    playingWanted = video.paused;
    reconcile();
  });
  seeks.addEventListener('input', () => {
    const fraction = Number(seeks.value) / 1000;
    const seek = () => {
      if (Number.isFinite(video.duration)) video.currentTime = video.duration * fraction;
    };
    if (video.readyState >= 1) seek();
    else {
      video.addEventListener('loadedmetadata', seek, { once: true });
      if (!video.hasAttribute('src')) {
        video.src = compact ? 'media/films/loop-small.mp4' : 'media/films/loop.mp4';
        video.preload = 'metadata';
      }
    }
    syncTime();
  });
  ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach((name) =>
    video.addEventListener(name, syncTime),
  );
  ['play', 'pause'].forEach((name) => video.addEventListener(name, syncButton));
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) schedule();
      reconcile();
    },
    { threshold: 0.08 },
  ).observe(stage);
  function enablePreview() {
    previewReady = true;
    reconcile();
  }
  function afterLoad() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(enablePreview, { timeout: 1200 });
    else setTimeout(enablePreview, 80);
  }
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
  document.addEventListener('visibilitychange', reconcile);
  reduce.addEventListener('change', () => {
    playingWanted = !reduce.matches && !conserve();
    reconcile();
    measure();
  });
  function measure() {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    const width = w < 681 ? w * 0.97 : w * 0.925;
    const height = h * (w < 681 ? 0.89 : 0.9);
    dim = { w, h, width, height };
    ribbon.style.setProperty('--fw', width + 'px');
    ribbon.style.setProperty('--fh', height + 'px');
    schedule();
  }
  function schedule() {
    if (visible && !queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }
  function paint() {
    queued = false;
    const { w, h, width } = dim;
    if (!width) return;
    const progress = reduce.matches
      ? 0
      : clamp(
          (parseFloat(getComputedStyle(stage).top) - section.getBoundingClientRect().top) /
            Math.max(1, section.offsetHeight - stage.offsetHeight),
        );
    if (progress > 0.03) for (const [img, src] of delayedStills.splice(0)) img.src = src;
    if (progress > 0.36) for (const [img, src] of spliceStills.splice(0)) img.src = src;
    const turn = smooth(progress / 0.83),
      settle = smooth((progress - 0.57) / 0.43),
      fold = Math.sin(Math.PI * turn);
    const lift = fold;
    const emblem = smooth((progress - 0.26) / 0.13) * (1 - smooth((progress - 0.52) / 0.15));
    stage.style.setProperty('--emblem', emblem.toFixed(3));
    const model = stage.querySelector('.fold-model');
    const swivel = (progress - 0.44) * 150;
    model.style.transform =
      'rotateX(' +
      (-8 + progress * 20) +
      'deg) rotateY(' +
      swivel +
      'deg) rotateZ(' +
      (-11 + progress * 20) +
      'deg) scale(' +
      (0.86 + 0.16 * emblem) +
      ')';
    for (const cell of cells.values()) {
      cell.style.opacity = String(1 - 0.95 * emblem);
    }
    stage.style.setProperty('--p', progress.toFixed(4));
    stage.style.setProperty('--splice', smooth((progress - 0.71) / 0.17).toFixed(3));
    window.drawReels(document.querySelector('#mechanism'), w, h, progress, px + manualView / 16);
    cells.get(0).style.transform = 'none';
    for (const sign of [-1, 1]) {
      let m = new DOMMatrix();
      for (let k = 1; k <= 4; k++) {
        const phase = [0, 1, -1, -0.75, 1][k];
        const hingeY =
          sign * (k === 1 ? 6 : 13) * (1 - turn) + sign * phase * (68 * fold + 18 * turn);
        const hingeZ =
          sign * (k === 1 ? -2 : 2) * (1 - turn) + phase * sign * (24 * fold - 8 * turn);
        m = m
          .translate(sign * width * 0.5, 0, 0)
          .rotate(phase * 10 * fold, hingeY, hingeZ)
          .translate(sign * width * 0.5, 0, 0);
        cells.get(sign * k).style.transform = m.toString();
      }
    }
    const scale = 1 - 0.76 * turn + 0.03 * settle;
    const x = w * (0.13 * turn + 0.06 * settle);
    const y = h * (-0.08 * turn - 0.03 * settle);
    world.style.transform =
      'translate3d(' +
      x +
      'px,' +
      y +
      'px,0) scale3d(' +
      scale +
      ',' +
      scale +
      ',' +
      scale +
      ') rotateX(' +
      (-15 * lift + 21 * turn + py * 3 * turn) +
      'deg) rotateY(' +
      (12 * lift - 15 * turn + px * 4 * turn + manualView * turn) +
      'deg) rotateZ(' +
      (-12 * lift - 5 * turn) +
      'deg)';
    const alpha = 1 - smooth(progress / 0.29);
    copy.style.opacity = alpha;
    copy.style.visibility = alpha > 0.01 ? 'visible' : 'hidden';
    copy.inert = alpha < 0.1;
    copy.style.transform = 'translateY(' + -26 * (1 - alpha) + 'px)';
    const eta = smooth((progress - 0.57) / 0.25);
    end.style.visibility = eta > 0.01 ? 'visible' : 'hidden';
    end.style.opacity = eta;
    end.inert = eta < 0.1;
    end.style.transform = 'translateY(' + 14 * (1 - eta) + 'px)';
    transport.style.opacity = 1 - smooth(progress / 0.4);
    transport.style.visibility = progress < 0.4 ? 'visible' : 'hidden';
    transport.inert = progress > 0.35;
    stage.dataset.explore = progress > 0.55 ? 'yes' : 'no';
  }
  stage.addEventListener('pointermove', (e) => {
    if (stage.dataset.explore !== 'yes' || reduce.matches) return;
    px = e.clientX / dim.w - 0.5;
    py = e.clientY / dim.h - 0.5;
    if (drag !== null)
      manualView = Math.max(-24, Math.min(24, manualView + (e.clientX - drag) * 0.17));
    if (drag !== null) drag = e.clientX;
    schedule();
  });
  stage.addEventListener('pointerdown', (e) => {
    if (stage.dataset.explore === 'yes' && !e.target.closest('button,a,input')) {
      drag = e.clientX;
      stage.setPointerCapture(e.pointerId);
    }
  });
  stage.addEventListener('lostpointercapture', () => {
    drag = null;
  });
  stage.addEventListener('pointerup', () => {
    drag = null;
  });
  stage.addEventListener('pointerleave', () => {
    px = 0;
    py = 0;
    schedule();
  });
  window.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(measure).observe(stage);
  measure();
  syncTime();
  syncButton();
  return { video, refresh: syncButton, reconcile, clock };
};
