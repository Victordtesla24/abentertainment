---
title: Fix newsletter input hydration mismatch
type: fix
status: active
date: 2026-03-18
---

# Fix newsletter input hydration mismatch

## Enhancement Summary
**Deepened on:** 2026-03-18  
**Sections enhanced:** 3  
**Research sources:** Local repo context + React hydration mismatch guidance (general best practices)

### Key Improvements
1. Added explicit scope control to prevent incidental UI changes.
2. Clarified why `suppressHydrationWarning` is the minimal, safe mitigation.
3. Tightened acceptance criteria to ensure the warning is fully removed.

## Overview
Resolve the React hydration mismatch warning reported for the newsletter email inputs by ensuring client-only style mutations (likely from autofill/extensions) do not trigger SSR/client attribute mismatches.

## Problem Statement
The console reports a hydration mismatch on the newsletter email inputs. The warning points to inline style differences on the input nodes that are not present in server-rendered HTML, which can be caused by browser autofill/extension-injected styles or client-only attributes.

## Proposed Solution
- Add `suppressHydrationWarning` to the newsletter email inputs so React ignores client-only attribute differences on those elements.
- Limit changes to the newsletter inputs only.

### Research Insights
**Best Practices:**  
- Use `suppressHydrationWarning` only on the smallest affected subtree to avoid masking unrelated issues.  
- Prefer deterministic server/client rendering; treat suppression as a targeted escape hatch for external DOM mutation (autofill/extensions).

**Edge Cases:**  
- Multiple newsletter inputs exist (CTA + footer); both should be covered to avoid partial suppression.

## Technical Considerations
- Target inputs:
  - `repo/src/components/forms/NewsletterSignupForm.tsx` (CTA section input)
  - `repo/src/components/layout/FooterNewsletter.tsx` (footer input)
- Avoid any behavior or styling changes beyond suppressing hydration warnings.

### Research Insights
**Implementation Notes:**  
- Add the prop directly to the `<input>` element to minimize impact.  
- Do not alter `autoComplete`, `type`, or form behavior.

## Acceptance Criteria
- [ ] No hydration mismatch warning appears for the newsletter inputs.
- [ ] Newsletter forms remain functional and visually unchanged.
- [ ] No unrelated UI or logic changes.

### Research Insights
**Verification:**  
- Confirm the console warning is absent on a clean load of a page with the CTA newsletter form and a page with the footer form.

## Context
- Hydration mismatch often occurs when the DOM is mutated before React hydrates (browser autofill, extensions, or client-only logic). Suppressing hydration warnings on the affected inputs is an accepted minimal fix when the mismatch is caused externally.

## Sources & References
- `repo/src/components/forms/NewsletterSignupForm.tsx`
- `repo/src/components/layout/FooterNewsletter.tsx`
- `repo/README.md`
