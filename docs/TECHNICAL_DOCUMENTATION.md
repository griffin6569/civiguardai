# CiviGuard AI Technical Documentation

## 1. Purpose and Scope

CiviGuard AI is a civic infrastructure monitoring platform focused on Kenyan public infrastructure. The application combines citizen reporting, geospatial visualization, workflow management, AI-assisted analysis, and administrative intelligence on top of a Supabase backend.

This document describes the implementation currently present in the repository, including:

- Frontend architecture
- Backend and database architecture
- Authentication and authorization
- Report lifecycle and offline behavior
- AI and serverless functions
- External data synchronization
- Environment and deployment requirements
- Target-state platform upgrades

## 2. Technology Stack

### Frontend

- React 18 with TypeScript
- Vite 5 for local development and builds
- React Router for SPA routing
- TanStack React Query for data fetching and caching
- Tailwind CSS and shadcn/ui for UI primitives
- Framer Motion for page and component animation
- Leaflet for map rendering

### Backend and Platform

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions running on Deno
- Row Level Security for table access control

### AI and Data Services

- Google Gemini API via `GEMINI_API_KEY`
- `gemini-3.1-flash-lite-preview` for chat and image analysis, plus `gemini-3-flash-preview` for structured prediction output
- Google News RSS for infrastructure-related news ingestion
- Mocked external infrastructure feeds for admin sync workflows

## 3. High-Level Architecture

The system is implemented as a client-side React SPA backed by Supabase services.

```text
React SPA
  |- Public landing page
  |- Citizen dashboard and reporting flows
  |- Admin dashboard and operations tools
  |- Floating chatbot UI
  |- Offline queue and draft storage in IndexedDB

Supabase
  |- Auth for sign-in, sign-up, session persistence, and role lookup
  |- Postgres for reports, assets, alerts, roles, audit, and workflow data
  |- Storage bucket for uploaded report evidence
  |- Edge Functions for AI analysis, chat, predictions, news, and source sync
```

## 4. Frontend Architecture

### 4.1 Application Shell

The main app is wired in `src/App.tsx`, where the application:

- Initializes React Query
- Wraps the app in `AuthProvider`
- Registers protected and admin-only routes
- Mounts global UI such as toast notifications, the chatbot, the PWA install banner, and the offline banner
- Starts the background sync engine on app boot

### 4.2 Route Map

Current route structure:

- `/` public landing page
- `/login` authentication entry point with redirect behavior
- `/auth/callback` Supabase email callback flow
- `/report` authenticated citizen reporting page
- `/reports` authenticated report history page
- `/map` authenticated map page
- `/dashboard` authenticated citizen dashboard
- `/admin` admin-only dashboard
- `/docs` public in-app technical documentation page

### 4.3 Authentication State

Authentication is managed in `src/hooks/useAuth.tsx`.

Key behaviors:

- Supabase session is restored on load
- Auth state changes update `user`, `session`, and `isAdmin`
- Admin status is resolved by querying `user_roles`
- Sign-up and confirmation flows support a configurable redirect URL through `VITE_AUTH_REDIRECT_URL`

### 4.4 Reporting Workflow

The report submission flow lives in `src/pages/ReportPage.tsx`.

Features implemented:

- File upload or direct camera capture
- EXIF GPS extraction from uploaded images
- Browser geolocation fallback
- Reverse geocoding through OpenStreetMap Nominatim
- AI image analysis via the `analyze-damage` edge function
- Client-side duplicate and spam checks before submit
- Offline queueing when network submission fails or the user is offline
- Local draft persistence using IndexedDB

### 4.5 Offline-First Layer

Offline support is split across:

- `src/lib/offlineStore.ts`
- `src/lib/syncEngine.ts`
- `src/components/AegisLinkPanel.tsx`

Implementation details:

- IndexedDB stores drafts in `report_drafts`
- IndexedDB stores pending submissions in `sync_queue`
- IndexedDB stores relay metadata in `relay_packets`
- Background sync retries queued submissions when connectivity returns
- Images are uploaded to Supabase Storage during replay
- Retry state is tracked client-side with a max retry count of 5

### 4.5.1 AegisLink Mode

The application now includes a first-pass `AegisLink Mode` for no-connectivity scenarios.

