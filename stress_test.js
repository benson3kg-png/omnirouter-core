const crypto = require('crypto');

const CONFIG = {
    URL: 'http://localhost:3000/api/v3/omnirouter/settle',
    SECRET: 'OMNIROUTER_SIGNING_SECRET_LOGIC',
    COUNT: 10
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

function fire(idx) {
    return fetch(CONFIG.URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-omnirouter-signature': sig
        },
        body: payload
    })
    .then(res => res.json())
    .then(data => {
        process.stdout.write(`[BATCH ${idx}] State: ${data.execution_state || data.error}\n`);
    })
    .catch(err => {
        process.stderr.write(`[ERR ${idx}] Network fault: ${err.message}\n`);
    });
}

async function run() {
    process.stdout.write(`[INIT] Blasting ${CONFIG.COUNT} concurrent requests...\n`);
    const t0 = performance.now();

    const tasks = [];
    for (let i = 1; i <= CONFIG.COUNT; i++) {
        tasks.push(fire(i));
    }

    await Promise.all(tasks);
    process.stdout.write(`[DONE] Total duration: ${(performance.now() - t0).toFixed(2)} ms\n`);
}

run();
