// User management functionality for IT administrators

let allUsers = [];
let filteredUsers = [];

// Initialize user management page
async function initializeUserManagement() {
    try {
        const user = getCurrentUser();
        if (!user || user.role !== 'it') {
            showAlert('Access denied. IT privileges required.', 'danger');
            return;
        }
        
        await loadUsers();
        setupEventListeners();
        
    } catch (error) {
        console.error('User management initialization error:', error);
        showAlert('Failed to initialize user management', 'danger');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Filter functionality
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (roleFilter) {
        roleFilter.addEventListener('change', handleFilter);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilter);
    }
    
    // User form
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleUserSubmit);
    }
}

// Load users from API
async function loadUsers() {
    try {
        showLoading('usersTableBody', 'Loading users...');
        
        const response = await api.get('/users');
        allUsers = response.data.users || [];
        filteredUsers = [...allUsers];
        
        renderUsersTable();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showEmptyState('usersTableBody', 'Failed to load users');
    }
}

// Render users table
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-users fa-2x mb-2"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-placeholder me-2">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div class="fw-bold">${user.full_name}</div>
                        <small class="text-muted">${user.designation || 'No designation'}</small>
                    </div>
                </div>
            </td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${getRoleBadge(user.role)}</td>
            <td>${user.designation || '-'}</td>
            <td>${getStatusBadge(user.is_active ? 'active' : 'inactive')}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary" 
                            onclick="editUser(${user.id})" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-outline-${user.is_active ? 'warning' : 'success'}" 
                            onclick="toggleUserStatus(${user.id})" 
                            title="${user.is_active ? 'Deactivate' : 'Activate'} User">
                        <i class="fas fa-${user.is_active ? 'pause' : 'play'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Handle search
function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    
    if (query === '') {
        filteredUsers = [...allUsers];
    } else {
        filteredUsers = allUsers.filter(user => 
            user.full_name.toLowerCase().includes(query) ||
            user.username.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        );
    }
    
    applyFilters();
}

// Handle filters
function handleFilter() {
    applyFilters();
}

// Apply filters
function applyFilters() {
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    let filtered = [...allUsers];
    
    // Apply search filter
    const searchQuery = document.getElementById('userSearch').value.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(user => 
            user.full_name.toLowerCase().includes(searchQuery) ||
            user.username.toLowerCase().includes(searchQuery) ||
            user.email.toLowerCase().includes(searchQuery)
        );
    }
    
    // Apply role filter
    if (roleFilter) {
        filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    // Apply status filter
    if (statusFilter) {
        const isActive = statusFilter === 'active';
        filtered = filtered.filter(user => user.is_active === isActive);
    }
    
    filteredUsers = filtered;
    renderUsersTable();
}

// Show create user modal
function showCreateUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    const form = document.getElementById('userForm');
    
    // Reset form
    resetForm('userForm');
    
    // Update modal title
    document.getElementById('userModalTitle').innerHTML = 
        '<i class="fas fa-user-plus me-2"></i>Create New User';
    
    // Show password section
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('statusSection').style.display = 'none';
    
    // Make password required
    document.getElementById('userPassword').required = true;
    document.getElementById('userConfirmPassword').required = true;
    
    // Clear alert container
    document.getElementById('userModalAlertContainer').innerHTML = '';
    
    modal.show();
}

// Edit user
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    const form = document.getElementById('userForm');
    
    // Populate form
    document.getElementById('userId').value = user.id;
    document.getElementById('userFullName').value = user.full_name;
    document.getElementById('userDesignation').value = user.designation || '';
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userPhone').value = user.phone_extension || '';
    document.getElementById('userIsActive').checked = user.is_active;
    
    // Update modal title
    document.getElementById('userModalTitle').innerHTML = 
        '<i class="fas fa-user-edit me-2"></i>Edit User';
    
    // Hide password section for editing
    document.getElementById('passwordSection').style.display = 'none';
    document.getElementById('statusSection').style.display = 'block';
    
    // Make password not required
    document.getElementById('userPassword').required = false;
    document.getElementById('userConfirmPassword').required = false;
    
    // Clear alert container
    document.getElementById('userModalAlertContainer').innerHTML = '';
    
    modal.show();
}

// Handle user form submit
async function handleUserSubmit(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveUserBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        // Show loading state
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        saveBtn.disabled = true;
        
        const formData = new FormData(event.target);
        const userId = formData.get('user_id');
        const isEditing = !!userId;
        
        const data = {
            full_name: formData.get('full_name'),
            designation: formData.get('designation'),
            username: formData.get('username'),
            email: formData.get('email'),
            role: formData.get('role'),
            phone_extension: formData.get('phone_extension')
        };
        
        // Add password for new users
        if (!isEditing) {
            data.password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            
            if (data.password !== confirmPassword) {
                showAlert('Passwords do not match', 'danger', 'userModalAlertContainer');
                return;
            }
        } else {
            data.is_active = formData.get('is_active') === 'on';
        }
        
        // Validate required fields
        const requiredFields = ['full_name', 'username', 'email', 'role'];
        for (const field of requiredFields) {
            if (!data[field]) {
                showAlert(`${field.replace('_', ' ')} is required`, 'danger', 'userModalAlertContainer');
                return;
            }
        }
        
        // Validate email
        if (!validateEmail(data.email)) {
            showAlert('Please enter a valid email address', 'danger', 'userModalAlertContainer');
            return;
        }
        
        let response;
        if (isEditing) {
            response = await api.put(`/users/${userId}`, data);
        } else {
            response = await api.post('/users', data);
        }
        
        showAlert(`User ${isEditing ? 'updated' : 'created'} successfully`, 'success', 'userModalAlertContainer');
        
        // Refresh users list
        await loadUsers();
        
        // Close modal after success
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
            modal.hide();
        }, 2000);
        
    } catch (error) {
        console.error('User save error:', error);
        const message = error.response?.data?.error || 'Failed to save user';
        showAlert(message, 'danger', 'userModalAlertContainer');
        
    } finally {
        // Reset button state
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Toggle user status
async function toggleUserStatus(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const action = user.is_active ? 'deactivate' : 'activate';
    const confirmed = confirm(`Are you sure you want to ${action} ${user.full_name}?`);
    
    if (!confirmed) return;
    
    try {
        await api.put(`/users/${userId}`, { is_active: !user.is_active });
        
        showAlert(`User ${action}d successfully`, 'success');
        await loadUsers();
        
    } catch (error) {
        console.error('Error toggling user status:', error);
        const message = error.response?.data?.error || `Failed to ${action} user`;
        showAlert(message, 'danger');
    }
}

// Refresh users list
async function refreshUsersList() {
    await loadUsers();
    showAlert('Users list refreshed', 'success');
}

// Get role badge
function getRoleBadge(role) {
    const roleBadges = {
        'employee': 'bg-secondary',
        'manager': 'bg-info',
        'it': 'bg-success'
    };
    
    const className = roleBadges[role] || 'bg-secondary';
    return `<span class="badge ${className}">${capitalize(role)}</span>`;
}

// Export functions for global use
window.initializeUserManagement = initializeUserManagement;
window.showCreateUserModal = showCreateUserModal;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.refreshUsersList = refreshUsersList;
