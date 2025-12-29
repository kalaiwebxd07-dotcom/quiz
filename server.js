const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Simple in-memory session store (token -> timestamp)
const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Load environment variables
require('dotenv').config();

// Configuration from environment
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Initialize Supabase Client (if credentials exist)
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase initialized');
} else {
    console.log('⚠️ Supabase credentials missing. Please set SUPABASE_URL and SUPABASE_KEY in .env');
    // We will still start the server but DB ops will fail or we can fallback.
    // For this migration, we assume Supabase is the target.
}

// GitHub Models API configuration (optional - for AI features)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// MIME types for serving static files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
};

// Admin credentials from environment (REQUIRED)
const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USERNAME || 'kalai',
    password: process.env.ADMIN_PASSWORD || 'kalai100'
};

const defaultQuestions = [
    { question: "Which keyword is used to create a class in Java?", options: { A: "class", B: "new", C: "object", D: "create" }, answer: "A" },
    { question: "What is the entry point method of a Java program?", options: { A: "start()", B: "run()", C: "main()", D: "init()" }, answer: "C" },
    { question: "What is the size of int in Java (in bits)?", options: { A: "8", B: "16", C: "32", D: "64" }, answer: "C" },
    { question: "Which of the following is NOT a primitive data type in Java?", options: { A: "int", B: "float", C: "String", D: "boolean" }, answer: "C" },
    { question: "Which keyword is used to create an object in Java?", options: { A: "class", B: "new", C: "this", D: "object" }, answer: "B" }
];

// --- Database Helpers ---

// Auth Middleware Helper
function isAuthenticated(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return false;

    const token = authHeader.replace('Bearer ', '');

    // Check if token exists
    if (!sessions.has(token)) return false;

    // Check expiration
    const timestamp = sessions.get(token);
    if (Date.now() - timestamp > SESSION_DURATION) {
        sessions.delete(token);
        return false;
    }

    return true;
}

async function getSettings() {
    if (!supabase) return { duration: 10 };
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'quiz_duration').single();
    if (error || !data) return { duration: 10 };
    return data.value;
}

async function saveSettingsData(settings) {
    if (!supabase) return false;
    const { error } = await supabase.from('settings').upsert({ key: 'quiz_duration', value: settings });
    return !error;
}

async function getQuestions() {
    if (!supabase) return defaultQuestions;
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: true });
    if (error) {
        console.error('Error fetching questions:', error);
        return defaultQuestions;
    }
    // Format options if needed (Supabase stores JSONB automatically as object)
    return data;
}

async function saveAllQuestions(questions) {
    if (!supabase) return false;

    // For simplicity, we'll delete all and re-insert to match the "save all" behavior of the frontend
    // In a real app, we'd want finer grained updates.

    // 1. Delete all
    const { error: deleteError } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (deleteError) {
        console.error('Error clearing questions:', deleteError);
        return false;
    }

    // 2. Insert all
    // Map questions to match schema if needed (remove ID to let DB generate it, or keep if updating)
    const questionsToInsert = questions.map(q => ({
        question: q.question,
        options: q.options,
        answer: q.answer
    }));

    const { error: insertError } = await supabase.from('questions').insert(questionsToInsert);
    if (insertError) {
        console.error('Error saving questions:', insertError);
        return false;
    }
    return true;
}

async function getResults() {
    if (!supabase) return { statistics: {}, results: [] };

    const { data: results, error } = await supabase.from('results').select('*').order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching results:', error);
        return { statistics: {}, results: [] };
    }

    // Calculate statistics
    const scores = results.map(r => r.score);
    const statistics = {
        totalAttempts: results.length,
        averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        lowestScore: scores.length ? Math.min(...scores) : 0
    };

    return {
        quizInfo: { title: "Java MCQ Quiz" },
        statistics,
        results
    };
}

async function saveResult(result) {
    if (!supabase) return false;

    const { error } = await supabase.from('results').insert({
        name: result.name,
        roll_number: result.roll_number,
        score: result.score,
        total: result.total,
        percentage: result.percentage, // Frontend sends this
        date: result.date,
        time: result.time
    });

    if (error) {
        console.error('Error saving result:', error);
        return false;
    }
    return true;
}

async function deleteResult(id) {
    if (!supabase) return false;
    const { error } = await supabase.from('results').delete().eq('id', id);
    return !error;
}

async function clearResults() {
    if (!supabase) return false;
    const { error } = await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return !error;
}


// --- Student Management ---

async function createStudent(rollno, name, password) {
    if (!supabase) return false;
    const { error } = await supabase.from('students').insert({ roll_number: rollno, name, password });
    return !error;
}

// --- Test Management ---

async function getTests() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching tests:', error);
        return [];
    }
    return data;
}

async function getTest(id) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('tests').select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

async function createTest(testData) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('tests').insert(testData).select().single();
    if (error) {
        console.error('Error creating test:', error);
        return null;
    }
    return data;
}

