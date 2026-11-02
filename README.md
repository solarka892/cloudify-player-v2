# Cloudify

_[Русская версия](README.ru.md)_

A desktop client for SoundCloud, built with Tauri 2: a Rust core and a React
interface in a few-megabyte app instead of a bundled browser.

> **Unofficial client. Not affiliated with SoundCloud. Use at your own risk.**
> It talks to SoundCloud's internal web API — the same one soundcloud.com uses —
> because SoundCloud has not issued API keys since 2015. SoundCloud can change
> that API at any time and break this app.

## Status

**A rewrite from scratch is under way.** The first Cloudify
([solarka892/Cloudify-Player](https://github.com/solarka892/Cloudify-Player))
worked, but grew five skins, several abandoned redesigns and a lot of code
nobody wanted to touch. This repository starts over: same features, new code,
new interface.

What it will do, and in what order: [docs/features.md](docs/features.md)
(in Russian).

## Build from source

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) 24+ and
[pnpm](https://pnpm.io), plus the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your
system.

```sh
pnpm install
pnpm tauri dev      # run the app
pnpm tauri build    # make an installer for this system
```

Checks:

```sh
pnpm check                                      # types, lint, frontend tests
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## How it is put together

- `crates/soundcloud` — everything that talks to SoundCloud, and nothing else
  does. Notes on the API it uses: [docs/soundcloud-api.md](docs/soundcloud-api.md).
- `src-tauri` — the app: windows, sign-in, local storage, downloads.
- `src` — the React interface.

More in [docs/architecture.md](docs/architecture.md) (in Russian).

## Privacy

Your SoundCloud token is kept in the operating system's keyring — never in a
file, never in a log. The app talks to SoundCloud, and to
[LRCLIB](https://lrclib.net) for lyrics. Nothing else: no telemetry, no
analytics, no server of its own.

Releases are published here on GitHub only — never on the App Store or Google
Play.

## License

[MIT](LICENSE)
