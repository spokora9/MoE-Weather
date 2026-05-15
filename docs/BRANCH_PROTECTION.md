# Branch Protection Settings

Enable these settings on the `master` branch in GitHub → Settings → Branches → Add rule.

## Required Settings

- **Branch name pattern:** `master`
- ✅ Require a pull request before merging
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - Required checks:
    - `TypeScript Check`
    - `Lint`
    - `Tests`
    - `No console.log`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

## Wave Branch Merges

During the build-out waves, the orchestrator may merge wave branches directly.
Each wave branch must pass CI before the orchestrator merges to master.
