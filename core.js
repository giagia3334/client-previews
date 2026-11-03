/* Shared code for the Instagram preview (client) and studio (team) pages.
   Data: clients/<c>/config.json (posts + media), layout/comments/approvals live in the
   client's Google Sheet behind an Apps Script web app (config.api). */
const Q = new URLSearchParams(location.search);
const CLIENT = (Q.get('c') || 'likedent').replace(/[^a-z0-9_-]/gi, '');
const BASE = `clients/${CLIENT}/`;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
const mediaUrl = f => BASE + 'media/' + f;

/* home-screen icon (white logo) when the page is added from Safari or Chrome */
(() => {
  const add = (rel, href, sizes) => { const l = document.createElement('link'); l.rel = rel; l.href = href; if(sizes) l.sizes = sizes; document.head.appendChild(l); };
  add('apple-touch-icon', BASE + 'apple-touch-icon.png', '180x180');
  add('icon', BASE + 'icon-192.png', '192x192');
  const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-title'; m.content = CLIENT.charAt(0).toUpperCase() + CLIENT.slice(1); document.head.appendChild(m);
})();

async function loadConfig(){
  const r = await fetch(BASE + 'config.json', {cache:'no-store'});
  if(!r.ok) throw new Error('config ' + r.status);
  return r.json();
}

const api = {
  async state(cfg){
    if(!cfg.api) return null;
    const r = await fetch(cfg.api + '?action=state&t=' + Date.now());
    const j = await r.json(); if(!j.ok) throw new Error(j.error || 'api'); return j;
  },
  async post(cfg, body){
    if(!cfg.api) throw new Error('no api');
    // text/plain body keeps this a "simple" request (no CORS preflight) for Apps Script
    // a stuck request must not leave the page waiting forever
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), body.action === 'sync' ? 300000 : 30000);
    try{
      const r = await fetch(cfg.api, {method:'POST', body: JSON.stringify(body), signal: ac.signal});
      const j = await r.json(); if(!j.ok) throw new Error(j.error || 'api'); return j;
    }finally{ clearTimeout(t); }
  }
};

/* Turn config + saved layout into the ordered list of posts shown in the grid. */
function arrange(cfg, layout){
  layout = layout || cfg.defaultLayout || {};
  const byId = Object.fromEntries(cfg.posts.map(p => [p.id, p]));
  const removed = new Set(layout.removed || []);
  const ids = [...new Set(layout.order || [])].filter(id => byId[id] && !removed.has(id));   // a post shows once even if saved twice
  cfg.posts.forEach(p => { if(!ids.includes(p.id) && !removed.has(p.id)) ids.unshift(p.id); });
  const caps = layout.captions || {};
  const pins = new Set(layout.pinned || []);
  return ids.map(id => ({...byId[id], caption: caps[id] ?? byId[id].caption, pinned: pins.has(id)}));
}
/* posts that share a "group" (versions of one video) show as one post; its versions swipe sideways */
function groupVariants(posts){
  const out = [], seen = {};
  posts.forEach(p => {
    if(!p.group){ out.push(p); return; }
    if(seen[p.group]){ seen[p.group].variants.push(p); return; }
    const g = {...p, variants: [p]}; seen[p.group] = g; out.push(g);
  });
  out.forEach(p => { if(p.variants && p.variants.length < 2) delete p.variants; });
  return out;
}
const flatVariants = posts => posts.flatMap(p => p.variants || [p]);
/* Instagram shows pinned posts first */
const displayOrder = posts => [...posts.filter(p => p.pinned), ...posts.filter(p => !p.pinned)];

