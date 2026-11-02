//! Everything that talks to SoundCloud lives in this crate and nowhere else.
//!
//! SoundCloud has issued no API keys since 2015, so this speaks the same
//! internal API (`api-v2.soundcloud.com`) the website uses. It can change
//! without notice; keeping it behind one crate means one place to fix.
//! The routes and their quirks are written down in `docs/soundcloud-api.md`.

#![forbid(unsafe_code)]
