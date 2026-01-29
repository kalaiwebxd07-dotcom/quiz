// API Configuration
// Set this to your Render server URL after deployment
// Example: 'https://your-app-name.onrender.com'
const API_BASE_URL = 'http://localhost:8080';

// If empty, use relative paths (for local development)
// If set, use the full URL (for production with separate server)
function getApiUrl(endpoint) {
    if (API_BASE_URL) {
        return API_BASE_URL + endpoint;
    }
    return endpoint;
}
