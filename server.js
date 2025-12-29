const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { decrypt } = require('./encryptor');
require('dotenv').config();

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 8080;

// Security & Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for simplicity with inline scripts/styles in this project
}));
app.use(cors());
app.use(compression()); // Gzip compression
app.use(morgan('dev')); // Request logging
app.use(express.json()); // JSON Body Parsing
app.use(express.static('.')); // Serve static files

// In-memory session store
const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Supabase Setup
const SUPABASE_URL = decrypt(process.env.SUPABASE_URL); // "Dehash" the key
const SUPABASE_KEY = decrypt(process.env.SUPABASE_KEY); // "Dehash" the key
const GITHUB_TOKEN = decrypt(process.env.GITHUB_TOKEN || ''); // "Dehash" the key
let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase initialized');
} else {
    console.log('⚠️ Supabase credentials missing. DB operations will fail.');
}

// GitHub Token is now decrypted at the top of the file


// --- Middleware: Authentication ---
const requireAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    if (!sessions.has(token)) return res.status(401).json({ success: false, message: 'Invalid session' });

    const timestamp = sessions.get(token);
    if (Date.now() - timestamp > SESSION_DURATION) {
        sessions.delete(token);
        return res.status(401).json({ success: false, message: 'Session expired' });
    }

    next();
};

// --- Database Helpers (Preserved & Adapted) ---
async function getSettings() {
    if (!supabase) return { duration: 10 };
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'quiz_duration').single();
    if (error || !data) return { duration: 10 };
    return data.value;
}

// --- Routes: Authentication ---

// Admin Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!supabase) return res.status(500).json({ success: false, message: 'Database not connected' });

        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (data && !error) {
            console.log(`✅ Admin login successful: ${username}`);
            const token = crypto.randomBytes(32).toString('hex');
            sessions.set(token, Date.now());
            res.json({ success: true, message: 'Login successful', token });
        } else {
            console.log(`❌ Failed login attempt: ${username}`);
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid request' });
    }
});

// Student Login
app.post('/api/student/login', async (req, res) => {
    try {
        const { rollno, password } = req.body;
        if (!supabase) return res.status(500).json({ success: false, message: 'Database error' });

        const { data, error } = await supabase.from('students').select('*').eq('roll_number', rollno).eq('password', password).single();

        if (data && !error) {
            res.json({ success: true, student: { name: data.name, rollno: data.roll_number } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Roll Number or Password' });
        }
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid request' });
    }
});

// --- Routes: Settings ---
app.get('/api/settings', async (req, res) => {
    const settings = await getSettings();
    res.json(settings);
});

app.post('/api/settings', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('settings').upsert({ key: 'quiz_duration', value: req.body });
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

// --- Routes: Tests ---
app.get('/api/tests', async (req, res) => {
    if (!supabase) return res.json([]);
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    res.json(error ? [] : data);
});

app.post('/api/tests', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { data, error } = await supabase.from('tests').insert(req.body).select().single();
    if (error) return res.status(500).json({ success: false, message: 'Database error' });
    res.json({ success: true, test: data });
});

app.put('/api/tests/:id', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('tests').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

app.delete('/api/tests/:id', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    await supabase.from('questions').delete().eq('test_id', req.params.id);
    const { error } = await supabase.from('tests').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

// --- Routes: Questions ---
app.get('/api/questions', async (req, res) => {
    if (!supabase) return res.json([]);
    const { test_id } = req.query;
    let query = supabase.from('questions').select('*').order('created_at', { ascending: true });

    if (test_id) {
        query = query.eq('test_id', test_id);
    }

    const { data, error } = await query;
    res.json(error ? [] : data);
});

app.post('/api/questions', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { data, error } = await supabase.from('questions').insert(req.body).select().single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, question: data });
});

app.put('/api/questions/:id', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('questions').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

app.delete('/api/questions/:id', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('questions').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

// Bulk Save
app.put('/api/questions/bulk', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const questions = req.body;

    // Simple bulk replacement strategy (delete all -> insert all)
    // Note: In production with linked tests, this logic should be scoped to test_id
    const { error: delErr } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) return res.status(500).json({ success: false, error: delErr.message });

    const { error: insErr } = await supabase.from('questions').insert(questions);
    if (insErr) return res.status(500).json({ success: false, error: insErr.message });

    res.json({ success: true, message: 'Questions saved', count: questions.length });
});

// --- Routes: Results ---
app.get('/api/results', async (req, res) => {
    if (!supabase) return res.json({ statistics: {}, results: [] });
    const { data, error } = await supabase.from('results').select('*').order('created_at', { ascending: false });
    if (error) return res.json({ statistics: {}, results: [] });

    // Calculate stats
    const scores = data.map(r => r.score);
    const statistics = {
        totalAttempts: data.length,
        averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        lowestScore: scores.length ? Math.min(...scores) : 0
    };

    res.json({ quizInfo: { title: "Java MCQ Quiz" }, statistics, results: data });
});

app.post('/api/results', async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('results').insert(req.body);
    if (error) return res.status(500).json({ success: false, error: error.message });

    // Return updated results for frontend consistency
    const { data } = await supabase.from('results').select('*').order('created_at', { ascending: false });
    res.json({ success: true, message: 'Result saved', data: { results: data } });
});

