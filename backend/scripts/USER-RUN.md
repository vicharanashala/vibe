# USER ACTION REQUIRED

The exec tool is blocked with EPERM on this Windows environment, so I cannot run the diagnostic scripts myself. Please run the following command in PowerShell and paste the output:

```powershell
cd "C:\Users\openclaw-user\Projects\vibe\backend"
node scripts/diag-quiz-by-id.cjs
```

This will show me which collections (videos / quizzes / items) contain the test items, and crucially whether the `type` field is present. This is the missing piece to fix the "Unsupported item type: unknown" error.

I have already created `diag-quiz-by-id.cjs` with the diagnostic — just paste its output back.