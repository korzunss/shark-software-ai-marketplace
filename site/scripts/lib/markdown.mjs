// Markdown → HTML for content from plugins (SITE-SPEC §9.4). Rendering happens
// at build time and the result goes into the page as-is, so everything that
// could run code or load third-party content is neutralised here:
//   - raw HTML is escaped, never passed through;
//   - links keep only http(s), mailto, #anchors and relative paths; relative
//     ones are rewritten to the file on GitHub;
//   - images become links (the CSP allows no third-party images anyway).
import { Marked } from 'marked';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const SAFE_SCHEME = /^(https?:|mailto:)/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const stripFrontmatter = (text) => text.replace(FRONTMATTER, '');

// `baseUrl` is the GitHub "blob" URL of the directory holding the file.
function safeHref(href, baseUrl) {
  const h = (href || '').trim();
  if (h.startsWith('#') || SAFE_SCHEME.test(h)) return h;
  if (ANY_SCHEME.test(h) || h.startsWith('//')) return null; // javascript:, data:, protocol-relative…
  return baseUrl ? new URL(h, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').href : null;
}

export function renderMarkdown(text, { baseUrl } = {}) {
  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    renderer: {
      html({ text: raw }) {
        return escapeHtml(raw);
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const url = safeHref(href, baseUrl);
        if (!url) return inner;
        const external = !url.startsWith('#');
        return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noreferrer"' : ''}>${inner}</a>`;
      },
      image({ href, text: alt }) {
        const url = safeHref(href, baseUrl);
        const label = escapeHtml(alt || (href || '').split('/').pop() || '?');
        return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">[${label}]</a>` : `[${label}]`;
      },
    },
  });
  return marked.parse(stripFrontmatter(text));
}

// Plain text for the search index: no markup, collapsed whitespace, capped.
export function plainText(text, limit = 4096) {
  return stripFrontmatter(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*(?:#{1,6}|>|[-+*]|\d+\.)\s+/gm, '')
    .replace(/[*`|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

export function headings(text) {
  return [...stripFrontmatter(text).matchAll(/^#{1,3}\s+(.+?)\s*#*$/gm)].map((m) => m[1]);
}
