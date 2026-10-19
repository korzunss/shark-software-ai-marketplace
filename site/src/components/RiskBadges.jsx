import { t } from '../i18n/index.js';

// What installing the plugin implies (SITE-SPEC §5.2); reasons show on hover.
export default function RiskBadges({ risk }) {
  if (!risk) return null;
  const badges = ['executesCode', 'network', 'needsSecrets'].filter((key) => risk[key]);
  return (
    <div className="risk" title={risk.reasons.join('\n')}>
      {badges.length
        ? badges.map((key) => <span key={key} className="risk-badge">{t(`risk.${key}`)}</span>)
        : <span className="risk-badge safe">{t('risk.safe')}</span>}
      {risk.reasons.length > 0 && <span className="risk-reasons">{risk.reasons.join(' · ')}</span>}
    </div>
  );
}
