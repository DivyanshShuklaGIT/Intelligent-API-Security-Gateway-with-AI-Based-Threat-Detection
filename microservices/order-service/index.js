// ─── Order Microservice ────────────────────────────────────────────
// Dummy service accessible only to admin roles via the gateway.

const express = require('express');
const app = express();
const PORT = 4002;

app.use(express.json());

// Mock order data
const orders = [
  { id: 1, product: 'API Gateway License', amount: 299.99, status: 'completed', userId: 1 },
  { id: 2, product: 'AI Engine Add-on', amount: 149.99, status: 'pending', userId: 2 },
  { id: 3, product: 'Enterprise Support', amount: 999.99, status: 'processing', userId: 1 },
];

// ── GET / ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  console.log(`[Order Service] GET / – from ${req.headers['x-gateway-user'] || 'direct'} (role: ${req.headers['x-gateway-role']})`);
  res.json({
    service: 'order-service',
    orders,
    requestedBy: req.headers['x-gateway-user'] || 'unknown',
    requestRole: req.headers['x-gateway-role'] || 'unknown',
  });
});

// ── GET /:id ────────────────────────────────────────────────────────
app.get('/:id', (req, res) => {
  const order = orders.find((o) => o.id === parseInt(req.params.id, 10));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// ── POST / ──────────────────────────────────────────────────────────
app.post('/', (req, res) => {
  const newOrder = { id: orders.length + 1, status: 'pending', ...req.body };
  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// ── Health ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

app.listen(PORT, () => {
  console.log(`📦 Order Service running on port ${PORT}`);
});
