from flask import Flask, jsonify
import os
from flask_cors import CORS
from .core.config import load_config
from .core.db import init_db
from .api.auth import bp as auth_bp
from .api.files import bp as files_bp

def create_app() -> Flask:
    app = Flask(__name__)

    cfg = load_config()
    app.config.update(
        SECRET_KEY=cfg.secret_key,
        JWT_SECRET=cfg.jwt_secret,
        MONGO_URI=cfg.mongo_uri,
        ENV=cfg.env,
        DEBUG=cfg.debug,
        IPFS_ENABLED=cfg.ipfs_enabled,
        IPFS_API_URL=cfg.ipfs_api_url,
        IPFS_API_TOKEN=cfg.ipfs_api_token,
        IPFS_GATEWAY_URL=cfg.ipfs_gateway_url,
    )

    init_db(app)
    # Enable CORS (development permissive). For production, restrict origins.
    CORS(app, resources={r"/*": {"origins": "*"}}, expose_headers=["Authorization","Content-Type"], supports_credentials=False)

    # Standard JSON error responses
    @app.errorhandler(400)
    @app.errorhandler(401)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(405)
    @app.errorhandler(410)
    @app.errorhandler(413)
    @app.errorhandler(415)
    @app.errorhandler(500)
    def json_error(err):  # type: ignore
        code = getattr(err, 'code', 500)
        return jsonify({"error": getattr(err, 'description', str(err)), "code": code}), code

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(files_bp, url_prefix="/files")

    @app.get("/health")
    def health():
        resp = jsonify({"status": "ok"})
        resp.headers['X-Route'] = 'health'
        return resp

    @app.get("/")
    def index():
        resp = jsonify({
            "name": cfg.app_name,
            "message": "BlockVault backend running",
            "endpoints": [
                "/health",
                "/auth/get_nonce",
                "/auth/login",
                "/auth/me",
                "/files (POST upload)",
                "/files/<id> (GET download)",
                "/files (GET list)",
                "/files/<id> (DELETE)",
                "/files/<id>/verify (GET verify integrity)",
                "/debug/files (DEV only raw listing)",
            ],
        })
        resp.headers['X-Route'] = 'index'
        return resp

    @app.get('/ping')
    def ping():
        r = jsonify({'pong': True})
        r.headers['X-Route'] = 'ping'
        return r

    @app.get("/debug/files")
    def debug_files():  # simple dev aid
        try:
            from .core.db import get_db
            coll = get_db()["files"]
            docs = []
            try:
                from pymongo.collection import Collection  # type: ignore
                if isinstance(coll, Collection):  # type: ignore[arg-type]
                    for d in coll.find({}):
                        docs.append({
                            "_id": str(d.get("_id")),
                            "owner": d.get("owner"),
                            "enc_filename": d.get("enc_filename"),
                            "created_at": d.get("created_at"),
                        })
                else:
                    store = getattr(coll, '_store', {})  # type: ignore[attr-defined]
                    for s in store.values():
                        docs.append({
                            "_id": s.get("_id"),
                            "owner": s.get("owner"),
                            "enc_filename": s.get("enc_filename"),
                            "created_at": s.get("created_at"),
                        })
            except Exception as e:
                return {"error": f"debug fetch failed: {e}"}, 500
            return {"count": len(docs), "files": docs}
        except Exception as e:
            return {"error": str(e)}, 500

    # Dev-only token minting (DO NOT ENABLE IN PROD). Set ALLOW_DEV_TOKEN=1 to expose.
    @app.get("/auth/dev_token")
    def dev_token():
        if os.getenv("ALLOW_DEV_TOKEN", "0").lower() not in {"1", "true", "yes"}:
            return {"error": "not enabled"}, 404
        raw_address = ( ( __import__('flask').request.args.get('address') ) or '' ).strip()
        if not raw_address:
            return {"error": "address query param required"}, 400
        from string import hexdigits
        cleaned = raw_address.lower()
        if cleaned.startswith('0x'):
            cleaned = cleaned[2:]
        if len(cleaned) != 40:
            return {"error": "invalid address length", "provided_length": len(cleaned)}, 400
        if any(c not in hexdigits for c in cleaned):
            return {"error": "address contains non-hex characters"}, 400
        try:
            from web3 import Web3
            address = Web3.to_checksum_address('0x' + cleaned)
        except Exception:
            return {"error": "could not checksum address"}, 400
        from .core.security import generate_jwt
        token = generate_jwt({"sub": address})
        return {"token": token, "address": address}

    return app
