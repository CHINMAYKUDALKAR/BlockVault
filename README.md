# BlockVault (Phase 1)

Core backend skeleton providing MetaMask (Ethereum address) based authentication via message signing.

## Features (Phase 1)
- Flask backend
- Nonce-based login flow with MetaMask signature verification (web3.py)
- JWT issuance (HS256) for session auth
- MongoDB persistence (users + nonces)
- Basic health endpoint `/health`

## Endpoints
### `POST /auth/get_nonce`
Request a nonce to sign.
```json
{
	"address": "0xYourEthereumAddress"
}
```
Response:
```json
{
	"address": "0xYourEthereumAddress",
	"nonce": "<random hex>",
	"message": "BlockVault login nonce: <random hex>"
}
```

### `POST /auth/login`
Submit signature of the provided message.
```json
{
	"address": "0xYourEthereumAddress",
	"signature": "0xSignature"
}
```
Response:
```json
{
	"token": "<jwt>",
	"address": "0xYourEthereumAddress"
}
```

### `GET /auth/me`
Requires header `Authorization: Bearer <jwt>`
Response:
```json
{
	"address": "0xYourEthereumAddress"
}
```

## Running Locally
### Quick Start (Makefile)
```
make dev            # create venv + install (editable) with dev deps
cp .env.example .env
make run-mem        # run using in-memory DB (no MongoDB needed)
```

Then test:
```
curl http://localhost:5000/health
```

### Manual Setup
1. Create and populate `.env`:
```
cp .env.example .env
# edit secrets
```
2. (Optional) Start local MongoDB or use MongoDB Atlas connection string in `MONGO_URI`.
3. Install dependencies:
```
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```
4. Run:
```
python app.py
```
5. Test endpoints with curl or Postman.

If you see `ModuleNotFoundError: No module named 'flask'` you likely:
- Forgot to install dependencies (run `make dev` or `pip install -e .[dev]` inside the venv), or
- Are using a shell where the virtual environment is not activated (`source .venv/bin/activate`).


## Simple curl Test
```
ADDRESS=0x0000000000000000000000000000000000000000
curl -X POST http://localhost:5000/auth/get_nonce -H 'Content-Type: application/json' -d '{"address": "'$ADDRESS'"}'
```
(Sign message with MetaMask externally, then:)
```
curl -X POST http://localhost:5000/auth/login -H 'Content-Type: application/json' -d '{"address": "'$ADDRESS'", "signature": "0x..."}'
```

## Project Structure
```
blockvault/
	api/
		auth.py
		files.py
	core/
		config.py
		db.py
		security.py
		crypto_cli.py
	__init__.py
app.py
pyproject.toml
.env.example
blockvault_crypto/  (Rust AES-256-GCM CLI)
```

## Next Steps (Future Phases)
- Protected endpoints requiring JWT
- Refresh token / revoke strategy
- File storage & encryption layer
- Rate limiting & audit logs
- Frontend integration

## Phase 2 (In Progress) – File Encryption API

Rust-powered AES-256-GCM CLI integrated via subprocess.

### Upload File
`POST /files` (multipart/form-data)
Fields:
- `file`: binary file
- `key`: passphrase used to derive encryption key (PBKDF2)
- `aad` (optional): associated data bound into authentication tag

Auth: `Authorization: Bearer <jwt>` required.

Response:
```json
{ "file_id": "<id>", "name": "original.ext" }
```

### Download File
`GET /files/<file_id>?key=<passphrase>`
Headers alternative: `X-File-Key: <passphrase>`

Returns: decrypted file as attachment if key correct and user owns file.

### Storage
Encrypted blobs stored under `storage/` (override via env `FILE_STORAGE_DIR`).

### Rust Binary
Auto-detected at `blockvault_crypto/target/release/blockvault_crypto` or built on demand if Cargo is available. Override path with `BLOCKVAULT_CRYPTO_BIN`.

---
MIT License

---

## Persistent Storage (MongoDB)

During earlier development we used an in-memory fallback (`MONGO_URI=memory://...`). That data is lost on every backend restart, which caused 404s for verify/download in the UI after restarts. To persist files metadata, run MongoDB and point `MONGO_URI` at it.

### Quick Local Mongo (Docker Compose)

```
docker compose up -d mongo
```

Or start everything (Mongo + backend) with:

```
docker compose up --build
```

The compose file sets `MONGO_URI=mongodb://mongo:27017/blockvault` for the backend container.

### Manual (Codespaces / Local)

1. Run Mongo in the dev container:
	```
	docker run -d --name blockvault-mongo -p 27017:27017 mongo:7
	```
2. Export or set in `.env`:
	```
	MONGO_URI=mongodb://localhost:27017/blockvault
	```
3. Start backend (stable runner):
	```
	make run-stable
	```

### Verifying Persistence

Upload a file, note its `file_id`, restart backend, then list files again—record should remain when using real Mongo.

If you still see 404 after restart, confirm:
```
curl -s http://localhost:5000/debug/files
```
`count` should be > 0.
