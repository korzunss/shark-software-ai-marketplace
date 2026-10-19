import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCatalog } from './data/catalog.js';
import { CopyProvider, useCopyState } from './lib/clipboard.js';
import { t } from './i18n/index.js';
import { navigate, paths, useRoute } from './lib/router.js';
import Header from './components/Header.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Plugin from './pages/Plugin.jsx';
import Artifact from './pages/Artifact.jsx';
import WhatsNew from './pages/WhatsNew.jsx';
import GettingStarted from './pages/GettingStarted.jsx';
import NotFound from './pages/NotFound.jsx';

const NO_FACETS = { kinds: [], keywords: [], author: null };

function initialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* storage blocked: fall through */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App() {
  const catalog = useMemo(() => buildCatalog(), []);
  const route = useRoute();
  const copyState = useCopyState();
  const headerInput = useRef(null);

  const [theme, setTheme] = useState(initialTheme);
  const [query, setQuery] = useState('');
  const [facets, setFacets] = useState(NO_FACETS);
  const [sort, setSort] = useState('relevance');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch { /* not critical */ }
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      const k = (e.key || '').toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      } else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
        e.preventDefault();
        headerInput.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setPaletteOpen(false), [route]);

  const search = {
    query, facets, sort, setSort, setFacets,
    // Typing anywhere switches to results; the hero input unmounts on that
    // switch, so focus moves to the header input to keep the caret.
    onType: (value) => {
      setQuery(value);
      if (route.screen !== 'search') {
        navigate(paths.search());
        requestAnimationFrame(() => headerInput.current?.focus());
      }
    },
    submit: () => navigate(paths.search()),
    browse: (patch) => {
      setQuery('');
      setFacets({ ...NO_FACETS, ...patch });
      navigate(paths.search());
    },
    clear: () => { setQuery(''); setFacets(NO_FACETS); },
  };
  const backPath = query ? paths.search() : paths.home();

  let page;
  switch (route.screen) {
    case 'home': page = <Home catalog={catalog} search={search} />; break;
    case 'search': page = <Search catalog={catalog} search={search} />; break;
    case 'plugin': page = <Plugin catalog={catalog} name={route.pluginName} backPath={backPath} />; break;
    case 'artifact': page = <Artifact catalog={catalog} id={route.artifactId} backPath={backPath} />; break;
    case 'whats-new': page = <WhatsNew catalog={catalog} />; break;
    case 'getting-started': page = <GettingStarted />; break;
    default: page = <NotFound />;
  }

  return (
    <CopyProvider value={copyState}>
      <div className="app" data-theme={theme}>
        <Header
          inputRef={headerInput}
          query={query}
          onType={search.onType}
          onSubmit={search.submit}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        {page}
        {paletteOpen && <CommandPalette entries={catalog.entries} onClose={() => setPaletteOpen(false)} />}
        {copyState.toast && (
          <div className="toast" role="status"><span className="ok">✓</span> {t('copy.toast')}</div>
        )}
      </div>
    </CopyProvider>
  );
}
