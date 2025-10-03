# BlockVault Frontend (Phase 4)

React + Create React App (migrated from Vite) + Tailwind interface for connecting a wallet (MetaMask), authenticating with the backend, uploading encrypted files, and listing stored items.

## Features
- MetaMask wallet connect (ethers v6)
- Nonce signing login flow (matches backend endpoints)
- JWT stored only in memory (Zustand store) for simplicity (refresh page logs out)
- File upload with passphrase & optional AAD
- File listing with CID + gateway link

## Getting Started
```bash
cd blockvault-frontend
npm install
npm start
```
Open http://localhost:3000

API proxy is handled via `src/setupProxy.js` (port 3000 -> backend 5000). If you deploy, set environment variables or adjust fetch base.

## Directory Structure
```
blockvault-frontend/
  src/
    modules/ (UI sections)
    state/   (zustand stores)
    env.d.ts (Vite env typing)
    index.tsx
  styles.css
  public/index.html
  package.json
  tailwind.config.cjs
  postcss.config.cjs
  setupProxy.js
```

## Security Notes
- For production, move JWT to httpOnly secure cookie (server sets) or use short-lived token + refresh.
- Restrict CORS origins in backend (`blockvault/__init__.py`).
- Consider persisting auth state (e.g., sessionStorage) if desired.

## Next Enhancements
- Download button (supply passphrase, stream decrypted)
- Delete action per file
- Progress indicator for large uploads
- Error boundary + toast notifications
- Dark/light theme toggle

MIT License
