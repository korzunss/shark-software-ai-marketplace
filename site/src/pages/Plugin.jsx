import { COMPONENT_KINDS } from '../config.js';
import { usePluginContent } from '../data/catalog.js';
import { t } from '../i18n/index.js';
import { href, paths } from '../lib/router.js';
import Html from '../components/Html.jsx';
import InstallBar from '../components/InstallBar.jsx';
import RiskBadges from '../components/RiskBadges.jsx';
import NotFound from './NotFound.jsx';

export default function Plugin({ catalog, name, backPath }) {
  const { entries, plugins } = catalog;
  const p = plugins[name];
  const content = usePluginContent(name);
  if (!p) return <NotFound />;

  const groups = COMPONENT_KINDS
    .map((kind) => ({ kind, items: entries.filter((e) => e.plugin === p.name && e.kind === kind) }))
    .filter((g) => g.items.length);
  const meta = [
    p.author,
    p.owners.length && p.owners.join(' '),
    p.updated && t('plugin.updated', { date: p.updated }),
  ].filter(Boolean);

  return (
    <main className="detail">
      <a className="back" href={href(backPath)}>{t('plugin.back')}</a>
      <div className="detail-head">
        <div className="detail-icon" aria-hidden="true">◆</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title-row">
            <h1 className="page-h1">{p.displayName}</h1>
            {p.rawVersion && <span className="ver-badge">v{p.rawVersion}</span>}
            {p.category && <span className="compat-badge">{p.category}</span>}
          </div>
          <p className="detail-desc">{p.description}</p>
          <div className="detail-meta">{meta.join(' · ')}</div>
          <RiskBadges risk={p.risk} />
        </div>
      </div>

      <InstallBar command={p.installText} copyId={'p:' + p.name}>
        <a className="btn ghost" href={p.githubUrl} target="_blank" rel="noreferrer">{t('plugin.github')}</a>
      </InstallBar>

      {p.external && <div className="note" style={{ margin: '0 0 30px' }}>{t('plugin.external')}</div>}

      {groups.length > 0 && (
        <section className="section">
          <h2 className="section-title">{t('plugin.components')}</h2>
          <div className="comp-groups">
            {groups.map((g) => (
              <div key={g.kind} data-kind={g.kind}>
                <div className="comp-head">
                  <span className="dot" />
                  <span className="comp-label">{t(`kinds.${g.kind}`)}</span>
                  <span className="count" style={{ fontSize: 11 }}>{g.items.length}</span>
                </div>
                <div className="comp-grid">
                  {g.items.map((it) => (
                    <a key={it.id} className="comp tile" href={href(paths.entry(it))}>
                      <div className="comp-top">
                        <span className="comp-name">{it.displayName}</span>
                        <span className="invocation ellipsis">{it.invocation}</span>
                      </div>
                      <div className="comp-desc ellipsis">{it.description}</div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {p.deps.length > 0 && (
        <section className="section">
          <h2 className="section-title">{t('plugin.dependencies')}</h2>
          <div className="deps">
            {p.deps.map((d) => (plugins[d]
              ? <a key={d} className="dep tile" href={href(paths.plugin(d))}>{d} ↗</a>
              : <span key={d} className="dep tile">{d}</span>))}
          </div>
        </section>
      )}

      {(content === null || content.readmeHtml) && (
        <section className="section">
          <h2 className="section-title">{t('plugin.readme')}</h2>
          <Html className="panel prose" html={content?.readmeHtml} />
        </section>
      )}

      {p.changelog.length > 0 && (
        <section>
          <h2 className="section-title">{t('plugin.changelog')}</h2>
          <div className="stack" style={{ gap: 6 }}>
            {p.changelog.map((c) => (
              <div key={c.version} className="changelog-item tile">
                <span className="v">v{c.version}</span>{c.date && <span className="d">{c.date}</span>}
                {content
                  ? <Html className="s prose" html={content.changelog[c.version]} />
                  : <div className="s">{c.summary}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
