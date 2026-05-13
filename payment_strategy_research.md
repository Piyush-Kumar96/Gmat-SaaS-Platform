# Payment & Business Strategy for GMAT Quiz Platform

As an Indian/Thai resident building a digital product (GMAT Quiz Platform), you face unique challenges with standard payment processors like Stripe. This guide breaks down the best strategy for incorporation, banking, and payment processing to get your platform running smoothly.

---

## 1. Where to Open the Business (Incorporation)

To get access to the best banking and payment tools globally, it is highly recommended to incorporate in a business-friendly, digital-first jurisdiction rather than relying solely on your local entity.

### Top Recommendations:
1. **United States (LLC in Wyoming or Delaware)** - *Highly Recommended*
   - **Why:** Most flexible, access to the largest market, and native integrations with almost all tech tools. An LLC is a "pass-through" entity, meaning if you have no US presence/employees, you may not owe US federal income tax (though you must still file informational returns).
   - **How to setup:** Since Stripe Atlas is out, use services like **doola**, **Firstbase.io**, or **StartGlobal**. They specialize in non-US residents and handle the LLC formation, getting your EIN (tax ID), and providing a registered agent.
   - **Cost:** ~$300-$500 upfront, then annual state and registered agent fees.

2. **United Kingdom (Ltd Company)**
   - **Why:** Extremely fast, 100% digital setup, and very cheap. Highly respected globally.
   - **How to setup:** Directly via UK Companies House or using a service like 1st Formations.
   - **Drawback:** You will be subject to UK corporate tax on profits, whereas a US LLC can sometimes be tax-free depending on your local tax residency.

**Verdict:** Go with a **US LLC (Wyoming)** using **doola** or **Firstbase**. It gives you the most flexibility and is specifically designed for digital entrepreneurs outside the US.

---

## 2. Multi-Currency Business Banking (The Stripe Alternative)

Since you've had trouble with Stripe directly, you need a robust digital bank account to receive USD, EUR, GBP, etc., and then easily withdraw to your Indian or Thai personal/local business accounts.

### Top Recommendations:
1. **Wise Business** - *Best for Starting Out*
   - **Why:** Very easy to open once you have your US LLC or UK Ltd. Zero monthly fees, real mid-market exchange rates, and provides local bank details for USD, GBP, EUR, etc.
   - **Best for:** Receiving payouts from payment gateways and paying yourself or contractors.
2. **Airwallex** - *Best for Scaling*
   - **Why:** A bit more advanced than Wise. Offers great corporate cards, very competitive FX rates, and robust APIs. Good alternative if Wise rejects your application for any reason.
3. **Mercury** 
   - **Why:** If you form a US entity, Mercury is a fantastic, startup-focused US bank. However, they have become slightly stricter with non-US founders recently.

**Verdict:** Open a **Wise Business** account linked to your new US LLC. 

---

## 3. Payment Processing: Use a Merchant of Record (MoR)

If you cannot get a standard Stripe account, you should **not** use a standard payment gateway. Instead, use a **Merchant of Record (MoR)**. 

An MoR acts as the legal reseller of your GMAT quiz. They process the payment (using their own Stripe/PayPal accounts), handle all the complex global sales taxes (VAT/GST), deal with chargebacks, and then simply pay out the net revenue to your Wise Business account.

### Top Recommendations:
1. **Lemon Squeezy**
   - **Why:** Extremely popular with indie hackers and SaaS founders. Beautiful checkout UI, incredibly easy to integrate via API or simple payment links, and handles global taxes. Payouts can go straight to your Wise account.
2. **Paddle**
   - **Why:** The industry standard for software/SaaS. Very robust, but the onboarding process can sometimes be stricter and require more manual approval than Lemon Squeezy.
3. **Dodo Payments**
   - **Why:** A newer, developer-focused MoR that prides itself on fast onboarding and transparent pricing. 

**Verdict:** Integrate **Lemon Squeezy**. It is arguably the easiest to set up technically, has a stunning checkout experience (which fits a premium GMAT platform), and completely bypasses your need for a personal Stripe account.

---

## 4. Tech Setup & Logistics Workflow

Here is how the entire system connects seamlessly and securely:

1. **Entity:** You form a US LLC via **doola**.
2. **Banking:** You open a **Wise Business** account using your LLC's EIN and documents.
3. **Payments:** You sign up for **Lemon Squeezy** using your LLC details.
4. **Tech Integration:** 
   - You drop Lemon Squeezy's pre-built checkout overlay into your web app (React/Next.js/HTML).
   - When a student buys a quiz, Lemon Squeezy processes the card, calculates the tax based on the student's country, and grants access via webhooks to your backend.
5. **Logistics & Cash Flow:**
   - Lemon Squeezy holds the funds and automatically pays out to your Wise Business USD account once a week/month.
   - You log into Wise and transfer the funds to your Thai/Indian bank account at the real exchange rate.
   - **Taxes/Saving:** Keep ~30% of your profits in your Wise account to cover any future tax liabilities or software expenses. Use doola's ongoing compliance service to file your annual US informational tax returns automatically.

## Summary Checklist for Setup:
- [ ] 1. Choose Doola or Firstbase and start US LLC formation.
- [ ] 2. Wait for EIN (can take a few weeks for non-US residents).
- [ ] 3. Apply for Wise Business using LLC + EIN.
- [ ] 4. Apply for Lemon Squeezy.
- [ ] 5. Integrate Lemon Squeezy checkout into your platform.
