# Swagger API Documentation Setup

## How to Access Swagger Docs

### 1. Install Dependencies

```bash
cd api
npm install
```

### 2. Start the API Server

```bash
npm run dev
```

### 3. Open Swagger UI in Browser

Once the server is running, open your browser and navigate to:

**http://localhost:4000/api-docs**

You'll see an interactive Swagger UI interface where you can:
- ✅ Browse all API endpoints
- ✅ See request/response schemas
- ✅ Test API calls directly from the browser
- ✅ View example requests and responses

## Alternative: View OpenAPI Spec

You can also access the raw OpenAPI JSON spec at:

**http://localhost:4000/api-docs.json**

This can be imported into:
- Postman
- Insomnia
- Stoplight
- Any OpenAPI-compatible tool

## Features

- **Interactive Testing**: Click "Try it out" on any endpoint to test it
- **Schema Validation**: See exact request/response formats
- **Example Values**: Pre-filled examples for easy testing
- **Error Responses**: Documented error codes and messages

## Quick Test

1. Start server: `npm run dev`
2. Open: `http://localhost:4000/api-docs`
3. Expand any endpoint (e.g., "GET /customers")
4. Click "Try it out"
5. Click "Execute" to test the API

## Troubleshooting

**If Swagger UI doesn't load:**
- Make sure the server is running on port 4000
- Check browser console for errors
- Verify all dependencies are installed: `npm install`

**If endpoints don't appear:**
- Check that route files have Swagger annotations
- Restart the server after adding annotations

