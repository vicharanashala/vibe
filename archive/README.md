# Archive Workflow (V2.0)

Some PRs are approved for the V2.0 release instead of merging into `main` immediately.

Use this process:

1. Submit your PR to `main` as usual.
2. Maintainer reviews and adds the `v2.0` label.
3. Archive the branch on GitHub and close the PR:

```bash
git push origin your-branch-name:archive/v2.0/your-branch-name
```

Close the PR with this exact comment:

`Archived to branch archive/v2.0/your-branch-name for V2.0 release.`

Why:
The branch and full commit history stay safe under `archive/v2.0/` and can be restored for V2.0 merge work.