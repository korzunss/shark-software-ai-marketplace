import { MARKETPLACE, REPO_SLUG, REPO_URL } from '../config.js';
import { pluginIds } from '../data/catalog.js';
import { t, tm } from '../i18n/index.js';
import { useCopy } from '../lib/clipboard.js';
import { href, paths } from '../lib/router.js';

const params = { repo: REPO_SLUG, marketplace: MARKETPLACE, plugin: pluginIds[0] ?? t('guide.pluginPlaceholder') };
const fill = (cmd) => cmd.replace(/\{(\w+)\}/g, (m, k) => params[k] ?? m);

// The site's guide is the short version; docs/ in the repo has the full one.
const MORE = [
  { key: 'guide.moreUsage', path: 'docs/USAGE.md' },
  { key: 'guide.moreContributing', path: 'CONTRIBUTING.md#new-plugin' },
  { key: 'guide.moreTroubleshooting', path: 'docs/TROUBLESHOOTING.md' },
];

function Term({ cmd, id, copied, copy }) {
  return (
    <div className="term">
      <span className="prompt">$</span>
      <span className="cmd ellipsis">{cmd}</span>
      <button className={'term-copy' + (copied === id ? ' done' : '')} onClick={() => copy(cmd, id)}>
        {t(copied === id ? 'copy.shortCopied' : 'copy.short')}
      </button>
    </div>
  );
}

export default function GettingStarted() {
  const { copied, copy } = useCopy();
  return (
    <main className="guide">
      <a className="back" href={href(paths.home())}>{t('guide.back')}</a>
      <h1>{t('guide.title')}</h1>
      <p className="lead">{t('guide.lead')}</p>
      <div className="steps">
        {tm('guide.steps').map((s, i) => (
          <div key={'s:' + i} className="step">
            <div className="step-n">{i + 1}</div>
            <div className="step-body">
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <Term cmd={fill(s.cmd)} id={'s:' + i} copied={copied} copy={copy} />
            </div>
          </div>
        ))}
      </div>
      <div className="note">
        <strong>{t('guide.noteTitle')}</strong> {t('guide.noteText')}
      </div>

      <section className="guide-section">
        <h2>{t('guide.useTitle')}</h2>
        <p>{t('guide.useText')}</p>
      </section>

      <section className="guide-section">
        <h2>{t('guide.cheatTitle')}</h2>
        <p>{t('guide.cheatLead')}</p>
        <div className="cheat">
          {tm('guide.cheat').map((c, i) => (
            <div key={'c:' + i} className="cheat-row">
              <div className="cheat-title">{c.title}</div>
              <Term cmd={fill(c.cmd)} id={'c:' + i} copied={copied} copy={copy} />
            </div>
          ))}
        </div>
        <p className="cheat-note">{t('guide.cheatNote')}</p>
      </section>

      <section className="guide-section">
        <h2>{t('guide.moreTitle')}</h2>
        <ul className="guide-more">
          {MORE.map((m) => (
            <li key={m.key}>
              <a href={`${REPO_URL}/blob/main/${m.path}`} target="_blank" rel="noreferrer">{t(m.key)} ↗</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