Current implementation:

- packages queued reports into portable relay packets
- supports offline packet export and import through file transfer
- uses the native mobile share sheet where supported
- tracks relay hop count and origin device metadata
- allows imported packets to sync as soon as a receiving device regains internet access

Important implementation note:

- this is a practical browser-safe relay design, not a full low-level Bluetooth or Wi-Fi Direct mesh stack
- packet transfer currently relies on OS-level sharing methods such as Nearby Share, AirDrop, Bluetooth file transfer, USB, or memory card transfer

### 4.6 Duplicate and Abuse Checks

`src/lib/duplicateDetection.ts` performs client-side screening before report submission.

Current rules:

- Proximity-based duplicate detection within 300 meters
- Text similarity comparison between title and description
- Spam throttling for repeated submissions within 5 minutes
- GPS sanity check against Kenya geographic bounds

### 4.7 Admin Operations

The main operations console is implemented in `src/pages/AdminDashboardPage.tsx`.

Notable capabilities in the current code:

- Report triage and status updates
- Hotspot clustering and priority scoring
- Reporter credibility leaderboard
- AI predictions and recommendation panels
- External source synchronization and sync log viewing
- Maintenance history and asset operations views
- PDF reporting workflow
- User role management

### 4.8 Chat Interface

The floating chat interface is implemented in `src/components/Chatbot.tsx`.

Behavior:

- Sends conversation history to the `chat` edge function
- Streams assistant responses via SSE
- Supports separate citizen and admin modes
- Uses markdown rendering for assistant responses
- Ships with suggested prompts for common infrastructure queries

## 5. Backend Architecture

### 5.1 Supabase Client Integration

The frontend uses a generated Supabase client in `src/integrations/supabase/client.ts`.

Configuration uses:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The client persists session state in `localStorage`.

### 5.2 Edge Functions

The repository currently contains ten serverless functions:

#### `analyze-damage`

Location: `supabase/functions/analyze-damage/index.ts`

Purpose:

- Accepts a base64-encoded image payload
- Calls the Gemini API directly
- Returns structured damage classification JSON

Response shape includes:

- `damage_type`
- `severity`
- `confidence`
- `title`
- `description`
- `explanation`
- `evidence_indicators`
- `recommendation`
- `needs_human_review`

#### `chat`

Location: `supabase/functions/chat/index.ts`

Purpose:

- Builds a grounded system prompt from database context and live news
- Fetches assets, reports, alerts, and news in parallel
- Streams model output back to the client

Modes:

- Citizen mode
- Admin mode with deeper operational context

#### `ai-predictions`

Location: `supabase/functions/ai-predictions/index.ts`

Purpose:

- Produces structured administrative intelligence from asset, report, and alert data

Expected output sections:

- `recommendations`
- `predictions`
- `risk_matrix`
- `executive_summary`
- `trend_analysis`
- `budget_allocation`

#### `fetch-news`

Location: `supabase/functions/fetch-news/index.ts`

Purpose:

- Queries Google News RSS with Kenya infrastructure search terms
- Parses RSS XML into a normalized article list

#### `sync-external-data`

Location: `supabase/functions/sync-external-data/index.ts`

Purpose:

- Simulates integration with external infrastructure datasets
- Transforms raw source records into normalized `infrastructure_assets`
- Deduplicates by geographic proximity
- Tracks sync history in `external_sync_logs`

Important note:

The current implementation uses generated sample datasets for KRB roads, county infrastructure, and public works projects rather than live government APIs.

#### `route-authority`

Location: `supabase/functions/route-authority/index.ts`

Purpose:

- maps a report to the most relevant authority using category, severity, distance, and lightweight jurisdiction rules
- writes a routing event and queues an authority notification

#### `evidence-authenticity`

Location: `supabase/functions/evidence-authenticity/index.ts`

Purpose:

- computes an authenticity score and fraud score for submitted evidence
- checks duplicate media, metadata validity, and GPS sanity
- stores fraud and authenticity audit records

#### `risk-score-engine`

Location: `supabase/functions/risk-score-engine/index.ts`

Purpose:

- converts recent reports into persisted risk zones
- writes zone snapshots and weighted score inputs
- updates linked reports with zone label and zone score

