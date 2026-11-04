/* Client hub on top of the Instagram preview: bottom tabs, patients pipeline, analytics.
   The Instagram part (#pv, #fv, comments, approvals) is not touched by this file.
   Patient data comes from the Apps Script (Hub.gs) and needs the clinic PIN.
   If the script does not answer the hub calls, the tab bar stays hidden and the page
   looks exactly like the plain Instagram preview. ?demo=1 shows sample data offline. */
(() => {
const DEMO = Q.get('demo') === '1';
const PINKEY = 'hub_pin_' + CLIENT;
const STAGES = [
  {id:'new',    label:'ახალი პაციენტი', short:'ახალი',    next:'booked', nextLabel:'დაიჯავშნა →'},
  {id:'booked', label:'დაჯავშნა',        short:'დაჯავშნა', next:'done',   nextLabel:'ჩაიტარა ✓'},
  {id:'done',   label:'ჩაიტარა პროცედურა', short:'ჩაიტარა'},
];
const LOST = {id:'lost', label:'არქივი', short:'არქივი'};
const STAGE_LABEL = {new:'ახალი პაციენტი', booked:'დაჯავშნა', done:'ჩაიტარა პროცედურა', lost:'არქივი'};
const CHANNELS = {website:'საიტი', facebook:'Facebook', instagram:'Instagram', google:'Google', tiktok:'TikTok', sms:'SMS', phone:'ზარი', walkin:'კლინიკაში მოვიდა', referral:'რეკომენდაცია', other:'სხვა'};
const SERVICES = ['კონსულტაცია','კბილი ან ღრძილი მაწუხებს','წმენდა და შემოწმება','კბილის აღდგენა ან ჩანაცვლება','ღიმილის გალამაზება','ბავშვისთვის','სხვა'];
const MONTHS = ['იან','თებ','მარ','აპრ','მაი','ივნ','ივლ','აგვ','სექ','ოქტ','ნოე','დეკ'];
const IC = {
  content:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M3.5 9.5h17M9.5 9.5v11"/></svg>',
  patients:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 19.5a6.3 6.3 0 0 1 12.4 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.2a6 6 0 0 1 3.2 5.3"/></svg>',
  analytics:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 20h16"/><path d="M7 16.5v-5M12 16.5V7M17 16.5v-8"/></svg>',
};

const app = $('#app'), stage = document.querySelector('.stage');
let CFGH = null, TABS = {content:true, patients:false, analytics:false}, cur = 'content';
let LEADS = [], SPEND = {}, ROLE = '', loaded = false, busy = 0, pickStage = 'new', showLost = false, period = 'month';
const pin = () => ls.get(PINKEY) || '';
const me = () => (ls.get('igp_name') || '').trim();
const money = v => (Math.round(v * 10) / 10).toLocaleString('ka-GE', {maximumFractionDigits: 1}) + ' ₾';
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const fmt = ts => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const telHref = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
const waHref = p => { let d = String(p).replace(/\D/g, ''); if(d.length === 9) d = '995' + d; return 'https://wa.me/' + d; };
let toastT; const toast = m => { const t = $('#hubtoast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); };

/* ---------- DOM ---------- */
app.insertAdjacentHTML('beforeend', `
<div class="view hubv" id="hp" hidden>
  <div class="hh"><div class="t"><small>Likedent</small><b>პაციენტები</b></div><button class="hbtn gold" id="hpAdd" type="button" hidden>+ დამატება</button></div>
  <div id="hpBody"></div>
</div>
<div class="view hubv" id="ha" hidden>
  <div class="hh"><div class="t"><small>Likedent</small><b>ანალიტიკა</b></div></div>
  <div id="haBody"></div>
</div>
<div class="hsheet" id="hsh" hidden><form id="hshf" novalidate></form></div>
<div class="hubtoast" id="hubtoast" role="status" hidden></div>
<nav class="hubnav" id="hubnav" hidden aria-label="განყოფილებები">
  <button type="button" data-tab="content" aria-current="page">${IC.content}კონტენტი</button>
  <button type="button" data-tab="patients">${IC.patients}პაციენტები<span class="dot" id="newDot" hidden></span></button>
  <button type="button" data-tab="analytics">${IC.analytics}ანალიტიკა</button>
</nav>`);

function wideOK(){ return matchMedia('(min-width:820px)').matches; }
function applyLayout(){ app.classList.toggle('wide', cur !== 'content' && wideOK()); }
addEventListener('resize', applyLayout);

function showTab(t){
  if(!TABS[t]) t = 'content';
  cur = t;
  document.querySelectorAll('#hubnav button').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const ig = t === 'content';
  // Instagram views keep their own state (open post, scroll); only hidden while another tab is on
  $('#pv').style.visibility = ig ? '' : 'hidden'; $('#fv').style.visibility = ig ? '' : 'hidden';
  if(!ig) document.querySelectorAll('#feed video').forEach(v => v.pause());
  $('#hp').hidden = t !== 'patients'; $('#ha').hidden = t !== 'analytics';
  stage && stage.classList.toggle('hubmode', !ig);
  applyLayout();
  if(!ig){ if(!loaded) loadHub(); else render(); }
  try{ history.replaceState(null, '', location.pathname + location.search + (ig ? '' : '#' + t)); }catch(e){}
}
$('#hubnav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if(b) showTab(b.dataset.tab); });

function setupNav(){
  const any = TABS.patients || TABS.analytics;
  $('#hubnav').hidden = !any; app.classList.toggle('hashub', any);
  document.querySelectorAll('#hubnav [data-tab]').forEach(b => b.hidden = !TABS[b.dataset.tab]);
  if(!TABS.content){ $('#hubnav [data-tab="content"]').hidden = true; }
  const want = (location.hash || '').slice(1);
  showTab(TABS[want] ? want : (TABS.content ? 'content' : (TABS.patients ? 'patients' : 'analytics')));
}

/* ---------- data ---------- */
const teamKey = () => ls.get('igs_key_' + CLIENT) || '';   // set in the studio: Gia's devices see everything
async function call(body){
  if(DEMO) return demoCall(body);
  if(!body.pin){ delete body.pin; if(teamKey()) body.key = teamKey(); }
  return api.post(CFGH, body);
}
async function loadHub(silent){
  if(!pin() && !teamKey() && !DEMO){ loaded = false; render(); return; }
  try{
    const r = await call({action:'hubLoad', pin: pin()});
    take(r); loaded = true; render();
  }catch(e){
    if(/pin|tries|key/.test(String(e.message))){ ls.set(PINKEY, ''); loaded = false; render(/tries/.test(e.message) ? 'ძალიან ბევრი მცდელობა. სცადეთ 10 წუთში.' : (silent ? '' : 'PIN არასწორია.')); }
    else if(!silent) toast('კავშირი ვერ დამყარდა. სცადეთ თავიდან.');
  }
}
function take(r){
  LEADS = (r.leads || []).sort((a, b) => b.created - a.created);
  SPEND = (r.settings || {}).spend || {}; ROLE = r.role || '';
  const n = LEADS.filter(l => l.stage === 'new').length, d = $('#newDot');
  d.textContent = n; d.hidden = !n;
}

/* ---------- render ---------- */
function render(err){
  $('#hpAdd').hidden = !loaded;
  if(!loaded){ lockHTML('#hpBody', err); lockHTML('#haBody', err); return; }
  if(cur === 'patients') renderPatients();
  if(cur === 'analytics') renderAnalytics();
}
function lockHTML(sel, err){
  $(sel).innerHTML = `<form class="lock" data-lock>
    <b>შესვლა</b><p>პაციენტების მონაცემები დაცულია. შეიყვანეთ კლინიკის 6-ნიშნა PIN (ერთხელ ამ მოწყობილობაზე).</p>
    <input inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" aria-label="PIN" required>
    <div class="err" role="alert">${esc(err || '')}</div>
    <button class="hbtn gold" type="submit">შესვლა</button></form>`;
}
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-lock]'); if(!f) return;
  e.preventDefault();
  const v = f.querySelector('input').value.replace(/\D/g, '');
  if(v.length !== 6){ f.querySelector('.err').textContent = 'PIN 6 ციფრია.'; return; }
  ls.set(PINKEY, v); f.querySelector('button').disabled = true; await loadHub();
});

function leadHTML(l){
  const st = STAGES.find(s => s.id === l.stage);
  return `<article class="lead s-${esc(l.stage)}" data-lead="${esc(l.id)}" tabindex="0">
    <div class="lt"><b>${esc(l.name || l.phone || 'უსახელო')}</b><span class="tag">${esc(CHANNELS[l.channel] || l.channel || 'სხვა')}</span></div>
    <div class="ls">${l.service ? `<span>${esc(l.service)}</span>` : ''}<span>${fmt(l.created)}</span></div>
    ${l.notes ? `<div class="ln">${esc(l.notes)}</div>` : ''}
    <div class="la">${l.phone ? `<a class="hbtn sm" href="${telHref(l.phone)}" data-stop>☎ დარეკვა</a><a class="hbtn sm" href="${waHref(l.phone)}" target="_blank" rel="noopener" data-stop>WhatsApp</a>` : ''}<span class="sp"></span>
      ${st && st.next ? `<button class="hbtn sm ${st.next === 'done' ? 'emer' : 'gold'}" type="button" data-next="${esc(l.id)}">${st.nextLabel}</button>` : ''}</div>
  </article>`;
}
function renderPatients(){
  const by = s => LEADS.filter(l => l.stage === s);
  const lost = by('lost');
  const chips = STAGES.map(s => `<button type="button" class="chip" data-pick="${s.id}" aria-pressed="${pickStage === s.id}">${s.short}<i>${by(s.id).length}</i></button>`).join('')
    + `<button type="button" class="chip ghost" data-pick="lost" aria-pressed="${pickStage === 'lost'}">${LOST.short}<i>${lost.length}</i></button>`;
  const col = (s, extra = '') => {
    const items = by(s.id);
    return `<section class="col s-${s.id} ${extra}" ${pickStage === s.id ? '' : 'hidden'}>
      <div class="colh">${s.label}<i>${items.length}</i></div>
      ${items.length ? items.map(leadHTML).join('') : `<div class="empty">${s.id === 'new' ? 'ახალი მოთხოვნა ჯერ არ არის.' : 'ცარიელია.'}</div>`}
    </section>`;
  };
  $('#hpBody').innerHTML = `<div class="chips" role="group" aria-label="ეტაპი">${chips}</div>
    <div class="board">${STAGES.map(s => col(s)).join('')}${col(LOST, 'lostcol' + (showLost ? ' show' : ''))}</div>
    ${lost.length ? `<p class="hnote wideonly"><button class="hbtn sm" type="button" data-lost>${showLost ? 'არქივის დამალვა' : `არქივი (${lost.length})`}</button></p>` : ''}`;
  if(!app.classList.contains('wide')) $('#hpBody .wideonly') && ($('#hpBody .wideonly').hidden = true);
}
$('#hp').addEventListener('click', e => {
  if(e.target.closest('[data-stop]')) return;
  const pk = e.target.closest('[data-pick]'); if(pk){ pickStage = pk.dataset.pick; renderPatients(); return; }
  if(e.target.closest('[data-lost]')){ showLost = !showLost; renderPatients(); return; }
  const nx = e.target.closest('[data-next]'); if(nx){ const l = LEADS.find(x => x.id === nx.dataset.next), st = STAGES.find(s => s.id === l.stage); move(l, st.next); return; }
  const c = e.target.closest('[data-lead]'); if(c) openLead(c.dataset.lead);
  if(e.target.closest('#hpAdd')) openAdd();
});
$('#hp').addEventListener('keydown', e => { const c = e.target.closest('[data-lead]'); if(c && e.key === 'Enter') openLead(c.dataset.lead); });

async function move(l, to){
  const prev = l.stage; l.stage = to; renderPatients(); toast(`${l.name || l.phone}: ${STAGE_LABEL[to]}`);
  busy++;
  try{ take(await call({action:'hubLeadMove', pin: pin(), id: l.id, stage: to, by: me()})); render(); }
  catch(e){ l.stage = prev; renderPatients(); toast('ვერ შეინახა. სცადეთ თავიდან.'); }
  busy--;
}

/* ---------- sheets ---------- */
const sh = $('#hsh'), shf = $('#hshf');
const closeSh = () => { sh.hidden = true; shf.innerHTML = ''; };
sh.addEventListener('click', e => { if(e.target === sh || e.target.closest('[data-close]')) closeSh(); });
const opts = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`).join('');
function fieldsHTML(l){
  const svc = SERVICES.includes(l.service) || !l.service ? SERVICES : [l.service, ...SERVICES];
  return `<div class="two"><label>სახელი<input name="name" maxlength="80" value="${esc(l.name || '')}" autocomplete="off"></label>
    <label>ტელეფონი<input name="phone" maxlength="30" inputmode="tel" value="${esc(l.phone || '')}" autocomplete="off"></label></div>
    <div class="two"><label>სერვისი<select name="service"><option value="">—</option>${opts(svc.map(s => [s, s]), l.service)}</select></label>
    <label>საიდან მოვიდა<select name="channel">${opts(Object.entries(CHANNELS), l.channel || 'phone')}</select></label></div>
    <label>შენიშვნა<textarea name="notes" maxlength="1000" placeholder="მაგ. დილით ურჩევნია, ფასი აინტერესებს…">${esc(l.notes || '')}</textarea></label>`;
}
function openAdd(){
  shf.innerHTML = `<h3><span>ახალი პაციენტი</span><button class="hx" type="button" data-close aria-label="დახურვა">×</button></h3>
    ${fieldsHTML({})}
    <div class="row"><button class="hbtn" type="button" data-close>გაუქმება</button><button class="hbtn gold" type="submit">დამატება</button></div>`;
  shf.onsubmit = async e => {
    e.preventDefault();
    const lead = Object.fromEntries(new FormData(shf));
    if(!lead.name.trim() && !lead.phone.trim()){ toast('ჩაწერეთ სახელი ან ტელეფონი.'); return; }
    shf.querySelector('[type=submit]').disabled = true; busy++;
    try{ take(await call({action:'hubLeadAdd', pin: pin(), lead, by: me()})); closeSh(); pickStage = 'new'; render(); toast('დაემატა ✓'); }
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
    ${l.source ? `<label>წყარო (რეკლამა)<input value="${esc(l.source)}" readonly></label>` : ''}
    <ul class="hist">${(l.history || []).map(h => `<li>${fmt(h.t)} · ${esc(STAGE_LABEL[h.stage] || h.stage)}${h.by ? ' · ' + esc(h.by) : ''}</li>`).join('')}</ul>
    <div class="row">${ROLE === 'team' ? '<button class="hbtn" type="button" data-del>წაშლა</button><span style="flex:1"></span>' : ''}<button class="hbtn" type="button" data-close>დახურვა</button><button class="hbtn gold" type="submit">შენახვა</button></div>`;
  shf.querySelector('.stagepick').onclick = e => { const b = e.target.closest('[data-st]'); if(!b) return; to = b.dataset.st; shf.querySelector('.stagepick').innerHTML = pick(); };
  const del = shf.querySelector('[data-del]');
  if(del) del.onclick = async () => { if(!confirm('წავშალო ეს პაციენტი სამუდამოდ?')) return; busy++; try{ take(await call({action:'hubLeadDelete', key: ls.get('igs_key_' + CLIENT), id})); closeSh(); render(); }catch(e){ toast('ვერ წაიშალა.'); } busy--; };
  shf.onsubmit = async e => {
    e.preventDefault();
    const lead = Object.fromEntries(new FormData(shf)); busy++;
    shf.querySelector('[type=submit]').disabled = true;
    try{
      const changed = ['name','phone','service','channel','notes'].some(k => (lead[k] || '') !== (l[k] || ''));
      let r = null;
      if(changed) r = await call({action:'hubLeadEdit', pin: pin(), id, lead, by: me()});
      if(to !== l.stage) r = await call({action:'hubLeadMove', pin: pin(), id, stage: to, by: me()});
      if(r) take(r); closeSh(); render(); if(r) toast('შენახულია ✓');
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
  const out = []; const d = new Date(a.getFullYear(), a.getMonth(), 1);
  while(d < b){ out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`); d.setMonth(d.getMonth() + 1); }
  return out;
}
const reached = (l, s) => l.stage === s || (s === 'booked' && l.stage === 'done') || (l.history || []).some(h => h.stage === s || (s === 'booked' && h.stage === 'done'));
function renderAnalytics(){
  const [a, b] = range();
  const L = LEADS.filter(l => l.created >= a.getTime() && l.created < b.getTime());
  const months = period === 'all' ? Object.keys(SPEND) : monthsIn([a, b]);
  const spendBy = {}; let spend = 0;
  months.forEach(m => Object.entries(SPEND[m] || {}).forEach(([ch, v]) => { spendBy[ch] = (spendBy[ch] || 0) + v; spend += v; }));
  const booked = L.filter(l => reached(l, 'booked')).length, done = L.filter(l => reached(l, 'done')).length;
  const P = [['month','ეს თვე'],['prev','წინა თვე'],['q','3 თვე'],['all','სულ']];
  const chans = Object.keys(CHANNELS).map(ch => {
    const x = L.filter(l => (l.channel || 'other') === ch);
    return {ch, n: x.length, b: x.filter(l => reached(l, 'booked')).length, d: x.filter(l => reached(l, 'done')).length, s: spendBy[ch] || 0};
  }).filter(r => r.n || r.s).sort((p, q) => q.n - p.n);
  const maxN = Math.max(1, ...chans.map(r => r.n));
  const fun = [['ლიდი', L.length], ['დაიჯავშნა', booked], ['ჩაიტარა', done]];
  $('#haBody').innerHTML = `
    <div class="periods" role="group" aria-label="პერიოდი">${P.map(([k, t]) => `<button type="button" class="chip" data-per="${k}" aria-pressed="${period === k}">${t}</button>`).join('')}</div>
    <div class="kpis">
      <div class="kpi"><small>ლიდები</small><b>${L.length}</b><span>ახალი მოთხოვნა</span></div>
      <div class="kpi"><small>დაიჯავშნა</small><b>${booked}</b><span>${pct(booked, L.length)} ლიდებიდან</span></div>
      <div class="kpi"><small>ჩაიტარა პროცედურა</small><b>${done}</b><span>${pct(done, L.length)} ლიდებიდან</span></div>
      <div class="kpi"><small>ერთი ლიდი</small><b>${spend && L.length ? money(spend / L.length) : '—'}</b><span>${spend ? 'რეკლამა: ' + money(spend) : 'ხარჯი ჯერ არ არის შეყვანილი'}</span></div>
    </div>
    <div class="card"><h4>ლიდიდან პროცედურამდე</h4><p class="sub">რამდენი გადავიდა შემდეგ ეტაპზე</p>
      <div class="funnel">${fun.map(([t, v]) => `<div class="fr" title="${t}: ${v}"><span>${t}</span><span class="bar"><i style="width:${L.length ? v / L.length * 100 : 0}%"></i></span><span class="v">${v} <small>${t === 'ლიდი' ? '' : pct(v, L.length)}</small></span></div>`).join('')}</div></div>
    <div class="card"><h4>საიდან მოვიდნენ</h4><p class="sub">ლიდები, ჩაწერა და ფასი არხების მიხედვით</p>
      ${chans.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>არხი</th><th>ლიდები</th><th class="n">დაიჯავშნა</th><th class="n">ჩაიტარა</th><th class="n">ხარჯი</th><th class="n">1 ლიდი</th></tr></thead><tbody>
      ${chans.map(r => `<tr><td>${esc(CHANNELS[r.ch])}</td><td><div class="cb" title="${esc(CHANNELS[r.ch])}: ${r.n} ლიდი"><span class="bar"><i style="width:${r.n / maxN * 100}%"></i></span>${r.n}</div></td><td class="n">${r.b}</td><td class="n">${r.d}</td><td class="n">${r.s ? money(r.s) : '—'}</td><td class="n">${r.s && r.n ? money(r.s / r.n) : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">ამ პერიოდში ლიდი ჯერ არ არის.</div>'}</div>
    <p class="hnote">„დაიჯავშნა“ და „ჩაიტარა“ ითვლის ამ პერიოდში მოსულ ლიდებს, რომლებიც ამ ეტაპამდე მივიდნენ. ხარჯს თვეების მიხედვით შეიყვანს Likedent-ის მარკეტინგის გუნდი.</p>`;
}
$('#ha').addEventListener('click', e => { const p = e.target.closest('[data-per]'); if(p){ period = p.dataset.per; renderAnalytics(); } });

/* ---------- boot ---------- */
async function boot(){
  try{ CFGH = await loadConfig(); }catch(e){ return; }
  if(DEMO){ TABS = {content:true, patients:true, analytics:true}; setupNav(); return; }
  if(!CFGH.api) return;
  try{
    const r = await api.post(CFGH, {action:'hubPublic'});
    TABS = Object.assign({content:true, patients:false, analytics:false}, (r.settings || {}).tabs || {});
  }catch(e){ return; }   // older script without the hub: plain Instagram preview
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
      mk(4,'ლევანი','591 00 11 22','ღიმილის გალამაზება','instagram','booked', 2 * D, 'ჩაწერილია 8 ნოე, 15:00'),
      mk(5,'თამარ','555 66 77 88','ბავშვისთვის','google','booked', 3 * D),
      mk(6,'ნიკა','558 44 55 66','კბილი ან ღრძილი მაწუხებს','website','done', 6 * D),
      mk(7,'ეკა','593 12 12 12','კონსულტაცია','facebook','done', 9 * D),
      mk(8,'დავითი','571 98 76 54','კონსულტაცია','facebook','lost', 12 * D, 'არ პასუხობს.'),
      mk(9,'სალომე','595 33 22 11','წმენდა და შემოწმება','sms','done', 35 * D),
      mk(10,'ირაკლი','592 45 45 45','კბილის აღდგენა ან ჩანაცვლება','google','booked', 40 * D),
    ];
  }
  const d = new Date(), m = k => `${d.getFullYear()}-${String(d.getMonth() + 1 - k).padStart(2,'0')}`;
  const res = () => ({role: 'clinic', leads: JSON.parse(JSON.stringify(DEMO_LEADS)), settings: {spend: {[m(0)]: {facebook: 240, google: 120, sms: 35}, [m(1)]: {facebook: 200, google: 100}}}});
  const L = id => DEMO_LEADS.find(l => l.id === id);
  if(body.action === 'hubLeadAdd'){ DEMO_LEADS.unshift({id: 'D' + Date.now(), created: Date.now(), ...body.lead, source: '', stage: 'new', updated: Date.now(), history: [{t: Date.now(), stage: 'new', by: body.by}]}); }
  if(body.action === 'hubLeadMove'){ const l = L(body.id); l.stage = body.stage; l.history.push({t: Date.now(), stage: body.stage, by: body.by}); }
  if(body.action === 'hubLeadEdit'){ Object.assign(L(body.id), body.lead); }
  return new Promise(r => setTimeout(() => r(res()), 250));
}
})();
