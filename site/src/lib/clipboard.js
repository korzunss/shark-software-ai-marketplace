import { createContext, useCallback, useContext, useRef, useState } from 'react';

const CopyContext = createContext(null);

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* nothing else to try */ }
  document.body.removeChild(ta);
}

// One "copied" marker for the whole page: the button that copied last shows
// its confirmation for 2 s, and the shared toast shows for 1.8 s.
export function useCopyState() {
  const [copied, setCopied] = useState(null);
  const [toast, setToast] = useState(false);
  const timers = useRef([]);

  const copy = useCallback((text, id) => {
    const done = () => {
      setCopied(id);
      setToast(true);
      timers.current.forEach(clearTimeout);
      timers.current = [
        setTimeout(() => setCopied(null), 2000),
        setTimeout(() => setToast(false), 1800),
      ];
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  }, []);

  return { copied, toast, copy };
}

export const CopyProvider = CopyContext.Provider;
export const useCopy = () => useContext(CopyContext);
