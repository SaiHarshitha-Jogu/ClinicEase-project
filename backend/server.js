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

// Load environment variables
dotenv.config();

const app = express();
app.use(cors({
  origin: "https://clinic-ease-project-f8v9.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
const port = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

// Set Google Cloud project ID
process.env.GOOGLE_CLOUD_PROJECT = 'clinic-management-ocr';

// Initialize Google Cloud Vision client with API key
let visionClient;
try {
    // Try to use API key first, fallback to service account
    const visionApiKey = config.GOOGLE_VISION_API_KEY;

    if (visionApiKey && visionApiKey !== 'your_vision_api_key_here') {
        visionClient = new ImageAnnotatorClient({
            apiKey: visionApiKey,
            projectId: config.GOOGLE_CLOUD_PROJECT
        });
        console.log('✅ Google Cloud Vision client initialized with API key');
    } else {
        // Fallback to service account
        visionClient = new ImageAnnotatorClient({
            keyFilename: path.join(__dirname, 'prescription-ocr-service.json'),
            projectId: config.GOOGLE_CLOUD_PROJECT
        });
        console.log('✅ Google Cloud Vision client initialized with service account');
    }
} catch (error) {
    console.error('❌ Error initializing Google Cloud Vision client:', error);
    console.log('💡 To fix this, either:');
    console.log('   1. Update GOOGLE_VISION_API_KEY in config.js, or');
    console.log('   2. Update prescription-ocr-service.json with valid credentials');
    process.exit(1);
}

// Use the API key from config
const apiKey = config.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    process.exit(1);
}

let genAI;
try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI client initialized successfully');
} catch (error) {
    console.error('❌ Error initializing Gemini AI client:', error);
    process.exit(1);
}

app.use(express.json());

// Initialize Stripe
let stripe;
if (config.STRIPE_SECRET_KEY) {
    try {
        stripe = new Stripe(config.STRIPE_SECRET_KEY);
        console.log('✅ Stripe initialized');
    } catch (e) {
        console.error('❌ Failed to initialize Stripe:', e.message);
    }
} else {
    console.warn('⚠️ STRIPE_SECRET_KEY not set. Billing endpoints will be disabled.');
}

// Initialize Razorpay
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
} else {
    console.warn('⚠️ Razorpay keys not set. Razorpay endpoints will be disabled.');
}

// Create Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }
    try {
        const { amount, currency, description, metadata } = req.body || {};

        if (!amount || !currency) {
            return res.status(400).json({ error: 'amount and currency are required' });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency,
                        product_data: { name: description || 'Appointment Payment' },
                        unit_amount: amount, // in cents/paise
                    },
                    quantity: 1,
                },
            ],
            metadata: metadata || {},
            success_url: `https://clinic-ease-project-f8v9.vercel.app/dashboard?payment=success`,
            cancel_url: `https://clinic-ease-project-f8v9.vercel.app/dashboard?payment=cancel`,
        });

        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Create Razorpay Order
app.post('/create-razorpay-order', async (req, res) => {
    if (!razorpay) {
        return res.status(500).json({ error: 'Razorpay not configured' });
    }
    try {
        const { amount, currency, receipt, notes } = req.body || {};

        if (!amount || !currency) {
            return res.status(400).json({ error: 'amount and currency are required' });
        }

        const order = await razorpay.orders.create({
            amount, // amount in smallest currency unit
            currency,
            receipt: receipt || `rcpt_${Date.now()}`,
            notes: notes || {}
        });

        res.json(order);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
});

// Function to clean Gemini response
function cleanGeminiResponse(rawResponse) {
    return rawResponse.replace(/```json\s*/g, '').replace(/```/g, '').trim();
}

// Extract medicine names and dosages
async function extractMedicinesAndDosages(ocrText) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
Extract all medicine names, dosages, timing, frequency, and instructions from the following prescription text. 
Return the data in this exact JSON format:
{
  "medicines": [
    {
      "name": "Medicine Name",
      "dosage": "Dosage (e.g., 500mg, 1 tablet)",
      "timing": "When to take (e.g., morning, evening, before meals)",
      "frequency": "How often (e.g., twice daily, once daily)",
      "instructions": "Special instructions (e.g., take with food, avoid alcohol)"
    }
  ]
}

Important:
- Extract ALL medicines mentioned in the prescription
- If timing/frequency/instructions are not specified, use "Not specified"
- Be specific with dosages (include units like mg, ml, tablets)
- Include any special instructions or warnings
- Only return valid JSON, no extra text

Prescription text: "${ocrText}"
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (!response) throw new Error("No response from Gemini API.");

        // Ensure only JSON is returned
        const cleanedResponse = response.text().replace(/```json|```/g, "").trim();

        return cleanedResponse;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Failed to extract medicine details.");
    }
}

