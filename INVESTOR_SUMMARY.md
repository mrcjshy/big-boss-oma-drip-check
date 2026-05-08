# Drip Check — Investor Project Summary

> **Hyper-local AI fashion shopping agent for the Philippines.**
> Snap a fit pic. Get a budget-mapped shopping cart across Shopee, Lazada, and Ukay/Carousell — in seconds.

**Built for:** GDG Manila — *Build with AI 2026*
**Status:** Working prototype (live demo ready, no sign-in required)
**Market:** Metro Manila / Philippines, expanding across SEA

---

## 1. The Pitch in One Line

**Drip Check turns any outfit photo into a ready-to-click, lowest-price shopping list — built specifically for the Filipino budget shopper.**

---

## 2. The Problem

Filipino fashion shoppers — especially **working students and Gen Z** — live in a fragmented buying world:

- **3+ tabs open at all times:** Shopee, Lazada, Carousell, ukay markets, TikTok Shop.
- **Inspiration ≠ access.** Users see a fit on Instagram, Pinterest, or TikTok and have no fast path to "okay, where do I actually buy this for under ₱500?"
- **Search queries are an art form.** Knowing whether to type *"oversized graphic tee black"* on Shopee or *"ukay preloved tee"* on Carousell is tribal knowledge.
- **Price comparison is manual.** Shoppers either overpay on the first platform they search or burn 30+ minutes hopping between apps.

Existing global tools (Google Lens, Pinterest visual search, ASOS Style Match) optimize for **Western brands and full-price retail**. They don't understand `tipid` culture, ukay-ukay, Taglish search intent, or peso-denominated student budgets.

---

## 3. The Solution

Drip Check is an **autonomous shopping agent**, not just an image classifier. The flow is:

```
Upload outfit → Detect items → Write PH-localized queries
              → Compare 3 platforms → Recommend the Best Buy per item
```

For every clothing item the agent identifies, the user gets:

1. **Item breakdown** — name, category, color, style, material hint, confidence score.
2. **Three platform-specific search queries** tailored to how Filipinos actually search (e.g., *"oversized graphic tee black affordable below 250"* for Shopee vs. *"preloved oversized tee ukay"* for Carousell).
3. **Estimated peso price** per platform with a one-tap deep link.
4. **Best Buy recommendation** with reasoning (*"Carousell wins because preloved denim has better quality at this price point"*).
5. **Outfit-level vibe summary** + a **Tipid Tip** for total-budget optimization.

The user goes from *photo* → *click-to-buy URL list* in **one upload, no sign-in, no friction.**

---

## 4. How It Works (Technical Architecture)

### Stack
| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4, custom design system |
| AI / Reasoning | **Google Gemini 2.5 Flash** (multimodal, vision + structured output) |
| Hosting | Static SPA (deployable to Vercel, Netlify, Cloudflare Pages) |
| State | Lightweight client-side React hooks — no backend required |

### Data Flow
1. User drops an outfit image into the browser. The file is base64-encoded client-side.
2. The image is sent to **Gemini 2.5 Flash** with a carefully tuned **system prompt** that frames the model as a *Filipino shopping agent*, not a passive image captioner.
3. Gemini returns a **strictly typed JSON response** (enforced by a `responseSchema` declaration) containing every detected item, three platform queries, peso estimates, and a best-buy decision.
4. The client normalizes the JSON, sorts platform deals by price, deep-links each query to Shopee, Lazada, and Carousell PH, and renders an interactive comparison UI.
5. **Graceful fallback:** if the Gemini call fails or the API key is missing, the app silently swaps to a curated demo response so the experience never breaks during a pitch or live demo.

### Why this is defensible engineering
- **Schema-locked LLM output:** the agent uses Gemini's `responseSchema` to enforce contract — no fragile prompt-parsing.
- **Localized prompt engineering:** the system prompt encodes Filipino shopping vocabulary (`ukay`, `pambahay`, `pang-campus`, `preloved`, `below 500`) as first-class signal, not afterthought.
- **Zero-backend MVP:** entire app runs in the browser → near-zero infra cost, instant scale.
- **Deterministic UI under uncertainty:** confidence scores, normalized prices, and demo fallback ensure the product feels reliable even when the model is wrong.

---

## 5. Why Gemini, Why Now

- **Multimodal native.** Gemini 2.5 Flash takes the image + instruction in one shot — no separate vision model + LLM chain.
- **Structured output is GA.** `responseSchema` lets us treat the model as a typed function, not a chat partner.
- **Cost per inference** at Flash tier makes a freemium consumer flow economically viable.
- **Build with AI 2026 alignment.** Built on the Google Developer Group Manila stack — first-party distribution channel into the local dev/creator community.

---

## 6. Product Surface (Already Built)

