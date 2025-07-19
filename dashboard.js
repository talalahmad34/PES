// Dashboard functionality for PES EMS

// Global variables
let currentUser = null;
let dashboardData = {
    stats: {},
    recentActivity: [],
    pendingReplacements: []
};

// Dashboard widget configuration
const defaultWidgets = [
    { id: 'stats', type: 'stats', title: 'Quick Stats', enabled: true, size: 'col-12' },
    { id: 'recent-activity', type: 'recent-activity', title: 'Recent Activity', enabled: true, size: 'col-md-6' },
    { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', enabled: true, size: 'col-md-6' },
    { id: 'pending-approvals', type: 'pending-approvals', title: 'Pending Approvals', enabled: true, size: 'col-md-6' }
];

// Initialize dashboard
async function initializeDashboard() {
    try {
        currentUser = getCurrentUser();
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        updateUserInterface();
        await loadDashboardWidgets();
        await loadDashboardData();
        await loadPendingReplacements();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to initialize dashboard', 'danger');
    }
}

// Update user interface based on current user
function updateUserInterface() {
    // Update user name in navbar
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = currentUser.full_name;
    }
    
    // Update dashboard greeting
    const dashboardUserNameElement = document.getElementById('dashboardUserName');
    if (dashboardUserNameElement) {
        dashboardUserNameElement.textContent = currentUser.full_name;
    }
    
    // Update last login time
    const lastLoginElement = document.getElementById('lastLogin');
    if (lastLoginElement) {
        lastLoginElement.textContent = formatDateTime(new Date().toISOString());
    }
    
    // Update navigation based on user role
    updateNavigation();
}

// Update navigation based on user role
function updateNavigation() {
    const navItems = document.getElementById('navItems');
    if (!navItems) return;
    
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt', onclick: 'loadDashboard()' },
        { id: 'it-requisition', label: 'IT Requests', icon: 'fas fa-laptop', onclick: 'loadITRequisition()' },
        { id: 'conference-room', label: 'Conference Room', icon: 'fas fa-users', onclick: 'loadConferenceRoom()' },
        { id: 'leave-request', label: 'Leave Request', icon: 'fas fa-calendar-alt', onclick: 'loadLeaveRequest()' }
    ];
    
    // Add role-specific menu items
    if (currentUser.role === 'it') {
        menuItems.push({ id: 'user-management', label: 'User Management', icon: 'fas fa-users-cog', onclick: 'loadUserManagement()' });
    }
    
    if (currentUser.role === 'manager' || currentUser.role === 'it') {
        menuItems.push({ id: 'approvals', label: 'Approvals', icon: 'fas fa-check-circle', onclick: 'loadApprovals()' });
    }
    
    navItems.innerHTML = menuItems.map(item => `
        <li class="nav-item">
            <a class="nav-link" href="#" onclick="${item.onclick}">
                <i class="${item.icon} me-2"></i>${item.label}
            </a>
        </li>
    `).join('');
}

// Load dashboard data
async function loadDashboardData() {
    try {
        showLoading('recentActivityContainer', 'Loading dashboard data...');
        
        // Load user's requisitions for stats
        const [itResponse, conferenceResponse, leaveResponse] = await Promise.all([
            api.get('/requisitions?type=it'),
            api.get('/requisitions?type=conference_room'),
            api.get('/requisitions?type=leave')
        ]);
        
        const itRequisitions = itResponse.data.requisitions || [];
        const conferenceRequisitions = conferenceResponse.data.requisitions || [];
        const leaveRequisitions = leaveResponse.data.requisitions || [];
        
        // Update stats
        updateDashboardStats(itRequisitions, conferenceRequisitions, leaveRequisitions);
        
        // Load recent activity
        const allRequisitions = [...itRequisitions, ...conferenceRequisitions, ...leaveRequisitions];
        updateRecentActivity(allRequisitions);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showEmptyState('recentActivityContainer', 'Failed to load dashboard data');
    }
}

