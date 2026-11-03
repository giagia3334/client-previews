/**
 * Instagram preview backend for a client's posting schedule (Google Sheet).
 * Paste into the sheet: Extensions > Apps Script, then Deploy > New deployment >
 * Web app, Execute as: Me, Who has access: Anyone. Put the /exec URL in clients/<c>/config.json ("api").
 *
 * What it does:
 *  - client comment  -> logged, written to "Client comments" column, row turns pink
 *  - client approve  -> logged, "Client status" = approved, row turns yellow
 *  - studio saveLayout (key) -> stores the grid order/pins/captions so every device sees the same
 *  - studio patch (key) -> applies single edits (pin, order, caption, remove) to the stored layout
 *  - studio resolve (key) -> marks a client's change request as done, row loses its pink colour
 *  - studio sync (key) -> creates/links rows, fills captions, uploads media to Drive, reorders rows
 */
var CONF = {
  sheetId: '',            // optional: leave empty when the script is opened from the sheet (Extensions > Apps Script)
  sheetName: 'Posts',
  headerRow: 3,
  pink: '#F6C6D8',
  yellow: '#FFE58A',
  driveFolderName: 'Posts (preview)',
  cols: {
    type: 'Type', media: 'Media', format: 'Format', platform: 'Platform', idea: 'Idea',
    details: 'Details, Instructions', caption: 'Caption', slides: 'Slides / Duration',
    status: 'Status', link: 'GDrive Link',
    postId: 'Post ID', clientComments: 'Client comments', clientStatus: 'Client status'
  }
};

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || 'state';
    if (a === 'state') return out_(Object.assign({ ok: true }, state_()));
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var b = JSON.parse(e.postData.contents || '{}');
    var res;
    if (b.action === 'comment') res = comment_(b);
    else if (b.action === 'approve') res = approve_(b);
    else if (b.action === 'saveLayout') { checkKey_(b.key); saveLayout_(b.layout); res = {}; }
    else if (b.action === 'patch') { checkKey_(b.key); patch_(b.ops || [], b.base); res = {}; }
    else if (b.action === 'resolve') { checkKey_(b.key); res = resolve_(b); }
    else if (b.action === 'sync') { checkKey_(b.key); res = sync_(b); }
    else if (b.action === 'checkKey') { checkKey_(b.key); res = {}; }
    else throw new Error('unknown action');
    return out_(Object.assign({ ok: true, state: state_() }, res));
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally { lock.releaseLock(); }
}

