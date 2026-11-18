<<<<<<< HEAD
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
- Up to 10 years of historical daily market data (OHLCV) with date ranges (1M, 3M, 6M, 1Y, 3Y, 5Y, 10Y, MAX) for all NSE-listed companies
- Robust Symbol Resolution & Demerger routing (handles Tata Motors TMCV/TMPV, DVR shares, aliases, and corporate actions)
- Company search with full NSE master dataset (~1,400+ listed equities)
- Revenue, expense, and anomaly visualizations
- Red-flag detection for suspicious financial patterns
- Auditor sentiment and regulatory alert insights
- Peer comparison and similar company analysis
- Live price ticker and market context
- Authentication-protected dashboard pages with JWT and Google OAuth 2.0
- Saved portfolio and analysis history workflows
- Downloadable PDF audit report generation
- MongoDB persistence with automated compound indexing and incremental sync
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

### Database (MongoDB) Setup

Start your local MongoDB service (port 27017):

```bash
# macOS (Homebrew direct):
/opt/homebrew/bin/mongod --config /opt/homebrew/etc/mongod.conf --fork

# Or via brew services:
brew services start mongodb-community@8.0

# Linux (systemd):
sudo systemctl start mongod
```

### Backend Setup & Running

```bash
cd backend
# Python 3.11 or 3.12 recommended
python3.12 -m venv venv  # or: python3 -m venv venv
source venv/bin/activate # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server with hot-reload
uvicorn main:app --reload --port 8000
```

Backend API:

```text
http://localhost:8000
```

API documentation (Swagger UI):

```text
http://localhost:8000/docs
```

Interactive ReDoc:

```text
http://localhost:8000/redoc
```

### Frontend Setup & Running

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Frontend app:

```text
http://localhost:5173
```

To build the frontend for production:

```bash
cd frontend
npm run build
```

## Environment Variables

Copy the example files, then fill in real values. Do not commit secrets.

Backend `backend/.env`:

```env
MONGODB_URL=mongodb://localhost:27017
DB_NAME=AuditGpt
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

## 10-Year Historical Market Data & Symbol Registry

AuditGPT stores up to 10 years of daily historical OHLCV records for all currently listed NSE companies in MongoDB.

### Architecture & Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/market-data/{symbol}/history?period=10y` | GET | Retrieve stored OHLCV price history (supports `1m`, `3m`, `6m`, `1y`, `3y`, `5y`, `10y`, `max`) |
| `/api/market-data/{symbol}/meta` | GET | Retrieve metadata (records count, earliest/latest date) |
| `/api/market-data/sync/{symbol}` | POST | Trigger on-demand sync for a single company (Authenticated) |
| `/api/market-data/sync-all` | POST | Trigger background batch sync for all ~1,400+ NSE companies (Authenticated) |
| `/api/market-data/sync-status` | GET | Check progress and results of the most recent sync job |

### Batch Sync via CLI

To trigger a full sync across all NSE equities:

```bash
curl -X POST http://localhost:8000/api/market-data/sync-all \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Check status:

```bash
curl http://localhost:8000/api/market-data/sync-status
```

### Note on Provider Limitations

- **OHLCV Market History:** Yahoo Finance provides full 10-year daily trading records with split and dividend adjustments for all eligible companies.
- **Financial Statements:** `yfinance` financial statements (`income_stmt`, `balance_sheet`, `cashflow`) provide up to 4–5 fiscal years of accounting data according to Yahoo Finance's published statement limits. For newer listings or demerged entities (e.g. `TMCV.NS`), available records reflect actual trading history since listing.

## Docker Setup

Run the full stack locally with Docker:
=======
# AuditGPT — AI Financial Fraud Detection Dashboard

A full-stack AI-powered financial fraud detection platform with a React frontend, FastAPI backend, and MongoDB integration.

![AuditGPT](https://img.shields.io/badge/AuditGPT-v1.0-00d4ff?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square)

---

## Project Structure

```
auditgpt/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── routers/
│   │   └── analysis.py          # POST /api/analyze-company
│   ├── models/
│   │   └── company.py           # Pydantic models
│   └── services/
│       └── mock_data.py         # Mock fraud analysis generator
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── utils/
│       │   ├── api.js
│       │   └── format.js
│       └── components/
│           ├── Header.jsx
│           ├── SearchBar.jsx
│           ├── FraudScoreCard.jsx
│           ├── StatCards.jsx
│           ├── AISummary.jsx
│           ├── RevenueChart.jsx
│           ├── RiskRadar.jsx
│           ├── RedFlags.jsx
│           ├── LoadingState.jsx
│           └── EmptyState.jsx
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be live at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

App will be live at: http://localhost:5173

For Vercel, add `VITE_API_URL` in the frontend project's Environment Variables.
It must be the deployed FastAPI backend origin, for example `https://your-api.onrender.com`.

---

## API Reference

### POST /api/analyze-company

**Request:**
```json
{ "company_name": "Enron Corp" }
```

**Response:**
```json
{
  "company_name": "Enron Corp",
  "analyzed_at": "2024-01-15T10:30:00",
  "fraud_score": 87,
  "risk_level": "CRITICAL",
  "risk_color": "#ef4444",
  "summary": "AI-generated risk summary...",
  "red_flags": ["Revenue recognized before delivery confirmed", ...],
  "revenue_trend": [{ "month": "Jan", "value": 42000000, "anomaly": false }, ...],
  "expense_trend": [...],
  "anomaly_flags": [{ "month": "Mar", "type": "Revenue spike" }, ...],
  "risk_categories": [{ "category": "Revenue Manipulation", "score": 91 }, ...],
  "financials": {
    "total_revenue": 580000000,
    "total_expenses": 430000000,
    "anomalies_detected": 3,
    "periods_reviewed": 12,
    "data_completeness": 94
  }
}
```

---

## Features

| Feature | Status |
|---------|--------|
| Company search input | ✅ |
| Quick suggestion chips | ✅ |
| Fraud risk score ring | ✅ |
| Risk level badge (CRITICAL/HIGH/MODERATE/LOW) | ✅ |
| 6 financial stat cards | ✅ |
| AI summary with typewriter effect | ✅ |
| Revenue & expense bar+line chart | ✅ |
| Anomaly markers on chart | ✅ |
| Risk breakdown bars (6 categories) | ✅ |
| Red flags grid | ✅ |
| Skeleton loading state | ✅ |
| Error state | ✅ |
| MongoDB integration (ready) | ✅ |

---

## Docker (Optional)
>>>>>>> origin/main

```bash
docker-compose up --build
```

<<<<<<< HEAD
Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`

For production, configure backend API URLs and environment variables in the hosting dashboard before deployment.

## License

This project is built for educational and financial risk analysis use cases.
=======
---

## MongoDB Integration

To enable real data persistence, update `backend/services/mock_data.py` to use the `motor` async MongoDB client. A `.env` file template:

```env
MONGODB_URL=mongodb://localhost:27017
DB_NAME=auditgpt
```

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide R`eact
- **Backend**: FastAPI, Uvicorn, Pydantic v2
- **Database**: MongoDB (via Motor async driver)
- **Fonts**: Syne (display), DM Sans (body), JetBrains Mono (data)
>>>>>>> origin/main
