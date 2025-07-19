from datetime import datetime
from flask import current_app
import logging

def log_error(message, error=None):
    """Log error messages with optional exception details"""
    if error:
        current_app.logger.error(f"{message}: {str(error)}")
    else:
        current_app.logger.error(message)

def format_datetime(dt):
    """Format datetime for display"""
    if not dt:
        return ''
    return dt.strftime('%Y-%m-%d %H:%M')

def format_date(d):
    """Format date for display"""
    if not d:
        return ''
    return d.strftime('%Y-%m-%d')

def calculate_business_days(start_date, end_date):
    """Calculate business days between two dates"""
    if not start_date or not end_date:
        return 0
    
    # Simple calculation - can be enhanced to exclude holidays
    delta = end_date - start_date
    days = delta.days + 1
    
    # Remove weekends (rough calculation)
    weeks = days // 7
    remaining_days = days % 7
    
    # Count weekdays in remaining days
    weekdays = 0
    current_date = start_date
    for i in range(remaining_days):
        if current_date.weekday() < 5:  # Monday = 0, Friday = 4
            weekdays += 1
        current_date = current_date + timedelta(days=1)
    
    return weeks * 5 + weekdays

def validate_email(email):
    """Basic email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def sanitize_input(text):
    """Basic input sanitization"""
    if not text:
        return ''
    
    # Remove potential script tags and other dangerous content
    import re
    text = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)
    
    return text.strip()
