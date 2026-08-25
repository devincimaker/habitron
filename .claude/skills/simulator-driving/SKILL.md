---
name: simulator-driving
description: Drive the iOS simulator UI programmatically — tap by label, deep link, screenshot — and get unstuck from the two blockers that trap agents: the Expo dev-menu sheet and the SpringBoard "Open in Habits Coach?" alert. Use when verifying a change on device, reproducing a bug in the simulator, or when a simulator interaction stops responding to taps.
---

# Driving the simulator

`xcrun simctl` can launch, deep link and screenshot, but it **cannot tap**. Tapping
needs `idb` (already installed at `~/.local/bin/idb`). The helper here taps by
accessibility label, so you never guess coordinates.

Ported from the planazo repo, which runs the same Expo/simulator stack. Every
failure mode below was measured there; the app names, schemes and env vars are
this repo's.

## What belongs here, and what belongs to the plugin

The `ios-simulator-skill` plugin covers generic simulator work this file does
not: accessibility and localization audits, visual diffing, dark mode and
Dynamic Type, push notifications, status bar, location, gestures, log
monitoring. **Reach for it for anything about iOS in general.**

This file is the opposite: everything true only of *this app*. Which simulator
is yours across worktrees, the two blockers that trap agents here, and the
failure modes that cost real hours (a queued `openurl` raising its own alert,
the reboot wait everybody gets wrong). No general plugin can know any of it.

When both could do the job, prefer this one for tapping and reading the screen:
`sim.py` knows how to tell an alert from a label.

## Before anything: know which simulator is yours

Multiple worktrees each own a booted simulator. Driving the wrong one corrupts
someone else's session.

```bash
cat .env.worktree            # WT_SIM_UDID, WT_SIM_NAME, WT_EXPO_PORT
pnpm wt:list                 # every worktree's slot
```

`sim.py` resolves the simulator on its own, in this order: `WT_SIM_UDID` in the
environment, then `.env.worktree`, then `IOS_SIMULATOR_UDID` in
`apps/mobile/.env`, and finally the simulator **name** in `IOS_SIMULATOR`,
looked up through `simctl` (preferring a booted one, and never matching
`iPhone 16 Pro` to `iPhone 16 Pro Max`). That last step is what makes the helper
work in the **main checkout**, whose `.env` records only a name.

Never hardcode a UDID from a previous session — they change per worktree.

## The helper

```bash
python3 .claude/skills/simulator-driving/sim.py ls              # labelled elements + y positions
python3 .claude/skills/simulator-driving/sim.py tap "Change"    # substring match
python3 .claude/skills/simulator-driving/sim.py tap "Open" --exact
python3 .claude/skills/simulator-driving/sim.py unblock         # clear a system alert
python3 .claude/skills/simulator-driving/sim.py reboot          # reboot + wait until drivable
python3 .claude/skills/simulator-driving/sim.py ready           # wait after someone else's boot
python3 .claude/skills/simulator-driving/sim.py shot before.png
```

`ls` is your eyes — prefer it over screenshots for control flow, and take
screenshots as evidence for the user. Labels are composed by React Native from
the whole subtree, so a row reads as
`'Groceries, 2/3, Health, 45m'` — match a distinctive fragment.

**`tap` tells you whether the tap did anything.** It prints `screen changed` or
`screen did NOT change`, and on no-change it lists the other elements your
needle matched. Believe that line: a tap that reports a label but changes
nothing landed on something inert.

Two things `tap` will not do, both of which used to look like "taps are broken":

- **It never taps the root `Application` element**, whose frame is the whole
  screen and whose label is the app's name. `tap "Habits Coach"` would tap the
  dead centre of whatever is showing. That is a blind tap.
- **It prefers a tappable type over tree order.** A `StaticText` containing your
  needle no longer wins over a `Button` further down the tree. That is the whole
  story behind blocker 2.

**If a tap "succeeds" but nothing changes**, it probably landed on the element's
centre, which on a tall card can be a nested view that swallows it. Tap nearer
the top of the element instead:

```bash
idb ui tap --udid "$UDID" 201 740
```

## Deep links are how you reach a screen

expo-router maps routes straight onto the `habits-coach` scheme. The routes that
exist today:

```bash
xcrun simctl openurl "$UDID" "habits-coach://tasks"
xcrun simctl openurl "$UDID" "habits-coach://calendar"
xcrun simctl openurl "$UDID" "habits-coach://habits"
xcrun simctl openurl "$UDID" "habits-coach://journal"
xcrun simctl openurl "$UDID" "habits-coach://session"          # the coach
xcrun simctl openurl "$UDID" "habits-coach://session?autoPrompt=plan-day"
xcrun simctl openurl "$UDID" "habits-coach://profile"
xcrun simctl openurl "$UDID" "habits-coach://memories"
```

