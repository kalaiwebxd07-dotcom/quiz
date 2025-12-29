const http = require('http');

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

async function test() {
    // 1. Login
    const loginRes = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'kalai', password: 'kalai100' });

    console.log('Login:', loginRes.success ? 'OK' : 'FAIL');
    const token = loginRes.token;

    // 2. Generate
    const genRes = await request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/generate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    }, { topic: 'Java', count: 1 });

    console.log('Generate Success:', genRes.success);
    console.log('Message:', genRes.message);
    console.log('Questions:', JSON.stringify(genRes.questions || []));
    if (genRes.error) console.log('Error:', genRes.error);
}

test().catch(console.error);
