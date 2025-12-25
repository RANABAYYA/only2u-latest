# Only2U Microservices Implementation Guide

## Quick Start Templates

This guide provides practical implementation examples for migrating to microservices architecture.

---

## Service Template Structure

### Standard Service Template

```
service-name/
├── src/
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── models/            # Data models
│   ├── repositories/     # Data access layer
│   ├── middleware/        # Auth, validation, etc.
│   ├── routes/            # API routes
│   ├── config/            # Configuration
│   ├── utils/             # Utilities
│   └── server.ts          # Entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Example: User Service Implementation

### 1. Project Setup

```bash
mkdir user-service
cd user-service
npm init -y
npm install express cors dotenv pg uuid bcryptjs jsonwebtoken
npm install -D @types/express @types/node @types/pg typescript ts-node-dev
```

### 2. Basic Server Structure

**src/server.ts**
```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/user.routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

// Routes
app.use('/api/users', userRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
```

### 3. Database Connection

**src/config/database.ts**
```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'users_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
db.on('connect', () => {
  console.log('Database connected');
});

db.on('error', (err) => {
  console.error('Database connection error:', err);
});
```

### 4. User Model

**src/models/user.model.ts**
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profilePhoto?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  phone?: string;
  password: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  phone?: string;
  profilePhoto?: string;
}
```

### 5. Repository Layer

**src/repositories/user.repository.ts**
```typescript
import { db } from '../config/database';
import { User, CreateUserDto, UpdateUserDto } from '../models/user.model';
import { v4 as uuidv4 } from 'uuid';

export class UserRepository {
  async create(userData: CreateUserDto): Promise<User> {
    const id = uuidv4();
    const query = `
      INSERT INTO users (id, email, name, phone, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id,
      userData.email,
      userData.name,
      userData.phone || null,
    ]);
    
    return result.rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  async update(id: string, userData: UpdateUserDto): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (userData.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(userData.name);
    }
    if (userData.email) {
      fields.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }
    if (userData.phone) {
      fields.push(`phone = $${paramCount++}`);
      values.push(userData.phone);
    }
    if (userData.profilePhoto) {
      fields.push(`profile_photo = $${paramCount++}`);
      values.push(userData.profilePhoto);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }
}
```

### 6. Service Layer

**src/services/user.service.ts**
```typescript
import { UserRepository } from '../repositories/user.repository';
import { CreateUserDto, UpdateUserDto } from '../models/user.model';
import bcrypt from 'bcryptjs';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async createUser(userData: CreateUserDto): Promise<any> {
    // Check if user exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Create user
    const user = await this.userRepository.create({
      ...userData,
      password: hashedPassword,
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserById(id: string): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUser(id: string, userData: UpdateUserDto): Promise<any> {
    const user = await this.userRepository.update(id, userData);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
```

### 7. Controller

**src/controllers/user.controller.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.createUser(req.body);
      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body);
      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      next(error);
    }
  };
}
```

### 8. Routes

**src/routes/user.routes.ts**
```typescript
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validateCreateUser, validateUpdateUser } from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();
const userController = new UserController();

router.post('/', validateCreateUser, userController.createUser);
router.get('/:id', authenticate, userController.getUser);
router.put('/:id', authenticate, validateUpdateUser, userController.updateUser);
router.delete('/:id', authenticate, userController.deleteUser);

export { router as userRoutes };
```

---

## Docker Configuration

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  user-service:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DB_HOST=user-db
      - DB_PORT=5432
      - DB_NAME=users_db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
    depends_on:
      - user-db
    networks:
      - only2u-network

  user-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=users_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - user-db-data:/var/lib/postgresql/data
    networks:
      - only2u-network

volumes:
  user-db-data:

networks:
  only2u-network:
    driver: bridge
```

---

## API Gateway Configuration (Kong)

### kong.yml

```yaml
_format_version: "3.0"

services:
  - name: user-service
    url: http://user-service:3001
    routes:
      - name: user-route
        paths:
          - /api/users
        strip_path: false

  - name: product-service
    url: http://product-service:3002
    routes:
      - name: product-route
        paths:
          - /api/products
        strip_path: false

plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 1000
```

---

## Message Queue Example (RabbitMQ)

### Event Publisher

```typescript
import amqp from 'amqplib';

class EventPublisher {
  private connection: any;
  private channel: any;

  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    this.channel = await this.connection.createChannel();
  }

  async publishEvent(eventName: string, data: any) {
    const exchange = 'only2u-events';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    
    this.channel.publish(exchange, eventName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
  }
}

// Usage in Order Service
const publisher = new EventPublisher();
await publisher.publishEvent('order.created', {
  orderId: order.id,
  userId: order.userId,
  totalAmount: order.totalAmount,
});
```

### Event Consumer

```typescript
import amqp from 'amqplib';

class EventConsumer {
  async consumeEvents() {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();
    
    const exchange = 'only2u-events';
    await channel.assertExchange(exchange, 'topic', { durable: true });
    
    const queue = await channel.assertQueue('notification-queue', { durable: true });
    await channel.bindQueue(queue.queue, exchange, 'order.created');
    
    channel.consume(queue.queue, async (msg) => {
      if (msg) {
        const event = JSON.parse(msg.content.toString());
        // Handle event (e.g., send notification)
        await this.handleOrderCreated(event);
        channel.ack(msg);
      }
    });
  }

  async handleOrderCreated(event: any) {
    // Send notification
    console.log('Order created:', event);
  }
}
```

---

## Service Communication Patterns

### 1. Synchronous (HTTP)

```typescript
import axios from 'axios';

class ProductServiceClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
  }

  async getProduct(productId: string) {
    try {
      const response = await axios.get(`${this.baseURL}/api/products/${productId}`);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to fetch product');
    }
  }
}
```

### 2. Asynchronous (Message Queue)

```typescript
// Order Service publishes event
await eventPublisher.publishEvent('order.created', orderData);

// Notification Service consumes event
eventConsumer.on('order.created', async (data) => {
  await notificationService.sendOrderConfirmation(data.userId, data.orderId);
});
```

---

## Database Migration Example

### Using Knex.js

**migrations/001_create_users_table.ts**
```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('name').notNullable();
    table.string('phone').unique();
    table.string('profile_photo');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}
```

---

## Testing Examples

### Unit Test

```typescript
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';

jest.mock('../repositories/user.repository');

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService();
  });

  it('should create a user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'password123',
    };

    mockRepository.create.mockResolvedValue({
      id: '123',
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const user = await userService.createUser(userData);
    expect(user.email).toBe(userData.email);
  });
});
```

---

## Monitoring Setup

### Prometheus Metrics

```typescript
import client from 'prom-client';

