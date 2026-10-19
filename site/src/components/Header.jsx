import { MARKETPLACE, REPO_URL } from '../config.js';
import { t } from '../i18n/index.js';
import { href, paths } from '../lib/router.js';

export default function Header({ inputRef, query, onType, onSubmit, theme, onToggleTheme, onOpenPalette }) {
  return (
    <header className="header">
      <a className="brand" href={href(paths.home())}>
        <span className="brand-mark" aria-hidden="true">◆</span>
        <span className="brand-name">{t('header.brand')}</span>
        <span className="brand-tag">{MARKETPLACE}</span>
      </a>
      <div className="search-box">
        <span className="icon" aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="search"
          aria-label={t('header.searchLabel')}
          value={query}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={t('header.searchPlaceholder')}
        />
      </div>
      <button className="hbtn mono palette-btn" onClick={onOpenPalette} aria-label={t('header.openPalette')}>⌘K</button>
      <button
        className="hbtn theme"
        onClick={onToggleTheme}
        aria-label={t(theme === 'dark' ? 'header.themeToLight' : 'header.themeToDark')}
      >
        {theme === 'dark' ? '☾' : '☀'}
      </button>
      <a className="hlink" href={REPO_URL} target="_blank" rel="noreferrer">{t('header.github')}</a>
    </header>
  );
}
