# TenderAI

TenderAI is a full-stack AI-powered web application that automates tender eligibility evaluation and provides explainable outputs. It allows you to upload a tender document and multiple bidder documents, extracts relevant criteria using Groq AI and OCR, evaluates the bidder against the tender, and explains the reasoning behind each decision.

## Features

- **Document Processing**: Uses `pdf-parse` for PDFs (with a fallback to raw text for testing mock files) and `tesseract.js` for images to extract text.
- **AI Extraction**: Powered by **Groq** (`llama-3.3-70b-versatile`) to extract structured JSON data near-instantaneously.
- **Evaluation Engine**: Compares the extracted data against the required criteria and determines eligibility.
- **Explainability**: Shows exactly what value was found, where it came from, the decision, and a clear reason.
- **Premium UI**: A sleek, dark-themed, glassmorphic React frontend with animated gradients, smooth hover effects, and neon glowing elements.

## Prerequisites

- Node.js installed
- A [Groq API Key](https://console.groq.com/keys)

## Setup Instructions

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables. Create a `.env` file in the `backend` folder and add your Groq API key:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```
4. Start the backend server:
   ```bash
   node index.js
   ```
   *(The server will run on port 3001)*

### 2. Frontend Setup

1. Open another terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local URL (usually `http://localhost:5173`) in your browser.

## AI Implementation Details

The AI extraction utilizes strict JSON schema prompting. It identifies Financial, Technical, and Compliance criteria, parses the bidder documents for matching keys, and explicitly outputs "uncertain" rather than guessing if data is missing, ensuring a highly reliable evaluation.
