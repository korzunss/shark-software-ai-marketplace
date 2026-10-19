import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/index.js';
import { search } from '../lib/search.js';
import { navigate, paths } from '../lib/router.js';

export default function CommandPalette({ entries, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);

  useEffect(() => input.current?.focus(), []);

  const all = query ? search(entries, query) : entries;
  const shown = all.slice(0, 8);
  const open = (e) => { navigate(paths.entry(e)); onClose(); };

  const onKeyDown = (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (ev.key === 'Enter' && shown[active]) open(shown[active]);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('palette.label')} onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span aria-hidden="true">⌕</span>
          <input
            ref={input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.label')}
          />
          <span className="kbd">{t('palette.esc')}</span>
        </div>
        <div className="palette-list" role="listbox">
          {shown.map((e, i) => (
            <button
              key={e.id}
              className="palette-item"
              role="option"
              aria-selected={i === active}
              data-kind={e.kind}
              onMouseEnter={() => setActive(i)}
              onClick={() => open(e)}
            >
              <span className="dot" />
              <span className="main">
                <span className="name">{e.displayName}</span>{' '}
                <span className="meta">· {e.kind === 'plugin' ? t('palette.plugin') : e.plugin}</span>
              </span>
              <span className="k">{t(`kindBadge.${e.kind}`)}</span>
            </button>
          ))}
          {all.length === 0 && <div className="palette-empty">{t('palette.empty')}</div>}
        </div>
      </div>
    </div>
  );
}
