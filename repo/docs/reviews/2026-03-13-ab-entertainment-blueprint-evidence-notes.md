# AB Entertainment Blueprint Critique Evidence Notes

Date: 2026-03-13

## Internal Source Reviewed

- `requirements-analysis.md`

## Workspace Constraints

- The workspace is not a git repository, so no branch, commit, or PR workflow is available here.
- No application source code, `CLAUDE.md`, issue templates, or prior review documents exist in this repository snapshot.
- The blueprint is therefore both the main subject and the primary internal evidence source.

## External Source Findings

### Next.js 15

- Next.js v15.1.11 still documents Partial Prerendering behind `experimental_ppr`, which means a blueprint should not present it as a zero-risk default capability.
- App Router guidance continues to emphasize separating prerendered and dynamic regions with Suspense and explicit rendering boundaries.

Sources:
- https://github.com/vercel/next.js/blob/v15.1.11/docs/01-app/02-building-your-application/03-rendering/04-partial-prerendering.mdx
- https://github.com/vercel/next.js/blob/v15.1.11/docs/01-app/03-api-reference/05-config/01-next-config-js/ppr.mdx

### LangGraph

- LangGraph’s production value proposition is durable execution, persistence, retries, and human-in-the-loop interruptions, not just chained prompts.
- Durable execution depends on checkpointing to a persistent store so flows can resume after failure or human approval pauses.

Sources:
- https://docs.langchain.com/oss/javascript/langgraph/durable-execution
- https://docs.langchain.com/oss/javascript/langgraph/functional-api

### Stripe

- Stripe recommends server-side webhook handling with signature verification.
- Fulfillment should not depend on client redirects because customers can leave the page before the application records success.
- Async payment flows require handling delayed settlement events, not only synchronous completion.

Sources:
- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/payments/payment-intents/verifying-status

### Google Search Indexing API

- Google’s Indexing API is limited to job posting pages and livestream pages using `BroadcastEvent` embedded in `VideoObject`.
- It is not a general-purpose “instant indexing” API for standard event pages or generic content updates.

Sources:
- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/search/apis/indexing-api/v3/using-api

### OAIC / Australian Privacy

- An Australia-based events business should be evaluated against the Australian Privacy Principles, not framed as GDPR-only.
- Use or disclosure of personal information beyond the primary collection purpose requires specific legal justification or consent.
- The Notifiable Data Breaches scheme requires covered entities to notify affected individuals and the OAIC where a breach is likely to result in serious harm.

Sources:
- https://www.oaic.gov.au/privacy/australian-privacy-principles
- https://www.oaic.gov.au/privacy/your-privacy-rights/your-personal-information/use-and-disclosure-of-personal-information/
- https://www.oaic.gov.au/privacy/notifiable-data-breaches/about-the-notifiable-data-breaches-scheme

### Clerk Organizations

- Clerk Organizations provide roles, permissions, and active organization context for multi-tenant access control.
- Clerk does not eliminate the need to define application-specific authorization boundaries, tenant scoping, or permission checks for sensitive sponsor/admin data.
- Some production role/permission features require paid plans and should be included in cost review.

Sources:
- https://clerk.com/docs/organizations/overview
- https://clerk.com/docs/organizations/roles-permissions

### Sanity Content Releases

- Sanity content release workflows are real product features with plan/version constraints and role-scoped access implications.
- Release and scheduling flows introduce state transitions and locking behavior that need to be reflected in editorial governance and cost estimates.
- Release functionality and scheduling capabilities are not free assumptions across all tiers and setups.

Sources:
- https://www.sanity.io/docs/apis-and-sdks/content-releases-api
- https://www.sanity.io/docs/content-releases-configuration

## Critique Implications

- The blueprint should be criticized wherever it presents experimental, premium-tier, or operationally heavy capabilities as if they are simple defaults.
- AI workflows should be evaluated as production systems with persistence, review gates, failure handling, and cost controls.
- Payment, privacy, sponsor analytics, and SEO automation require concrete governance and lifecycle design, not only architecture diagrams.
- Timeline and budget estimates should be challenged against the real integration and operational burden implied by the chosen stack.
