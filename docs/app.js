/*
 * GitHub Portfolio Showcase by NimmaSsathi
 * Vanilla JS, no build step, no dependencies, no tokens.
 * Talks only to GitHub's public, unauthenticated REST API (and raw.githubusercontent.com
 * for the optional portfolio.json, which does not count against the API rate limit).
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */
  const API = 'https://api.github.com';
  const RAW = 'https://raw.githubusercontent.com';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const CACHE_PREFIX = 'nimmassathi:v1:';
  const MAX_CACHE_ENTRY_CHARS = 400 * 1024;
  const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
  const THEME_KEY = 'nimmassathi:theme';

  const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
    C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584',
    Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', HTML: '#e34c26',
    CSS: '#563d7c', SCSS: '#c6538c', Shell: '#89e051', Dart: '#00B4AB', Vue: '#41b883',
    Svelte: '#ff3e00', Lua: '#000080', R: '#198CE7', Scala: '#c22d40', Haskell: '#5e5086',
    Elixir: '#6e4a7e', 'Objective-C': '#438eff', MATLAB: '#e16737', Dockerfile: '#384d54',
    Makefile: '#427819', PowerShell: '#012456', TeX: '#3D6117', Zig: '#ec915c', Nix: '#7e7eff',
    Perl: '#0298c3', Clojure: '#db5855', 'Jupyter Notebook': '#DA5B0B', 'Vim Script': '#199f4b',
    Batchfile: '#C1F12E', Assembly: '#6E4C13', Groovy: '#4298b8', Julia: '#a270ba'
  };

  /* ------------------------------------------------------------------ *
   * Small DOM helpers (everything is built with textContent / setAttribute,
   * never innerHTML, except the sanitised README below)
   * ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(props)) {
      if (val == null || val === false) continue;
      if (key === 'class') el.className = val;
      else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2), val);
      else el.setAttribute(key, val === true ? '' : String(val));
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      el.append(child);
    }
    return el;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    star: [['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26' }]],
    fork: [['circle', { cx: 6, cy: 5, r: 2 }], ['circle', { cx: 18, cy: 5, r: 2 }], ['circle', { cx: 12, cy: 19, r: 2 }],
           ['path', { d: 'M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5' }]],
    external: [['path', { d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }]],
    pin: [['path', { d: 'M12 17v5M9 3h6l-1 7 3 3H7l3-3-1-7z' }]],
    pinpoint: [['path', { d: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z' }], ['circle', { cx: 12, cy: 10, r: 2.5 }]],
    clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
    close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
    moon: [['path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }]],
    people: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2A6.5 6.5 0 0 1 21.5 20' }]],
    book: [['path', { d: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13' }]],
    link: [['path', { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }]]
  };

  function icon(name, size = 16) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const [tag, attrs] of ICONS[name] || []) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.append(node);
    }
    return svg;
  }

  const numberFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const relTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const dateFmt = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });

  function timeAgo(iso) {
    const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, secs] of units) {
      if (Math.abs(diffSec) >= secs) return relTime.format(Math.round(diffSec / secs), unit);
    }
    return 'just now';
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch { /* not a URL */ }
    return null;
  }

  function homepageUrl(raw) {
    if (typeof raw !== 'string') return null;
    const text = raw.trim();
    if (!text) return null;
    return safeHttpUrl(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : 'https://' + text);
  }

  function langColor(name) {
    if (LANG_COLORS[name]) return LANG_COLORS[name];
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360} 55% 50%)`;
  }

  function contrastRatio(hexA, hexB) {
    const lum = (hex) => {
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [a, b] = [lum(hexA), lum(hexB)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  }

  /* ------------------------------------------------------------------ *
   * Cache: localStorage with 10-minute expiry, in-memory fallback
   * ------------------------------------------------------------------ */
  const memoryCache = new Map();

  function cacheGet(key) {
    const now = Date.now();
    const mem = memoryCache.get(key);
    if (mem && now - mem.t <= CACHE_TTL_MS) return mem.v;
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return undefined;
      const entry = JSON.parse(raw);
      if (now - entry.t > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return undefined;
      }
      return entry.v;
    } catch {
      return undefined;
    }
  }

  function pruneCache() {
    try {
      const now = Date.now();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(CACHE_PREFIX)) continue;
        try {
          if (now - JSON.parse(localStorage.getItem(k)).t > CACHE_TTL_MS) localStorage.removeItem(k);
        } catch { localStorage.removeItem(k); }
      }
    } catch { /* storage unavailable */ }
  }

  function cacheSet(key, value) {
    const entry = { t: Date.now(), v: value };
    memoryCache.set(key, entry);
    try {
      const serialised = JSON.stringify(entry);
      if (serialised.length > MAX_CACHE_ENTRY_CHARS) return;
      try {
        localStorage.setItem(CACHE_PREFIX + key, serialised);
      } catch {
        pruneCache();
        localStorage.setItem(CACHE_PREFIX + key, serialised);
      }
    } catch { /* quota exceeded or storage disabled: memory cache still works */ }
  }

  /* ------------------------------------------------------------------ *
   * GitHub requests
   * ------------------------------------------------------------------ */
  class GitHubError extends Error {
    constructor(kind, message, extra = {}) {
      super(message);
      this.kind = kind;
      Object.assign(this, extra);
    }
  }

  async function request(url, accept) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: accept } });
    } catch {
      throw new GitHubError('network', 'Network request failed');
    }
    if (res.ok) return res;

    const remaining = res.headers.get('X-RateLimit-Remaining');
    const reset = Number(res.headers.get('X-RateLimit-Reset')) || null;
    if (res.status === 429 || ((res.status === 403) && remaining === '0')) {
      throw new GitHubError('ratelimit', 'Rate limit exceeded', { reset });
    }
    if (res.status === 403) {
      let message = '';
      try { message = (await res.clone().json()).message || ''; } catch { /* not JSON */ }
      if (/rate limit/i.test(message)) throw new GitHubError('ratelimit', message, { reset });
    }
    if (res.status === 404) throw new GitHubError('notfound', 'Not found', { status: 404 });
    throw new GitHubError('http', `GitHub returned HTTP ${res.status}`, { status: res.status });
  }

  async function getJSON(url) {
    const key = 'j:' + url;
    const hit = cacheGet(key);
    if (hit !== undefined) return hit;
    const data = await (await request(url, 'application/vnd.github+json')).json();
    cacheSet(key, data);
    return data;
  }

  // GitHub renders the README to HTML for us when asked for this media type.
  async function getReadmeHtml(owner, repo) {
    const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
    const key = 'readme:' + url;
    const hit = cacheGet(key);
    if (hit !== undefined) return hit;
    try {
      const html = await (await request(url, 'application/vnd.github.html+json')).text();
      cacheSet(key, html);
      return html;
    } catch (err) {
      if (err.kind === 'notfound') { cacheSet(key, null); return null; }
      throw err;
    }
  }

  /* ------------------------------------------------------------------ *
   * README sanitiser: allow-list rebuild of GitHub's rendered HTML
   * ------------------------------------------------------------------ */
  const README_ALLOWED = new Set(('a abbr b blockquote br code dd del details div dl dt em h1 h2 h3 h4 h5 h6 hr i img input ins kbd li ' +
    'ol p pre q s samp section small span strong sub summary sup table tbody td tfoot th thead tr tt u ul var').split(' '));
  const README_DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math', 'template', 'noscript',
    'textarea', 'select', 'button', 'link', 'meta', 'base', 'title', 'head', 'source', 'video', 'audio', 'canvas', 'frame', 'frameset']);
  const ALIGN_VALUES = new Set(['left', 'center', 'right']);

  function sanitizeReadme(html, ctx) {
    const doc = new DOMParser().parseFromString(html, 'text/html'); // inert: nothing runs or loads
    const out = document.createDocumentFragment();
    walk(doc.body, out, 0);
    return out;

    function resolve(value, base, isImage) {
      try {
        let v = value.trim();
        if (/^[a-z][a-z\d+.-]*:/i.test(v) || v.startsWith('//')) return new URL(v, 'https://github.com').href;
        if (v.startsWith('/')) v = v.slice(1); // GitHub treats "/x" as repo-root relative
        return new URL(v, base).href;
      } catch { return null; }
    }

    function walk(node, parent, depth) {
      if (depth > 60) return;
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(child.nodeValue)); continue; }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.localName;
        if (README_DROP.has(tag)) continue;
        if (!README_ALLOWED.has(tag)) { walk(child, parent, depth + 1); continue; } // unwrap unknown tags (e.g. g-emoji, picture)

        const el = document.createElement(tag);
        const get = (name) => child.getAttribute(name);

        const id = get('id');
        if (id && id.startsWith('user-content-')) el.id = id;
        const align = (get('align') || '').toLowerCase();
        if (ALIGN_VALUES.has(align) && ['p', 'div', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'img', 'table'].includes(tag)) el.setAttribute('align', align);

        if (tag === 'a') {
          const href = get('href');
          if (href && href.startsWith('#')) {
            el.setAttribute('href', href);
          } else if (href) {
            const base = `https://github.com/${ctx.owner}/${ctx.repo}/blob/${ctx.branch}/`;
            const abs = /^mailto:/i.test(href.trim()) ? href.trim() : safeHttpUrl(resolve(href, base, false) || '');
            if (abs) {
              el.setAttribute('href', abs);
              if (!abs.startsWith('mailto:')) {
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener noreferrer nofollow ugc');
              }
            }
          }
          if (get('title')) el.setAttribute('title', get('title'));
        } else if (tag === 'img') {
          const base = `${RAW}/${ctx.owner}/${ctx.repo}/${ctx.branch}/`;
          const src = get('src') ? resolve(get('src'), base, true) : null;
          if (!src || !src.startsWith('https://')) continue;
          el.setAttribute('src', src);
          el.setAttribute('alt', get('alt') || '');
          el.setAttribute('loading', 'lazy');
          el.setAttribute('decoding', 'async');
          el.setAttribute('referrerpolicy', 'no-referrer');
          for (const dim of ['width', 'height']) {
            if (/^\d{1,4}$/.test(get(dim) || '')) el.setAttribute(dim, get(dim));
          }
          if (get('title')) el.setAttribute('title', get('title'));
        } else if (tag === 'input') {
          if (get('type') !== 'checkbox') continue;
          el.setAttribute('type', 'checkbox');
          el.disabled = true;
          el.checked = child.hasAttribute('checked');
          el.setAttribute('aria-label', 'Task list item');
        } else if (tag === 'td' || tag === 'th') {
          for (const a of ['colspan', 'rowspan']) if (/^\d{1,2}$/.test(get(a) || '')) el.setAttribute(a, get(a));
        } else if (tag === 'ol') {
          if (/^\d{1,5}$/.test(get('start') || '')) el.setAttribute('start', get('start'));
        } else if (tag === 'details') {
          if (child.hasAttribute('open')) el.setAttribute('open', '');
        }

        walk(child, el, depth + 1);

        // GitHub's heading "anchor" links are empty once the octicon SVG is removed. They also carry the
        // heading's id, so hand that id to the heading before dropping the link (keeps in-page links working).
        if (tag === 'a' && !el.textContent.trim() && !el.querySelector('img')) {
          if (el.id && parent.nodeType === Node.ELEMENT_NODE && !parent.id) parent.id = el.id;
          continue;
        }
        parent.append(el);
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Optional portfolio.json
   * ------------------------------------------------------------------ */
  function normalizeConfig(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const cfg = {};
    if (typeof obj.bio === 'string' && obj.bio.trim()) cfg.bio = obj.bio.trim().slice(0, 500);
    if (typeof obj.headline === 'string' && obj.headline.trim()) cfg.headline = obj.headline.trim().slice(0, 140);
    if (typeof obj.themeColor === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(obj.themeColor.trim())) {
      cfg.themeColor = obj.themeColor.trim();
    }
    if (Array.isArray(obj.featured)) {
      cfg.featured = obj.featured
        .filter((x) => typeof x === 'string')
        .map((x) => x.trim().replace(/^.*\//, ''))
        .filter(Boolean)
        .slice(0, 12);
    }
    return Object.keys(cfg).length ? cfg : null;
  }

  // Looks in {login}/{login} first, then in up to three repos with "portfolio" in the name.
  // Only repos from the already-fetched list are tried, so there are no blind 404s.
  async function findPortfolioConfig(login, repos) {
    const lower = login.toLowerCase();
    const candidates = [];
    const profileRepo = repos.find((r) => r.name.toLowerCase() === lower);
    if (profileRepo) candidates.push(profileRepo);
    for (const r of repos) {
      if (candidates.length >= 4) break;
      if (!r.fork && /portfolio/i.test(r.name) && !candidates.includes(r)) candidates.push(r);
    }
    for (const repo of candidates) {
      const url = `${RAW}/${repo.full_name}/${encodeURIComponent(repo.default_branch)}/portfolio.json`;
      const key = 'cfg:' + url;
      let cfg = cacheGet(key);
      if (cfg === undefined) {
        cfg = null;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            if (text.length <= 64 * 1024) cfg = normalizeConfig(JSON.parse(text));
          }
        } catch { /* missing, invalid or blocked: fall back silently */ }
        cacheSet(key, cfg);
      }
      if (cfg) return { ...cfg, source: repo.full_name };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const state = {
    login: '',
    user: null,
    repos: [],
    config: null,
    filters: { q: '', lang: '', topic: '', sort: 'stars', forks: false },
    loadId: 0,
    detailId: 0
  };

  const els = {
    form: $('#search-form'), input: $('#username'), status: $('#status'), message: $('#message'),
    intro: $('#intro'), results: $('#results'), profile: $('#profile'), controls: $('#controls'),
    featured: $('#featured'), projects: $('#projects'),
    q: $('#f-q'), lang: $('#f-lang'), topic: $('#f-topic'), sort: $('#f-sort'), forks: $('#f-forks'),
    dialog: $('#detail'), dialogTitle: $('#detail-title'), dialogBody: $('#detail-body'), dialogClose: $('#detail-close'),
    theme: $('#theme-toggle')
  };

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function currentTheme() {
    return document.documentElement.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function syncThemeButton() {
    const dark = currentTheme() === 'dark';
    els.theme.replaceChildren(icon(dark ? 'sun' : 'moon', 20));
    els.theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    els.theme.setAttribute('aria-pressed', String(dark));
  }

  els.theme.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    syncThemeButton();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeButton);
  syncThemeButton();
  els.dialogClose.replaceChildren(icon('close', 20));

  function applyThemeColor(hex) {
    const root = document.documentElement;
    if (!hex) {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--on-accent');
      return;
    }
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--on-accent', contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#1d1a16') ? '#ffffff' : '#1d1a16');
  }

  /* ------------------------------------------------------------------ *
   * Views
   * ------------------------------------------------------------------ */
  function announce(text) {
    els.status.textContent = '';
    window.setTimeout(() => { els.status.textContent = text; }, 30);
  }

  function clearMessage() { els.message.replaceChildren(); }

  function showLanding() {
    clearMessage();
    els.results.hidden = true;
    els.intro.hidden = false;
    applyThemeColor(null);
    document.title = 'GitHub Portfolio Showcase · NimmaSsathi';
  }

  function skeletonCard() {
    return h('div', { class: 'card skeleton-card', 'aria-hidden': 'true' },
      h('div', { class: 'sk sk-line sk-w60' }), h('div', { class: 'sk sk-line' }), h('div', { class: 'sk sk-line sk-w80' }),
      h('div', { class: 'sk sk-line sk-w40' }));
  }

  function showSkeleton() {
    clearMessage();
    els.intro.hidden = true;
    els.results.hidden = false;
    els.controls.hidden = true;
    els.featured.replaceChildren();
    els.profile.replaceChildren(
      h('div', { class: 'profile', 'aria-hidden': 'true' },
        h('div', { class: 'sk sk-avatar' }),
        h('div', { class: 'profile-main' },
          h('div', { class: 'sk sk-line sk-w40 sk-lg' }), h('div', { class: 'sk sk-line sk-w20' }),
          h('div', { class: 'sk sk-line sk-w80' }))));
    els.projects.replaceChildren(h('div', { class: 'grid', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5, 6].map(skeletonCard)));
  }

  function describeError(err, login) {
    switch (err.kind) {
      case 'notfound':
        return {
          title: 'User not found',
          body: `We couldn't find a GitHub user or organisation called “${login}”. Check the spelling and try again.`
        };
      case 'ratelimit': {
        let when = 'in a little while';
        if (err.reset) {
          const d = new Date(err.reset * 1000);
          const mins = Math.max(1, Math.ceil((d.getTime() - Date.now()) / 60000));
          when = `at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (in about ${mins} minute${mins === 1 ? '' : 's'})`;
        }
        return {
          title: 'GitHub rate limit reached',
          body: `GitHub allows 60 anonymous requests per hour from one network, and that limit has been used up. It resets ${when}. Portfolios you have already opened stay available from the cache for 10 minutes.`
        };
      }
      case 'network':
        return {
          title: 'Can’t reach GitHub',
          body: 'The request failed, which usually means you are offline or something is blocking api.github.com. Check your connection and try again.',
          retry: true
        };
      default:
        return {
          title: 'Something went wrong',
          body: `GitHub answered with an unexpected error${err.status ? ` (HTTP ${err.status})` : ''}. Please try again in a moment.`,
          retry: true
        };
    }
  }

  function showError(err, login) {
    const info = describeError(err, login);
    els.results.hidden = true;
    els.intro.hidden = true;
    applyThemeColor(null);
    els.message.replaceChildren(
      h('div', { class: 'message message-error', role: 'alert' },
        h('h2', {}, info.title),
        h('p', {}, info.body),
        info.retry ? h('button', { type: 'button', class: 'btn', onclick: () => loadUser(login, { push: false }) }, 'Try again') : null));
    announce(info.title);
  }

  function showNotice(title, body) {
    els.results.hidden = true;
    els.intro.hidden = true;
    els.message.replaceChildren(
      h('div', { class: 'message', role: 'status' }, h('h2', {}, title), h('p', {}, body)));
    announce(title);
  }

  /* ------------------------------------------------------------------ *
   * Loading a user
   * ------------------------------------------------------------------ */
  function parseUsername(input) {
    let text = (input || '').trim();
    const urlMatch = text.match(/github\.com\/([^/?#\s]+)/i);
    if (urlMatch) text = urlMatch[1];
    return text.replace(/^@/, '');
  }

  async function loadUser(rawName, { push = true, openRepo = null } = {}) {
    const login = parseUsername(rawName);
    els.input.value = login;
    if (!USERNAME_RE.test(login)) {
      showError(new GitHubError('notfound', 'Invalid username'), login || rawName);
      return;
    }
    const loadId = ++state.loadId;
    if (els.dialog.open) els.dialog.close();

    if (push) {
      const url = new URL(location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('user', login);
      history.pushState({ user: login }, '', url);
    }

    showSkeleton();
    announce(`Loading ${login}'s projects`);

    let user, repos;
    try {
      [user, repos] = await Promise.all([
        getJSON(`${API}/users/${encodeURIComponent(login)}`),
        getJSON(`${API}/users/${encodeURIComponent(login)}/repos?per_page=100&sort=updated`)
      ]);
    } catch (err) {
      if (loadId !== state.loadId) return;
      showError(err instanceof GitHubError ? err : new GitHubError('network', String(err)), login);
      return;
    }
    if (loadId !== state.loadId) return;

    state.login = user.login;
    state.user = user;
    state.repos = Array.isArray(repos) ? repos : [];
    state.config = null;
    state.filters = { q: '', lang: '', topic: '', sort: 'stars', forks: false };
    applyThemeColor(null);
    document.title = `${user.name || user.login} · GitHub Portfolio Showcase`;

    if (!state.repos.length) {
      renderProfile();
      els.controls.hidden = true;
      els.featured.replaceChildren();
      els.projects.replaceChildren(
        h('div', { class: 'message', role: 'status' },
          h('h2', {}, 'No public repositories yet'),
          h('p', {}, `${user.name || user.login} hasn't published any public repositories, so there is nothing to showcase here.`)));
      announce(`${user.login} has no public repositories`);
      return;
    }

    els.q.value = '';
    els.sort.value = 'stars';
    els.forks.checked = false;
    els.controls.hidden = false;
    renderProfile();
    refreshFilterOptions();
    renderProjects();
    announce(`Loaded ${state.repos.length} repositories for ${user.login}`);

    if (openRepo) {
      const repo = state.repos.find((r) => r.name.toLowerCase() === openRepo.toLowerCase());
      if (repo) openDetail(repo, { updateUrl: false });
    }

    // Optional portfolio.json: re-render when found
    const config = await findPortfolioConfig(user.login, state.repos);
    if (loadId !== state.loadId || !config) return;
    state.config = config;
    applyThemeColor(config.themeColor);
    renderProfile();
    renderProjects();
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function renderProfile() {
    const { user, config } = state;
    const bio = (config && config.bio) || user.bio;
    const homepage = homepageUrl(user.blog);
    const avatar = safeHttpUrl(user.avatar_url);

    els.profile.replaceChildren(
      h('section', { class: 'profile', 'aria-labelledby': 'profile-name' },
        avatar ? h('img', { class: 'avatar', src: avatar + (avatar.includes('?') ? '&' : '?') + 's=240', alt: '', width: 112, height: 112 }) : null,
        h('div', { class: 'profile-main' },
          h('h2', { id: 'profile-name' }, user.name || user.login),
          h('p', { class: 'handle' }, h('a', { href: user.html_url, target: '_blank', rel: 'noopener noreferrer' }, `@${user.login}`),
            user.type === 'Organization' ? h('span', { class: 'badge' }, 'Organisation') : null),
          config && config.headline ? h('p', { class: 'headline' }, config.headline) : null,
          bio ? h('p', { class: 'bio' }, bio) : null,
          h('ul', { class: 'facts' },
            user.location ? h('li', {}, icon('pinpoint'), h('span', {}, user.location)) : null,
            h('li', {}, icon('people'), h('span', {}, h('strong', {}, numberFmt.format(user.followers || 0)), ' followers')),
            h('li', {}, icon('book'), h('span', {}, h('strong', {}, numberFmt.format(user.public_repos || 0)), ' public repos')),
            homepage ? h('li', {}, icon('link'), h('a', { href: homepage, target: '_blank', rel: 'noopener noreferrer nofollow' }, homepage.replace(/^https?:\/\//, '').replace(/\/$/, ''))) : null),
          h('div', { class: 'profile-actions' },
            h('a', { class: 'btn btn-primary', href: user.html_url, target: '_blank', rel: 'noopener noreferrer' }, 'View on GitHub', icon('external')),
            h('button', { type: 'button', class: 'btn', onclick: copyShareLink }, 'Copy share link')))));
  }

  async function copyShareLink(event) {
    const btn = event.currentTarget;
    const url = new URL(location.href);
    url.hash = '';
    url.search = '';
    url.searchParams.set('user', state.login);
    try {
      await navigator.clipboard.writeText(url.href);
      btn.textContent = 'Link copied';
    } catch {
      window.prompt('Copy this link:', url.href);
      return;
    }
    announce('Share link copied to clipboard');
    window.setTimeout(() => { btn.textContent = 'Copy share link'; }, 2000);
  }

  function baseRepos() {
    return state.repos.filter((r) => state.filters.forks || !r.fork);
  }

  function refreshFilterOptions() {
    const repos = baseRepos();
    const langs = new Map();
    const topics = new Map();
    for (const r of repos) {
      if (r.language) langs.set(r.language, (langs.get(r.language) || 0) + 1);
      for (const t of r.topics || []) topics.set(t, (topics.get(t) || 0) + 1);
    }
    const fill = (select, map, allLabel, current) => {
      const entries = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      select.replaceChildren(h('option', { value: '' }, allLabel),
        ...entries.map(([name, count]) => h('option', { value: name }, `${name} (${count})`)));
      select.value = map.has(current) ? current : '';
      return select.value;
    };
    state.filters.lang = fill(els.lang, langs, 'All languages', state.filters.lang);
    state.filters.topic = fill(els.topic, topics, 'All topics', state.filters.topic);
    els.lang.disabled = langs.size === 0;
    els.topic.disabled = topics.size === 0;
  }

  function matchesQuery(repo, q) {
    if (!q) return true;
    const hay = [repo.name, repo.description, repo.language, ...(repo.topics || [])].filter(Boolean).join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
  }

  function sortRepos(list, mode) {
    const pushed = (r) => Date.parse(r.pushed_at || r.updated_at) || 0;
    const sorted = [...list];
    if (mode === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    else if (mode === 'updated') sorted.sort((a, b) => pushed(b) - pushed(a));
    else sorted.sort((a, b) => b.stargazers_count - a.stargazers_count || pushed(b) - pushed(a));
    return sorted;
  }

  function filtersActive() {
    const f = state.filters;
    return Boolean(f.q.trim() || f.lang || f.topic);
  }

  function featuredRepos() {
    const names = (state.config && state.config.featured) || [];
    const out = [];
    for (const name of names) {
      const repo = state.repos.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (repo && !out.includes(repo)) out.push(repo);
    }
    return out;
  }

  function renderProjects() {
    const f = state.filters;
    const featured = filtersActive() ? [] : featuredRepos();

    els.featured.replaceChildren();
    if (featured.length) {
      els.featured.append(
        h('section', { class: 'section', 'aria-labelledby': 'featured-h' },
          h('div', { class: 'section-head' }, h('h2', { id: 'featured-h' }, 'Featured')),
          h('div', { class: 'grid' }, featured.map((r) => projectCard(r, { featured: true })))));
    }

    let list = baseRepos().filter((r) =>
      matchesQuery(r, f.q) && (!f.lang || r.language === f.lang) && (!f.topic || (r.topics || []).includes(f.topic)));
    if (featured.length) list = list.filter((r) => !featured.includes(r));
    list = sortRepos(list, f.sort);

    const total = state.user.public_repos || state.repos.length;
    const heading = featured.length ? 'More projects' : 'Projects';
    const head = h('div', { class: 'section-head' },
      h('h2', { id: 'projects-h' }, heading),
      h('p', { class: 'count', role: 'status' }, `${list.length} ${list.length === 1 ? 'project' : 'projects'}`));

    const body = list.length
      ? h('div', { class: 'grid' }, list.map((r) => projectCard(r)))
      : h('div', { class: 'message' },
          h('h2', {}, filtersActive() ? 'No projects match these filters' : 'Nothing to show'),
          h('p', {}, filtersActive() ? 'Try a different keyword, or clear the filters.' : 'Every public repository is a fork. Turn on “Include forks” to see them.'),
          filtersActive() ? h('button', { type: 'button', class: 'btn', onclick: clearFilters }, 'Clear filters') : null);

    const note = total > state.repos.length
      ? h('p', { class: 'note' }, `Showing the ${state.repos.length} most recently updated of ${total} public repositories. `,
          h('a', { href: `https://github.com/${encodeURIComponent(state.login)}?tab=repositories`, target: '_blank', rel: 'noopener noreferrer' }, 'See all on GitHub'), '.')
      : null;

    els.projects.replaceChildren(h('section', { class: 'section', 'aria-labelledby': 'projects-h' }, head, body, note));
  }

  function clearFilters() {
    state.filters.q = '';
    state.filters.lang = '';
    state.filters.topic = '';
    els.q.value = '';
    els.lang.value = '';
    els.topic.value = '';
    renderProjects();
  }

  function projectCard(repo, { featured = false } = {}) {
    const homepage = homepageUrl(repo.homepage);
    const topics = repo.topics || [];
    const shown = topics.slice(0, 4);
    const titleId = `repo-${repo.id}`;

    const meta = h('ul', { class: 'meta' },
      repo.language ? h('li', {}, h('span', { class: 'dot', style: `background:${langColor(repo.language)}` }), repo.language) : null,
      h('li', {}, icon('star'), h('span', { 'aria-hidden': 'true' }, numberFmt.format(repo.stargazers_count)), h('span', { class: 'sr-only' }, `${repo.stargazers_count} stars`)),
      h('li', {}, icon('fork'), h('span', { 'aria-hidden': 'true' }, numberFmt.format(repo.forks_count)), h('span', { class: 'sr-only' }, `${repo.forks_count} forks`)),
      h('li', {}, icon('clock'),
        h('time', { datetime: repo.pushed_at || repo.updated_at, title: dateFmt.format(new Date(repo.pushed_at || repo.updated_at)) },
          `Updated ${timeAgo(repo.pushed_at || repo.updated_at)}`)));

    return h('article', { class: 'card' + (featured ? ' card-featured' : ''), 'aria-labelledby': titleId },
      h('div', { class: 'card-top' },
        h('h3', { id: titleId }, h('button', { type: 'button', class: 'title-btn', onclick: () => openDetail(repo) }, repo.name)),
        featured ? h('span', { class: 'badge badge-accent' }, icon('pin', 12), 'Featured') : null,
        repo.fork ? h('span', { class: 'badge' }, 'Fork') : null,
        repo.archived ? h('span', { class: 'badge' }, 'Archived') : null),
      h('p', { class: 'desc' }, repo.description || 'No description provided.'),
      shown.length
        ? h('ul', { class: 'topics', 'aria-label': 'Topics' },
            shown.map((t) => h('li', {}, h('button', { type: 'button', class: 'chip chip-sm', title: `Filter by topic: ${t}`, onclick: () => filterByTopic(t) }, t))),
            topics.length > shown.length ? h('li', { class: 'more' }, `+${topics.length - shown.length}`) : null)
        : null,
      meta,
      h('div', { class: 'card-actions' },
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => openDetail(repo) }, 'Details'),
        h('a', { class: 'btn btn-sm', href: repo.html_url, target: '_blank', rel: 'noopener noreferrer' }, 'Repository', icon('external', 14)),
        homepage ? h('a', { class: 'btn btn-sm btn-accent', href: homepage, target: '_blank', rel: 'noopener noreferrer nofollow' }, 'Live demo', icon('external', 14)) : null));
  }

  function filterByTopic(topic) {
    state.filters.topic = topic;
    if (![...els.topic.options].some((o) => o.value === topic)) refreshFilterOptions();
    els.topic.value = topic;
    state.filters.topic = els.topic.value;
    renderProjects();
    els.controls.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    announce(`Filtered by topic ${topic}`);
  }

  /* ------------------------------------------------------------------ *
   * Detail dialog
   * ------------------------------------------------------------------ */
  function languageBar(languages) {
    const entries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
    if (!total) return h('p', { class: 'muted' }, 'GitHub reports no language data for this repository.');

    const top = entries.slice(0, 8);
    const rest = entries.slice(8).reduce((sum, [, bytes]) => sum + bytes, 0);
    const parts = top.map(([name, bytes]) => ({ name, pct: (bytes / total) * 100, color: langColor(name) }));
    if (rest) parts.push({ name: 'Other', pct: (rest / total) * 100, color: '#8a8478' });
    const fmt = (p) => (p < 0.1 ? '<0.1' : p.toFixed(1)) + '%';

    return h('div', { class: 'langs' },
      h('div', { class: 'langbar', role: 'img', 'aria-label': 'Language breakdown: ' + parts.map((p) => `${p.name} ${fmt(p.pct)}`).join(', ') },
        parts.map((p) => h('span', { style: `width:${Math.max(p.pct, 0.8)}%;background:${p.color}`, title: `${p.name} ${fmt(p.pct)}` }))),
      h('ul', { class: 'legend' },
        parts.map((p) => h('li', {}, h('span', { class: 'dot', style: `background:${p.color}` }), h('span', {}, p.name), h('span', { class: 'muted' }, fmt(p.pct))))));
  }

  function renderReadme(html, repo) {
    const box = h('div', { class: 'readme' });
    box.append(sanitizeReadme(html, { owner: repo.owner.login, repo: repo.name, branch: repo.default_branch || 'HEAD' }));
    box.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      const frag = decodeURIComponent(link.getAttribute('href').slice(1));
      const target = [...box.querySelectorAll('[id]')].find((n) => n.id === 'user-content-' + frag || n.id === frag);
      if (target) target.scrollIntoView({ block: 'start' });
    });
    return box;
  }

  function sectionError(err, what) {
    const info = describeError(err, '');
    return h('div', { class: 'message message-inline', role: 'alert' }, h('strong', {}, `Couldn't load ${what}. `), info.body);
  }

  async function openDetail(repo, { updateUrl = true } = {}) {
    const token = ++state.detailId;
    const homepage = homepageUrl(repo.homepage);

    els.dialogTitle.textContent = repo.name;
    els.dialogBody.replaceChildren(
      h('p', { class: 'desc' }, repo.description || 'No description provided.'),
      h('div', { class: 'detail-actions' },
        h('a', { class: 'btn btn-primary btn-sm', href: repo.html_url, target: '_blank', rel: 'noopener noreferrer' }, 'Open on GitHub', icon('external', 14)),
        homepage ? h('a', { class: 'btn btn-accent btn-sm', href: homepage, target: '_blank', rel: 'noopener noreferrer nofollow' }, 'Live demo', icon('external', 14)) : null),
      h('ul', { class: 'meta meta-detail' },
        h('li', {}, icon('star'), `${numberFmt.format(repo.stargazers_count)} stars`),
        h('li', {}, icon('fork'), `${numberFmt.format(repo.forks_count)} forks`),
        h('li', {}, icon('clock'), `Updated ${timeAgo(repo.pushed_at || repo.updated_at)}`),
        repo.license && repo.license.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? h('li', {}, repo.license.spdx_id) : null),
      h('h3', { class: 'dlg-h' }, 'Languages'),
      h('div', { id: 'dlg-langs' }, h('div', { class: 'sk sk-line', 'aria-hidden': 'true' })),
      h('h3', { class: 'dlg-h' }, 'README'),
      h('div', { id: 'dlg-readme' }, h('div', { class: 'sk sk-line', 'aria-hidden': 'true' }), h('div', { class: 'sk sk-line sk-w80', 'aria-hidden': 'true' }), h('div', { class: 'sk sk-line sk-w60', 'aria-hidden': 'true' })));

    if (!els.dialog.open) els.dialog.showModal();
    document.body.classList.add('modal-open');
    els.dialogBody.scrollTop = 0;

    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('user', state.login);
      url.searchParams.set('repo', repo.name);
      history.replaceState(history.state, '', url);
    }

    const owner = encodeURIComponent(repo.owner.login);
    const name = encodeURIComponent(repo.name);
    const [langs, readme] = await Promise.allSettled([
      getJSON(`${API}/repos/${owner}/${name}/languages`),
      getReadmeHtml(repo.owner.login, repo.name)
    ]);
    if (token !== state.detailId || !els.dialog.open) return;

    const langBox = $('#dlg-langs');
    const readmeBox = $('#dlg-readme');
    langBox.replaceChildren(langs.status === 'fulfilled' ? languageBar(langs.value) : sectionError(langs.reason, 'the language breakdown'));
    if (readme.status === 'fulfilled') {
      readmeBox.replaceChildren(readme.value
        ? renderReadme(readme.value, repo)
        : h('p', { class: 'muted' }, 'This repository has no README.'));
    } else {
      readmeBox.replaceChildren(sectionError(readme.reason, 'the README'));
    }
  }

  els.dialog.addEventListener('close', () => {
    if (els.dialog.open) return; // dialog was reopened before this (asynchronous) event ran
    document.body.classList.remove('modal-open');
    state.detailId++;
    const url = new URL(location.href);
    if (url.searchParams.has('repo')) {
      url.searchParams.delete('repo');
      history.replaceState(history.state, '', url);
    }
  });
  els.dialogClose.addEventListener('click', () => els.dialog.close());
  els.dialog.addEventListener('click', (event) => { if (event.target === els.dialog) els.dialog.close(); });

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = els.input.value;
    if (name.trim()) loadUser(name);
  });

  document.querySelectorAll('.chip[data-user]').forEach((btn) =>
    btn.addEventListener('click', () => loadUser(btn.dataset.user)));

  let queryTimer;
  els.q.addEventListener('input', () => {
    window.clearTimeout(queryTimer);
    queryTimer = window.setTimeout(() => { state.filters.q = els.q.value; renderProjects(); }, 120);
  });
  els.lang.addEventListener('change', () => { state.filters.lang = els.lang.value; renderProjects(); });
  els.topic.addEventListener('change', () => { state.filters.topic = els.topic.value; renderProjects(); });
  els.sort.addEventListener('change', () => { state.filters.sort = els.sort.value; renderProjects(); });
  els.forks.addEventListener('change', () => {
    state.filters.forks = els.forks.checked;
    refreshFilterOptions();
    renderProjects();
  });

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const user = params.get('user');
    if (user) loadUser(user, { push: false, openRepo: params.get('repo') });
    else { state.loadId++; showLanding(); els.input.value = ''; }
  }
  window.addEventListener('popstate', loadFromUrl);
  pruneCache();
  loadFromUrl();
})();
