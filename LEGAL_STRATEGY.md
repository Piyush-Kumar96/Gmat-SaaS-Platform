# Legal Launch Strategy — GMAT Quiz Platform

**Status:** Pre-launch. Not legal advice. Take this doc to an IP/edtech attorney before launch.
**Date:** 2026-05-08
**Author context:** Solo founder, side project. Operating from Thailand. Indian bank account available; US LLC + Stripe contemplated post-validation.

---

## 1. Context & Constraints

### Founder / operating posture
- Physically resident in Thailand. No Thai business entity (cost-prohibitive for a side project).
- Indian bank account + PAN available; can accept Razorpay payouts as an individual or sole proprietor.
- Future plan: form a US LLC (Wyoming or Delaware) to enable Stripe and serve global users, *only after* product-market fit is shown.
- This is a side business. The founder is personally liable for everything the product does until an entity exists.

### Corpus state (the load-bearing fact)
- ~100% of the question bank originated from GMAC's *Official Guide* (OG) series and GMAT Club threads, collected during the founder's own GMAT prep.
- No original questions have been authored. No licensed questions. No public-domain content.
- This is the central legal problem and dictates everything below.

### Product surfaces
- React/Express/Mongo quiz platform with quiz engine, AI explanations, adaptive practice, admin "Question Forge", Razorpay billing.
- Backend already wires multiple question schemas (`QuestionBagV2`, `QuestionBagV3`).

---

## 2. Risk Assessment

### 2.1 Copyright (primary risk — severe)
- **GMAC** owns copyright in OG questions and aggressively enforces. They have sued question-bank operators and pursued takedowns historically. Statutory damages in the US can reach **USD 150,000 per work** for willful infringement; "per work" can mean per question.
- **Wiley** is GMAC's publishing partner for the OG and may also have standing.
- **GMAT Club** content is mostly user-posted but largely consists of OG/GMATPrep questions verbatim. GMAT Club survives via forum/safe-harbor posture (DMCA, IT Rules notice-and-takedown). A downstream redistributor cannot inherit that posture — you become a primary infringer.
- Berne Convention means the works are protected in Thailand, India, and the US automatically. There is no jurisdiction in which redistributing OG questions commercially is safe.
- Fair use / fair dealing defenses **do not apply to commercial test-prep redistribution**. Quoting one question for criticism is fair use; building a paid quiz product around the corpus is not.

### 2.2 Trademark (secondary risk — moderate)
- "GMAT", "GMAT Focus", and the GMAT logo are registered trademarks of GMAC.
- Using them in the product name, domain, or marketing risks a Lanham Act / Indian Trade Marks Act claim if it implies endorsement.
- **Nominative fair use** does allow descriptive references like "practice for the GMAT exam" provided you (a) only use as much of the mark as needed, (b) don't imply sponsorship, and (c) carry a disclaimer.

### 2.3 Corporate veil / personal liability (severe right now)
- With no entity, the founder is personally on the hook for every infringement claim, ToS breach, and chargeback dispute.
- Forming a US LLC *before cleaning the corpus* does not help — courts pierce the veil for direct or contributory infringement that the founder personally orchestrated, and the LLC itself becomes an asset target.
- A clean entity (US LLC or Indian Pvt Ltd) only meaningfully protects you if the underlying activity is itself defensible.

### 2.4 Payment processor risk
- **Razorpay (India):** terminates accounts on credible IP complaints. They reserve the right to freeze funds in escrow during disputes. ToS prohibits IP-infringing merchants.
- **Stripe (US LLC route):** more aggressive than Razorpay. A single DMCA-style complaint can lead to account review, freeze, and termination. Termination places merchants on the **MATCH list** (industry-shared blacklist), which can bar them from card processing globally for up to 5 years.
- Once you are MATCH-listed, neither PayPal, Stripe, nor most acquirers will onboard you again.
- **Don't burn your Stripe future on a product you'll have to retire.**

### 2.5 Tax / remittance (informational, not legal-strategic)
- Thailand changed foreign-source income rules effective 2024 — foreign income remitted into Thailand by Thai tax residents is taxable in Thailand. Consult a Thai tax advisor before routing Stripe/Razorpay payouts to Thai accounts.
- This is separate from the IP question but matters operationally.

---

## 3. The Single Critical Finding

**There is no business model that wraps a 100%-infringing corpus safely.**

