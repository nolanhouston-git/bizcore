# BizCore

A full-stack small business management platform built with Next.js, SQLite, and the Anthropic API. Designed from the ground up for a real operating business — a multi-member LLC taxed as an S-Corporation — with live bank data, payroll integration, AI-powered compliance analysis, and a draggable dashboard that adapts to how you actually work.

This is a personal project, actively in development. It is not a SaaS product. It is the kind of thing I build when I want to understand a problem end to end.

---

## Why I Built This

Most small business accounting tools are built for accountants. They handle bookkeeping well and decision-making poorly. I wanted a platform that understood the specific tax structure of my business (S-Corp pass-through, Washington B&O tax, Seattle B&O tax, quarterly payroll deposits), connected to live bank data, and could answer questions about compliance and distributions in plain language.

I also wanted to build something that used AI the way I think AI should be used: embedded in workflows, doing real work, not as a chatbot bolted onto an existing product.

---

## What Is Built

### Core Financial Infrastructure
- Dual-ledger system: expenses and income tracked separately with soft delete and full audit trail
- Plaid bank integration: live transaction sync with automatic routing to the correct ledger
- Multi-member ownership model with dynamic K-1 and safe distribution calculations
- Gusto payroll integration with simulated bi-weekly payroll, monthly grouping, and audit trail

### Tax Advisor
- S-Corp net income calculator that correctly excludes payroll from the expense base to prevent double-counting
- Filing calendar with all federal, Washington B&O, and Seattle B&O deadlines
- Deductions tracker and tax code reference
- Safe distribution calculator that accounts for member salaries, ownership percentages, and cash runway

### AI-Powered Compliance Tracker
- Compliance obligations register covering all tax jurisdictions
- AI gap analysis using the Anthropic API: identifies obligations at risk based on current financial state
- Streaming AI chat for compliance questions, rendered in markdown
- All AI analysis is persistent — stored in the database, not regenerated on every load

### Loans and Member Advances
- Loan register with waterfall payment logic and amendment audit trail
- Live AFR (Applicable Federal Rate) fetch via IRS PDF parsing using pdfjs-dist
- Plaid transaction linking: expenses and income rows can be linked to specific loans
- Orphaned loan transaction detection with inline resolution prompts

### Dashboard
- 14 draggable, resizable widgets built on react-grid-layout
- Layout auto-saved per user — persists across sessions
- All dashboard data fetched server-side in a single pass for performance
- Widgets include: cash runway, safe distributions, B&O tax estimate, net income, recent transactions, compliance status

### Document Infrastructure
- Cloudflare R2 integration for document storage (live)
- Document vault with upload, preview, download, and delete (in development)
- Document generator for 8 business templates including promissory notes, engagement letters, and operating agreement amendments (planned)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via better-sqlite3 (raw SQL, no ORM) |
| AI | Anthropic API — Claude Sonnet, streaming via ReadableStream |
| Agentic Development | Claude Code (installed on server, used throughout development) |
| Bank Integration | Plaid API (sandbox) |
| Storage | Cloudflare R2 |
| Charts | Recharts |
| Dashboard | react-grid-layout v2.2.2 |
| Hosting | DigitalOcean droplet via VS Code Remote SSH |
| PDF Parsing | pdfjs-dist (legacy build, server-side) |

---

## AI Integration Architecture

AI is not a feature layer in BizCore. It is part of the core data pipeline.

**Compliance gap analysis** runs against the live financial state of the business. The Anthropic API receives the current set of compliance obligations, their completion status, and the relevant financial context (YTD revenue, cash position, upcoming deadlines), and returns a structured gap analysis that is persisted to the database. This means the analysis reflects the actual state of the business, not a generic checklist.

**Streaming compliance chat** uses a ReadableStream connected to the Anthropic API. Responses render progressively in markdown as they arrive. The chat has full context of the business profile, tax jurisdictions, and current compliance state — it is not a general-purpose chatbot.

**Claude Code** was used throughout development as an agentic coding tool: running on the server, reading the codebase, proposing and implementing changes, and conducting full code reviews. The development workflow itself is an example of AI-orchestrated pipeline design.

Planned for the next development phase: AI auto-categorization of Plaid transactions at sync time, with confidence scoring, a pending review queue for low-confidence assignments, and inline category guidance tooltips with IRC code references.

---

## Architecture Notes

- All pages are async server components. Data fetching happens server-side before render.
- Server Actions return `{ error: null }` or `{ error: 'message' }` consistently — never undefined.
- Soft delete on all transactional tables via `deleted_at` column.
- Every table carries `business_id` for future multi-tenancy support.
- Loan balances are always calculated from payment history — never stored directly.
- Dashboard layout uses a 12-column grid with 60px row height. Widget registry in `lib/widgets.ts`.

---

## Project Status

Actively in development. Core financial infrastructure, tax advisor, AI compliance tracker, dashboard, and loan management are complete. Document vault, document generator, and Docker deployment are in progress.

This is a real platform running against a real business. It is not a demo.

---

## Notes on Public Code

This repository contains application code only. No environment variables, credentials, financial data, or personally identifiable information are included. All Plaid credentials use sandbox keys. The `.env.local` file is excluded via `.gitignore`.
