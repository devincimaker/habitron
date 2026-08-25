#!/usr/bin/env python3
"""Drive the iOS simulator by accessibility label.

    sim.py ls                  # every labelled element, with y positions
    sim.py tap "Change"        # substring match, case-insensitive
    sim.py tap "Open" --exact  # exact match
    sim.py unblock             # clear the SpringBoard "Open in …?" alert
    sim.py reboot              # shutdown + boot + wait until taps work again
    sim.py ready               # wait until accessibility answers (after a boot)
    sim.py login               # sign in as TEST_USER_EMAIL (apps/api/.env)
    sim.py shot out.png        # screenshot

The UDID comes from this checkout's .env.worktree or apps/mobile/.env — by UDID
if one is recorded, otherwise by resolving the simulator *name*, since the main
checkout's .env only carries `IOS_SIMULATOR=iPhone 16 Pro`. Never hardcode a
UDID from a previous session: each worktree owns a different simulator.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Buttons that mean "yes" on a system alert, best answer first.
CONFIRM_LABELS = ("Open", "Allow", "OK", "Continue")

# AX types that actually receive a tap. A StaticText with the right words in it
# will happily accept a tap and do nothing, which is how the "Open in …?" alert
# convinced everyone it was untappable — see unblock().
TAPPABLE = ("Button", "Cell", "Link", "SwitchButton", "TextField",
            "SecureTextField", "SegmentedControl")


def idb_bin():
    """idb is usually on PATH, but agents inherit odd PATHs. Look where it lives."""
    found = shutil.which("idb")
    if found:
        return found
    fallback = Path.home() / ".local/bin/idb"
    if fallback.is_file():
        return str(fallback)
    sys.exit("idb not found on PATH or at ~/.local/bin/idb.")


IDB = idb_bin()


def resolve_name(name):
    """Simulator name -> UDID. Prefers a booted one; exact name match only,
    so 'iPhone 16 Pro' never resolves to 'iPhone 16 Pro Max'."""
    out = subprocess.run(["xcrun", "simctl", "list", "devices"],
                         capture_output=True, text=True, timeout=60).stdout
    matches = re.findall(rf"^\s*{re.escape(name)} \(([0-9A-F-]{{36}})\) \((\w+)\)",
                         out, re.M)
    if not matches:
        return None
    for udid, state in matches:
        if state == "Booted":
            return udid
    return matches[0][0]


def checkouts():
    """This directory and every parent up to the checkout root, outermost last."""
    here = Path.cwd()
    for base in [here, *here.parents]:
        yield base
        if (base / ".git").exists():
            return


def read_env(fname, keys):
    """The first checkout above cwd that carries fname, as a dict of the keys asked for."""
    for base in checkouts():
        f = base / fname
        if not f.is_file():
            continue
        text = f.read_text()
        found = {}
        for key in keys:
            m = re.search(rf"^{key}=(.+)$", text, re.M)
            if m and m.group(1).strip():
                found[key] = m.group(1).strip()
        if found:
            return found
    return {}


def find_udid():
    if os.environ.get("WT_SIM_UDID"):
        return os.environ["WT_SIM_UDID"]
    for base in checkouts():
        for fname, key in ((".env.worktree", "WT_SIM_UDID"),
                           ("apps/mobile/.env", "IOS_SIMULATOR_UDID")):
            f = base / fname
            if f.is_file():
                m = re.search(rf"^{key}=(.+)$", f.read_text(), re.M)
                if m and m.group(1).strip():
                    return m.group(1).strip()
        # Main's .env records the simulator by name, not UDID.
        env = base / "apps/mobile/.env"
        if env.is_file():
            m = re.search(r"^IOS_SIMULATOR=(.+)$", env.read_text(), re.M)
            if m and m.group(1).strip():
                udid = resolve_name(m.group(1).strip())
                if udid:
                    return udid
                sys.exit(f"No simulator named {m.group(1).strip()!r} exists. "
                         "Check apps/mobile/.env against `xcrun simctl list devices`.")
    sys.exit("No simulator found. Set WT_SIM_UDID, or run from a checkout "
             "whose .env.worktree / apps/mobile/.env names one.")


UDID = find_udid()


def elements():
    out = subprocess.run(
        [IDB, "ui", "describe-all", "--udid", UDID],
        capture_output=True, text=True, timeout=120,
    ).stdout.strip()
    if not out.startswith("["):
        return []
    return [
        (e["AXLabel"], e.get("type") or "?", e["frame"])
        for e in json.loads(out)
        # AXLabel is present-but-null on plenty of elements, so guard on the
        # value, not the key.
        if (e.get("AXLabel") or "").strip()
    ]


def fingerprint(els):
    return tuple(sorted(label for label, _, _ in els))


def tap_xy(x, y):
    subprocess.run([IDB, "ui", "tap", "--udid", UDID, str(round(x)), str(round(y))],
                   check=True, capture_output=True, timeout=60)


def choose(els, needle, exact=False):
    """Pick the element to tap, preferring one that can actually receive it.

    Tree order alone is a trap: the "Open in …?" alert lists its *title* before
    its buttons, so the first substring match for "Open" is a StaticText, and
    tapping it silently does nothing. Rank tappable over merely-matching, and
    exact over partial.
    """
    matches = [e for e in els
               # The root Application element spans the whole screen and shares
               # the app's name, so tapping "its centre" is a blind tap in the
               # middle of whatever is showing. Never a target.
               if e[1] != "Application"
               and (e[0] == needle if exact else needle.lower() in e[0].lower())]
    if not matches:
        return None, []
    ranked = sorted(
        matches,
        key=lambda e: (e[1] not in TAPPABLE,      # tappable types first
                       e[0] != needle,             # then exact label
                       len(e[0])),                 # then the tightest match
    )
    return ranked[0], ranked[1:]


def tap(needle, exact=False, quiet=False):
    before = elements()
    pick, others = choose(before, needle, exact)
    if not pick:
        if not quiet:
            print(f"NOT FOUND: {needle!r}")
            if is_alert(before):
                print("A system alert is up. Run: sim.py unblock")
        return False

    label, etype, f = pick
    x, y = f["x"] + f["width"] / 2, f["y"] + f["height"] / 2
    tap_xy(x, y)
    time.sleep(1.5)

    # Report whether the tap did anything. Claiming success on a tap that
    # landed on a label is what sends agents off rebooting.
    changed = fingerprint(elements()) != fingerprint(before)
    if not quiet:
        print(f"tapped {label!r} ({etype}) at ({x:.0f},{y:.0f})")
        print("screen changed" if changed else
              "screen did NOT change — the tap may have landed on a non-target")
        if others and not changed:
            print("other matches:", ", ".join(f"{l!r} ({t})" for l, t, _ in others[:4]))
    return True


def is_alert(els=None):
    """The SpringBoard "Open in <app>?" alert (and its permission-prompt kin):
    a tiny tree whose only buttons are a confirm and a Cancel."""
    els = elements() if els is None else els
    if len(els) > 6:
        return False
    labels = {label for label, _, _ in els}
    buttons = {label for label, t, _ in els if t == "Button"}
    return bool(buttons & set(CONFIRM_LABELS)) and (
        "Cancel" in labels or any(l.startswith("Open in") for l in labels)
    )


def unblock(max_rounds=4):
    """Dismiss the SpringBoard alert, then fall back to a reboot.

    Each queued `simctl openurl` raises its own alert, so clearing one can
    reveal the next. Loop rather than concluding the tap failed.
    """
    for round_no in range(1, max_rounds + 1):
        els = elements()
        if not els:
            print("Accessibility is not answering. Rebooting.")
            return reboot()
        if not is_alert(els):
            print("No system alert up — nothing to clear.")
            return True

        target = next(
            (e for want in CONFIRM_LABELS
             for e in els if e[1] == "Button" and e[0] == want),
            None,
        )
        if not target:
            print("Alert up but no confirm button found:",
                  [l for l, _, _ in els])
            break

        label, _, f = target
        tap_xy(f["x"] + f["width"] / 2, f["y"] + f["height"] / 2)
        time.sleep(1.5)
        if not is_alert():
            print(f"cleared with {label!r} after {round_no} tap(s)")
            return True
        print(f"round {round_no}: tapped {label!r}, another alert is still up")

    print("Alert survived tapping. Rebooting the device.")
    return reboot()


def wait_ready(timeout=90):
    """A device reports Booted long before it can be driven: taps and
    describe-all come back roughly 15s later. Wait for the tree, not the state."""
    start = time.time()
    while time.time() - start < timeout:
        if len(elements()) > 3:
            print(f"accessibility ready after {time.time() - start:.0f}s")
            return True
        time.sleep(2)
    print(f"still not answering after {timeout}s")
    return False


# Every signed-in screen carries the tab bar; neither auth screen carries any of
# it. One label is not enough — the signup screen reads "Start with Thrive Coach"
# — so three of the five is the test.
TAB_LABELS = ("Tasks", "Calendar", "Coach", "Habits", "Journal")
BUNDLE_ID = "com.capybarastudios.habitscoach"


def signed_in(labels=None):
    """True when the tab bar is on screen, whichever tab is selected."""
    if labels is None:
        labels = [label for label, _, _ in elements()]
    seen = {tab for tab in TAB_LABELS if any(tab in label for label in labels)}
    return len(seen) >= 3


def dump_screen(limit=8):
    for label, _, _ in elements()[:limit]:
        print(f"  {label!r}", file=sys.stderr)


def type_text(value, chunk=6):
    """Type in short bursts.

    `idb ui text` drops characters on a long string — a 24-character password
    arrives short, and the only symptom is 'Invalid login credentials'. Bursts
    with a beat between them arrive whole.
    """
    for start in range(0, len(value), chunk):
        # `--` so a chunk beginning with '-' is a value and not an idb option.
        subprocess.run([IDB, "ui", "text", "--udid", UDID, "--", value[start:start + chunk]],
                       check=True, capture_output=True, timeout=60)
        time.sleep(0.2)


def dismiss_dev_menu():
    """Blocker 1: the Expo dev-client sheet. A cold launch always raises it, and
    unblock() cannot see it — it is the app's own view, not a SpringBoard alert."""
    return tap("Close", exact=True, quiet=True)


