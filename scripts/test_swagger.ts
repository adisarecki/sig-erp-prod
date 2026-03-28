async function go() {
    const r = await fetch('https://ksef.mf.gov.pl/api/openapi.json');
    if (r.ok) {
        fs.writeFileSync('ksef_openapi.json', await r.text());
        console.log('Got it');
    } else {
        console.log('Failed:', r.status);
    }
}
import fs from 'fs';
go();