// Update dashboard statistics
function updateDashboardStats(itRequisitions, conferenceRequisitions, leaveRequisitions) {
    // Filter based on user role
    let userItRequisitions = itRequisitions;
    let userConferenceRequisitions = conferenceRequisitions;
    let userLeaveRequisitions = leaveRequisitions;
    
    if (currentUser.role === 'employee') {
        userItRequisitions = itRequisitions.filter(req => req.user_id === currentUser.id);
        userConferenceRequisitions = conferenceRequisitions.filter(req => req.user_id === currentUser.id);
        userLeaveRequisitions = leaveRequisitions.filter(req => req.user_id === currentUser.id);
    }
    
    // Update counts
    document.getElementById('itRequestsCount').textContent = userItRequisitions.length;
    document.getElementById('conferenceRequestsCount').textContent = userConferenceRequisitions.length;
    document.getElementById('leaveRequestsCount').textContent = userLeaveRequisitions.length;
    
    // Count pending approvals for managers/IT
    let pendingApprovals = 0;
    if (currentUser.role === 'manager' || currentUser.role === 'it') {
        pendingApprovals = [...itRequisitions, ...conferenceRequisitions, ...leaveRequisitions]
            .filter(req => req.status === 'pending').length;
    }
    
    document.getElementById('pendingApprovalsCount').textContent = pendingApprovals;
}