/* ---------- helpers ---------- */
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss_() { return CONF.sheetId ? SpreadsheetApp.openById(CONF.sheetId) : SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_() { return ss_().getSheetByName(CONF.sheetName) || ss_().getSheets()[0]; }
function aux_(name, header) {
  var s = ss_().getSheetByName(name);
  if (!s) { s = ss_().insertSheet(name); if (header) s.appendRow(header); s.hideSheet(); }
  return s;
}
function checkKey_(key) {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('KEY');
  if (!key || String(key).length < 6) throw new Error('key required');
  if (!k) { p.setProperty('KEY', String(key)); return; } // first key used becomes the key
  if (k !== String(key)) throw new Error('wrong key');
}
/* map header name -> column index (1-based); adds missing preview columns at the end */
function cols_() {
  var sh = sheet_();
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(CONF.headerRow, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var map = {};
  head.forEach(function (h, i) { if (h) map[h] = i + 1; });
  [CONF.cols.postId, CONF.cols.clientComments, CONF.cols.clientStatus].forEach(function (h) {
    if (!map[h]) {
      var c = head.filter(String).length + 1;
      while (head[c - 1]) c++;
      sh.getRange(CONF.headerRow, c).setValue(h).setFontWeight('bold');
      head[c - 1] = h; map[h] = c;
    }
  });
  var r = {};
  Object.keys(CONF.cols).forEach(function (k) { r[k] = map[CONF.cols[k]] || 0; });
  r.last = Math.max.apply(null, Object.keys(r).map(function (k) { return r[k]; }));
  return r;
}
function dataRows_() {
  var sh = sheet_();
  var first = CONF.headerRow + 1, last = sh.getLastRow();
  if (last < first) return { first: first, values: [] };
  var c = cols_();
  return { first: first, values: sh.getRange(first, 1, last - first + 1, c.last).getValues(), c: c };
}
function findRow_(postId) {
  if (!postId) return 0;
  var d = dataRows_(); if (!d.values.length) return 0;
  var c = d.c;
  for (var i = 0; i < d.values.length; i++) if (String(d.values[i][c.postId - 1]) === String(postId)) return d.first + i;
  return 0;
}
function paint_(row, color) {
  var c = cols_();
  sheet_().getRange(row, 1, 1, c.last).setBackground(color);
}

/* ---------- state ---------- */
function layout_() {
  var s = ss_().getSheetByName('_preview');
  if (!s) return null;
  var v = s.getRange(1, 1).getValue();
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function saveLayout_(layout) {
  var s = aux_('_preview');
  s.getRange(1, 1).setValue(JSON.stringify(layout || {}));
  s.getRange(1, 2).setValue(new Date());
}
/* apply studio edits one by one on the stored layout, inside the script lock,
   so two people editing at the same time never overwrite each other */
function patch_(ops, base) {
  var l = layout_() || base || { order: [], pinned: [], removed: [] };
  ops.forEach(function (o) {
    if (o.t === 'order') l.order = o.order;
    else if (o.t === 'pin') { var p = (l.pinned || []).filter(function (x) { return x !== o.id; }); if (o.on) p.push(o.id); l.pinned = p; }
    else if (o.t === 'remove') { var r = (l.removed || []).filter(function (x) { return x !== o.id; }); r.push(o.id); l.removed = r; }
    else if (o.t === 'restore') l.removed = (l.removed || []).filter(function (x) { return x !== o.id; });
    else if (o.t === 'caption') { l.captions = l.captions || {}; l.captions[o.id] = o.text; }
  });
  l.updated = new Date().getTime();
  saveLayout_(l);
}
function state_() {
  var log = aux_('_comments', ['ts', 'post', 'name', 'type', 'text']);
  var n = log.getLastRow();
  var rows = n > 1 ? log.getRange(2, 1, n - 1, 5).getValues() : [];
  var comments = [], status = {};
  rows.forEach(function (r) {
    var ts = r[0] instanceof Date ? r[0].getTime() : Number(r[0]);
    var post = String(r[1]), type = String(r[3]);
    if (type === 'resolved') {
      // the team marked a requested change as done (text = the comment's ts, empty = all of that post)
      var target = Number(r[4]) || 0;
      comments.forEach(function (c) { if (c.post === post && c.type === 'comment' && (!target || c.ts === target)) c.resolved = true; });
      var open = comments.some(function (c) { return c.post === post && c.type === 'comment' && !c.resolved; });
      if (status[post] === 'changes' && !open) delete status[post];
      return;
    }
    comments.push({ ts: ts, post: post, name: String(r[2]), type: type, text: String(r[4]) });
    status[post] = type === 'approve' ? 'approved' : 'changes';
  });
  return { layout: layout_(), comments: comments, status: status };
}

/* ---------- client actions ---------- */
function clean_(s, max) { return String(s || '').replace(/[\u0000-\u0008]/g, '').trim().slice(0, max); }
function comment_(b) {
  var post = clean_(b.post, 60), name = clean_(b.name, 40) || 'კლიენტი', text = clean_(b.text, 2000);
  if (!post || !text) throw new Error('empty');
  aux_('_comments', ['ts', 'post', 'name', 'type', 'text']).appendRow([new Date(), post, name, 'comment', text]);
  var row = findRow_(post);
  if (row) {
    var c = cols_(), sh = sheet_();
    var cell = sh.getRange(row, c.clientComments);
    var prev = String(cell.getValue() || '');
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM HH:mm');
    cell.setValue((prev ? prev + '\n' : '') + name + ' (' + stamp + '): ' + text).setWrap(true);
    sh.getRange(row, c.clientStatus).setValue('შესაცვლელია');
    paint_(row, CONF.pink);
  }
  return { row: row };
}
function approve_(b) {
  var post = clean_(b.post, 60), name = clean_(b.name, 40) || 'კლიენტი';
  if (!post) throw new Error('empty');
  aux_('_comments', ['ts', 'post', 'name', 'type', 'text']).appendRow([new Date(), post, name, 'approve', '']);
  var row = findRow_(post);
  if (row) {
    var c = cols_();
    sheet_().getRange(row, c.clientStatus).setValue('დამტკიცებულია (' + name + ')');
    paint_(row, CONF.yellow);
  }
  return { row: row };
}

/* team marks a client's change request as done */
function resolve_(b) {
  var post = clean_(b.post, 60);
  if (!post) throw new Error('empty');
  aux_('_comments', ['ts', 'post', 'name', 'type', 'text']).appendRow([new Date(), post, 'გუნდი', 'resolved', String(b.ts || '')]);
  var row = findRow_(post);
  if (row && !state_().status[post]) {
    var c = cols_();
    sheet_().getRange(row, c.clientStatus).setValue('გასწორდა');
    sheet_().getRange(row, 1, 1, c.last).setBackground(null);
  }
  return { row: row };
}

/* ---------- studio sync ---------- */
function driveRoot_() {
  var parent = DriveApp.getFileById(ss_().getId()).getParents().next();
  var it = parent.getFoldersByName(CONF.driveFolderName);
  return it.hasNext() ? it.next() : parent.createFolder(CONF.driveFolderName);
}
function upload_(p, baseUrl) {
  if (p.drive) return p.drive;
  if (!baseUrl || !p.files || !p.files.length) return '';
  var root = driveRoot_();
  var name = p.title || p.id;
  var it = root.getFoldersByName(name);
  var f = it.hasNext() ? it.next() : root.createFolder(name);
  p.files.forEach(function (file, i) {
    var fname = (i + 1) + ' სლაიდი - ' + file;
    if (f.getFilesByName(fname).hasNext()) return;
    var blob = UrlFetchApp.fetch(baseUrl + file).getBlob().setName(fname);
    f.createFile(blob);
  });
  return f.getUrl();
}
function sync_(b) {
  var layout = b.layout || {};
  saveLayout_(layout);
  var posts = b.posts || [];            // studio grid order, top (newest) first
  var sh = sheet_(), c = cols_();
  var created = 0, linked = 0, uploaded = 0;

  // 1) make sure every studio post has a row with its Post ID
  posts.forEach(function (p) {
    if (p.posted) return;
    var row = findRow_(p.id);
    if (!row && p.match) {
      var d = dataRows_();
      for (var i = 0; i < d.values.length; i++) {
        var idea = String(d.values[i][c.idea - 1] || ''), det = c.details ? String(d.values[i][c.details - 1] || '') : '';
        var has = String(d.values[i][c.postId - 1] || '');
        if (!has && (idea.indexOf(p.match) >= 0 || det.indexOf(p.match) >= 0)) { row = d.first + i; break; }
      }
      if (row) { sh.getRange(row, c.postId).setValue(p.id); linked++; }
    }
    if (!row) {
      row = Math.max(sh.getLastRow() + 1, CONF.headerRow + 1);
      var isVideo = !!p.video, isCar = !isVideo && p.count > 1;
      if (c.type) sh.getRange(row, c.type).setValue(p.postType || 'Informational');
      if (c.media) sh.getRange(row, c.media).setValue(isVideo ? 'Video' : 'Photo');
      if (c.format) sh.getRange(row, c.format).setValue(isVideo ? 'Reel' : (isCar ? 'Carousel' : 'Single Image'));
      if (c.platform) sh.getRange(row, c.platform).setValue('Instagram + Facebook');
      if (c.idea) sh.getRange(row, c.idea).setValue(p.title || p.id);
      if (c.status) sh.getRange(row, c.status).setValue('Needs Approval');
      sh.getRange(row, c.postId).setValue(p.id);
      created++;
    }
    if (p.video) {
      if (c.media) sh.getRange(row, c.media).setValue('Video');
      if (c.format) sh.getRange(row, c.format).setValue('Reel');
    } else if (p.count > 1 && c.format) sh.getRange(row, c.format).setValue('Carousel');
    if (c.caption && p.caption != null) sh.getRange(row, c.caption).setValue(p.caption);
    if (c.slides && p.count) sh.getRange(row, c.slides).setValue(p.count);
    if (c.link && !String(sh.getRange(row, c.link).getValue() || '').trim()) {
      try { var url = upload_(p, b.baseUrl); if (url) { sh.getRange(row, c.link).setValue(url); uploaded++; } } catch (err) { /* keep going */ }
    }
  });

  // 2) reorder: posted rows first (as they are), then studio posts in posting order, then the rest
  var d = dataRows_();
  var n = d.values.length;
  while (n > 0 && !d.values[n - 1].some(function (v) { return String(v).trim() !== ''; })) n--;
  var keys = d.values.slice(0, n).map(function (r, i) { return { id: String(r[c.postId - 1] || ''), posted: !!c.status && String(r[c.status - 1]) === 'Posted', idx: i }; });
  var planned = posts.filter(function (p) { return !p.posted; }).map(function (p) { return p.id; }).reverse(); // oldest first = posting order
  var postedRows = keys.filter(function (k) { return k.posted; });
  var plannedRows = planned.map(function (id) { return keys.filter(function (k) { return k.id === id && !k.posted; })[0]; }).filter(Boolean);
  var used = {}; postedRows.concat(plannedRows).forEach(function (k) { used[k.idx] = 1; });
  var rest = keys.filter(function (k) { return !used[k.idx]; });
  var target = postedRows.concat(plannedRows, rest).map(function (k) { return k.idx; });
  var pos = keys.map(function (k) { return k.idx; }); // pos[j] = original row index now sitting at row first+j
  var moved = 0;
  for (var t = 0; t < target.length; t++) {
    var cur = pos.indexOf(target[t]);
    if (cur !== t) {
      sh.moveRows(sh.getRange((d.first + cur) + ':' + (d.first + cur)), d.first + t);
      pos.splice(t, 0, pos.splice(cur, 1)[0]); moved++;
    }
  }
  return { created: created, linked: linked, uploaded: uploaded, moved: moved };
}
