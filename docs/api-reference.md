# Référence API - FitMyCV.io

> 127 endpoints documentés | Généré le 2026-01-07

---

## Vue d'Ensemble

Base URL: `/api`
Authentication: JWT via NextAuth (header `Authorization: Bearer <token>` ou cookie session)

### Codes de Réponse

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Créé |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Non autorisé |
| 404 | Non trouvé |
| 500 | Erreur serveur |

---

## Authentication (`/api/auth/*`)

### NextAuth Handler
```
GET/POST /api/auth/[...nextauth]
```
Handler NextAuth pour sessions et callbacks OAuth.

### Register
```
POST /api/auth/register
Body: { email, password, name?, referralCode? }
Response: { user: { id, email, name } }
```
Création de compte utilisateur avec email/password.

### Request Password Reset
```
POST /api/auth/request-reset
Body: { email }
Response: { success: true }
```
Envoie un email de réinitialisation.

### Reset Password
```
POST /api/auth/reset-password
Body: { token, password }
Response: { success: true }
```
Réinitialise le mot de passe avec token valide.

### Verify Email
```
GET /api/auth/verify-email?token=<token>
Response: Redirect to app with auto-signin
```

### Verify Email Change
```
GET /api/auth/verify-email-change?token=<token>
Response: { success: true, newEmail }
```

### Resend Verification
```
POST /api/auth/resend-verification
Body: { email }
Response: { success: true }
```

---

## Account (`/api/account/*`)

### Delete Account
```
DELETE /api/account/delete
Response: { success: true }
```
Suppression complète du compte et données.

### Linked Accounts
```
GET /api/account/linked-accounts
Response: { accounts: [{ provider, providerAccountId }] }
```

### Link OAuth
```
POST /api/account/link-oauth
Body: { provider }
Response: { authUrl }
```

### Unlink OAuth
```
DELETE /api/account/unlink-oauth
Body: { provider }
Response: { success: true }
```

### Change Password
```
PUT /api/account/password
Body: { currentPassword, newPassword }
Response: { success: true }
```

### Update Profile
```
PUT /api/account/profile
Body: { name?, email? }
Response: { user }
```

---

## CVs CRUD (`/api/cvs/*`)

### List CVs
```
GET /api/cvs
Response: {
  cvs: [{
    filename, sourceType, sourceValue, language,
    matchScore, optimiseStatus, createdAt, updatedAt
  }]
}
```

### Create CV
```
POST /api/cvs/create
Body: { filename, content, sourceType?, sourceValue? }
Response: { cv: { filename, ... } }
```

### Read CV
```
GET /api/cvs/read?file=<filename>
Response: { content: <JSON CV data> }
```

### Delete CV
```
POST /api/cvs/delete
Body: { filename }
Response: { success: true }
```

### Restore Version
```
POST /api/cvs/restore
Body: { filename, version }
Response: { cv }
```

### Get Versions
```
GET /api/cvs/versions?file=<filename>
Response: { versions: [{ version, changelog, createdAt }] }
```

### Save Version
```
POST /api/cvs/versions
Body: { filename, changelog?, changeType? }
Response: { version }
```

### Get Changes
```
GET /api/cvs/changes?file=<filename>
Response: { changes: [...] }
```

### Save Changes
```
POST /api/cvs/changes
Body: { filename, changes }
Response: { success: true }
```

---

## CV Operations (`/api/cv/*`)

### Improve CV
```
POST /api/cv/improve
Body: { filename, sections? }
Response: { taskId }
```
Lance une amélioration IA du CV (background task).

### Calculate Match Score
```
POST /api/cv/match-score
Body: { filename, jobOfferId }
Response: { taskId }
```

### Get Match Score
```
GET /api/cv/match-score?file=<filename>
Response: {
  matchScore, scoreBreakdown,
  improvementSuggestions, missingSkills, matchingSkills
}
```

### Can Create CV
```
GET /api/cv/can-create
Response: { canCreate: boolean, reason?, needsCredit? }
```

### Can Edit CV
```
GET /api/cv/can-edit?file=<filename>
Response: { canEdit: boolean, reason? }
```

### Debit Edit
```
POST /api/cv/debit-edit
Body: { filename }
Response: { success: true, creditUsed? }
```

### Get Metadata
```
GET /api/cv/metadata?file=<filename>
Response: { sourceType, sourceValue, language, ... }
```

### Get Source
```
GET /api/cv/source?file=<filename>
Response: { source: { type, value, jobOffer? } }
```

---

## Background Tasks (`/api/background-tasks/*`)

