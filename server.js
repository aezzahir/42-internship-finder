const express = require('express');
const cors = require('cors');
const { default: fetch } = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const API_BASE_URL = process.env.API_BASE_URL || "https://api.intra.42.fr";
const COMPANIES_API_BASE_URL = process.env.COMPANIES_API_BASE_URL || "https://companies.intra.42.fr";
const TOKEN_URL = `${API_BASE_URL}/oauth/token`;

let ACCESS_TOKEN = null;
let CLIENT_CREDENTIALS_TOKEN = null;
let TOKEN_EXPIRES_AT = null;
let CLIENT_TOKEN_EXPIRES_AT = null;

async function initializeAuthentication() {
    try {
        console.log('🔑 Initializing 42 API authentication...');
        const token = await getClientCredentialsToken();
        if (token) {
            console.log('✅ Successfully authenticated with 42 API');
            console.log(`🔒 Token expires in ${Math.round((CLIENT_TOKEN_EXPIRES_AT - Date.now()) / 1000 / 60)} minutes`);
        }
    } catch (error) {
        console.error('❌ Failed to initialize authentication:', error.message);
        console.log('⚠️  Server will continue but API calls may fail without proper authentication');
    }
}

async function getClientCredentialsToken() {
    if (CLIENT_CREDENTIALS_TOKEN && CLIENT_TOKEN_EXPIRES_AT && Date.now() < CLIENT_TOKEN_EXPIRES_AT) {
        return CLIENT_CREDENTIALS_TOKEN;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('CLIENT_ID and CLIENT_SECRET must be set in environment variables');
    }

    try {
        const response = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Authentication failed: ${errorData.error_description || errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        if (data.access_token) {
            CLIENT_CREDENTIALS_TOKEN = data.access_token;
            CLIENT_TOKEN_EXPIRES_AT = Date.now() + (data.expires_in * 1000);
        }
        
        return CLIENT_CREDENTIALS_TOKEN;
    } catch (error) {
        console.error('Error getting client credentials token:', error.message);
        throw error;
    }
}

async function ensureValidToken() {
    try {
        let token = ACCESS_TOKEN;
        
        if (!token || (TOKEN_EXPIRES_AT && Date.now() >= TOKEN_EXPIRES_AT)) {
            token = await getClientCredentialsToken();
        }
        
        return token;
    } catch (error) {
        console.error('Failed to ensure valid token:', error.message);
        throw error;
    }
}

app.post('/api/auth/token', async (req, res) => {
    try {
        const { code } = req.body;

        const response = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                redirect_uri: REDIRECT_URI
            }),
        });

        const data = await response.json();
        
        if (data.access_token) {
            ACCESS_TOKEN = data.access_token;
            TOKEN_EXPIRES_AT = Date.now() + (data.expires_in * 1000);
        }
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/url', (req, res) => {
    const scopes = req.query.scopes || 'public';
    const state = req.query.state || Math.random().toString(36).substring(7);
    
    const authUrl = new URL(`${API_BASE_URL}/oauth/authorize`);
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);
    
    res.json({ auth_url: authUrl.toString(), state });
});

app.get('/api/auth/token/info', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || ACCESS_TOKEN;
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const response = await fetch(`${API_BASE_URL}/oauth/token/info`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/offers', async (req, res) => {
    try {
        const token = await ensureValidToken();
        
        const url = new URL(`${COMPANIES_API_BASE_URL}/v2/offers`);
        const queryParams = req.query;

        for (const key in queryParams) {
            url.searchParams.append(key, queryParams[key]);
        }

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/offers/:id', async (req, res) => {
    try {
        const token = await ensureValidToken();
        
        const response = await fetch(`${COMPANIES_API_BASE_URL}/v2/offers/${req.params.id}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/companies', async (req, res) => {
    try {
        const token = await ensureValidToken();
        
        const url = new URL(`${COMPANIES_API_BASE_URL}/v2/companies`);
        const queryParams = req.query;

        for (const key in queryParams) {
            url.searchParams.append(key, queryParams[key]);
        }

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    await initializeAuthentication();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log('📡 42 API endpoints available:');
        console.log('   GET /api/offers - List all internship offers');
        console.log('   GET /api/offers/:id - Get specific offer details');
        console.log('   GET /api/companies - List all companies');
        console.log('   GET /api/auth/url - Get OAuth2 authorization URL');
        console.log('   POST /api/auth/token - Exchange code for access token');
        console.log('   GET /api/auth/token/info - Get token information');
    });
}

startServer().catch(console.error);