Prefer a deep link wherever one exists: it is faster, and it is one fewer thing
to assert. Where none does, navigate — `sim.py tap "<label>"`, one step at a
time, reading the screen back after each, because a fast refresh can reset
navigation underneath you. What you may never do is *claim* a screen you did not
confirm: before a screenshot counts, `sim.py ls` and name an element that
appears **only** on the target screen. A tap that landed 20pt off is invisible
in the image and obvious in the assertion.

## Blocker 1 — the Expo dev-menu sheet

On a fresh dev-client launch you get a sheet: *"This is the developer menu…"*
with **Continue**, then the menu itself (Reload / Go home / TOOLS) with
**Close**. It blocks everything under it.

It is ordinary app UI, so `idb` taps work:

```bash
python3 .claude/skills/simulator-driving/sim.py tap "Continue" --exact
python3 .claude/skills/simulator-driving/sim.py tap "Close" --exact
```

**Dismiss it before any deep link** — leaving it up is what causes blocker 2.

## Blocker 2 — the "Open in Habits Coach?" SpringBoard alert

Symptom: `sim.py ls` shows only three elements — `'Open in "Habits Coach"?'`,
`Cancel`, `Open` — and the app is unreachable.

**Prevent it outright (the real fix).** The alert is SpringBoard asking to
approve a custom URL scheme; on simulators the approvals are just a plist.

`wt:setup` already writes them for every simulator it creates
(`wt_preapprove_schemes`, `scripts/lib/worktree-common.sh:278`, over
`habits-coach`, `exp+habits-coach` and `com.capybarastudios.habitscoach`), so
only a simulator from before that — or one where a fresh binary was just
installed — still needs it. By hand:

```bash
UDID=$(grep WT_SIM_UDID .env.worktree | cut -d= -f2)
for scheme in habits-coach exp+habits-coach com.capybarastudios.habitscoach; do
  xcrun simctl spawn "$UDID" defaults write com.apple.launchservices.schemeapproval \
    "com.apple.CoreSimulator.CoreSimulatorBridge-->$scheme" -string "com.capybarastudios.habitscoach"
done
```

**If the alert is already up, first move:**

```bash
python3 .claude/skills/simulator-driving/sim.py unblock
```

It taps the confirm *button*, checks the alert actually went, clears any alert
queued behind it, and reboots the device by itself if tapping genuinely fails.
Safe to run when nothing is stuck (it says so and exits).

### Why this looks unkillable

The alert is owned by SpringBoard rather than the app, which led to the
conclusion that taps cannot reach it. **idb's taps do reach SpringBoard**:
tapping a home-screen icon by frame through `idb ui tap` launches the app, so
HID events reach SpringBoard's own UI perfectly well.

Most "taps do nothing" reports were the helper aiming at the wrong element,
because the alert lists its **title before its buttons**:

```
StaticText  'Open in "Habits Coach"?'   <- substring match for "Open" hit this
Button      'Cancel'
Button      'Open'                       <- the thing you meant
```

A substring match in tree order taps the *title*, which is inert, then prints
success and exits 0. A tap that reports success and changes nothing reads as
"SpringBoard is refusing taps", so the next step was a reboot. `sim.py` now
ranks tappable types above tree order and reports whether the screen changed, so
this trap is gone. In the measured case the title sat ~52pt above the button, on
20pt-tall inert text.

The title uses **curly** quotes, so match on `Open in`, never the full string.

These do genuinely fail and are not worth retrying: `idb ui key 40` (Return),
AppleScript `click at {x,y}` on the Simulator window (it lands on the layer
*under* the alert), and `simctl terminate` plus relaunch (the alert outlives the
app).

### Reproducing it on purpose

The approval is what makes the alert unreproducible once answered. Delete it and
the next deep link prompts again:

```bash
for scheme in habits-coach exp+habits-coach com.capybarastudios.habitscoach; do
  xcrun simctl spawn "$UDID" defaults delete com.apple.launchservices.schemeapproval \
    "com.apple.CoreSimulator.CoreSimulatorBridge-->$scheme"
done
xcrun simctl terminate "$UDID" com.capybarastudios.habitscoach; sleep 2
xcrun simctl openurl "$UDID" "habits-coach://tasks"
```

No reboot is needed for the deletion to take effect. **Write the approvals back
afterwards**, or you leave the simulator primed to trap the next session.

A second reason it looks immortal: **every queued `simctl openurl` raises its
own alert.** Clear one and the next appears, identical. `unblock` loops.

### Do not restart SpringBoard

