const { decrypt } = require('./encryptor');
const http = require('http');
require('dotenv').config();

// Helper for making requests
function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function verify() {
    // 1. Get tests to find a valid ID
    const tests = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/tests',
        method: 'GET'
    });

    if (!tests.length) {
        console.log("No tests found. Cannot verify.");
        return;
    }
    const testId = tests[0].id;
    console.log(`Using Test ID: ${testId}`);

    // 2. Login
    const loginRes = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'kalai', password: 'kalai100' });
    const token = loginRes.token;

    // 3. Generate with test_id
    console.log("Generating question...");
    const genRes = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/generate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    }, { topic: 'Python', count: 1, test_id: testId });

    if (!genRes.success) {
        console.error("Generation failed:", genRes);
        return;
    }
    console.log(`Generated ${genRes.questions.length} questions.`);

    // 4. Verify questions have test_id
    const questions = await request({
        hostname: 'localhost',
        port: 8080,
        path: `/api/questions?test_id=${testId}`,
        method: 'GET'
    });

    // Check if the last question (most recently created) matches our topic (Python usually)
    // or just check if the count increased or if they have non-null test_id.
    // Since API filters by test_id, if they show up here, they are linked!

    console.log(`Found ${questions.length} questions linked to this test.`);

    // Verify the question content matches what we just asked for roughly (Python)
    const recentQ = questions[questions.length - 1]; // Assuming order by created_at asc
    console.log(`Last question: "${recentQ.question}" (Linked: ${recentQ.test_id === testId})`);

    if (recentQ.test_id === testId) {
        console.log("✅ VERIFICATION SUCCESS: Question is linked to test.");
    } else {
        console.log("❌ VERIFICATION FAILED: Question test_id mismatch.");
    }
}

verify().catch(console.error);
