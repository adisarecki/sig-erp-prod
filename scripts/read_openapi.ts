import fs from 'fs';

const spec = JSON.parse(fs.readFileSync('ksef_openapi.json', 'utf8'));

// Search paths for redeem or token
for (const path in spec.paths) {
    if (path.toLowerCase().includes('redeem') || path.toLowerCase().includes('auth/')) {
        console.log(`\n--- PATH: ${path} ---`);
        const post = spec.paths[path].post;
        if (post) {
            console.log(JSON.stringify(post.parameters, null, 2));
            console.log(JSON.stringify(post.requestBody, null, 2));
        }
    }
}