// File upload route
app.post('/upload', upload.single('prescription'), async (req, res) => {
    console.log('Received upload request');
    try {
        if (!req.file) {
            console.error('No file uploaded.');
            return res.status(400).send('No file uploaded.');
        }
        const imagePath = path.join(__dirname, req.file.path);
        console.log('Image path:', imagePath);

        // Test the Vision API with a simple request first
        try {
            console.log('Attempting to process image with Vision API...');
            const [result] = await visionClient.textDetection(imagePath);
            const text = result.textAnnotations[0]?.description || "No text detected";
            console.log('OCR text extracted:', text);

            if (text === "No text detected") {
                throw new Error("No text could be detected from the image. Please ensure the prescription is clearly visible and readable.");
            }

            const extractedData = await extractMedicinesAndDosages(text);
            console.log('Extracted data from Gemini:', extractedData);
            try {
                const parsedData = JSON.parse(extractedData);
                res.json(parsedData);
            } catch (parseError) {
                console.error('JSON Parsing Error:', parseError, extractedData);
                res.status(500).send('Error parsing the extracted data. Please try again with a clearer image.');
            }
        } catch (visionError) {
            console.error('Vision API Error:', visionError);
            // Return a proper error instead of mock data
            res.status(500).send(`Failed to process image: ${visionError.message}. Please ensure the image is clear and readable.`);
        }
    } catch (error) {
        console.error('Error in /upload:', error);
        res.status(500).send('An error occurred while processing the image.');
    }
});

// Add a simple test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Manual reminder trigger endpoint (for testing)
app.post('/trigger-reminders', async (req, res) => {
    try {
        const { triggerRemindersManually } = await import('./src/server/reminderScheduler.js');
        const results = await triggerRemindersManually();
        res.json({
            success: true,
            message: 'Reminders triggered successfully',
            results
        });
    } catch (error) {
        console.error('Error triggering reminders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger reminders',
            error: error.message
        });
    }
});

// Start server
const server = app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
    console.log('✅ Press Ctrl+C to stop the server');

    // Initialize appointment reminder scheduler
    try {
        initializeReminderScheduler("0 9 * * *"); // Run daily at 9 AM
        console.log('📅 Appointment reminder scheduler initialized');
    } catch (error) {
        console.error('❌ Failed to initialize reminder scheduler:', error);
    }
});

// Serve static files from the built frontend if available (AFTER API routes)
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

// Serve uploads from the root directory
const rootUploadsDir = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(rootUploadsDir)) {
    app.use('/uploads', express.static(rootUploadsDir));
    console.log(`✅ Root uploads directory served at /uploads`);
}

if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
} else if (fs.existsSync(publicDir)) {
    // Fallback to public for assets during development
    app.use(express.static(publicDir));
} else {
    console.log('⚠️ Frontend static files not found. Backend running in API-only mode.');
}

// SPA fallback: serve index.html for unknown GET routes (Express v5-compatible using regex)
// SPA fallback: serve index.html for unknown GET routes (Express v5-compatible using regex)
app.get(/.*/, (req, res) => {
    // In development/separated mode, we don't serve the frontend
    if (process.env.NODE_ENV === 'development' || !fs.existsSync(path.join(distDir, 'index.html'))) {
        return res.status(404).send('Backend API Server - Route not found. Access frontend at http://localhost:5173');
    }

    // In production (if valid), serve the index.html
    return res.sendFile(path.join(distDir, 'index.html'));
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
