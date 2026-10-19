import { MARKETPLACE, REPO_SLUG } from '../config.js';
import { pluginIds } from '../data/catalog.js';
import { t, tm } from '../i18n/index.js';
import { useCopy } from '../lib/clipboard.js';
import { href, paths } from '../lib/router.js';

const params = { repo: REPO_SLUG, marketplace: MARKETPLACE, plugin: pluginIds[0] ?? t('guide.pluginPlaceholder') };

export default function GettingStarted() {
  const { copied, copy } = useCopy();
  return (
    <main className="guide">
      <a className="back" href={href(paths.home())}>{t('guide.back')}</a>
      <h1>{t('guide.title')}</h1>
      <p className="lead">{t('guide.lead')}</p>
      <div className="steps">
        {tm('guide.steps').map((s, i) => {
          const id = 's:' + i;
          const cmd = s.cmd.replace(/\{(\w+)\}/g, (m, k) => params[k] ?? m);
          return (
            <div key={id} className="step">
              <div className="step-n">{i + 1}</div>
              <div className="step-body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="term">
                  <span className="prompt">$</span>
                  <span className="cmd ellipsis">{cmd}</span>
                  <button className={'term-copy' + (copied === id ? ' done' : '')} onClick={() => copy(cmd, id)}>
                    {t(copied === id ? 'copy.shortCopied' : 'copy.short')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="note">
        <strong>{t('guide.noteTitle')}</strong> {t('guide.noteText')}
      </div>
    </main>
  );
}
