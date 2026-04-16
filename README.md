# 🛡️ Intelligent API Security Gateway

> A production-grade, AI-powered API Gateway with real-time threat detection, RBAC, request fingerprinting, abuse intelligence, and full observability.

---

## Architecture Overview

```
┌─────────────┐    ┌──────────────────────────────────────────────────┐
│   Client     │───▶│              API GATEWAY (Node.js/Express)       │
└─────────────┘    │                                                    │
                   │  ┌─────────┐ ┌──────────┐ ┌───────────────────┐  │
                   │  │IP Filter│→│Fingerprint│→│ Abuse Detector    │  │
                   │  └─────────┘ └──────────┘ └───────────────────┘  │
                   │  ┌──────────┐ ┌────┐ ┌────────┐ ┌───────────┐   │
                   │  │Rate Limit│→│Auth│→│  RBAC  │→│ AI Client │   │
                   │  └──────────┘ └────┘ └────────┘ └─────┬─────┘   │
                   │                                        │          │
                   └────────────────────────────────────────┼──────────┘
                              │            │                │
                   ┌──────────▼──┐  ┌──────▼──────┐  ┌─────▼──────┐
                   │User Service │  │Order Service │  │ AI Engine  │
                   │  (Node.js)  │  │  (Node.js)   │  │  (Python)  │
                   └─────────────┘  └─────────────┘  └────────────┘

  Infrastructure: Redis │ MongoDB │ Prometheus │ Grafana
```

## Features

### Security Pipeline (Request Flow)
1. **IP Filter** – Whitelist/Blacklist with Redis-backed dynamic lists
2. **Request Fingerprinting** – SHA-256 hash of IP + headers; detects IP rotation anomalies
3. **Abuse Detector** – Endpoint scraping & bot repetitiveness detection with auto-blocking
4. **Rate Limiter** – Distributed Redis-backed rate limiting
5. **Authentication** – JWT bearer tokens + static API keys
6. **RBAC** – Role-based access control (admin/user roles)
7. **AI Threat Analysis** – IsolationForest ML model with circuit breaker & static fallback

### Advanced Capabilities
- **Honeypot Endpoints** – Fake paths (e.g., `/wp-login.php`, `/.env`) that auto-block scanners
- **Circuit Breaker** – Protects against cascading failures when AI engine is down
- **Load Balancer** – Round-robin with health tracking for upstream services
- **Response Cache** – Redis-backed GET response caching with TTL
- **Real-Time Alerts** – SMTP email + Slack webhook notifications with throttling
- **Segmented Logging** – 3-stream Winston logging (normal, security, audit)
- **Prometheus Metrics** – HTTP request duration histograms, request counters, Node.js metrics

### AI Engine
- **Model**: Scikit-Learn `IsolationForest` (200 estimators)
- **Features**: Request frequency, payload size, auth failures, unique endpoints, timing
- **Training**: Auto-trains on synthetic data at startup
- **Scoring**: Returns normalized risk score (0-1) with malicious/benign classification

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- (Optional) Node.js 18+ and Python 3.11+ for local development

### Launch Everything
```bash
# Clone and start
docker-compose up -d --build

# Verify all services
docker-compose ps
```

### Service Endpoints
| Service        | URL                          | Description                    |
|----------------|------------------------------|--------------------------------|
| API Gateway    | `http://localhost:3000`       | Main entry point               |
| AI Engine      | `http://localhost:8000`       | Threat analysis API            |
| User Service   | `http://localhost:4001`       | Upstream microservice          |
| Order Service  | `http://localhost:4002`       | Admin-only microservice        |
| Prometheus     | `http://localhost:9090`       | Metrics dashboard              |
| Grafana        | `http://localhost:3001`       | Visualization (admin/admin)    |

---

## API Usage

### 1. Register a User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"securepass123"}'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"securepass123"}'
```

### 3. Access User Service (Authenticated)
```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 4. Access Order Service (Admin Only)
```bash
# This will return 403 for non-admin users
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

### 5. Health Check
```bash
curl http://localhost:3000/health
```

### 6. Prometheus Metrics
```bash
curl http://localhost:3000/metrics
```

---

## Testing Security Features

### Trigger Honeypot
```bash
curl http://localhost:3000/wp-login.php
# → IP auto-blocked for 10 minutes
```

### Test Rate Limiting
```bash
for i in $(seq 1 110); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/health; done
# → 429 after 100 requests
```

### Test RBAC
```bash
# Login as regular user, then try accessing orders
curl http://localhost:3000/api/orders -H "Authorization: Bearer <USER_TOKEN>"
# → 403 Forbidden
```

### Test AI Failover
```bash
# Stop the AI engine
docker stop ai-engine

