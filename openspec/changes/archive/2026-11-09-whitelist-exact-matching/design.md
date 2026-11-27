# Design

## Context

See proposal.md for the why, and the specs for the behaviour. What the approach builds on:

**Submit handler** (`CourseRegistrationController`, about lines 178–262)
- Creates a PENDING registration, then runs the auto-approval check. The check is written twice, for cohort and non-cohort versions.
- Approving calls `updateStatus(id, 'APPROVED', cohortId?)`, which enrols the student and sends the status email.

**Where the settings live**
- Course level: `settings.registration` on course settings, written by `SettingRepository.updateRegistrationSettings`.
- Cohort level: documents in the cohort settings collection, written by `CourseRepository.create/updateCohortSettings`, with positional arguments.
- `getSettings` returns the course values plus `cohortSettingDetails`.

**Two write paths**
- `PUT auto-approval` merges the current schemas with the body.
- `PUT build-form` passes the body straight to `updateSettings`, which sets every field. The production modal sends only `{jsonSchema, uiSchema}`, so the auto-approval fields are written as missing values. v3 sends all of them.

**Error handling trap**
`updateAutoApprovalSettings` wraps everything in `catch → InternalServerError`, so a `BadRequestError` thrown inside it comes out as a 500. The missing-cohort error already behaves this way.

## Goals / Non-Goals

**Goals:**
- One matching rule, in one tested place, for both course and cohort registration.
- No migration, and no change for courses that don't touch their settings, other than substring entries no longer matching.
- Old clients keep working during the deploy.

**Non-Goals:**
- Email verification (user decision, recorded in the proposal).
- Bulk upload of lists, per-entry expiry, or wildcards and subdomain matching.
- Re-evaluating pending requests when a list changes.
- Cohort selection in v3 Studio. It has none today, and saving there on a cohort course already fails; that stays as it is, and such courses are configured in the production app.
- Fixing `PUT build-form` reopening a closed registration (`isActive ?? true`). It's the same kind of bug as the wipe, but separate from the whitelist. Noted as a follow-up.

## Decisions

### 1. A pure helper holds the rules
New `modules/courseRegistration/utils/autoApproval.ts`:
- `parseEntry(entry)` returns `{kind: 'address' | 'domain', value}` or `null`. Text before the `@` makes an address; a leading `@` or no `@` makes a domain. A domain must contain a dot and no spaces.
- `resolveMode({mode, emails})` returns the stored mode, or works it out as the spec describes. Null counts as missing.
- `shouldAutoApprove(settings, email)`: off → false; `EVERYONE` → true; `LIST` → compare against each entry, where a domain is compared with the text after the email's last `@`. Unparseable stored entries never match.
- `normalizeEntries(entries)` returns `{entries, invalid}`.

The controller's two copies become one branch that picks the course or cohort settings and calls `shouldAutoApprove`. It loads the user's email only when the mode is `LIST`.

*Alternative:* keep `includes` for bare domains by checking `endsWith`. That still lets `notiitm.ac.in` through, unless the `@` is included, and doesn't simplify anything.

### 2. A new optional `autoApprovalMode` field
Values are `EVERYONE` and `LIST`, stored next to `autoapproval_emails` at course and cohort level.

*Alternatives:*
- **A migration that fills in the mode.** It adds a deploy step and a risk for no behaviour gain, since working it out on read is one line.
- **A marker such as `*` in the list.** It overloads the list, and every client would have to know about it.
- **Keep empty = everyone and only warn.** The user chose an explicit setting.

`getSettings` returns the resolved mode for the course and each cohort, so clients never repeat the rule.

### 3. Validate in the controller, before the service
`PUT auto-approval` calls `normalizeEntries` and throws `BadRequestError` naming the invalid entries, before entering the service, because of the error handling trap. With mode `EVERYONE`, the list is stored empty and not validated. With auto-approval off, entries aren't rejected either, because the production modal resends the stored list and an old entry mustn't stop a teacher turning auto-approval off. A body without a mode gets its mode from the list, which is what today's clients mean.

Only this endpoint validates. `PUT build-form` carries the stored list along from v3, and a course with an older entry like `iitm` must still be able to save its form.

### 4. `PUT build-form` only writes what it was sent
In the controller, when the body lacks `registrationsAutoApproved`, `autoapproval_emails` or `autoApprovalMode`, fill them from `getSettings`, as the auto-approval handler already does. This repairs production's form save without changing the frontend. Because `getSettings` returns the resolved mode, a course that had no stored mode gets one on its next form save, with the same meaning.

`isActive` is left alone (see Non-Goals).

### 5. Teacher screens
- **v3:** a shadcn `RadioGroup` under the switch, then the existing `Textarea` when "Only these emails" is chosen. Add the `radio-group` component through the shadcn CLI if it isn't installed. Saving sends the list as typed, so turning the switch off no longer discards it. The existing `saveAuto.isError` block shows the 400.
- **Production:** the same choice in `auto-approval-modal.tsx`, using that app's existing components, with `autoApprovalMode` added to the hook's types. `updateAutoApprovalSettings` calls the backend via `api.useMutation`, whose error carries the message; the catch shows it instead of the generic toast.

## Risks / Trade-offs

- **Existing substring entries stop matching.** → Those students wait for a teacher, which is the safe direction. Before deploying, a read-only count of production settings with entries that aren't valid or that look like parent domains would show who is affected. That needs production access, so it's left as a follow-up for the user to decide.
- **Subdomains no longer match.** → Decided behaviour, and stated in the help text. Teachers add each subdomain.
- **Unverified emails.** → Accepted for now (see the proposal). The list limits accidents and casual access, not someone determined to register with a listed address.
- **A course's old list can hold entries a new save rejects.** → The teacher sees which entries and fixes them. Form saves aren't affected.
- **Old frontend during deploy.** → It sends no mode, and gets today's meaning. Its help text is out of date until the frontend deploy, so deploy both soon after the backend.

## Migration Plan

1. Backend commit first: helper, field, endpoints, tests.
2. Then v3 (with regenerated API types) and the production frontend.

Deploy the backend, then `deploy-frontend-v3` and `deploy-frontend`. No data changes.

Rollback: revert the frontends and backend. A stored `autoApprovalMode` is ignored by the old code, though a course saved as `LIST` with an empty list would go back to approving everyone, so check for those before rolling back.
