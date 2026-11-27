# Proposal

## Why

Teachers can already list emails for automatic approval, but the list is not safe to use as a whitelist:

- **Matching is by substring.** The check is `userEmail.includes(entry)`, so the entry `bob@gmail.com` also approves `jimbob@gmail.com`, and `iitm.ac.in` also approves `x@iitm.ac.in.evil.com`.
- **An empty list approves everyone.** Removing the last entry opens the course to anyone with the link, with no warning.
- **Saving the form in the production app wipes the settings.** That app sends only the form to `PUT build-form`, and the service writes the missing auto-approval values too. A teacher who edits a question silently loses their list and auto-approval is switched off. This is from reading the code, and the first backend task confirms it with a test.

## What Changes

**Matching**
- An entry with text before the `@` (`bob@gmail.com`) matches that exact address.
- An entry that is only a domain (`iitm.ac.in` or `@iitm.ac.in`) matches addresses at exactly that domain. Subdomains such as `cs.iitm.ac.in` don't match; teachers list them separately.
- Case and surrounding spaces are ignored.
- The check uses the student's account email, not anything typed into the registration form.

**Who is approved**
- "Approve automatically" gains an explicit choice: **everyone**, or **only the listed emails**. With "only the listed emails", an empty list approves nobody.
- Courses set up today keep working. Auto-approval on with an empty list and no stored choice is read as "everyone"; with a list, as "only the listed emails".

**Saving**
- Saving auto-approval rejects entries that aren't an address or a domain (such as `iitm`), with a 400 naming them.
- Saving the registration form keeps the auto-approval settings when the request doesn't include them.

**Teacher screens**
- v3 Studio and the production app both offer the everyone / listed-emails choice and explain the new matching.

**Unchanged**
- The registration link, form and captcha. A matching student is approved and enrolled on submission, and gets the existing email.
- Pending requests are left alone when the list changes. Teachers can already approve them in bulk, and nobody gets a surprise email.
- Per-cohort lists follow the same rules as course lists.

**Behaviour change to expect**
Existing entries that relied on substring matching stop matching: `iitm`, `.ac.in`, or `iitm.ac.in` when students use `cs.iitm.ac.in`. Those students wait for a teacher instead of being approved, so the failure is safe but visible. We haven't checked how many production courses have such entries.

**Known gap, accepted**
Email addresses aren't verified at sign-up, so anyone who registers an account with a listed address gets approved. Closing this is a separate decision.

## Capabilities

### New Capabilities
- `backend/course-registration-auto-approval`: who is approved automatically on registration, and how those settings are saved.
- `v3/course-registration-auto-approval`: the auto-approval settings in ViBe Studio.
- `frontend/course-registration-auto-approval`: the auto-approval settings in the production teacher app.

### Modified Capabilities

None.

## Impact

- **Backend** (its own commit, landing first):
  - a new pure helper in `modules/courseRegistration` for matching and for working out the choice;
  - `CourseRegistrationController` (submit, `PUT auto-approval`, `PUT build-form`), `CourseRegistrationService` and `AutoApprovalSettingsBody`;
  - `SettingRepository`, `CourseRepository` and their interfaces, plus `models.ts`, for one new optional field, `autoApprovalMode`.
- **v3:** `features/admin/course-registration.tsx`, `registration-api.ts`, their spec and fixture, and regenerated API types.
- **Production frontend:** `auto-approval-modal.tsx` and `hooks.ts`.
- **Data:** no migration. The new field is optional and absent values are worked out on read.
- **API:** additive. A client that doesn't send `autoApprovalMode` gets today's meaning, so a frontend still on the old build keeps working during the deploy.