- Charging only for "AI features" doesn't help — you're still hosting and distributing the underlying works commercially.
- Making it free doesn't help — copyright is about distribution, not price.
- Per-user isolation doesn't help if *you* uploaded the corpus.
- Selling to a prep company doesn't help — they will not buy the data, only the tech.
- Forming a US LLC doesn't help — it accelerates exposure (US is the worst venue) and gives plaintiffs a clean target.
- Operating from Thailand doesn't help — Thai courts honor copyright; Berne Convention applies; payment rails (Stripe US, Razorpay India) are reachable regardless of where you sit.

**Every viable launch requires removing the OG/GMAT Club corpus from the production database before going live.** Everything else in this doc assumes that removal happens.

---

## 4. Recommended Path

### Phase 0 — Pre-launch corpus surgery (mandatory, ~1–2 weeks)
1. Audit `QuestionBagV2`/`V3` collections and tag every question's provenance. If unknown, treat as infringing.
2. Move the full corpus to an `archived_corpus` collection that is **not served by any route**. Don't delete yet — you may need it for forensic / legal review.
3. Remove all admin "Question Forge" entry points that copy-paste from OG/GMAT Club.
4. Sweep markdown docs (`DI Question Extraction strategy v2.md`, `DS extractions.md`, scraping scripts under `backend/src/scripts/v3_extraction/`, `di_extraction/`) — these document the scraping pipeline and would be Exhibit A in discovery. Either delete or move to a private (non-public) repo.
5. Purge any scraped JSON outputs (`backend/output/*.json`) from git history if they contain copyrighted question text. Use `git filter-repo`.
6. Confirm `.env` is gitignored and no scraping API keys / cookies live in the repo.

### Phase 1 — Launch posture: AI tutor + private UGC (India only, 0–6 months)
**Product shape:**
- User pastes or uploads their own questions into a private workspace ("My Questions").
- Quiz engine wraps user-uploaded questions only. Strict per-user isolation: user A never sees user B's questions, no global pool, no admin curation into a shared bank.
- AI tutor adds value on top: explanations, hint generation, adaptive ordering, weakness detection, performance analytics.
- Optional: a small **original** sample question set (10–30 questions) you write yourself as a demo. Mark clearly as "sample content, written by [author]".

**Why this works:**
- You're not the source of the infringing content; users are.
- Per-user isolation removes the "redistribution" element. A user uploading OG questions for their own personal study is closer to the personal-copy fair-use line.
- Your role is closer to Dropbox / Notion / Quizlet's private decks than to a publisher.
- You preserve a notice-and-takedown posture (see Section 6.2).

**Entity & payments:**
- Stay personal / sole-proprietor in India. Use Razorpay individual onboarding. Cap your monthly volume below GST threshold initially.
- Do NOT form the US LLC yet. Don't open Stripe yet.
- Position the product as **India-first, beta**. Do not market in the US; geo-block US IPs at the CDN if possible to minimize US exposure.

### Phase 2 — Validation gate (3–9 months in)
Before Phase 3, confirm:
- Sustained paying users (target a number you set, e.g., 100+ MRR).
- Zero IP complaints / DMCA notices / Razorpay disputes.
- A growing library of **original** questions you've written or commissioned (target: 200+).
- Clean ToS, Privacy Policy, DMCA/Takedown policy, copyright claim form, registered grievance officer (India IT Rules requirement).

### Phase 3 — US LLC + Stripe + scale (only if Phase 2 clears)
- Form Wyoming LLC. Get EIN. Open Mercury or Wise Business. Onboard Stripe with the LLC.
- Register a DMCA agent with the US Copyright Office (USD 6, mandatory for safe harbor).
- Update ToS, Privacy, DMCA policy under US law. Add California-specific notices if you accept California users.
- Consider trademark counsel review of the product name and any GMAT references.
- At this point you should have a meaningful original corpus and the UGC product as fallback. The US LLC is no longer the asset that's painted as a target — it's a normal edtech SaaS.

---

## 5. Mitigation Options Compared

| Option | Legal soundness | Business viability | Effort | Notes |
|---|---|---|---|---|
| **A. Strip corpus, pure AI tutor (BYO questions)** | High | Moderate — depends on AI quality | Low | Recommended foundation |
| **B. Strip corpus, per-user UGC bank** | High (if isolation enforced) | Moderate | Medium | Combines well with A |
| **C. Commission/write original questions** | High | High long-term | High (cost + time) | Layer on top of A/B over months |
| **D. License from GMAC** | Highest | High if approved | Very high (cost, time, selectivity) | GMAC Official Practice partner program; not realistic for a solo side project at this stage |
| **E. Sell tech (not data) to a prep company** | High for you | Depends on buyer | Medium | Viable exit; preserve the engine + AI, drop the data |
| **F. Launch as-is** | Catastrophic | N/A | None | Do not do this |
| **G. Free + charge for AI** | Catastrophic | N/A | None | Doesn't change copyright analysis |

