// API configuration
const API_BASE_URL = window.location.origin + '/api';

// Axios instance with interceptors
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
    response => {
        return response;
    },
    error => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            // Don't redirect if already on login page
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
        return Promise.reject(error);
    }
);

// API helper functions
const apiHelpers = {
    // User management
    getUsers: () => api.get('/users'),
    createUser: (userData) => api.post('/users', userData),
    updateUser: (userId, userData) => api.put(`/users/${userId}`, userData),
    deleteUser: (userId) => api.delete(`/users/${userId}`),
    searchUsers: (query) => api.get('/users/search', { params: { query } }),
    updateProfile: (userData) => api.put('/users/me', userData),
    
    // Authentication
    login: (credentials) => api.post('/auth/login', credentials),
    register: (userData) => api.post('/auth/register', userData),
    logout: () => api.post('/auth/logout'),
    changePassword: (passwordData) => api.post('/auth/change-password', passwordData),
    getCurrentUser: () => api.get('/auth/me'),
    
    // Requisitions
    getRequisitions: (type = null) => {
        const params = type ? { type } : {};
        return api.get('/requisitions', { params });
    },
    createRequisition: (requisitionData) => api.post('/requisitions', requisitionData),
    updateRequisition: (requisitionId, updateData) => api.put(`/requisitions/${requisitionId}`, updateData),
    deleteRequisition: (requisitionId) => api.delete(`/requisitions/${requisitionId}`),
    
    // Leave replacement
    getReplacementConfirmation: (token) => api.get(`/leave/confirm/${token}`),
    confirmReplacement: (token, confirmed) => api.post(`/leave/confirm/${token}`, { confirmed }),
    getPendingReplacementRequests: () => api.get('/users/me/pending-replacement-requests')
};

// Export for global use
window.apiHelpers = apiHelpers;