def relaunch():
    """Restart the app, which is the only way to clear text already in a field."""
    subprocess.run(["xcrun", "simctl", "terminate", UDID, BUNDLE_ID],
                   capture_output=True, timeout=60)
    time.sleep(2)
    subprocess.run(["xcrun", "simctl", "launch", UDID, BUNDLE_ID],
                   capture_output=True, timeout=60)
    time.sleep(8)
    dismiss_dev_menu()  # it comes back on every launch
    time.sleep(1)


def attempt_login(email, password):
    """One pass at the form. False means the app is not signed in afterwards."""
    if not tap("Email", exact=True, quiet=True):
        print("No Email field to tap", file=sys.stderr)
        return False
    type_text(email)
    if not tap("Password", exact=True, quiet=True):
        print("No Password field to tap", file=sys.stderr)
        return False
    type_text(password)
    if not tap("Sign In", exact=True, quiet=True):
        print("No Sign In button to tap", file=sys.stderr)
        return False

    deadline = time.time() + 20
    while True:
        if signed_in():
            return True
        if time.time() >= deadline:
            return False
        time.sleep(1)


def await_screen(timeout=40):
    """Wait for the app to route, and say where it landed: 'in', 'form' or None.

    app/index.tsx holds a splash for 1.5s and then waits on the profile fetch, so
    the first frame after a boot or a `pnpm dev` is neither screen. Judging it
    would call unblock() on a healthy app — and unblock() reboots the device when
    the accessibility server has not answered yet.
    """
    deadline = time.time() + timeout
    while True:
        labels = [label for label, _, _ in elements()]
        if signed_in(labels):
            return "in"
        if any("Sign In" in label for label in labels):
            return "form"
        if time.time() >= deadline:
            return None
        time.sleep(2)


