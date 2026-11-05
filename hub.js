/* Like Dent client hub, built around the Instagram preview in preview.html.
   - Content: the existing Instagram phone preview (untouched: approvals, comments, reels),
     plus read-and-approve previews for Instagram on a computer, Facebook and YouTube.
   - Patients: new -> booked -> done pipeline (Apps Script Hub.gs). Sign in with Google
     (emails on the list in hub-admin), the clinic PIN as a fallback, or the studio team key.
   - Analytics: leads, bookings, cost per lead by channel.
   ?demo=1 shows sample patients offline. */
(() => {
const DEMO = Q.get('demo') === '1';
// a link to one post (?post=ID): keep the page covered until that post's window is open
if(Q.get('post')) document.documentElement.classList.add('deeplink');
const undeep = () => document.documentElement.classList.remove('deeplink');
const PINKEY = 'hub_pin_' + CLIENT, PLATKEY = 'hub_plat_' + CLIENT, SESKEY = 'hub_ses_' + CLIENT;
const STAGES = [
  {id:'new',    label:'ახალი პაციენტი', short:'ახალი',    next:'booked', nextLabel:'დაიჯავშნა'},
  {id:'booked', label:'დაჯავშნილი',      short:'დაჯავშნა', next:'done',   nextLabel:'ჩაიტარა'},
  {id:'done',   label:'ჩატარებული',      short:'ჩაიტარა'},
];
const LOST = {id:'lost', label:'არქივი', short:'არქივი'};
const STAGE_LABEL = {new:'ახალი პაციენტი', booked:'დაჯავშნილი', done:'ჩატარებული', lost:'არქივი'};
const CHANNELS = {website:'საიტი', facebook:'Facebook', instagram:'Instagram', google:'Google', tiktok:'TikTok', sms:'SMS', phone:'ზარი', walkin:'კლინიკაში მოვიდა', referral:'რეკომენდაცია', other:'სხვა'};
const SERVICES = ['კონსულტაცია','კბილი ან ღრძილი მაწუხებს','წმენდა და შემოწმება','კბილის აღდგენა ან ჩანაცვლება','ღიმილის გალამაზება','ბავშვისთვის','სხვა'];
const MONTHS = ['იან','თებ','მარ','აპრ','მაი','ივნ','ივლ','აგვ','სექ','ოქტ','ნოე','დეკ'];
// each network has a phone and a computer view; the view key is what gets stored and rendered
const NETS = [['ig','Instagram'],['fb','Facebook'],['yt','YouTube']];
const VIEWS = {ig:{m:'ig', d:'igweb'}, fb:{m:'fbm', d:'fb'}, yt:{m:'ytm', d:'yt'}};
const VIEW_OF = {}; Object.entries(VIEWS).forEach(([n, v]) => { VIEW_OF[v.m] = [n, 'm']; VIEW_OF[v.d] = [n, 'd']; });
const SV = (d, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  content: SV('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M3.5 9.5h17M9.5 9.5v11"/>'),
  patients: SV('<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 19.5a6.3 6.3 0 0 1 12.4 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.2a6 6 0 0 1 3.2 5.3"/>'),
  analytics: SV('<path d="M4 20h16"/><path d="M7 16.5v-5M12 16.5V7M17 16.5v-8"/>'),
  moon: SV('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', 18),
  sun: SV('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>', 18),
  plus: SV('<path d="M12 5v14M5 12h14"/>', 18),
  check: SV('<path d="m5 12.5 4.2 4.2L19 7"/>', 16),
  phone: SV('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', 16),
  chat: SV('<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 20.5 11.5z"/>', 16),
  close: SV('<path d="M6 6l12 12M18 6 6 18"/>', 18),
  mobile: SV('<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>', 17),
  desktop: SV('<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>', 17),
  link: SV('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>', 18),
  play: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  reel: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  car: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3h11a3 3 0 0 1 3 3v11h-2V6a1 1 0 0 0-1-1H7z"/><rect x="3" y="7" width="14" height="14" rx="2.5"/></svg>',
};

let CH = {facebook:{}, youtube:{}};
const chUrl = f => f ? BASE + 'channels/' + f : '';
let CFGH = null, TABS = {content:true, patients:false, analytics:false}, cur = 'content', plat = ls.get(PLATKEY) || 'ig';
let LEADS = [], SPEND = {}, ROLE = '', loaded = false, busy = 0, pickStage = 'new', showLost = false, period = 'month';
const pin = () => ls.get(PINKEY) || '';
const session = () => ls.get(SESKEY) || '';
let GCLIENT = '', ME = '', usePin = false;
const teamKey = () => ls.get('igs_key_' + CLIENT) || '';
const me = () => (ls.get('igp_name') || '').trim();
const money = v => (Math.round(v * 10) / 10).toLocaleString('ka-GE', {maximumFractionDigits: 1}) + ' ₾';
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const fmt = ts => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const telHref = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
const waHref = p => { let d = String(p).replace(/\D/g, ''); if(d.length === 9) d = '995' + d; return 'https://wa.me/' + d; };
const cleanTitle = t => String(t || '').replace(/\s*·\s*ვარიანტი.*$/, '');
let toastT; const toast = m => { const t = $('#hubtoast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); };
const isDark = () => document.body.classList.contains('dark');

/* ---------- shell ---------- */
const app = $('#app'), stage = document.querySelector('.stage');
function navItems(cls){
  return [['content','კონტენტი'],['patients','პაციენტები'],['analytics','ანალიტიკა']]
    .map(([k, t]) => `<button type="button" class="${cls}" data-tab="${k}">${I[k]}<span>${t}</span>${k === 'patients' ? '<span class="n" hidden></span>' : ''}</button>`).join('');
}
const shell = document.createElement('div');
shell.className = 'shell';
shell.innerHTML = `
  <aside class="side" aria-label="განყოფილებები">
    <div class="brand"><img alt="" data-av><div><b data-client>Like Dent</b><small>კლინიკის პანელი</small></div></div>
    ${navItems('nav-i')}
    <div class="grow"></div>
    <div class="foot"><button type="button" class="icon-btn" data-theme aria-label="ღია ან მუქი რეჟიმი"></button></div>
  </aside>
  <header class="mtop"><img alt="" data-av><b data-client>Like Dent</b><button type="button" class="icon-btn" data-theme aria-label="ღია ან მუქი რეჟიმი"></button></header>
  <main class="main">
    <section class="pane" id="pContent">
      <div class="head"><div class="ttl"><h1>კონტენტი</h1><p>ასე გამოჩნდება დაგეგმილი პოსტები. გახსენით პოსტი, დაადასტურეთ ან დაწერეთ, რა შევცვალოთ.</p></div>
        <div class="ctrls"><div class="seg" role="group" aria-label="პლატფორმა" id="platSeg"><span class="thumb"></span>${NETS.map(([k, t]) => `<button type="button" data-net="${k}" aria-pressed="false">${t}</button>`).join('')}</div>
        <div class="seg dev" role="group" aria-label="მოწყობილობა" id="devSeg"><span class="thumb"></span><button type="button" data-dev="m" aria-pressed="false" title="ტელეფონი">${I.mobile}<span>ტელეფონი</span></button><button type="button" data-dev="d" aria-pressed="false" title="კომპიუტერი">${I.desktop}<span>კომპიუტერი</span></button></div></div></div>
      <div class="body">
        <div class="plat" data-plat="ig"></div>
        <div class="plat" data-plat="igweb" hidden></div>
        <div class="plat" data-plat="fb" hidden></div>
        <div class="plat" data-plat="yt" hidden></div>
        <div class="plat" data-plat="fbm" hidden></div>
        <div class="plat" data-plat="ytm" hidden></div>
      </div>
    </section>
    <section class="pane" id="pPatients" hidden>
      <div class="head"><div class="ttl"><h1>პაციენტები</h1><p id="ptSub">მოთხოვნები საიტიდან, რეკლამიდან და ზარებიდან.</p></div><button type="button" class="btn primary" id="ptAdd" hidden>${I.plus}ახალი პაციენტი</button></div>
      <div class="body" id="ptBody"></div>
    </section>
    <section class="pane" id="pAnalytics" hidden>
      <div class="head"><div class="ttl"><h1>ანალიტიკა</h1><p>რამდენი პაციენტი მოვიდა, საიდან და რა დაჯდა თითო.</p></div>
        <div class="seg" role="group" aria-label="პერიოდი" id="perSeg"><span class="thumb"></span>${[['month','ეს თვე'],['prev','წინა თვე'],['q','3 თვე'],['all','სულ']].map(([k, t]) => `<button type="button" data-per="${k}" aria-pressed="false">${t}</button>`).join('')}</div></div>
      <div class="body" id="anBody"></div>
    </section>
  </main>
  <nav class="tabbar" aria-label="განყოფილებები">${navItems('')}</nav>`;
document.body.appendChild(shell);
document.body.insertAdjacentHTML('beforeend', `
  <div class="pm" id="pm" hidden role="dialog" aria-modal="true" aria-label="პოსტი"></div>
  <div class="hsheet" id="hsh" hidden><form id="hshf" novalidate></form></div>
  <div class="ovhost" id="ovhost"></div>
  <div class="hubtoast" id="hubtoast" role="status" hidden></div>`);
document.body.classList.add('hubbed');
shell.querySelector('.plat[data-plat="ig"]').appendChild(stage);

const panes = {content: $('#pContent'), patients: $('#pPatients'), analytics: $('#pAnalytics')};
function paintTheme(){ document.querySelectorAll('[data-theme]').forEach(b => b.innerHTML = isDark() ? I.sun : I.moon); }
document.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { $('#themeBtn').click(); paintTheme(); });
$('#themeBtn').addEventListener('click', () => setTimeout(paintTheme));
paintTheme();

function moveThumb(seg){
  const on = seg.querySelector('[aria-pressed="true"]'), th = seg.querySelector('.thumb');
  if(!on || !th) return;
  th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
}
function setSeg(seg, attr, val){
  seg.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)));
  requestAnimationFrame(() => moveThumb(seg));
}
addEventListener('resize', () => document.querySelectorAll('.seg').forEach(moveThumb));
// the web font changes button widths after load: keep the thumb under the pressed button
const segRO = new ResizeObserver(es => es.forEach(en => moveThumb(en.target.closest('.seg'))));
document.querySelectorAll('.seg button').forEach(b => segRO.observe(b));
if(document.fonts) document.fonts.ready.then(() => document.querySelectorAll('.seg').forEach(moveThumb));

