# Production handoff

> **COMPLETE — 20 October 2026.** The app has been live at `https://spend.projectinfinitesummer.com` since the
> cutover on 20 October 2026. The operational contract is [production-launch.md](../../../ops/production-launch.md).
> Private paths, account details and host specifics were removed from this file on 21 October 2026.

This handoff covered the first deployment: transferring a verified full database/photo package and a prepared
settings file to the host privately over SSH, restoring them into a new directory, configuring DNS, TLS and the shared
proxy in the separate infrastructure repository, and completing the owner's password reset and first sign-in.

The code checkpoint for launch was `e3e9045`, which passed the Linux
[Production checks](https://github.com/mwilczynska/holiday-spend/actions/runs/38285498810): unit tests, both Docker
images, native modules, static assets and prompts, real sign-in, guest permissions, revocation, backup from a
read-only database mount, restore and restart.