async function updateTest(id, testData) {
    if (!supabase) return false;
    const { error } = await supabase.from('tests').update(testData).eq('id', id);
    return !error;
}

async function deleteTest(id) {
    if (!supabase) return false;
    // First delete questions associated with this test
    await supabase.from('questions').delete().eq('test_id', id);
    // Then delete the test
    const { error } = await supabase.from('tests').delete().eq('id', id);
    return !error;
}

async function getStudents() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('students').select('*').order('roll_number', { ascending: true });
    return data || [];
}

async function deleteStudent(rollno) {
    if (!supabase) return false;
    const { error } = await supabase.from('students').delete().eq('roll_number', rollno);
    return !error;
}

async function verifyStudent(rollno, password) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('students').select('*').eq('roll_number', rollno).eq('password', password).single();
    if (error || !data) return null;
    return data;
}


// Generate questions using GitHub Models API
async function generateQuestionsWithAI(topic = "Java", count = 5) {
    return new Promise((resolve, reject) => {
        const prompt = `Generate ${count} multiple choice questions about ${topic} programming. 
        
Return ONLY a valid JSON array with this exact format, no other text:
[
  {
    "question": "Question text here?",
    "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
    "answer": "A"
  }
]

Requirements:
- Questions should be about ${topic} programming concepts
- Each question must have exactly 4 options (A, B, C, D)
- The answer field must be a single letter (A, B, C, or D)
- Mix difficulty levels (easy, medium, hard)
- Cover different topics like syntax, OOP, data types, loops, etc.`;

        const requestData = JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a programming quiz generator. Return only valid JSON arrays, no markdown or extra text." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const options = {
            hostname: 'models.inference.ai.azure.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.log('API Error:', res.statusCode, data);
                        reject(new Error(`API returned status ${res.statusCode}`));
                        return;
                    }

                    const response = JSON.parse(data);
                    const content = response.choices[0].message.content;

                    // Extract JSON from response (handle markdown code blocks)
                    let jsonStr = content;
                    if (content.includes('```')) {
                        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                        if (match) jsonStr = match[1].trim();
                    }

                    const questions = JSON.parse(jsonStr);

                    if (Array.isArray(questions) && questions.length > 0) {
                        resolve(questions);
                    } else {
                        reject(new Error('Invalid questions format'));
                    }
                } catch (e) {
                    console.log('Parse error:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.log('Request error:', e.message);
            reject(e);
        });

        req.write(requestData);
        req.end();
    });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API: Get Settings
    if (req.url === '/api/settings' && req.method === 'GET') {
        const settings = await getSettings();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settings));
        return;
    }

    // API: Save Settings
    if (req.url === '/api/settings' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const settings = JSON.parse(body);
                const success = await saveSettingsData(settings);
                if (success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Database error' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // API: Get Tests
    if (req.url.split('?')[0] === '/api/tests' && req.method === 'GET') {
        console.log(`[GET] /api/tests - Accessing public tests`);
        const tests = await getTests();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tests));
        return;
    }

    // API: Create Test
    if (req.url.split('?')[0] === '/api/tests' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const testData = JSON.parse(body);
                const test = await createTest(testData);
                if (test) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, test }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Database error' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // API: Update Test
    if (req.url.startsWith('/api/tests/') && req.method === 'PUT') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const id = req.url.split('/')[3];
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const testData = JSON.parse(body);
                const success = await updateTest(id, testData);
                if (success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Database error' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // API: Delete Test
    if (req.url.startsWith('/api/tests/') && req.method === 'DELETE') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const id = req.url.split('/')[3];
        const success = await deleteTest(id);
        if (success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Database error' }));
        }
        return;
    }

    // API: Login
    if (req.url === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { username, password } = JSON.parse(body);

                if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
                    console.log(`✅ Admin login successful: ${username}`);

                    // Generate Session Token
                    const token = crypto.randomBytes(32).toString('hex');
                    sessions.set(token, Date.now());

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Login successful', token: token }));
                } else {
                    console.log(`❌ Failed login attempt: ${username}`);
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid username or password' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
            }
        });
        return;
    }

    // API: Get questions (optionally filtered by test_id)
    if (req.url.split('?')[0] === '/api/questions' && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const testId = urlParams.get('test_id');

        let questions;
        if (testId) {
            const { data, error } = await supabase.from('questions').select('*').eq('test_id', testId).order('created_at', { ascending: true });
            questions = error ? [] : data;
        } else {
            questions = await getQuestions();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(questions));
        return;
    }

    // API: Create single question
    if (req.url.split('?')[0] === '/api/questions' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const questionData = JSON.parse(body);
                const { data, error } = await supabase.from('questions').insert(questionData).select().single();
                if (error) throw error;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, question: data }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Update single question
    if (req.url.match(/^\/api\/questions\/[^/]+$/) && req.method === 'PUT') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const id = req.url.split('/')[3];
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const questionData = JSON.parse(body);
                const { error } = await supabase.from('questions').update(questionData).eq('id', id);
                if (error) throw error;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Delete single question
    if (req.url.match(/^\/api\/questions\/[^/]+$/) && req.method === 'DELETE') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const id = req.url.split('/')[3];
        try {
            const { error } = await supabase.from('questions').delete().eq('id', id);
            if (error) throw error;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    // API: Save/Update all questions (bulk - legacy)
    if (req.url === '/api/questions/bulk' && req.method === 'PUT') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const questions = JSON.parse(body);
                if (Array.isArray(questions)) {
                    const success = await saveAllQuestions(questions);
                    if (success) {
                        console.log(`📝 Saved ${questions.length} questions`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Questions saved', count: questions.length }));
                    } else {
                        throw new Error('Database save failed');
                    }
                } else {
                    throw new Error('Invalid format');
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Generate new questions with AI
    if (req.url.startsWith('/api/generate') && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { topic = 'Java', count = 5 } = body ? JSON.parse(body) : {};

                console.log(`🤖 Generating ${count} ${topic} questions using GitHub Models...`);

                const questions = await generateQuestionsWithAI(topic, count);

                // Save to DB
                await saveAllQuestions(questions);

                console.log(`✅ Generated ${questions.length} questions successfully!`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Generated ${questions.length} questions about ${topic}`,
                    questions: questions
                }));
            } catch (e) {
                console.log('❌ AI generation failed:', e.message);

                // Return default questions on error
                const questions = defaultQuestions;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'AI generation failed, using default questions. Check your GITHUB_TOKEN.',
                    error: e.message,
                    questions: questions
                }));
            }
        });
        return;
    }

    // API: Get all results
    if (req.url === '/api/results' && req.method === 'GET') {
        const results = await getResults();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
        return;
    }

    // API: Save new result
    if (req.url === '/api/results' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const newResult = JSON.parse(body);
                const success = await saveResult(newResult);

                if (success) {
                    // Fetch updated data to return (for statistics update on frontend if needed)
                    const data = await getResults();

                    console.log(`✅ Result saved for: ${newResult.name} (Score: ${newResult.score}/${newResult.total})`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Result saved', data: data }));
                } else {
                    throw new Error('Database save failed');
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Clear all results
    if (req.url === '/api/results/clear' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const success = await clearResults();
        if (success) {
            console.log('🗑️ All results cleared');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'All results cleared' }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Failed to clear results' }));
        }
        return;
    }

    // API: Delete single result
    if (req.url.startsWith('/api/results') && req.method === 'DELETE') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const id = urlParams.get('id');

        if (id) {
            const success = await deleteResult(id);

            if (success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Result not found or failed to delete' }));
            }
        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Missing ID' }));
        }
        return;
    }

    // API: Student Login
    if (req.url === '/api/student/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { rollno, password } = JSON.parse(body);
                const student = await verifyStudent(rollno, password);

                if (student) {
                    // Generate minimal student session (rollno)
                    // In a real app, use a separate token or claims. Here we just return user info.
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, student: { name: student.name, rollno: student.roll_number } }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid Roll Number or Password' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
            }
        });
        return;
    }

    // API: Manage Students (Admin Only)
    if (req.url === '/api/students' && req.method === 'GET') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const students = await getStudents();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(students));
        return;
    }

    if (req.url === '/api/students' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { rollno, name, password } = JSON.parse(body);
                if (!rollno || !name || !password) throw new Error('Missing fields');

                const success = await createStudent(rollno, name, password);
                if (success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Failed to create (duplicate rollno?)' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: e.message }));
            }
        });
        return;
    }

    if (req.url.startsWith('/api/students') && req.method === 'DELETE') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            return;
        }
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const rollno = urlParams.get('rollno');

        if (rollno) {
            const success = await deleteStudent(rollno);
            if (success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Failed to delete' }));
            }
        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
        }
        return;
    }

    // API: Get Student Results
    if (req.url.startsWith('/api/student/results') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const rollno = urlParams.get('rollno');

        if (!rollno) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Roll number required' }));
            return;
        }

        // Fetch results for this roll number
        if (!supabase) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Database not connected' }));
            return;
        }

        const { data, error } = await supabase
            .from('results')
            .select('*')
            .eq('roll_number', rollno)
            .order('created_at', { ascending: false });

        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Failed to fetch results' }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data || []));
        }
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('🎮 Java MCQ Quiz Server Running!');
    console.log('================================');
    console.log(`📍 Open in browser: http://localhost:${PORT}`);
    console.log('');
    console.log('🤖 AI Question Generation: Enabled');
    console.log('   Set GITHUB_TOKEN env variable for AI features');
    console.log('');
    console.log('🗄️  Database: Supabase');
    console.log('   Set SUPABASE_URL and SUPABASE_KEY in .env');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});
