# FedEx MFA Demo

This project is a React + Express demo for authenticating FedEx BYOCA carrier accounts through EasyPost's FedEx MFA flow.

The app supports:

- address validation
- PIN generation
- PIN validation
- invoice validation
- FedEx pre-validation guidance

## How It Works

EasyPost does not allow these requests directly from the browser, so the app uses an Express proxy for `/api/fedex/*`.

Users enter their own EasyPost API key in the UI for the current session. The key is:

- kept in browser memory only
- sent to the backend per request in a header
- not stored in local storage
- not read from a shared production environment variable

Only an EasyPost production API key will work for this flow.

Successful authentication creates or updates a real FedEx carrier account on the user's EasyPost profile.

## Local Development

Install dependencies:

```bash
npm install
```

Run the Express backend:

```bash
npm run server
```

Run the React development server in a separate terminal:

```bash
npm start
```

Local URLs:

- frontend: `http://localhost:3000`
- backend: `http://localhost:3001`
- health check: `http://localhost:3001/api/health`

The React app uses the `proxy` setting in [package.json](/Users/logan.simonsen/code/fedex-mfa/fedex-mfa/package.json) during local development so `/api/*` requests are forwarded to the Express server.

## Production Build

Build the React app:

```bash
npm run build
```

Start the production server:

```bash
npm run start:prod
```

In production, Express serves the compiled React app from `build/` and also handles all `/api/*` requests.

## Render Deployment

This app is designed to deploy as a single Render Web Service.

Recommended Render settings:

- Root Directory: `fedex-mfa`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:prod`

Do not configure a shared EasyPost API key in Render environment variables. Each user should provide their own production key in the app UI.

## Security Notes

- Do not log the `x-easypost-api-key` header.
- Do not persist user API keys in a database, cookie, session store, or local storage.
- Serve the app only over HTTPS in hosted environments.
- Restrict backend proxy behavior to the FedEx MFA routes used by this app.

## Scripts

- `npm start`: run the React development server
- `npm run server`: run the Express backend
- `npm run server:dev`: run the Express backend with `nodemon`
- `npm run build`: build the React app for production
- `npm run start:prod`: run the production Express server that serves both the React build and API routes
- `npm test`: run the test suite

## Notes

- Address validation is always the first required step.
- PIN options are populated from the EasyPost response when available.
- The raw API panel in the UI shows the latest request payload, response payload, and HTTP status for demo and troubleshooting purposes.
