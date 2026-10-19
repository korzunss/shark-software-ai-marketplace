// Substring scoring from the design prototype. Every query token must hit at
// least one field; the MiniSearch index from SITE-SPEC §6 replaces this later.
export function score(entry, query) {
  if (!query) return 1;
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const name = (entry.name + ' ' + entry.displayName).toLowerCase();
  const keywords = entry.keywords.join(' ').toLowerCase();
  const desc = entry.description.toLowerCase();
  const body = (entry.bodyText || '').toLowerCase();
  let total = 0;
  for (const tok of tokens) {
    let hit = 0;
    if (name.includes(tok)) hit += 5;
    if (name.startsWith(tok)) hit += 3;
    if (keywords.includes(tok)) hit += 3;
    if (desc.includes(tok)) hit += 2;
    if (body.includes(tok)) hit += 1;
    if (hit === 0) return 0;
    total += hit;
  }
  return total;
}

export function search(entries, query, { kinds = [], keywords = [], author = null, sort = 'relevance' } = {}) {
  let list = entries.map((e) => ({ e, s: score(e, query) })).filter((x) => x.s > 0);
  if (kinds.length) list = list.filter((x) => kinds.includes(x.e.kind));
  if (keywords.length) list = list.filter((x) => keywords.some((k) => x.e.keywords.includes(k)));
  if (author) list = list.filter((x) => x.e.author === author);
  list.sort((a, b) => {
    if (sort === 'name') return a.e.displayName.localeCompare(b.e.displayName);
    if (sort === 'updated') return (b.e.updated || '').localeCompare(a.e.updated || '');
    return b.s - a.s || a.e.displayName.localeCompare(b.e.displayName);
  });
  return list.map((x) => x.e);
}
