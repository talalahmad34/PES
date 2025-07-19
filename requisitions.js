// Requisitions management functionality

let currentRequisitions = [];
let currentRequisitionType = 'it'; // Default to IT requisitions

// Initialize requisitions page
async function initializeRequisitions() {
    try {
        const user = getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Determine requisition type based on current page
        const currentPath = window.location.pathname;
        if (currentPath.includes('it-requisition') || document.getElementById('itRequisitionsContainer')) {
            currentRequisitionType = 'it';
            await initializeITRequisitions();
        } else if (currentPath.includes('conference-room') || document.getElementById('conferenceRoomContainer')) {
            currentRequisitionType = 'conference_room';
            await initializeConferenceRoomRequisitions();
        } else if (currentPath.includes('leave-request') || document.getElementById('leaveRequestsContainer')) {
            currentRequisitionType = 'leave';
            await initializeLeaveRequests();
        }
        
    } catch (error) {
        console.error('Requisitions initialization error:', error);
        showAlert('Failed to initialize requisitions', 'danger');
    }
}

// Initialize IT Requisitions
async function initializeITRequisitions() {
    await loadRequisitions('it');
    setupITEventListeners();
}

// Initialize Conference Room Requisitions
async function initializeConferenceRoomRequisitions() {
    await loadRequisitions('conference_room');
    setupConferenceRoomEventListeners();
}

// Initialize Leave Requests
async function initializeLeaveRequests() {
    await loadRequisitions('leave');
    setupLeaveRequestEventListeners();
}

// Load requisitions from API
async function loadRequisitions(type) {
    try {
        const containerId = getContainerIdByType(type);
        showLoading(containerId, 'Loading requisitions...');
        
        const response = await api.get(`/requisitions?type=${type}`);
        currentRequisitions = response.data.requisitions || [];
        
        renderRequisitions(type);
        
    } catch (error) {
        console.error('Error loading requisitions:', error);
        const containerId = getContainerIdByType(type);
        showEmptyState(containerId, 'Failed to load requisitions');
    }
}

// Render requisitions based on type
function renderRequisitions(type) {
    const containerId = getContainerIdByType(type);
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    if (currentRequisitions.length === 0) {
        showEmptyState(containerId, `No ${type.replace('_', ' ')} requisitions found`);
        return;
    }
    
    const requisitionsHtml = currentRequisitions.map(req => {
        return renderRequisitionCard(req);
    }).join('');
    
    container.innerHTML = requisitionsHtml;
}

