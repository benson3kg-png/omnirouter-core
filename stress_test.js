const crypto = require('crypto');

const TARGET_URL = 'http://localhost:3000/api/v3/omnirouter/settle';
const WEBHOOK_SIGNING_SECRET = 'OMNIROUTER_SIGNING_SECRET_LOGIC';

// Define structural payload parameters
const payloadTemplate = {
    sourceAccountToken: "account_source_01",
    destinationAccountToken: "account_destination_01",
    settlementVolumeGross: 2000.00
};

const rawPayloadString = JSON.stringify(payloadTemplate);

// Pre-compute the cryptographic signature
const signature = crypto
    .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
    .update(rawPayloadString)
    .digest('hex');

// Construct an HTTP request thread
function fireParallelPayload(requestIndex) {
    return fetch(TARGET_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-omnirouter-signature': signature
        },
        body: rawPayloadString
    })
    .then(res => res.json())
    .then(data => {
        console.log(`📡 [PACKET ${requestIndex}]: Status ->`, data.execution_state || data.error);
    })
    .catch(err => {
        console.error(`❌ [PACKET ${requestIndex} FLOOD ERROR]:`, err.message);
    });
}

// THE BENCHMARK PROTOCOL ENFORCEMENT
async function executeStressTest() {
    console.log("🔥 [LAUNCHING INFRASTRUCTURE ACCELERATOR]");
    console.log("⚡ Firing 10 highly concurrent requests down the pipeline simultaneously...\n");

    const requestPool = [];
    const startTime = performance.now();

    // Fill the thread pool to execute completely in parallel (simulating a high-volume traffic wave)
    for (let i = 1; i <= 10; i++) {
        requestPool.push(fireParallelPayload(i));
    }

    // Execute the parallel array simultaneously across the event loop
    await Promise.all(requestPool);

    const endTime = performance.now();
    console.log(`\n⏱️ Total Concurrent Ingestion Latency: ${(endTime - startTime).toFixed(2)} ms`);
}

executeStressTest();