`launchctl kickstart -k user/foreground/com.apple.SpringBoard` is the obvious
shortcut and it is a trap. Measured on iPhone 16 Pro / iOS 18.5: the home screen
comes back in under a second and looks perfectly healthy, but **accessibility
never returns** — `idb ui describe-all` answers with a single unlabelled element
from then on. Killing and reconnecting `idb_companion` does not fix it. Only a
full device reboot does. You lose more time than you saved.

### Rebooting, and the wait everybody gets wrong

```bash
python3 .claude/skills/simulator-driving/sim.py reboot
```

The obvious snippet waits for `(Booted)` in `simctl list devices`. That state
arrives in **~1.3s**, while taps and `describe-all` do not work for about **16s**
more. Anything run in that window fails in a way that looks like a brand new
problem. `sim.py reboot` and `sim.py ready` wait for the accessibility tree
instead of the device state, which is the only honest signal.

### When it fires, so you can avoid it

Once a scheme is approved on a simulator, the prompt is spent. Deep links do
**not** raise it against an app opened through that scheme before — foregrounded,
backgrounded, and fully terminated all go straight through.

So it fires on a **simulator that has never approved the scheme**: a newly
created one, or one where `npx expo run:ios` just installed a fresh binary, right
before the first deep link. Expect it after a build, not during ordinary driving.

### Retry an `openurl` only when it *says* it failed

The first deep link after a reboot often dies like this, even though
accessibility is already answering:

```
An error was encountered processing the command (domain=NSPOSIXErrorDomain, code=60)
Simulator device failed to open habits-coach://…
Operation timed out
```

That one is safe to repeat: it never reached SpringBoard, so it queued nothing.
A second attempt a few seconds later succeeds.

The opposite case is the dangerous one. **Never retry an `openurl` that reported
success but did not visibly connect** — each of those queues another alert behind
the one on screen, which is how one stuck alert turns into four. Run `unblock`
instead, then deep link once.

## Starting the app

`pnpm dev` is the entry point: it boots this checkout's simulator, installs the
prebuilt dev client if it is new, starts Metro on this checkout's port and the
API on its own, and deep-links the app to the right bundler.

It is persistent. Run it in the background or in a pane the user can see, never
block a turn on it, and **never pipe it through `tail`/`head`** — they print
nothing until EOF, so a live server looks hung. Confirm readiness by probe:

```bash
lsof -ti :$WT_EXPO_PORT              # Metro is listening
xcrun simctl list devices booted     # and this worktree's simulator is up
```

Reading `ps` is unreliable: every other worktree runs its own `expo start`, so a
match proves someone's Metro is alive, not yours. Match on the port.

## Logging in

A worktree's simulator is a fresh install of the dev client, so it starts
**signed out** every time, and a `--db` worktree's database does not even
contain the account until `wt:setup` seeds it.

```bash
python3 .claude/skills/simulator-driving/sim.py login
```

It reads `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` from the nearest
`apps/api/.env`, waits for the app to get past its splash and route, and — if it
landed on the login screen — taps the two fields by their labels and waits up to
20s for the tab bar. "Signed in" is the tab bar, not one tab's header, so it is
still true on whichever tab an earlier pass left the app. Two exits:

- **0** — `signed in as <email>`, or `already signed in` when the app was
  already past the login screen. Safe to run before every pass.
- **1** — it prints what *is* on screen. The login screen renders Supabase's
  error inline, so `Invalid login credentials` appears in that list when the
  password in `.env` is not the account's.

`pnpm seed` (from the worktree root) puts that account into a known state first:
2 overdue, 2 open and 2 completed tasks today, 4 habits with history, 2 journal
entries. In shared mode that is the live project, and every shared-mode
simulator is signed into the same account — so run it when the proof needs the
fixture state, not by habit.

If the fields will not take text, check that the app is on the login screen and
not behind the dev-menu sheet (blocker 1): `tap` ranks a `TextField` above the
`StaticText` label, but only among elements that are actually on screen.

## Reverting source while the app runs

To show a bug still reproduces, people revert the fix and let fast refresh
reload. **If your change altered the shape of a `useState` value, fast refresh
keeps the old value and the reverted code crashes on it** — a render error that
is an artifact, not the bug you are demonstrating.

Terminate and relaunch instead of reloading — that resets component state while
keeping the session (auth lives in secure store):

```bash
xcrun simctl terminate "$UDID" com.capybarastudios.habitscoach; sleep 2
xcrun simctl launch "$UDID" com.capybarastudios.habitscoach
```

## A/B proof pattern

Worth the extra minute when verifying a fix: capture the broken state too, or you
have only shown that the app works, not that the fix did anything.

1. Run the sequence on the fixed build → screenshot
2. `git checkout -- <file>`, terminate + relaunch, rerun → screenshot
3. Restore the fix, rerun once more to confirm the good state returns

Always restore in the same command as the revert, so a failure midway cannot
leave the working tree reverted.
