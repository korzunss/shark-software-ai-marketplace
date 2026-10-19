import { t } from '../i18n/index.js';
import { useCopy } from '../lib/clipboard.js';

// "$ <command>" terminal strip with a Copy button; extra links go after it.
export default function InstallBar({ command, copyId, children }) {
  const { copied, copy } = useCopy();
  return (
    <div className="install">
      <div className="term">
        <span className="prompt">$</span>
        <span className="cmd ellipsis">{command}</span>
      </div>
      <button className="btn" onClick={() => copy(command, copyId)}>
        {t(copied === copyId ? 'copy.copied' : 'copy.install')}
      </button>
      {children}
    </div>
  );
}