# Send traffic – gateway falls back to static rules
curl http://localhost:3000/api/users -H "Authorization: Bearer <TOKEN>"

# Restart
docker start ai-engine
```

---

## Admin API

All admin endpoints require an admin JWT token.

| Method   | Endpoint               | Description                    |
|----------|------------------------|--------------------------------|
| GET      | `/admin/blacklist`     | List blacklisted IPs           |
| POST     | `/admin/blacklist`     | Add IP to blacklist            |
| DELETE   | `/admin/blacklist`     | Remove IP from blacklist       |
| POST     | `/admin/whitelist`     | Add IP to whitelist            |
| POST     | `/admin/cache/flush`   | Flush response cache           |
| GET      | `/admin/ai/health`     | Check AI engine status         |
| GET      | `/admin/ai/circuit`    | View circuit breaker state     |

---

## Project Structure

```
project 3- api/
├── docker-compose.yml          # Service orchestration
├── prometheus/
│   └── prometheus.yml          # Scrape config
├── gateway/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # Main entry point
│       ├── config/index.js     # Environment config
│       ├── models/User.js      # Mongoose user model
│       ├── middleware/
│       │   ├── auth.js         # JWT + API key auth
│       │   ├── rbacMiddleware.js
│       │   ├── rateLimiter.js  # Redis-backed rate limiting
│       │   ├── security.js     # Helmet, CORS, validation
│       │   ├── ipFilter.js     # Whitelist/blacklist
│       │   ├── fingerprint.js  # Request fingerprinting
│       │   └── abuseDetector.js
│       ├── routes/
│       │   ├── auth.js         # Register/login
│       │   ├── admin.js        # Admin management
│       │   ├── proxy.js        # Reverse proxy + AI check
│       │   └── honeypot.js     # Trap endpoints
│       ├── services/
│       │   ├── enhancedAIClient.js  # AI with circuit breaker
│       │   ├── alertService.js      # Email + Slack alerts
│       │   ├── circuitBreaker.js
│       │   ├── loadBalancer.js
│       │   └── cacheService.js
│       └── utils/
│           ├── logger.js       # 3-stream Winston logging
│           └── redisClient.js
├── ai-engine/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI endpoints
│       ├── detector.py         # IsolationForest model
│       └── features.py         # Feature engineering
└── microservices/
    ├── user-service/
    │   ├── Dockerfile
    │   ├── package.json
    │   └── index.js
    └── order-service/
        ├── Dockerfile
        ├── package.json
        └── index.js
```

---

## Observability

### Logs
The gateway produces three separate log streams:
- `logs/normal.log` – Standard traffic and application logs
- `logs/security.log` – Blocked requests, attacks, AI flags
- `logs/audit.log` – Admin API actions

### Metrics (Prometheus)
- `gateway_http_request_duration_seconds` – Request latency histogram
- `gateway_http_requests_total` – Total request counter
- Default Node.js process metrics (CPU, memory, event loop)

### Grafana
Access at `http://localhost:3001` (admin/admin). Add Prometheus as a data source pointing to `http://prometheus:9090`.

---

## Environment Variables

See `gateway/.env.example` for the full list. Key variables:

| Variable              | Default                                | Description                |
|-----------------------|----------------------------------------|----------------------------|
| `JWT_SECRET`          | `dev-secret-change-me`                 | JWT signing secret         |
| `MONGO_URI`           | `mongodb://mongo:27017/api_gateway`    | MongoDB connection string  |
| `REDIS_HOST`          | `redis`                                | Redis hostname             |
| `AI_ENGINE_URL`       | `http://ai-engine:8000`                | AI engine base URL         |
| `RATE_LIMIT_MAX_REQUESTS` | `100`                              | Requests per window        |
| `ALERT_THROTTLE_MS`   | `60000`                                | Alert throttle interval    |

---

## License

MIT