#### `escalation-engine`

Location: `supabase/functions/escalation-engine/index.ts`

Purpose:

- evaluates escalation rules against active risk zones
- raises priority, creates alerts, and queues authority notifications

#### `digital-twin-layers`

Location: `supabase/functions/digital-twin-layers/index.ts`

Purpose:

- returns a unified operational map payload
- aggregates assets, reports, alerts, risk zones, and authorities into one API response

## 6. Data Model

### 6.1 Core Tables

#### `infrastructure_assets`

Stores monitored infrastructure assets.

Important fields:

- `id`
- `name`
- `type`
- `latitude`
- `longitude`
- `health_score`
- `status`
- `last_inspection`
- `source_system`
- `external_id`
- `source_last_updated`
- `data_confidence`

#### `reports`

Stores citizen-submitted infrastructure issues and lifecycle metadata.

Important fields:

- `id`
- `user_id`
- `reporter_name`
- `reporter_email`
- `title`
- `description`
- `damage_type`
- `severity`
- `status`
- `latitude`
- `longitude`
- `address`
- `image_url`
- `ai_analysis`
- `asset_id`
- `assigned_to`
- `assigned_agency`
- `verified_at`
- `resolved_at`
- `estimated_cost`
- `estimated_completion`
- `inspection_notes`
- `priority_score`
- `impact_score`
- `people_affected`
- `safety_risk`
- `needs_human_review`
- `ai_confidence`
- `duplicate_of`
- `spam_flag`
- `fraud_flag`

#### `alerts`

Stores system or admin-created alerts.

Important fields:

- `id`
- `title`
- `message`
- `severity`
- `asset_id`
- `latitude`
- `longitude`
- `is_active`
- `created_at`

#### `user_roles`

Stores application roles separately from auth profiles.

Important fields:

- `id`
- `user_id`
- `role`

### 6.2 Operational and Audit Tables

#### `external_data_sources`

Tracks configured external source definitions and sync metadata.

#### `external_sync_logs`

Tracks sync runs, processed counts, and failures.

#### `repair_evidence`

Stores before/after evidence and repair notes tied to a report.

#### `report_status_history`

Stores the status change trail for reports.

#### `admin_audit_log`

Stores privileged admin actions, including role changes.

#### `offline_sync_queue`

Server-side representation of queued sync work for authenticated users.

#### `notification_subscriptions`

Stores user-specific infrastructure notification preferences.

#### `asset_maintenance_log`

Stores inspection and maintenance history for infrastructure assets.

### 6.3 National Response and Intelligence Tables

#### `authority_directory`

Stores agencies and responder endpoints such as roads authorities, police, hospitals, and county emergency offices.

#### `authority_jurisdictions`

Stores lightweight coverage rules for each authority using county, sub-county, or radius-based matching.

#### `authority_dispatch_templates`

Stores channel-specific notification templates for routed reports.

#### `report_routing_events`

Stores authority-matching decisions for each routed report.

#### `authority_notifications`

Stores queued or delivered outbound authority notifications.

#### `authority_acknowledgements`

Stores acknowledgement records from recipient authorities.

#### `risk_zones`

Stores persisted national risk-zone records such as `Monitor Zone`, `High Risk Zone`, and `Emergency Zone`.

#### `risk_zone_snapshots`

Stores historical snapshots of each risk zone for replay and trend analysis.

#### `risk_score_inputs`

Stores weighted scoring inputs used to compute a risk zone.

#### `report_media_fingerprints`

Stores hashes and media fingerprints used for duplicate evidence detection.

#### `evidence_authenticity_checks`

Stores computed authenticity and fraud assessments for a report.

#### `fraud_detection_events`

Stores event-level fraud findings and reason codes.

#### `escalation_rules`

Stores configurable thresholds for automatic escalation.

#### `escalation_events`

Stores trigger records for rule-based escalations.

## 7. Authentication, Authorization, and Security

### 7.1 Role Model

The project defines an `app_role` enum with:

- `admin`
- `user`

Roles are checked through the `public.has_role(_user_id, _role)` security definer function.

### 7.2 Default Role Assignment

User role assignment is implemented with a trigger on `auth.users`.

Current default behavior:

