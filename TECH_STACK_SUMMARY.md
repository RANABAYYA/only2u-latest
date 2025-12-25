# Only2U Microservices - Complete Tech Stack

## Overview

This document provides a comprehensive overview of the technology stack used across all microservices in the Only2U platform.

---

## Backend Technologies

### Primary Framework
- **Node.js** (v18+)
- **Express.js** (v4.18+)
- **TypeScript** (v5.0+)

### Alternative Frameworks
- **Go** (v1.21+) - For high-performance services
- **Python/FastAPI** (v3.11+) - For ML/AI services

---

## Database Technologies

### PostgreSQL (Relational Database)
**Version**: PostgreSQL 15+

**Use Cases**:
- User management and authentication
- Product catalog and inventory
- Order management
- Payment transactions
- Vendor/Influencer/Reseller data
- Reviews, feedback, coupons

**Node.js Drivers**:
- `pg` (node-postgres) - Official PostgreSQL client
- `TypeORM` - ORM with TypeScript support
- `Prisma` - Modern ORM with type safety

**Installation**:
```bash
npm install pg
# or
npm install typeorm pg
# or
npm install @prisma/client prisma
```

**Connection Example**:
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
});
```

---

### Apache Cassandra (NoSQL Database)
**Version**: Apache Cassandra 4.x

**Use Cases**:
- Chat messages (high write/read throughput)
- Notifications (time-series data)
- Analytics events (high-volume ingestion)
- Event logging (audit trails)

**Node.js Driver**:
- `cassandra-driver` (DataStax Node.js Driver)

**Installation**:
```bash
npm install cassandra-driver
```

**Connection Example**:
```typescript
import { Client } from 'cassandra-driver';

const client = new Client({
  contactPoints: [process.env.CASSANDRA_HOST || 'localhost'],
  localDataCenter: 'datacenter1',
  keyspace: 'chat_keyspace',
  credentials: {
    username: process.env.CASSANDRA_USER,
    password: process.env.CASSANDRA_PASSWORD,
  },
});

await client.connect();
```

**Schema Example**:
```cql
CREATE KEYSPACE chat_keyspace WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3
};

USE chat_keyspace;

