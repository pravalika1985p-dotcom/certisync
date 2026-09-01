require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

const app = express();

// Middlewares
app.use(express.json({ limit: '50mb' })); 
app.use(cors({
    origin: 'https://certifysync.vercel.app' // The Bouncer is locked to CertifySync
}));

// Cloudinary Vault Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Basic health check route to prove the server is awake
app.get('/', (req, res) => {
    res.send("CertifySync Backend is Live and Running!");
});

// ==========================================
// ROUTE 1: SECURE IMAGE DELETION
// ==========================================
app.post('/api/delete-image', async (req, res) => {
    try {
        const { public_id } = req.body;
        console.log("Attempting to delete Cloudinary Image ID:", public_id);

        if (!public_id) {
            return res.status(400).json({ error: "No public_id provided" });
        }

        const result = await cloudinary.uploader.destroy(public_id);
        console.log("Cloudinary response:", result);
        
        res.status(200).json({ message: "Image vaporized from Cloudinary", result });
    } catch (error) {
        console.error("Deletion Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ROUTE 2: SECURE GEMINI AI SCANNER
// ==========================================
app.post('/api/scan-ai', async (req, res) => {
    try {
        const { prompt } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "Server missing Gemini API Key" });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("AI Scan Error:", error);
        res.status(500).json({ error: "AI Scan failed on the server" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CertifySync Secure Vault live on port ${PORT}`));