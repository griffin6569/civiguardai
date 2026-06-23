
# CiviGuard AI

**Kenya's AI-powered infrastructure monitoring platform**

CiviGuard AI is a citizen-driven infrastructure monitoring platform designed for Kenya. It enables real-time reporting of damaged public infrastructure, AI-powered analysis of submitted evidence, geospatial visualization of incidents, and predictive risk assessment across critical sectors such as roads, bridges, water systems, sewage networks, power lines, and public buildings.

Technical documentation: [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md)

Developed by **Griffin Wekesa**.

---

## Overview

CiviGuard AI empowers citizens and administrators to work together in monitoring and improving infrastructure. Citizens can submit GPS-tagged reports with photo evidence, while the platform uses AI to analyze severity, detect trends, and support decision-making. Administrators can review reports, monitor hotspots, generate PDF reports, and access predictive insights for better planning and response. :contentReference[oaicite:1]{index=1}

---

## Core Features

### Citizen Reporting
- Submit infrastructure damage reports with photo evidence
- GPS-tagged issue reporting
- EXIF GPS extraction from uploaded images
- Browser geolocation fallback when EXIF data is unavailable
- Reverse geocoding using OpenStreetMap Nominatim

### AI Damage Analysis
- Automated damage severity classification
- Infrastructure damage type detection
- AI-generated descriptions and assessments
- Risk prediction and trend detection

### Geospatial Intelligence
- Real-time infrastructure map visualization
- Leaflet + OpenStreetMap integration
- Severity-based and asset-based map markers
- Hotspot cluster identification

### Priority & Hotspot Detection
- Frequency-based clustering using the Haversine formula
- Auto-escalation of repeated incidents
- Weighted priority scoring for urgent issue surfacing

### Reporter Credibility Engine
- Reporter scoring from 0–100
- Gold / Silver / Bronze / New / Flagged classification
- Approval-rate and consistency-based trust model

### RAG Chatbot
- Context-aware AI assistant
- Uses infrastructure data, alerts, reports, and live news
- Streaming responses via Server-Sent Events (SSE)

### Administrative Tools
- Approve or reject submitted reports
- Review hotspots and high-risk areas
- Generate filtered PDF reports
- Access AI predictions and budget-support intelligence

:contentReference[oaicite:2]{index=2}

---

## System Architecture

CiviGuard AI follows a **serverless-first architecture**:

- **Frontend:** React single-page application
- **Backend:** Supabase
- **Database:** PostgreSQL
- **Serverless Logic:** Edge Functions (Deno)
- **Authentication:** Email/password with JWT
- **Storage:** Supabase Storage
- **Security:** Row-Level Security (RLS)

### High-Level Architecture
- React SPA client
- Supabase JS SDK for communication
- PostgreSQL database for persistent data
- Edge Functions for AI analysis, news retrieval, predictions, and chat
- Google Gemini API for model access via Supabase Edge Functions

:contentReference[oaicite:3]{index=3}

---

## Data Flow

### 1. Report Submission
User uploads a photo → EXIF GPS is extracted → AI damage analysis runs → report is inserted into the database with RLS enforcement.

### 2. Admin Review
Admin reviews pending submissions → approves or rejects them → clustering and priority scores are recalculated.

### 3. AI Predictions
Edge Function gathers assets, reports, and alerts → sends structured context to Gemini → returns risk predictions in JSON format.

### 4. Chatbot Query
User asks a question → platform retrieves database context and live news → RAG prompt is built → streaming response is returned through SSE.

:contentReference[oaicite:4]{index=4}

---

## Database Schema

CiviGuard AI uses four main tables:

### `infrastructure_assets`
Stores monitored assets such as roads, bridges, water systems, power infrastructure, sewage, and buildings.

**Key fields:**
- `id`
- `name`
- `type`
- `status`
- `health_score`
- `latitude`
- `longitude`
- `last_inspection`

### `reports`
Stores citizen-submitted damage reports.

**Key fields:**
- `id`
- `title`
- `damage_type`
- `severity`
- `status`
- `description`
- `image_url`
- `latitude`
- `longitude`
- `address`
- `ai_analysis`
- `user_id`
- `reporter_name`
- `reporter_email`

### `alerts`
Stores active or historical alerts tied to assets or locations.

**Key fields:**
- `id`
- `title`
- `severity`
- `message`
- `is_active`
- `asset_id`
- `latitude`
- `longitude`

### `user_roles`
Stores platform roles separately from user profiles for security.

**Key fields:**
- `id`
- `user_id`
- `role`

:contentReference[oaicite:5]{index=5}

---

## Authentication & Access Control

Authentication is handled through **email/password login with JWT tokens**.

### Roles

#### Citizen (`user`)
- Submit reports
- View own reports
- Access map and alerts
- Use AI chatbot
- Track issue status

#### Administrator (`admin`)
- All citizen capabilities
- View all reports
- Approve/reject submissions
- Access hotspot engine
- View credibility leaderboard
- Generate PDF reports
- Use AI predictions

### Security Model
- Roles stored in dedicated `user_roles` table
- Row-Level Security enabled on all tables
- `has_role()` function implemented as a `SECURITY DEFINER` helper

:contentReference[oaicite:6]{index=6}

---

## Report Lifecycle

The platform follows a structured report pipeline:

1. **Submit**
   - Citizen submits report with image, GPS, and description

2. **AI Analyze**
   - AI classifies damage severity and type

3. **Admin Review**
   - Administrator approves, rejects, or prioritizes report

4. **Resolved**
   - Issue status is updated and tracked

### Extra Capabilities
- EXIF GPS extraction
- Browser geolocation fallback
- Reverse geocoding
- Camera integration
- County / sub-county / category filtering

:contentReference[oaicite:7]{index=7}

---

## AI Engine

CiviGuard AI uses the Gemini API from Google AI Studio through Supabase Edge Functions.

### Models Used

| Function | Model | Purpose |
|---|---|---|
| Chat (RAG) | `gemini-3.1-flash-lite-preview` | Infrastructure assistant with streaming |
| Predictions | `gemini-3-flash-preview` | Structured risk analysis |
| Damage Analysis | `gemini-3.1-flash-lite-preview` | Image-based damage severity classification |

### Prediction Output
The predictions engine returns structured JSON including:
- `predictions`
- `risk_matrix`
- `trends`

:contentReference[oaicite:8]{index=8}

---

## Priority Algorithm

The platform uses a **frequency-based priority algorithm** to identify urgent infrastructure issues.

### Formula

```text
Priority = (U × 0.40) + (R × 0.25) + (S × 0.20) + (V × 0.15)