const register = new client.Registry();

// Default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status: res.statusCode },
      duration
    );
  });
  
  next();
};

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Environment Variables Template

**.env.example**
```env
# Service Configuration
PORT=3001
NODE_ENV=development
SERVICE_NAME=user-service

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=users_db
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# External Services
OTP_SERVICE_URL=http://localhost:3000
STORAGE_SERVICE_URL=http://localhost:3010

# Message Queue
RABBITMQ_URL=amqp://localhost:5672

# Monitoring
PROMETHEUS_PORT=9090
```

---

## Kubernetes Deployment Example

### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: only2u/user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP
```

---

## CI/CD Pipeline Example (GitHub Actions)

**.github/workflows/user-service.yml**
```yaml
name: User Service CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'services/user-service/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd services/user-service
          npm ci
      
      - name: Run tests
        run: |
          cd services/user-service
          npm test
      
      - name: Build Docker image
        run: |
          docker build -t only2u/user-service:${{ github.sha }} ./services/user-service
      
      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push only2u/user-service:${{ github.sha }}
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/user-service user-service=only2u/user-service:${{ github.sha }}
```

---

## Migration Checklist

### Pre-Migration
- [ ] Review current database schema
- [ ] Identify service boundaries
- [ ] Plan data migration strategy
- [ ] Set up development environment
- [ ] Create service templates

### During Migration
- [ ] Implement User Service
- [ ] Implement Product Service
- [ ] Implement Order Service
- [ ] Set up API Gateway
- [ ] Set up message queue
- [ ] Implement monitoring

### Post-Migration
- [ ] Migrate all services
- [ ] Decommission old system
- [ ] Monitor performance
- [ ] Optimize as needed

---

## Common Patterns

### Circuit Breaker Pattern

```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breaker = new CircuitBreaker(async (url: string) => {
  const response = await axios.get(url);
  return response.data;
}, options);

breaker.on('open', () => {
  console.log('Circuit breaker opened');
});

breaker.on('halfOpen', () => {
  console.log('Circuit breaker half-open');
});

// Usage
try {
  const result = await breaker.fire('http://product-service/api/products/123');
} catch (error) {
  // Handle error or use fallback
}
```

### Retry Pattern

```typescript
import retry from 'async-retry';

async function fetchWithRetry(url: string) {
  return await retry(
    async () => {
      const response = await axios.get(url);
      return response.data;
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 5000,
      factor: 2,
    }
  );
}
```

---

## Next Steps

1. **Start with User Service** - It's the foundation
2. **Set up Infrastructure** - API Gateway, Message Queue, Monitoring
3. **Migrate Core Services** - Product, Order, Payment
4. **Add Supporting Services** - Cart, Wishlist, Review
5. **Optimize and Scale** - Performance tuning, auto-scaling

---

**Note**: This is a comprehensive guide. Start small, iterate, and scale gradually.

