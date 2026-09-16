// Diagnostic — run this FIRST in the lucid.app console (before the real export).
// It does not download anything. It just prints what ownership/permission info
// is available per-document, so we can filter to "mine only" correctly.
(async () => {
  const API = 'https://documents.app.lucidchart.com';
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
  console.log('Detected userId:', userId);

  const r = await fetch(`${API}/users/${userId}/documentList?products=chart`, { credentials: 'include' });
  const list = await r.json();
  const docs = (list.documents || []).map(d => d.Document);
  console.log('Total documents visible to this account:', docs.length);
  console.log('Full first document object (inspect for owner/creator/role fields):');
  console.log(JSON.stringify(docs[0], null, 2));

  // Tally every field that looks like it could indicate ownership, so we can
  // see which one actually separates "mine" from "not mine" without printing
  // every title.
  const candidateKeys = Object.keys(docs[0] || {}).filter(k =>
    /owner|creator|author|role|permission|access|editable|can_edit|canedit/i.test(k)
  );
  console.log('Candidate ownership-related keys found:', candidateKeys);
  for (const k of candidateKeys) {
    const tally = {};
    for (const d of docs) { const v = JSON.stringify(d[k]); tally[v] = (tally[v] || 0) + 1; }
    console.log(`Value counts for "${k}":`, tally);
  }
  console.log('userId to compare owner/creator fields against:', userId);
})();
