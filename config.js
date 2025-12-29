// API Configuration
// Set this to your Render server URL after deployment
// Example: 'https://your-app-name.onrender.com'
const API_BASE_URL = '';

// Supabase Public Configuration (Safe to expose)
const SUPABASE_URL = 'https://skdxcuadhdermswmfzzp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZHhjdWFkaGRlcm1zd21menpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NTM2MjMsImV4cCI6MjA4MjUyOTYyM30.eXAIdMMg6ChHPbJrF979hh1JTcHkbt6QUPT1eh8Xbqc';

// If empty, use relative paths (for local development)
// If set, use the full URL (for production with separate server)
function getApiUrl(endpoint) {
    if (API_BASE_URL) {
        return API_BASE_URL + endpoint;
    }
    return endpoint;
}
