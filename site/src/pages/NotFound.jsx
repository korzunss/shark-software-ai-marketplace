import { t } from '../i18n/index.js';
import { href, paths } from '../lib/router.js';

export default function NotFound() {
  return (
    <main className="feed">
      <div className="no-results">
        <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden="true">🧭</div>
        <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>{t('notFound.title')}</h1>
        <p>{t('notFound.text')}</p>
        <a className="btn md" href={href(paths.home())}>{t('notFound.home')}</a>
      </div>
    </main>
  );
}
