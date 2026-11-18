---
name: EstateLead AI - Real Estate Lead Qualifier & CRM Sync
description: Autonomous real estate lead capture agent that qualifies buyer/renter intent and syncs lead details directly to CRM workflows.
tags: [Real Estate, Lead Generation, n8n, CRM Sync, AI Agent]
---

# Overview

**EstateLead AI** is an autonomous, production-grade real estate lead qualification agent that operates 24/7 as an AI-powered property concierge. It conducts intelligent multi-turn conversations with prospective buyers, renters, and investors — extracting structured lead data in real time and dispatching qualified profiles to CRM pipelines via webhook.

Built as a single-page Next.js 16 application with a sleek dark-themed UI, it demonstrates end-to-end agent capabilities: natural language understanding, progressive lead scoring, live data extraction visualization, and automated CRM integration — all without requiring external API keys for the demo flow.

## Core Capabilities

### 24/7 Conversational Intake
- Multi-turn state machine with anti-loop safeguards — never repeats the same response twice
- Context-aware acknowledgement of newly extracted fields before asking follow-ups
- Quick-reply starter buttons for instant one-click demo testing
- Realistic typing indicator animations (600–900ms) before AI responses

### Intelligent Lead Qualification
- **Intent Detection**: Classifies Buy / Rent / Invest from natural language (supports implicit intent from phrases like "book a viewing", "price", "tour")
- **Property Type Extraction**: Matches villas, apartments, condos, plots, commercial, bungalows, studios, and bedroom-qualified types (e.g., "3-bed villa")
- **Global Location Detection**: 40+ cities and areas including Pakistani hubs (Karachi, Lahore, DHA, Bahria Town, Clifton, Gulshan), Gulf (Dubai, Abu Dhabi, Doha), US cities (Miami, Austin, NYC, LA), and UK/Canada. Supports brand qualifiers (Emaar → "Karachi (Emaar)")
- **Multi-Currency Budget Parsing**: USD ($850k, $1.2M), PKR (5 Crore, 80 Lakh), and contextual bare-number extraction
- **Contact Capture**: Phone numbers (US, Pakistani +92/03xx formats) and email addresses
- **Progressive Lead Scoring**: 0% → 35% → 75% → 100% with live animated progress bar and temperature labels (Waiting → Warming Up → Warm Lead → 🔥 Hot VIP Lead)

### CRM Webhook Dispatch
- Constructs a live JSON payload visible in the UI as fields are extracted
- Fires a `POST /api/webhook` on contact capture (non-blocking, demo-resilient)
- Designed for direct integration with **n8n**, **Make**, **Zapier**, or any webhook-compatible CRM
- Toast notification confirms "Webhook Triggered → Row Added to Google Sheets ✅"

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.4 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, Lucide React icons |
| State | React `useRef` + `useState` (zero stale-closure architecture) |
| NLP | Client-side regex/keyword extraction (no external API required for demo) |
| Deployment | Vercel (auto-deploy from GitHub) |

## Environment Configuration

The demo runs fully client-side without any API keys. For production webhook integration, configure these environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `GROQ_API_KEY` | Groq/Llama API key for server-side AI responses | `your_groq_api_key_here` |
| `OPENAI_API_KEY` | OpenAI API key (alternative LLM provider) | `your_openai_api_key_here` |
| `CRM_WEBHOOK_URL` | n8n / Make / Zapier webhook endpoint for lead dispatch | `https://your-n8n-instance.com/webhook/leads` |

> **⚠️ Security**: Never commit real API keys. Use `.env.local` for local development (already excluded via `.gitignore`). See `.env.example` for the template.

## Execution / Quickstart

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (Optional — demo works without keys)

```bash
cp .env.example .env.local
# Edit .env.local with your actual credentials
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build

```bash
npm run build
npm start
```

### 5. Deploy to Vercel

```bash
npx vercel --prod
```

### 6. Connect CRM Webhook

1. Create a webhook endpoint in n8n / Make / Zapier
2. Set `CRM_WEBHOOK_URL` in your deployment environment
3. Create a Route Handler at `src/app/api/webhook/route.ts` to forward payloads
4. Qualified leads will auto-dispatch when contact info is captured

## Project Structure

```
├── SKILL.md              # Agensi.io skill manifest
├── .env.example           # Environment variable template
├── package.json           # Dependencies and scripts
├── next.config.ts         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── eslint.config.mjs      # ESLint configuration
├── src/
│   └── app/
│       ├── page.tsx       # Main EstateLead AI component (single-file)
│       ├── layout.tsx     # Root layout
│       ├── globals.css    # Global styles (Tailwind)
│       └── favicon.ico    # App icon
└── public/                # Static assets
```

## License

MIT
