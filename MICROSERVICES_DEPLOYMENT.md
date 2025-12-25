# Only2U Microservices Deployment Guide

## Prerequisites

- Docker & Docker Compose installed
- Kubernetes cluster (for production)
- PostgreSQL databases (one per service)
- Redis instance
- RabbitMQ instance
- API Gateway (Kong/NGINX)

---

## Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd only2u-microservices
```

### 2. Start Infrastructure Services
```bash
docker-compose -f docker-compose.infrastructure.yml up -d
```

This starts:
- PostgreSQL (multiple databases)
- Redis
- RabbitMQ
- Kong API Gateway

### 3. Start Core Services
```bash
docker-compose -f docker-compose.services.yml up -d
```

### 4. Verify Services
```bash
# Check API Gateway
curl http://localhost:8000/health

# Check User Service
curl http://localhost:8000/api/users/health

# Check Product Service
curl http://localhost:8000/api/products/health
```

---

## Service-Specific Setup

### User Service
```bash
cd services/user-service
npm install
npm run migrate
npm run dev
```

### Product Service
```bash
cd services/product-service
npm install
npm run migrate
npm run dev
```

---

## Production Deployment

### Kubernetes Setup

1. **Create Namespace**
```bash
kubectl create namespace only2u
```

2. **Deploy Databases**
```bash
kubectl apply -f k8s/databases/
```

3. **Deploy Services**
```bash
kubectl apply -f k8s/services/
```

4. **Deploy API Gateway**
```bash
kubectl apply -f k8s/gateway/
```

---

## Environment Variables

Each service requires:
- Database connection
- Service discovery URL
- Message queue URL
- API Gateway URL
- External service URLs

See `.env.example` in each service directory.

---

## Health Checks

All services expose:
- `/health` - Basic health check
- `/metrics` - Prometheus metrics

---

## Scaling

### Horizontal Scaling
```bash
kubectl scale deployment user-service --replicas=5
```

### Auto-scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Monitoring Setup

1. **Deploy Prometheus**
```bash
kubectl apply -f k8s/monitoring/prometheus/
```

2. **Deploy Grafana**
```bash
kubectl apply -f k8s/monitoring/grafana/
```

3. **Access Dashboards**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

---

## Troubleshooting

### Service Not Starting
1. Check logs: `kubectl logs <pod-name>`
2. Check database connection
3. Verify environment variables

### Database Connection Issues
1. Verify database is running
2. Check connection string
3. Verify network policies

### API Gateway Issues
1. Check Kong status: `curl http://localhost:8001/status`
2. Verify routes: `curl http://localhost:8001/routes`
3. Check service registration

---

## Rollback Procedure

```bash
# Rollback deployment
kubectl rollout undo deployment/user-service

# Check rollout status
kubectl rollout status deployment/user-service
```

---

## Backup & Recovery

### Database Backup
```bash
# Backup
pg_dump -h localhost -U postgres users_db > backup.sql

# Restore
psql -h localhost -U postgres users_db < backup.sql
```

### Service Data Backup
- Use persistent volumes
- Regular snapshots
- Off-site backups

---

## Security Checklist

- [ ] Enable TLS/SSL
- [ ] Configure firewall rules
- [ ] Set up network policies
- [ ] Enable authentication
- [ ] Encrypt sensitive data
- [ ] Regular security audits

---

## Performance Tuning

### Database
- Connection pooling
- Read replicas
- Query optimization
- Index optimization

### Services
- Caching (Redis)
- Load balancing
- Auto-scaling
- CDN for static assets

---

## Cost Optimization

1. **Right-size resources**
2. **Use spot instances** (for non-critical services)
3. **Auto-scaling** (scale down during low traffic)
4. **Database optimization** (archive old data)
5. **CDN usage** (reduce bandwidth costs)

---

## Support

For issues or questions:
- Check logs: `kubectl logs <service-name>`
- Review monitoring dashboards
- Check API Gateway logs
- Review service documentation

