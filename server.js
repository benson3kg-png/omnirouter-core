const fastify = require('fastify')({ logger: false });
const crypto = require('crypto');

const PORT = 3000;
const WEBHOOK_SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'OMNIROUTER_SIGNING_SECRET_LOGIC';


// =========================================================================
// THE ENTERPRISE LEDGER REGISTRY
// =========================================================================
const ledgerStateRegistry = new Map([
    ["account_source_01", { label: "Client Account Core", currency: "GHS", balance: 50000.00, nonce: 0 }],
    ["vault_liquidity_src", { label: "Regional Liquidity Pool GHS", currency: "GHS", balance: 500000.00, nonce: 0 }],
    ["vault_liquidity_dst", { label: "Global Settlement Pool USD", currency: "USD", balance: 150000.00, nonce: 0 }],
    ["account_destination_01", { label: "Merchant Account Core", currency: "USD", balance: 100.00, nonce: 0 }]
]);

// CONCURRENCY MUTEX ISOLATION GRID
const lockedResourceRegistry = new Set();

const COMPUTE_ROUTER_FEE_RATE = 0.005; 
const MATRIX_FX_CONVERSION_RATE = 0.065; 

// =========================================================================
// TRANSACTION INGESTION PIPELINE ENDPOINT
// =========================================================================
fastify.post('/api/v3/omnirouter/settle', async (request, reply) => {
    const rawPayloadString = JSON.stringify(request.body);
    const networkPayloadSignature = request.headers['x-omnirouter-signature'];

    // 1. CRYPTOGRAPHIC PERIMETER SECURITY FILTER
    const expectedPayloadSignature = crypto
        .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
        .update(rawPayloadString)
        .digest('hex');

    if (!networkPayloadSignature || !crypto.timingSafeEqual(Buffer.from(networkPayloadSignature, 'utf8'), Buffer.from(expectedPayloadSignature, 'utf8'))) {
        return reply.status(401).send({ error: "SECURITY_UNAUTHORIZED_PAYLOAD_SIGNATURE_MISMATCH" });
    }

    const { sourceAccountToken, destinationAccountToken, settlementVolumeGross } = request.body;

    // 2. CONCURRENCY MUTEX SHIELD (THE PRODUCTION TIMING FIX)
    // If a request is actively processing this specific key resource, deny duplicate concurrent entry
    if (lockedResourceRegistry.has(sourceAccountToken)) {
        console.warn(`⚠️ [RACE CONDITION REJECTED]: Intercepted concurrent collision on resource: ${sourceAccountToken}`);
        return reply.status(423).send({ error: "RESOURCE_LOCKED_CONCURRENT_TRANSACTION_IN_PROGRESS" });
    }
    
    // Lock the account token instantly before evaluating any storage mutations
    lockedResourceRegistry.add(sourceAccountToken);

    // 3. SHALLOW DELTA-STATE ISOLATION CAPTURE
    const sourceInitialSnapshot = { ...ledgerStateRegistry.get(sourceAccountToken) };
    const destinationInitialSnapshot = { ...ledgerStateRegistry.get(destinationAccountToken) };
    const localPoolInitialSnapshot = { ...ledgerStateRegistry.get("vault_liquidity_src") };
    const foreignPoolInitialSnapshot = { ...ledgerStateRegistry.get("vault_liquidity_dst") };

    try {
        const sourceNodeRef = ledgerStateRegistry.get(sourceAccountToken);
        const destinationNodeRef = ledgerStateRegistry.get(destinationAccountToken);
        const sourcePoolNodeRef = ledgerStateRegistry.get("vault_liquidity_src");
        const targetPoolNodeRef = ledgerStateRegistry.get("vault_liquidity_dst");

        // 4. DATA INVARIANT CHECKS
        if (sourceNodeRef.balance < settlementVolumeGross) {
            throw new Error("INVARIANT_VIOLATION_INSUFFICIENT_SOURCE_LIQUIDITY");
        }

        const computationalInfrastructureFee = settlementVolumeGross * COMPUTE_ROUTER_FEE_RATE;
        const settlementVolumeNet = settlementVolumeGross - computationalInfrastructureFee;
        const clearingTargetPayout = settlementVolumeNet * MATRIX_FX_CONVERSION_RATE;

        if (targetPoolNodeRef.balance < clearingTargetPayout) {
            throw new Error("INVARIANT_VIOLATION_TARGET_POOL_CAPITAL_EXHAUSTED");
        }

        // 5. ATOMIC SYSTEM TRANSACTION COMMIT
        sourceNodeRef.nonce += 1;
        sourceNodeRef.balance -= settlementVolumeGross;
        sourcePoolNodeRef.balance += settlementVolumeGross;
        targetPoolNodeRef.balance -= clearingTargetPayout;
        destinationNodeRef.balance += clearingTargetPayout;

        // SEALING THE LEAK: Artificially hold the lock open for 50 milliseconds inside the event queue
        // This ensures the processing thread blocks all concurrent network packets arriving in the same microsecond pool
        setTimeout(() => {
            lockedResourceRegistry.delete(sourceAccountToken);
        }, 50);

        console.log(`🚀 [OMNIROUTER COMMIT]: Atomic state change executed. Nonce: ${sourceNodeRef.nonce}`);
        
        return {
            execution_state: "COMMITTED_SUCCESSFULLY",
            cleared_volume_target_currency: clearingTargetPayout,
            audit_sequence_nonce: sourceNodeRef.nonce
        };

    } catch (error) {
        // 6. ROLLBACK REVERSION
        console.error(`❌ [OMNIROUTER CRASH - EXECUTING COMPENSATING REVERSION]: ${error.message}`);
        
        ledgerStateRegistry.set(sourceAccountToken, sourceInitialSnapshot);
        ledgerStateRegistry.set(destinationAccountToken, destinationInitialSnapshot);
        ledgerStateRegistry.set("vault_liquidity_src", localPoolInitialSnapshot);
        ledgerStateRegistry.set("vault_liquidity_dst", foreignPoolInitialSnapshot);

        // Immediate release on system breakdown to allow core recovery
        lockedResourceRegistry.delete(sourceAccountToken);
        
        return reply.status(500).send({ error: "TRANSACTION_REFUSED_LEDGER_STATE_REVERTED", diagnostic_token: error.message });
    }
});

fastify.listen({ port: PORT }, (err) => {
    if (err) process.exit(1);
    console.log(`🛡️ [THE HARDENED OMNIROUTER ONLINE]: Concurrency loop sealed on Port ${PORT}`);
});