- ✅ Drag-and-drop / click-to-upload outfit picker
- ✅ Two safe demo outfits (Campus Street, Cafe Date) for instant cold-start demo
- ✅ Live Gemini analysis pipeline with API key configuration
- ✅ Per-item tabs across Shopee / Lazada / Carousell with platform-accent theming
- ✅ Best-Buy badge + rationale per item
- ✅ Outfit-level "Vibe" + "Tipid Tip" summary card
- ✅ Best-value total in pesos at the top of the page
- ✅ Filipino-first copywriting (Taglish microcopy throughout)
- ✅ Responsive, no sign-in, no database — opens and works for any visitor

---

## 7. Market Opportunity

- **Philippines e-commerce GMV:** Shopee PH and Lazada PH together transact tens of billions of pesos annually; Carousell PH is a top-3 mobile resale platform in Southeast Asia.
- **Target user:** ~30M Filipino Gen Z + young millennial shoppers, mobile-first, price-sensitive, fluent in Taglish, deeply social-commerce native.
- **Underserved layer:** the **discovery-to-purchase translation** layer between social inspiration and marketplace search. Every minute spent retyping search queries is a conversion the marketplaces lose.
- **Adjacent expansion:** Indonesia, Vietnam, Thailand — all share marketplace-fragmented, budget-driven, mobile-native shopper behavior. The localization recipe (prompt + platform deep-links) is replicable per market.

---

## 8. Business Model (Roadmap)

| Stage | Revenue Mechanic |
|---|---|
| **Now (v0)** | Free, public, demo-grade. Goal: traction, dev community signal, hackathon momentum. |
| **v1 — Affiliate** | Shopee Affiliate, Lazada Affiliate Program, Carousell partnerships. Every "Open Shopee →" click is monetizable. |
| **v2 — Brand Layer** | Sponsored "Best Buy" slots for verified PH small fashion brands and ukay sellers — ranked transparently against organic results. |
| **v3 — Creator Tools** | Style-creator API: TikTok / IG creators auto-generate shoppable carts under their fit videos. Revenue share with creators. |
| **v4 — Personal Stylist** | Saved closets, repeat-fit recommendations, body-fit-aware sizing — premium subscription tier. |

---

## 9. Defensibility & Moat

1. **Localized data flywheel.** Every analysis improves the prompt, query corpus, and price-band estimates for Philippine shoppers — a moat global tools cannot easily replicate without local users.
2. **Platform deep-link integrations.** First-mover affiliate partnerships with Shopee PH, Lazada PH, and Carousell create distribution lock-in.
3. **Cultural copy + UX.** Taglish microcopy, ukay-aware recommendations, and `tipid` framing create a brand affinity that English-first competitors cannot fake.
4. **Zero-infra economics.** Browser-side architecture means we can grow to hundreds of thousands of users on consumer-grade hosting before infra cost becomes a line item.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gemini pricing changes | Architecture is model-agnostic; can swap to Gemini Pro, Claude, or open-weight VLMs behind the same `responseSchema` contract. |
| Marketplace blocks deep links | Affiliate APIs from Shopee / Lazada provide sanctioned link formats; Carousell has open search URLs. |
| Price estimates drift from reality | Phase 2: integrate live price scraping or marketplace APIs to replace estimated prices with real listings. |
| Platform takedowns of fashion images | All processing is client-side; we never store user images. Privacy-first by architecture. |
| LLM hallucinates items | Confidence scoring is surfaced in the UI; demo fallback ensures graceful degradation. |

---

## 11. The Ask (Suggested Talking Points for the Pitch)

- **Pre-seed / angel round** to fund:
  - Affiliate integrations (Shopee, Lazada, Carousell PH developer programs)
  - Price-data layer (real-time listings instead of estimated prices)
  - Mobile-native PWA / TikTok-embed surface
  - 6-month runway for 2 engineers + 1 designer + community/creator partnerships
- **Distribution leverage:** GDG Manila + Build with AI 2026 launch creates a credible developer-community origin story.
- **Why now:** multimodal LLMs hit price + quality threshold for consumer use *this year*, and PH e-commerce is mid-consolidation — the discovery layer is still wide open.

---

## 12. The 60-Second Demo Script

1. Open Drip Check on a phone or laptop. **No sign-in.**
2. Tap **Campus Street** demo (or upload a real photo).
3. Show: items detected → three platform tabs per item → peso prices → Best Buy badge.
4. Tap **Open Shopee →** on the recommended item — it deep-links to a real search result.
5. Point at the "Best-value total" header: *"This whole fit, optimized across three platforms, in under five seconds."*

---

*Drip Check · A Filipino fashion finder for GDG Manila Build with AI 2026.*
*Hanapin ang totoong sale — without 30 tabs open.*
