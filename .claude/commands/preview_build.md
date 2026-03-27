---
description: Build and deploy an EAS preview build for iOS device testing
allowed-args: none
---

# EAS Preview Build

Build a preview .ipa for installation on a physical iOS device.

## Steps

1. **Read current build number** from `apps/mobile/app.json` → `expo.ios.buildNumber`

2. **Check for uncommitted changes**:
   - Run `git status` to see if there are staged/unstaged changes
   - If there are changes relevant to the build, commit them first (ask user for commit message if unclear)

3. **CRITICAL — Bump the build number**:
   - Increment `expo.ios.buildNumber` by 1 in `apps/mobile/app.json`
   - **You MUST do this every time.** iOS will refuse to install a new build over an existing one with the same build number. Skipping this step wastes ~15 minutes on a build that can't be installed.
   - Commit the bump: `git add apps/mobile/app.json && git commit -m "Bump iOS buildNumber to <N>"`

4. **Trigger the EAS build**:
   ```bash
   cd apps/mobile && npx eas build --profile preview --platform ios --non-interactive
   ```
   Run this in the background — it takes 10-15 minutes on the free tier.

5. **When the build finishes**, extract the install URL from the output and share it with the user. The URL looks like:
   ```
   https://expo.dev/accounts/devinci/projects/habits-coach/builds/<uuid>
   ```
   Tell the user to open this link on their iPhone to install.

## Environment variables

The preview build profile in `eas.json` must include all necessary env vars since `.env` is gitignored and not available in EAS cloud builds. Currently configured:
- `EXPO_PUBLIC_API_URL` — production API on Render
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable anon key

If you add new `EXPO_PUBLIC_*` variables to `.env`, also add them to the `preview` and `production` profiles in `apps/mobile/eas.json`.
