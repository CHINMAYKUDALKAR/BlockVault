from flask import Flask
from .core.config import load_config
from .core.db import init_db
from .api.auth import bp as auth_bp

def create_app() -> Flask:
    app = Flask(__name__)

    cfg = load_config()
    app.config.update(
        SECRET_KEY=cfg.secret_key,
        JWT_SECRET=cfg.jwt_secret,
        MONGO_URI=cfg.mongo_uri,
        ENV=cfg.env,
        DEBUG=cfg.debug,
    )

    init_db(app)

    app.register_blueprint(auth_bp, url_prefix="/auth")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/")
    def index():
        return {
            "name": cfg.app_name,
            "message": "BlockVault backend running",
            "endpoints": [
                "/health",
                "/auth/get_nonce",
                "/auth/login",
                "/auth/me",
            ],
        }

    return app
