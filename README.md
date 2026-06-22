# Blood Analysis Report Platform

An AI-powered blood report analysis system that extracts biomarkers from uploaded PDF reports using OCR, performs health risk scoring, and delivers personalized medical recommendations.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│              Tailwind CSS · TypeScript                   │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────┐
│                  Backend (Python / FastAPI)              │
│                                                         │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Auth (JWT │  │ PDF Upload & │  │  AI Analysis &  │  │
│  │ + bcrypt) │  │   OCR (CV2,  │  │  Risk Scoring   │  │
│  │           │  │   PyMuPDF)   │  │  (Google GenAI) │  │
│  └───────────┘  └──────────────┘  └─────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │         SQLAlchemy ORM + Alembic Migrations      │   │
│  └──────────────────────────┬───────────────────────┘   │
└─────────────────────────────┼───────────────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │    SQLite (blood_analysis.db)│
               └─────────────────────────────┘
```

## Folder Structure

```
D:\Projects\
├── README.md
├── backend/
│   ├── app/                    # FastAPI application
│   │   ├── main.py             # App entry point, CORS config
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── routes/             # API endpoint handlers
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (OCR, AI analysis)
│   │   ├── core/               # Config, security, dependencies
│   │   └── migrations/         # Alembic DB migrations
│   ├── uploads/                # Uploaded PDF storage
│   ├── requirements.txt        # Python dependencies
│   ├── blood_analysis.db       # SQLite database
│   └── venv/                   # Python virtual environment
└── frontend/
    ├── src/
    │   ├── app/                # Next.js app router pages
    │   ├── components/         # React UI components
    │   └── lib/                # API client, utilities
    ├── package.json
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── next.config.js
```

> **Note:** Source files (`.py`, `.ts`, `.tsx`) are not currently present in the working directory — only build artifacts (`venv/`, `node_modules/`, `.next/`, `blood_analysis.db`) remain. This README is reconstructed from database schema analysis and installed dependency inspection.

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, hashed password, full name, DOB, gender, role) |
| `reports` | Uploaded blood report PDFs (file URL, status, metadata JSON, file size) |
| `biomarkers` | Extracted biomarker values (name, value, unit, reference range, status, severity) |
| `analyses` | AI-generated analysis summaries (risk level, model version, patient summary, key findings) |
| `recommendations` | Health recommendations per analysis (category, priority, confidence/evidence scores, safety check) |
| `audit_logs` | User activity tracking (action, table, record, old/new values, IP) |
| `alembic_version` | Database migration version tracking |

### Key Relationships

- `users` → `reports` (one-to-many)
- `reports` → `biomarkers` (one-to-many)
- `reports` → `analyses` (one-to-one)
- `analyses` → `recommendations` (one-to-many)

## Backend Dependencies

| Category | Packages |
|----------|----------|
| Web Framework | FastAPI, Uvicorn |
| ORM & DB | SQLAlchemy, Alembic, SQLite |
| Authentication | bcrypt, PyJWT / python-jose |
| PDF/OCR | PyMuPDF (fitz), OpenCV (cv2), Pillow |
| AI/ML | google-generativeai (Gemini), numpy, pandas |
| Validation | Pydantic |
| HTTP Client | aiohttp, requests |
| Misc | psutil, cryptography |

## Frontend Dependencies

| Category | Packages |
|----------|----------|
| Framework | Next.js (with SWC compiler) |
| Styling | Tailwind CSS, LightningCSS |
| Language | TypeScript |

## Key Features

1. **User Authentication** — JWT-based auth with bcrypt password hashing; role-based access (PATIENT role observed)
2. **PDF Report Upload** — Accepts blood test PDFs, stores in `uploads/` directory
3. **OCR & Biomarker Extraction** — Extracts biomarker names, values, units, and reference ranges from scanned reports
4. **AI Health Analysis** — Uses Google Generative AI (Gemini) to produce:
   - System-level risk scores (cardiovascular, metabolic, renal, liver, hematologic, electrolytes)
   - Overall health score (0–100)
   - Executive summary with top problems, urgency, short/long-term plans
   - Follow-up test recommendations
5. **Personalized Recommendations** — Priority-ranked health recommendations with confidence and evidence scores
6. **Audit Logging** — Tracks all user actions with old/new value diffs and IP addresses
7. **Report Generation** — Produces PDF analysis reports stored alongside uploads

## Report Processing Pipeline

```
Upload PDF → Store file → OCR/Parse biomarkers → AI analysis (Gemini)
    → Risk scoring → Recommendations → Generate report PDF → COMPLETED
```

Report statuses: `PROCESSING` → `COMPLETED` | `FAILED`

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 18+
- Google Generative AI API key

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
# Set environment variables (API keys, DB URL, JWT secret)
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite connection string |
| `SECRET_KEY` | JWT signing secret |
| `GOOGLE_API_KEY` | Google Generative AI (Gemini) API key |
| `UPLOAD_DIR` | File upload directory path |

## API Endpoints (Inferred)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | JWT token login |
| POST | `/reports/upload` | Upload blood test PDF |
| GET | `/reports/{id}` | Get report status & metadata |
| GET | `/reports/{id}/biomarkers` | Get extracted biomarkers |
| GET | `/reports/{id}/analysis` | Get AI analysis & risk scores |
| GET | `/reports/{id}/recommendations` | Get health recommendations |

## Database Migrations

Managed via Alembic. Current version: `35d8cf31e4c9`

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Test Flow

Based on database records, the testing approach includes:
- **Unit/Integration tests** using test user accounts (`test_*@example.com`)
- Tests exercise the full pipeline: user registration → PDF upload → OCR → analysis → recommendations
- Debug user (`debug_user@example.com`) for manual pipeline verification

## CI/CD Setup

No CI/CD configuration files (`.github/workflows/`, `Jenkinsfile`, etc.) were found in the project. Deployment appears to be manual.

### Recommended CI/CD Pipeline

```yaml
# Suggested GitHub Actions workflow
stages:
  - lint & type-check (ruff/mypy for Python, tsc/eslint for frontend)
  - unit tests (pytest)
  - integration tests (full pipeline with test PDFs)
  - build frontend (next build)
  - deploy
```

## License

Not specified.
