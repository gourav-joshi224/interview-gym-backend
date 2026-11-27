/* Verifies every curated study link still resolves. Run with: npm run build && npm run check:links */
const { SUBTOPIC_RESOURCES } = require('../dist/modules/evaluation/resources');
const { TOPICS } = require('../dist/modules/curriculum/curriculum.data');

const links = new Map();
for (const [id, list] of Object.entries(SUBTOPIC_RESOURCES)) for (const link of list) links.set(link.url, [...(links.get(link.url) ?? []), id]);
const known = new Set(TOPICS.flatMap((t) => t.subtopics.map((s) => s.id)));
const missing = [...known].filter((id) => !SUBTOPIC_RESOURCES[id]);
const stray = Object.keys(SUBTOPIC_RESOURCES).filter((id) => !known.has(id));

const UA = 'Mozilla/5.0 (compatible; interview-gym-link-check)';
async function check(url) {
  const base = url.split('#')[0];
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(base, { method, redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return { ok: true, status: res.status };
      if (method === 'GET') return { ok: false, status: res.status };
    } catch (e) {
      if (method === 'GET') return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : e.message };
    }
  }
}

(async () => {
  const entries = [...links.keys()];
  const results = [];
  const queue = [...entries];
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) { const url = queue.shift(); results.push([url, await check(url)]); } }));
  const bad = results.filter(([, r]) => !r.ok);
  console.log(`${entries.length} unique links, ${results.length - bad.length} reachable, ${bad.length} failing`);
  for (const [url, r] of bad) console.log(`  FAIL ${r.status}  ${url}   (${links.get(url).join(', ')})`);
  if (missing.length) console.log('subtopics without links:', missing.join(', '));
  if (stray.length) console.log('links for unknown subtopics:', stray.join(', '));
  process.exit(bad.length || missing.length || stray.length ? 1 : 0);
})();