### Generate CV from Job Offer
```
POST /api/background-tasks/generate-cv
Body: { jobUrl | jobPdf, baseCvFilename? }
Response: { taskId, filename }
```

### Generate CV from Job Title
```
POST /api/background-tasks/generate-cv-from-job-title
Body: { jobTitle, baseCvFilename? }
Response: { taskId, filename }
```

### Import PDF
```
POST /api/background-tasks/import-pdf
Body: FormData { pdf: File }
Response: { taskId, filename }
```

### Translate CV
```
POST /api/background-tasks/translate-cv
Body: { filename, targetLanguage }
Response: { taskId, newFilename }
```

### Calculate Match Score
```
POST /api/background-tasks/calculate-match-score
Body: { filename }
Response: { taskId }
```

### Create Template CV
```
POST /api/background-tasks/create-template-cv
Response: { taskId, filename }
```

### Sync Tasks
```
GET /api/background-tasks/sync?deviceId=<id>
Response: { tasks: [{ id, status, result?, error? }] }

POST /api/background-tasks/sync
Body: { taskId, status, result?, error? }
Response: { success: true }

DELETE /api/background-tasks/sync
Body: { taskId }
Response: { success: true }
```

---

## Subscription (`/api/subscription/*`)

### Current Subscription
```
GET /api/subscription/current
Response: {
  subscription: { planId, status, billingPeriod, ... },
  plan: { name, tier, features }
}
```

### List Plans
```
GET /api/subscription/plans
Response: { plans: [{ id, name, priceMonthly, priceYearly, features }] }
```

### Change Plan
```
POST /api/subscription/change
Body: { planId, billingPeriod }
Response: { subscription }
```

### Cancel Subscription
```
POST /api/subscription/cancel
Response: { subscription }
```

### Reactivate Subscription
```
POST /api/subscription/reactivate
Response: { subscription }
```

### Cancel Downgrade
```
POST /api/subscription/cancel-downgrade
Response: { subscription }
```

### Get Invoices
```
GET /api/subscription/invoices
Response: { invoices: [{ id, amount, status, date, pdfUrl }] }
```

### Billing Portal
```
POST /api/subscription/billing-portal
Response: { url }
```

### Preview Upgrade
```
POST /api/subscription/preview-upgrade
Body: { planId, billingPeriod }
Response: { preview: { amount, prorationDate } }
```

### Credit Packs
```
GET /api/subscription/credit-packs
Response: { packs: [{ id, name, creditAmount, price }] }
```

---

## Credits (`/api/credits/*`)

### Balance
```
GET /api/credits/balance
Response: {
  balance, totalPurchased, totalUsed,
  totalRefunded, totalGifted
}
```

### Costs
```
GET /api/credits/costs
Response: { costs: { gpt_cv_generation: 1, pdf_import: 1, ... } }
```

### Transactions
```
GET /api/credits/transactions?limit=50&offset=0
Response: {
  transactions: [{ id, amount, type, featureName, createdAt }],
  total
}
```

---

## Checkout (`/api/checkout/*`)

### Subscription Checkout
```
POST /api/checkout/subscription
Body: { planId, billingPeriod, promoCode? }
Response: { sessionId, url }
```

### Credits Checkout
```
POST /api/checkout/credits
Body: { packId, promoCode? }
Response: { sessionId, url }
```

### Verify Session
```
GET /api/checkout/verify?sessionId=<id>
Response: { success: boolean, type, details }
```

---

## Export PDF (`/api/export-pdf`)

```
POST /api/export-pdf
Body: {
  filename,
  sections?: { header, summary, experience, education, skills, languages, projects, extras },
  format?: 'pdf' | 'png'
}
Response: Binary (PDF/PNG file)
```

---

## Analytics (`/api/analytics/*`)

### Summary
```
GET /api/analytics/summary?period=7d|30d|90d|all
Response: {
  users: { total, new, active },
  cvs: { total, generated, imported },
  revenue: { mrr, arr },
  openai: { cost, calls }
}
```

### Events
```
GET /api/analytics/events?type=<type>&limit=100
Response: { events: [...] }
```

### Errors
```
GET /api/analytics/errors?limit=100
Response: { errors: [...] }
```

### Features Usage
```
GET /api/analytics/features
Response: { features: [{ name, usageCount, uniqueUsers }] }
```

### Feedbacks
```
GET /api/analytics/feedbacks?status=new|reviewed
Response: { feedbacks: [...] }

PATCH /api/analytics/feedbacks
Body: { id, status }

DELETE /api/analytics/feedbacks
Body: { id }
```

