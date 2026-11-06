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
  tasks: SV('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.3 2.6 2.6L16.2 9"/>'),
  note: SV('<path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>', 16),
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
let CFGH = null, TABS = {content:true, patients:false, analytics:false, tasks:false}, cur = 'content', plat = ls.get(PLATKEY) || 'ig';
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
  return [['content','კონტენტი'],['patients','პაციენტები'],['tasks','დავალებები'],['analytics','ანალიტიკა']]
    .map(([k, t]) => `<button type="button" class="${cls}" data-tab="${k}">${I[k]}<span>${t}</span>${k === 'patients' || k === 'tasks' ? '<span class="n" hidden></span>' : ''}</button>`).join('');
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
    <section class="pane" id="pTasks" hidden>
      <div class="head"><div class="ttl"><h1>დავალებები</h1><p id="tkSub">ვინ რას აკეთებს და რა ვადაში.</p></div><button type="button" class="icon-btn bell" id="tkBell" aria-label="შეტყობინებები" hidden><i hidden></i></button><button type="button" class="btn primary" id="tkAdd" hidden>${I.plus}ახალი დავალება</button></div>
      <div class="body" id="tkBody"></div>
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

const panes = {content: $('#pContent'), patients: $('#pPatients'), tasks: $('#pTasks'), analytics: $('#pAnalytics')};
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
  if(!tabOk(t)) t = ['content','patients','tasks','analytics'].find(tabOk) || 'content';
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
  navVis();
  const want = (location.hash || '').slice(1);
  showTab(tabOk(want) ? want : 'content');
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
    ME = r.me || ''; if(DEMO) ME = 'tamari@demo'; take(r); loaded = true; render();
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
  CAN_TASKS = !!r.canTasks; TASKS = r.tasks || []; PEOPLE = r.people || []; GROUPS = r.groups || [];
  loaded = true; navVis(); paintBadge();
  if(cur === 'tasks' && !CAN_TASKS) showTab('content');
  if(panelId) paintPanel();
}
function render(err){
  $('#ptAdd').hidden = !loaded; $('#tkAdd').hidden = !(loaded && CAN_TASKS); $('#tkBell').hidden = !(loaded && CAN_TASKS && ME);
  if(!loaded){ $('#ptBody').innerHTML = lockHTML(err); $('#anBody').innerHTML = lockHTML(err); $('#tkBody').innerHTML = lockHTML(err); drawGoogle(); return; }
  if(cur === 'patients') renderPatients();
  if(cur === 'tasks') renderTasks();
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

/* ---------- tasks: monday-style board for the internal team (groups, people, status, updates) ---------- */
let TASKS = [], PEOPLE = [], GROUPS = [], CAN_TASKS = false, tkWho = 'all', tkQ = '', hideDone = false, popEl = null, panelId = null, dragging = false;
const SEENKEY = 'hub_tk_seen_' + CLIENT, FOLDKEY = 'hub_tk_fold_' + CLIENT;
let FOLD = (() => { try{ return JSON.parse(ls.get(FOLDKEY) || '{}'); }catch(e){ return {}; } })();
const TST = [
  {id:'todo',  label:'დასაწყები'},
  {id:'doing', label:'მიმდინარე'},
  {id:'stuck', label:'გაჭედილი'},
  {id:'done',  label:'დასრულდა'},
];
const TPR = [{id:'high', label:'მაღალი'}, {id:'mid', label:'საშუალო'}, {id:'low', label:'დაბალი'}, {id:'', label:''}];
const GCOL = ['#579BFC','#A25DDC','#00C875','#FDAB3D','#E2445C','#037F4C','#FF7575','#225091','#7F5347','#808080'];
const AVC = ['#A07800','#0E6B53','#5B4FC4','#C2410C','#0F6E9E','#A23B72'];
const TI = {
  grip: '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="3" r="1.3"/><circle cx="9.5" cy="3" r="1.3"/><circle cx="4.5" cy="7" r="1.3"/><circle cx="9.5" cy="7" r="1.3"/><circle cx="4.5" cy="11" r="1.3"/><circle cx="9.5" cy="11" r="1.3"/></svg>',
  bubble: SV('<path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>', 18),
  bubblePlus: SV('<path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M12 7.5v5M9.5 10h5"/>', 18),
  bell: SV('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>', 19),
  chev: SV('<path d="m6 9 6 6 6-6"/>', 18),
  search: SV('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', 17),
  x: SV('<path d="M6 6l12 12M18 6 6 18"/>', 20),
  trash: SV('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 16),
  user: SV('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/>', 16),
  dots: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
};
$('#tkBell').insertAdjacentHTML('afterbegin', TI.bell);
const person = e => PEOPLE.find(p => p.email === e);
const pname = e => (person(e) || {}).name || (e ? String(e).split('@')[0] : '');
const avColor = e => AVC[[...String(e)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVC.length];
const initial = e => ([...pname(e)][0] || '?');
/* Georgian letters hang above or below the line (გ has a tail): measure each letter and centre its ink */
const INK = {};
function inkShift(ch){
  if(ch in INK) return INK[ch];
  try{ const c = document.createElement('canvas').getContext('2d'); c.font = '700 13px "Noto Sans Georgian"'; c.textBaseline = 'middle';
    const m = c.measureText(ch); INK[ch] = Math.round((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 * 10) / 10; }catch(e){ INK[ch] = 0; }
  return INK[ch];
}
if(document.fonts) document.fonts.ready.then(() => { for(const k in INK) delete INK[k]; if(cur === 'tasks' && loaded) renderTasks(); });
const avHTML = (e, cls = '') => e ? `<span class="av ${cls}" style="--c:${avColor(e)}" title="${esc(pname(e))}"><b style="transform:translateY(${inkShift(initial(e))}px)">${esc(initial(e))}</b></span>` : `<span class="av nobody ${cls}" title="არავის აქვს">${TI.user}</span>`;
const avsHTML = list => !list.length ? avHTML('') : `<span class="avs">${list.slice(0, 3).map(e => avHTML(e)).join('')}${list.length > 3 ? `<span class="av more">+${list.length - 3}</span>` : ''}</span>`;
const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => dayStr(new Date());
function dueHTML(t){
  if(!t.due) return '<span class="dd none">ვადა</span>';
  const [y, m, d] = t.due.split('-').map(Number), late = t.status !== 'done' && t.due < today(), now = t.due === today();
  const tom = t.due === dayStr(new Date(Date.now() + 864e5));
  return `<span class="dd ${late ? 'late' : now ? 'now' : ''}">${now ? 'დღეს' : tom ? 'ხვალ' : `${d} ${MONTHS[m - 1]}`}${!now && !tom && y !== new Date().getFullYear() ? ' ' + y : ''}</span>`;
}
const stLabel = id => (TST.find(s => s.id === id) || TST[0]).label;
const prLabel = id => (TPR.find(s => s.id === id) || TPR[3]).label;
const notesOf = t => (t.updates || []).filter(u => u.k === 'note');
const grpOf = t => GROUPS.some(g => g.id === t.grp) ? t.grp : (GROUPS[0] || {}).id;
const byPos = (a, b) => (a.pos || 0) - (b.pos || 0) || a.created - b.created;
const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 60 ? 'ახლახან' : s < 3600 ? Math.floor(s / 60) + ' წთ' : s < 86400 ? Math.floor(s / 3600) + ' სთ' : fmt(ts); };
/* @mentions: highlight names of people on the board */
function richText(text){
  let h = esc(text);
  PEOPLE.slice().sort((a, b) => b.name.length - a.name.length).forEach(p => {
    const n = esc('@' + p.name);
    h = h.split(n).join(`<span class="mention${p.email === ME ? ' me' : ''}">${n}</span>`);
  });
  return h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
const mentionsIn = text => PEOPLE.filter(p => text.includes('@' + p.name)).map(p => p.email);

/* notifications: someone mentioned me or gave me a task */
function notifs(){
  if(!ME) return [];
  const out = [];
  TASKS.forEach(t => (t.updates || []).forEach(u => {
    if(u.be === ME) return;
    if(u.k === 'note' && (u.m || []).includes(ME)) out.push({t: u.t, task: t, by: u.by, what: 'მოგნიშნა', text: u.v});
    if(u.k === 'owners' && (u.add || []).includes(ME)) out.push({t: u.t, task: t, by: u.by, what: 'დაგავალა'});
  }));
  return out.sort((a, b) => b.t - a.t).slice(0, 30);
}
const unseen = () => { const s = Number(ls.get(SEENKEY) || 0); return notifs().filter(n => n.t > s).length; };
function paintBadge(){
  const n = unseen();
  document.querySelectorAll('[data-tab="tasks"] .n').forEach(d => { d.textContent = n; d.hidden = !n; });
  const b = $('#tkBell'); if(b){ b.querySelector('i').textContent = n; b.querySelector('i').hidden = !n; }
}
function tabOk(t){ return !!TABS[t] && (t !== 'tasks' || !loaded || CAN_TASKS); }
function navVis(){ document.querySelectorAll('[data-tab]').forEach(b => b.hidden = !tabOk(b.dataset.tab)); }

/* ---------- board ---------- */
function visible(t){
  if(tkWho !== 'all' && !(t.owners || []).includes(tkWho)) return false;
  if(hideDone && t.status === 'done') return false;
  if(tkQ){
    const q = tkQ.toLowerCase();
    if(!(t.title + ' ' + t.notes + ' ' + notesOf(t).map(u => u.v).join(' ')).toLowerCase().includes(q)) return false;
  }
  return true;
}
function rowHTML(t){
  const n = notesOf(t).length, last = notesOf(t).slice(-1)[0];
  const sub = t.notes ? `<span class="tdesc">${esc(t.notes.split('\n')[0].slice(0, 160))}</span>` : last ? `<span class="tdesc tlast"><b>${esc(last.by)}:</b> ${esc(last.v.slice(0, 140))}</span>` : '';
  return `<div class="trow${panelId === t.id ? ' open' : ''}" data-task="${esc(t.id)}">
    <span class="grip" data-grip title="გადაათრიე ზემოთ ან ქვემოთ" aria-hidden="true">${TI.grip}</span>
    <div class="tname" data-topen tabindex="0" role="button" aria-label="${esc(t.title)}: გახსნა">
      <span class="tt">${esc(t.title)}</span>${sub}
    </div>
    <button type="button" class="tbub${n ? ' has' : ''}" data-topen aria-label="კომენტარები: ${n}">${n ? TI.bubble : TI.bubblePlus}${n ? `<i>${n}</i>` : ''}</button>
    <button type="button" class="tc tc-own" data-tpick="owners" aria-label="ვისზეა: ${esc((t.owners || []).map(pname).join(', ') || 'არავის')}">${avsHTML(t.owners || [])}</button>
    <button type="button" class="tc tc-st st-${esc(t.status)}" data-tpick="status">${stLabel(t.status)}</button>
    <button type="button" class="tc tc-pr pr-${esc(t.priority || 'none')}" data-tpick="priority">${prLabel(t.priority)}</button>
    <label class="tc tc-due">${dueHTML(t)}<input type="date" value="${esc(t.due)}" data-tdue aria-label="ვადა"></label>
  </div>`;
}
function groupHTML(g){
  const all = TASKS.filter(t => grpOf(t) === g.id), L = all.filter(visible).sort(byPos), fold = FOLD[g.id];
  const counts = TST.map(s => [s, all.filter(t => t.status === s.id).length]).filter(([, n]) => n);
  const bar = all.length ? `<span class="tbar" title="${counts.map(([s, n]) => `${s.label}: ${n}`).join(', ')}">${counts.map(([s, n]) => `<i class="st-${s.id}" style="flex:${n}"></i>`).join('')}</span>` : '';
  return `<section class="tgrp${fold ? ' fold' : ''}" data-grp="${esc(g.id)}" style="--g:${esc(g.color)}">
    <div class="tgh">
      <button type="button" class="gchev" data-gfold aria-expanded="${!fold}" aria-label="${fold ? 'გაშლა' : 'აკეცვა'}">${TI.chev}</button>
      <button type="button" class="gname" data-gmenu title="სახელი, ფერი, წაშლა">${esc(g.name)}</button>
      <span class="gcount">${all.length} დავალება</span>${bar}
    </div>
    ${fold ? '' : `<div class="ttbl">
      <div class="thead"><span></span><span>დავალება</span><span></span><span>ვისზეა</span><span>სტატუსი</span><span>პრიორიტეტი</span><span>ვადა</span></div>
      <div class="trows">${L.map(rowHTML).join('')}</div>
      <form class="tadd" data-tadd><input name="title" maxlength="200" placeholder="+ დავალების დამატება" autocomplete="off" aria-label="ახალი დავალება ჯგუფში ${esc(g.name)}"><button class="btn sm primary" type="submit">დამატება</button></form>
    </div>`}
  </section>`;
}
function renderTasks(){
  if(!CAN_TASKS){ $('#tkBody').innerHTML = '<div class="empty">დავალებები მხოლოდ შიდა გუნდისთვისაა.</div>'; return; }
  const mineOpen = ME ? TASKS.filter(t => (t.owners || []).includes(ME) && t.status !== 'done').length : 0;
  const late = TASKS.filter(t => t.due && t.due < today() && t.status !== 'done').length;
  $('#tkSub').textContent = ME ? `შენზეა ${mineOpen} ღია დავალება${late ? `, ვადაგადაცილებულია ${late}` : ''}.` : 'ვინ რას აკეთებს და რა ვადაში.';
  const who = [['all', 'ყველა'], ...PEOPLE.filter(p => p.email === ME).map(p => [p.email, 'ჩემი']), ...PEOPLE.filter(p => p.email !== ME).map(p => [p.email, p.name])];
  const keepQ = document.activeElement && document.activeElement.id === 'tkQ';
  $('#tkBody').innerHTML = `
    <div class="ttools">
      <label class="tsearch">${TI.search}<input id="tkQ" type="search" placeholder="ძებნა" value="${esc(tkQ)}" autocomplete="off" aria-label="დავალების ძებნა"></label>
      <div class="seg" role="group" aria-label="ვისი დავალებები" id="tkSeg"><span class="thumb"></span>${who.map(([k, t]) => `<button type="button" data-who="${esc(k)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
      <button type="button" class="chip" data-hidedone aria-pressed="${hideDone}">დასრულებულის დამალვა</button>
    </div>
    ${GROUPS.map(groupHTML).join('')}
    <button type="button" class="btn sm gadd" data-gadd>${I.plus}ახალი ჯგუფი</button>`;
  setSeg($('#tkSeg'), 'data-who', tkWho);
  $('#tkSeg').querySelectorAll('button').forEach(b => segRO.observe(b));
  if(keepQ){ const q = $('#tkQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  paintBadge();
}
async function taskCall(body, okMsg){
  busy++;
  try{ take(await call(Object.assign({pin: pin()}, body))); if(okMsg) toast(okMsg); return true; }
  catch(e){ toast(/team only/.test(e.message) ? 'დავალებები მხოლოდ შიდა გუნდისთვისაა.' : 'ვერ შეინახა. სცადეთ თავიდან.'); return false; }
  finally{ busy--; render(); }
}
function editTask(id, patch, msg){
  const t = TASKS.find(x => x.id === id); if(!t) return;
  Object.assign(t, patch); render();
  return taskCall({action:'hubTaskEdit', id, task: patch}, msg);
}
function saveGroups(){ render(); return taskCall({action:'hubGroupSave', groups: GROUPS}); }

/* the option list that opens from a cell, like on monday */
function closePop(){ if(popEl){ popEl.remove(); popEl = null; } }
function placePop(cell){
  const r = cell.getBoundingClientRect(), w = Math.max(popEl.offsetWidth, r.width, 190), h = popEl.offsetHeight;
  popEl.style.width = w + 'px';
  popEl.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
  popEl.style.top = (r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
function openPop(cell, kind, t){
  closePop();
  popEl = document.createElement('div');
  popEl.className = 'tpop k-' + kind; popEl.dataset.for = t.id + kind;
  const paint = () => {
    if(kind === 'owners') popEl.innerHTML = `<small>ვისზეა (შეგიძლია რამდენიმე მონიშნო)</small>` + PEOPLE.map(p => `<button type="button" data-v="${esc(p.email)}" role="menuitemcheckbox" aria-checked="${(t.owners || []).includes(p.email)}">${avHTML(p.email)}<span>${esc(p.name)}${p.email === ME ? ' (მე)' : ''}</span><i class="ck">${I.check}</i></button>`).join('');
    else popEl.innerHTML = (kind === 'status' ? TST.map(s => [s.id, s.label, 'st-' + s.id]) : TPR.map(s => [s.id, s.label || 'არ არის', 'pr-' + (s.id || 'none')]))
      .map(([v, l, c]) => `<button type="button" class="${c}" data-v="${esc(v)}" aria-selected="${(t[kind] || '') === v}">${esc(l)}</button>`).join('');
  };
  paint(); document.body.appendChild(popEl); placePop(cell);
  popEl.onclick = e => {
    const b = e.target.closest('[data-v]'); if(!b) return;
    const v = b.dataset.v;
    if(kind === 'owners'){
      const now = t.owners || [], next = now.includes(v) ? now.filter(x => x !== v) : [...now, v];
      editTask(t.id, {owners: next}, !now.includes(v) && v !== ME ? `დავალება მიეწერა: ${pname(v)}` : '');
      paint(); return;
    }
    closePop();
    if((t[kind] || '') === v) return;
    editTask(t.id, {[kind]: v}, kind === 'status' && v === 'done' ? `„${t.title}“ დასრულდა` : '');
  };
}
function openGroupMenu(btn, g){
  closePop();
  popEl = document.createElement('div'); popEl.className = 'tpop k-group'; popEl.dataset.for = 'g' + g.id;
  const empty = !TASKS.some(t => grpOf(t) === g.id);
  popEl.innerHTML = `<input class="gin" value="${esc(g.name)}" maxlength="60" aria-label="ჯგუფის სახელი">
    <div class="sw">${GCOL.map(c => `<button type="button" data-col="${c}" style="--c:${c}" aria-label="ფერი" aria-pressed="${c === g.color}"></button>`).join('')}</div>
    ${GROUPS.length > 1 ? `<button type="button" class="gdel" data-gdel ${empty ? '' : 'disabled'}>${TI.trash}${empty ? 'ჯგუფის წაშლა' : 'წასაშლელად ჯერ დავალებები გადაიტანე'}</button>` : ''}`;
  document.body.appendChild(popEl); placePop(btn);
  const inp = popEl.querySelector('.gin'); inp.focus(); inp.select();
  const commit = () => { const v = inp.value.trim(); if(v && v !== g.name){ g.name = v; saveGroups(); } };
  inp.onkeydown = e => { if(e.key === 'Enter'){ commit(); closePop(); } };
  inp.onblur = commit;
  popEl.onclick = e => {
    const c = e.target.closest('[data-col]'); if(c){ g.color = c.dataset.col; closePop(); saveGroups(); return; }
    if(e.target.closest('[data-gdel]') && empty){ GROUPS = GROUPS.filter(x => x !== g); closePop(); saveGroups(); }
  };
}
function openBell(btn){
  closePop();
  const N = notifs(), seen = Number(ls.get(SEENKEY) || 0);
  popEl = document.createElement('div'); popEl.className = 'tpop k-bell'; popEl.dataset.for = 'bell';
  popEl.innerHTML = `<small>შეტყობინებები</small>` + (N.length ? N.map(n => `<button type="button" class="nt${n.t > seen ? ' new' : ''}" data-nopen="${esc(n.task.id)}">
      <span class="nh"><b>${esc(n.by)}</b> ${n.what}${n.what === 'მოგნიშნა' ? ' კომენტარში' : ''}<time>${ago(n.t)}</time></span>
      <span class="nb">${esc(n.task.title)}</span>${n.text ? `<span class="nx">${esc(n.text.slice(0, 120))}</span>` : ''}</button>`).join('')
    : '<p class="none">როცა ვინმე მოგნიშნავს ან დავალებას მოგწერს, აქ გამოჩნდება.</p>');
  document.body.appendChild(popEl);
  const r = btn.getBoundingClientRect(), w = Math.min(360, innerWidth - 16);
  popEl.style.width = w + 'px'; popEl.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; popEl.style.top = (r.bottom + 6) + 'px';
  ls.set(SEENKEY, String(Date.now())); paintBadge();
  popEl.onclick = e => { const b = e.target.closest('[data-nopen]'); if(b){ closePop(); openPanel(b.dataset.nopen); } };
}
document.addEventListener('pointerdown', e => { if(popEl && !popEl.contains(e.target) && !e.target.closest('[data-tpick],[data-gmenu],#tkBell')) closePop(); }, true);
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ if(popEl) closePop(); else if(panelId && !$('#mpop')) closePanel(); } });
$('#pTasks').addEventListener('scroll', () => { if(popEl && !popEl.classList.contains('k-group')) closePop(); }, {passive:true});
addEventListener('resize', closePop);

$('#pTasks').addEventListener('click', e => {
  if(e.target.closest('#tkAdd')){ const f = $('#tkBody [data-tadd] input'); if(f){ f.scrollIntoView({block:'center', behavior:'smooth'}); f.focus({preventScroll:true}); } return; }
  const bell = e.target.closest('#tkBell'); if(bell){ if(popEl && popEl.dataset.for === 'bell') closePop(); else openBell(bell); return; }
  const w = e.target.closest('[data-who]'); if(w){ tkWho = w.dataset.who; renderTasks(); return; }
  if(e.target.closest('[data-hidedone]')){ hideDone = !hideDone; renderTasks(); return; }
  if(e.target.closest('[data-gadd]')){
    const g = {id: 'g' + Date.now().toString(36), name: 'ახალი ჯგუფი', color: GCOL[GROUPS.length % GCOL.length]};
    GROUPS.push(g); saveGroups().then(() => {}); renderTasks();
    const b = $(`#tkBody [data-grp="${g.id}"] [data-gmenu]`); if(b) openGroupMenu(b, g);
    return;
  }
  const sec = e.target.closest('[data-grp]'), g = sec && GROUPS.find(x => x.id === sec.dataset.grp);
  if(g && e.target.closest('[data-gfold]')){ FOLD[g.id] = !FOLD[g.id]; ls.set(FOLDKEY, JSON.stringify(FOLD)); renderTasks(); return; }
  if(g && e.target.closest('[data-gmenu]')){ if(popEl && popEl.dataset.for === 'g' + g.id) closePop(); else openGroupMenu(e.target.closest('[data-gmenu]'), g); return; }
  const row = e.target.closest('[data-task]'); if(!row) return;
  const t = TASKS.find(x => x.id === row.dataset.task); if(!t) return;
  const pk = e.target.closest('[data-tpick]');
  if(pk){ if(popEl && popEl.dataset.for === t.id + pk.dataset.tpick){ closePop(); return; } openPop(pk, pk.dataset.tpick, t); return; }
  if(e.target.closest('.tc-due')){ const i = row.querySelector('[data-tdue]'); try{ i.showPicker(); }catch(err){ i.focus(); } e.preventDefault(); return; }
  if(e.target.closest('[data-topen]')) openPanel(t.id);
});
$('#pTasks').addEventListener('keydown', e => { const o = e.target.closest('.tname[data-topen]'); if(o && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); openPanel(o.closest('[data-task]').dataset.task); } });
$('#pTasks').addEventListener('input', e => { if(e.target.id === 'tkQ'){ tkQ = e.target.value.trim(); renderTasks(); } });
$('#pTasks').addEventListener('change', e => {
  const i = e.target.closest('[data-tdue]'); if(!i) return;
  editTask(i.closest('[data-task]').dataset.task, {due: i.value}, '');
});
$('#pTasks').addEventListener('submit', async e => {
  const f = e.target.closest('[data-tadd]'); if(!f) return;
  e.preventDefault();
  const title = f.title.value.trim(); if(!title) return;
  const grp = f.closest('[data-grp]').dataset.grp, owners = tkWho !== 'all' ? [tkWho] : ME ? [ME] : [];
  const pos = Math.max(0, ...TASKS.filter(t => grpOf(t) === grp).map(t => t.pos || 0)) + 1000;
  TASKS.push({id: 'tmp' + Date.now(), created: Date.now(), title, notes: '', owners, status: 'todo', priority: '', due: '', grp, pos, updates: [], by: ''});
  renderTasks();
  const again = $(`#tkBody [data-grp="${grp}"] [data-tadd] input`); if(again) again.focus();
  await taskCall({action:'hubTaskAdd', task: {title, owners, grp, pos}}, '');
  const a2 = $(`#tkBody [data-grp="${grp}"] [data-tadd] input`); if(a2 && document.activeElement !== a2 && !panelId) a2.focus();
});

/* drag a row by its handle: up, down, or into another group */
$('#pTasks').addEventListener('pointerdown', e => {
  const grip = e.target.closest('[data-grip]'); if(!grip || e.button > 0) return;
  const row = grip.closest('.trow'), t = TASKS.find(x => x.id === row.dataset.task); if(!t || t.id.startsWith('tmp')) return;
  e.preventDefault(); closePop();
  const pane = $('#pTasks'), r = row.getBoundingClientRect(), dy = e.clientY - r.top;
  const ph = document.createElement('div'); ph.className = 'trow ph'; ph.style.height = r.height + 'px';
  row.after(ph);
  Object.assign(row.style, {position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: 80});
  row.classList.add('lift'); document.body.classList.add('tdragging'); dragging = true;
  let lastY = e.clientY, raf = 0;
  const place = y => {
    row.style.top = (y - dy) + 'px';
    row.style.visibility = 'hidden';
    const el = document.elementFromPoint(r.left + 40, y);
    row.style.visibility = '';
    const over = el && el.closest('.trow:not(.ph):not(.lift)'), sec = el && el.closest('[data-grp]');
    if(over){ const b = over.getBoundingClientRect(); y < b.top + b.height / 2 ? over.before(ph) : over.after(ph); }
    else if(sec && !sec.classList.contains('fold')){
      const rows = sec.querySelector('.trows'), list = rows && [...rows.querySelectorAll('.trow:not(.ph):not(.lift)')];
      if(rows && (!list.length || y > list[list.length - 1].getBoundingClientRect().bottom)) rows.appendChild(ph);
      else if(rows && y < list[0].getBoundingClientRect().top) rows.prepend(ph);
    }
  };
  const tick = () => {
    const pr = pane.getBoundingClientRect();
    if(lastY < pr.top + 70) pane.scrollTop -= 12; else if(lastY > pr.bottom - 70) pane.scrollTop += 12;
    place(lastY); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const move = ev => { lastY = ev.clientY; };
  const up = () => {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    document.body.classList.remove('tdragging'); dragging = false;
    const sec = ph.closest('[data-grp]'), grp = sec ? sec.dataset.grp : grpOf(t);
    const pv = ph.previousElementSibling, nx = ph.nextElementSibling;
    const P = el => { const x = el && el.dataset.task && TASKS.find(z => z.id === el.dataset.task); return x ? x.pos || 0 : null; };
    const a = P(pv), b = P(nx);
    const pos = a != null && b != null ? (a + b) / 2 : a != null ? a + 1000 : b != null ? b - 1000 : Date.now();
    ph.remove(); row.removeAttribute('style'); row.classList.remove('lift');
    if(grp === grpOf(t) && pos === t.pos){ renderTasks(); return; }
    editTask(t.id, {grp, pos}, grp !== grpOf(t) ? `გადავიდა: ${(GROUPS.find(g => g.id === grp) || {}).name}` : '');
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
});

/* ---------- task panel: description, comments with @mentions, history (monday's item card) ---------- */
const panel = document.createElement('aside');
panel.className = 'tpanel'; panel.id = 'tkPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'დავალება');
document.body.appendChild(panel);
let panelTab = 'notes';
function closePanel(){ panel.hidden = true; panel.innerHTML = ''; panelId = null; document.querySelectorAll('.trow.open').forEach(r => r.classList.remove('open')); }
function openPanel(id){
  const t = TASKS.find(x => x.id === id); if(!t || id.startsWith('tmp')) return;
  closePop(); panelId = id; panelTab = 'notes';
  panel.innerHTML = `<div class="tp-scrim" data-pclose></div><div class="tp-card" role="dialog" aria-modal="true">
    <header class="tp-h"><button type="button" class="icon-btn" data-pclose aria-label="დახურვა">${TI.x}</button>
      <textarea class="tp-title" rows="1" maxlength="200" aria-label="დავალების სახელი"></textarea></header>
    <div class="tp-meta"></div>
    <div class="tp-sec"><b>აღწერა</b><textarea class="tp-desc" maxlength="5000" placeholder="რა უნდა გაკეთდეს, ბმულები, დეტალები"></textarea><small class="tp-saved" hidden>შენახულია</small></div>
    <div class="tp-tabs" role="tablist"><button type="button" role="tab" data-ptab="notes"></button><button type="button" role="tab" data-ptab="log">ისტორია</button></div>
    <div class="tp-body"></div>
  </div>`;
  const ti = panel.querySelector('.tp-title'), de = panel.querySelector('.tp-desc');
  ti.value = t.title; de.value = t.notes;
  const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  [ti, de].forEach(el => { el.addEventListener('input', () => grow(el)); });
  ti.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); ti.blur(); } };
  ti.onblur = () => { const v = ti.value.trim(); const x = TASKS.find(z => z.id === panelId); if(x && v && v !== x.title) editTask(x.id, {title: v}); else if(x && !v) ti.value = x.title; };
  de.onblur = async () => { const x = TASKS.find(z => z.id === panelId); if(x && de.value !== x.notes){ const ok = await editTask(x.id, {notes: de.value}); const s = panel.querySelector('.tp-saved'); if(ok && s){ s.hidden = false; setTimeout(() => s.hidden = true, 1800); } } };
  panel.hidden = false;
  paintPanel(); requestAnimationFrame(() => { grow(ti); grow(de); });
  document.querySelectorAll('.trow').forEach(r => r.classList.toggle('open', r.dataset.task === id));
}
function paintPanel(){
  const t = TASKS.find(x => x.id === panelId); if(!t){ closePanel(); return; }
  const ti = panel.querySelector('.tp-title'), de = panel.querySelector('.tp-desc');
  if(document.activeElement !== ti && ti.value !== t.title) ti.value = t.title;
  if(document.activeElement !== de && de.value !== t.notes) de.value = t.notes;
  const g = GROUPS.find(x => x.id === grpOf(t)) || {};
  panel.querySelector('.tp-meta').innerHTML = `
    <div class="pm-row"><span>ვისზეა</span><button type="button" class="pv" data-ppick="owners">${avsHTML(t.owners || [])}<em>${esc((t.owners || []).map(pname).join(', ') || 'არავის')}</em></button></div>
    <div class="pm-row"><span>სტატუსი</span><button type="button" class="pv pill st-${esc(t.status)}" data-ppick="status">${stLabel(t.status)}</button></div>
    <div class="pm-row"><span>პრიორიტეტი</span><button type="button" class="pv pill pr-${esc(t.priority || 'none')}" data-ppick="priority">${prLabel(t.priority) || 'არ არის'}</button></div>
    <div class="pm-row"><span>ვადა</span><label class="pv">${dueHTML(t)}<input type="date" value="${esc(t.due)}" data-pdue aria-label="ვადა"></label></div>
    <div class="pm-row"><span>ჯგუფი</span><label class="pv"><i class="gdot" style="--g:${esc(g.color || '#999')}"></i><select data-pgrp aria-label="ჯგუფი">${GROUPS.map(x => `<option value="${esc(x.id)}" ${x.id === g.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>`;
  const N = notesOf(t);
  panel.querySelector('[data-ptab="notes"]').textContent = `კომენტარები${N.length ? ' (' + N.length + ')' : ''}`;
  panel.querySelectorAll('[data-ptab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ptab === panelTab)));
  const body = panel.querySelector('.tp-body');
  if(panelTab === 'log'){
    const LBL = {add: () => 'შექმნა დავალება', status: u => `სტატუსი შეცვალა: ${stLabel(u.v)}`, owners: u => (u.v || []).length ? `ვისზეა: ${(u.v || []).map(pname).join(', ')}` : 'პასუხისმგებელი მოხსნა', note: () => 'დაწერა კომენტარი'};
    body.innerHTML = `<ul class="tp-log">${(t.updates || []).slice().reverse().map(u => `<li>${avHTML(u.be || '', 'sm')}<span><b>${esc(u.by)}</b> ${esc((LBL[u.k] || (() => ''))(u))}</span><time>${fmt(u.t)}</time></li>`).join('')}</ul>`;
    return;
  }
  const keep = body.querySelector('.tp-comp textarea'), draft = keep ? keep.value : '', focused = keep && document.activeElement === keep;
  body.innerHTML = `<div class="tp-comp"><textarea maxlength="3000" placeholder="დაწერე კომენტარი. ადამიანის მოსანიშნად აკრიფე @" aria-label="კომენტარი"></textarea>
      <div class="tp-cr"><small>@ აკრიფე და აირჩიე, ვინ მონიშნო</small><button type="button" class="btn sm primary" data-psend>გაგზავნა</button></div></div>
    ${N.length ? `<ul class="tp-notes">${N.slice().reverse().map(u => `<li>
      <div class="uh">${avHTML(u.be || (PEOPLE.find(p => p.name === u.by) || {}).email || '', 'sm')}<b>${esc(u.by)}</b><time title="${fmt(u.t)}">${ago(u.t)}</time>
      ${u.i && (u.be === ME || ROLE === 'team') ? `<button type="button" class="ndel" data-ndel="${esc(u.i)}" aria-label="კომენტარის წაშლა">${TI.trash}</button>` : ''}</div>
      <p>${richText(u.v)}</p></li>`).join('')}</ul>` : '<p class="tp-empty">კომენტარი ჯერ არ არის. დაწერე პირველი და მონიშნე ადამიანი @-ით.</p>'}
    <div class="tp-foot"><span>შექმნა ${esc(t.by || '')}, ${fmt(t.created)}</span><button type="button" class="btn sm" data-pdel>${TI.trash}დავალების წაშლა</button></div>`;
  const ta = body.querySelector('.tp-comp textarea');
  ta.value = draft; if(focused){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  wireMentions(ta);
}
async function sendNote(){
  const ta = panel.querySelector('.tp-comp textarea'), text = ta.value.trim(); if(!text || !panelId) return;
  const b = panel.querySelector('[data-psend]'); b.disabled = true;
  const t = TASKS.find(x => x.id === panelId);
  t.updates = [...(t.updates || []), {k: 'note', t: Date.now(), by: pname(ME) || 'მე', be: ME, v: text}];
  ta.value = ''; paintPanel(); render();
  if(!await taskCall({action:'hubTaskNote', id: panelId, text, m: mentionsIn(text)}, mentionsIn(text).filter(e => e !== ME).length ? 'კომენტარი გაიგზავნა, მონიშნულები ნახავენ' : '')){
    const t2 = panel.querySelector('.tp-comp textarea'); if(t2) t2.value = text;
  }
}
panel.addEventListener('click', async e => {
  if(e.target.closest('[data-pclose]')){ closePanel(); return; }
  const tb = e.target.closest('[data-ptab]'); if(tb){ panelTab = tb.dataset.ptab; paintPanel(); return; }
  const t = TASKS.find(x => x.id === panelId); if(!t) return;
  const pk = e.target.closest('[data-ppick]');
  if(pk){ if(popEl && popEl.dataset.for === t.id + pk.dataset.ppick){ closePop(); return; } openPop(pk, pk.dataset.ppick, t); popEl.dataset.for = t.id + pk.dataset.ppick; return; }
  if(e.target.closest('label.pv') && e.target.closest('.pm-row') && panel.querySelector('[data-pdue]') && e.target.closest('.pm-row').contains(panel.querySelector('[data-pdue]'))){ const i = panel.querySelector('[data-pdue]'); try{ i.showPicker(); }catch(err){ i.focus(); } e.preventDefault(); return; }
  if(e.target.closest('[data-psend]')){ sendNote(); return; }
  const nd = e.target.closest('[data-ndel]');
  if(nd){ if(!confirm('წავშალო ეს კომენტარი?')) return; t.updates = t.updates.filter(u => u.i !== nd.dataset.ndel); paintPanel(); await taskCall({action:'hubTaskNoteDel', id: t.id, i: nd.dataset.ndel}, 'კომენტარი წაიშალა'); return; }
  if(e.target.closest('[data-pdel]')){ if(!confirm(`წავშალო დავალება „${t.title}“?`)) return; const id = t.id; closePanel(); TASKS = TASKS.filter(x => x.id !== id); render(); await taskCall({action:'hubTaskDelete', id}, 'დავალება წაიშალა'); }
});
panel.addEventListener('change', e => {
  if(e.target.matches('[data-pdue]')) editTask(panelId, {due: e.target.value});
  if(e.target.matches('[data-pgrp]')){ const grp = e.target.value; editTask(panelId, {grp, pos: Math.max(0, ...TASKS.filter(t => grpOf(t) === grp).map(t => t.pos || 0)) + 1000}, `გადავიდა: ${(GROUPS.find(g => g.id === grp) || {}).name}`); }
});
panel.addEventListener('keydown', e => { if(e.target.matches('.tp-comp textarea') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ e.preventDefault(); sendNote(); } });

/* @mention picker under the comment box */
function wireMentions(ta){
  let box = null, list = [], at = -1, sel = 0;
  const close = () => { if(box){ box.remove(); box = null; } };
  const pick = p => {
    const v = ta.value, end = ta.selectionStart;
    ta.value = v.slice(0, at) + '@' + p.name + ' ' + v.slice(end);
    const c = at + p.name.length + 2; ta.setSelectionRange(c, c); ta.focus(); close();
  };
  const paint = () => {
    if(!box){ box = document.createElement('div'); box.className = 'tpop k-mention'; box.id = 'mpop'; document.body.appendChild(box);
      box.onpointerdown = e => { e.preventDefault(); const b = e.target.closest('[data-mi]'); if(b) pick(list[+b.dataset.mi]); }; }
    box.innerHTML = list.map((p, i) => `<button type="button" data-mi="${i}" aria-selected="${i === sel}">${avHTML(p.email)}<span>${esc(p.name)}</span></button>`).join('');
    const r = ta.getBoundingClientRect(); box.style.width = '220px'; box.style.left = (r.left + 8) + 'px';
    box.style.top = Math.min(r.bottom + 4, innerHeight - box.offsetHeight - 8) + 'px';
  };
  ta.addEventListener('input', () => {
    const before = ta.value.slice(0, ta.selectionStart), m = before.match(/(^|\s)@([^\s@]*)$/);
    if(!m){ close(); return; }
    at = before.length - m[2].length - 1;
    list = PEOPLE.filter(p => p.name.toLowerCase().startsWith(m[2].toLowerCase()) || p.email.startsWith(m[2].toLowerCase()));
    if(!list.length){ close(); return; }
    sel = 0; paint();
  });
  ta.addEventListener('keydown', e => {
    if(!box) return;
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length; paint(); }
    else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); e.stopPropagation(); pick(list[sel]); }
    else if(e.key === 'Escape'){ e.stopPropagation(); close(); }
  });
  ta.addEventListener('blur', () => setTimeout(close, 150));
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
  if(DEMO) TABS = {content:true, patients:true, analytics:true, tasks:true};
  else if(CFGH.api){
    try{ const r = await api.post(CFGH, {action:'hubPublic'}); TABS = Object.assign({content:true, patients:false, analytics:false, tasks:false}, (r.settings || {}).tabs || {}); GCLIENT = r.clientId || ''; }
    catch(e){ TABS = {content:true, patients:false, analytics:false, tasks:false}; }
  }
  setupNav();
  if(cur === 'content' && !DEMO && (session() || pin() || teamKey())) loadHub(true);   // learn early whether this person sees the task board
  setInterval(() => { if(document.visibilityState === 'visible' && cur !== 'content' && loaded && !busy && sh.hidden && !popEl && !panelId && !dragging) loadHub(true); }, 30000);
}
boot();

/* ---------- demo data (?demo=1) ---------- */
let DEMO_LEADS = null, DEMO_TASKS = null, DEMO_GROUPS = null;
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
  if(!DEMO_TASKS){
    const now = Date.now(), D = 864e5, day = k => { const x = new Date(now + k * D); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
    const mk = (i, title, owners, status, priority, due, grp, notes = '', ups = []) => ({id: 'T' + i, created: now - i * D, title, notes, owners, status, priority, due, grp, pos: i * 1000, by: 'გია', creator: 'gia@demo', updated: now - i * 3600e3, updates: [{t: now - i * D, by: 'გია', be: 'gia@demo', k: 'add'}, ...ups]});
    DEMO_TASKS = [
      mk(1, 'ნოემბრის ფოტოები: ექიმების პორტრეტები', ['tamari@demo'], 'doing', 'high', day(1), 'g1', 'თეთრ ფონზე, 4:5. ორი ექიმი, თითოეულს 3 კადრი.', [{i: 'n1', t: now - 2 * 3600e3, by: 'თამარი', be: 'tamari@demo', k: 'note', v: 'ხვალ 12-ზე გადავიღებ. @გია ფონი შენ მოიტან?', m: ['gia@demo']}]),
      mk(2, 'პაციენტის ვიდეო-შეფასება იმპლანტზე', ['tamari@demo', 'gia@demo'], 'todo', 'mid', day(4), 'g1'),
      mk(3, 'ფასების ცხრილი საიტისთვის', ['gia@demo'], 'stuck', 'high', day(-1), 'g1', 'ახალი ფასები ჯერ არ გვაქვს.'),
      mk(4, 'Facebook-ის რეკლამის ტექსტების დადასტურება', [], 'todo', 'low', day(6), 'g2', '', [{i: 'n2', t: now - 40 * 60e3, by: 'გია', be: 'gia@demo', k: 'note', v: '@თამარი ნახე, რომელი ვარიანტი ჯობია.', m: ['tamari@demo']}]),
      mk(5, 'Instagram-ის ბიო განახლება', ['gia@demo'], 'done', 'low', day(-3), 'g2'),
    ];
    DEMO_GROUPS = [{id: 'g1', name: 'ამ კვირაში', color: '#579BFC'}, {id: 'g2', name: 'შემდეგში', color: '#A25DDC'}];
  }
  const res = () => ({role: 'clinic', canTasks: true, groups: JSON.parse(JSON.stringify(DEMO_GROUPS)), tasks: JSON.parse(JSON.stringify(DEMO_TASKS)), people: [{email: 'gia@demo', name: 'გია'}, {email: 'tamari@demo', name: 'თამარი'}], leads: JSON.parse(JSON.stringify(DEMO_LEADS)), settings: {spend: {[m(0)]: {facebook: 240, google: 120, sms: 35}, [m(1)]: {facebook: 200, google: 100}}}});
  const L = id => DEMO_LEADS.find(l => l.id === id);
  if(body.action === 'hubLeadAdd') DEMO_LEADS.unshift({id: 'D' + Date.now(), created: Date.now(), ...body.lead, source: '', stage: 'new', updated: Date.now(), history: [{t: Date.now(), stage: 'new', by: body.by}]});
  if(body.action === 'hubLeadMove'){ const l = L(body.id); l.stage = body.stage; l.history.push({t: Date.now(), stage: body.stage, by: body.by}); }
  if(body.action === 'hubLeadEdit') Object.assign(L(body.id), body.lead);
  if(body.action === 'hubTaskAdd') DEMO_TASKS.push({id: 'T' + Date.now(), created: Date.now(), notes: '', owners: [], status: 'todo', priority: '', due: '', ...body.task, by: 'თამარი', creator: 'tamari@demo', updated: Date.now(), updates: [{t: Date.now(), by: 'თამარი', be: 'tamari@demo', k: 'add'}]});
  if(body.action === 'hubTaskEdit') Object.assign(DEMO_TASKS.find(t => t.id === body.id), body.task, {updated: Date.now()});
  if(body.action === 'hubTaskNote') DEMO_TASKS.find(t => t.id === body.id).updates.push({i: 'n' + Date.now(), t: Date.now(), by: 'თამარი', be: 'tamari@demo', k: 'note', v: body.text, m: body.m});
  if(body.action === 'hubTaskNoteDel'){ const t = DEMO_TASKS.find(t => t.id === body.id); t.updates = t.updates.filter(u => u.i !== body.i); }
  if(body.action === 'hubGroupSave') DEMO_GROUPS = body.groups;
  if(body.action === 'hubTaskDelete') DEMO_TASKS.splice(DEMO_TASKS.findIndex(t => t.id === body.id), 1);
  return new Promise(r => setTimeout(() => r(res()), 250));
}
})();
