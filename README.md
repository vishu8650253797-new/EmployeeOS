# EmployeeOS

A production-quality, full-stack Employee & HR Management SaaS platform — core HR, recruitment, onboarding/offboarding, asset management, payroll, and an employee self-service portal, all built on a shared multi-tenant architecture with real authentication, RBAC, audit logging, and real-time updates.

## Stack

- **Frontend:** React 18, Vite 6, Tailwind CSS 4, React Router DOM 7, Axios, Socket.IO client, Lucide React
- **Backend:** Node.js, Express, MongoDB (Mongoose), Socket.IO
- **Auth:** JWT access + refresh tokens, role-based access control (RBAC), organization/tenant isolation
- **Testing:** Jest + Supertest + mongodb-memory-server (18 suites, 170+ tests)

## Project structure

```text
EmployeeOS/
├── frontend/   # Vite React SPA
└── backend/    # Express REST API + Socket.IO server
```

## Quick start

### Backend

```bash
cd backend
cp .env.example .env
# set MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm install
npm run dev
```

API runs on http://localhost:5100. `npm run dev` does **not** auto-reload on file changes (plain `node server.js`) — restart it after backend edits.

Set `SEED_ADMIN=true` in `.env` to auto-create a `SUPER_ADMIN` account on first boot (`admin@employeeos.io` / `Password123` by default, configurable via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Features

### Core HR

- Employee directory: search, filters, pagination, sorting, create/edit/delete, profile with tabbed sections, avatar/photo upload, bank details & tax info
- Department management: list, create/edit/delete, department detail pages
- Attendance: check-in/check-out, admin attendance records, per-employee/department summaries and stats
- Leave: configurable leave types, per-employee leave balances (allocated/used/pending/remaining), leave request submission with working-day duration calculation and overlap detection, manager/HR approval workflow
- Performance: review cycles, goals, KPIs, performance reviews, feedback, performance analytics

### Recruitment & ATS

- Job openings, public careers site with job listings and application forms
- Candidate pipeline (kanban), candidate profiles, notes and activity timeline
- Interview scheduling and feedback
- Offer creation, candidate-facing offer response page
- Recruitment analytics dashboard

### Onboarding & Offboarding

- Onboarding templates and per-hire onboarding processes with task tracking
- Pre-boarding: bank details, tax info, profile photo, document collection via secure emailed links
- Offboarding lifecycle: initiation, manager/HR approval, notice period, department clearances (HR/IT/Finance/Manager), asset return tracking, exit interviews, knowledge transfer, access deactivation, final settlement preparation, completion

### Enterprise Asset Management

- Asset inventory, categories, vendors, assignment/reassignment/return
- Asset requests (employee-submitted, approval workflow)
- Maintenance tracking and asset analytics

### Payroll & Salary Management

- Configurable salary components (earnings/deductions/employer contributions; fixed, % of basic, % of gross, % of another component) and salary structures built from them
- Employee compensation assignment with full effective-dated history (raises never overwrite prior records)
- Payroll periods and payroll runs with a full workflow: draft → process → calculate → submit → approve → finalize, plus recalculation and cancellation
- A pure, unit-tested calculation engine (deterministic evaluation order, cycle detection, proration for mid-period joiners) — all money stored as integer minor units to avoid floating-point drift
- Payslips (employee self-service and HR/Finance views) and payroll analytics (cost trends, department cost breakdown)
- Immutability enforced after finalization; duplicate-run and duplicate-payment protection via database constraints

### Employee Self-Service (ESS) Portal

- `/ess` — self-service dashboard showing the logged-in employee's own status and a capability grid (Profile, Attendance, Leave, Payroll, Documents, Notifications; server-computed availability, not hard-coded)
- `/ess/profile` — view/edit personal contact info (phone, personal email, address), profile photo, and emergency contacts (add/edit/remove, up to 3); employment fields (department, title, manager, status, salary) are HR-controlled and shown read-only
- `/ess/leave` + `/ess/leave/history` + `/ess/leave/:id` — leave balance cards, apply for leave, full filterable/paginated history, request detail with cancellation where eligible
- `/ess/attendance` — monthly attendance summary and record history with detail view
- `/my-payslips` — employee payslip history and detail (finalized payroll only)
- Every ESS endpoint resolves "who am I" strictly from the authenticated session (`User.employeeId` → `Employee`, org- and status-checked) — a client can never pass its own `employeeId`/`organizationId` to see or modify someone else's data

### Platform-wide

- JWT access/refresh authentication, RBAC via role allowlists, full organization/tenant isolation on every query
- Audit logging on all sensitive mutations (payroll, offboarding, compensation, profile changes, security-relevant ESS access denials, etc.)
- Centralized notification system (in-app + real-time) with per-category user preferences
- Socket.IO real-time updates scoped to organization/user rooms, with minimal, non-sensitive payloads
- Reusable design system (cards, tables, modals, forms, badges, skeletons, empty/error/loading states) used consistently across every module
- Responsive, accessible UI (keyboard navigation, focus states, ARIA labeling, no color-only status indicators)

## Testing

```bash
cd backend
npm test
```

18 test suites covering unit tests (payroll calculation engine), integration tests (every module's CRUD/workflow), and security tests (IDOR/BOLA, tenant isolation, mass-assignment protection, ownership boundaries) across core HR, onboarding/offboarding, assets, payroll, and ESS.