**Recommended composite:** A + B in Phase 1, C layered in over Phases 1–3, E held as an exit option throughout.

---

## 6. Action Items / Pre-Launch Checklist

### 6.1 Code & data
- [ ] Audit every question record in `QuestionBagV2` / `QuestionBagV3` for provenance.
- [ ] Move full corpus to `archived_corpus`, dark to all routes.
- [ ] Remove or gate admin Question Forge UI for shared-pool curation.
- [ ] Implement per-user `userId` ownership on all uploaded questions; enforce in every read query (defense in depth, not just route-level).
- [ ] Add upload flow with explicit user attestation: "I confirm I have the right to upload this content for my personal study."
- [ ] Add a "Report copyright concern" link visible from every question view.
- [ ] Geo-block US IPs at CDN until Phase 3 (Cloudflare rule, simple).
- [ ] Sanitize git history of scraping scripts and scraped JSON.
- [ ] Confirm Mixpanel / analytics don't log full question text into third-party stores.

### 6.2 Legal documents (have a lawyer review before publishing)
- [ ] **Terms of Service** with: AUP prohibiting infringing uploads, user warranty of upload rights, indemnity from user to you for IP claims arising from their uploads, limitation of liability, Indian governing law for Phase 1.
- [ ] **Privacy Policy** compliant with India DPDP Act 2023 (consent, purpose limitation, grievance officer, data principal rights).
- [ ] **Copyright / DMCA-style takedown policy** with a designated copyright agent email and 24–72h response SLA.
- [ ] **GMAT trademark disclaimer** on every public page footer: *"GMAT and GMAT Focus are registered trademarks of the Graduate Management Admission Council (GMAC). This product is not affiliated with, endorsed by, or sponsored by GMAC."*
- [ ] **Grievance officer** name + contact published (India IT Rules 2021 requirement for intermediaries).
- [ ] Consent banner / age gate (under-18 GMAT prep candidates exist; consider age-of-consent rules in DPDP).

### 6.3 Operational
- [ ] Set up `copyright@yourdomain` and `support@yourdomain` mailboxes; monitor.
- [ ] Document a takedown response runbook (verify, remove, notify uploader, log).
- [ ] Maintain an immutable log of takedown notices and actions taken.
- [ ] Insurance: explore "tech E&O + media liability" policy once revenue justifies (~USD 1–3K/yr for small SaaS in India).

### 6.4 Founder protective steps
- [ ] Don't put the product under your real name in marketing channels until Phase 3. Use a brand name distinct from GMAT.
- [ ] Don't post publicly about the scraping pipeline or that the questions came from OG. Keep that scoped to private notes.
- [ ] Save evidence that the corpus was removed before launch (timestamped commit, DB snapshot diff). If anyone ever alleges past distribution, you'll want a clear before/after line.

---

## 7. Lawyer-Review Checklist

Take this doc + the following questions to an IP attorney with edtech experience. Realistic budget: USD 300–800 for a one-hour consult + written memo from an Indian IP firm; USD 500–1500 in the US.

1. Does my Phase 1 UGC + AI-tutor structure qualify as an "intermediary" under India IT Act 2000 §79 + IT Rules 2021, and what concrete obligations does that trigger?
2. Is per-user isolation sufficient to avoid contributory liability for users uploading OG questions, or do I need active monitoring / hash-matching?
3. Should I incorporate in India (Pvt Ltd) before launch, or is sole-proprietor acceptable for the first 6 months?
4. What is the safest way to reference "GMAT" in product name / marketing copy / domain? Is `gmatquiz.*` defensible under nominative fair use, or do I need to rebrand?
5. If I form a Wyoming LLC in Phase 3, what minimum US-nexus does that create for GMAC to sue me in the US even if I'm physically in Thailand?
6. Tax: as a Thai resident accepting Razorpay payouts to an Indian bank, what's my Thai vs Indian tax exposure? (Thai tax advisor needed separately.)
7. Review my ToS, Privacy, and DMCA-style policy drafts.
8. Is there any path under Indian fair-dealing (Copyright Act §52) that allows a small commercial educational product to use OG questions? (Almost certainly no, but ask.)