app.post('/api/results/clear', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true, message: 'All results cleared' });
});

app.delete('/api/results', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: 'Missing ID' });

    const { error } = await supabase.from('results').delete().eq('id', id);
    if (error) return res.status(404).json({ success: false });
    res.json({ success: true });
});

// --- Routes: Students ---
app.get('/api/students', requireAuth, async (req, res) => {
    if (!supabase) return res.status(401).json([]);
    const { data } = await supabase.from('students').select('*').order('roll_number', { ascending: true });
    res.json(data || []);
});

app.post('/api/students', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { rollno, name, password } = req.body;
    const { error } = await supabase.from('students').insert({ roll_number: rollno, name, password });
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

app.delete('/api/students/:rollno', requireAuth, async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false });
    const { error } = await supabase.from('students').delete().eq('roll_number', req.params.rollno);
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

// --- Routes: AI Generation (GitHub Models) ---
app.post('/api/generate', requireAuth, async (req, res) => {
    const { topic = 'Java', count = 5 } = req.body;
    console.log(`🤖 Generating ${count} ${topic} questions using GitHub Models...`);

    const https = require('https'); // Use native https for external request to avoid dependency conflict

    const prompt = `Generate ${count} multiple choice questions about ${topic} programming. 
    Return ONLY a valid JSON array with this exact format, no other text:
    [
      { "question": "Question text?", "options": { "A": "Opt A", "B": "Opt B", "C": "Opt C", "D": "Opt D" }, "answer": "A" }
    ]
    Requirements:
    - Exactly 4 options (A, B, C, D)
    - Answer must be single letter
    - Mix difficulty`;

    const requestData = JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are a programming quiz generator. Return only valid JSON arrays." },
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

    const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', async () => {
            try {
                if (apiRes.statusCode !== 200) throw new Error(`API Status ${apiRes.statusCode}`);

                const response = JSON.parse(data);
                let content = response.choices[0].message.content;

                // Markdown stripping
                const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) content = match[1].trim();

                const questions = JSON.parse(content);

                // Save generated questions to DB (as separate entries)
                if (supabase && Array.isArray(questions)) {
                    await supabase.from('questions').insert(questions);
                }

                res.json({
                    success: true,
                    message: `Generated ${questions.length} questions`,
                    questions: questions
                });
            } catch (e) {
                console.log('❌ AI Gen Error:', e.message);
                res.json({
                    success: false,
                    message: 'AI generation failed',
                    error: e.message,
                    questions: [] // Fallback handled by frontend usually
                });
            }
        });
    });

    apiReq.on('error', (e) => {
        res.status(500).json({ success: false, error: e.message });
    });

    apiReq.write(requestData);
    apiReq.end();
});

// Start Server
app.listen(PORT, () => {
    console.log(`
🚀 Server running on http://localhost:${PORT}
⭐️ Environment: ${process.env.NODE_ENV || 'development'}
🔒 Security: Enabled (Helmet)
⚡ Compression: Enabled (Gzip)
    `);
});
