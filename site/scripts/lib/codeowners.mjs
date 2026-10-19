// Owners of a directory from .github/CODEOWNERS. Like GitHub, the LAST
// matching rule wins. Only rules that match the directory itself count, so
// `**/hooks/**` does not make its owners owners of the whole plugin.

function toRegExp(pattern) {
  let p = pattern;
  const anchored = p.startsWith('/') || p.slice(0, -1).includes('/');
  p = p.replace(/^\//, '').replace(/\/$/, '');
  const body = p
    .split(/(\*\*\/|\/\*\*|\*\*|\*|\?)/)
    .map((part) => {
      switch (part) {
        case '**/': return '(?:.*/)?';
        case '/**': return '(?:/.*)?';
        case '**': return '.*';
        case '*': return '[^/]*';
        case '?': return '[^/]';
        default: return part.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      }
    })
    .join('');
  // A rule matches the path itself or anything below it.
  return new RegExp(`${anchored ? '^' : '(?:^|/)'}${body}(?:/.*)?$`);
}

export function parseCodeowners(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)#.*$/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { re: toRegExp(pattern), owners };
    });
}

export function ownersOf(rules, dir) {
  const target = dir.replace(/^\/|\/$/g, '');
  let owners = [];
  for (const rule of rules) if (rule.re.test(target)) owners = rule.owners;
  return owners;
}
