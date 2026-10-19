import { REPO_URL } from '../config.js';
import { releases } from '../data/catalog.js';
import { t } from '../i18n/index.js';
import { href, paths } from '../lib/router.js';

export default function WhatsNew({ catalog }) {
  return (
    <main className="feed">
      <a className="back" href={href(paths.home())}>{t('whatsNew.back')}</a>
      <div className="feed-head">
        <h1 className="page-h1">{t('whatsNew.title')}</h1>
        {/* public/feed.xml comes with build-catalog (SITE-SPEC §3); until then, the commit feed. */}
        <a className="rss" href={REPO_URL + '/commits/main.atom'} target="_blank" rel="noreferrer">{t('whatsNew.rss')}</a>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {releases(catalog.plugins).map((r) => (
          <a key={r.plugin + r.version} className="feed-item tile" href={href(paths.plugin(r.plugin))}>
            <div className="feed-when">
              <div className="v">v{r.version}</div>
              <div className="d">{r.date}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.displayName}</div>
              <div className="feed-sum">{r.summary}</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
