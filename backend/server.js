import express from 'express';
import multer from 'multer';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from "cors";
import fs from 'fs';
import { config } from './config.js';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { initializeReminderScheduler } from './src/server/reminderScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config();

const app = express();

const port = process.env.PORT || 10000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ---------------- GOOGLE VISION ----------------
process.env.GOOGLE_CLOUD_PROJECT = 'clinic-management-ocr';

let visionClient;

try {
    // ✅ Render support (ENV JSON)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        visionClient = new ImageAnnotatorClient({
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        });
        console.log('✅ Google Vision initialized using ENV (Render)');
    } 
    // ✅ Local support (JSON file)
    else {
        visionClient = new ImageAnnotatorClient({
            keyFilename: path.join(__dirname, 'prescription-ocr-service.json')
        });
        console.log('✅ Google Vision initialized using JSON file (local)');
    }
} catch (error) {
    console.error('❌ Error initializing Google Cloud Vision client:', error);
    process.exit(1);
}

// ---------------- GEMINI ----------------
const apiKey = config.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ GEMINI_API_KEY missing in environment');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
console.log('✅ Gemini initialized');

// ---------------- GEMINI FUNCTION ----------------
async function extractMedicinesAndDosages(ocrText) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash"
        });

        const prompt = `
Extract all medicine names, dosages, timing, frequency, and instructions from the following prescription text.

IMPORTANT:
- Convert all medical abbreviations into simple patient-friendly language:
  - SOS → "Take only if needed"
  - Q6H → "Every 6 hours"
  - BD → "Twice daily"
  - TDS → "3 times daily (morning, afternoon, night)"
  - OD → "Once daily"

- If instructions are present:
  - Extract them clearly
  - Simplify into patient-friendly language

- If instructions contain timing-related words:
  - Move them to "timing"

- If timing is not mentioned, write "Not specified"
- If instructions are not available, write "No special instructions"

- Convert patterns:
  - 1-0-1 → Morning and night
  - 0-1-0 → Afternoon
  - 1-1-1 → Morning, afternoon, night

Return JSON only.

Text:
${ocrText}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        return response.text().replace(/```json|```/g, "").trim();

    } catch (error) {
        console.error("Gemini error:", error);
        throw new Error("Failed to extract medicine details");
    }
}

// ---------------- UPLOAD ROUTE ----------------
app.post('/upload', upload.single('prescription'), async (req, res) => {
    console.log('Received upload');

    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        const [result] = await visionClient.textDetection({
            image: { content: req.file.buffer }
        });

        const text = result.textAnnotations[0]?.description || "";

        if (!text) {
            return res.status(400).send("No text detected");
        }

        const extractedData = await extractMedicinesAndDosages(text);

        let parsedData;

        try {
            parsedData = JSON.parse(extractedData);
        } catch {
            return res.json({ raw: extractedData });
        }

        res.json(parsedData);

    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).send(error.message);
    }
});

// ---------------- STRIPE ----------------
let stripe;
if (config.STRIPE_SECRET_KEY) {
    try {
        stripe = new Stripe(config.STRIPE_SECRET_KEY);
        console.log('✅ Stripe initialized');
    } catch (e) {
        console.error('❌ Failed to initialize Stripe:', e.message);
    }
}

// ---------------- RAZORPAY ----------------
let razorpay;
if (config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET) {
    try {
        razorpay = new Razorpay({
            key_id: config.RAZORPAY_KEY_ID,
            key_secret: config.RAZORPAY_KEY_SECRET
        });
        console.log('✅ Razorpay initialized');
    } catch (e) {
        console.error('❌ Failed to initialize Razorpay:', e.message);
    }
}

// ---------------- ROUTES ----------------
app.post('/create-checkout-session', async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    try {
        const { amount, currency } = req.body;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency,
                    product_data: { name: 'Appointment Payment' },
                    unit_amount: amount,
                },
                quantity: 1,
            }],
            success_url: 'https://clinic-ease-project-f8v9.vercel.app/dashboard?payment=success',
            cancel_url: 'https://clinic-ease-project-f8v9.vercel.app/dashboard?payment=cancel',
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: 'Stripe error' });
    }
});

app.post('/create-razorpay-order', async (req, res) => {
    if (!razorpay) return res.status(500).json({ error: 'Razorpay not configured' });

    try {
        const { amount, currency } = req.body;

        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt: `rcpt_${Date.now()}`
        });

        res.json(order);
    } catch {
        res.status(500).json({ error: 'Razorpay error' });
    }
});

// ---------------- TEST ----------------
app.get('/test', (req, res) => {
    res.json({ message: 'Server working' });
});

// ---------------- START ----------------
app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${port}`);

    try {
        initializeReminderScheduler("0 9 * * *");
        console.log('📅 Scheduler started');
    } catch (e) {
        console.error('Scheduler error:', e);
    }
});

// ---------------- ERROR ----------------
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