CREATE TABLE messages (
  thread_id UUID,
  message_id TIMEUUID,
  sender_id UUID,
  content TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (thread_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
  AND default_time_to_live = 2592000; -- 30 days TTL
```

**Key Features**:
- Horizontal scaling across multiple nodes
- High write/read throughput
- Time-series optimization
- Tunable consistency levels
- Automatic data distribution

---

### Redis (In-Memory Cache)
**Version**: Redis 7+

**Use Cases**:
- Shopping cart storage
- User session management
- API response caching
- Rate limiting
- Real-time pub/sub messaging
- Distributed locks
- Leaderboards

**Node.js Clients**:
- `ioredis` (recommended) - Full-featured Redis client
- `redis` (node-redis) - Official Redis client

**Installation**:
```bash
npm install ioredis
# or
npm install redis
```

**Connection Example (ioredis)**:
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Pub/Sub example
const subscriber = redis.duplicate();
const publisher = redis.duplicate();

subscriber.subscribe('order-updates', (err, count) => {
  console.log(`Subscribed to ${count} channels`);
});

subscriber.on('message', (channel, message) => {
  console.log(`Received: ${message} from ${channel}`);
});

// Publish
publisher.publish('order-updates', JSON.stringify({ orderId: '123' }));
```

**Common Patterns**:
```typescript
// Caching
await redis.setex('product:123', 3600, JSON.stringify(productData));
const cached = await redis.get('product:123');

// Session storage
await redis.setex(`session:${sessionId}`, 86400, JSON.stringify(sessionData));

// Rate limiting
const key = `rate_limit:${userId}`;
const current = await redis.incr(key);
if (current === 1) {
  await redis.expire(key, 60);
}
if (current > 100) {
  throw new Error('Rate limit exceeded');
}

// Distributed lock
const lockKey = `lock:order:${orderId}`;
const lockValue = Date.now().toString();
const acquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');
if (!acquired) {
  throw new Error('Could not acquire lock');
}
```

---

### Elasticsearch (Search Engine)
**Version**: Elasticsearch 8+

**Use Cases**:
- Product search
- Full-text search
- Message search (chat)
- Analytics queries

**Node.js Client**:
- `@elastic/elasticsearch`

**Installation**:
```bash
npm install @elastic/elasticsearch
```

**Connection Example**:
```typescript
import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ES_USERNAME,
    password: process.env.ES_PASSWORD,
  },
});

// Search example
const result = await client.search({
  index: 'products',
  body: {
    query: {
      match: {
        name: 'shirt',
      },
    },
  },
});
```

---

## Message Queue

### RabbitMQ
**Version**: RabbitMQ 3.12+

**Use Cases**:
- Order processing (async)
- Notification delivery
- Email sending
- Event handling

**Node.js Client**:
- `amqplib`

**Installation**:
```bash
npm install amqplib
```

**Example**:
```typescript
import amqp from 'amqplib';

const connection = await amqp.connect(process.env.RABBITMQ_URL);
const channel = await connection.createChannel();

// Publish
await channel.assertQueue('order-queue', { durable: true });
channel.sendToQueue('order-queue', Buffer.from(JSON.stringify(orderData)), {
  persistent: true,
});

// Consume
await channel.consume('order-queue', (msg) => {
  if (msg) {
    const order = JSON.parse(msg.content.toString());
    // Process order
    channel.ack(msg);
  }
});
```

### Apache Kafka (Optional)
**Version**: Kafka 3.5+

**Use Cases**:
- Event streaming
- High-throughput event processing
- Real-time analytics

---

## API Gateway

### Kong
**Version**: Kong 3.4+

**Features**:
- Request routing
- Authentication/Authorization
- Rate limiting
- Load balancing
- SSL termination

### NGINX
**Version**: NGINX 1.25+

**Features**:
- Reverse proxy
- Load balancing
- SSL termination
- Static file serving

---

## Container & Orchestration

### Docker
**Version**: Docker 24+

**Base Images**:
- `node:18-alpine` - For Node.js services
- `python:3.11-slim` - For Python services
- `golang:1.21-alpine` - For Go services

### Kubernetes
**Version**: Kubernetes 1.28+

**Components**:
- Deployments
- Services
- ConfigMaps
- Secrets
- Ingress
- Horizontal Pod Autoscaler (HPA)

---

## Monitoring & Observability

### Prometheus
**Version**: Prometheus 2.47+

**Purpose**: Metrics collection

**Node.js Client**:
- `prom-client`

**Installation**:
```bash
npm install prom-client
```

### Grafana
**Version**: Grafana 10+

**Purpose**: Metrics visualization

### ELK Stack
- **Elasticsearch** 8+ - Log storage
- **Logstash** 8+ - Log processing
- **Kibana** 8+ - Log visualization

### Jaeger
**Version**: Jaeger 1.50+

**Purpose**: Distributed tracing

**Node.js Client**:
- `jaeger-client`

---

## CI/CD

### GitHub Actions
- Workflow automation
- Docker builds
- Kubernetes deployments

### GitLab CI
- Pipeline automation
- Container registry
- Deployment automation

### Helm
**Version**: Helm 3.12+

**Purpose**: Kubernetes package management

---

## Development Tools

### TypeScript
**Version**: TypeScript 5.0+

**Configuration**: `tsconfig.json`

### ESLint
**Version**: ESLint 9+

**Purpose**: Code linting

### Prettier
**Version**: Prettier 3+

**Purpose**: Code formatting

### Jest
**Version**: Jest 29+

**Purpose**: Unit testing

**Installation**:
```bash
npm install --save-dev jest @types/jest ts-jest
```

---

## Service-Specific Tech Stack

### User Service
- **Database**: PostgreSQL
- **Cache**: Redis (sessions)
- **Framework**: Node.js/Express

### Product Service
- **Database**: PostgreSQL
- **Cache**: Redis (catalog cache)
- **Search**: Elasticsearch
- **Framework**: Node.js/Express

### Chat Service
- **Database**: Cassandra (messages)
- **Cache**: Redis (pub/sub)
- **Real-time**: Socket.io
- **Search**: Elasticsearch (message search)
- **Framework**: Node.js/Express

### Notification Service
- **Database**: Cassandra (notifications)
- **Cache**: Redis (notification queue)
- **Preferences**: PostgreSQL
- **Push**: Firebase Cloud Messaging
- **Email**: SendGrid/SES
- **Framework**: Node.js/Express

### Cart Service
- **Primary**: Redis (cart data)
- **Backup**: PostgreSQL (persistence)
- **Framework**: Node.js/Express

### Analytics Service
- **Database**: Cassandra (events)
- **Cache**: Redis (real-time metrics)
- **Framework**: Node.js/Express + Python

---

## Package.json Template

```json
{
  "name": "service-name",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "pg": "^8.11.3",
    "cassandra-driver": "^4.7.0",
    "ioredis": "^5.3.2",
    "@elastic/elasticsearch": "^8.11.0",
    "amqplib": "^0.10.3",
    "prom-client": "^15.1.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/pg": "^8.10.9",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11"
  }
}
```

---

## Environment Variables Template

```env
# Service Configuration
PORT=3001
NODE_ENV=production
SERVICE_NAME=user-service

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=users_db
DB_USER=postgres
DB_PASSWORD=postgres

# Cassandra
CASSANDRA_HOSTS=localhost:9042
CASSANDRA_KEYSPACE=chat_keyspace
CASSANDRA_USER=cassandra
CASSANDRA_PASSWORD=cassandra
CASSANDRA_DATACENTER=datacenter1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=elastic

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# API Gateway
API_GATEWAY_URL=http://localhost:8000

# External Services
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
FIREBASE_SERVER_KEY=
```

---

## Version Compatibility Matrix

| Component | Version | Node.js | Notes |
|-----------|---------|---------|-------|
| PostgreSQL | 15+ | 18+ | Recommended |
| Cassandra | 4.x | 18+ | Requires Java 11+ |
| Redis | 7+ | 18+ | Recommended |
| Elasticsearch | 8+ | 18+ | Requires Java 17+ |
| RabbitMQ | 3.12+ | 18+ | Erlang 25+ required |
| Kong | 3.4+ | N/A | Standalone service |
| Kubernetes | 1.28+ | N/A | Orchestration |

---

## Performance Benchmarks

### PostgreSQL
- **Read Latency**: < 10ms (p95)
- **Write Latency**: < 20ms (p95)
- **Throughput**: 10,000+ queries/second

### Cassandra
- **Write Latency**: < 5ms (p95)
- **Read Latency**: < 10ms (p95)
- **Throughput**: 100,000+ writes/second per node

### Redis
- **Latency**: < 1ms (p99)
- **Throughput**: 100,000+ operations/second
- **Memory**: Efficient data structures

---

## Security Considerations

### Database Security
- **PostgreSQL**: SSL/TLS connections, encrypted at rest
- **Cassandra**: Authentication, SSL/TLS, encrypted at rest
- **Redis**: Password authentication, SSL/TLS, encrypted at rest

### Network Security
- Private networks for services
- Firewall rules
- VPN for admin access
- mTLS for service-to-service communication

---

## Resources & Documentation

- **PostgreSQL**: https://www.postgresql.org/docs/
- **Cassandra**: https://cassandra.apache.org/doc/
- **Redis**: https://redis.io/documentation
- **Elasticsearch**: https://www.elastic.co/guide/
- **RabbitMQ**: https://www.rabbitmq.com/documentation.html
- **Kong**: https://docs.konghq.com/
- **Kubernetes**: https://kubernetes.io/docs/

---

**Last Updated**: 2025-01-27  
**Version**: 1.0

