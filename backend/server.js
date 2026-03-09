
import express from 'express';
import multer from 'multer';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import fs from 'fs';
import { config } from './config.js';
import { initializeReminderScheduler } from './src/server/reminderScheduler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ------------------ CORS ------------------
const cors = require("cors");

app.use(cors({
  origin: [
    "https://clinic-ease-project-f8v9-git-main-saiharshitha-jogus-projects.vercel.app",
    "https://clinic-ease-project-f8v9-97bl1i52m-saiharshitha-jogus-projects.vercel.app",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

// ------------------ Multer (Memory Storage) ------------------
const upload = multer({ storage: multer.memoryStorage() });

// ------------------ Google Vision ------------------
process.env.GOOGLE_CLOUD_PROJECT = 'clinic-management-ocr';
let visionClient;
try {
  if (config.GOOGLE_VISION_API_KEY && config.GOOGLE_VISION_API_KEY !== 'your_vision_api_key_here') {
    visionClient = new ImageAnnotatorClient({
      apiKey: config.GOOGLE_VISION_API_KEY,
      projectId: config.GOOGLE_CLOUD_PROJECT
    });
    console.log('✅ Google Vision client initialized with API key');
  } else {
    visionClient = new ImageAnnotatorClient({
      keyFilename: path.join(process.cwd(), 'prescription-ocr-service.json'),
      projectId: config.GOOGLE_CLOUD_PROJECT
    });
    console.log('✅ Google Vision client initialized with service account');
  }
} catch (err) {
  console.error('❌ Google Vision init error:', err);
  process.exit(1);
}

// ------------------ Gemini AI ------------------
if (!config.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY missing');
  process.exit(1);
}
let genAI;
try {
  genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  console.log('✅ Gemini AI initialized');
} catch (err) {
  console.error('❌ Gemini AI init error:', err);
  process.exit(1);
}

// ------------------ Stripe ------------------
let stripe;
if (config.STRIPE_SECRET_KEY) {
  stripe = new Stripe(config.STRIPE_SECRET_KEY);
  console.log('✅ Stripe initialized');
} else {
  console.warn('⚠️ Stripe not configured');
}

// ------------------ Razorpay ------------------
let razorpay;
if (config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay initialized');
} else {
  console.warn('⚠️ Razorpay not configured');
}

app.use(express.json());

// ------------------ Helper: Extract Medicines ------------------
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
      "dosage": "Dosage",
      "timing": "When to take",
      "frequency": "How often",
      "instructions": "Special instructions"
    }
  ]
}
Prescription text: "${ocrText}"
    `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    if (!response) throw new Error("No response from Gemini API.");
    return response.text().replace(/```json|```/g, "").trim();
  } catch (err) {
    console.error('Gemini API error:', err);
    throw new Error('Failed to extract medicine details.');
  }
}

// ------------------ Routes ------------------

// Test route
app.get('/test', (req, res) => res.json({ message: 'Server running!' }));

// Upload prescription
app.post('/upload', upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');
    console.log('Processing image from memory buffer...');
    const [result] = await visionClient.textDetection({ image: { content: req.file.buffer } });
    const text = result.textAnnotations[0]?.description || "No text detected";
    if (text === "No text detected") throw new Error("No text detected");

    const extractedData = await extractMedicinesAndDosages(text);
    try {
      const parsedData = JSON.parse(extractedData);
      res.json(parsedData);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, extractedData);
      res.status(500).send('Error parsing extracted data.');
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send(err.message);
  }
});

// Stripe checkout
app.post('/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  try {
    const { amount, currency, description, metadata } = req.body;
    if (!amount || !currency) return res.status(400).json({ error: 'amount and currency required' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: description || 'Appointment Payment' },
          unit_amount: amount
        },
        quantity: 1
      }],
      metadata: metadata || {},
      success_url: `https://clinic-ease-project-f8v9-git-main-saiharshitha-jogus-projects.vercel.app/dashboard?payment=success`,
      cancel_url: `https://clinic-ease-project-f8v9-git-main-saiharshitha-jogus-projects.vercel.app/dashboard?payment=cancel`
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
});

// Razorpay order
app.post('/create-razorpay-order', async (req, res) => {
  if (!razorpay) return res.status(500).json({ error: 'Razorpay not configured' });
  try {
    const { amount, currency, receipt, notes } = req.body;
    if (!amount || !currency) return res.status(400).json({ error: 'amount and currency required' });

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    });
    res.json(order);
  } catch (err) {
    console.error('Razorpay error:', err);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

// ------------------ Start server ------------------
const server = app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  try { initializeReminderScheduler("0 9 * * *"); console.log('📅 Reminder scheduler initialized'); } catch(e) { console.error('Reminder init failed:', e); }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