// Render individual requisition card
function renderRequisitionCard(req) {
    const canEdit = canEditRequisition(req);
    const canApprove = canApproveRequisition(req);
    
    return `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0">${req.display_id}: ${req.subject}</h6>
                            <div class="text-end">
                                ${getStatusBadge(req.status)}
                                ${getPriorityBadge(req.priority)}
                            </div>
                        </div>
                        <p class="card-text text-muted mb-2">${truncateText(req.description, 150)}</p>
                        <div class="row">
                            <div class="col-md-6">
                                <small class="text-muted">
                                    <i class="fas fa-user me-1"></i>
                                    ${req.user_name} (${req.user_designation || 'No designation'})
                                </small>
                            </div>
                            <div class="col-md-6">
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>
                                    ${formatDateTime(req.created_at)}
                                </small>
                            </div>
                        </div>
                        ${renderRequisitionSpecificInfo(req)}
                    </div>
                    <div class="col-md-4">
                        <div class="d-flex flex-column gap-2">
                            <button type="button" class="btn btn-sm btn-outline-info" 
                                    onclick="viewRequisitionDetails('${req.id}')">
                                <i class="fas fa-eye me-1"></i>View Details
                            </button>
                            ${canEdit ? `
                                <button type="button" class="btn btn-sm btn-outline-primary" 
                                        onclick="editRequisition('${req.id}')">
                                    <i class="fas fa-edit me-1"></i>Edit
                                </button>
                            ` : ''}
                            ${canApprove ? renderApprovalButtons(req) : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render requisition type-specific information
function renderRequisitionSpecificInfo(req) {
    if (req.requisition_type === 'it') {
        return `
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fas fa-tag me-1"></i>Category: ${capitalize(req.it_category || 'N/A')}
                    ${req.assigned_to ? `<i class="fas fa-user-cog ms-3 me-1"></i>Assigned to: ${req.assigned_to}` : ''}
                </small>
            </div>
        `;
    } else if (req.requisition_type === 'conference_room') {
        return `
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fas fa-door-open me-1"></i>Room: ${req.room_name || 'N/A'}
                    ${req.start_datetime ? `<i class="fas fa-calendar ms-3 me-1"></i>${formatDateTime(req.start_datetime)}` : ''}
                </small>
            </div>
        `;
    } else if (req.requisition_type === 'leave') {
        return `
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fas fa-calendar-check me-1"></i>Type: ${capitalize(req.leave_type || 'N/A')}
                    ${req.start_date ? `<i class="fas fa-calendar ms-3 me-1"></i>${formatDate(req.start_date)} - ${formatDate(req.end_date)}` : ''}
                    ${req.replacement_name ? `<i class="fas fa-user-friends ms-3 me-1"></i>Replacement: ${req.replacement_name}` : ''}
                </small>
            </div>
        `;
    }
    return '';
}

// Render approval buttons
function renderApprovalButtons(req) {
    const user = getCurrentUser();
    
    if (req.status === 'pending') {
        return `
            <button type="button" class="btn btn-sm btn-success" 
                    onclick="approveRequisition('${req.id}')">
                <i class="fas fa-check me-1"></i>Approve
            </button>
            <button type="button" class="btn btn-sm btn-danger" 
                    onclick="declineRequisition('${req.id}')">
                <i class="fas fa-times me-1"></i>Decline
            </button>
        `;
    }
    
    // Only show IT workflow buttons for IT requisitions, not leave requests
    if (req.status === 'approved' && user.role === 'it' && req.requisition_type === 'it') {
        return `
            <button type="button" class="btn btn-sm btn-info" 
                    onclick="markInProgress('${req.id}')">
                <i class="fas fa-play me-1"></i>Start Work
            </button>
        `;
    }
    
    if (req.status === 'in_progress' && user.role === 'it' && req.requisition_type === 'it') {
        return `
            <button type="button" class="btn btn-sm btn-success" 
                    onclick="markCompleted('${req.id}')">
                <i class="fas fa-check-circle me-1"></i>Mark Complete
            </button>
        `;
    }
    
    return '';
}

// Setup event listeners for IT requisitions
function setupITEventListeners() {
    // Filter listeners
    const statusFilter = document.getElementById('itStatusFilter');
    const categoryFilter = document.getElementById('itCategoryFilter');
    const priorityFilter = document.getElementById('itPriorityFilter');
    
    if (statusFilter) statusFilter.addEventListener('change', () => applyFilters('it'));
    if (categoryFilter) categoryFilter.addEventListener('change', () => applyFilters('it'));
    if (priorityFilter) priorityFilter.addEventListener('change', () => applyFilters('it'));
    
    // Form listener
    const form = document.getElementById('itRequisitionForm');
    if (form) form.addEventListener('submit', handleITRequisitionSubmit);
}

// Setup event listeners for conference room requisitions
function setupConferenceRoomEventListeners() {
    // Filter listeners
    const statusFilter = document.getElementById('crStatusFilter');
    const roomFilter = document.getElementById('crRoomFilter');
    const dateFilter = document.getElementById('crDateFilter');
    
    if (statusFilter) statusFilter.addEventListener('change', () => applyFilters('conference_room'));
    if (roomFilter) roomFilter.addEventListener('change', () => applyFilters('conference_room'));
    if (dateFilter) dateFilter.addEventListener('change', () => applyFilters('conference_room'));
    
    // Form listener
    const form = document.getElementById('conferenceRoomForm');
    if (form) form.addEventListener('submit', handleConferenceRoomSubmit);
}

// Setup event listeners for leave requests
function setupLeaveRequestEventListeners() {
    // Filter listeners
    const statusFilter = document.getElementById('leaveStatusFilter');
    const typeFilter = document.getElementById('leaveTypeFilter');
    const monthFilter = document.getElementById('leaveMonthFilter');
    
    if (statusFilter) statusFilter.addEventListener('change', () => applyFilters('leave'));
    if (typeFilter) typeFilter.addEventListener('change', () => applyFilters('leave'));
    if (monthFilter) monthFilter.addEventListener('change', () => applyFilters('leave'));
    
    // Form listener
    const form = document.getElementById('leaveRequestForm');
    if (form) form.addEventListener('submit', handleLeaveRequestSubmit);
    
    // Date change listeners for leave calculation
    const startDateInput = document.getElementById('leaveStartDate');
    const endDateInput = document.getElementById('leaveEndDate');
    
    if (startDateInput) startDateInput.addEventListener('change', calculateLeaveDays);
    if (endDateInput) endDateInput.addEventListener('change', calculateLeaveDays);
    
    // Replacement autocomplete
    const replacementInput = document.getElementById('leaveReplacement');
    if (replacementInput) {
        replacementInput.addEventListener('input', debounce(handleReplacementSearch, 300));
    }
}

// Handle IT requisition form submit
async function handleITRequisitionSubmit(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveITRequisitionBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
        saveBtn.disabled = true;
        
        const formData = new FormData(event.target);
        const data = {
            requisition_type: 'it',
            subject: formData.get('subject'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            it_category: formData.get('it_category')
        };
        
        await api.post('/requisitions', data);
        
        showAlert('IT request submitted successfully', 'success', 'itRequisitionAlertContainer');
        
        // Close modal and refresh
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('itRequisitionModal'));
            modal.hide();
            loadRequisitions('it');
        }, 2000);
        
    } catch (error) {
        console.error('IT requisition submit error:', error);
        const message = error.response?.data?.error || 'Failed to submit request';
        showAlert(message, 'danger', 'itRequisitionAlertContainer');
        
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Handle conference room form submit
async function handleConferenceRoomSubmit(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveConferenceRoomBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
        saveBtn.disabled = true;
        
        const formData = new FormData(event.target);
        const data = {
            requisition_type: 'conference_room',
            subject: formData.get('subject'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            room_name: formData.get('room_name'),
            start_datetime: formData.get('start_datetime'),
            end_datetime: formData.get('end_datetime'),
            attendees_count: formData.get('attendees_count'),
            equipment_needed: formData.get('equipment_needed')
        };
        
        await api.post('/requisitions', data);
        
        showAlert('Conference room booking submitted successfully', 'success', 'conferenceRoomAlertContainer');
        
        // Close modal and refresh
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('conferenceRoomModal'));
            modal.hide();
            loadRequisitions('conference_room');
        }, 2000);
        
    } catch (error) {
        console.error('Conference room submit error:', error);
        const message = error.response?.data?.error || 'Failed to submit booking';
        showAlert(message, 'danger', 'conferenceRoomAlertContainer');
        
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Handle leave request form submit
async function handleLeaveRequestSubmit(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveLeaveRequestBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
        saveBtn.disabled = true;
        
        const formData = new FormData(event.target);
        const data = {
            requisition_type: 'leave',
            subject: formData.get('subject'),
            description: formData.get('description'),
            leave_type: formData.get('leave_type'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            total_days: formData.get('total_days'),
            replacement_name: formData.get('replacement_name'),
            replacement_user_id: formData.get('replacement_user_id')
        };
        
        await api.post('/requisitions', data);
        
        showAlert('Leave request submitted successfully', 'success', 'leaveRequestAlertContainer');
        
        // Close modal and refresh
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('leaveRequestModal'));
            modal.hide();
            loadRequisitions('leave');
        }, 2000);
        
    } catch (error) {
        console.error('Leave request submit error:', error);
        const message = error.response?.data?.error || 'Failed to submit request';
        showAlert(message, 'danger', 'leaveRequestAlertContainer');
        
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Calculate leave days
function calculateLeaveDays() {
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    
    if (startDate && endDate) {
        const days = calculateBusinessDays(startDate, endDate);
        document.getElementById('leaveTotalDays').value = days;
    }
}

// Handle replacement search
async function handleReplacementSearch(event) {
    const query = event.target.value.trim();
    const suggestionsContainer = document.getElementById('replacementSuggestions');
    
    if (query.length < 2) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.remove('show');
        return;
    }
    
    try {
        const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
        const users = response.data.users || [];
        
        if (users.length === 0) {
            suggestionsContainer.innerHTML = '<div class="dropdown-item-text">No users found</div>';
        } else {
            suggestionsContainer.innerHTML = users.map(user => `
                <a class="dropdown-item" href="#" onclick="selectReplacement(${user.id}, '${user.full_name}')">
                    <div class="d-flex justify-content-between">
                        <span>${user.full_name}</span>
                        <small class="text-muted">${user.username}</small>
                    </div>
                </a>
            `).join('');
        }
        
        suggestionsContainer.classList.add('show');
        
    } catch (error) {
        console.error('Error searching users:', error);
        suggestionsContainer.innerHTML = '<div class="dropdown-item-text">Error searching users</div>';
    }
}

// Select replacement
function selectReplacement(userId, fullName) {
    document.getElementById('leaveReplacement').value = fullName;
    document.getElementById('leaveReplacementUserId').value = userId;
    document.getElementById('replacementSuggestions').classList.remove('show');
}

// Utility functions
function getContainerIdByType(type) {
    const containers = {
        'it': 'itRequisitionsContainer',
        'conference_room': 'conferenceRoomContainer',
        'leave': 'leaveRequestsContainer'
    };
    return containers[type];
}

function canEditRequisition(req) {
    const user = getCurrentUser();
    return user.id === req.user_id && req.status === 'pending';
}

function canApproveRequisition(req) {
    const user = getCurrentUser();
    return hasAnyRole(['manager', 'it']) && user.id !== req.user_id;
}

// Modal functions
function showCreateITRequisitionModal() {
    const modal = new bootstrap.Modal(document.getElementById('itRequisitionModal'));
    resetForm('itRequisitionForm');
    document.getElementById('itRequisitionAlertContainer').innerHTML = '';
    modal.show();
}

function showCreateConferenceRoomModal() {
    const modal = new bootstrap.Modal(document.getElementById('conferenceRoomModal'));
    resetForm('conferenceRoomForm');
    document.getElementById('conferenceRoomAlertContainer').innerHTML = '';
    modal.show();
}

function showCreateLeaveRequestModal() {
    const modal = new bootstrap.Modal(document.getElementById('leaveRequestModal'));
    resetForm('leaveRequestForm');
    document.getElementById('leaveRequestAlertContainer').innerHTML = '';
    modal.show();
}

// Apply filters
function applyFilters(type) {
    // Implementation depends on specific filter logic for each type
    // This is a placeholder that can be expanded
    console.log(`Applying filters for ${type}`);
}

// Refresh functions
function refreshITRequisitions() {
    loadRequisitions('it');
}

function refreshConferenceRoomBookings() {
    loadRequisitions('conference_room');
}

function refreshLeaveRequests() {
    loadRequisitions('leave');
}

// Status update functions
async function approveRequisition(requisitionId) {
    await updateRequisitionStatus(requisitionId, 'approved');
}

async function declineRequisition(requisitionId) {
    await updateRequisitionStatus(requisitionId, 'declined');
}

async function markInProgress(requisitionId) {
    await updateRequisitionStatus(requisitionId, 'in_progress');
}

async function markCompleted(requisitionId) {
    await updateRequisitionStatus(requisitionId, 'completed');
}

async function updateRequisitionStatus(requisitionId, status) {
    try {
        await api.put(`/requisitions/${requisitionId}`, { status });
        showAlert(`Requisition ${status.replace('_', ' ')} successfully`, 'success');
        
        // Refresh current requisitions
        const currentType = currentRequisitionType;
        await loadRequisitions(currentType);
        
    } catch (error) {
        console.error('Error updating requisition status:', error);
        const message = error.response?.data?.error || 'Failed to update status';
        showAlert(message, 'danger');
    }
}

// View requisition details with progress tracking
function viewRequisitionDetails(requisitionId) {
    const req = currentRequisitions.find(r => r.id === requisitionId);
    if (!req) return;
    
    console.log('View details for:', req);
    
    // Determine modal ID based on requisition type
    let modalId, titleId, contentId, actionsId;
    
    if (req.requisition_type === 'it') {
        modalId = 'itDetailsModal';
        titleId = 'itDetailsTitle';
        contentId = 'itDetailsContent';
        actionsId = 'itDetailsActions';
    } else {
        // For conference room and leave requests, we'll use a generic modal
        // If it doesn't exist, we'll create one dynamically
        modalId = 'requisitionDetailsModal';
        titleId = 'requisitionDetailsTitle';
        contentId = 'requisitionDetailsContent';
        actionsId = 'requisitionDetailsActions';
    }
    
    // Check if modal exists, if not create it
    let modal = document.getElementById(modalId);
    if (!modal) {
        createGenericDetailsModal(modalId, titleId, contentId, actionsId);
        modal = document.getElementById(modalId);
    }
    
    // Update modal content
    const title = document.getElementById(titleId);
    const content = document.getElementById(contentId);
    const actions = document.getElementById(actionsId);
    
    if (title) {
        const typeLabel = req.requisition_type === 'it' ? 'IT Request' : 
                         req.requisition_type === 'conference_room' ? 'Conference Room Booking' : 
                         'Leave Request';
        title.innerHTML = `<i class="fas fa-info-circle me-2"></i>${typeLabel} Details - ${req.display_id}`;
    }
    
    if (content) {
        content.innerHTML = renderRequisitionDetailsContent(req);
    }
    
    if (actions) {
        actions.innerHTML = renderRequisitionDetailsActions(req);
    }
    
    // Show modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

// Create generic details modal for conference room and leave requests
function createGenericDetailsModal(modalId, titleId, contentId, actionsId) {
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${titleId}">
                            <i class="fas fa-info-circle me-2"></i>Request Details
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="${contentId}">
                        <!-- Content loaded dynamically -->
                    </div>
                    <div class="modal-footer" id="${actionsId}">
                        <!-- Actions loaded dynamically -->
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Render detailed content for requisition
function renderRequisitionDetailsContent(req) {
    const statusBadge = getStatusBadgeClass(req.status);
    const priorityBadge = getPriorityBadgeClass(req.priority);
    
    let specificInfo = '';
    if (req.requisition_type === 'it') {
        specificInfo = `
            <div class="col-md-6">
                <strong>Category:</strong> ${capitalize(req.it_category || 'N/A')}
            </div>
            ${req.assigned_to ? `<div class="col-md-6"><strong>Assigned To:</strong> ${req.assigned_to}</div>` : ''}
        `;
    } else if (req.requisition_type === 'conference_room') {
        specificInfo = `
            <div class="col-md-6">
                <strong>Room:</strong> ${req.room_name || 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>Attendees:</strong> ${req.attendees_count || 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>Start Time:</strong> ${req.start_datetime ? formatDateTime(req.start_datetime) : 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>End Time:</strong> ${req.end_datetime ? formatDateTime(req.end_datetime) : 'N/A'}
            </div>
            ${req.equipment_needed ? `<div class="col-12"><strong>Equipment:</strong> ${req.equipment_needed}</div>` : ''}
        `;
    } else if (req.requisition_type === 'leave') {
        specificInfo = `
            <div class="col-md-6">
                <strong>Leave Type:</strong> ${capitalize(req.leave_type || 'N/A')}
            </div>
            <div class="col-md-6">
                <strong>Total Days:</strong> ${req.total_days || 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>Start Date:</strong> ${req.start_date ? formatDate(req.start_date) : 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>End Date:</strong> ${req.end_date ? formatDate(req.end_date) : 'N/A'}
            </div>
            ${req.replacement_name ? `<div class="col-md-6"><strong>Replacement:</strong> ${req.replacement_name}</div>` : ''}
            ${req.replacement_confirmed !== undefined ? `<div class="col-md-6"><strong>Replacement Status:</strong> ${req.replacement_confirmed ? 'Confirmed' : 'Pending'}</div>` : ''}
        `;
    }
    
    // Parse changelog
    let changelog = [];
    try {
        changelog = JSON.parse(req.changelog || '[]');
    } catch (e) {
        console.error('Error parsing changelog:', e);
    }
    
    return `
        <div class="row mb-4">
            <div class="col-md-8">
                <h6><strong>Subject:</strong> ${req.subject}</h6>
                <p><strong>Description:</strong> ${req.description}</p>
            </div>
            <div class="col-md-4 text-end">
                <div class="mb-2">
                    <span class="badge ${statusBadge}">${capitalize(req.status.replace('_', ' '))}</span>
                </div>
                <div>
                    <span class="badge ${priorityBadge}">${capitalize(req.priority)} Priority</span>
                </div>
            </div>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-6">
                <strong>Requested By:</strong> ${req.user_name || 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>Designation:</strong> ${req.user_designation || 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>Created:</strong> ${req.created_at ? formatDateTime(req.created_at) : 'N/A'}
            </div>
            <div class="col-md-6">
                <strong>Last Updated:</strong> ${req.updated_at ? formatDateTime(req.updated_at) : 'N/A'}
            </div>
            ${specificInfo}
        </div>
        
        <hr>
        
        <div class="mb-3">
            <h6><i class="fas fa-history me-2"></i>Progress History</h6>
            ${changelog.length > 0 ? renderProgressHistory(changelog) : '<p class="text-muted">No progress history available.</p>'}
        </div>
    `;
}

// Render progress history timeline
function renderProgressHistory(changelog) {
    return `
        <div class="timeline">
            ${changelog.map((entry, index) => {
                const isLatest = index === changelog.length - 1;
                return `
                    <div class="timeline-item ${isLatest ? 'latest' : ''}">
                        <div class="timeline-marker">
                            <i class="fas fa-circle"></i>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <strong>${entry.action ? capitalize(entry.action.replace('_', ' ')) : 'Update'}</strong>
                                <small class="text-muted ms-2">${entry.timestamp ? formatDateTime(entry.timestamp) : 'Unknown time'}</small>
                            </div>
                            <div class="timeline-body">
                                ${entry.details || 'No details available'}
                                ${entry.user ? `<br><small class="text-muted">by ${entry.user}</small>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <style>
            .timeline {
                position: relative;
                padding-left: 30px;
            }
            
            .timeline-item {
                position: relative;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-left: 2px solid #e9ecef;
            }
            
            .timeline-item.latest {
                border-left-color: var(--bs-primary);
            }
            
            .timeline-item.latest .timeline-marker i {
                color: var(--bs-primary);
            }
            
            .timeline-marker {
                position: absolute;
                left: -7px;
                top: 5px;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: white;
                border: 2px solid #e9ecef;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .timeline-marker i {
                font-size: 6px;
                color: #6c757d;
            }
            
            .timeline-content {
                margin-left: 25px;
            }
            
            .timeline-header {
                margin-bottom: 5px;
            }
            
            .timeline-body {
                color: #495057;
                line-height: 1.4;
            }
        </style>
    `;
}

// Render actions for requisition details modal
function renderRequisitionDetailsActions(req) {
    const user = getCurrentUser();
    let actions = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>';
    
    // Add role-based action buttons
    if (user.role === 'manager' && req.status === 'pending') {
        actions = `
            <button type="button" class="btn btn-success me-2" onclick="approveRequisition('${req.id}'); bootstrap.Modal.getInstance(document.querySelector('.modal.show')).hide();">
                <i class="fas fa-check me-1"></i>Approve
            </button>
            <button type="button" class="btn btn-danger me-2" onclick="declineRequisition('${req.id}'); bootstrap.Modal.getInstance(document.querySelector('.modal.show')).hide();">
                <i class="fas fa-times me-1"></i>Decline
            </button>
            ${actions}
        `;
    } else if (user.role === 'it') {
        if (req.status === 'approved' && req.requisition_type === 'it') {
            actions = `
                <button type="button" class="btn btn-info me-2" onclick="markInProgress('${req.id}'); bootstrap.Modal.getInstance(document.querySelector('.modal.show')).hide();">
                    <i class="fas fa-play me-1"></i>Start Work
                </button>
                ${actions}
            `;
        } else if (req.status === 'in_progress' && req.requisition_type === 'it') {
            actions = `
                <button type="button" class="btn btn-success me-2" onclick="markCompleted('${req.id}'); bootstrap.Modal.getInstance(document.querySelector('.modal.show')).hide();">
                    <i class="fas fa-check-circle me-1"></i>Mark Complete
                </button>
                ${actions}
            `;
        }
    }
    
    // Add delete button - users can only delete their own pending requests, IT can delete any
    const canDelete = (user.role === 'it') || 
                     (user.id === req.user_id && req.status === 'pending');
    
    if (canDelete) {
        actions = `
            <button type="button" class="btn btn-outline-danger me-2" onclick="deleteRequisition('${req.id}');">
                <i class="fas fa-trash me-1"></i>Delete
            </button>
            ${actions}
        `;
    }
    
    // Add export button for all requisitions
    actions = `
        <button type="button" class="btn btn-outline-primary me-2" onclick="exportRequisition('${req.id}');">
            <i class="fas fa-download me-1"></i>Export
        </button>
        ${actions}
    `;
    
    return actions;
}

// Delete requisition
async function deleteRequisition(requisitionId) {
    const req = currentRequisitions.find(r => r.id === requisitionId);
    if (!req) return;
    
    // Show confirmation dialog
    const confirmed = confirm(
        `Are you sure you want to delete this ${req.requisition_type.replace('_', ' ')} request?\n\n` +
        `${req.display_id}: ${req.subject}\n\n` +
        `This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
        await api.delete(`/requisitions/${requisitionId}`);
        showAlert('Requisition deleted successfully', 'success');
        
        // Close modal if open
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            bootstrap.Modal.getInstance(openModal).hide();
        }
        
        // Refresh current requisitions
        const currentType = currentRequisitionType;
        await loadRequisitions(currentType);
        
    } catch (error) {
        console.error('Error deleting requisition:', error);
        const message = error.response?.data?.error || 'Failed to delete requisition';
        showAlert(message, 'danger');
    }
}

// Export requisition to PDF/Excel
async function exportRequisition(requisitionId) {
    const req = currentRequisitions.find(r => r.id === requisitionId);
    if (!req) return;
    
    try {
        // Generate detailed export data
        const exportData = {
            id: req.display_id,
            type: req.requisition_type.replace('_', ' ').toUpperCase(),
            subject: req.subject,
            description: req.description,
            status: req.status.toUpperCase(),
            priority: req.priority || 'Not specified',
            submittedBy: req.user_name,
            submittedDate: formatDate(req.created_at),
            lastUpdated: formatDate(req.updated_at)
        };
        
        // Add type-specific data
        if (req.requisition_type === 'it') {
            exportData.category = req.it_category || 'Not specified';
            exportData.assignedTo = req.assigned_to || 'Not assigned';
        } else if (req.requisition_type === 'conference_room') {
            exportData.roomName = req.room_name || 'Not specified';
            exportData.startTime = req.start_datetime ? formatDateTime(req.start_datetime) : 'Not specified';
            exportData.endTime = req.end_datetime ? formatDateTime(req.end_datetime) : 'Not specified';
            exportData.attendees = req.attendees_count || 'Not specified';
            exportData.equipment = req.equipment_needed || 'None';
        } else if (req.requisition_type === 'leave') {
            exportData.leaveType = req.leave_type || 'Not specified';
            exportData.startDate = req.start_date ? formatDate(req.start_date) : 'Not specified';
            exportData.endDate = req.end_date ? formatDate(req.end_date) : 'Not specified';
            exportData.totalDays = req.total_days || 'Not specified';
            exportData.replacement = req.replacement_name || 'Not assigned';
        }
        
        // Add changelog history
        let changelog = [];
        try {
            changelog = JSON.parse(req.changelog || '[]');
        } catch (e) {
            changelog = [];
        }
        
        // Create CSV export
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Request Export Report\n";
        csvContent += "Generated on," + new Date().toLocaleString() + "\n\n";
        
        csvContent += "Basic Information\n";
        csvContent += "Field,Value\n";
        for (const [key, value] of Object.entries(exportData)) {
            csvContent += `"${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}","${value}"\n`;
        }
        
        csvContent += "\nRequest History\n";
        csvContent += "Date,Action,User,Details\n";
        changelog.forEach(entry => {
            csvContent += `"${formatDateTime(entry.timestamp)}","${entry.action}","${entry.user}","${entry.details}"\n`;
        });
        
        // Download CSV file
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${req.display_id}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('Request exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting requisition:', error);
        showAlert('Failed to export request', 'danger');
    }
}

// Export functions for global use
window.initializeRequisitions = initializeRequisitions;
window.showCreateITRequisitionModal = showCreateITRequisitionModal;
window.showCreateConferenceRoomModal = showCreateConferenceRoomModal;
window.showCreateLeaveRequestModal = showCreateLeaveRequestModal;
window.refreshITRequisitions = refreshITRequisitions;
window.refreshConferenceRoomBookings = refreshConferenceRoomBookings;
window.refreshLeaveRequests = refreshLeaveRequests;
window.selectReplacement = selectReplacement;
window.approveRequisition = approveRequisition;
window.declineRequisition = declineRequisition;
window.markInProgress = markInProgress;
window.markCompleted = markCompleted;
window.viewRequisitionDetails = viewRequisitionDetails;
window.deleteRequisition = deleteRequisition;
window.exportRequisition = exportRequisition;
