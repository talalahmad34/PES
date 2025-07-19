// Profile management functionality

// Initialize profile page
async function initializeProfile() {
    try {
        const user = getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Load current user data
        await loadUserProfile();
        
        // Setup form handlers
        setupProfileForm();
        setupChangePasswordForm();
        
    } catch (error) {
        console.error('Profile initialization error:', error);
        showAlert('Failed to initialize profile', 'danger', 'profileAlertContainer');
    }
}

// Load user profile data
async function loadUserProfile() {
    try {
        const response = await api.get('/auth/me');
        const user = response.data.user;
        
        // Update stored user data
        updateUserData(user);
        
        // Populate form fields
        document.getElementById('profileFullName').value = user.full_name || '';
        document.getElementById('profileDesignation').value = user.designation || '';
        document.getElementById('profileUsername').value = user.username || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profilePhone').value = user.phone_extension || '';
        document.getElementById('profileRole').value = capitalize(user.role) || '';
        document.getElementById('profileCreated').value = formatDateTime(user.created_at);
        document.getElementById('profileUpdated').value = formatDateTime(user.updated_at);
        
    } catch (error) {
        console.error('Error loading user profile:', error);
        showAlert('Failed to load profile data', 'danger', 'profileAlertContainer');
    }
}

// Setup profile form handlers
function setupProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;
    
    profileForm.addEventListener('submit', handleProfileUpdate);
}

// Handle profile update
async function handleProfileUpdate(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        // Show loading state
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        saveBtn.disabled = true;
        
        const formData = new FormData(event.target);
        const data = {
            full_name: formData.get('full_name'),
            designation: formData.get('designation'),
            email: formData.get('email'),
            phone_extension: formData.get('phone_extension')
        };
        
        // Validate required fields
        if (!data.full_name || !data.email) {
            showAlert('Full name and email are required', 'danger', 'profileAlertContainer');
            return;
        }
        
        // Validate email format
        if (!validateEmail(data.email)) {
            showAlert('Please enter a valid email address', 'danger', 'profileAlertContainer');
            return;
        }
        
        const response = await api.put('/users/me', data);
        
        if (response.data.user) {
            // Update stored user data
            updateUserData(response.data.user);
            
            // Update UI
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = response.data.user.full_name;
            }
            
            showAlert('Profile updated successfully', 'success', 'profileAlertContainer');
        }
        
    } catch (error) {
        console.error('Profile update error:', error);
        const message = error.response?.data?.error || 'Failed to update profile';
        showAlert(message, 'danger', 'profileAlertContainer');
        
    } finally {
        // Reset button state
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Setup change password form
function setupChangePasswordForm() {
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (!changePasswordForm) return;
    
    changePasswordForm.addEventListener('submit', handleChangePassword);
}

// Show change password modal
function showChangePasswordModal() {
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    modal.show();
    
    // Clear form when modal opens
    resetForm('changePasswordForm');
    document.getElementById('passwordAlertContainer').innerHTML = '';
}

// Handle password change
async function handleChangePassword(event) {
    event.preventDefault();
    
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const originalText = changePasswordBtn.innerHTML;
    
    try {
        // Show loading state
        changePasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Changing...';
        changePasswordBtn.disabled = true;
        
        const formData = new FormData(event.target);
        const data = {
            current_password: formData.get('current_password'),
            new_password: formData.get('new_password'),
            confirm_new_password: formData.get('confirm_new_password')
        };
        
        // Validate required fields
        if (!data.current_password || !data.new_password || !data.confirm_new_password) {
            showAlert('All fields are required', 'danger', 'passwordAlertContainer');
            return;
        }
        
        // Validate password confirmation
        if (data.new_password !== data.confirm_new_password) {
            showAlert('New passwords do not match', 'danger', 'passwordAlertContainer');
            return;
        }
        
        // Validate password strength
        if (data.new_password.length < 6) {
            showAlert('New password must be at least 6 characters long', 'danger', 'passwordAlertContainer');
            return;
        }
        
        const response = await api.post('/auth/change-password', {
            current_password: data.current_password,
            new_password: data.new_password
        });
        
        showAlert('Password changed successfully', 'success', 'passwordAlertContainer');
        
        // Close modal after success
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
            modal.hide();
            resetForm('changePasswordForm');
        }, 2000);
        
    } catch (error) {
        console.error('Change password error:', error);
        const message = error.response?.data?.error || 'Failed to change password';
        showAlert(message, 'danger', 'passwordAlertContainer');
        
    } finally {
        // Reset button state
        changePasswordBtn.innerHTML = originalText;
        changePasswordBtn.disabled = false;
    }
}

// Export functions for global use
window.initializeProfile = initializeProfile;
window.showChangePasswordModal = showChangePasswordModal;