---

## 8. What Not To Do (specific landmines)

- Do not launch with the current corpus in production, even "soft launch to friends."
- Do not file a US LLC and connect Stripe before the corpus is clean. A Stripe ban is permanent and follows you across processors.
- Do not market in the US, run US ads, or list on US-targeted directories in Phase 1. Geo-block.
- Do not use the GMAT logo anywhere. Use only the word mark with disclaimer.
- Do not buy a domain like `officialgmatprep.com`, `gmatofficial.*`, or anything that implies endorsement.
- Do not let users *share* uploaded questions with each other in Phase 1 — the moment a user-to-user share button exists, you re-introduce redistribution.
- Do not let admin staff curate user-uploaded questions into a shared pool in Phase 1.
- Do not push your scraping scripts to a public repo. Move them to a private repo or delete.
- Do not skip the `git filter-repo` step. The repo's history of scraping pipelines is itself evidence.
- Do not respond to a takedown notice on your own — escalate to counsel. Wrong responses (especially counter-notices) extend liability.

---

## 9. Bottom Line

You have built a useful piece of software. The software is salvageable; the corpus is not. The single highest-leverage thing you can do this week is move every OG/GMAT Club question out of the served database and re-launch the product as an AI tutor over user-supplied content, India-only, sole-proprietor, no Stripe yet. That posture buys you the time to write or commission an original corpus, and only then is it safe to form the US LLC and turn on Stripe.

Anything short of stripping the corpus first turns the launch from "side project" into "personal-liability lawsuit waiting."


------


  What you'd actually be scrapping                                                                                                      
   
  The infringing piece is the corpus — maybe 5% of the engineering work. What you've built that has no IP problem at all:               
                                                            
  - The full quiz engine (React + Express + Mongo wiring, question rendering, scoring, review flow)                                     
  - AI tutor / explanation integration                      
  - Auth, role-based access, paid-tier middleware                                                                                       
  - Razorpay integration end-to-end                                                                                                     
  - Admin panel, Question Forge UI, inline editing
  - Mixpanel analytics, user dashboards, profile/config pages                                                                           
  - All the type-specific question card components (PS / DS / CR / RC / DI)                                                             
                                                                                                                                        
  That stack is portfolio gold and is reusable. Stripping the OG/GMAT Club questions and writing 20–30 originals plus shipping the UGC  
  upload flow is maybe a weekend of work, not a rebuild. The hard parts are done. You're not scrapping a year of effort because of a    
  copyright issue — you're swapping out a JSON dump and writing some questions.                                                         
                                                            
  OTT is dramatically worse, not better                                                                                                 
  
  If by "OTT" you mean a video streaming platform (Netflix/Hotstar/Disney+ style), the legal surface is an order of magnitude larger    
  than GMAT prep:                                           
                                                                                                                                        
  - Per-work damages are catastrophic. A single film unlawfully streamed can trigger ~USD 150K statutory damages in the US, plus        
  criminal exposure under the DMCA. GMAC suing over questions is a problem; Disney/Netflix/Sony's legal teams are an extinction event.
  - Content licensing IS the business model. Streaming platforms live or die on rights deals. There is no "lean MVP" for licensed video 
  — you either pay seven figures per title or you don't have content. There's no GMAT-club-equivalent grey zone to even start in.       
  - Music rights are separate from video rights. Even original or licensed video drags in PPL / IPRS (India) and ASCAP/BMI (US) for any
  soundtrack. Multiple parallel licensing chains.                                                                                       
  - Territorial licensing — India rights ≠ Thailand rights ≠ US rights. Each market needs its own deals.
  - India IT Rules 2021 + 2023 amendments specifically target OTT with grievance officer, age classification (U / U-A / A / S),         
  mandatory content moderation, self-regulatory body membership, an Inter-Departmental Committee escalation path. Streaming platforms   
  are named in the rules. Quiz apps are not.                                                                                            
  - CDN / bandwidth costs for video are ~100x text — Stripe limits and personal cash flow burn through quickly even at small scale.     
  - Production expectations. Users expect Netflix-level UX from anything that calls itself OTT. Solo + side project + OTT is a category 
  mismatch.                                                                                                                             
                                                                                                                                        
  If by "OTT" you meant something else (UGC video like TikTok, audio/podcasts, education-OTT like Unacademy?), it's still harder than   
  GMAT — UGC platforms have the heaviest intermediary burden in India under IT Rules 2021 (mandatory takedown SLAs, content moderation,
  repeat-infringer policy, CSAM scanning obligations).                                                                                  
                                                            
  There is no streaming/video category that is legally easier than your current product after a corpus pivot.                           
  
  The decision in front of you                                                                                                          
                                                            
  Two real options, not three:                                                                                                          
                                                            
  1. Spend a weekend stripping the corpus, writing 20–30 original questions, shipping the UGC flow, deploying behind Cloudflare Access. 
  You keep everything. Portfolio story gets stronger because of the IP pivot, not weaker. Live in ~7 days.
  2. Park this and pivot to a different domain where the content problem is yours to define from day one — a domain-specific AI tutor,  
  an interview-prep tool with your own questions, a productivity/learning tool that's pure UGC. Reuse the engine code. Different        
  surface, same reusable backend.
                                                                                                                                        
  Both options preserve your work. Option 1 ships fastest and gives you the GMAT user base you already have access to (prep coaches,    
  WhatsApp groups). Option 2 is a longer detour but might be worth it if you actually want a different product, not just to avoid the
  legal corner.                                                                                                                         
                                                            
  What I'd genuinely caution against: scrapping in a moment of frustration when the actual remediation is small. The legal-strategy doc 
  made it sound like a wall — it's a hop. Want me to write the Phase 0 implementation plan (specific files to change, what to write,
  what to delete) so you can see how small the cleanup actually is?                                                                     
                                                            
