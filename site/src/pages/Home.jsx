import { KINDS, REPO_URL } from '../config.js';
import { keywordCounts, releases } from '../data/catalog.js';
import { t, tp } from '../i18n/index.js';
import { href, paths } from '../lib/router.js';

const STAT_KINDS = ['plugin', 'skill', 'agent', 'command', 'mcp'];

export default function Home({ catalog, search }) {
  const { entries, plugins } = catalog;
  const countBy = (k) => entries.filter((e) => e.kind === k).length;
  const kwCount = keywordCounts(entries);
  const topKeywords = Object.keys(kwCount).sort((a, b) => kwCount[b] - kwCount[a]).slice(0, 7);
  const latest = releases(plugins).slice(0, 4);

  return (
    <main className="home">
      <section className="hero">
        <div className="eyebrow">{t('home.eyebrow')}</div>
        <h1>{t('home.titleLine1')}<br />{t('home.titleLine2')}</h1>
        <p>{t('home.lead')}</p>
        <div className="hero-search">
          <span className="icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label={t('header.searchLabel')}
            value={search.query}
            onChange={(e) => search.onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search.submit(); }}
            placeholder={t('home.searchPlaceholder')}
          />
        </div>
        <div className="chips">
          {topKeywords.map((k) => (
            <button key={k} className="chip" onClick={() => search.browse({ keywords: [k] })}>#{k}</button>
          ))}
        </div>
        <a className="hero-guide" href={href(paths.gettingStarted())}>{t('home.guideLink')}</a>
      </section>

      {entries.length === 0 ? (
        <section className="empty-catalog">
          <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">📦</div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>{t('home.emptyTitle')}</h2>
          <p style={{ color: 'var(--text-dim)', margin: '0 auto 20px', maxWidth: 420 }}>{t('home.emptyText')}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a className="btn md" href={href(paths.gettingStarted())}>{t('home.emptyStart')}</a>
            <a className="btn ghost md" href={REPO_URL + '/blob/main/CONTRIBUTING.md'} target="_blank" rel="noreferrer">{t('home.emptyContributing')}</a>
          </div>
        </section>
      ) : (
        <>
          <section className="stats">
            {STAT_KINDS.map((kind) => (
              <button key={kind} className="stat tile" onClick={() => search.browse({ kinds: [kind] })}>
                <div className="stat-count">{countBy(kind)}</div>
                <div className="stat-label">{tp(`home.stats.${kind}`, countBy(kind))}</div>
              </button>
            ))}
          </section>

          <section style={{ marginBottom: 44 }}>
            <div className="row-head">
              <h2>{t('home.whatsNew')}</h2>
              <a href={href(paths.whatsNew())}>{t('home.allReleases')}</a>
            </div>
            <div className="stack">
              {latest.map((r) => (
                <a key={r.plugin + r.version} className="release-row tile" href={href(paths.plugin(r.plugin))}>
                  <span className="ver-badge">v{r.version}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                    <div className="ellipsis" style={{ fontSize: 13, color: 'var(--text-dim)' }}>{r.summary}</div>
                  </div>
                  <span className="release-date">{r.date}</span>
                </a>
              ))}
            </div>
          </section>

          <section>
            <h2 className="h2-sm" style={{ marginBottom: 14 }}>{t('home.browseByKind')}</h2>
            <div className="kinds">
              {KINDS.map((k) => (
                <button key={k} className="kind-btn tile" data-kind={k} onClick={() => search.browse({ kinds: [k] })}>
                  <span className="dot lg" />
                  <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{t(`kinds.${k}`)}</span>
                  <span className="count">{countBy(k)}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
