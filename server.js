const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const TOKEN_URL = "https://api.intra.42.fr/oauth/token";

let ACCESS_TOKEN = null;

app.post('/api/token', async (req, res) => {
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
        ACCESS_TOKEN = data.access_token;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/offers', async (req, res) => {
    try {
        const url = new URL("https://companies.intra.42.fr/v2/offers");
        const queryParams = req.query;

        for (const key in queryParams) {
            url.searchParams.append(key, queryParams[key]);
        }

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                Accept: "application/json",
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/offers/:id', async (req, res) => {
    try {
        const response = await fetch(`https://companies.intra.42.fr/v2/offers/${req.params.id}`, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                Accept: "application/json"
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy running on http://localhost:${PORT}`);
});
