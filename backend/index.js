require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Root route to check if server is running
app.get('/', (req, res) => {
    res.json({ message: 'TenderAI Backend is running successfully!' });
});

const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ 
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// In-memory storage for demo purposes
let tenderData = null;
let bidderData = [];

/**
 * Helper function to extract text from an uploaded file.
 * Supports extracting raw text from PDFs via pdf-parse, and OCR from images via Tesseract.js.
 * Includes a fallback to raw string decoding if the PDF parse fails (e.g., mock files).
 * @param {string} filePath - The absolute path to the uploaded file
 * @param {string} mimeType - The MIME type of the file
 * @returns {Promise<string>} The extracted text
 */
async function extractTextFromFile(filePath, mimeType) {
    try {
        if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            try {
                const data = await pdfParse(dataBuffer);
                return data.text;
            } catch (err) {
                console.error("PDF parse failed (might be a mock text file), falling back to raw text.");
                return dataBuffer.toString('utf8');
            }
        } else if (mimeType.startsWith('image/')) {
            const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
            return text;
        }
        return '';
    } catch (error) {
        console.error("Error extracting text:", error);
        return '';
    }
}

app.post('/upload-tender', upload.single('tenderDocument'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const text = await extractTextFromFile(req.file.path, req.file.mimetype);
        
        // Extract criteria using OpenAI
        const prompt = `Extract the eligibility criteria from the following tender document text. 
Identify Financial (e.g., turnover thresholds), Technical (e.g., project requirements), and Compliance (e.g., certifications) criteria.
For each criterion, identify the required value and whether it is Mandatory or Optional.
Return the result STRICTLY as a JSON array of objects with the following keys:
- category (Financial, Technical, or Compliance)
- name (Name of the criterion)
- requiredValue (The threshold or requirement)
- isMandatory (boolean)

Always return valid JSON. If any field is uncertain, mark it as "uncertain" instead of guessing.

Document Text:
${text.substring(0, 8000)}
`;
        
        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" }
        });
        
        let extractedCriteria = [];
        try {
            const resultJson = JSON.parse(response.choices[0].message.content);
            // Assuming the model returns { "criteria": [...] } or an array directly
            extractedCriteria = resultJson.criteria || resultJson;
            if (!Array.isArray(extractedCriteria)) extractedCriteria = [extractedCriteria];
        } catch(e) {
            console.error("JSON parse error:", e);
        }

        tenderData = extractedCriteria;
        res.json({ message: 'Tender processed successfully', criteria: tenderData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process tender document' });
    }
});

app.post('/upload-bidder', upload.array('bidderDocuments'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
        
        let allText = '';
        for (const file of req.files) {
            const text = await extractTextFromFile(file.path, file.mimetype);
            allText += `\n--- Document: ${file.originalname} ---\n${text}`;
        }
        
        const prompt = `Extract bidder information from the following documents.
Look for Annual turnover, Certifications (ISO, GST, etc.), and Project experience.
Return the result STRICTLY as a JSON object with a key 'extractedData' which is an array of objects containing:
- name (e.g., "Annual turnover", "ISO Certification")
- extractedValue (The value found in the documents)
- source (The document name or section where this was found)

Always return valid JSON. If any field is uncertain, mark it as "uncertain" instead of guessing.

Documents Text:
${allText.substring(0, 10000)}
`;
        
        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" }
        });
        
        try {
            const resultJson = JSON.parse(response.choices[0].message.content);
            bidderData = resultJson.extractedData || [];
        } catch(e) {
            console.error("JSON parse error:", e);
        }

        res.json({ message: 'Bidder documents processed successfully', data: bidderData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process bidder documents' });
    }
});

app.post('/evaluate', async (req, res) => {
    try {
        if (!tenderData) return res.status(400).json({ error: 'Tender data not found. Please upload a tender first.' });
        if (!bidderData || bidderData.length === 0) return res.status(400).json({ error: 'Bidder data not found. Please upload bidder documents.' });
        
        const prompt = `You are an expert tender evaluator. Compare the following extracted bidder data with the tender eligibility criteria.
For each tender criterion, determine if the bidder is Eligible, Not Eligible, or Needs Review.

CRITICAL INSTRUCTIONS FOR DECISION:
1. **Financials**: Understand numbers, abbreviations (e.g., 'Cr', 'M', 'K'), and currencies. 10 Cr > 5 Cr.
2. **Certifications**: Use logical fuzzy matching (e.g., "ISO 9001:2015" meets "ISO 9001").
3. **Experience**: Evaluate if the bidder's project experience aligns with the tender's requirements.
4. If the bidder's data clearly meets or exceeds the required tender criterion, you MUST mark them as "Eligible". Do not use "Needs Review" if the data is sufficient.
5. If the bidder clearly fails to meet the criterion, mark as "Not Eligible".
6. ONLY use "Needs Review" if the information is completely missing, highly ambiguous, or requires human verification.

Tender Criteria:
${JSON.stringify(tenderData, null, 2)}

Bidder Data:
${JSON.stringify(bidderData, null, 2)}

Return the result STRICTLY as a JSON object with a key 'results' which is an array of objects containing:
- criterionName
- bidderValue (What the bidder provided, if any)
- source (Source document from bidder data)
- analysis (A step-by-step logical comparison of the bidderValue vs the tender requirement)
- decision ("Eligible", "Not Eligible", or "Needs Review")
- reason (A clear, concise summary of the analysis)

Always return valid JSON.`;
        
        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" }
        });
        
        let evaluationResults = [];
        try {
            let content = response.choices[0].message.content;
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
            const resultJson = JSON.parse(content);
            evaluationResults = resultJson.results || [];
        } catch(e) {
            console.error("JSON parse error:", e);
            return res.status(500).json({ error: 'AI returned invalid formatting. Please run evaluation again.' });
        }

        res.json({ results: evaluationResults });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Evaluation failed' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
