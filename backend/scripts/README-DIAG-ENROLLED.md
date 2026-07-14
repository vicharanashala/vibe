# Diag Notes

## diag-service-flow.cjs
Runs the full backend service enrichment pipeline (mirrored from EnrollmentService.ts getEnrollments code) against raw MongoDB and prints what the controller would return to the frontend.

Run: `node backend/scripts/diag-service-flow.cjs`

Expected: a single enrollment object for the test learner in "Test Drive: Companion Demo".
If empty array → bug confirmed in service logic.
If present → bug is in frontend (transport, parsing, or filter).
