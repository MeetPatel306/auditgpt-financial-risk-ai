# AuditGPT - AI Financial Risk Analysis

AuditGPT is a full-stack financial risk analysis platform that helps users review companies, detect fraud indicators, compare peers, track portfolios, and generate AI-assisted audit insights from financial data.

**Live Demo:** https://auditgpt-financial-risk-ai-yylt.vercel.app/

![AuditGPT](https://img.shields.io/badge/AuditGPT-Financial%20Risk%20AI-00d4ff?style=flat-square)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB-Ready-47a248?style=flat-square)

## Deployment

The frontend is deployed on Vercel:

````text
https://auditgpt-financial-risk-ai-yylt.vercel.app/
``

## Overview

AuditGPT combines a React dashboard with a FastAPI backend to analyze company-level financial risk. The application focuses on fraud scoring, red-flag detection, auditor sentiment, regulatory alerts, live market context, peer comparison, portfolio tracking, and downloadable audit reports.

## Key Features 

- AI-assisted fraud risk scoring with clear risk levels
- Company search with NSE company data support
- Revenue, expense, and anomaly visualizations
- Red-flag detection for suspicious financial patterns
- Auditor sentiment and regulatory alert insights
- Peer comparison and similar company analysis
- Live price ticker and market context
- Authentication-protected dashboard pages
- Saved portfolio and analysis history workflows
- Downloadable PDF audit report generation
- MongoDB-ready backend for persistence
- Docker Compose support for local full-stack development

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide React
- **Backend:** FastAPI, Uvicorn, Pydantic, Python
- **Database:** MongoDB with Motor async driver
- **Data and APIs:** Yahoo Finance, NSE company data, configurable financial API providers
- **Reports:** jsPDF and html2canvas
- **Deployment:** Vercel for frontend deployment

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB local instance or hosted MongoDB connection
- Git

### Backend Setup

```bash
cd backend
# Python 3.11 or 3.12 recommended
python3.12 -m venv venv  # or: python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend API:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend app:

```text
http://localhost:5173
```

## Environment Variables

Copy the example files, then fill in real values. Do not commit secrets.

Backend `backend/.env`:

```env
MONGODB_URL=mongodb://localhost:27017
DB_NAME=auditgpt
JWT_SECRET=replace-with-a-strong-random-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Frontend `frontend/.env`:

```env
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

`VITE_GOOGLE_CLIENT_ID` must match `GOOGLE_CLIENT_ID`. Restart Vite after changing frontend env vars.

Google Cloud Console (Web application OAuth client):

- Authorized JavaScript origins: `http://localhost:5173`
- Authorized redirect URIs: `http://localhost:5173/auth/google/callback`

Add any third-party financial API keys only in local environment files or hosting provider environment settings. Do not commit secrets to GitHub.

## API Highlights

### Analyze Company

```http
POST /api/analyze-company
```

Example request:

```json
{
  "company_name": "Reliance Industries"
}
```

Example response fields:

```json
{
  "company_name": "Reliance Industries",
  "fraud_score": 42,
  "risk_level": "MODERATE",
  "summary": "AI-generated financial risk summary",
  "red_flags": [],
  "risk_categories": [],
  "financials": {}
}
```

## Docker Setup

Run the full stack locally with Docker:

```bash
docker-compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`

For production, configure backend API URLs and environment variables in the hosting dashboard before deployment.

## License

This project is built for educational and financial risk analysis use cases.