// Utility functions for the PES EMS application

// Date formatting utilities
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return formatDate(dateString);
}

// String utilities
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Status badge utilities
function getStatusBadge(status) {
    const statusClasses = {
        'pending': 'bg-warning text-dark',
        'approved': 'bg-success',
        'in_progress': 'bg-info',
        'completed': 'bg-success',
        'declined': 'bg-danger',
        'active': 'bg-success',
        'inactive': 'bg-secondary'
    };
    
    const className = statusClasses[status] || 'bg-secondary';
    return `<span class="badge ${className}">${capitalize(status.replace('_', ' '))}</span>`;
}

function getPriorityBadge(priority) {
    const priorityClasses = {
        'high': 'bg-danger',
        'medium': 'bg-warning text-dark',
        'low': 'bg-success'
    };
    
    const className = priorityClasses[priority] || 'bg-secondary';
    return `<span class="badge ${className}">${capitalize(priority)}</span>`;
}

// Get status badge class (for use in progress tracking)
function getStatusBadgeClass(status) {
    const statusClasses = {
        'pending': 'bg-warning text-dark',
        'approved': 'bg-success',
        'in_progress': 'bg-info',
        'completed': 'bg-success',
        'declined': 'bg-danger',
        'active': 'bg-success',
        'inactive': 'bg-secondary'
    };
    
    return statusClasses[status] || 'bg-secondary';
}

// Get priority badge class (for use in progress tracking)
function getPriorityBadgeClass(priority) {
    const priorityClasses = {
        'high': 'bg-danger',
        'medium': 'bg-warning text-dark',
        'low': 'bg-success'
    };
    
    return priorityClasses[priority] || 'bg-secondary';
}

// Alert utilities
function showAlert(message, type = 'info', containerId = 'alertContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const alertId = 'alert-' + Date.now();
    const alert = document.createElement('div');
    alert.id = alertId;
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(alert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            const bsAlert = new bootstrap.Alert(alertElement);
            bsAlert.close();
        }
    }, 5000);
}

// Loading state utilities
function showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center text-muted p-4">
            <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
            <p>${message}</p>
        </div>
    `;
}

function showEmptyState(containerId, message = 'No data available', icon = 'fas fa-inbox') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center text-muted p-4">
            <i class="${icon} fa-2x mb-3"></i>
            <p>${message}</p>
        </div>
    `;
}

// Form utilities
function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        // Clear any validation classes
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        form.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
    }
}

function validateForm(formId, rules) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    let isValid = true;
    
    Object.keys(rules).forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (!field) return;
        
        const rule = rules[fieldName];
        let fieldValid = true;
        
        // Required validation
        if (rule.required && !field.value.trim()) {
            fieldValid = false;
        }
        
        // Email validation
        if (rule.email && field.value && !validateEmail(field.value)) {
            fieldValid = false;
        }
        
        // Update field appearance
        if (fieldValid) {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
        } else {
            field.classList.remove('is-valid');
            field.classList.add('is-invalid');
            isValid = false;
        }
    });
    
    return isValid;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Password toggle utility
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const toggle = document.getElementById(fieldId + 'Toggle');
    
    if (!field || !toggle) return;
    
    if (field.type === 'password') {
        field.type = 'text';
        toggle.className = 'fas fa-eye-slash';
    } else {
        field.type = 'password';
        toggle.className = 'fas fa-eye';
    }
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Calculate business days between two dates
function calculateBusinessDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let days = 0;
    
    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
            days++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return days;
}

// PDF generation utility
function generatePDF(element, filename = 'document.pdf') {
    const options = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(options).from(element).save();
}

// Sanitize input to prevent XSS
function sanitizeInput(input) {
    if (!input) return '';
    
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showAlert('Failed to copy to clipboard', 'danger');
    });
}

// Export utilities for global use
window.utils = {
    formatDate,
    formatDateTime,
    formatTimeAgo,
    capitalize,
    truncateText,
    getStatusBadge,
    getPriorityBadge,
    showAlert,
    showLoading,
    showEmptyState,
    resetForm,
    validateForm,
    validateEmail,
    togglePassword,
    debounce,
    calculateBusinessDays,
    generatePDF,
    sanitizeInput,
    formatFileSize,
    copyToClipboard
};
