from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
from functools import wraps
import json

from app import db, limiter
from models import User, Token

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

def generate_jwt_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, current_app.secret_key, algorithm='HS256')
    
    # Store token in database
    token_record = Token(
        user_id=user_id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.session.add(token_record)
    db.session.commit()
    
    return token

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Check if token exists and is valid in database
            token_record = Token.query.filter_by(token=token, is_valid=True).first()
            if not token_record:
                return jsonify({'error': 'Invalid token'}), 401
            
            # Check if token is expired
            if token_record.expires_at < datetime.utcnow():
                token_record.is_valid = False
                db.session.commit()
                return jsonify({'error': 'Token has expired'}), 401
            
            # Decode JWT
            data = jwt.decode(token, current_app.secret_key, algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            
            if not current_user or not current_user.is_active:
                return jsonify({'error': 'User not found or inactive'}), 401
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            if current_user.role not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator

@bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'email', 'password', 'full_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if this is the first user (for IT admin assignment)
        user_count = User.query.count()
        is_first_user = user_count == 0
        
        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Hash password
        password_hash = generate_password_hash(data['password'])
        
        # Create user
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=password_hash,
            full_name=data['full_name'],
            designation=data.get('designation', ''),
            phone_extension=data.get('phone_extension', ''),
            role='it' if is_first_user else 'employee'  # First user gets IT admin role
        )
        
        db.session.add(user)
        db.session.commit()
        
        # Generate token
        token = generate_jwt_token(user.id)
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(),
            'token': token,
            'is_first_user': is_first_user
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Registration failed'}), 500

@bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    try:
        data = request.get_json()
        
        if not data.get('login') or not data.get('password'):
            return jsonify({'error': 'Login and password are required'}), 400
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == data['login']) | (User.email == data['login'])
        ).first()
        
        if not user or not check_password_hash(user.password_hash, data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Generate token
        token = generate_jwt_token(user.id)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'token': token
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header:
            token = auth_header.split(' ')[1]
            # Invalidate token
            token_record = Token.query.filter_by(token=token).first()
            if token_record:
                token_record.is_valid = False
                db.session.commit()
        
        return jsonify({'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500

@bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify({'user': current_user.to_dict()}), 200

@bp.route('/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    try:
        data = request.get_json()
        
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        # Verify current password
        if not check_password_hash(current_user.password_hash, data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 400
        
        # Update password
        current_user.password_hash = generate_password_hash(data['new_password'])
        current_user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Change password error: {e}")
        return jsonify({'error': 'Password change failed'}), 500
