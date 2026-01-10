# GCP Cloud Run Deployment Guide

This guide will help you deploy the Only2U API to Google Cloud Platform (GCP) Cloud Run using the provided `deploy.sh` script.

## Prerequisites

### 1. Install Google Cloud SDK (gcloud CLI)

**macOS:**
```bash
# Using Homebrew (recommended)
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

**Linux:**
```bash
# Download and install from:
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows:**
Download and install from: https://cloud.google.com/sdk/docs/install

### 2. Authenticate with GCP

```bash
# Login to your Google account
gcloud auth login

# Set default project (optional - can be overridden in deploy.sh)
gcloud config set project YOUR_PROJECT_ID
```

### 3. Enable Billing

Make sure billing is enabled for your GCP project:
- Go to [GCP Console](https://console.cloud.google.com)
- Navigate to **Billing** → Link your project to a billing account

### 4. Get Your Database Connection String

Get your Supabase PostgreSQL connection string:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Copy the **Connection string** (URI format)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 5. Generate API Keys

Generate one or more API keys for authentication. You can use any secure random string:

```bash
# Generate a single API key
openssl rand -hex 32

# Or generate multiple (comma-separated for multiple keys)
echo "$(openssl rand -hex 32),$(openssl rand -hex 32)"
```

**Note:** API keys should be kept secret. Anyone with the API key can access your API endpoints (except `/api/health` and `/api-docs`).

## Deployment Steps

### Option 1: Set Environment Variables Before Running Script

```bash
cd api

# Set your GCP project ID (or modify PROJECT_ID in deploy.sh)
export PROJECT_ID="only2u-test"  # Change to your project ID

# Set your region (or modify REGION in deploy.sh)
export REGION="asia-south1"  # Change to your preferred region

# Set your API keys (comma-separated for multiple keys)
export API_KEYS="your-api-key-1,your-api-key-2"

# Set your database connection string
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.ljnheixbsweamlbntwvh.supabase.co:5432/postgres"

# Make the script executable (first time only)
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

### Option 2: Modify deploy.sh Directly

Edit `deploy.sh` and update these variables at the top:

```bash
PROJECT_ID="your-project-id"
REGION="asia-south1"  # or us-central1, europe-west1, etc.
REPO="only2u"  # Artifact Registry repository name
SERVICE="only2u-api"  # Cloud Run service name
```

Then run with environment variables:

```bash
export API_KEYS="your-api-key-1,your-api-key-2"
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.ljnheixbsweamlbntwvh.supabase.co:5432/postgres"
chmod +x deploy.sh
./deploy.sh
```

## What the Script Does

1. **Enables Required GCP APIs:**
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
   - Secret Manager API

2. **Creates Artifact Registry Repository** (if it doesn't exist)
   - Stores Docker images

3. **Creates/Updates Secrets:**
   - `API_KEYS` - Stores your API keys
   - `DATABASE_URL` - Stores your database connection string

4. **Builds Docker Image:**
   - Uses Cloud Build to build your API from the Dockerfile
   - Tags the image with a timestamp and `latest`

5. **Deploys to Cloud Run:**
   - Creates or updates the Cloud Run service
   - Configures:
     - CPU: 1 vCPU
     - Memory: 512 MiB
     - Max instances: 3
     - Concurrency: 80 requests per instance
     - Public access (no authentication required at Cloud Run level)

6. **Outputs Service URL:**
   - Displays the deployed service URL
   - Shows example curl commands to test

## After Deployment

### Test Your Deployment

```bash
# Health check (no API key required)
curl https://your-service-url.run.app/api/health

# API endpoints (API key required)
curl -H "X-API-Key: your-api-key-1" https://your-service-url.run.app/api/customers

# View API documentation
open https://your-service-url.run.app/api-docs
```

### View Logs

```bash
# Stream logs
gcloud run services logs read only2u-api --region asia-south1 --follow

# View recent logs
gcloud run services logs read only2u-api --region asia-south1 --limit 50
```

### Update Deployment

To redeploy after making changes:

```bash
export API_KEYS="your-api-key-1,your-api-key-2"
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.ljnheixbsweamlbntwvh.supabase.co:5432/postgres"
./deploy.sh
```

### Update Environment Variables or Secrets

```bash
# Update API keys secret
printf "new-api-key-1,new-api-key-2" | gcloud secrets versions add API_KEYS --data-file=-

# Update database URL secret
printf "postgresql://postgres:NEW_PASSWORD@db.ljnheixbsweamlbntwvh.supabase.co:5432/postgres" | gcloud secrets versions add DATABASE_URL --data-file=-

# Redeploy to pick up new secrets
./deploy.sh
```

## Troubleshooting

### Error: "API_KEYS and DATABASE_URL environment variables required"

Make sure you've exported the environment variables before running the script:

```bash
export API_KEYS="your-api-key"
export DATABASE_URL="postgresql://..."
```

### Error: "Permission denied" or "Permission denied on resource project"

Make sure you have the required IAM permissions:
- Cloud Run Admin
- Cloud Build Editor
- Secret Manager Admin
- Artifact Registry Admin

### Error: "Billing not enabled"

Enable billing for your GCP project in the [GCP Console](https://console.cloud.google.com/billing).

### Database Connection Issues

If you see database connection errors in logs:
1. Verify your `DATABASE_URL` is correct
2. Check if your Supabase database allows connections from GCP IPs
3. Ensure your Supabase project is active

### Service Not Accessible

Check if the service is deployed:
```bash
gcloud run services list --region asia-south1
```

Check service details:
```bash
gcloud run services describe only2u-api --region asia-south1
```

## Cost Estimation

Cloud Run pricing (approximate):
- **CPU:** $0.00002400 per vCPU-second
- **Memory:** $0.00000250 per GiB-second
- **Requests:** $0.40 per million requests (first 2 million free)

With the current configuration (1 CPU, 512MB, 3 max instances), expect:
- **Free tier:** 2 million requests/month, 400,000 vCPU-seconds/month, 200,000 GiB-seconds/month
- **Beyond free tier:** ~$5-20/month for typical usage

## Security Best Practices

1. **Rotate API Keys Regularly:** Update the `API_KEYS` secret periodically
2. **Use HTTPS:** Cloud Run automatically provides HTTPS
3. **Restrict CORS:** Update `CORS_ORIGINS` in deploy.sh to specific domains instead of `*`
4. **Monitor Usage:** Set up billing alerts in GCP Console
5. **Review Logs:** Regularly check logs for suspicious activity

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)

