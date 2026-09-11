const crypto = require('crypto');

const CONFIG = {
    URL: 'http://localhost:3000/api/v3/omnirouter/settle',
    SECRET: 'OMNIROUTER_SIGNING_SECRET_LOGIC'
};

const payload = JSON.stringify({
    sourceAccountToken: "account_source_01",
    destinationAccountToken: "account_destination_01",
    settlementVolumeGross: 2000.00
});

const sig = crypto
    .createHmac('sha256', CONFIG.SECRET)
    .update(payload)
    .digest('hex');

async function send() {
    try {
        const res = await fetch(CONFIG.URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-omnirouter-signature': sig
            },
            body: payload
        });

        const data = await res.json();
        process.stdout.write(`[OK] Response received: ${JSON.stringify(data)}\n`);
    } catch (err) {
        process.stderr.write(`[ERR] Transmission fault: ${err.message}\n`);
    }
}

send();
