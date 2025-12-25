# EventSnap



EventSnap is a robust backend platform designed for seamless event management, enabling users to create, discover, join, and organize events efficiently. The system facilitates distinct access levels for Admins, Hosts, and Clients—empowering granular permissions, payment handling via SSLCommerz, real-time analytics, dynamic user management, host and event oversight, and multi-channel notifications. EventSnap is engineered with advanced personalization (matching user interests to events), transactional integrity, and a 90/10 revenue distribution model. Built using TypeScript, Prisma ORM, PostgreSQL, and modern Node.js methodologies, it is structured for scalability and security.

---

## Project Overview

- Intuitive event discovery and participation based on personalized user interests.
- Hosts manage event lifecycle and monitor participant engagement with transparent payment processing.
- Administrators oversee platform operations including user, host, and event governance as well as system reporting.
- Comprehensive statistics and dashboards provide actionable insights for all roles.

---

## Technology Stack

### Backend & Core

- **Node.js** — High-performance JavaScript runtime.
- **Express.js** — RESTful API routing and middleware.
- **TypeScript** — Advanced type safety for scalable codebases.

### Data Layer

- **Prisma ORM** — Type-safe ORM for PostgreSQL integration.
- **PostgreSQL** — Reliable, cloud-ready relational database (Neon DB for production).
- **@prisma/client** — Auto-generated client for database operations.

### Security & Authentication

- **jsonwebtoken** — Secure JWT access and refresh token handling.
- **bcryptjs** — Password security via robust hashing.
- **cookie-parser** — Facilitates secure token storage through HTTP cookies.

### Validation & Utilities

- **zod** — Precise request validation.
- **uuid** — Universal unique ID generator.

### Media & Storage

- **Multer** — File upload middleware supporting multipart/form-data.
- **multer-storage-cloudinary** — Seamless integration with Cloudinary for media storage.
- **Cloudinary** — Image storage, transformation, and optimization.

### Communication

- **nodemailer** — SMTP email sending.
- **EJS** — Flexible, template-based email content rendering.

### Networking & APIs

- **Axios** — HTTP client, including support for SSLCommerz communications.
- **CORS** — Cross-Origin Resource Sharing management.
- **http-status**, **http-status-codes** — Response code utilities for consistent API responses.

### Middleware & Tooling

- **express-rate-limit** — Throttling requests for API protection.
- **dotenv** — Environment variable loader and manager.

### Development Utilities

- **ts-node**, **ts-node-dev**, **tsx** — TypeScript runtime and dev tooling.
- **Type Definitions** — Complete type coverage for all major packages through `@types/*`.

---

## Feature Highlights

### Authentication & Roles

- JWT-based OAuth with HTTP-only cookie support.
- Three-tiered access: **ADMIN**, **HOST**, and **CLIENT** utilizing fine-grained route guards.
- Secure credential management and refresh workflows.

### Profile Management

- Dynamic user profiles: support for avatars, interests, location, and contact details.
- Admin and user-level profile visibility, with advanced search and pagination.

### Event Management

- Hosts: Comprehensive control over event creation, updates, completion, and deletion.
- Lifecycle tracking with automated state transitions (PENDING, OPEN, FULL, COMPLETED, REJECTED, CANCELLED).
- Intelligent seat management ensuring transactional integrity.

### Participation

- Clients join and leave events with seat availability updating atomically.
- Real-time participation flags enhance host/admin event tracking.

### Payment Processing

- SSLCommerz-powered payments with automated tracking.
- Role-based payment visibility, rigorous revenue splits (90% host / 10% admin).
- Administrative and host income records updated with each transaction.

### Reviews and Ratings

- Only clients who have paid and attended events may submit reviews.
- Robust system for host rating updates and duplicate prevention.
- Recent reviews endpoint for platform trust-building.

### Analytics & Meta

- Public and role-based dashboards for real-time data on users, events, revenues, and engagement.
- Landing page statistics reflecting overall platform activity.

### Email & Notifications

- Modular, template-driven notification system for all key workflows (contact, application, payment, etc.).
- SMTP delivery via Nodemailer/EJS for consistent user experience.

### Security and Validation

- API rate limiting, central error handling, and role-aware route restrictions.
- All input data is strictly validated using Zod.

### File Management

- Media uploads handled transactionally; old images automatically purged on update.
- Full integration with Cloudinary for optimized storage.

### Data Navigation

- Pagination, filtering, and sorting standardized across API endpoints for all lists.
- Personalization algorithms align user interests with event recommendations.

### Administrative Capabilities

- Full suite of host and event approval workflows.
- Suspension controls for users, with impact on authentication and access.
- Financial visibility restricted by role to protect sensitive data.

---

## Project Architecture

```
src/
  app.ts
  server.ts
  app/
    routes/
    middlewares/
    helpers/
    modules/
      auth/
      User/
      Host/
      Events/
      payment/
      review/
      Meta/
    shared/
    config/
  prisma/
    schema.prisma
```

---

## Environment Variables