function showTab(t){
  if(!TABS[t]) t = TABS.content ? 'content' : TABS.patients ? 'patients' : 'analytics';
  cur = t;
  document.querySelectorAll('[data-tab]').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  Object.entries(panes).forEach(([k, el]) => el.hidden = k !== t);
  if(t !== 'content') pauseIg();
  placeOverlays();
  if(t === 'content') showPlat(plat);
  else if(!loaded) loadHub(); else render();
  try{ history.replaceState(null, '', location.pathname + location.search + (t === 'content' ? '' : '#' + t)); }catch(e){}
}
document.addEventListener('click', e => { const b = e.target.closest('.nav-i[data-tab], .tabbar [data-tab]'); if(b) showTab(b.dataset.tab); });
function setupNav(){
  document.querySelectorAll('[data-tab]').forEach(b => b.hidden = !TABS[b.dataset.tab]);
  const want = (location.hash || '').slice(1);
  showTab(TABS[want] ? want : 'content');
}
const pauseIg = () => document.querySelectorAll('#feed video, .reelv video').forEach(v => v.pause());

/* the Instagram phone keeps its comment sheet and toast; other views get them above everything */
function placeOverlays(){
  const host = cur === 'content' && plat === 'ig' && !pmId ? app : $('#ovhost');
  const sh = $('#sh'), tt = $('#toast');
  if(sh && sh.parentNode !== host) host.appendChild(sh);
  if(tt && tt.parentNode !== host) host.appendChild(tt);
}

/* ---------- content: platforms ---------- */
function showPlat(p){
  if(!VIEW_OF[p]) p = 'ig';
  plat = p; ls.set(PLATKEY, p);
  setSeg($('#platSeg'), 'data-net', VIEW_OF[p][0]);
  setSeg($('#devSeg'), 'data-dev', VIEW_OF[p][1]);
  document.querySelectorAll('.plat').forEach(el => el.hidden = el.dataset.plat !== p);
  $('#pContent').classList.toggle('igphone', VIEW_OF[p][1] === 'm');
  if(p !== 'ig') pauseIg();
  placeOverlays();
  renderPlat();
}
$('#platSeg').addEventListener('click', e => { const b = e.target.closest('[data-net]'); if(b) showPlat(VIEWS[b.dataset.net][VIEW_OF[plat][1]]); });
$('#devSeg').addEventListener('click', e => { const b = e.target.closest('[data-dev]'); if(b) showPlat(VIEWS[VIEW_OF[plat][0]][b.dataset.dev]); });

const ready = () => typeof POSTS !== 'undefined' && POSTS.length && typeof CFG !== 'undefined' && CFG;
const postsInOrder = () => displayOrder(POSTS);
const statusChip = p => {
  if(p.posted) return '<span class="st-chip posted">გამოქვეყნებულია</span>';
  const s = groupStatus(p);
  return s === 'approved' ? `<span class="st-chip approved">${I.check}დადასტურდა</span>` : s === 'changes' ? '<span class="st-chip changes">შესაცვლელი</span>' : '';
};
const capOf = p => (p.variants ? p.variants[0] : p).caption || '';
const coverImg = () => { const p = postsInOrder().find(x => !x.video && x.media && x.media.length) || postsInOrder()[0]; return p ? mediaUrl(p.media[0]) : ''; };

