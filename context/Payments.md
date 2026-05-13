Payment strategy report (from research agent)
                                                                                                            
  A — Current Razorpay integration audit
                                                                                                            
  Wired today:                                              
  - Razorpay only. Server uses the razorpay npm package; client loads checkout.razorpay.com/v1/checkout.js. 
  - Flow is one-time Order capture (not real Razorpay Subscriptions): POST /api/payments/create-order →     
  opens Razorpay Checkout → POST /api/payments/verify recomputes HMAC-SHA256 with key_secret, marks Payment
  paid, promotes User.role and sets planInfo.endDate.                                                       
  - Plans hard-coded INR in paisa (backend/src/config/razorpay.ts:30-55): monthly ₹1,500 / quarterly ₹3,500
  / annual ₹6,000.                                                                                          
  - Role gate: requirePaidUser in backend/src/middleware/roleAuth.ts:103.                                   
                                                                         
  Gaps (in priority order — first one is a real money-loss bug):                                            
  1. No webhook handler. RAZORPAY_WEBHOOK_SECRET is read in config but no /webhook route exists. If a user  
  closes the tab between Razorpay capture and the verify-call, their card is charged but their subscription 
  never activates.                                                                                          
  2. Not a real subscription — uses Razorpay Orders, not Subscriptions. No auto-renewal, no card-on-file.   
  Renewal requires manual re-pay.                                                                        
  3. No expiry enforcement — planInfo.endDate is set but no cron/middleware downgrades the role when it     
  lapses.                                                                                              
  4. INR-only and hard-coded — currency: 'INR' baked into every plan. Razorpay International is gated by KYC
   + Razorpay payouts are INR-only, so non-Indian users hit FX surprise and you settle in INR.              
  5. No receipt/invoice email — important for Indian GST and customer trust.                                
  6. Payment.refundId / refundAmount schema fields exist but no code writes them.
  7. usePayment.ts:59 falls back to a hardcoded test key if env var missing — dangerous in prod.            
  8. JWT dev secret fallback in roleAuth.ts:5.                                                              
                                                                                                            
  B — Strategy recommendation                                                                               
                                                                                                            
  ▎ The agent's WebSearch was blocked, so platform-specific 2026 onboarding rules (Paddle/Stripe Atlas in   
  ▎ Thailand, Thailand's 2024 PRD 161/162 amendment) need final verification with the platforms' "supported 
  ▎ countries" pages and a Thai CA before signing anything.                                                 
                                                            
  Where to incorporate / bank — honest comparison:                                                          
   
  ┌──────────────┬─────────────────────────────────────────────┬───────────────────────────────────────┐    
  │    Option    │                    Pros                     │                 Cons                  │ 
  ├──────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┤ 
  │              │                                             │ Thai corp tax 20%; SaaS-export FX     │ 
  │ Thai Co Ltd  │ You live there; clean local banking         │ paperwork complicated;                │ 
  │              │                                             │ foreign-platform support patchy       │    
  ├──────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┤ 
  │ India Pvt    │                                             │ 25% corp tax; FEMA/RBI                │    
  │ Ltd          │ INR banking + Razorpay already; cheap CA    │ export-of-services paperwork (FIRC,   │ 
  │              │                                             │ SOFTEX); you don't live there         │    
  ├──────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┤    
  │ Singapore    │ 17% corp with effective relief; every MoR + │ S$3-5k setup, S$2k/yr compliance;     │ 
  │ Pte Ltd      │  Stripe + Wise supports it; treaty network  │ nominee director if non-resident      │    
  ├──────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┤ 
  │ US LLC via   │ Cheapest (~US$500); pass-through (no US tax │ You still owe personal Thai tax on    │
  │ Stripe Atlas │  for non-US-source services); Stripe +      │ remitted profits; annual Form 5472    │    
  │              │ Mercury instant; every MoR supports it      │                                       │
  ├──────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┤    
  │ UAE Free     │ 0-9% corp tax; USD banking                  │ $5-10k setup + residency visa;        │
  │ Zone         │                                             │ banking onboarding hard               │    
  └──────────────┴─────────────────────────────────────────────┴───────────────────────────────────────┘
                                                                                                            
  Honest take: US LLC (Stripe Atlas) = lowest-friction operational setup. Singapore Pte Ltd = cleanest      
  long-term setup if you cross ~US$100k/yr. Thailand's 2024 amendment to PRD 161/162 changed how remitted
  foreign income is taxed — do not finalize without a Thai-licensed tax advisor.                            
                                                            
  Merchant of Record vs direct gateway:                                                                     
  - Direct (Stripe, Razorpay): You're seller of record → owe VAT/GST registration in EU, UK, AU, SG, India
  OIDAR, etc. Lower per-txn (~2.9% + $0.30) but huge compliance overhead at scale.                          
  - Merchant of Record (Paddle, Lemon Squeezy, Polar.sh): They're the legal seller → collect/remit sales tax
   in 100+ jurisdictions, handle chargebacks + invoicing. ~5% + $0.50 per txn. Worth the extra ~2% to       
  outsource ~40 hrs/quarter of tax filing.                                                                  
                                          
  For solo/small-team global SaaS doing <US$1M ARR, MoR almost always wins on net economics + sanity.       
                                                                                                            
  Concrete recommendation: US LLC (Stripe Atlas) + Paddle as MoR + Mercury/Wise for banking + keep Razorpay 
  alive as the India-only rail.                                                                             
                                                                                                            
  - Paddle is seller of record → collects USD/EUR/GBP/INR → handles all sales tax → pays you USD via        
  Wire/ACH.
  - US LLC receives Paddle payouts into Mercury (USD) or Wise Business (multi-currency).                    
  - You transfer to your Thai personal account when needed — that remittance is the taxable event in        
  Thailand. Time it with your CA.                                                                           
  - Razorpay stays for Indian users only (UPI/India cards), so they get ₹ pricing and avoid the ~7% FX hit  
  on USD cards. Region-detect on frontend.                                                                  
                                                            
  Why not Lemon Squeezy? Acquired by Stripe in 2024, future unclear.                                        
  Why not Polar.sh? Newer, narrower country support.        
  Why not Stripe direct? You become the tax-compliance department.                                          
                                                                                                            
  Migration path from Razorpay (rough scope): add paymentProvider discriminator on Payment model, new       
  paddleService.ts mirroring paymentService.ts, add the missing webhook route (Paddle is webhook-first —    
  order activation must happen there), move plan catalog to Paddle dashboard, swap Razorpay snippet for     
  Paddle.js in usePayment.ts, region-detect on frontend (India → Razorpay, rest → Paddle). ~2-3 weeks dev + 
  1-2 weeks Paddle KYC.

  Currency handling: Paddle auto-converts at mid-market + ~2% spread (built into their fee). You receive one
   USD payout. Wise USD→THB is mid-market + ~0.4-0.6% — far cheaper than any bank wire.
                                                                                                            
  ---                                                       
  Net answer: Fix the missing Razorpay webhook this week (real money is leaking). Plan a 2026-Q3 migration
  to Paddle on top of a US LLC, keep Razorpay as the India-only rail, and book a Thai CA before deciding    
  where the profits actually land. The legal/tax decisions hinge on your projected revenue,             
  days-in-Thailand, and whether you remit or reinvest profits — not engineering decisions.     