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

dotenv.config();

const app = express();

app.use(cors({
  origin: "https://clinic-ease-project-f8v9.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

const server = app.listen(port, "0.0.0.0", () => {

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ---------------- GOOGLE VISION ----------------
process.env.GOOGLE_CLOUD_PROJECT = 'clinic-management-ocr';

let visionClient;
try {
    if (config.GOOGLE_VISION_API_KEY) {
        visionClient = new ImageAnnotatorClient({
            apiKey: config.GOOGLE_VISION_API_KEY
        });
        console.log('✅ Vision initialized with API key');
    } else {
        visionClient = new ImageAnnotatorClient({
            keyFilename: path.join(__dirname, 'prescription-ocr-service.json')
        });
        console.log('✅ Vision initialized with service account');
    }
} catch (error) {
    console.error('❌ Vision init error:', error);
    process.exit(1);
}

// ---------------- GEMINI ----------------
const apiKey = config.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ GEMINI_API_KEY missing');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
console.log('✅ Gemini initialized');

// ---------------- OCR + GEMINI FUNCTION ----------------
async function extractMedicinesAndDosages(ocrText) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash" // ✅ FIXED MODEL
        });

        const prompt = `
Extract medicines from this prescription.

Return ONLY JSON:
{
  "medicines": [
    {
      "name": "",
      "dosage": "",
      "timing": "",
      "frequency": "",
      "instructions": ""
    }
  ]
}

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

        console.log('Running OCR...');

        const [result] = await visionClient.textDetection({
            image: { content: req.file.buffer }
        });

        const text = result.textAnnotations[0]?.description || "";

        if (!text) {
            return res.status(400).send("No text detected");
        }

        console.log("OCR TEXT:", text);

        const extractedData = await extractMedicinesAndDosages(text);

        console.log("Gemini:", extractedData);

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

// ---------------- TEST ----------------
app.get('/test', (req, res) => {
    res.json({ message: 'Server working' });
});

// ---------------- SERVER ----------------
const server = app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);

    try {
        initializeReminderScheduler("0 9 * * *");
        console.log('📅 Scheduler started');
    } catch (e) {
        console.error('Scheduler error:', e);
    }
});

// ---------------- ERROR HANDLING ----------------
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
