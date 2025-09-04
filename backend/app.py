from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from routes.auth import bp as auth_bp
from routes.clients import bp as clients_bp
from routes.portfolios import bp as portfolios_bp
from routes.assets import bp as assets_bp
from routes.jobs import bp as jobs_bp
from routes.market import bp as market_bp


def create_app() -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "devsecret")
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(clients_bp, url_prefix="/api")
    app.register_blueprint(portfolios_bp, url_prefix="/api")
    app.register_blueprint(assets_bp, url_prefix="/api")
    app.register_blueprint(jobs_bp, url_prefix="/api")
    app.register_blueprint(market_bp, url_prefix="/api")

    @app.get("/health")
    def health():
        return jsonify({"ok": True})

    return app


app = create_app()
if __name__ == "__main__":
    app.run(port=8000, debug=True)
