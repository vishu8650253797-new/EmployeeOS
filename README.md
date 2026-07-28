# EmployeeOS

A production-quality, full-stack Employee & HR Management SaaS MVP.

## Stack

- **Frontend:** React 18, Vite 6, Tailwind CSS 4, React Router DOM 7, Axios, Lucide React
- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **Auth:** JWT + RBAC architecture prepared (mock implementation in this phase)

## Project structure

```text
EmployeeOS/
├── frontend/   # Vite React SPA
└── backend/    # Express REST API skeleton
```

## Quick start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

Demo login: any email (e.g. `admin@employeeos.io`) + any 6+ character password.

### Backend

```bash
cd backend
cp .env.example .env
# add your MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

API runs on http://localhost:5000.

## Features implemented in this MVP

- Premium authentication UI (login, forgot password, reset password)
- Responsive dashboard with HR analytics, charts, and activity feeds
- Employee list with search, filters, pagination, sorting, add/edit/delete
- Employee profile with tabbed sections
- Department list, create/edit/delete, and details page
- Attendance overview and filtered records table
- Leave request list, approve/reject actions with confirmation dialogs
- Reusable design system and component library
- Toast notifications, skeletons, empty/error/loading states
- Backend skeleton with multi-tenant models and route structure ready