def login():
    """Sign the app in as the test account. Idempotent: says so and exits 0 if already in."""
    creds = read_env("apps/api/.env", ("TEST_USER_EMAIL", "TEST_USER_PASSWORD"))
    email, password = creds.get("TEST_USER_EMAIL"), creds.get("TEST_USER_PASSWORD")
    if not email or not password:
        missing = "TEST_USER_EMAIL" if not email else "TEST_USER_PASSWORD"
        sys.exit(f"{missing} is not set — add it to apps/api/.env")

    where = await_screen()
    if where is None and dismiss_dev_menu():
        where = await_screen(timeout=30)  # blocker 1: a fresh install lands on it
    if where is None:
        unblock()                         # blocker 2: a queued openurl's alert
        where = await_screen(timeout=20)
    if where is None:
        print("Neither the login screen nor the app is up. On screen:", file=sys.stderr)
        dump_screen(5)
        return False
    if where == "in":
        print("already signed in")
        return True

    # The fields are labelled by ui/Input's `label` prop, and tap() prefers a
    # TextField over the StaticText above it.
    for attempt in range(2):
        if attempt:
            relaunch()  # the first attempt's text is still in the fields
            # A slow sign-in can land after attempt_login gave up; the restarted
            # app then restores the session instead of showing the form again.
            if await_screen(timeout=20) == "in":
                print(f"signed in as {email}")
                return True
        if attempt_login(email, password):
            print(f"signed in as {email}")
            return True

    # The login screen renders Supabase's error inline, so it is on screen now.
    print("Still not signed in. On screen:", file=sys.stderr)
    dump_screen()
    return False


def reboot():
    subprocess.run(["xcrun", "simctl", "shutdown", UDID], capture_output=True, timeout=120)
    subprocess.run(["xcrun", "simctl", "boot", UDID], capture_output=True, timeout=120)
    return wait_ready()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "ls"
    if cmd == "ls":
        for label, t, f in elements():
            print(f"{t:14} {label!r} y={f['y']:.0f}")
    elif cmd == "tap":
        ok = tap(sys.argv[2], exact="--exact" in sys.argv)
        sys.exit(0 if ok else 1)
    elif cmd == "unblock":
        sys.exit(0 if unblock() else 1)
    elif cmd == "reboot":
        sys.exit(0 if reboot() else 1)
    elif cmd == "ready":
        sys.exit(0 if wait_ready() else 1)
    elif cmd == "login":
        sys.exit(0 if login() else 1)
    elif cmd == "shot":
        subprocess.run(["xcrun", "simctl", "io", UDID, "screenshot", sys.argv[2]],
                       check=True, capture_output=True, timeout=60)
        print(f"wrote {sys.argv[2]}")
    else:
        sys.exit(__doc__)
