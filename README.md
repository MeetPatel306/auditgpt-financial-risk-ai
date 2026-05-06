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

```bash
docker-compose up --build
```

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