- `civiguardai@gmail.com` is promoted to `admin`
- all other users are assigned `user`

### 7.3 Admin RPCs

Two admin RPCs are present:

- `admin_list_users_with_roles(search_query text default null)`
- `admin_set_user_role(target_user_id uuid, new_role app_role)`

These functions:

- require an authenticated admin
- prevent demotion of the primary admin account
- write changes to `admin_audit_log`

### 7.4 Row Level Security

RLS is enabled across the application tables. Current policy patterns include:

- public or authenticated read access for non-sensitive operational tables
- ownership-based access for user-specific tables
- `has_role(auth.uid(), 'admin')` checks for privileged operations

One important implementation detail:

- `reports` were initially public-read in the first migration
- a later migration replaced that with authenticated self-read or admin-read access only

### 7.5 Storage Security

The `report-images` storage bucket is public.

Current storage rules allow:

- public read access
- open upload access scoped to the `report-images` bucket

This is convenient for the current UX, but it should be reviewed if stricter evidence privacy is required.

## 8. Report Lifecycle

The effective report lifecycle in the codebase is:

1. User captures or uploads evidence
2. Location is derived from EXIF or device geolocation
3. Optional AI analysis classifies damage
4. Client runs duplicate and spam checks
5. Report is submitted directly or queued offline
6. Evidence authenticity checks can assign fraud and trust scores
7. Routing can assign the report to a target authority
8. Risk engines can place the report into a live risk zone
9. Escalation logic can raise alerts and outbound authority notifications
10. Admin reviews and updates status
11. Status changes are recorded in `report_status_history`
12. Resolution and maintenance metadata can be added later

Status values currently used in schema and UI include:

- `submitted`
- `reviewing`
- `in_progress`
- `resolved`
- `dismissed`

The admin dashboard also references additional states such as `approved`, `verified`, `pending`, and `citizen_confirmed`, so status vocabulary should be consolidated in a future cleanup pass.

## 9. Analytics and Decision Support

### 9.1 Hotspot Clustering

The admin dashboard clusters reports within a 0.5 km radius using the Haversine formula.

Each cluster computes:

- unique reporter count
- recency-weighted score
- severity weight
- volume score
- composite priority score
- urgency tier
- estimated resolution days

Auto-escalation occurs when a cluster contains at least 3 unique reporters.

### 9.2 Reporter Credibility

Reporter ranking is computed client-side from:

- approval rate
- report volume
- category diversity
- reporting consistency
- recency
- penalties for rejected reports

Output tiers:

- `gold`
- `silver`
- `bronze`
- `new`
- `flagged`

### 9.3 Predictive Maintenance

Administrative predictive intelligence is driven by:

- asset health scores
- active alerts
- report volume and severity
- generated AI recommendations and budget allocations

## 10. Environment Configuration

### 10.1 Frontend Environment Variables

From `.env.example`:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_AUTH_REDIRECT_URL=
```

### 10.2 Edge Function Secrets

Required in the Supabase function runtime:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 11. Local Development

### 11.1 Install and Run

```bash
npm install
npm run dev
```

### 11.2 Other Useful Commands

```bash
npm run build
npm run lint
npm run test
```

### 11.3 Local Requirements

You need:

- Node.js for the Vite frontend
- a configured Supabase project
- matching frontend environment variables
- edge function secrets for AI-backed features

Without AI credentials, the app still loads, but image analysis, chat, and prediction features will fail gracefully.

### 11.4 Moving to a New Supabase Project

To migrate this repository to your own Supabase account:

1. Create a new Supabase project in your account
2. Update local frontend variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_AUTH_REDIRECT_URL`
3. Link the CLI to your project:
   - `supabase link --project-ref <your-project-ref>`
4. Push the schema and seed state:
   - `supabase db push`
5. Set required edge-function secrets:
   - `supabase secrets set GEMINI_API_KEY=...`
   - `supabase secrets set SUPABASE_URL=https://<your-project-ref>.supabase.co`
   - `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`
6. Deploy the edge functions:
   - `supabase functions deploy analyze-damage`
   - `supabase functions deploy ai-predictions`
   - `supabase functions deploy chat`

## 12. Deployment Notes

The repository contains:

