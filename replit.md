# PES Employee Management System

## Overview

The PES Employee Management System is a Flask-based web application designed for Pakistan Engineering Services Pvt. Ltd. It provides a comprehensive platform for managing employee requisitions including IT requests, conference room bookings, and leave requests. The system features role-based access control with three main user types: employees, managers, and IT staff.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Flask web framework with Python
- **Database**: SQLAlchemy ORM with configurable database backend (defaults to SQLite, supports PostgreSQL)
- **Authentication**: JWT-based token authentication with role-based access control
- **API Design**: RESTful API endpoints with JSON responses
- **Security**: Rate limiting, CORS support, and secure password hashing

### Frontend Architecture
- **Technology**: Vanilla JavaScript with Bootstrap 5 for UI components
- **Theme**: Dark theme optimized for professional use
- **Architecture**: Single Page Application (SPA) with dynamic content loading
- **Libraries**: Axios for HTTP requests, Font Awesome for icons

### Database Schema
- **Users Table**: Stores user accounts with roles (employee, manager, it)
- **Requisitions Table**: Handles all types of requests (IT, conference room, leave)
- **Tokens Table**: Manages JWT authentication tokens
- **Counter Table**: Generates unique display IDs for requisitions

## Key Components

### Authentication System
- JWT token-based authentication with 24-hour expiration
- Role-based access control (RBAC) with three roles
- Password hashing using Werkzeug security
- Token storage and validation in database
- Session management with automatic logout on token expiration

### User Management
- IT staff can create and manage all user accounts
- Profile management for all users
- User activation/deactivation functionality
- Search and filtering capabilities

### Requisition Management
- **IT Requisitions**: Hardware, software, network, and support requests
- **Conference Room Bookings**: Room reservation system with approval workflow
- **Leave Requests**: Leave management with replacement user confirmation workflow

### Security Features
- Rate limiting (200 requests per day, 50 per hour)
- CORS protection with configurable origins
- Secure password storage with hashing
- Token-based authentication with database validation

## Data Flow

1. **Authentication Flow**: User login → JWT token generation → Token storage in database → Protected route access
2. **Requisition Flow**: User creates request → Manager/IT approval → Status updates → Completion tracking
3. **Replacement Confirmation**: Leave request → Replacement user notification → Token-based confirmation → Final approval

## External Dependencies

### Backend Dependencies
- Flask ecosystem (Flask, SQLAlchemy, CORS, Limiter)
- JWT authentication library
- Werkzeug for security utilities
- Python standard libraries for datetime and utilities

### Frontend Dependencies
- Bootstrap 5 (dark theme variant)
- Axios for HTTP requests
- Font Awesome for icons
- No heavy JavaScript frameworks - vanilla JS implementation

### Infrastructure
- SQLite for development (PostgreSQL ready for production)
- Static file serving through Flask
- Environment variable configuration support

## Deployment Strategy

### Development Setup
- SQLite database for local development
- Flask development server with debug mode
- Static file serving from Flask application
- Environment variables for configuration

### Production Considerations
- Database migration to PostgreSQL recommended
- WSGI server deployment (Gunicorn/uWSGI)
- Proxy configuration support (ProxyFix middleware included)
- Environment-based configuration management
- Rate limiting and security headers configured

### Configuration
- Database URL configurable via environment variables
- Session secret configurable for production security
- CORS origins configurable for different environments
- Debug mode controllable via environment settings

The system is designed to be self-hosted with maximum control over data and infrastructure, following security-first principles while maintaining ease of use for all employee roles.