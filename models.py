from app import db
from datetime import datetime
import uuid
import secrets

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='employee')
    full_name = db.Column(db.String(120), nullable=False)
    designation = db.Column(db.String(100))
    phone_extension = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    requisitions = db.relationship('Requisition', foreign_keys='Requisition.user_id', backref='user', lazy='dynamic')
    replacement_requests = db.relationship('Requisition', foreign_keys='Requisition.replacement_user_id', backref='replacement_user', lazy='dynamic')
    tokens = db.relationship('Token', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'full_name': self.full_name,
            'designation': self.designation,
            'phone_extension': self.phone_extension,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active
        }

class Requisition(db.Model):
    __tablename__ = 'requisitions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_id = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    replacement_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    requisition_type = db.Column(db.String(20), nullable=False)  # 'it', 'conference_room', 'leave'
    status = db.Column(db.String(20), nullable=False, default='pending')
    changelog = db.Column(db.Text, nullable=False, default='[]')
    
    # Common fields
    subject = db.Column(db.String(200))
    description = db.Column(db.Text)
    priority = db.Column(db.String(20), default='medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # IT Requisition specific fields
    it_category = db.Column(db.String(50))
    assigned_to = db.Column(db.String(100))
    
    # Conference Room specific fields
    room_name = db.Column(db.String(100))
    start_datetime = db.Column(db.DateTime)
    end_datetime = db.Column(db.DateTime)
    attendees_count = db.Column(db.Integer)
    equipment_needed = db.Column(db.Text)
    
    # Leave Request specific fields
    leave_type = db.Column(db.String(20))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    total_days = db.Column(db.Integer)
    replacement_name = db.Column(db.String(120))
    replacement_confirmed = db.Column(db.Boolean, default=False)
    replacement_token = db.Column(db.String(100))
    
    def to_dict(self):
        result = {
            'id': self.id,
            'display_id': self.display_id,
            'user_id': self.user_id,
            'replacement_user_id': self.replacement_user_id,
            'requisition_type': self.requisition_type,
            'status': self.status,
            'changelog': self.changelog,
            'subject': self.subject,
            'description': self.description,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'user_name': self.user.full_name if self.user else None,
            'user_designation': self.user.designation if self.user else None,
            'user_email': self.user.email if self.user else None
        }
        
        # Add type-specific fields
        if self.requisition_type == 'it':
            result.update({
                'it_category': self.it_category,
                'assigned_to': self.assigned_to
            })
        elif self.requisition_type == 'conference_room':
            result.update({
                'room_name': self.room_name,
                'start_datetime': self.start_datetime.isoformat() if self.start_datetime else None,
                'end_datetime': self.end_datetime.isoformat() if self.end_datetime else None,
                'attendees_count': self.attendees_count,
                'equipment_needed': self.equipment_needed
            })
        elif self.requisition_type == 'leave':
            result.update({
                'leave_type': self.leave_type,
                'start_date': self.start_date.isoformat() if self.start_date else None,
                'end_date': self.end_date.isoformat() if self.end_date else None,
                'total_days': self.total_days,
                'replacement_name': self.replacement_name,
                'replacement_confirmed': self.replacement_confirmed,
                'replacement_user_name': self.replacement_user.full_name if self.replacement_user else None
            })
        
        return result

class Token(db.Model):
    __tablename__ = 'tokens'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(500), unique=True, nullable=False)
    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_valid = db.Column(db.Boolean, default=True)

class Counter(db.Model):
    __tablename__ = 'counters'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.Integer, default=0)
    
    @classmethod
    def get_next_value(cls, counter_name):
        counter = cls.query.filter_by(name=counter_name).first()
        if not counter:
            counter = cls(name=counter_name, value=0)
            db.session.add(counter)
        
        counter.value += 1
        db.session.commit()
        return counter.value