- `vercel.json`
- PWA assets in `public/`
- a `.vercel/` folder

The frontend is deployable as a static Vite application, while the backend relies on Supabase-hosted services.

Production readiness notes:

- the external sync pipeline is still mock-data driven
- the storage bucket is public
- some seeded migration data uses non-Kenyan coordinates and appears to be legacy bootstrap content
- UI documentation and README content should be aligned with the later schema migrations

## 13. Target-State Platform Upgrades

The current codebase already contains the foundations for priority scoring, duplicate detection, predictive insights, and geospatial operations. The next major evolution is to turn those isolated capabilities into a unified national intelligence and response platform.

### 13.1 Automatic Authority Routing

Goal:

- route validated reports directly to the most relevant authority based on issue type, severity, and coordinates

Implementation status:

- backend schema and initial routing function scaffold are now present
- first-wave seeded authorities are included for roads, police, fire, emergency, hospital, and county office use cases

Target behavior:

- road issue -> Kenya National Highways Authority in the first release
- crime or security issue -> nearest police station
- fire incident -> county emergency or fire response office
- public health or casualty event -> nearest hospital or county health office

Recommended architecture:

- add an `authority_directory` table for agencies, stations, hospitals, county offices, and emergency contacts
- add an `authority_jurisdictions` table for polygons or radius-based coverage areas
- add a `report_routing_events` table to log routing decisions, delivery status, and acknowledgements
- create a `route-authority` edge function that accepts report ID, coordinates, issue type, and severity

Routing decision flow:

1. reverse geocode the report coordinates
2. determine county, sub-county, and nearest authority candidates
3. apply category rules such as road, crime, fire, or health
4. choose the nearest or jurisdiction-owning authority
5. create a routing record and dispatch notification

External services and data needed:

- mapping API or geospatial search service for nearest facilities
- Kenya authority reference dataset
- county and constituency boundary data
- optional email, SMS, or webhook delivery channel

Suggested future schema additions:

- `authority_directory`
- `authority_jurisdictions`
- `report_routing_events`
- `authority_dispatch_templates`

### 13.2 Real-Time Risk Intelligence Layer

Goal:

- convert raw reports into live national risk zones instead of just displaying individual incidents

Implementation status:

- backend risk-zone persistence, snapshots, and weighted score inputs are now scaffolded
- the current engine computes zones from recent reports, nearby assets, and active alerts

Target outputs:

- `Monitor Zone`
- `High Risk Zone`
- `Emergency Zone`

Recommended scoring inputs:

- number of reports in cluster
- severity mix
- time decay and recent surge patterns
- geographic density
- nearby critical assets
- active alerts
- historical repeat incidents

Recommended scoring model:

```text
Risk Score =
  (report volume * 0.25) +
  (severity weight * 0.25) +
  (time-pattern acceleration * 0.15) +
  (location density * 0.15) +
  (asset vulnerability * 0.10) +
  (active alerts * 0.10)
```
Recommended thresholds:

- `0-39` -> `Monitor Zone`
- `40-69` -> `High Risk Zone`
- `70-100` -> `Emergency Zone`

Recommended implementation:

- create a `risk_zones` table that stores zone geometry, score, label, and freshness metadata
- compute risk zones in a scheduled edge function or background job
- surface those zones in the admin dashboard and map page as a separate intelligence layer
- retain historical snapshots for trend analysis and replay

Suggested future schema additions:

- `risk_zones`
- `risk_zone_snapshots`
- `risk_score_inputs`

### 13.3 Evidence Authenticity System

Goal:

- reduce fake, duplicated, or manipulated reports before they affect routing, risk scoring, or escalation

Implementation status:

- the first-pass authenticity engine is now scaffolded
- it currently performs hash-based duplicate checks, metadata validation, and Kenya-bounds GPS checks

Recommended fraud checks:

- duplicate image detection using perceptual hashing or embedding similarity
- EXIF metadata validation
- GPS-to-image consistency checks
- timestamp anomaly checks
- repeat submission anomaly detection by account, device, and network
- text and image mismatch detection

Recommended scoring outputs:

- `authenticity_score`
- `fraud_score`
- `fraud_reason_codes`
- `requires_manual_review`

Recommended implementation:

