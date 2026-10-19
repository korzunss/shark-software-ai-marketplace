import { useEffect, useState } from 'react';

// Hash routing: GitHub Pages has no rewrites, so a path route such as
// /plugins/x would 404 on reload. Everything after '#' stays client-side.
//
//   #/                         home
//   #/search                   search
//   #/plugins/<name>           plugin
//   #/artifacts/<kind>/<plugin>/<name>
//   #/whats-new, #/getting-started

export function parseHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case undefined: return { screen: 'home' };
    case 'search': return { screen: 'search' };
    case 'whats-new': return { screen: 'whats-new' };
    case 'getting-started': return { screen: 'getting-started' };
    case 'plugins': return parts[1] ? { screen: 'plugin', pluginName: parts[1] } : { screen: 'search' };
    case 'artifacts':
      if (parts.length === 4) return { screen: 'artifact', artifactId: `${parts[1]}:${parts[2]}/${parts[3]}` };
      return { screen: 'not-found' };
    default: return { screen: 'not-found' };
  }
}

export const paths = {
  home: () => '/',
  search: () => '/search',
  whatsNew: () => '/whats-new',
  gettingStarted: () => '/getting-started',
  plugin: (name) => `/plugins/${encodeURIComponent(name)}`,
  entry: (e) => (e.kind === 'plugin'
    ? paths.plugin(e.name)
    : `/artifacts/${e.kind}/${encodeURIComponent(e.plugin)}/${encodeURIComponent(e.name)}`),
};

export const href = (path) => '#' + path;

export function navigate(path) {
  if (location.hash.slice(1) === path) window.scrollTo(0, 0);
  else location.hash = path;
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
