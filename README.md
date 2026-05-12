# SwarSales AI: The World's Most Powerful AI Voice Platform for Sales & Support

**SwarSales AI** is a best-in-class, open-core AI Voice platform engineered for high-performance CPG Sales, Outbound Lead Gen, and Customer Support. **Purpose-built to exceed commercial platforms like SalesCode.ai (SCAI)**, SwarSales AI offers superior modularity, lower latency, and deep enterprise integration—all while remaining fully open-source.

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)
![Next.js 15](https://img.shields.io/badge/Next.js_15-000000?logo=next.js&logoColor=white&style=for-the-badge)
![LiveKit](https://img.shields.io/badge/LiveKit-00AEEF?logo=livekit&logoColor=white&style=for-the-badge)
![Sarvam AI](https://img.shields.io/badge/Sarvam_AI-orange?style=for-the-badge)

## 🚀 Key Capabilities

### 1. Advanced Sales Intelligence (SCAI-Killer)
- **CPG Specialized:** Built-in tools for **Inventory Auditing**, **Competitive Intel Collection**, and **Instant Quote Generation**.
- **Real-time Battle Cards:** Provides agents with strategic rebuttals and win-strategies mid-call when competitors are mentioned.
- **100+ Sales Scenarios:** Advanced templates for complex order taking, promotion enrollment, and objection handling.
- **Mock Call Training:** "Skeptic Retailer" personas for high-fidelity sales rep onboarding.

### 2. Customer Support Voice Agent
- **Issue Resolution:** Automated ticket creation and escalation for complex complaints.
- **Order Tracking:** Real-time updates on order status, returns, and feedback collection.
- **Proactive Follow-up:** Automated calls for customer satisfaction surveys and support follow-ups.

### 3. Enterprise Features
- **CRM Sync:** Native support for HubSpot, Salesforce, and Zoho (Webhooks + API layer).
- **Conversation Memory:** Persistent customer context across calls for personalized experiences.
- **Real-time Analytics:** Dashboard tracking Duration, Sentiment, Conversion Rate, and Order Value.
- **Performance Scorecards:** AI-generated coaching suggestions and scorecards for every call.
- **Multilingual:** 32+ languages supported, optimized for Indian Hinglish and regional dialects via Sarvam AI.
- **Cross-Channel:** WhatsApp + SMS fallback for follow-up quotes and documentation.

## 🛠️ Tech Stack
- **Frontend:** Next.js 15 (App Router) + Tailwind CSS + Shadcn UI
- **Backend:** Supabase (PostgreSQL + pgvector for RAG)
- **Voice Engine:** LiveKit Realtime + Sarvam Saaras/Bulbul + OpenAI/ElevenLabs fallbacks
- **Orchestration:** Turbo Monorepo + Docker Self-hosting
- **Auth:** Clerk Auth

## 📖 Sales & Support Documentation

### Setting up Sales Agents
1. Go to **Marketplace** and filter by the **Sales** category.
2. Install a template (e.g., "Order Taking & Fulfillment").
3. Use the **Visual Flow Builder** to customize the sales script and business logic.
4. Upload your product catalog to the **Knowledge Base** for RAG-powered product expertise.

### CRM Integration
1. Navigate to **Settings → Enterprise CRM Integrations**.
2. Enable your preferred provider (HubSpot, Salesforce, or Zoho).
3. Provide your Webhook URL and Signing Secret.
4. SwarSales AI will automatically sync call summaries and ROI data after every interaction.

### Coaching & Performance
Every call generates an AI Performance Scorecard. Review these in the **Calls** dashboard to:
- Identify top-performing scripts.
- Provide targeted coaching based on "Objection Handling" and "Tone" scores.
- Track "Order Value" trends to measure AI impact on your bottom line.

## 🚦 Quick Start

```bash
# Install dependencies
pnpm install

# Start web app
pnpm --filter @swarsales/web dev

# Start voice worker
cd apps/voice-worker
python -m swarsales_agent dev
```

For detailed instructions, see the [Quick start guide](#quick-start-development).

---

## License & Attribution
SwarSales AI is released under the **[MIT License](./LICENSE)**. Copyright © 2025 Ashok Moti Ji & SwarSales AI contributors.
