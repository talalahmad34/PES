// Authentication utilities
function isAuthenticated() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    return !!(token && userData);
}

function getCurrentUser() {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
}

function logout() {
    // Call logout API
    api.post('/auth/logout').catch(error => {
        console.error('Logout API error:', error);
    });
    
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    // Redirect to login
    window.location.href = 'login.html';
}

function updateUserData(userData) {
    localStorage.setItem('user_data', JSON.stringify(userData));
}

function hasRole(role) {
    const user = getCurrentUser();
    return user && user.role === role;
}

function hasAnyRole(roles) {
    const user = getCurrentUser();
    return user && roles.includes(user.role);
}

function canManageUsers() {
    return hasRole('it');
}

function canApproveRequests() {
    return hasAnyRole(['manager', 'it']);
}

function canManageITRequests() {
    return hasRole('it');
}