### Users
```
GET /api/analytics/users?limit=50&offset=0
Response: { users: [...], total }
```

### User Summary
```
GET /api/analytics/users/:userId/summary
Response: { user, cvs, subscription, activity }
```

### OpenAI Usage
```
GET /api/analytics/openai-usage?period=7d
Response: { usage: [{ date, feature, tokens, cost }] }
```

---

## Admin (`/api/admin/*`)

### Settings
```
GET /api/admin/settings
POST /api/admin/settings - Body: { settingName, value, category }
GET /api/admin/settings/:id
PUT /api/admin/settings/:id - Body: { value }
DELETE /api/admin/settings/:id
GET /api/admin/settings/history
```

### Users Management
```
GET /api/admin/users
POST /api/admin/users - Body: { email, name, role }
PATCH /api/admin/users/:userId - Body: { role?, credits? }
DELETE /api/admin/users/:userId
```

### Subscription Plans
```
GET /api/admin/subscription-plans
POST /api/admin/subscription-plans - Body: { name, priceMonthly, ... }
PATCH /api/admin/subscription-plans/:id
DELETE /api/admin/subscription-plans/:id
GET /api/admin/subscription-mode
POST /api/admin/subscription-mode - Body: { mode }
```

### Credit Packs
```
GET /api/admin/credit-packs
POST /api/admin/credit-packs - Body: { name, creditAmount, price }
PATCH /api/admin/credit-packs/:id
DELETE /api/admin/credit-packs/:id
```

### Email Management
```
GET /api/admin/email-templates
POST /api/admin/email-templates
GET/PUT/DELETE /api/admin/email-templates/:id
POST /api/admin/email-templates/:id/activate
DELETE /api/admin/email-templates/:id/activate
POST /api/admin/email-templates/:id/set-default
GET /api/admin/email-triggers
POST /api/admin/email-triggers
GET/POST /api/admin/email-triggers/:name/templates
GET /api/admin/email-logs
GET /api/admin/email-stats
POST /api/admin/email-test - Body: { templateId, email }
```

### OpenAI Management
```
GET /api/admin/openai-balance
GET /api/admin/openai-pricing
POST /api/admin/openai-pricing - Body: { modelName, inputPrice, outputPrice }
DELETE /api/admin/openai-pricing - Body: { modelName }
GET /api/admin/openai-alerts
POST /api/admin/openai-alerts - Body: { type, threshold, name }
DELETE /api/admin/openai-alerts - Body: { id }
GET /api/admin/openai-alerts/triggered
```

### Monitoring
```
GET /api/admin/revenue
GET /api/admin/plan-costs
GET /api/admin/onboarding/users
GET /api/admin/onboarding/analytics
POST /api/admin/onboarding/reset - Body: { userId }
GET /api/admin/maintenance/active-sessions
GET /api/admin/public-images
POST /api/admin/public-images - FormData
POST /api/admin/sync-stripe
DELETE /api/admin/telemetry/cleanup
```

---

## Onboarding (`/api/user/onboarding`)

```
GET /api/user/onboarding
Response: { state: { currentStep, completedSteps, ... } }

PUT /api/user/onboarding
Body: { step, data? }
Response: { state }

PATCH /api/user/onboarding
Body: { completedSteps: [...] }
Response: { state }

POST /api/user/onboarding
Body: { action, payload? }
Response: { state }

GET /api/user/onboarding/subscribe
Response: { plans }
```

---

## Telemetry (`/api/telemetry/*`)

```
POST /api/telemetry/track
Body: { type, category, metadata?, duration? }
Response: { success: true }

GET /api/telemetry/average-task-duration?type=<taskType>
Response: { averageDuration }

GET /api/telemetry/first-import-duration
Response: { duration }
```

---

## Other Endpoints

### Consent
```
GET /api/consent/history
Response: { history: [...] }

POST /api/consent/log
Body: { action, preferences }
Response: { success: true }
```

### Settings
```
GET /api/settings
Response: { settings: {...} }
```

### Link History
```
GET /api/link-history
Response: { links: [...] }

POST /api/link-history
Body: { url }
Response: { link }
```

### Feedback
```
POST /api/feedback
Body: { rating, comment, isBugReport?, currentCvFile? }
Response: { feedback }
```

### reCAPTCHA
```
POST /api/recaptcha/verify
Body: { token }
Response: { success: boolean, score? }
```

### SSE Events
```
GET /api/events/stream
Response: Server-Sent Events stream
```

### Stripe Webhook
```
POST /api/webhooks/stripe
Body: Stripe event payload
Headers: { stripe-signature }
Response: { received: true }
```
