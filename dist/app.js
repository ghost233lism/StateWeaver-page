(() => {
  'use strict';
  const films = window.FILMS,
    productions = window.SCREENING,
    paper = window.RESEARCH;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const el = (name, cls, value) => {
    const node = document.createElement(name);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const imageVisibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      img.src = img.dataset.src;
      imageVisibility.unobserve(img);
    }
  }, { rootMargin: '180px 0px' });
  function lazyImage(img, src) {
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.src = src;
    imageVisibility.observe(img);
  }
  const shapes = {
    expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-3 16"/>',
    translation: '<path d="M3 6h12M9 3v3m-4 3c1 3 4 6 8 8m0-11c0 4-4 9-10 12m12 3 4-11 4 11m-6.5-4h5"/>',
    poster: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M7 7h10m-10 9 3-4 3 2 2-3 2 5z"/>',
    paper: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
    strip:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14m10-14v14M3 10h4m-4 4h4m10-4h4m-4 4h4"/>',
    scroll: '<rect x="6.5" y="2.5" width="11" height="19" rx="5.5"/><path d="M12 6v4"/>',
    prev: '<path d="m14.5 5-7 7 7 7"/>',
    next: '<path d="m9.5 5 7 7-7 7"/>',
    layers: '<path d="m3 8 9-5 9 5-9 5zM4 12l8 4 8-4m-16 4 8 4 8-4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  function icon(name) {
    const i = el('i');
    i.setAttribute('aria-hidden', 'true');
    i.innerHTML = '<svg class="icon" viewBox="0 0 24 24">' + shapes[name] + '</svg>';
    return i;
  }
  $$('[data-icon]').forEach((i) => i.replaceWith(icon(i.dataset.icon)));
  let lang = 0;
  try {
    lang = Number(localStorage.getItem('stateweaver-language') === 'zh');
  } catch {}
  const T = (en, zh) => (lang ? zh : en),
    pair = (value) => (Array.isArray(value) ? value[lang] : value);
  const clock = (seconds) => {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  let boardIndex = 0;
  let bench = productions[films[boardIndex].id];
  function openingIndex(data) {
    const i = data.shots.findIndex((s) => s.timeSeconds <= 72.05 && s.endSeconds > 72.05);
    return Math.max(0, i);
  }
  let currentShot = openingIndex(bench);
  let track = 'all',
    tab = 'overview',
    activeFilm = 0,
    benchWasPlaying = false;
  const benchPlayer = $('#bench-video'),
    filmPlayer = $('#film-player');
  const captionStrings = $$('[data-zh]').map((n) => ({ n, en: n.textContent, zh: n.dataset.zh }));
  const allMatching = () =>
    bench.shots
      .map((shot, i) => (track === 'all' || shot.tracks.includes(track) ? i : -1))
      .filter((i) => i >= 0);
  const cinema = window.makeCinema(bench, {
    playButton: (b, playing) => {
      b.replaceChildren(icon(playing ? 'pause' : 'play'));
      b.setAttribute(
        'aria-label',
        playing ? T('Pause preview', '暂停预览') : T('Play preview', '播放预览'),
      );
    },
  });
  const staticAria = [
    ['#hero-seek', 'Preview time', '预览进度'],
    ['#shot-slider', 'Move along matched shots', '在匹配镜头间拖动'],
    ['#prev-shot', 'Previous matching shot', '上一个匹配镜头'],
    ['#next-shot', 'Next matching shot', '下一个匹配镜头'],
    ['.nav', 'Page navigation', '页面导航'],
    ['.research-tabs', 'Research sections', '研究栏目'],
    ['.credits-nav', 'Footer navigation', '页底导航'],
    ['#research-resources', 'Research resources', '论文资源'],
    ['#thumbs', 'Shot timeline', '镜头时间轴'],
  ];
  function sectionLink(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const top =
      id === 'screen'
        ? 0
        : window.scrollY + target.getBoundingClientRect().top - $('.mast').offsetHeight;
    window.scrollTo({ top, behavior: 'instant' });
    history.replaceState(null, '', '#' + id);
  }
  $$('.nav a, .brand[href^="#"], .hero-secondary, .fold-caption a, .credits-nav a').forEach(
    (a) =>
      a.addEventListener('click', (e) => {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (a.matches('.hero-secondary,.fold-caption a')) setBoardFilm(0);
          sectionLink(a.hash.slice(1));
        }
      }),
  );
  $('#unfold').addEventListener('click', (e) => {
    e.preventDefault();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sectionLink('bench');
      return;
    }
    const section = $('#screen'),
      stage = $('.stage');
    const end =
      section.getBoundingClientRect().top +
      window.scrollY -
      parseFloat(getComputedStyle(stage).top) +
      (section.offsetHeight - stage.offsetHeight) * 0.94;
    window.scrollTo({ top: end, behavior: 'smooth' });
  });
  let navPending = false;
  function highlight() {
    navPending = false;
    const top = parseFloat(getComputedStyle($('.mast')).height) + Math.min(220, innerHeight * 0.27);
    let cur = 'screen';
    for (const id of ['bench', 'films', 'research'])
      if (document.getElementById(id).getBoundingClientRect().top <= top) cur = id;
    $$('.nav a').forEach((a) => {
      const yes = a.hash === '#' + cur;
      a.classList.toggle('current', yes);
      if (yes) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!navPending) {
        navPending = true;
        requestAnimationFrame(highlight);
      }
    },
    { passive: true },
  );
  const studioFrame = $('#production-board');
  const studioWrap = $('#studio-wrap');
  const evidence = $('#shot-evidence');
  let expandedBoard = false;
  let lastBoardView = 'canvas';
  function mountBoard() {
    if (studioFrame.hasAttribute('src')) return;
    const params = new URLSearchParams({ filmId: films[boardIndex].id, lang: lang ? 'zh' : 'en' });
    if (lastBoardView === 'clip') params.set('number', bench.shots[currentShot].number);
    studioFrame.src = studioFrame.dataset.src + '?' + params;
  }
  const boardVisibility = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    mountBoard();
    boardVisibility.disconnect();
  }, { rootMargin: '100px 0px' });
  boardVisibility.observe(studioFrame);
  function syncBoard(view) {
    if (view) lastBoardView = view;
    if (!studioFrame.hasAttribute('src')) return;
    studioFrame.contentWindow?.postMessage(
      {
        type: 'stateweaver-board-state',
        filmId: films[boardIndex].id,
        number: bench.shots[currentShot].number,
        lang: lang ? 'zh' : 'en',
        ...(view ? { focus: view } : {}),
      },
      location.protocol === 'file:' ? '*' : location.origin,
    );
  }
  function boardSize(expanded) {
    if (expanded) mountBoard();
    expandedBoard = expanded;
    studioWrap.classList.toggle('expanded', expanded);
    document.body.classList.toggle('board-expanded', expanded);
    $('#studio-expand').setAttribute('aria-pressed', String(expanded));
    $('#studio-expand span').textContent = expanded
      ? T('Exit full screen', '退出全屏')
      : T('Full screen', '全屏查看');
  }
  $('#studio-expand').addEventListener('click', () => boardSize(!expandedBoard));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && expandedBoard) {
      boardSize(false);
      $('#studio-expand').focus({ preventScroll: true });
    }
  });
  studioFrame.addEventListener('load', () => syncBoard(lastBoardView));
  window.addEventListener('message', (event) => {
    if (
      event.source !== studioFrame.contentWindow ||
      (location.protocol !== 'file:' && event.origin !== location.origin)
    )
      return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'stateweaver-close-board') {
      boardSize(false);
      return;
    }
    if (data.type === 'stateweaver-board-ready') {
      syncBoard(lastBoardView);
      return;
    }
    if (data.type !== 'stateweaver-select-shot' && data.type !== 'stateweaver-open-shot') return;
    if (data.filmId !== films[boardIndex].id) return;
    const i = bench.shots.findIndex((shot) => shot.number === data.number);
    if (i < 0) return;
    if (!allMatching().includes(i)) track = 'all';
    if (i !== currentShot) chooseShot(i, false, null);
    if (data.type === 'stateweaver-open-shot') {
      boardSize(false);
      evidence.open = true;
      evidence.scrollIntoView({ block: 'start' });
    }
  });
  evidence.addEventListener('toggle', () => {
    if (evidence.open) chooseShot(currentShot, false, null);
    else {
      ++selectionVersion;
      benchPlayer.pause();
      benchPlayer.removeAttribute('src');
      benchPlayer.removeAttribute('poster');
      benchPlayer.load();
    }
  });
  function renderBoardSelector() {
    $$('#board-films img').forEach(img => imageVisibility.unobserve(img));
    $('#board-films').replaceChildren(
      ...films.map((film, index) => {
        const b = el('button', 'production-tab');
        b.setAttribute('aria-pressed', String(boardIndex === index));
        const pic = el('img');
        lazyImage(pic, film.poster);
        pic.alt = '';
        pic.loading = 'lazy';
        b.append(pic, el('span', '', pair(film.title)));
        b.onclick = () => {
          if (index !== boardIndex) setBoardFilm(index);
          $('#board-films [aria-pressed="true"]').focus({ preventScroll: true });
        };
        return b;
      }),
    );
  }
  const spotlightTimes = {
    'sun-chamber': 74.5,
    'lunar-signal': 79.4,
    'a-paper-flower': 67,
    'red-envelope': 53,
    'winter-garden': 74,
    chongqing: 81.5,
    'home-with-the-ball': 39,
  };
  function setBoardFilm(index, storyTime = spotlightTimes[films[index].id], view = 'canvas') {
    boardIndex = index;
    bench = productions[films[index].id];
    track = 'all';
    const lastIndex = bench.shots.length - 1;
    const selected = storyTime >= bench.shots[lastIndex].endSeconds
      ? lastIndex
      : bench.shots.findIndex((s) => s.timeSeconds <= storyTime && s.endSeconds > storyTime);
    chooseShot(Math.max(0, selected), false, view);
    renderBoardSelector();
  }
  let selectionVersion = 0;
  function interval() {
    const s = bench.shots[currentShot];
    return { start: s.playStart ?? 0, end: s.playEnd ?? s.endSeconds, shot: s };
  }
  function refreshSegment() {
    const { start, end } = interval(),
      duration = Math.max(0, end - start);
    const position = Math.max(0, Math.min(duration, (benchPlayer.currentTime || 0) - start));
    $('#segment-pos').textContent = clock(position);
    $('#segment-len').textContent = clock(duration);
    const range = $('#segment-scrub');
    range.value = duration ? Math.round((position / duration) * 1000) : 0;
    range.style.setProperty('--played', Number(range.value) / 10 + '%');
    const b = $('#segment-play');
    b.setAttribute(
      'aria-label',
      benchPlayer.paused
        ? T('Play selected shot', '播放所选镜头')
        : T('Pause selected shot', '暂停所选镜头'),
    );
    const state = benchPlayer.paused ? 'play' : 'pause';
    if (b.dataset.state !== state) {
      b.replaceChildren(icon(state));
      b.dataset.state = state;
    }
  }
  function chooseShot(index, play = false, view = 'clip') {
    const shot = bench.shots[index];
    if (!shot) return;
    currentShot = index;
    const version = ++selectionVersion;
    benchPlayer.pause();
    if (!evidence.open) {
      renderBench(view);
      return;
    }
    benchPlayer.preload = 'metadata';
    benchPlayer.poster = shot.poster;
    function seek() {
      if (version !== selectionVersion) return;
      const { start } = interval();
      benchPlayer.currentTime = start;
      if (play) benchPlayer.play().catch(() => {});
      refreshSegment();
    }
    if (benchPlayer.getAttribute('src') !== window.exhibitMedia(shot.src)) {
      benchPlayer.src = window.exhibitMedia(shot.src);
      benchPlayer.addEventListener('loadedmetadata', seek, { once: true });
      benchPlayer.load();
    } else if (benchPlayer.readyState >= 1) {
      seek();
    } else {
      benchPlayer.addEventListener('loadedmetadata', seek, { once: true });
    }
    renderBench(view);
  }
  benchPlayer.addEventListener('timeupdate', () => {
    const { end } = interval();
    if (!benchPlayer.paused && benchPlayer.currentTime >= end - 0.035) benchPlayer.pause();
    refreshSegment();
  });
  ['play', 'pause', 'seeked', 'ended'].forEach((name) =>
    benchPlayer.addEventListener(name, refreshSegment),
  );
  $('#segment-play').onclick = () => {
    if (!benchPlayer.paused) {
      benchPlayer.pause();
      return;
    }
    const { start, end } = interval();
    if (benchPlayer.currentTime >= end - 0.06 || benchPlayer.currentTime < start)
      benchPlayer.currentTime = start;
    benchPlayer.play().catch(() => {});
  };
  $('#segment-scrub').oninput = (e) => {
    const { start, end } = interval();
    if (benchPlayer.readyState >= 1)
      benchPlayer.currentTime = start + ((end - start) * Number(e.target.value)) / 1000;
  };
  function renderBench(view) {
    const s = bench.shots[currentShot],
      matched = allMatching(),
      pos = matched.indexOf(currentShot);
    $('#fold-film').textContent = pair(films[0].title);
    studioFrame.title = T('Production canvas · ', '制作画布 · ') + pair(bench.title);
    refreshSegment();
    $('#evidence-index').textContent = T('Shot ', '镜头 ') + s.number;
    syncBoard(view);
    if (!evidence.open) return;
    $('#monitor-shot').textContent = T('Shot ', '镜头 ') + s.number + '  /  ' + s.time;
    $('#selected-time').textContent = T('Story time ', '故事时间 ') + s.time;
    $('#shot-title').textContent = pair(s.title);
    $('#shot-copy').textContent = pair(s.caption);
    $('#tracks').replaceChildren(
      ...[{ id: 'all', label: ['All shots', '全部镜头'] }, ...bench.tracks].map((t) => {
        const b = el('button', '', pair(t.label));
        b.setAttribute('aria-pressed', String(t.id === track));
        b.onclick = () => {
          if (track === t.id) return;
          track = t.id;
          const list = allMatching();
          if (!list.includes(currentShot)) chooseShot(list[0], !benchPlayer.paused);
          else renderBench();
          $('#tracks button[aria-pressed="true"]')?.focus({ preventScroll: true });
        };
        return b;
      }),
    );
    $('#thumbs').replaceChildren(
      ...bench.shots.map((sh, i) => {
        const b = el('button', 'thumb' + (!matched.includes(i) ? ' unmatched' : ''));
        b.setAttribute('aria-pressed', String(i === currentShot));
        b.setAttribute('aria-label', T('Shot ', '镜头 ') + sh.number + ' · ' + pair(sh.title));
        b.title = pair(sh.title);
        const img = el('img');
        img.src = sh.poster;
        img.alt = '';
        img.loading = 'lazy';
        b.append(img, el('span', '', sh.number));
        b.onclick = () => {
          if (!allMatching().includes(i)) track = 'all';
          chooseShot(i, !benchPlayer.paused);
          $('#thumbs button[aria-pressed="true"]')?.focus({ preventScroll: true });
        };
        return b;
      }),
    );
    const thumb = $('#thumbs button[aria-pressed="true"]');
    if (thumb) {
      const t = $('#thumbs');
      if (
        thumb.offsetLeft < t.offsetLeft + t.scrollLeft ||
        thumb.offsetLeft + thumb.clientWidth > t.offsetLeft + t.scrollLeft + t.clientWidth
      )
        t.scrollLeft +=
          thumb.getBoundingClientRect().left -
          t.getBoundingClientRect().left -
          t.clientWidth / 2 +
          thumb.clientWidth / 2;
    }
    $('#shot-count').textContent =
      String(pos + 1).padStart(2, '0') + ' / ' + String(matched.length).padStart(2, '0');
    const slider = $('#shot-slider');
    slider.max = Math.max(1, matched.length - 1);
    slider.value = pos;
    slider.disabled = matched.length <= 1;
    slider.style.setProperty(
      '--played',
      (matched.length > 1 ? (100 * pos) / (matched.length - 1) : 0) + '%',
    );
    slider.setAttribute('aria-valuetext', s.number + ' · ' + pair(s.title));
    $('#prev-shot').disabled = pos <= 0;
    $('#next-shot').disabled = pos >= matched.length - 1;
  }
  for (const [id, offset] of [
    ['prev-shot', -1],
    ['next-shot', 1],
  ])
    document.getElementById(id).onclick = () => {
      const l = allMatching();
      chooseShot(l[l.indexOf(currentShot) + offset], !benchPlayer.paused);
    };
  $('#shot-slider').oninput = (e) =>
    chooseShot(allMatching()[Number(e.target.value)], !benchPlayer.paused);
  function card(f, i) {
    const b = el('button', 'film-card');
    b.setAttribute('aria-label', T('Watch ', '观看') + pair(f.title));
    const p = el('div', 'poster'),
      im = el('img');
    lazyImage(im, f.poster);
    im.alt = '';
    im.loading = 'lazy';
    im.decoding = 'async';
    p.append(im, el('span', 'card-duration', clock(f.duration)));
    const play = el('span', 'card-play');
    play.append(icon('play'));
    p.append(play);
    const meta = el('div', 'card-meta', pair(f.tag));
    b.append(p, el('h3', '', pair(f.title)), meta);
    b.onclick = () => openFilm(i);
    return b;
  }
  function renderFilmText() {
    const f = films[activeFilm];
    $('#dialog-title').textContent = pair(f.title);
    $('#film-caption').textContent = pair(f.description);
    $('#dialog-kind').textContent = [
      pair(f.kind),
      clock(f.duration),
      T('Silent film', '无声影片'),
    ].join('   /   ');
  }
  function openDialog(d) {
    benchWasPlaying = !benchPlayer.paused;
    benchPlayer.pause();
    d.showModal();
    cinema.reconcile();
  }
  function openFilm(i) {
    activeFilm = i;
    const f = films[i];
    renderFilmText();
    filmPlayer.poster = f.poster;
    filmPlayer.src = window.exhibitMedia(f.src);
    openDialog($('#film-dialog'));
    filmPlayer.play().catch(() => {});
  }
  $('#hero-film').onclick = () => openFilm(0);
  $('#film-to-board').onclick = () => {
    const time = filmPlayer.currentTime + (activeFilm === 0 ? 60 : 0);
    benchWasPlaying = false;
    $('#film-dialog').close();
    setBoardFilm(activeFilm, time, 'clip');
    sectionLink('bench');
  };
  function noteFigure(ref) {
    const fig = el('figure');
    const link = el('a');
    link.href = ref.src;
    link.target = '_blank';
    link.rel = 'noopener';
    const im = el('img');
    im.src = ref.src;
    im.alt = pair(ref.label);
    link.append(im);
    fig.append(link, el('figcaption', '', pair(ref.label)));
    return fig;
  }
  function renderNotes() {
    const body = $('#notes-body');
    if (!window.CURATED) return;
    const s = window.CURATED[films[boardIndex].id].shots[currentShot];
    const nodes = [el('h2', '', s.number + ' · ' + pair(s.title))];
    if (s.brief)
      nodes.push(el('h3', '', T('Storyboard brief', '分镜要求')), el('p', '', pair(s.brief)));
    const refs = s.refs?.length ? s.refs : s.ref ? [{ src: s.ref, label: s.refLabel }] : [];
    if (refs.length) {
      const gallery = el('div', 'shot-references');
      gallery.append(...refs.map(noteFigure));
      nodes.push(el('h3', '', T('Visual references', '视觉参考')), gallery);
    }
    nodes.push(el('h3', '', T('Selected shot', '选用镜头')), el('p', '', pair(s.caption)));
    if (s.reframing) {
      const frames = el('div', 'shot-references');
      frames.append(...s.reframing.frames.map(noteFigure));
      nodes.push(el('h3', '', pair(s.reframing.title)), frames, el('p', '', pair(s.reframing.caption)));
    }
    body.replaceChildren(...nodes);
  }
  let noteLoad;
  function readNotes() {
    if (window.CURATED) { renderNotes(); return; }
    $('#notes-body').textContent = T('Loading shot notes…', '正在载入分镜笔记…');
    if (noteLoad) return;
    noteLoad = document.createElement('script');
    noteLoad.src = 'curated.js';
    noteLoad.onload = renderNotes;
    noteLoad.onerror = () => {
      noteLoad.remove();
      noteLoad = null;
      const retry = el('button', 'copy', T('Reload shot notes', '重新载入分镜笔记'));
      retry.onclick = readNotes;
      $('#notes-body').replaceChildren(retry);
    };
    document.head.append(noteLoad);
  }
  $('#shot-notes').onclick = () => {
    openDialog($('#notes-dialog'));
    readNotes();
  };
  $$('dialog').forEach((d) => {
    const close = d.querySelector('.close');
    close.onclick = () => d.close();
    d.onclick = (e) => {
      if (e.target === d) {
        const b = d.getBoundingClientRect();
        if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
          d.close();
      }
    };
    d.addEventListener('close', () => {
      for (const v of d.querySelectorAll('video')) v.pause();
      if (d.id === 'film-dialog') {
        filmPlayer.removeAttribute('src');
        filmPlayer.load();
      }
      if (benchWasPlaying) benchPlayer.play().catch(() => {});
      benchWasPlaying = false;
      cinema.reconcile();
    });
    const tools = el('div', 'modal-tools');
    const language = el('button', 'modal-lang');
    language.onclick = changeLanguage;
    close.before(tools);
    tools.append(language, close);
  });
  function authors() {
    const area = $('#authors');
    const names = el('span', 'author-list');
    area.replaceChildren(names);
    paper.authors.forEach((a) => {
      const author = el('span');
      const n = el('a', '', a.name);
      n.href = a.url;
      n.target = '_blank';
      n.rel = 'noopener';
      author.append(n, el('sup', '', a.aff.join(',')));
      names.append(author);
    });
    if (paper.affiliations.length) {
      const line = el('span', 'affiliations');
      paper.affiliations.forEach((a, i) => {
        const institution = el('span');
        institution.append(el('sup', '', String(i + 1)), a);
        line.append(institution);
      });
      area.append(line);
    }
  }
  function renderResources() {
    const resources = paper.resources;
    const items = [
      ['paper', 'paper', T('Paper', '论文')],
      ['chinese', 'translation', T('Chinese edition', '中文版')],
      ['code', 'code', T('Code', '代码')],
      ['demo', 'play', 'Demo'],
      ['poster', 'poster', 'Poster'],
    ];
    $('#research-resources').replaceChildren(...items.map(([key, symbol, label]) => {
      const href = pair(resources[key]);
      const control = el(href ? 'a' : 'button', 'resource-link');
      control.append(icon(symbol), el('span', '', label));
      if (!href) {
        control.disabled = true;
        return control;
      }
      control.href = href;
      if (href.startsWith('#')) {
        control.addEventListener('click', (event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (href === '#bench') syncBoard('canvas');
          sectionLink(href.slice(1));
        });
      } else {
        control.target = '_blank';
        control.rel = 'noopener';
      }
      return control;
    }));
  }
  function renderResearch() {
    const body = $('#research-body');
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    if (tab === 'overview') {
      body.replaceChildren(el('p', 'abstract', pair(paper.abstract)));
      return;
    }
    if (tab === 'method') {
      const wrap = el('div', 'methods'),
        text = el('div');
      paper.method.forEach((m) =>
        text.append(el('h3', '', pair(m.title)), el('p', '', pair(m.text))),
      );
      const btn = el('button', 'figure-preview'),
        img = el('img');
      img.alt = T('StateWeaver system diagram', 'StateWeaver 系统结构图');
      img.src = paper.methodFigure;
      btn.append(img, el('span', '', T('Enlarge method diagram', '放大方法图')));
      btn.onclick = () => {
        $('#full-figure').src = paper.methodFigure;
        openDialog($('#figure-dialog'));
      };
      wrap.append(text, btn);
      body.replaceChildren(wrap);
      return;
    }
    const pre = el('pre', 'bib', paper.bibtex),
      b = el('button', 'copy', T('Copy BibTeX', '复制 BibTeX'));
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(paper.bibtex);
        b.textContent = T('Copied', '已复制');
      } catch {
        const r = document.createRange();
        r.selectNodeContents(pre);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        b.textContent = T('Selected for copying', '已选中，可复制');
      }
    };
    body.replaceChildren(pre, b);
  }
  $$('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        renderResearch();
      }),
  );
  function language() {
    document.documentElement.lang = lang ? 'zh-CN' : 'en';
    document.title = T('StateWeaver — Film Workshop', 'StateWeaver · 电影工坊');
    captionStrings.forEach((o) => {
      o.n.textContent = lang ? o.zh : o.en;
    });
    const lb = $('#language');
    lb.replaceChildren(
      el(lang ? 'span' : 'b', '', 'EN'),
      el(lang ? 'b' : 'span', '', '中文'),
    );
    lb.setAttribute('aria-label', T('Switch to Chinese', '切换至英文'));
    $$('.modal-lang').forEach((b) => (b.textContent = T('中文', 'EN')));
    $$('.close').forEach((b) => b.setAttribute('aria-label', T('Close', '关闭')));
    staticAria.forEach(([s, e, z]) => $(s).setAttribute('aria-label', T(e, z)));
    $('#hero-film-name').textContent = pair(films[0].title);
    const fullFilms = films.slice(1);
    $$('#gallery img').forEach(img => imageVisibility.unobserve(img));
    $('#gallery').replaceChildren(...fullFilms.map((film, index) => card(film, index + 1)));
    $('#library-count').textContent = T(
      fullFilms.length + ' full films',
      '共 ' + fullFilms.length + ' 部完整作品',
    );
    $('#paper-title').textContent = paper.title.replace(/^StateWeaver:\s*/, '');
    boardSize(expandedBoard);
    $('#board-films').setAttribute('aria-label', T('Choose a production', '选择作品画布'));
    $('#segment-scrub').setAttribute(
      'aria-label',
      T('Selected shot playback time', '所选镜头播放位置'),
    );
    renderBoardSelector();
    authors();
    renderResources();
    renderBench();
    renderFilmText();
    renderResearch();
    cinema.refresh();
    if ($('#notes-dialog').open) renderNotes();
  }
  function changeLanguage() {
    lang = lang ? 0 : 1;
    try {
      localStorage.setItem('stateweaver-language', lang ? 'zh' : 'en');
    } catch {}
    language();
  }
  $('#language').onclick = changeLanguage;
  language();
  highlight();
  new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) benchPlayer.pause();
    },
    { threshold: 0.03 },
  ).observe($('#monitor-screen'));
})();
