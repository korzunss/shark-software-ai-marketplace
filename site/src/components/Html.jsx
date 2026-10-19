import { t } from '../i18n/index.js';

// HTML rendered and sanitised at build time by scripts/lib/markdown.mjs.
export default function Html({ html, className }) {
  if (html == null) return <div className={className} aria-busy="true"><p>{t('plugin.loading')}</p></div>;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