// Update recent activity
function updateRecentActivity(requisitions) {
    const container = document.getElementById('recentActivityContainer');
    if (!container) return;
    
    // Sort by creation date
    const sortedRequisitions = requisitions
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10); // Show last 10 activities
    
    if (sortedRequisitions.length === 0) {
        showEmptyState('recentActivityContainer', 'No recent activity');
        return;
    }
    
    const activityHtml = sortedRequisitions.map(req => {
        const icon = getRequisitionIcon(req.requisition_type);
        return `
            <div class="d-flex align-items-start mb-3 pb-3 border-bottom">
                <div class="flex-shrink-0 me-3">
                    <i class="${icon} fa-lg text-primary"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${req.display_id}: ${truncateText(req.subject, 40)}</h6>
                            <p class="mb-1 text-muted">${truncateText(req.description, 80)}</p>
                            <div class="d-flex align-items-center">
                                ${getStatusBadge(req.status)}
                                ${getPriorityBadge(req.priority)}
                                <small class="text-muted ms-2">by ${req.user_name}</small>
                            </div>
                        </div>
                        <div class="d-flex flex-column align-items-end">
                            <small class="text-muted mb-2">${formatTimeAgo(req.created_at)}</small>
                            <button type="button" class="btn btn-sm btn-outline-info" 
                                    onclick="viewRequisitionDetailsFromDashboard('${req.id}', '${req.requisition_type}')">
                                <i class="fas fa-eye me-1"></i>Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = activityHtml;
}

// Load pending replacement requests
async function loadPendingReplacements() {
    try {
        const response = await api.get('/users/me/pending-replacement-requests');
        const pendingRequests = response.data.requests || [];
        
        if (pendingRequests.length > 0) {
            showPendingReplacementAlert(pendingRequests);
        }
        
    } catch (error) {
        console.error('Error loading pending replacements:', error);
    }
}

// Show pending replacement alert
function showPendingReplacementAlert(requests) {
    const alertElement = document.getElementById('pendingReplacementAlert');
    const countElement = document.getElementById('pendingCount');
    
    if (alertElement && countElement) {
        countElement.textContent = requests.length;
        alertElement.classList.remove('d-none');
    }
}

// Show pending replacement requests modal
async function showPendingReplacements() {
    try {
        const response = await api.get('/users/me/pending-replacement-requests');
        const requests = response.data.requests || [];
        
        const modal = new bootstrap.Modal(document.getElementById('pendingReplacementModal'));
        const content = document.getElementById('pendingReplacementContent');
        
        if (requests.length === 0) {
            content.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-check-circle fa-3x mb-3"></i>
                    <p>No pending replacement confirmations.</p>
                </div>
            `;
        } else {
            content.innerHTML = requests.map(req => `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="card-title">${req.display_id}: ${req.subject}</h6>
                                <p class="card-text text-muted">${req.description}</p>
                                <div class="row">
                                    <div class="col-md-6">
                                        <small><strong>Employee:</strong> ${req.user_name}</small>
                                    </div>
                                    <div class="col-md-6">
                                        <small><strong>Leave Period:</strong> ${formatDate(req.start_date)} to ${formatDate(req.end_date)}</small>
                                    </div>
                                </div>
                            </div>
                            <div class="text-end">
                                <button type="button" class="btn btn-sm btn-success me-2" 
                                        onclick="confirmReplacement('${req.replacement_token}', true)">
                                    <i class="fas fa-check me-1"></i>Accept
                                </button>
                                <button type="button" class="btn btn-sm btn-danger" 
                                        onclick="confirmReplacement('${req.replacement_token}', false)">
                                    <i class="fas fa-times me-1"></i>Decline
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        modal.show();
        
    } catch (error) {
        console.error('Error loading pending replacements:', error);
        showAlert('Failed to load pending replacement requests', 'danger');
    }
}

// Refresh recent activity
async function refreshRecentActivity() {
    await loadDashboardData();
    showAlert('Recent activity refreshed', 'success');
}

// Get requisition icon based on type
function getRequisitionIcon(type) {
    const icons = {
        'it': 'fas fa-laptop',
        'conference_room': 'fas fa-users',
        'leave': 'fas fa-calendar-alt'
    };
    return icons[type] || 'fas fa-file';
}

// Navigation functions
function loadDashboard() {
    loadContent('dashboard.html');
}

function loadITRequisition() {
    loadContent('it-requisition.html');
}

function loadConferenceRoom() {
    loadContent('conference-room.html');
}

function loadLeaveRequest() {
    loadContent('leave-request.html');
}

function loadUserManagement() {
    if (currentUser.role !== 'it') {
        showAlert('Access denied. IT privileges required.', 'danger');
        return;
    }
    loadContent('user-management.html');
}

function loadProfile() {
    loadContent('profile.html');
}

function loadApprovals() {
    if (!hasAnyRole(['manager', 'it'])) {
        showAlert('Access denied. Manager or IT privileges required.', 'danger');
        return;
    }
    // Load approvals view (can be implemented as a filtered requisitions view)
    loadContent('it-requisition.html');
}

// Load content into main area
async function loadContent(contentFile) {
    try {
        const response = await fetch(contentFile);
        if (!response.ok) throw new Error('Failed to load content');
        
        const content = await response.text();
        document.getElementById('mainContent').innerHTML = content;
        
        // Initialize content-specific functionality
        if (contentFile.includes('dashboard')) {
            initializeDashboard();
        } else if (contentFile.includes('profile')) {
            initializeProfile();
        } else if (contentFile.includes('user-management')) {
            initializeUserManagement();
        } else if (contentFile.includes('requisition') || contentFile.includes('conference') || contentFile.includes('leave')) {
            initializeRequisitions();
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        showAlert('Failed to load content', 'danger');
    }
}

// Initialize the application
function initializeApp() {
    currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Load dashboard by default
    loadDashboard();
}

// View requisition details from dashboard  
function viewRequisitionDetailsFromDashboard(requisitionId, type) {
    // Store the requisition data temporarily
    window.dashboardRequisitionId = requisitionId;
    window.dashboardRequisitionType = type;
    
    // Navigate to the appropriate page and trigger details view
    if (type === 'it') {
        loadContent('it-requisition.html');
    } else if (type === 'conference_room') {
        loadContent('conference-room.html');
    } else if (type === 'leave') {
        loadContent('leave-request.html');
    }
    
    // After a short delay, trigger the details view
    setTimeout(() => {
        if (window.viewRequisitionDetails) {
            window.viewRequisitionDetails(requisitionId);
        }
    }, 500);
}

// Confirm replacement availability
async function confirmReplacement(token, confirmed) {
    try {
        await api.post(`/leave/confirm/${token}`, { confirmed });
        
        const action = confirmed ? 'accepted' : 'declined';
        showAlert(`Replacement request ${action} successfully`, 'success');
        
        // Refresh the modal content
        setTimeout(() => {
            showPendingReplacements();
            loadPendingReplacements(); // Refresh the alert count
        }, 1000);
        
    } catch (error) {
        console.error('Error confirming replacement:', error);
        const message = error.response?.data?.error || 'Failed to confirm replacement';
        showAlert(message, 'danger');
    }
}

// Load dashboard widgets
async function loadDashboardWidgets() {
    try {
        // Get user's widget configuration from localStorage
        const savedConfig = localStorage.getItem(`dashboardWidgets_${currentUser.id}`);
        let widgetConfig = savedConfig ? JSON.parse(savedConfig) : defaultWidgets;
        
        const container = document.getElementById('dashboardWidgets');
        if (!container) return;
        
        // Clear existing widgets
        container.innerHTML = '';
        
        // Render enabled widgets
        widgetConfig.filter(widget => widget.enabled).forEach(widget => {
            const widgetHtml = createWidget(widget);
            container.insertAdjacentHTML('beforeend', widgetHtml);
        });
        
    } catch (error) {
        console.error('Error loading dashboard widgets:', error);
        // Fallback to default widgets
        loadDefaultWidgets();
    }
}

// Create widget HTML
function createWidget(widget) {
    switch (widget.type) {
        case 'stats':
            return createStatsWidget(widget);
        case 'recent-activity':
            return createRecentActivityWidget(widget);
        case 'quick-actions':
            return createQuickActionsWidget(widget);
        case 'pending-approvals':
            return createPendingApprovalsWidget(widget);
        default:
            return '';
    }
}

// Create stats widget
function createStatsWidget(widget) {
    return `
        <div class="${widget.size} mb-3" data-widget-id="${widget.id}">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${widget.title}</h6>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="removeWidget('${widget.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-3 mb-3">
                            <div class="card bg-primary text-white">
                                <div class="card-body text-center">
                                    <i class="fas fa-laptop fa-2x mb-2"></i>
                                    <h4 id="itRequestsCount">0</h4>
                                    <small>IT Requests</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card bg-success text-white">
                                <div class="card-body text-center">
                                    <i class="fas fa-users fa-2x mb-2"></i>
                                    <h4 id="conferenceRequestsCount">0</h4>
                                    <small>Conference Bookings</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card bg-info text-white">
                                <div class="card-body text-center">
                                    <i class="fas fa-calendar-alt fa-2x mb-2"></i>
                                    <h4 id="leaveRequestsCount">0</h4>
                                    <small>Leave Requests</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 mb-3">
                            <div class="card bg-warning text-dark">
                                <div class="card-body text-center">
                                    <i class="fas fa-clock fa-2x mb-2"></i>
                                    <h4 id="pendingApprovalsCount">0</h4>
                                    <small>Pending Approvals</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create recent activity widget
function createRecentActivityWidget(widget) {
    return `
        <div class="${widget.size} mb-3" data-widget-id="${widget.id}">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${widget.title}</h6>
                    <div>
                        <button type="button" class="btn btn-sm btn-outline-primary me-2" onclick="refreshRecentActivity()">
                            <i class="fas fa-sync"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="removeWidget('${widget.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                    <div id="recentActivityContainer">
                        <div class="text-center text-muted">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading recent activity...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create quick actions widget
function createQuickActionsWidget(widget) {
    return `
        <div class="${widget.size} mb-3" data-widget-id="${widget.id}">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${widget.title}</h6>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="removeWidget('${widget.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4 mb-2">
                            <button type="button" class="btn btn-primary w-100" onclick="loadITRequisition()">
                                <i class="fas fa-laptop me-2"></i>IT Request
                            </button>
                        </div>
                        <div class="col-md-4 mb-2">
                            <button type="button" class="btn btn-success w-100" onclick="loadConferenceRoom()">
                                <i class="fas fa-users me-2"></i>Book Room
                            </button>
                        </div>
                        <div class="col-md-4 mb-2">
                            <button type="button" class="btn btn-info w-100" onclick="loadLeaveRequest()">
                                <i class="fas fa-calendar-alt me-2"></i>Leave Request
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create pending approvals widget
function createPendingApprovalsWidget(widget) {
    if (currentUser.role === 'employee') return ''; // Only for managers/IT
    
    return `
        <div class="${widget.size} mb-3" data-widget-id="${widget.id}">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${widget.title}</h6>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="removeWidget('${widget.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="card-body" style="max-height: 300px; overflow-y: auto;">
                    <div id="pendingApprovalsContainer">
                        <div class="text-center text-muted">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading pending approvals...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Customize dashboard
function customizeDashboard() {
    const savedConfig = localStorage.getItem(`dashboardWidgets_${currentUser.id}`);
    let widgetConfig = savedConfig ? JSON.parse(savedConfig) : defaultWidgets;
    
    const modalHtml = `
        <div class="modal fade" id="customizeDashboardModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Customize Dashboard</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">Select which widgets to display on your dashboard and configure their layout.</p>
                        <div class="row">
                            ${widgetConfig.map(widget => `
                                <div class="col-md-6 mb-3">
                                    <div class="card ${widget.enabled ? 'border-primary' : ''}">
                                        <div class="card-body">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="widget_${widget.id}" 
                                                       ${widget.enabled ? 'checked' : ''} onchange="toggleWidget('${widget.id}')">
                                                <label class="form-check-label" for="widget_${widget.id}">
                                                    <strong>${widget.title}</strong>
                                                </label>
                                            </div>
                                            <small class="text-muted">Type: ${widget.type.replace('-', ' ')}</small>
                                            <div class="mt-2">
                                                <label class="form-label">Size:</label>
                                                <select class="form-select form-select-sm" onchange="changeWidgetSize('${widget.id}', this.value)">
                                                    <option value="col-12" ${widget.size === 'col-12' ? 'selected' : ''}>Full Width</option>
                                                    <option value="col-md-6" ${widget.size === 'col-md-6' ? 'selected' : ''}>Half Width</option>
                                                    <option value="col-md-4" ${widget.size === 'col-md-4' ? 'selected' : ''}>One Third</option>
                                                    <option value="col-md-3" ${widget.size === 'col-md-3' ? 'selected' : ''}>One Quarter</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="saveWidgetConfiguration()">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('customizeDashboardModal');
    if (existingModal) existingModal.remove();
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('customizeDashboardModal'));
    modal.show();
}

// Save widget configuration
function saveWidgetConfiguration() {
    const savedConfig = localStorage.getItem(`dashboardWidgets_${currentUser.id}`);
    let widgetConfig = savedConfig ? JSON.parse(savedConfig) : defaultWidgets;
    
    // Save configuration
    localStorage.setItem(`dashboardWidgets_${currentUser.id}`, JSON.stringify(widgetConfig));
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('customizeDashboardModal'));
    modal.hide();
    
    // Reload widgets
    loadDashboardWidgets();
    
    showAlert('Dashboard customization saved successfully', 'success');
}

// Toggle widget enabled/disabled
function toggleWidget(widgetId) {
    const savedConfig = localStorage.getItem(`dashboardWidgets_${currentUser.id}`);
    let widgetConfig = savedConfig ? JSON.parse(savedConfig) : defaultWidgets;
    
    const widget = widgetConfig.find(w => w.id === widgetId);
    if (widget) {
        widget.enabled = !widget.enabled;
        localStorage.setItem(`dashboardWidgets_${currentUser.id}`, JSON.stringify(widgetConfig));
    }
}

// Change widget size
function changeWidgetSize(widgetId, size) {
    const savedConfig = localStorage.getItem(`dashboardWidgets_${currentUser.id}`);
    let widgetConfig = savedConfig ? JSON.parse(savedConfig) : defaultWidgets;
    
    const widget = widgetConfig.find(w => w.id === widgetId);
    if (widget) {
        widget.size = size;
        localStorage.setItem(`dashboardWidgets_${currentUser.id}`, JSON.stringify(widgetConfig));
    }
}

// Remove widget from dashboard
function removeWidget(widgetId) {
    const savedConfig = localStorage.getItem(`dashboardWidgets_${currentUser.id}`);
    let widgetConfig = savedConfig ? JSON.parse(savedConfig) : defaultWidgets;
    
    const widget = widgetConfig.find(w => w.id === widgetId);
    if (widget) {
        widget.enabled = false;
        localStorage.setItem(`dashboardWidgets_${currentUser.id}`, JSON.stringify(widgetConfig));
        loadDashboardWidgets();
        showAlert(`${widget.title} widget removed`, 'info');
    }
}

// Export functions for global use
window.initializeDashboard = initializeDashboard;
window.loadDashboard = loadDashboard;
window.loadITRequisition = loadITRequisition;
window.loadConferenceRoom = loadConferenceRoom;
window.loadLeaveRequest = loadLeaveRequest;
window.loadUserManagement = loadUserManagement;
window.loadProfile = loadProfile;
window.initializeApp = initializeApp;
window.showPendingReplacements = showPendingReplacements;
window.refreshRecentActivity = refreshRecentActivity;
window.viewRequisitionDetailsFromDashboard = viewRequisitionDetailsFromDashboard;
window.confirmReplacement = confirmReplacement;
window.customizeDashboard = customizeDashboard;
window.saveWidgetConfiguration = saveWidgetConfiguration;