- extend the current duplicate detection layer beyond title and location similarity
- add an `evidence-authenticity` edge function for image and metadata analysis
- store all fraud decisions and model evidence in a dedicated audit table
- prevent low-trust reports from triggering automated authority routing until reviewed

Suggested future schema additions:

- `evidence_authenticity_checks`
- `report_media_fingerprints`
- `fraud_detection_events`

### 13.4 Smart Escalation System

Goal:

- move from passive admin review to event-driven escalation

Implementation status:

- escalation rules and escalation events are now part of the schema
- the first engine can raise priority, create alerts, and queue notifications from active risk zones

Recommended escalation triggers:

- at least 3 reports in a cluster
- high or critical severity
- `High Risk Zone` or `Emergency Zone`
- repeated reports tied to the same asset
- authority routing success plus no response within SLA window

Recommended automatic actions:

- increase report or cluster priority score
- create an active alert
- notify the mapped authority
- mark the issue as escalated in the admin dashboard
- create an audit trail for every escalation step

Recommended implementation:

- create an `escalation-engine` edge function or scheduled worker
- unify hotspot logic, risk zones, and authority routing into a single escalation policy layer
- add delivery and acknowledgement tracking so the system knows whether escalation led to action

Suggested future schema additions:

- `escalation_rules`
- `escalation_events`
- `authority_notifications`
- `authority_acknowledgements`

### 13.5 National Digital Twin

Goal:

- turn the platform into a live operational map of Kenya's infrastructure state

Implementation status:

- a `digital-twin-layers` edge function now aggregates assets, reports, alerts, risk zones, and authorities into one payload
- frontend map integration is still pending

Target experience:

- live map of roads, bridges, utilities, public facilities, and incident reports
- risk zones layered over real assets
- authority jurisdictions and response locations
- asset health state, maintenance history, and unresolved issue overlays

Core building blocks:

- national asset registry ingestion
- normalized asset identifiers across all government and partner datasets
- geospatial indexing for real-time queries
- live incident overlays from citizen and official sources
- time-series snapshots for playback and planning

Recommended map layers:

- infrastructure assets
- live reports
- alerts
- risk zones
- authority coverage areas
- maintenance and repair status

Recommended backend additions:

- PostGIS-enabled spatial queries if available
- scheduled ingestion pipelines for official datasets
- snapshot generation for daily national-state summaries
- APIs optimized for bounding-box and tile-based map loading

### 13.6 Recommended Delivery Phases

Phase 1:

- authority directory and routing engine
- first version of risk score engine
- evidence authenticity checks
- first version of AegisLink relay packets

Phase 2:

- smart escalation rules
- authority notifications and acknowledgements
- admin intelligence views for routed and escalated cases

Phase 3:

- national digital twin map layers
- live infrastructure registry ingestion
- historical replay and national planning dashboards

## 14. Known Implementation Gaps

The current repository is functional, but these areas should be treated as follow-up work:

- Normalize report statuses across schema, admin logic, and documentation
- Align seeded database content with the Kenya-focused product narrative
- Replace mock external feeds with real source integrations
- Revisit public storage upload and read policies
- Consolidate in-app docs, README, and technical docs to a single source of truth
- Expand the seeded authority registry from starter records to full national coverage
- Add real delivery integrations for email, SMS, or webhooks to authorities
- Replace lightweight radius jurisdiction logic with stronger county boundary or polygon matching
- Unify fraud detection, hotspot scoring, and predictive logic into one trusted risk pipeline
- Connect the new risk, routing, fraud, and digital twin APIs to the frontend

## 15. Suggested Next Documentation Artifacts

Recommended follow-up documents:

- `docs/API_REFERENCE.md` for edge function request and response contracts
- `docs/DB_SCHEMA.md` for table-by-table schema detail
- `docs/OPERATIONS_RUNBOOK.md` for admin operations and incident handling
- `docs/DEPLOYMENT.md` for Vercel and Supabase deployment steps
- `docs/AUTHORITY_ROUTING_SPEC.md` for dispatch rules and jurisdiction mapping
- `docs/RISK_ENGINE_SPEC.md` for zone scoring and escalation thresholds
- `docs/FRAUD_DETECTION_SPEC.md` for evidence authenticity design
