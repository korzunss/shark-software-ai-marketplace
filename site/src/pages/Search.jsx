import { KINDS } from '../config.js';
import { keywordCounts } from '../data/catalog.js';
import { t, tp } from '../i18n/index.js';
import { search as runSearch } from '../lib/search.js';
import ResultCard from '../components/ResultCard.jsx';

const toggle = (list, value) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

export default function Search({ catalog, search }) {
  const { entries } = catalog;
  const { query, facets, sort, setSort, setFacets } = search;
  const results = runSearch(entries, query, { ...facets, sort });
  const countBy = (k) => entries.filter((e) => e.kind === k).length;
  const keywords = Object.keys(keywordCounts(entries)).sort();
  const authors = [...new Set(entries.map((e) => e.author))];

  return (
    <main className="search-page">
      <aside className="facets" aria-label={t('search.filters')}>
        <div className="facet-head">
          <span>{t('search.filters')}</span>
          <button className="link-btn" onClick={search.clear}>{t('search.reset')}</button>
        </div>

        <div className="facet-title">{t('search.kind')}</div>
        <div className="facet-list kinds-facet">
          {KINDS.map((k) => (
            <button
              key={k}
              className="facet"
              data-kind={k}
              aria-pressed={facets.kinds.includes(k)}
              onClick={() => setFacets((f) => ({ ...f, kinds: toggle(f.kinds, k) }))}
            >
              <span className="dot" />
              <span className="label">{t(`kinds.${k}`)}</span>
              <span className="count">{countBy(k)}</span>
            </button>
          ))}
        </div>

        <div className="facet-title">{t('search.keywords')}</div>
        <div className="kw-list">
          {keywords.map((k) => (
            <button
              key={k}
              className="kw"
              aria-pressed={facets.keywords.includes(k)}
              onClick={() => setFacets((f) => ({ ...f, keywords: toggle(f.keywords, k) }))}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="facet-title">{t('search.author')}</div>
        <div className="facet-list">
          {authors.map((a) => (
            <button
              key={a}
              className="facet"
              aria-pressed={facets.author === a}
              onClick={() => setFacets((f) => ({ ...f, author: f.author === a ? null : a }))}
            >
              <span className="label ellipsis" style={{ textTransform: 'none' }}>{a}</span>
              <span className="count">{entries.filter((e) => e.author === a).length}</span>
            </button>
          ))}
        </div>
      </aside>

      <section>
        <div className="results-head">
          <div>
            <h1>{query ? t('search.resultsFor', { query }) : t('search.browse')}</h1>
            <div className="sub" aria-live="polite">{tp('search.count', results.length)}</div>
          </div>
          <label className="sort">{t('search.sort')}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="relevance">{t('search.sortRelevance')}</option>
              <option value="name">{t('search.sortName')}</option>
              <option value="updated">{t('search.sortUpdated')}</option>
            </select>
          </label>
        </div>

        {results.length > 0 ? (
          <div className="grid">
            {results.map((e) => <ResultCard key={e.id} entry={e} />)}
          </div>
        ) : (
          <div className="no-results">
            <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden="true">🔍</div>
            <h3 style={{ margin: '0 0 6px' }}>{t('search.noResultsTitle')}</h3>
            <p>{t('search.noResultsText')}</p>
            <button className="btn-sm" style={{ height: 34, padding: '0 16px' }} onClick={search.clear}>{t('search.resetFilters')}</button>
          </div>
        )}
      </section>
    </main>
  );
}
