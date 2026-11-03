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
    const r = await fetch(cfg.api, {method:'POST', body: JSON.stringify(body)});
    const j = await r.json(); if(!j.ok) throw new Error(j.error || 'api'); return j;
  }
};

/* Turn config + saved layout into the ordered list of posts shown in the grid. */
function arrange(cfg, layout){
  layout = layout || cfg.defaultLayout || {};
  const byId = Object.fromEntries(cfg.posts.map(p => [p.id, p]));
  const removed = new Set(layout.removed || []);
  const ids = (layout.order || []).filter(id => byId[id] && !removed.has(id));
  cfg.posts.forEach(p => { if(!ids.includes(p.id) && !removed.has(p.id)) ids.unshift(p.id); });
  const caps = layout.captions || {};
  const pins = new Set(layout.pinned || []);
  return ids.map(id => ({...byId[id], caption: caps[id] ?? byId[id].caption, pinned: pins.has(id)}));
}
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
   opts: {posts, startId, onComment(id), onApprove(id), statusOf(id)} */
function openReels(root, opts){
  const reels = opts.posts.filter(p => p.video);
  const start = Math.max(0, reels.findIndex(p => p.id === opts.startId));
  const wrap = document.createElement('div');
  wrap.className = 'reelv';
  wrap.innerHTML = `<button type="button" class="rv-close" aria-label="დახურვა">${IC.close}</button>
    <div class="rv-list">${reels.map(p => `
      <section class="rv-item" data-id="${p.id}">
        <video src="${mediaUrl(p.video)}" poster="${mediaUrl(p.media[0])}" playsinline loop preload="metadata"></video>
        <span class="rv-play" hidden>${IC.play}</span>
        <div class="rv-side">
          ${opts.onComment ? `<button type="button" class="rv-btn" data-act="cmt" aria-label="კომენტარი">${IC.cmt.replace('currentColor','#fff')}<small>კომენტარი</small></button>` : ''}
          ${opts.onApprove ? `<button type="button" class="rv-btn" data-act="ok" aria-label="დამტკიცება">${IC.check}<small>${opts.statusOf && opts.statusOf(p.id)==='approved' ? 'დამტკიცდა' : 'დამტკიცება'}</small></button>` : ''}
          <button type="button" class="rv-btn" data-act="mute" aria-label="ხმა">${IC.sound}<small>ხმა</small></button>
        </div>
        <div class="rv-cap"><b>${esc(opts.username || '')}</b><span>${esc((p.caption||'').split('\n').slice(0,3).join('\n'))}</span></div>
      </section>`).join('')}</div>`;
  root.appendChild(wrap);
  const list = wrap.querySelector('.rv-list');
  let muted = false;
  const io = new IntersectionObserver(es => es.forEach(en => {
    const v = en.target.querySelector('video');
    if(en.isIntersecting && en.intersectionRatio > .6){ v.muted = muted; v.play().catch(() => { v.muted = true; muted = true; v.play().catch(()=>{}); }); }
    else { v.pause(); }
  }), {root: list, threshold:[0,.6,1]});
  wrap.querySelectorAll('.rv-item').forEach(s => {
    io.observe(s);
    const v = s.querySelector('video'), pl = s.querySelector('.rv-play');
    v.addEventListener('pause', () => pl.hidden = false);
    v.addEventListener('play', () => pl.hidden = true);
  });
  requestAnimationFrame(() => { list.scrollTop = start * list.clientHeight; });
  const close = () => { io.disconnect(); wrap.querySelectorAll('video').forEach(v => v.pause()); wrap.remove(); };
  wrap.addEventListener('click', e => {
    if(e.target.closest('.rv-close')){ close(); return; }
    const b = e.target.closest('.rv-btn'); const item = e.target.closest('.rv-item');
    if(b && item){
      const id = item.dataset.id;
      if(b.dataset.act === 'mute'){ muted = !muted; wrap.querySelectorAll('video').forEach(v => v.muted = muted); wrap.querySelectorAll('[data-act=mute]').forEach(x => x.firstElementChild.outerHTML = muted ? IC.muted : IC.sound); }
      if(b.dataset.act === 'cmt' && opts.onComment) opts.onComment(id);
      if(b.dataset.act === 'ok' && opts.onApprove) opts.onApprove(id, b);
      return;
    }
    if(item && !e.target.closest('.rv-cap')){ const v = item.querySelector('video'); v.paused ? v.play().catch(()=>{}) : v.pause(); }
  });
  document.addEventListener('keydown', function k(e){ if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', k); } });
  return close;
}