function renderPlat(){
  if(!ready() || cur !== 'content') return;
  const el = document.querySelector(`.plat[data-plat="${plat}"]`);
  if(plat === 'igweb') el.innerHTML = igwebHTML();
  if(plat === 'fb') el.innerHTML = fbHTML();
  if(plat === 'yt') el.innerHTML = ytHTML();
  if(plat === 'fbm') el.innerHTML = fbmHTML();
  if(plat === 'ytm') el.innerHTML = ytmHTML();
}
function igwebHTML(){
  const P = postsInOrder();
  return `<div class="igw">
    <div class="igw-h"><img src="${mediaUrl(CFG.avatar)}" alt="">
      <div><div class="igw-u">${esc(CFG.username)}<span>Follow</span><span>Message</span></div>
        <div class="igw-s"><span><b>${POSTS.length}</b> posts</span><span><b>${esc(CFG.followers)}</b> followers</span><span><b>${esc(CFG.following)}</b> following</span></div>
        <div class="igw-b"><b>${esc(CFG.displayName)}</b>${esc(CFG.bio)}</div></div></div>
    <div class="igw-tabs"><span>POSTS</span><span>REELS</span><span>TAGGED</span></div>
    <div class="igw-g">${P.map(p => `<button type="button" class="tile2" data-open="${esc(p.id)}" aria-label="${esc(cleanTitle(p.title))}"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy">${statusChip(p)}<span class="kind">${p.video ? I.reel : p.media.length > 1 ? I.car : ''}</span><span class="ov">გახსნა</span></button>`).join('')}</div>
  </div>`;
}
function fbHTML(){
  const P = postsInOrder(), F = CH.facebook || {}, fbAv = chUrl(F.avatar) || mediaUrl(CFG.avatar), fbName = F.name || CFG.displayName;
  return `<div class="fbw">
    <div class="fb-cover"><img src="${chUrl(F.cover) || coverImg()}" alt=""></div>
    <div class="fb-id"><img src="${fbAv}" alt=""><div><b>${esc(fbName)}</b><small>${esc(F.followers || CFG.followers)} გამომწერი${F.following ? ', ' + esc(F.following) + ' გამოწერილი' : ''}</small></div></div>
    ${P.map(p => `<article class="fbp" data-open="${esc(p.id)}" tabindex="0">
      <header><img src="${fbAv}" alt=""><div><b>${esc(fbName)}</b><small>${p.posted ? 'გამოქვეყნებული' : 'დაგეგმილი პოსტი'}</small></div>${statusChip(p)}</header>
      ${capOf(p) ? `<div class="tx">${esc(capOf(p))}</div>` : ''}
      ${p.video ? `<div class="md"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy"><span class="play">${I.play}</span></div>`
        : p.media.length > 1 ? `<div class="fbcar"><div class="fbtrack" data-fbtrack>${p.media.map(m => `<div class="fbcard"><img src="${mediaUrl(m)}" alt="" loading="lazy"></div>`).join('')}</div><button type="button" class="car-btn prev" data-fbgo="-1" aria-label="წინა" hidden>${IGI.prev}</button><button type="button" class="car-btn next" data-fbgo="1" aria-label="შემდეგი">${IGI.next}</button></div>`
        : `<div class="md"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy"></div>`}
      <footer><span>მოწონება</span><span>კომენტარი</span><span>გაზიარება</span></footer>
    </article>`).join('')}
  </div>`;
}
function ytHTML(){
  const P = postsInOrder(), V = P.filter(p => p.video), S = P.filter(p => !p.video), Y = CH.youtube || {}, ytAv = chUrl(Y.avatar) || mediaUrl(CFG.avatar), ytName = Y.name || CFG.client;
  return `<div class="ytw">
    <div class="yt-banner"><img src="${chUrl(Y.banner) || coverImg()}" alt=""></div>
    <div class="yt-id"><img src="${ytAv}" alt=""><div><b>${esc(ytName)}</b><small>${esc(Y.handle || '@' + CFG.username)}${Y.subscribers ? ', ' + esc(Y.subscribers) + ' გამომწერი' : ''}${Y.videos ? ', ' + esc(Y.videos) + ' ვიდეო' : ''}</small></div><span class="yt-sub">გამოწერა</span></div>
    <div class="yt-tabs"><span>მთავარი</span><span class="on">Shorts</span><span>პოსტები</span></div>
    ${V.length ? `<div class="yt-sec">Shorts</div><div class="yt-shorts">${V.map(p => `<button type="button" class="ys" data-open="${esc(p.id)}"><div class="th"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy">${statusChip(p)}</div><b>${esc(cleanTitle(p.title))}</b><small>${p.variants ? p.variants.length + ' ვარიანტი' : p.posted ? 'გამოქვეყნებული' : 'დაგეგმილი'}</small></button>`).join('')}</div>` : ''}
    ${S.length ? `<div class="yt-sec">პოსტები</div><div class="yt-posts">${S.map(p => `<article class="ycp" data-open="${esc(p.id)}" tabindex="0"><header><img src="${ytAv}" alt=""><b>${esc(ytName)}</b>${statusChip(p)}</header><p>${esc(capOf(p))}</p><img class="m" src="${mediaUrl(p.media[0])}" alt="" loading="lazy"></article>`).join('')}</div>` : ''}
  </div>`;
}
/* phone versions of Facebook and YouTube, inside the same phone frame as Instagram */
const MI = {
  back: SV('<path d="M15 5l-7 7 7 7"/>', 22), search: SV('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', 22),
  more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  like: SV('<path d="M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM7 10.5l3.6-6.3a1.9 1.9 0 0 1 3.5 1.2l-.6 3.6h5a2 2 0 0 1 2 2.4l-1.3 6.6a2.4 2.4 0 0 1-2.4 2H7"/>', 19),
  comment: SV('<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 20.5 11.5z"/>', 19),
  share: SV('<path d="M14 4.5 21 11l-7 6.5V14c-5 0-8.2 1.4-10.5 5 .8-5.3 3.6-9.4 10.5-10.3z"/>', 19),
  bell: SV('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>', 22),
  cast: SV('<path d="M3 8V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M3 12a7 7 0 0 1 7 7M3 15.5a3.5 3.5 0 0 1 3.5 3.5"/><circle cx="3.6" cy="18.4" r=".6" fill="currentColor"/>', 22),
};
const ytLogo = '<svg width="92" height="20" viewBox="0 0 92 20" aria-label="YouTube"><rect x="0" y="0.5" width="28" height="19" rx="5" fill="#FF0033"/><path d="M11.2 6v8l7-4z" fill="#fff"/><text x="31" y="15.6" font-family="Helvetica Neue,Arial,sans-serif" font-size="16.5" font-weight="700" letter-spacing="-.6" fill="currentColor">YouTube</text></svg>';
function fbmHTML(){
  const P = postsInOrder(), F = CH.facebook || {}, av = chUrl(F.avatar) || mediaUrl(CFG.avatar), name = F.name || CFG.displayName;
  return `<div class="mframe fbm"><div class="mscroll">
    <div class="fbm-top">${MI.back}<b>${esc(name)}</b>${MI.search}</div>
    <div class="fbm-cover"><img src="${chUrl(F.cover) || coverImg()}" alt=""></div>
    <div class="fbm-id"><img class="av" src="${av}" alt=""><b>${esc(name)}</b>
      <small><b>${esc(F.followers || CFG.followers)}</b> გამომწერი${F.following ? `, <b>${esc(F.following)}</b> გამოწერილი` : ''}</small>
      <div class="fbm-btns"><span class="pri">გამოწერა</span><span>შეტყობინება</span><span class="sq">${MI.more}</span></div></div>
    <div class="fbm-tabs"><span class="on">პოსტები</span><span>შესახებ</span><span>ფოტოები</span><span>ვიდეოები</span></div>
    ${P.map(p => `<article class="fbmp" data-open="${esc(p.id)}" tabindex="0">
      <header><img src="${av}" alt=""><div><b>${esc(name)}</b><small>${p.posted ? 'გამოქვეყნებული' : 'დაგეგმილი პოსტი'}</small></div>${statusChip(p)}</header>
      ${capOf(p) ? `<div class="tx">${esc(capOf(p))}</div>` : ''}
      ${p.video ? `<div class="md"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy"><span class="play">${I.play}</span></div>`
        : p.media.length > 1 ? `<div class="fbcar"><div class="fbtrack" data-fbtrack>${p.media.map(m => `<div class="fbcard"><img src="${mediaUrl(m)}" alt="" loading="lazy"></div>`).join('')}</div><button type="button" class="car-btn prev" data-fbgo="-1" aria-label="წინა" hidden>${IGI.prev}</button><button type="button" class="car-btn next" data-fbgo="1" aria-label="შემდეგი">${IGI.next}</button></div>`
        : `<div class="md"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy"></div>`}
      <footer><span>${MI.like}მოწონება</span><span>${MI.comment}კომენტარი</span><span>${MI.share}გაზიარება</span></footer>
    </article>`).join('')}
  </div></div>`;
}
function ytmHTML(){
  const P = postsInOrder(), V = P.filter(p => p.video), S = P.filter(p => !p.video), Y = CH.youtube || {}, av = chUrl(Y.avatar) || mediaUrl(CFG.avatar), name = Y.name || CFG.client;
  return `<div class="mframe ytm"><div class="mscroll">
    <div class="ytm-top">${ytLogo}<span class="sp"></span>${MI.cast}${MI.bell}${MI.search}</div>
    <div class="ytm-banner"><img src="${chUrl(Y.banner) || coverImg()}" alt=""></div>
    <div class="ytm-id"><img src="${av}" alt=""><div><b>${esc(name)}</b><small>${esc(Y.handle || '@' + CFG.username)}</small><small>${Y.subscribers ? esc(Y.subscribers) + ' გამომწერი' : ''}${Y.subscribers && Y.videos ? ', ' : ''}${Y.videos ? esc(Y.videos) + ' ვიდეო' : ''}</small></div></div>
    <div class="ytm-sub">გამოწერა</div>
    <div class="ytm-tabs"><span>მთავარი</span><span>ვიდეოები</span><span class="on">Shorts</span><span>პოსტები</span></div>
    ${V.length ? `<div class="ytm-shorts">${V.map(p => `<button type="button" class="yms" data-open="${esc(p.id)}" aria-label="${esc(cleanTitle(p.title))}"><img src="${mediaUrl(p.media[0])}" alt="" loading="lazy">${statusChip(p)}<b>${esc(cleanTitle(p.title))}</b></button>`).join('')}</div>` : ''}
    ${S.length ? `<div class="ytm-sec">პოსტები</div>${S.map(p => `<article class="ympc" data-open="${esc(p.id)}" tabindex="0"><header><img src="${av}" alt=""><b>${esc(name)}</b>${statusChip(p)}</header>${capOf(p) ? `<p>${esc(capOf(p))}</p>` : ''}<img class="m" src="${mediaUrl(p.media[0])}" alt="" loading="lazy"></article>`).join('')}` : ''}
  </div></div>`;
}
$('#pContent').addEventListener('click', e => {
  const go = e.target.closest('[data-fbgo]');
  if(go){ const t = go.parentNode.querySelector('[data-fbtrack]'); t.scrollBy({left: t.firstElementChild.offsetWidth * +go.dataset.fbgo, behavior: 'smooth'}); return; }
  const o = e.target.closest('[data-open]'); if(o && plat !== 'ig') openPm(o.dataset.open);
});
$('#pContent').addEventListener('scroll', e => {
  const t = e.target; if(!t.matches || !t.matches('[data-fbtrack]')) return;
  const box = t.parentNode; box.querySelector('.prev').hidden = t.scrollLeft < 8; box.querySelector('.next').hidden = t.scrollLeft + t.clientWidth > t.scrollWidth - 8;
}, true);
$('#pContent').addEventListener('keydown', e => { const o = e.target.closest('[data-open]'); if(o && e.key === 'Enter' && plat !== 'ig') openPm(o.dataset.open); });

/* post detail with approve and comment (uses preview.html's approve() and comment sheet) */
let pmId = null, pmVar = 0, lnk = {url: '', msg: ''};
function openPm(id){ pmId = id; pmVar = 0; lnk = {url: '', msg: ''}; pauseIg(); renderPm(true); $('#pm').hidden = false; placeOverlays(); document.addEventListener('keydown', pmKey); }
function closePm(){ const v = $('#pm video'); if(v) v.pause(); $('#pm').hidden = true; $('#pm').innerHTML = ''; pmId = null; placeOverlays(); document.removeEventListener('keydown', pmKey); }
const pmKey = e => { if(e.key === 'Escape' && $('#sh').hidden) closePm(); };
const IGI = {
  heart: SV('<path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.9-8 10.6-8 10.6z"/>', 24),
  cmt: SV('<path d="M20.5 11.5a8.5 8.5 0 1 1-4-7.2 8.5 8.5 0 0 1 4 7.2z"/><path d="m20.5 20.5-3-3.2"/>', 24),
  send: SV('<path d="M21.5 3 10 14.5M21.5 3l-7 18.5-4.5-7-7-4.5z"/>', 24),
  save: SV('<path d="M19 21l-7-5-7 5V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5z"/>', 24),
  like: SV('<path d="M7 10v11H3.5V10zM7 10l4-7.5a2.3 2.3 0 0 1 2.6 2.7L13 9h6.2a2 2 0 0 1 2 2.4l-1.5 7.5a2.5 2.5 0 0 1-2.5 2.1H7"/>', 20),
  share: SV('<path d="M14 5l7 7-7 7M21 12H9a6 6 0 0 0-6 6"/>', 20),
  prev: SV('<path d="m15 6-6 6 6 6"/>', 18), next: SV('<path d="m9 6 6 6-6 6"/>', 18),
};
const ini = n => esc((String(n || '?').trim()[0] || '?').toUpperCase());
function reviewBar(g, v){
  if(g.posted) return '';
  const done = statusOf(v.id) === 'approved';
  const okLabel = g.variants ? (done ? 'ეს ვარიანტი არჩეულია' : 'ამ ვარიანტს ვირჩევ') : (done ? 'დადასტურებულია' : 'დადასტურება');
  return `<div class="rv">
    ${g.variants ? `<div class="pm-vars" role="group" aria-label="ვარიანტები">${g.variants.map((x, i) => `<button type="button" class="chip" data-var="${i}" aria-pressed="${i === pmVar}">ვარიანტი ${i + 1}${statusOf(x.id) === 'approved' ? ' ✓' : ''}</button>`).join('')}</div>` : ''}
    <div class="lnk" ${lnk.url ? '' : 'hidden'}><input readonly aria-label="ამ პოსტის ბმული" value="${esc(lnk.url)}"><button type="button" class="btn sm" data-copy>კოპირება</button><small role="status">${esc(lnk.msg)}</small></div>
    <div class="rv-b"><button type="button" class="btn ${done ? 'emerald' : 'primary'}" data-ok>${I.check}${okLabel}</button><button type="button" class="btn" data-cm>შესაცვლელია</button><button type="button" class="btn rv-link" data-link title="ამ პოსტის ბმულის კოპირება" aria-label="ამ პოსტის ბმულის კოპირება">${I.link}</button></div>
  </div>`;
}
const notes = id => commentsOf(id).filter(c => c.type !== 'approve' || !c.reopened);
const noteText = c => c.type === 'approve' ? 'დაადასტურა ✓' : c.text;
const noteTime = c => (c.pending ? 'იგზავნება…' : fmtTime(c.ts)) + (c.resolved ? ', გასწორდა' : '');
function mediaHTML(v){
  if(v.video) return `<video src="${mediaUrl(v.video)}" poster="${mediaUrl(v.media[0])}" controls playsinline autoplay loop></video>`;
  if(v.media.length < 2) return `<img src="${mediaUrl(v.media[0])}" alt="">`;
  return `<div class="car" data-car>${v.media.map(m => `<img src="${mediaUrl(m)}" alt="">`).join('')}</div>
    <button type="button" class="car-btn prev" data-car-go="-1" aria-label="წინა">${IGI.prev}</button><button type="button" class="car-btn next" data-car-go="1" aria-label="შემდეგი">${IGI.next}</button>
    <div class="car-dots">${v.media.map((m, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
}
function sideIG(g, v){
  const u = esc(CFG.username), av = mediaUrl(CFG.avatar);
  return `<header class="ig-h"><img src="${av}" alt=""><b>${u}</b><span class="ig-dots">•••</span></header>
    <div class="ig-sc">
      <div class="ig-c"><img src="${av}" alt=""><div><b>${u}</b> ${esc(v.caption || '')}<small>${g.posted ? 'გამოქვეყნებული' : 'დაგეგმილი პოსტი'}</small></div></div>
      ${notes(v.id).map(c => `<div class="ig-c"><span class="ini">${ini(c.name)}</span><div><b>${esc(c.name)}</b> ${esc(noteText(c))}<small>${noteTime(c)}</small></div></div>`).join('')}
    </div>
    <div class="ig-a">${IGI.heart}${IGI.cmt}${IGI.send}<span class="sp"></span>${IGI.save}</div>
    <div class="ig-l"><b>Be the first to like this</b><small>${g.posted ? 'გამოქვეყნებული' : 'დაგეგმილი'}</small></div>
    ${reviewBar(g, v)}`;
}
function sideFB(g, v){
  const F = CH.facebook || {}, av = chUrl(F.avatar) || mediaUrl(CFG.avatar);
  return `<header class="fb-h"><img src="${av}" alt=""><div><b>${esc(F.name || CFG.displayName)}</b><small>${g.posted ? 'გამოქვეყნებული' : 'დაგეგმილი პოსტი'}</small></div></header>
    <div class="fb-sc">
      <p class="fb-tx">${esc(v.caption || '')}</p>
      <div class="fb-re"><span>${IGI.like}მოწონება</span><span>${I.chat}კომენტარი</span><span>${IGI.share}გაზიარება</span></div>
      ${notes(v.id).map(c => `<div class="fb-c"><span class="ini">${ini(c.name)}</span><div><div class="bub"><b>${esc(c.name)}</b>${esc(noteText(c))}</div><small>${noteTime(c)}</small></div></div>`).join('')}
    </div>
    ${reviewBar(g, v)}`;
}
function sideYT(g, v){
  const Y = CH.youtube || {}, av = chUrl(Y.avatar) || mediaUrl(CFG.avatar);
  return `<div class="yt-sc">
      <h2 class="yt-t">${esc(cleanTitle(v.title))}</h2>
      <div class="yt-ch"><img src="${av}" alt=""><div><b>${esc(Y.name || CFG.client)}</b><small>${esc(Y.subscribers || CFG.followers)} გამომწერი</small></div><span class="yt-sub">გამოწერა</span></div>
      <div class="yt-desc">${esc(v.caption || '')}</div>
      ${notes(v.id).length ? `<div class="yt-cm-h">კომენტარები</div>` : ''}
      ${notes(v.id).map(c => `<div class="yt-c"><span class="ini">${ini(c.name)}</span><div><b>@${esc(c.name)}</b> <small>${noteTime(c)}</small><p>${esc(noteText(c))}</p></div></div>`).join('')}
    </div>
    ${reviewBar(g, v)}`;
}
function renderPm(full){
  const g = POSTS.find(p => p.id === pmId); if(!g){ closePm(); return; }
  const v = g.variants ? g.variants[pmVar] : g;
  const kind = VIEW_OF[plat] ? VIEW_OF[plat][0] : 'ig';
  const side = kind === 'fb' ? sideFB(g, v) : kind === 'yt' ? sideYT(g, v) : sideIG(g, v);
  if(full){
    $('#pm').className = 'pm pm--' + kind + (v.video ? ' is-video' : '');
    $('#pm').innerHTML = `<button type="button" class="pm-x" data-close aria-label="დახურვა">${I.close}</button>
      <div class="pm-card"><div class="pm-media">${mediaHTML(v)}</div><div class="pm-side">${side}</div></div>`;
    const car = $('#pm [data-car]');
    if(car) car.addEventListener('scroll', () => { const i = Math.round(car.scrollLeft / car.clientWidth); $('#pm').querySelectorAll('.car-dots i').forEach((d, k) => d.classList.toggle('on', k === i)); }, {passive: true});
  } else $('#pm .pm-side').innerHTML = side;
}
$('#pm').addEventListener('click', e => {
  if(e.target.id === 'pm' || e.target.closest('[data-close]')){ closePm(); return; }
  const cg = e.target.closest('[data-car-go]'); if(cg){ const car = $('#pm [data-car]'); car.scrollBy({left: car.clientWidth * +cg.dataset.carGo, behavior: 'smooth'}); return; }
  const vb = e.target.closest('[data-var]'); if(vb){ pmVar = +vb.dataset.var; renderPm(true); return; }
  const g = POSTS.find(p => p.id === pmId), id = (g.variants ? g.variants[pmVar] : g).id;
  if(e.target.closest('[data-ok]')){ approve(id, null); return; }
  if(e.target.closest('[data-cm]')){ openSheet(id); return; }
  if(e.target.closest('[data-link]')){ copyLink(g.id); return; }
  if(e.target.closest('[data-copy]')){ const box = $('#pm .lnk'), inp = box.querySelector('input'); copyText(inp.value, inp).then(ok => box.querySelector('small').textContent = ok ? 'ბმული დაკოპირდა.' : 'მონიშნეთ ბმული და დააკოპირეთ.'); }
});

const postUrl = id => `${location.origin}${location.pathname}?c=${CLIENT}&post=${encodeURIComponent(id)}`;
async function copyText(t, input){
  try{ await navigator.clipboard.writeText(t); return true; }catch(e){}
  try{ input.focus(); input.select(); input.setSelectionRange(0, t.length); if(document.execCommand('copy')) return true; }catch(e){}
  return false;
}
/* shows the link under the buttons (so it can always be copied by hand) and tries to copy it */
async function copyLink(id){
  const box = $('#pm .lnk'); if(!box) return;
  const inp = box.querySelector('input'), msg = box.querySelector('small');
  inp.value = lnk.url = postUrl(id); box.hidden = false;
  const ok = await copyText(inp.value, inp);
  msg.textContent = lnk.msg = ok ? 'ბმული დაკოპირდა. გაუგზავნეთ ექიმს: ის პირდაპირ ამ პოსტს ნახავს.' : 'მონიშნეთ ბმული და დააკოპირეთ.';
  inp.select();
}
/* ?post=ID opens that one post straight away, with the approve buttons */
function openFromLink(){
  const want = Q.get('post'); if(!want) return;
  const g = POSTS.find(p => p.id === want || (p.variants && p.variants.some(v => v.id === want)));
  if(!g){ undeep(); toast('ეს პოსტი აღარ არის გეგმაში.'); return; }
  openPm(g.id);
  if(g.variants) pmVar = Math.max(0, g.variants.findIndex(v => v.id === want)), renderPm(true);
  undeep();
}
/* re-render the other views whenever the Instagram preview refreshes its data */
const igRefresh = window.refreshViews;
window.refreshViews = function(){ igRefresh.apply(this, arguments); renderPlat(); if(pmId) renderPm(false); };

/* ---------- patients ---------- */
async function call(body){
  if(DEMO) return demoCall(body);
  if(!body.idToken){
    if(session()){ body.session = session(); delete body.pin; }
    else if(!body.pin){ delete body.pin; if(teamKey()) body.key = teamKey(); }
  }
  return api.post(CFGH, body);
}
function authError(e, silent){
  const m = String(e.message || '');
  if(/not allowed: (.+)/.test(m)){ ls.set(SESKEY, ''); return `${RegExp.$1}-ს წვდომა არ აქვს. სთხოვეთ Like Dent-ის მარკეტინგის გუნდს, რომ სიაში დაგამატოთ.`; }
  if(/session|google/.test(m)){ ls.set(SESKEY, ''); return silent ? '' : 'შესვლის ვადა გავიდა. შედით თავიდან.'; }
  if(/pin|tries|key/.test(m)){ ls.set(PINKEY, ''); return /tries/.test(m) ? 'ძალიან ბევრი მცდელობა. სცადეთ 10 წუთში.' : (silent ? '' : 'PIN არასწორია. სცადეთ თავიდან.'); }
  return null;
}
async function loadHub(silent, idToken){
  if(!idToken && !session() && !pin() && !teamKey() && !DEMO){ loaded = false; render(); return; }
  try{
    const r = await call(idToken ? {action:'hubLoad', idToken} : {action:'hubLoad', pin: pin()});
    if(r.session) ls.set(SESKEY, r.session);
    ME = r.me || ''; take(r); loaded = true; render();
  }catch(e){
    const msg = authError(e, silent);
    if(msg !== null){ loaded = false; render(msg); }
    else if(!silent) toast('კავშირი ვერ დამყარდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.');
  }
}
/* Sign in with Google: Google's own button; the server checks the email against the list */
let gsiP = null;
function gsi(){
  return gsiP = gsiP || new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => { google.accounts.id.initialize({client_id: GCLIENT, callback: r => loadHub(false, r.credential), ux_mode: 'popup', context: 'signin'}); ok(); };
    s.onerror = () => { gsiP = null; no(); }; document.head.appendChild(s);
  });
}
function drawGoogle(){
  document.querySelectorAll('[data-gbtn]').forEach(async el => {
    if(el.childElementCount) return;
    try{ await gsi(); google.accounts.id.renderButton(el, {theme: isDark() ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ka', width: 280}); }
    catch(e){ el.textContent = 'Google-ის ღილაკი ვერ ჩაიტვირთა. შეამოწმეთ ინტერნეტი.'; }
  });
}
function signOut(){
  ls.set(SESKEY, ''); ls.set(PINKEY, ''); ME = '';
  try{ google.accounts.id.disableAutoSelect(); }catch(e){}
  loaded = false; render();
}
function take(r){
  LEADS = (r.leads || []).sort((a, b) => b.created - a.created);
  SPEND = (r.settings || {}).spend || {}; ROLE = r.role || '';
  const n = LEADS.filter(l => l.stage === 'new').length;
  document.querySelectorAll('[data-tab="patients"] .n').forEach(d => { d.textContent = n; d.hidden = !n; });
}
function render(err){
  $('#ptAdd').hidden = !loaded;
  if(!loaded){ $('#ptBody').innerHTML = lockHTML(err); $('#anBody').innerHTML = lockHTML(err); drawGoogle(); return; }
  if(cur === 'patients') renderPatients();
  if(cur === 'analytics') renderAnalytics();
}
const lockHTML = err => (GCLIENT && !usePin) ? `<div class="lock">
  <h2>შედით Google-ით</h2><p>პაციენტების მონაცემებს ხედავენ მხოლოდ კლინიკის დაშვებული Gmail-ები. ამ მოწყობილობაზე შესვლა 30 დღე ინახება.</p>
  <div class="gbtn" data-gbtn></div>
  <div class="err" role="alert">${esc(err || '')}</div>
  <button class="linkbtn" type="button" data-usepin>PIN-ით შესვლა</button></div>` : `<form class="lock" data-lock>
  <h2>შეიყვანეთ კლინიკის PIN</h2><p>პაციენტების მონაცემები დაცულია. PIN ერთხელ შეგყავთ ამ მოწყობილობაზე.</p>
  <input inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="PIN" required>
  <div class="err" role="alert">${esc(err || '')}</div>
  <button class="btn primary" type="submit">შესვლა</button>${GCLIENT ? '<button class="linkbtn" type="button" data-usegoogle>Google-ით შესვლა</button>' : ''}</form>`;
document.addEventListener('click', e => {
  if(e.target.closest('[data-usepin]')){ usePin = true; render(); }
  else if(e.target.closest('[data-usegoogle]')){ usePin = false; render(); }
  else if(e.target.closest('[data-signout]')) signOut();
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-lock]'); if(!f) return;
  e.preventDefault();
  const v = f.querySelector('input').value.replace(/\D/g, '');
  if(v.length !== 6){ f.querySelector('.err').textContent = 'PIN 6 ციფრისგან შედგება.'; return; }
  ls.set(PINKEY, v); f.querySelector('button').disabled = true; await loadHub();
});

function leadHTML(l){
  const st = STAGES.find(s => s.id === l.stage);
  return `<article class="lead" data-lead="${esc(l.id)}" tabindex="0">
    <div class="lt"><b>${esc(l.name || l.phone || 'უსახელო')}</b><span class="tag">${esc(CHANNELS[l.channel] || l.channel || 'სხვა')}</span></div>
    <div class="ls">${l.service ? esc(l.service) + ', ' : ''}${fmt(l.created)}</div>
    ${l.notes ? `<div class="ln">${esc(l.notes)}</div>` : ''}
    <div class="la">${l.phone ? `<a class="btn sm" href="${telHref(l.phone)}" data-stop>${I.phone}დარეკვა</a><a class="btn sm" href="${waHref(l.phone)}" target="_blank" rel="noopener" data-stop>${I.chat}WhatsApp</a>` : ''}<span class="sp"></span>
      ${st && st.next ? `<button class="btn sm ${st.next === 'done' ? 'emerald' : 'primary'}" type="button" data-next="${esc(l.id)}">${I.check}${st.nextLabel}</button>` : ''}</div>
  </article>`;
}
function renderPatients(){
  const by = s => LEADS.filter(l => l.stage === s);
  const nNew = by('new').length, lost = by('lost');
  $('#ptSub').textContent = nNew ? `${nNew} ახალი მოთხოვნა ელოდება ზარს.` : 'ახალი მოთხოვნები აქ გამოჩნდება, საიტიდან, რეკლამიდან და ზარებიდან.';
  if(ME || session()) $('#ptSub').insertAdjacentHTML('beforeend', ` <span class="who">${esc(ME)} <button class="linkbtn" type="button" data-signout>გასვლა</button></span>`);
  const chips = [...STAGES, LOST].map(s => `<button type="button" class="chip" data-pick="${s.id}" aria-pressed="${pickStage === s.id}">${s.short}<i>${by(s.id).length}</i></button>`).join('');
  const col = (s, extra = '') => {
    const items = by(s.id);
    return `<section class="col s-${s.id} ${extra}" ${pickStage === s.id ? '' : 'data-off'} ${s.id === 'lost' && !showLost && !small() ? 'hidden' : ''}>
      <div class="colh"><span class="dot"></span>${s.label}<i>${items.length}</i></div>
      ${items.length ? items.map(leadHTML).join('') : `<div class="empty">${s.id === 'new' ? 'ახალი მოთხოვნა ჯერ არ არის. დაამატეთ ზარით ან SMS-ით მოსული პაციენტი ღილაკით „ახალი პაციენტი“.' : 'აქ ჯერ არავინაა.'}</div>`}
    </section>`;
  };
  $('#ptBody').innerHTML = `<div class="chips" role="group" aria-label="ეტაპი">${chips}</div>
    <div class="board">${STAGES.map(s => col(s)).join('')}${col(LOST, 'lostcol')}</div>
    ${lost.length && !small() ? `<button class="btn sm lostbtn" type="button" data-lost>${showLost ? 'არქივის დამალვა' : `არქივი (${lost.length})`}</button>` : ''}`;
}
$('#pPatients').addEventListener('click', e => {
  if(e.target.closest('[data-stop]')) return;
  if(e.target.closest('#ptAdd')){ openAdd(); return; }
  const pk = e.target.closest('[data-pick]'); if(pk){ pickStage = pk.dataset.pick; renderPatients(); return; }
  if(e.target.closest('[data-lost]')){ showLost = !showLost; renderPatients(); return; }
  const nx = e.target.closest('[data-next]'); if(nx){ const l = LEADS.find(x => x.id === nx.dataset.next), st = STAGES.find(s => s.id === l.stage); move(l, st.next); return; }
  const c = e.target.closest('[data-lead]'); if(c) openLead(c.dataset.lead);
});
$('#pPatients').addEventListener('keydown', e => { const c = e.target.closest('[data-lead]'); if(c && e.key === 'Enter' && e.target === c) openLead(c.dataset.lead); });

async function move(l, to){
  const prev = l.stage; l.stage = to; renderPatients(); toast(`${l.name || l.phone}: ${STAGE_LABEL[to]}`);
  busy++;
  try{ take(await call({action:'hubLeadMove', pin: pin(), id: l.id, stage: to, by: me()})); render(); }
  catch(e){ l.stage = prev; renderPatients(); toast('ვერ შეინახა. სცადეთ თავიდან.'); }
  busy--;
}

const sh = $('#hsh'), shf = $('#hshf');
const closeSh = () => { sh.hidden = true; shf.innerHTML = ''; };
sh.addEventListener('click', e => { if(e.target === sh || e.target.closest('[data-close]')) closeSh(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !sh.hidden) closeSh(); });
const opts = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`).join('');
function fieldsHTML(l){
  const svc = SERVICES.includes(l.service) || !l.service ? SERVICES : [l.service, ...SERVICES];
  return `<div class="two"><label>სახელი<input name="name" maxlength="80" value="${esc(l.name || '')}" autocomplete="off"></label>
    <label>ტელეფონი<input name="phone" maxlength="30" inputmode="tel" value="${esc(l.phone || '')}" autocomplete="off"></label></div>
    <div class="two"><label>სერვისი<select name="service"><option value="">არ არის მითითებული</option>${opts(svc.map(s => [s, s]), l.service)}</select></label>
    <label>საიდან მოვიდა<select name="channel">${opts(Object.entries(CHANNELS), l.channel || 'phone')}</select></label></div>
    <label>შენიშვნა<textarea name="notes" maxlength="1000" placeholder="მაგალითად: დილით ურჩევნია, ფასი აინტერესებს">${esc(l.notes || '')}</textarea></label>`;
}
function openAdd(){
  shf.innerHTML = `<h3><span>ახალი პაციენტი</span><button class="hx" type="button" data-close aria-label="დახურვა">×</button></h3>
    ${fieldsHTML({})}
    <div class="row"><button class="btn" type="button" data-close>გაუქმება</button><button class="btn primary" type="submit">პაციენტის დამატება</button></div>`;
  shf.onsubmit = async e => {
    e.preventDefault();
    const lead = Object.fromEntries(new FormData(shf));
    if(!lead.name.trim() && !lead.phone.trim()){ toast('ჩაწერეთ სახელი ან ტელეფონი.'); return; }
    shf.querySelector('[type=submit]').disabled = true; busy++;
    try{ take(await call({action:'hubLeadAdd', pin: pin(), lead, by: me()})); closeSh(); pickStage = 'new'; render(); toast('პაციენტი დაემატა'); }
    catch(err){ shf.querySelector('[type=submit]').disabled = false; toast('ვერ შეინახა. სცადეთ თავიდან.'); }
    busy--;
  };
  sh.hidden = false; setTimeout(() => shf.querySelector('input').focus({preventScroll:true}), 60);
}
function openLead(id){
  const l = LEADS.find(x => x.id === id); if(!l) return;
  let to = l.stage;
  const pick = () => [...STAGES, LOST].map(s => `<button type="button" class="s-${s.id}" data-st="${s.id}" aria-pressed="${to === s.id}">${s.label}</button>`).join('');
  shf.innerHTML = `<h3><span>${esc(l.name || l.phone || 'პაციენტი')}</span><button class="hx" type="button" data-close aria-label="დახურვა">×</button></h3>
    <div class="stagepick" role="group" aria-label="ეტაპი">${pick()}</div>
    ${fieldsHTML(l)}
    ${l.source ? `<label>რეკლამა, საიდანაც მოვიდა<input value="${esc(l.source)}" readonly></label>` : ''}
    <ul class="hist">${(l.history || []).map(h => `<li>${fmt(h.t)}: ${esc(STAGE_LABEL[h.stage] || h.stage)}${h.by ? ', ' + esc(h.by) : ''}</li>`).join('')}</ul>
    <div class="row">${ROLE === 'team' ? '<button class="btn" type="button" data-del>წაშლა</button><span style="flex:1"></span>' : ''}<button class="btn" type="button" data-close>დახურვა</button><button class="btn primary" type="submit">ცვლილებების შენახვა</button></div>`;
  shf.querySelector('.stagepick').onclick = e => { const b = e.target.closest('[data-st]'); if(!b) return; to = b.dataset.st; shf.querySelector('.stagepick').innerHTML = pick(); };
  const del = shf.querySelector('[data-del]');
  if(del) del.onclick = async () => { if(!confirm('წავშალო ეს პაციენტი სამუდამოდ?')) return; busy++; try{ take(await call({action:'hubLeadDelete', key: teamKey(), id})); closeSh(); render(); toast('პაციენტი წაიშალა'); }catch(e){ toast('ვერ წაიშალა.'); } busy--; };
  shf.onsubmit = async e => {
    e.preventDefault();
    const lead = Object.fromEntries(new FormData(shf)); busy++;
    shf.querySelector('[type=submit]').disabled = true;
    try{
      const changed = ['name','phone','service','channel','notes'].some(k => (lead[k] || '') !== (l[k] || ''));
      let r = null;
      if(changed) r = await call({action:'hubLeadEdit', pin: pin(), id, lead, by: me()});
      if(to !== l.stage) r = await call({action:'hubLeadMove', pin: pin(), id, stage: to, by: me()});
      if(r) take(r); closeSh(); render(); if(r) toast('ცვლილებები შენახულია');
    }catch(err){ shf.querySelector('[type=submit]').disabled = false; toast('ვერ შეინახა. სცადეთ თავიდან.'); }
    busy--;
  };
  sh.hidden = false;
}

/* ---------- analytics ---------- */
function range(){
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  if(period === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
  if(period === 'prev') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if(period === 'q') return [new Date(y, m - 2, 1), new Date(y, m + 1, 1)];
  return [new Date(2000, 0, 1), new Date(y + 1, 0, 1)];
}
function monthsIn([a, b]){
  const out = [], d = new Date(a.getFullYear(), a.getMonth(), 1);
  while(d < b){ out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`); d.setMonth(d.getMonth() + 1); }
  return out;
}
const reached = (l, s) => l.stage === s || (s === 'booked' && l.stage === 'done') || (l.history || []).some(h => h.stage === s || (s === 'booked' && h.stage === 'done'));
function renderAnalytics(){
  setSeg($('#perSeg'), 'data-per', period);
  const [a, b] = range();
  const L = LEADS.filter(l => l.created >= a.getTime() && l.created < b.getTime());
  const months = period === 'all' ? Object.keys(SPEND) : monthsIn([a, b]);
  const spendBy = {}; let spend = 0;
  months.forEach(m => Object.entries(SPEND[m] || {}).forEach(([ch, v]) => { spendBy[ch] = (spendBy[ch] || 0) + v; spend += v; }));
  const booked = L.filter(l => reached(l, 'booked')).length, done = L.filter(l => reached(l, 'done')).length;
  const chans = Object.keys(CHANNELS).map(ch => {
    const x = L.filter(l => (l.channel || 'other') === ch);
    return {ch, n: x.length, b: x.filter(l => reached(l, 'booked')).length, d: x.filter(l => reached(l, 'done')).length, s: spendBy[ch] || 0};
  }).filter(r => r.n || r.s).sort((p, q) => q.n - p.n);
  const maxN = Math.max(1, ...chans.map(r => r.n));
  const fun = [['ლიდი', L.length], ['დაიჯავშნა', booked], ['ჩაიტარა', done]];
  $('#anBody').innerHTML = `
    <div class="kpis">
      <div class="kpi lead-kpi"><small>ახალი პაციენტი</small><b>${L.length}</b><span>მოთხოვნა ამ პერიოდში</span></div>
      <div class="kpi"><small>დაიჯავშნა</small><b>${booked}</b><span>${pct(booked, L.length)} მოთხოვნებიდან</span></div>
      <div class="kpi"><small>ჩაიტარა პროცედურა</small><b>${done}</b><span>${pct(done, L.length)} მოთხოვნებიდან</span></div>
      <div class="kpi"><small>ერთი პაციენტის ფასი</small><b>${spend && L.length ? money(spend / L.length) : '—'}</b><span>${spend ? 'რეკლამაზე დაიხარჯა ' + money(spend) : 'რეკლამის ხარჯი ჯერ არ არის შეყვანილი'}</span></div>
    </div>
    <div class="grid2">
      <div class="card"><h4>მოთხოვნიდან პროცედურამდე</h4><p class="sub">რამდენი გადავიდა შემდეგ ეტაპზე</p>
        <div class="funnel">${fun.map(([t, v]) => `<div class="fr" title="${t}: ${v}"><span>${t}</span><span class="bar"><i style="width:${L.length ? Math.max(v / L.length * 100, 0) : 0}%"></i></span><span class="v">${v}${t === 'ლიდი' ? '' : `<small>${pct(v, L.length)}</small>`}</span></div>`).join('')}</div></div>
      <div class="card"><h4>საიდან მოვიდნენ</h4><p class="sub">მოთხოვნები, ჩაწერა და ფასი არხების მიხედვით</p>
        ${chans.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>არხი</th><th>მოთხოვნები</th><th class="n">დაიჯავშნა</th><th class="n">ჩაიტარა</th><th class="n">ხარჯი</th><th class="n">ერთი</th></tr></thead><tbody>
        ${chans.map(r => `<tr><td>${esc(CHANNELS[r.ch])}</td><td><div class="cb" title="${esc(CHANNELS[r.ch])}: ${r.n}"><span class="bar"><i style="width:${r.n / maxN * 100}%"></i></span>${r.n}</div></td><td class="n">${r.b}</td><td class="n">${r.d}</td><td class="n">${r.s ? money(r.s) : '—'}</td><td class="n">${r.s && r.n ? money(r.s / r.n) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">ამ პერიოდში მოთხოვნა ჯერ არ არის.</div>'}</div>
    </div>
    <p class="hnote">„დაიჯავშნა“ და „ჩაიტარა“ ითვლის ამ პერიოდში მოსულ მოთხოვნებს, რომლებიც ამ ეტაპამდე მივიდნენ. რეკლამის ხარჯს თვის მიხედვით Like Dent-ის მარკეტინგის გუნდი შეიყვანს.</p>`;
}
$('#perSeg').addEventListener('click', e => { const p = e.target.closest('[data-per]'); if(p){ period = p.dataset.per; renderAnalytics(); } });

/* ---------- boot ---------- */
async function boot(){
  try{ CFGH = await loadConfig(); }catch(e){ undeep(); return; }
  try{ const r = await fetch(BASE + 'channels/channels.json', {cache:'no-store'}); if(r.ok) CH = Object.assign(CH, await r.json()); }catch(e){}
  document.querySelectorAll('[data-av]').forEach(i => i.src = mediaUrl(CFGH.avatar));
  document.querySelectorAll('[data-client]').forEach(e => e.textContent = CFGH.client || 'Like Dent');
  // the Instagram data arrives a moment later; draw the other platforms (and open a linked post) as soon as it is there
  const wait = setInterval(() => { if(ready()){ clearInterval(wait); renderPlat(); openFromLink(); } }, 40);
  setTimeout(undeep, 8000);   // never leave the page covered if something fails
  if(DEMO) TABS = {content:true, patients:true, analytics:true};
  else if(CFGH.api){
    try{ const r = await api.post(CFGH, {action:'hubPublic'}); TABS = Object.assign({content:true, patients:false, analytics:false}, (r.settings || {}).tabs || {}); GCLIENT = r.clientId || ''; }
    catch(e){ TABS = {content:true, patients:false, analytics:false}; }
  }
  setupNav();
  setInterval(() => { if(document.visibilityState === 'visible' && cur !== 'content' && loaded && !busy && sh.hidden) loadHub(true); }, 30000);
}
boot();

/* ---------- demo data (?demo=1) ---------- */
let DEMO_LEADS = null;
function demoCall(body){
  if(!DEMO_LEADS){
    const now = Date.now(), H = 3600e3, D = 24 * H;
    const mk = (i, name, phone, service, channel, stage, ago, notes = '') => {
      const created = now - ago, h = [{t: created, stage: 'new', by: ''}];
      if(stage === 'booked' || stage === 'done') h.push({t: created + 5 * H, stage: 'booked', by: 'ნინო'});
      if(stage === 'done') h.push({t: created + 3 * D, stage: 'done', by: 'ნინო'});
      if(stage === 'lost') h.push({t: created + D, stage: 'lost', by: 'ნინო'});
      return {id: 'D' + i, created, name, phone, email: '', service, channel, source: channel === 'facebook' ? 'facebook / paid / implant_nov' : '', stage, notes, updated: created, history: h};
    };
    DEMO_LEADS = [
      mk(1,'ანა ბერიძე','+995 555 12 34 56','კონსულტაცია','website','new', 2 * H, 'შაბათს ურჩევნია.'),
      mk(2,'გიორგი','599 22 33 44','კბილის აღდგენა ან ჩანაცვლება','facebook','new', 7 * H, 'იმპლანტის ფასი აინტერესებს.'),
      mk(3,'მარიამ ქ.','577 10 20 30','წმენდა და შემოწმება','sms','new', 26 * H),
      mk(4,'ლევანი','591 00 11 22','ღიმილის გალამაზება','instagram','booked', 2 * D, 'ჩაწერილია 8 ნოემბერს, 15:00-ზე.'),
      mk(5,'თამარ','555 66 77 88','ბავშვისთვის','google','booked', 3 * D),
      mk(6,'ნიკა','558 44 55 66','კბილი ან ღრძილი მაწუხებს','website','done', 4 * D),
      mk(7,'ეკა','593 12 12 12','კონსულტაცია','facebook','done', 9 * D),
      mk(8,'დავითი','571 98 76 54','კონსულტაცია','facebook','lost', 12 * D, 'არ პასუხობს.'),
      mk(9,'სალომე','595 33 22 11','წმენდა და შემოწმება','sms','done', 35 * D),
      mk(10,'ირაკლი','592 45 45 45','კბილის აღდგენა ან ჩანაცვლება','google','booked', 40 * D),
    ];
  }
  const d = new Date(), m = k => { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2,'0')}`; };
  const res = () => ({role: 'clinic', leads: JSON.parse(JSON.stringify(DEMO_LEADS)), settings: {spend: {[m(0)]: {facebook: 240, google: 120, sms: 35}, [m(1)]: {facebook: 200, google: 100}}}});
  const L = id => DEMO_LEADS.find(l => l.id === id);
  if(body.action === 'hubLeadAdd') DEMO_LEADS.unshift({id: 'D' + Date.now(), created: Date.now(), ...body.lead, source: '', stage: 'new', updated: Date.now(), history: [{t: Date.now(), stage: 'new', by: body.by}]});
  if(body.action === 'hubLeadMove'){ const l = L(body.id); l.stage = body.stage; l.history.push({t: Date.now(), stage: body.stage, by: body.by}); }
  if(body.action === 'hubLeadEdit') Object.assign(L(body.id), body.lead);
  return new Promise(r => setTimeout(() => r(res()), 250));
}
})();
