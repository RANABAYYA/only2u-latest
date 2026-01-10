#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Checking prerequisites for GCP deployment..."
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed"
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
else
    echo "✅ gcloud CLI is installed"
    gcloud version --short
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud"
    echo "   Run: gcloud auth login"
    exit 1
else
    echo "✅ Authenticated with gcloud"
    echo "   Account: $(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
fi

# Check if project is set
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
    echo "⚠️  No default project set"
    echo "   Run: gcloud config set project YOUR_PROJECT_ID"
    echo "   Or set PROJECT_ID in deploy.sh"
else
    echo "✅ Default project: $PROJECT_ID"
fi

# Check for required environment variables
if [ -z "${API_KEYS:-}" ]; then
    echo "⚠️  API_KEYS environment variable is not set"
    echo "   Set it with: export API_KEYS='your-api-key-1,your-api-key-2'"
    echo "   Generate keys with: openssl rand -hex 32"
else
    echo "✅ API_KEYS is set (hidden)"
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "⚠️  DATABASE_URL environment variable is not set"
    echo "   Set it with: export DATABASE_URL='postgresql://postgres:PASSWORD@HOST:5432/postgres'"
    echo "   Get it from Supabase Dashboard → Settings → Database"
else
    echo "✅ DATABASE_URL is set (hidden)"
fi

# Check Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found in current directory"
    exit 1
else
    echo "✅ Dockerfile found"
fi

# Check package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in current directory"
    exit 1
else
    echo "✅ package.json found"
fi

echo ""
echo "📋 Summary:"
if [ -z "${API_KEYS:-}" ] || [ -z "${DATABASE_URL:-}" ]; then
    echo ""
    echo "⚠️  Missing required environment variables!"
    echo ""
    echo "Set them before running deploy.sh:"
    echo ""
    if [ -z "${API_KEYS:-}" ]; then
        echo "  export API_KEYS=\"\$(openssl rand -hex 32)\""
    fi
    if [ -z "${DATABASE_URL:-}" ]; then
        echo "  export DATABASE_URL=\"postgresql://postgres:PASSWORD@HOST:5432/postgres\""
    fi
    echo ""
    echo "Then run: ./deploy.sh"
else
    echo ""
    echo "✅ All prerequisites met!"
    echo ""
    echo "You're ready to deploy. Run:"
    echo "  ./deploy.sh"
fi

