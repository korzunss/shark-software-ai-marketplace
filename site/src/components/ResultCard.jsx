import { t } from '../i18n/index.js';
import { useCopy } from '../lib/clipboard.js';
import { href, paths } from '../lib/router.js';

export default function ResultCard({ entry: e }) {
  const { copied, copy } = useCopy();
  const copyId = 'c:' + e.id;
  const link = href(paths.entry(e));
  return (
    <article className="card tile" data-kind={e.kind}>
      <div className="card-body">
        <div className="card-top">
          <span className="kind-badge">{t(`kindBadge.${e.kind}`)}</span>
          <span className="card-ver">{e.version}</span>
        </div>
        <a className="card-title" href={link}>{e.displayName}</a>
        <p className="card-desc">{e.description}</p>
        <div className="card-kws">
          {e.keywords.slice(0, 3).map((kw) => <span key={kw}>#{kw}</span>)}
        </div>
      </div>
      <div className="card-foot">
        <span className="card-meta ellipsis">{e.kind === 'plugin' ? e.author : e.plugin + ' · ' + e.author}</span>
        <div className="card-actions">
          <button className={'btn-sm' + (copied === copyId ? ' done' : '')} onClick={() => copy(e.installText, copyId)}>
            {t(copied === copyId ? 'copy.copied' : 'copy.install')}
          </button>
          <a className="btn-sm primary" href={link} aria-label={t('card.openLabel', { name: e.displayName })}>{t('card.open')}</a>
        </div>
      </div>
    </article>
  );
}