✻ Brewed for 1m 6s                   
                                                                                                                                  
※ recap: You're deciding how to launch the GMAT platform legally, given the corpus is sourced from copyrighted GMAC/GMAT Club material. 
  Next action: confirm whether to proceed with the Phase 0 cleanup plan (strip corpus, write originals, ship behind Cloudflare Access)  
  or pivot domains. (disable recaps in /config)                                                                                         
                                                                                                                                        
❯ Okay, I need to buckle up then, May be I can add a small video in those groups and / or explain the users via a message if they want  
  to use the gmat quiz platform                                                                                                         
                                                                                                                                        
⏺ Good call. That posture works — small video + DM in groups you're already part of, with manual invites via Cloudflare Access. A few   
  quick notes on the outreach side before the implementation plan, because the messaging shapes legal optics too:                 

  Outreach watch-outs                                                                                                                   
                                                                                                  
  - Don't claim or imply OG / official questions. Frame the tool around what it actually does post-pivot: "AI-powered GMAT practice —   
  bring your own questions, get adaptive practice and AI explanations." The AI tutor and quiz engine are the headline, not the corpus.
  - Drop a one-line trademark disclaimer in video description / pinned message: "GMAT is a registered trademark of GMAC. This tool is   
  not affiliated with or endorsed by GMAC."                                                                                             
  - Don't blast in groups you didn't create — most GMAT WhatsApp groups ban promo posts, and it'll get you removed. Personal DMs to     
  people you actually know, or one polite ask to the admin first, lands much better.                                                    
  - "Private beta, invite-only, free during beta" is the right framing. It's accurate, it lowers expectations on polish, and it         
  justifies the Cloudflare Access gate when people hit it.                                                                              
  - Keep the video short (60–90s): problem → what the tool does → how to get access → one-line disclaimer. Record it once, reuse        
  everywhere.                                                                                                                           
  - Track every invite in a simple sheet (email, who shared, status). That sheet doubles as portfolio evidence later — "onboarded N     
  users via cold outreach in WhatsApp/LinkedIn groups" is concrete PM signal.                                                           
                                                                                                                                        
  Next concrete step                                                                                                                    
                                                                                                                                        
  The Phase 0 cleanup is the gate to all of this. Want me to write a focused implementation plan covering:                              
                                                                                                                                        
  1. Exact MongoDB collections / fields to migrate to archived_corpus and the route changes to dark them                                
  2. Files to delete or move to a private repo (scraping scripts, extraction docs, scraped JSON)
  3. git filter-repo commands to scrub history of the scraped data                                                                      
  4. Schema changes for per-user question ownership (UGC flow)                                                 
  5. The minimum original question set you need to write (count + types) for a credible demo                                            
  6. Cloudflare Access + noindex setup steps                                                                   
  7. ToS / Privacy / DMCA-style policy stub text you can adapt                                                                          
                                                                                                               
  I'd write it as a checklist-style plan at the project root (e.g. LAUNCH_PHASE_0.md) so you can work through it sequentially. Should I 
  go ahead?                                                                                                                             