const IC = {
  sun:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  moon:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  reel:'<svg class="badge" width="20" height="20" viewBox="0 0 24 24"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="#fff"/><path d="M10 8.2v7.6l6-3.8z" fill="#000"/></svg>',
  car:'<svg class="badge" width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M7 3h11a3 3 0 0 1 3 3v11h-2V6a1 1 0 0 0-1-1H7z"/><rect x="3" y="7" width="14" height="14" rx="2.5"/></svg>',
  pin:'<svg class="badge" width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M15.5 2.5 21.5 8.5 19 9.5 15.6 12.9l.4 4.6-1.8 1.8-3.6-3.6L5.5 20.6l-1.1-1.1 4.9-5.1-3.6-3.6 1.8-1.8 4.6.4L14.5 5z"/></svg>',
  heart:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.9-8 10.6-8 10.6z"/></svg>',
  cmt:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.5 11.5a8.5 8.5 0 1 1-4-7.2 8.5 8.5 0 0 1 4 7.2z"/><path d="m20.5 20.5-3-3.2"/></svg>',
  send:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21.5 3 10.2 13.8M21.5 3l-7 18-4.3-7.2L3 9.6z"/></svg>',
  save:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5.5L5 21V3h14z"/></svg>',
  dots:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
  muted:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="#fff"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
  sound:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  play:'<svg width="68" height="68" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.4)"/><path d="M10 8v8l6-4z" fill="#fff"/></svg>',
  close:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4 7 12l8 8"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  reelS:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="m10 8.5 5 3.5-5 3.5z" fill="#fff"/></svg>'
};