```
NODE_ENV=development
PORT=5000
DATABASE_URL=

JWT_SECRET=
EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRES_IN=30d
RESET_PASS_TOKEN=
RESET_PASS_TOKEN_EXPIRES_IN=5m
SALT_ROUND=10

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

ADMIN_EMAIL=
ADMIN_PASSWORD=
FRONTEND_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SSL_STORE_ID=
SSL_STORE_PASS=
SSL_PAYMENT_API=
SSL_VALIDATION_API=
SSL_IPN_URL=
SSL_SUCCESS_BACKEND_URL=
SSL_FAIL_BACKEND_URL=
SSL_CANCEL_BACKEND_URL=
SSL_SUCCESS_FRONTEND_URL=
SSL_FAIL_FRONTEND_URL=
SSL_CANCEL_FRONTEND_URL=
```

---


## Test Credentials

**Admin**
- Email: admin@gmail.com
- Password: Admin123@

**Host**
- Email: host@gmail.com
- Password: Host123@

**Client**
- Email: client@gmail.com
- Password: Client123@

---

## API Overview

- **Auth**: `/api/v1/auth` – authentication workflows (sign in, refresh, reset, host applications).
- **User**: `/api/v1/user` – self/profile management, email contact to administrators.
- **Host**: `/api/v1/host` – event management (CRUD, completion), retrieve hosted events.
- **Event**: `/api/v1/event` – event browsing, joining/leaving, event details, recent/popular listings.
- **Payment**: `/api/v1/payment` – transaction records, SSLCommerz callbacks, admin/host views.
- **Review**: `/api/v1/review` – leave feedback, fetch latest reviews per host/event.
- **Meta**: `/api/v1/meta` – dashboards and statistics.

---

## Selected Endpoint Reference

### Auth

- `POST /api/v1/auth/login` – Sign in, returns tokens (optionally as cookies).
- `POST /api/v1/auth/refresh-token` – Access token renewal.
- `GET /api/v1/auth/me` – Authenticated user profile and role.
- `POST /api/v1/auth/reset-password` – Admin resets user passwords.
- `POST /api/v1/auth/apply-host` – Clients apply for host privileges.

### User

- `POST /api/v1/user/create-client` – Register (profile and avatar upload).
- `PATCH /api/v1/user/update-my-profile` – Update personal profile or interests.
- `POST /api/v1/user/send-email` – Contact the administrator.

### Admin

- `GET /api/v1/admin/host-applications` – Review host applications.
- `PATCH /api/v1/admin/host-applications/:id/approve|reject` – Host application management.
- `GET /api/v1/admin/event-applications` – Pending events for review.
- `PATCH /api/v1/admin/event-application/:id/approve|reject` – Approve/reject event postings.
- `GET /api/v1/admin/clients` – Client listing (search/filters).
- `GET /api/v1/admin/hosts` – Host listing (search/filters).
- `PATCH /api/v1/admin/suspend-user/:userId` – Suspend a user.
- `PATCH /api/v1/admin/unsuspend-user/:userId` – Re-enable a user.

### Host

- `POST /api/v1/host/create-event` – Propose a new event.
- `PATCH /api/v1/host/event/:eventId` – Modify event details.
- `DELETE /api/v1/host/event/:eventId` – Remove event.
- `GET /api/v1/host/my-hosted-events` – Retrieve all events organized by the host.
- `PATCH /api/v1/host/event-complete/:eventId` – Finalize event, open review window.

### Event (Public/Client)

- `GET /api/v1/event/all-events` – Filter/sort/search all available events.
- `GET /api/v1/event/:eventId` – Event detail retrieval.
- `POST /api/v1/event/join/:eventId` – Register to participate (triggers payment).
- `POST /api/v1/event/leave/:eventId` – Withdraw from an event before it starts.
- `GET /api/v1/event/my-events` – View all joined events.
- `GET /api/v1/event/participants/:eventId` – Retrieve event participants for host/admin roles.
- `GET /api/v1/event/recent-events` – Highlights of upcoming events.

### Payment

- `GET /api/v1/payment` – Search and view payments (scoped by role).
- `POST /api/v1/payment/success|fail|cancel` – Payment result webhooks.
- `POST /api/v1/payment/validate` – Handle payment finalization.

### Review

- `POST /api/v1/review/:transactionId` – Submit a review (one per client/event; only for completed, paid events).
- `GET /api/v1/review` – Fetch the 20 most recent reviews.

### Meta

- `GET /api/v1/meta` – Authenticated dashboard data for admins, hosts, or clients.
- `GET /api/v1/meta/landing-page` – Public-facing statistics for the landing page.

---

## Platform Behaviors & Policies

- Only future-dated events are listed; "recent events" APIs highlight upcoming opportunities (limit 6).
- Participant capacity, payment status, and event lifecycle transitions are managed within robust database transactions.
- Role-based data security is enforced across payments and reviews.
- Only verified event attendance allows review submission; one review per client/event.
- Administrative contact form submissions use EJS templating and are sent via SMTP.
- Event withdrawal permitted until start; no refunds after departure.

---

## Deployment Guidance

- Deployable on modern Node.js environments (e.g., Vercel) with managed PostgreSQL.
- Run `npx prisma generate` after any schema updates for database synchronization.

---
