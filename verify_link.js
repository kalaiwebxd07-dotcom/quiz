const { decrypt } = require('./encryptor');
const http = require('http');
require('dotenv').config();

// Helper for making requests
function request(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: process.env.PORT || 8080,
            path: path,
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

async function verify() {
    // 1. Get tests
    const tests = await request('/api/tests');
    const javaTest = tests.find(t => t.name === 'Java MCQ Quiz');

    if (!javaTest) {
        console.log('FAIL: Java Test not found via API');
        return;
    }
    console.log(`PASS: Found test "${javaTest.name}" (ID: ${javaTest.id})`);

    // 2. Get questions for this test
    const questions = await request(`/api/questions?test_id=${javaTest.id}`);

    if (questions.length > 0) {
        console.log(`PASS: Retrieved ${questions.length} questions for test.`);
        console.log('Sample:', questions[0].question);
    } else {
        console.log('FAIL: No questions returned for test.');
    }
}

verify().catch(console.error);
