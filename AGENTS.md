# Repository agent notes

## Semantic versioning

- Every user-visible change must increment the project version according to Semantic Versioning: patch for backward-compatible fixes and refinements, minor for backward-compatible features, and major for breaking changes.
- Apply the version increment as part of the same task and update every current version-bearing package, manifest, local-development example, and hosted-resource cache-busting reference.
- Keep a matching versioned production manifest at `public/manifest-v<version>.json`; do not modify historical versioned manifests.

## Production build recovery

- When a commit pushed as part of the current task causes the production build or deployment workflow to fail, diagnose the failure and make the smallest safe corrective change.
- After proportionate local verification, Codex has standing authorization to commit and push that corrective change to the same branch without requesting additional approval.
- Keep recovery commits narrowly scoped to restoring the failed build or deployment. Report the cause, correction, verification, commit, and resulting workflow status.
- This standing authorization does not extend to unrelated changes, force-pushes, history rewrites, secret or permission changes, destructive operations, or publishing to a different branch or remote.
