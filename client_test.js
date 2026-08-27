const crypto = require('crypto');

// Target Endpoint Parameters
const TARGET_URL = 'http://localhost:3000/api/v3/omnirouter/settle';
const WEBHOOK_SIGNING_SECRET = 'OMNIROUTER_SIGNING_SECRET_LOGIC';

// 1. CONSTRUCT THE GROSS TRANSACTION DATA BLOCK
const transactionPayload = {
    sourceAccountToken: "account_source_01",
    destinationAccountToken: "account_destination_01",
    settlementVolumeGross: 2000.00 // Transferring 2,000 GHS
};

const rawPayloadString = JSON.stringify(transactionPayload);

// 2. COMPUTE THE SYMMETRIC HMAC SIGNATURE TOKEN
const computedSignature = crypto
    .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
    .update(rawPayloadString)
    .digest('hex');

console.log(`🔑 [GENERATING AUTHENTICATION FOOTPRINT]: ${computedSignature}`);

// 3. EXECUTE THE HIGH-VELOCITY NETWORK DISPATCH
async function dispatchAtomicRequest() {
    try {
        console.log("📡 [DISPATCHING PACKET]: Injecting transaction payload down the pipeline...");
        
        const response = await fetch(TARGET_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-omnirouter-signature': computedSignature // Injecting the required security token
            },
            body: rawPayloadString
        });

        const data = await response.json();
        
        console.log("\n📥 [SERVER RESPONSE CAPTURED]:");
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("❌ [NETWORK TRANSMISSION FAILURE]:", error.message);
    }
}

dispatchAtomicRequest();
