// ─── User Microservice ─────────────────────────────────────────────
// Dummy service demonstrating an upstream target behind the gateway.

const express = require('express');
const app = express();
const PORT = 4001;

app.use(express.json());

// Mock user data
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
];

// ── GET / ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  console.log(`[User Service] GET / – from ${req.headers['x-gateway-user'] || 'direct'}`);
  res.json({
    service: 'user-service',
    users,
    requestedBy: req.headers['x-gateway-user'] || 'unknown',
    requestRole: req.headers['x-gateway-role'] || 'unknown',
  });
});

// ── GET /:id ────────────────────────────────────────────────────────
app.get('/:id', (req, res) => {
  const user = users.find((u) => u.id === parseInt(req.params.id, 10));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ── POST / ──────────────────────────────────────────────────────────
app.post('/', (req, res) => {
  const newUser = { id: users.length + 1, ...req.body };
  users.push(newUser);
  res.status(201).json(newUser);
});

// ── Health ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

app.listen(PORT, () => {
  console.log(`👤 User Service running on port ${PORT}`);
});
