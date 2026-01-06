#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-only2u-test}"
REGION="${REGION:-asia-south1}"
REPO="${REPO:-only2u}"
SERVICE="${SERVICE:-only2u-api}"
AR_HOST="${REGION}-docker.pkg.dev"
IMAGE="${SERVICE}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
IMAGE_URI="${AR_HOST}/${PROJECT_ID}/${REPO}/${IMAGE}:${TIMESTAMP}"

if [ -z "${API_KEYS:-}" ] || [ -z "${DATABASE_URL:-}" ]; then
  echo "Set API_KEYS and DATABASE_URL environment variables before running."
  exit 1
fi

gcloud config set project "${PROJECT_ID}"

gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

if ! gcloud artifacts repositories describe "${REPO}" --location "${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Only2U API images"
fi

if ! gcloud secrets describe API_KEYS >/dev/null 2>&1; then
  printf "%s" "${API_KEYS}" | gcloud secrets create API_KEYS --data-file=- --replication-policy=automatic
else
  printf "%s" "${API_KEYS}" | gcloud secrets versions add API_KEYS --data-file=-
fi

if ! gcloud secrets describe DATABASE_URL >/dev/null 2>&1; then
  printf "%s" "${DATABASE_URL}" | gcloud secrets create DATABASE_URL --data-file=- --replication-policy=automatic
else
  printf "%s" "${DATABASE_URL}" | gcloud secrets versions add DATABASE_URL --data-file=-
fi

# Determine build context: if run from repo root use ./api, else use current dir
if [ -d "./api" ]; then
  BUILD_CONTEXT="./api"
else
  BUILD_CONTEXT="."
fi

gcloud builds submit \
  --tag "${IMAGE_URI}" \
  "${BUILD_CONTEXT}"

gcloud artifacts docker tags add \
  "${IMAGE_URI}" \
  "${AR_HOST}/${PROJECT_ID}/${REPO}/${IMAGE}:latest"

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE_URI}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets API_KEYS=API_KEYS:latest,DATABASE_URL=DATABASE_URL:latest \
  --set-env-vars CORS_ORIGINS='*' \
  --cpu=1 --memory=512Mi --max-instances=3 --concurrency=80

SERVICE_URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --format='value(status.url)')"
echo "Service URL: ${SERVICE_URL}"
echo "Health: curl -s \"${SERVICE_URL}/api/health\""
echo "Orders (protected): curl -s -H \"X-API-Key: ${API_KEYS%%,*}\" \"${SERVICE_URL}/api/orders\""
