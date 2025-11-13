# BlockVault

BlockVault is a secure file storage and sharing platform engineered for high-stakes legal environments. At its core, it provides encrypted document vaults, granular sharing controls, and verifiable access logs—ensuring every file exchange is private, auditable, and tamper resistant. Sitting on top of this foundation is an AI-assisted legal workflow engine that brings case management, redaction, and blockchain notarization into a single, modern workspace.

This README walks through the platform’s key features, architecture at a high level, full setup instructions (macOS/Linux and Windows), day-to-day usage, and tips for troubleshooting or extending the system.

---

## Platform Highlights

- **Zero-Trust File Vaults**
  - End-to-end encryption for every document version with optional hardware-key support.
  - IPFS-backed storage ensures resilience while keeping content private.

- **Granular Sharing & Collaboration**
  - Issue time-boxed, permission-scoped share links or collaborative workspaces.
  - Real-time audit trails capture every view, download, signature, and transfer.

- **Blockchain-Assured Integrity**
  - On-chain hashing and notarization of uploads, redactions, and approvals.
  - Zero-knowledge proofs verify authenticity without exposing document contents.

- **Wallet-Backed Access Control**
  - WalletConnect-based authentication and transaction signing for sensitive operations.
  - Smart-contract RBAC keeps ownership clear across internal teams and external partners.

- **Legal Workflow Automation**
  - Case-centric organization, task tracking, and role assignments.
  - AI-powered redaction suggestions, review cycles, and compliance templates.

- **Regulatory-Grade Compliance**
  - Detailed activity logs, retention policies, and exportable compliance reports.
  - Built-in support for jurisdiction-specific confidentiality and discovery rules.

---

## System Overview

| Layer      | Technology | Description |
|-----------|------------|-------------|
| Frontend  | React (Vite + TypeScript) | Rich single-page application handling dashboard, case UI, blockchain explorer, and sharing modals. |
| Backend   | Flask (Python)            | REST API, authentication, redaction services, RBAC, blockchain event sync. |
| Blockchain| Solidity smart contracts  | Manages legal case metadata, evidence hashes, and access proofs on-chain. |
| Crypto    | Rust helper (FFI)         | High-performance cryptographic operations invoked by the backend. |
| Storage   | IPFS + Encrypted Local    | Files are encrypted client-side; metadata & versions tracked via IPFS hooks. |
| AI/ML     | Python-based redaction service | Zero-shot / pattern-based PII detection with manual review workflow. |

### Directory Map (High-Level)

```
BlockVault/
├── app.py                      # Flask entry point
├── blockvault/                 # Backend modules & services
├── blockvault-frontend-new/    # React + Vite frontend
├── blockvault_crypto/          # Rust crypto bridge
├── contracts/                  # Solidity smart contracts
├── scripts/                    # Helper scripts (DB setup, backups)
├── start.sh                    # macOS/Linux startup helper
├── start_windows.ps1           # Windows startup helper
└── requirements.txt            # Backend Python dependencies
```

---

## Prerequisites

### Common Requirements

- Node.js LTS (≥ 18.x) and npm
- Python 3.10+
- MongoDB + Redis (or configure alternative stores in environment)
- Rust toolchain (if building `blockvault_crypto` from source)
- Git, curl, and lsof (macOS/Linux) / PowerShell 5.1+ (Windows)

Ensure you copy `env.example` to `.env` (backend) and set Vite env values (`blockvault-frontend-new/.env`).

### macOS / Linux
- Bash shell (script assumes `/bin/bash`)
- `python3`, `pip`, and a C compiler for any native deps
- `curl` and `lsof` available on PATH

### Windows
- PowerShell 5.1 (Windows PowerShell) or PowerShell 7+
- Python available as `python` or `py`
- Node.js/npm installed system-wide
- `Get-NetTCPConnection` available (included in recent Windows)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/<your-org>/BlockVault.git
cd BlockVault
```

### 2. Configure Environment

- Duplicate `env.example` → `.env` and fill in secrets.
- Create `blockvault-frontend-new/.env` with any custom API endpoints (defaults point to Flask on `http://localhost:5000`).

### 3. Install Dependencies

> Both startup scripts auto-create the Python virtual environment and install npm packages if missing; manual steps are optional but documented for clarity.

- **Backend (manual):**

  ```bash
  python3 -m venv venv
  source venv/bin/activate          # On macOS/Linux
  pip install -r requirements.txt
  ```

- **Frontend (manual):**

  ```bash
  cd blockvault-frontend-new
  npm install
  cd ..
  ```

- **Rust Crypto (optional):**

  ```bash
  cd blockvault_crypto
  cargo build --release
  cd ..
  ```

---

## Starting the Platform

### Option A: macOS / Linux Script

```bash
./start.sh
```

The script:
1. Creates/activates `venv`, installs Python requirements if needed.
2. Ensures frontend `node_modules` exist (runs `npm install` on first launch).
3. Frees ports `5000` (Flask) and `3000` (Vite) when occupied.
4. Starts backend (`app.py`) and frontend (`npm run dev`) in background.
5. Waits for services on `http://localhost:5000` and `http://localhost:3000`.
6. Opens your browser to the frontend (uses `open` on macOS or `xdg-open` elsewhere).
7. Handles Ctrl+C shutdown by stopping both processes and cleaning logs.

