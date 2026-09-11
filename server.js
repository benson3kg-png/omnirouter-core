const http = require('http');
const crypto = require('crypto');

const port = 3000;
const secret = process.env.WEBHOOK_SIGNING_SECRET || 'OMNIROUTER_SIGNING_SECRET_LOGIC';

const registry = new Map([
    ["account_source_01", { label: "Client Account Core", currency: "GHS", balance: 50000.00, nonce: 0 }],
    ["vault_liquidity_src", { label: "Regional Liquidity Pool GHS", currency: "GHS", balance: 500000.00, nonce: 0 }],
    ["vault_liquidity_dst", { label: "Global Settlement Pool USD", currency: "USD", balance: 150000.00, nonce: 0 }],
    ["account_destination_01", { label: "Merchant Account Core", currency: "USD", balance: 100.00, nonce: 0 }]
]);

const locks = new Set();
const FEE_RATE = 0.005; 
const FX_RATE = 0.065; 

const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && req.url === '/api/v3/omnirouter/settle') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const sig = req.headers['x-omnirouter-signature'];
                const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

                if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) {
                    res.writeHead(401);
                    return res.end(JSON.stringify({ error: "AUTH_FAILED" }));
                }

                const data = JSON.parse(body);
                const src = data.sourceAccountToken;
                const dst = data.destinationAccountToken;
                const amt = data.settlementVolumeGross;

                if (locks.has(src)) {
                    res.writeHead(423);
                    return res.end(JSON.stringify({ error: "LOCKED" }));
                }
                
                locks.add(src);

                const snapSrc = { ...registry.get(src) };
                const snapDst = { ...registry.get(dst) };
                const snapV1 = { ...registry.get("vault_liquidity_src") };
                const snapV2 = { ...registry.get("vault_liquidity_dst") };

                try {
                    const nodeSrc = registry.get(src);
                    const nodeDst = registry.get(dst);
                    const nodeV1 = registry.get("vault_liquidity_src");
                    const nodeV2 = registry.get("vault_liquidity_dst");

                    if (nodeSrc.balance < amt) throw new Error("INSUFFICIENT_FUNDS");

                    const fee = amt * FEE_RATE;
                    const net = amt - fee;
                    const payout = net * FX_RATE;

                    if (nodeV2.balance < payout) throw new Error("POOL_EXHAUSTED");

                    nodeSrc.nonce += 1;
                    nodeSrc.balance -= amt;
                    nodeV1.balance += amt;
                    nodeV2.balance -= payout;
                    nodeDst.balance += payout;

                    setTimeout(() => { locks.delete(src); }, 50);

                    res.writeHead(200);
                    res.end(JSON.stringify({
                        status: "COMMITTED",
                        payout: payout,
                        nonce: nodeSrc.nonce
                    }));

                } catch (err) {
                    registry.set(src, snapSrc);
                    registry.set(dst, snapDst);
                    registry.set("vault_liquidity_src", snapV1);
                    registry.set("vault_liquidity_dst", snapV2);
                    locks.delete(src);

                    res.writeHead(500);
                    res.end(JSON.stringify({ error: "REVERTED", code: err.message }));
                }
                body = null;
            } catch (ex) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: "ERR_PARSE" }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "NOT_FOUND" }));
    }
});

server.listen(port, '::');
