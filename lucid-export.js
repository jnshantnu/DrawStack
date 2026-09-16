// Lucidchart bulk export — paste this whole block into the DevTools Console
// of a tab that is logged in at https://lucid.app and press Enter.
// It downloads lucid-export.json (your folder tree + every diagram's data).
(async () => {
  const API = 'https://documents.app.lucidchart.com';
  const get = async (url) => {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  const clean = (s) => String(s || 'Untitled').replace(/[\\/]/g, '-').trim() || 'Untitled';

  let userId = (document.cookie.match(/(?:^|;\s*)userId=(\d+)/) || [])[1];
  if (!userId) {
    const html = document.documentElement.innerHTML;
    for (const p of [
      /ga\('set', '&uid', (\d+)\)/,
      /_kmProxySetFields\['user_id'\] = '(\d+)'/,
      /window\.lucidAnalytics = \{\s+userId:\s(\d+),/,
      /https:\/\/users\.lucidchart\.com\/users\/(\d+)\//,
      /"userId"\s*:\s*"?(\d+)/,
    ]) { const m = html.match(p); if (m) { userId = m[1]; break; } }
  }
  if (!userId) userId = prompt('Could not detect your Lucid user id. Paste it (a number):');
  if (!userId) return;
  console.log('Lucid user id:', userId);

  const list = await get(`${API}/users/${userId}/documentList?products=chart`);
  const docs = {};
  const skippedNotMine = [];
  for (const d of list.documents || []) {
    const doc = d.Document;
    // Only diagrams YOU created -- documentList also returns every doc your
    // account can merely access (shared/org/team documents), which is not
    // what "move my files" means here.
    if (String(doc.creator_id) === String(userId)) docs[doc.id] = doc;
    else skippedNotMine.push(doc.title);
  }
  console.log(`${Object.keys(docs).length} documents created by you; skipping ${skippedNotMine.length} you can access but didn't create.`);
  const entries = (list.folderEntries || []).map((e) => e.FolderEntry);
  const folders = {};
  for (const f of entries) if (f.name) folders[f.id] = f;

  const folderPath = (parentId) => {
    const parts = []; const seen = new Set(); let p = parentId;
    while (p && folders[p] && !seen.has(p)) { seen.add(p); parts.unshift(clean(folders[p].name)); p = folders[p].parent_id; }
    return parts;
  };

  const items = []; const used = {}; const placed = new Set();
  const add = (doc, dirParts) => {
    const base = [...dirParts, clean(doc.title)].join('/');
    let path = base, n = 1;
    while (used[path]) path = base + '-' + (n++);
    used[path] = true; placed.add(doc.id);
    items.push({ id: doc.id, title: doc.title, pages: doc.pages, path });
  };
  for (const f of entries) {
    if (f.name || !f.document_id || !docs[f.document_id]) continue;
    add(docs[f.document_id], folderPath(f.parent_id));
  }
  for (const id in docs) if (!placed.has(id)) add(docs[id], []);

  console.log(`${items.length} diagrams found; fetching each one...`);
  const out = []; const failed = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try { it.state = await get(`${API}/documents/${it.id}/state`); out.push(it); }
    catch (e) { failed.push(`${it.path} (${e.message})`); }
    console.log(`${i + 1}/${items.length}  ${it.path}`);
  }

  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), userId, failed, docs: out })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'lucid-export.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 1000);
  console.log(`Done: ${out.length} exported, ${failed.length} failed.`, failed);
})();
