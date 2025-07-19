import os
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure CORS
CORS(app, origins=["*"], supports_credentials=True)

# Configure rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Configure the database
database_url = os.environ.get("DATABASE_URL", "sqlite:///pes_ems.db")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with extensions
db.init_app(app)

# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Import models and routes after app initialization
with app.app_context():
    import models
    import auth
    import api
    
    # Register blueprints
    app.register_blueprint(auth.bp)
    app.register_blueprint(api.bp)
    
    # Create all tables
    db.create_all()
    
    # Create counters table if it doesn't exist
    from models import Counter
    if not Counter.query.filter_by(name='it_requisition').first():
        db.session.add(Counter(name='it_requisition', value=0))
    if not Counter.query.filter_by(name='conference_room').first():
        db.session.add(Counter(name='conference_room', value=0))
    if not Counter.query.filter_by(name='leave_request').first():
        db.session.add(Counter(name='leave_request', value=0))
    db.session.commit()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
