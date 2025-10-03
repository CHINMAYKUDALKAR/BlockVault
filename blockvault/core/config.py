from __future__ import annotations
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    env: str
    debug: bool
    mongo_uri: str
    secret_key: str
    jwt_secret: str
    jwt_exp_minutes: int
    app_name: str = "BlockVault"


def load_config() -> Config:
    env = os.getenv("FLASK_ENV", "development")
    debug = env != "production"
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/blockvault")
    secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change")
    jwt_secret = os.getenv("JWT_SECRET", "dev-jwt-secret-change")
    jwt_exp_minutes = int(os.getenv("JWT_EXP_MINUTES", "60"))
    return Config(
        env=env,
        debug=debug,
        mongo_uri=mongo_uri,
        secret_key=secret_key,
        jwt_secret=jwt_secret,
        jwt_exp_minutes=jwt_exp_minutes,
    )
