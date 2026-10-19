import { usePluginContent } from '../data/catalog.js';
import { t } from '../i18n/index.js';
import { href, paths } from '../lib/router.js';
import Html from '../components/Html.jsx';
import InstallBar from '../components/InstallBar.jsx';
import NotFound from './NotFound.jsx';

function Details({ e }) {
  const d = e.details || {};
  if (e.kind === 'hook') {
    return (
      <table className="details-table">
        <thead>
          <tr><th>{t('artifact.details.event')}</th><th>{t('artifact.details.matcher')}</th><th>{t('artifact.details.runs')}</th></tr>
        </thead>
        <tbody>
          {d.hooks.map((h, i) => (
            <tr key={i}><td>{h.event}</td><td className="mono">{h.matcher || '—'}</td><td className="mono">{h.command || h.kind}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  const rows = [
    ['transport', d.transport],
    ['command', d.command],
    ['url', d.url],
    ['envVars', d.envVars?.join(', ')],
    ['languages', d.languages?.join(', ')],
    ['model', d.model],
    ['arguments', d.argumentHint],
  ].filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <section className="section">
      <table className="details-table">
        <tbody>{rows.map(([k, v]) => <tr key={k}><th>{t(`artifact.details.${k}`)}</th><td className="mono">{v}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

export default function Artifact({ catalog, id, backPath }) {
  const { entries, plugins } = catalog;
  const e = entries.find((x) => x.id === id);
  const content = usePluginContent(e?.plugin);
  if (!e) return <NotFound />;
  const parent = plugins[e.plugin];
  const body = content?.artifacts[e.catalogId];

  return (
    <main className="detail narrow" data-kind={e.kind}>
      <nav className="crumbs" aria-label={t('artifact.breadcrumbs')}>
        <a href={href(backPath)}>{t('artifact.catalog')}</a>
        <span className="sep"> / </span>
        <a href={href(paths.plugin(e.plugin))}>{parent ? parent.displayName : e.plugin}</a>
        <span className="sep"> / {e.name}</span>
      </nav>
      <div className="title-row" style={{ marginBottom: 6 }}>
        <span className="kind-badge" style={{ padding: '3px 9px' }}>{t(`kindBadge.${e.kind}`)}</span>
        <h1 className="art-title">{e.displayName}</h1>
        {e.invocation && <span className="art-inv">{e.invocation}</span>}
      </div>
      <p className="detail-desc">{e.description}</p>

      {e.tools.length > 0 && (
        <>
          <div className="tools-title">{t('artifact.tools')}</div>
          <div className="tools">
            {e.tools.map((tool) => <span key={tool} className="tool">{tool}</span>)}
          </div>
        </>
      )}

      <InstallBar command={e.installText} copyId={'a:' + e.id}>
        <a className="btn ghost" href={e.githubUrl} target="_blank" rel="noreferrer">{t('artifact.source')}</a>
      </InstallBar>

      <Details e={e} />

      {(content === null || body) && (
        <section>
          <h2 className="section-title">{t('artifact.docs')}</h2>
          <Html className="panel prose" html={body} />
        </section>
      )}
    </main>
  );
}
