// Dynamic API base resolution.
// Priority:
// 1. Explicit REACT_APP_API_BASE env var
// 2. GitHub Codespaces heuristic: replace -3000 with -5000 in host
// 3. Empty string (relative) for local proxy/dev

let cached: string | null = null;

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
