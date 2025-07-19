from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash
from datetime import datetime, date
import json
import secrets

from app import db
from models import User, Requisition, Counter
from auth import token_required, role_required

bp = Blueprint('api', __name__, url_prefix='/api')

# User Management Routes
@bp.route('/users', methods=['GET'])
@token_required
@role_required('it')
def get_users(current_user):
    try:
        users = User.query.all()
        return jsonify({'users': [user.to_dict() for user in users]}), 200
    except Exception as e:
        current_app.logger.error(f"Get users error: {e}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@bp.route('/users', methods=['POST'])
@token_required
@role_required('it')
def create_user(current_user):
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'email', 'password', 'full_name', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate role
        valid_roles = ['employee', 'manager', 'it']
        if data['role'] not in valid_roles:
            return jsonify({'error': 'Invalid role'}), 400
        
        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create user
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            full_name=data['full_name'],
            designation=data.get('designation', ''),
            phone_extension=data.get('phone_extension', ''),
            role=data['role']
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Create user error: {e}")
        return jsonify({'error': 'Failed to create user'}), 500

@bp.route('/users/<int:user_id>', methods=['PUT'])
@token_required
@role_required('it')
def update_user(current_user, user_id):
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        # Update allowed fields
        if 'full_name' in data:
            user.full_name = data['full_name']
        if 'email' in data:
            # Check if email is already taken by another user
            existing_user = User.query.filter(User.email == data['email'], User.id != user_id).first()
            if existing_user:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']
        if 'role' in data and data['role'] in ['employee', 'manager', 'it']:
            user.role = data['role']
        if 'designation' in data:
            user.designation = data['designation']
        if 'phone_extension' in data:
            user.phone_extension = data['phone_extension']
        if 'is_active' in data:
            user.is_active = data['is_active']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Update user error: {e}")
        return jsonify({'error': 'Failed to update user'}), 500

@bp.route('/users/search', methods=['GET'])
@token_required
def search_users(current_user):
    try:
        query = request.args.get('query', '').strip()
        if len(query) < 2:
            return jsonify({'users': []}), 200
        
        users = User.query.filter(
            User.is_active == True,
            (User.full_name.ilike(f'%{query}%') | User.username.ilike(f'%{query}%'))
        ).limit(10).all()
        
        return jsonify({
            'users': [{'id': u.id, 'full_name': u.full_name, 'username': u.username} for u in users]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Search users error: {e}")
        return jsonify({'error': 'Search failed'}), 500

@bp.route('/users/me', methods=['PUT'])
@token_required
def update_profile(current_user):
    try:
        data = request.get_json()
        
        # Update allowed profile fields
        if 'full_name' in data:
            current_user.full_name = data['full_name']
        if 'email' in data:
            # Check if email is already taken
            existing_user = User.query.filter(User.email == data['email'], User.id != current_user.id).first()
            if existing_user:
                return jsonify({'error': 'Email already exists'}), 400
            current_user.email = data['email']
        if 'designation' in data:
            current_user.designation = data['designation']
        if 'phone_extension' in data:
            current_user.phone_extension = data['phone_extension']
        
        current_user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': current_user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Update profile error: {e}")
        return jsonify({'error': 'Failed to update profile'}), 500

# Requisition Routes
@bp.route('/requisitions', methods=['GET'])
@token_required
def get_requisitions(current_user):
    try:
        req_type = request.args.get('type')  # 'it', 'conference_room', 'leave'
        
        query = Requisition.query
        
        if req_type:
            query = query.filter_by(requisition_type=req_type)
        
        # Filter and sort based on user role
        if current_user.role == 'employee':
            # Employees can only see their own requisitions
            query = query.filter_by(user_id=current_user.id)
            requisitions = query.order_by(Requisition.created_at.desc()).all()
        elif current_user.role == 'manager':
            # Managers can see requisitions from other users that need approval
            # They should NOT see their own requisitions as they are approvers
            # For leave requests, only show if replacement is confirmed or no replacement needed
            if req_type == 'leave':
                query = query.filter(
                    Requisition.user_id != current_user.id,
                    db.or_(
                        Requisition.replacement_confirmed == True,
                        Requisition.replacement_user_id.is_(None)
                    )
                )
            else:
                query = query.filter(Requisition.user_id != current_user.id)
            
            # Show pending approvals first, then approved history
            pending_reqs = query.filter(Requisition.status == 'pending').order_by(Requisition.created_at.desc()).all()
            approved_reqs = query.filter(Requisition.status.in_(['approved', 'completed', 'declined'])).order_by(Requisition.updated_at.desc()).all()
            requisitions = pending_reqs + approved_reqs
        elif current_user.role == 'it':
            # IT staff can see all requisitions, but sort with others' requests first, then own requests
            all_requisitions = query.order_by(Requisition.created_at.desc()).all()
            others_requests = [r for r in all_requisitions if r.user_id != current_user.id]
            own_requests = [r for r in all_requisitions if r.user_id == current_user.id]
            requisitions = others_requests + own_requests
        else:
            requisitions = query.order_by(Requisition.created_at.desc()).all()
        
        return jsonify({
            'requisitions': [req.to_dict() for req in requisitions]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get requisitions error: {e}")
        return jsonify({'error': 'Failed to fetch requisitions'}), 500

@bp.route('/requisitions', methods=['POST'])
@token_required
def create_requisition(current_user):
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('requisition_type') or not data.get('subject'):
            return jsonify({'error': 'Requisition type and subject are required'}), 400
        
        req_type = data['requisition_type']
        if req_type not in ['it', 'conference_room', 'leave']:
            return jsonify({'error': 'Invalid requisition type'}), 400
        
        # Generate display ID
        counter_name = f"{req_type}_requisition"
        counter_value = Counter.get_next_value(counter_name)
        
        if req_type == 'it':
            display_id = f"IT-{counter_value:04d}"
        elif req_type == 'conference_room':
            display_id = f"CR-{counter_value:04d}"
        else:  # leave
            display_id = f"LR-{counter_value:04d}"
        
        # Create requisition
        requisition = Requisition(
            display_id=display_id,
            user_id=current_user.id,
            requisition_type=req_type,
            subject=data['subject'],
            description=data.get('description', ''),
            priority=data.get('priority', 'medium')
        )
        
        # Add type-specific fields
        if req_type == 'it':
            requisition.it_category = data.get('it_category')
        elif req_type == 'conference_room':
            requisition.room_name = data.get('room_name')
            if data.get('start_datetime'):
                requisition.start_datetime = datetime.fromisoformat(data['start_datetime'].replace('Z', '+00:00'))
            if data.get('end_datetime'):
                requisition.end_datetime = datetime.fromisoformat(data['end_datetime'].replace('Z', '+00:00'))
            requisition.attendees_count = data.get('attendees_count')
            requisition.equipment_needed = data.get('equipment_needed')
        elif req_type == 'leave':
            requisition.leave_type = data.get('leave_type')
            if data.get('start_date'):
                requisition.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            if data.get('end_date'):
                requisition.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            requisition.total_days = data.get('total_days')
            requisition.replacement_name = data.get('replacement_name')
            
            # Handle replacement user
            if data.get('replacement_user_id'):
                requisition.replacement_user_id = data['replacement_user_id']
                # Generate replacement confirmation token
                requisition.replacement_token = secrets.token_urlsafe(32)
        
        # Initialize changelog
        changelog_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'action': 'created',
            'user': current_user.full_name,
            'details': f"Requisition created by {current_user.full_name}"
        }
        requisition.changelog = json.dumps([changelog_entry])
        
        db.session.add(requisition)
        db.session.commit()
        
        return jsonify({
            'message': 'Requisition created successfully',
            'requisition': requisition.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Create requisition error: {e}")
        return jsonify({'error': 'Failed to create requisition'}), 500

@bp.route('/requisitions/<requisition_id>', methods=['PUT'])
@token_required
def update_requisition(current_user, requisition_id):
    try:
        requisition = Requisition.query.get_or_404(requisition_id)
        data = request.get_json()
        
        # Check permissions
        can_edit = (
            current_user.role in ['manager', 'it'] or 
            (current_user.role == 'employee' and requisition.user_id == current_user.id and requisition.status == 'pending')
        )
        
        if not can_edit:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Parse existing changelog
        changelog = json.loads(requisition.changelog) if requisition.changelog else []
        
        # Handle status updates
        if 'status' in data and data['status'] != requisition.status:
            old_status = requisition.status
            new_status = data['status']
            
            # Validate status transitions
            valid_transitions = {
                'pending': ['approved', 'declined', 'in_progress'],
                'approved': ['completed', 'in_progress'],
                'in_progress': ['completed', 'approved'],
                'declined': ['pending'],
                'completed': ['in_progress']
            }
            
            if new_status not in valid_transitions.get(old_status, []):
                return jsonify({'error': f'Invalid status transition from {old_status} to {new_status}'}), 400
            
            requisition.status = new_status
            
            # Add changelog entry
            changelog_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'status_changed',
                'user': current_user.full_name,
                'details': f"Status changed from {old_status} to {new_status}"
            }
            changelog.append(changelog_entry)
        
        # Handle assignment (IT requisitions)
        if 'assigned_to' in data and requisition.requisition_type == 'it':
            requisition.assigned_to = data['assigned_to']
            changelog_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'assigned',
                'user': current_user.full_name,
                'details': f"Assigned to {data['assigned_to']}"
            }
            changelog.append(changelog_entry)
        
        # Update other editable fields
        editable_fields = ['subject', 'description', 'priority']
        for field in editable_fields:
            if field in data:
                setattr(requisition, field, data[field])
        
        requisition.changelog = json.dumps(changelog)
        requisition.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Requisition updated successfully',
            'requisition': requisition.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Update requisition error: {e}")
        return jsonify({'error': 'Failed to update requisition'}), 500

@bp.route('/requisitions/<requisition_id>', methods=['DELETE'])
@token_required
def delete_requisition(current_user, requisition_id):
    try:
        requisition = Requisition.query.get_or_404(requisition_id)
        
        # Check permissions - IT can delete any, users can delete their own pending requests only
        can_delete = (
            current_user.role == 'it' or 
            (current_user.id == requisition.user_id and requisition.status == 'pending')
        )
        
        if not can_delete:
            return jsonify({'error': 'Insufficient permissions to delete this requisition'}), 403
        
        # Delete the requisition
        db.session.delete(requisition)
        db.session.commit()
        
        return jsonify({'message': 'Requisition deleted successfully'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Delete requisition error: {e}")
        return jsonify({'error': 'Failed to delete requisition'}), 500

@bp.route('/leave/confirm/<token>', methods=['GET'])
def get_replacement_confirmation(token):
    try:
        requisition = Requisition.query.filter_by(replacement_token=token).first()
        if not requisition:
            return jsonify({'error': 'Invalid confirmation token'}), 404
        
        return jsonify({
            'requisition': {
                'id': requisition.id,
                'display_id': requisition.display_id,
                'subject': requisition.subject,
                'description': requisition.description,
                'start_date': requisition.start_date.isoformat() if requisition.start_date else None,
                'end_date': requisition.end_date.isoformat() if requisition.end_date else None,
                'total_days': requisition.total_days,
                'user_name': requisition.user.full_name,
                'replacement_confirmed': requisition.replacement_confirmed
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get replacement confirmation error: {e}")
        return jsonify({'error': 'Failed to fetch confirmation details'}), 500

@bp.route('/leave/confirm/<token>', methods=['POST'])
def confirm_replacement(token):
    try:
        requisition = Requisition.query.filter_by(replacement_token=token).first()
        if not requisition:
            return jsonify({'error': 'Invalid confirmation token'}), 404
        
        data = request.get_json()
        confirmed = data.get('confirmed', False)
        
        # Update replacement confirmation
        requisition.replacement_confirmed = confirmed
        
        # Parse existing changelog
        changelog = json.loads(requisition.changelog) if requisition.changelog else []
        
        # Add changelog entry
        replacement_name = requisition.replacement_user.full_name if requisition.replacement_user else requisition.replacement_name
        action = 'confirmed' if confirmed else 'declined'
        changelog_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'action': f'replacement_{action}',
            'user': replacement_name,
            'details': f"Replacement {action} by {replacement_name}"
        }
        changelog.append(changelog_entry)
        
        requisition.changelog = json.dumps(changelog)
        requisition.updated_at = datetime.utcnow()
        
        # If declined, reset status to pending
        if not confirmed and requisition.status == 'approved':
            requisition.status = 'pending'
            changelog_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': 'status_changed',
                'user': 'System',
                'details': 'Status reset to pending due to replacement decline'
            }
            changelog.append(changelog_entry)
            requisition.changelog = json.dumps(changelog)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Replacement {"confirmed" if confirmed else "declined"} successfully'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Confirm replacement error: {e}")
        return jsonify({'error': 'Failed to process confirmation'}), 500

@bp.route('/users/me/pending-replacement-requests', methods=['GET'])
@token_required
def get_pending_replacement_requests(current_user):
    try:
        # Find leave requests where current user is the replacement and confirmation is pending
        requests = Requisition.query.filter(
            Requisition.replacement_user_id == current_user.id,
            Requisition.replacement_confirmed == False,
            Requisition.requisition_type == 'leave'
        ).all()
        
        return jsonify({
            'requests': [req.to_dict() for req in requests]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get pending replacement requests error: {e}")
        return jsonify({'error': 'Failed to fetch pending requests'}), 500