Logs: `backend.log`, `blockvault-frontend-new/frontend.log`

### Option B: Windows (PowerShell)

```powershell
pwsh -ExecutionPolicy Bypass -File .\start_windows.ps1
# or
powershell.exe -ExecutionPolicy Bypass -File .\start_windows.ps1
```

The PowerShell script mirrors the bash workflow, with logs at:
- Backend stdout: `backend.log`
- Backend stderr: `backend-error.log`
- Frontend stdout: `blockvault-frontend-new/frontend.log`
- Frontend stderr: `blockvault-frontend-new/frontend-error.log`

Press `Ctrl+C` to stop both services; the script cleans them up automatically.

### Manual Start (Advanced)

Backend:
```bash
source venv/bin/activate
FLASK_ENV=development python app.py
```

Frontend:
```bash
cd blockvault-frontend-new
npm run dev
```

Smart Contracts:
```bash
cd contracts
npm install           # if Hardhat/Truffle used
npm run deploy        # update network/config as needed
```

---

## Using BlockVault

### 1. Authenticate
- Sign in via WalletConnect or supported EOA wallet.
- Backend verifies signature and issues session token.

### 2. Dashboard Overview
- Recent activity feed with blockchain-backed events.
- Quick links to Cases, Legal workflows, Files, and Settings.

### 3. Case Management
- Create/update cases, assign roles (Lead, Reviewer, Paralegal).
- Upload documents/folders scoped to cases.
- Track version history and blockchain notarization.

### 4. Document Redaction & Processing
- Upload raw files; AI redaction service suggests PII removals.
- Preview redactions, accept/reject suggestions.
- Publish redacted copy with on-chain proof.

### 5. Secure Sharing
- Generate share links or invite external parties.
- Configure view/download rights and expiration.
- Access attempts recorded immutably on-chain.

### 6. Blockchain Explorer
- Visual timeline of notarized events.
- Drill down to transaction details, proof metadata, and receipt hashes.

### 7. Settings & Integrations
- Manage organization/team roster, RBAC policies, notification preferences.
- Configure legal templates, redaction patterns, and connected wallets.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLASK_ENV` | Backend mode (`development`, `production`) |
| `SECRET_KEY` | Flask session secret |
| `DATABASE_URL` | MongoDB connection string |
| `REDIS_URL` | Redis for job queues/cache |
| `IPFS_GATEWAY` | IPFS pinning service/gateway |
| `BLOCKCHAIN_RPC_URL` | RPC node for contract interactions |
| `VITE_API_BASE_URL` | Frontend API base |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |

Refer to `env.example` for the full list and defaults.

---

## Troubleshooting

- **Ports already in use**: Scripts auto-kill conflicting processes, but manual steps:
  ```bash
  lsof -i :5000
  kill -9 <pid>
  ```
  On Windows: `Get-NetTCPConnection -LocalPort 5000 | Stop-Process`

- **Backend not responding**:
  - Check `backend.log` / `backend-error.log`.
  - Ensure MongoDB/Redis are reachable with correct credentials.
  - Verify environment variables are set.

- **Frontend build issues**:
  - Delete `blockvault-frontend-new/node_modules` and rerun `npm install`.
  - Confirm Node.js version (18+).

- **Smart contract mismatches**:
  - Ensure ABI files match deployed contracts.
  - Redeploy contracts and update environment variables.

- **Wallet connection problems**:
  - Confirm WalletConnect Project ID.
  - Clear local storage or try another browser profile.

---

## Development Tips

- **Hot Reload**: Vite handles frontend HMR; Flask reloads if `FLASK_ENV=development`.
- **Testing**:
  - Backend: `pytest` or `python -m unittest`.
  - Frontend: `npm run test` (set up React Testing Library/Jest).
  - Smart contracts: Hardhat/Foundry as configured.
- **Linting**:
  - Backend: `flake8` / `black`.
  - Frontend: `npm run lint`.

---

## Deployment

- Use `docker-compose.yml` or `docker-compose.prod.yml` for containerized deployments.
- `render.yaml`, `netlify.toml`, and `Makefile` provide deployment hooks for cloud platforms.
- Ensure production secrets are injected via environment variables or secret management.

---

## Roadmap & Contributions

1. Additional zero-knowledge templates for region-specific compliance.
2. Expanded AI models for optical character recognition and translation.
3. Enhanced analytics dashboards and API integrations (Clio, iManage).

Contributions welcome! Submit pull requests, file issues, or contact the maintainers.

---

## License

This project is licensed under the MIT License (see `LICENSE` if present or update accordingly).

---

### Support

For questions, bug reports, or feature requests:
- GitHub Issues
- Email: support@blockvault.example (replace with your org’s contact)
- Community: Join the BlockVault Discord/Slack (if available)

Thank you for building secure legal workflows with BlockVault. 🔐✨

---

<p align="center">
  <a href="https://madewithloveinindia.org" target="_blank" rel="noreferrer noopener" style="text-decoration:none; font-weight:600;">
    <span style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.65rem 1.2rem; border-radius:999px; border:1px solid rgba(148, 163, 184, 0.4); background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35); color:#f8fafc;">
      Made with <span aria-label="Love" style="color:#f43f5e;">&#10084;&#65039;</span> in India
    </span>
  </a>
</p>
