// Dynamic API base resolution.
// Priority:
// 1. Explicit REACT_APP_API_BASE env var
// 2. GitHub Codespaces heuristic: replace -3000 with -5000 in host
// 3. Empty string (relative) for local proxy/dev

let cached: string | null = null;
let lastNetErrorAt = 0;
let consecutiveNetErrors = 0;

// Lightweight subscriber pattern so we don't import stores here (avoid circular deps)
type ToastFn = (msg: string) => void;
const toastListeners: ToastFn[] = [];
export function _registerNetErrorListener(fn: ToastFn) { toastListeners.push(fn); }

declare global {
  interface Window { __BV_API_BASE_OVERRIDE?: string }
}

export function setRuntimeApiBase(override: string) {
  window.__BV_API_BASE_OVERRIDE = override;
  cached = null; // force recompute
  console.info('[api] Runtime API base override set to', override || '(relative)');
}

export function resolveApiBase(): string {
  if (typeof window !== 'undefined' && window.__BV_API_BASE_OVERRIDE !== undefined) {
    if (cached === null) {
      cached = (window.__BV_API_BASE_OVERRIDE || '').replace(/\/$/, '');
      console.info('[api] Using runtime override API base', cached || '(relative)');
    }
    return cached;
  }
  if (cached !== null) return cached;
  const explicit = (process.env.REACT_APP_API_BASE || '').trim();
  if (explicit) {
    cached = explicit.replace(/\/$/, '');
    console.info('[api] Using explicit API base', cached);
    return cached;
  }
  try {
    const loc = window.location;
    // GitHub Codespaces pattern: https://<id>-3000.app.github.dev
    if (/app\.github\.dev$/.test(loc.hostname)) {
      const m = loc.hostname.match(/^(.*)-3000(\.app\.github\.dev)$/);
      if (m) {
        const apiHost = m[1] + '-5000' + m[2];
        cached = loc.protocol + '//' + apiHost;
        console.info('[api] Detected Codespaces host; derived API base', cached, 'from', loc.hostname);
        return cached;
      }
    }
  } catch (e) {
    // ignore
  }
  cached = '';
  console.info('[api] Falling back to relative API base (empty string)');
  return cached;
}

export function apiUrl(path: string): string {
  const base = resolveApiBase();
  if (!base) return path; // relative
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return base + path;
}

// Attach a global axios interceptor exactly once (lazy import to keep bundle lean)
// Consumers should import './api/base' early (index.tsx indirectly does).
import axios from 'axios';
if (!(axios as any).__BV_NET_INTERCEPTOR__) {
  (axios as any).__BV_NET_INTERCEPTOR__ = true;
  axios.interceptors.response.use(r => r, (error) => {
    const now = Date.now();
    const isNetwork = !!error?.message && /Network Error/i.test(error.message) && !error.response;
    if (isNetwork) {
      consecutiveNetErrors += 1;
      // Throttle: only emit toast at most once every 5s or when exponential backoff step changes
      const minInterval = 5000;
      const backoffLevel = Math.min(5, Math.floor(consecutiveNetErrors / 3)); // 0..5
      const interval = minInterval + backoffLevel * 3000;
      if (now - lastNetErrorAt > interval) {
        lastNetErrorAt = now;
        const hint = backoffLevel > 0 ? ` (backoff x${backoffLevel+1})` : '';
        toastListeners.forEach(fn => fn('Network unreachable, retrying' + hint));
      }
    } else {
      if (error.response) {
        // Reset counter on successful HTTP-level response (even if 4xx/5xx)
        consecutiveNetErrors = 0;
      }
    }
    return Promise.reject(error);
  });
  // Reset counters on any successful response
  axios.interceptors.response.use(r => { consecutiveNetErrors = 0; return r; });
}
