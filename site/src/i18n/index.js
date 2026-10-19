// Every user-facing string lives in en.json; components only reference keys.
// Adding a language later means adding <lang>.json with the same keys.
import messages from './en.json';

const rules = new Intl.PluralRules(messages.meta.lang);

function lookup(key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), messages);
}

const interpolate = (text, params = {}) => text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));

// t('search.resultsFor', { query }) → "Results for “…”"
export function t(key, params) {
  const value = lookup(key);
  if (typeof value !== 'string') {
    if (import.meta.env?.DEV) console.warn(`i18n: missing string "${key}"`);
    return key;
  }
  return interpolate(value, params);
}

// tp('search.count', 3) → "3 artifacts"; picks the plural form (one/few/many/other)
// by the rules of messages.meta.lang, falling back to "other".
export function tp(key, count, params = {}) {
  const forms = lookup(key) || {};
  const text = forms[rules.select(count)] ?? forms.other ?? key;
  return interpolate(text, { count, ...params });
}

// Non-string entries (lists, maps), e.g. the getting-started steps.
export const tm = (key) => lookup(key);