const fmtTime = ts => { try{ return new Date(ts).toLocaleString('ka-GE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };

/* Fullscreen vertical reels viewer, shared by both pages.
   Posts with versions ("variants") swipe sideways inside one reel.
   One <video> element is reused for every reel: phones load only the reel on screen,
   and once the first tap starts it with sound, iOS keeps sound for the next reels.
   opts: {posts, startId, onComment(id), onApprove(id), statusOf(id)} */
function openReels(root, opts){
  const reels = opts.posts.filter(p => p.video || p.variants);
  const startAt = reels.findIndex(p => (p.variants || [p]).some(v => v.id === opts.startId));
  const start = Math.max(0, startAt);
  const fill = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;background:#000';
  const okLabel = (id, many) => opts.statusOf && opts.statusOf(id) === 'approved' ? (many ? 'არჩეულია' : 'დამტკიცდა') : (many ? 'ამას ვირჩევ' : 'დამტკიცება');
  const wrap = document.createElement('div');
  wrap.className = 'reelv';
  wrap.innerHTML = `<button type="button" class="rv-close" aria-label="დახურვა">${IC.close}</button>
    <div class="rv-list">${reels.map(g => { const vs = g.variants || [g], many = vs.length > 1; return `
      <section class="rv-item" data-id="${g.id}">
        <div class="rv-h" style="position:absolute;inset:0;display:flex;overflow-x:${many ? 'auto' : 'hidden'};scroll-snap-type:x mandatory;scrollbar-width:none">
          ${vs.map(v => `<div class="rv-slide" data-id="${v.id}" style="position:relative;flex:0 0 100%;height:100%;scroll-snap-align:start"><img src="${mediaUrl(v.media[0])}" alt="" style="${fill}"></div>`).join('')}
        </div>
        ${many ? `<div class="rv-var" style="position:absolute;top:18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);color:#fff;font-size:12.5px;font-weight:600;padding:4px 10px;border-radius:12px;pointer-events:none">ვარიანტი 1/${vs.length} · ← →</div>` : ''}
        <span class="rv-play" hidden>${IC.play}</span>
        <div class="rv-side">
          ${opts.onComment ? `<button type="button" class="rv-btn" data-act="cmt" aria-label="კომენტარი">${IC.cmt.replace('currentColor','#fff')}<small>კომენტარი</small></button>` : ''}
          ${opts.onApprove ? `<button type="button" class="rv-btn" data-act="ok" aria-label="დამტკიცება">${IC.check}<small>${okLabel(vs[0].id, many)}</small></button>` : ''}
          <button type="button" class="rv-btn" data-act="mute" aria-label="ხმა">${IC.sound}<small>ხმა</small></button>
        </div>
        <div class="rv-cap"><b>${esc(opts.username || '')}</b><span>${esc((g.caption||'').split('\n').slice(0,3).join('\n'))}</span></div>
      </section>`; }).join('')}</div>`;
  root.appendChild(wrap);
  const list = wrap.querySelector('.rv-list');
  const items = [...wrap.querySelectorAll('.rv-item')];
  const byId = Object.fromEntries(reels.flatMap(g => g.variants || [g]).map(v => [v.id, v]));
  const vid = document.createElement('video');
  vid.playsInline = true; vid.loop = true; vid.preload = 'auto'; vid.setAttribute('playsinline', '');
  vid.style.cssText = fill;
  let muted = false, cur = null;
  const setMuteIcons = () => wrap.querySelectorAll('[data-act=mute]').forEach(x => x.firstElementChild.outerHTML = muted ? IC.muted : IC.sound);
  const item = () => cur && cur.closest('.rv-item');
  const overlay = () => item() && (item().querySelector('.rv-play').hidden = !vid.paused);
  vid.addEventListener('pause', overlay); vid.addEventListener('play', overlay);
  function play(){
    vid.muted = muted;
    const p = vid.play();
    // the phone refused sound without a tap: keep playing muted and show it
    if(p) p.catch(() => { muted = true; vid.muted = true; setMuteIcons(); vid.play().catch(() => {}); });
  }
  function activate(slide){
    if(cur === slide) return;
    cur = slide; const v = byId[slide.dataset.id];
    vid.pause(); slide.appendChild(vid);
    vid.poster = mediaUrl(v.media[0]); vid.src = mediaUrl(v.video);
    const it = slide.closest('.rv-item'), slides = [...it.querySelectorAll('.rv-slide')], i = slides.indexOf(slide);
    const lab = it.querySelector('.rv-var'); if(lab) lab.textContent = `ვარიანტი ${i + 1}/${slides.length}` + (slides.length > 1 ? ' · ← →' : '');
    const ok = it.querySelector('[data-act=ok] small'); if(ok) ok.textContent = okLabel(v.id, slides.length > 1);
    play();
  }
  // still inside the opening tap, so sound is allowed
  const first = items[start].querySelector(`.rv-slide[data-id="${opts.startId}"]`) || items[start].querySelector('.rv-slide');
  activate(first);
  const io = new IntersectionObserver(es => es.forEach(en => { if(en.isIntersecting && en.intersectionRatio > .6) activate(en.target); }), {threshold:[0,.6,1]});
  wrap.querySelectorAll('.rv-slide').forEach(s => io.observe(s));
  requestAnimationFrame(() => {
    list.scrollTop = start * list.clientHeight;
    const h = first.parentNode; h.scrollLeft = first.offsetLeft;
  });
  const close = () => { io.disconnect(); vid.pause(); vid.removeAttribute('src'); vid.load(); wrap.remove(); };
  wrap.addEventListener('click', e => {
    if(e.target.closest('.rv-close')){ close(); return; }
    const b = e.target.closest('.rv-btn'), it = e.target.closest('.rv-item');
    if(b && it){
      const id = it === item() ? cur.dataset.id : it.querySelector('.rv-slide').dataset.id;
      if(b.dataset.act === 'mute'){ muted = !muted; vid.muted = muted; setMuteIcons(); if(vid.paused) play(); }
      if(b.dataset.act === 'cmt' && opts.onComment) opts.onComment(id);
      if(b.dataset.act === 'ok' && opts.onApprove) opts.onApprove(id, b);
      return;
    }
    if(it && !e.target.closest('.rv-cap')){
      const sl = e.target.closest('.rv-slide');
      if(sl && sl !== cur) activate(sl); else if(vid.paused) play(); else vid.pause();
    }
  });
  document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
  return close;
}
