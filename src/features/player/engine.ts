import type Hls from "hls.js";
import { ApiError } from "@/api/invoke";
import { stream as resolveStream } from "@/api/player";
import type { Stream, Track } from "@/api/types";
import { saveResumePoint } from "@/features/player/resume";
import { currentTrack, usePlayer } from "@/features/player/store";
import { artworkUrl } from "@/ui/artworkUrl";

type State = ReturnType<typeof usePlayer.getState>;

interface EngineHooks {
  /** SoundCloud stopped accepting the session mid-play. */
  onSessionExpired?: () => void;
}

/** Five unplayable tracks in a row is a pattern, not bad luck: stop instead of racing through the queue. */
const MAX_FAILURES_IN_A_ROW = 5;

/**
 * Plays the player store's current track through one `<audio>` element and
 * reports back what really happens. A track's stream is resolved (as the
 * signed-in user) only when it is about to play: the signed URL is short-lived.
 * HLS plays natively where the webview can (WKWebView on macOS) and through
 * hls.js elsewhere. Also wires the OS media keys and "Now Playing" (Media Session).
 *
 * Returns the function that stops it.
 */
export function startAudioEngine(hooks: EngineHooks = {}): () => void {
  const audio = new Audio();
  audio.preload = "auto";
  let hls: Hls | null = null;
  /** Which `loadId:trackId` the element currently holds; `null` when empty. */
  let loadedKey: string | null = null;
  /** Each load gets a number; an answer for an older one is dropped. */
  let loadToken = 0;
  let failures = 0;
  let lastSave = 0;
  const media = "mediaSession" in navigator ? navigator.mediaSession : null;
  const state = () => usePlayer.getState();
  const keyOf = (s: State) => `${s.loadId}:${currentTrack(s)?.id ?? "-"}`;

  const destroyHls = () => {
    hls?.destroy();
    hls = null;
  };

  const empty = () => {
    loadToken += 1;
    loadedKey = null;
    destroyHls();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };

  /** Remembers where `track` (the one the element holds) is, at most every few seconds. */
  const persist = (force: boolean, track = currentTrack(state())) => {
    if (!track || !loadedKey) return;
    const now = performance.now();
    if (!force && now - lastSave < 5000) return;
    lastSave = now;
    saveResumePoint(track, audio.currentTime);
  };

  const seekWhenReady = (seconds: number) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      audio.currentTime = seconds;
      return;
    }
    const token = loadToken;
    audio.addEventListener(
      "loadedmetadata",
      () => {
        // A newer track may have taken the element meanwhile; this seek was for the old one.
        if (token === loadToken) audio.currentTime = seconds;
      },
      { once: true },
    );
  };

  const fail = (error: unknown) => {
    const s = state();
    const track = currentTrack(s);
    const { kind } = ApiError.from(error);
    loadedKey = null;
    s.report({ buffering: false });
    if (kind === "network") {
      s.setPlaying(false);
      s.say("Нет связи с SoundCloud — пауза. Включи снова, когда интернет вернётся.");
      return;
    }
    if (kind === "unauthorized") {
      s.setPlaying(false);
      s.say("Вход устарел — войди заново.");
      hooks.onSessionExpired?.();
      return;
    }
    failures += 1;
    if (failures >= MAX_FAILURES_IN_A_ROW) {
      failures = 0;
      s.setPlaying(false);
      s.say("Несколько треков подряд здесь не играют — остановился.");
      return;
    }
    s.say(track ? `«${track.title}» здесь не играет — включаю следующий` : null);
    s.next("unavailable");
  };

  const playNow = async () => {
    try {
      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        state().setPlaying(false);
        state().say("Система не дала включить звук сама — нажми «Играть».");
        return;
      }
      fail(new ApiError("not-available", String(error)));
    }
  };

  const attach = async (source: Stream) => {
    destroyHls();
    if (source.protocol === "hls" && !audio.canPlayType("application/vnd.apple.mpegurl")) {
      const { default: HlsPlayer } = await import("hls.js");
      if (!HlsPlayer.isSupported()) {
        throw new ApiError("not-available", "this webview cannot play HLS");
      }
      // No worker: the app's content security policy allows no blob: scripts.
      const instance = new HlsPlayer({ enableWorker: false });
      instance.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (data.fatal) fail(new ApiError("not-available", data.details));
      });
      instance.loadSource(source.url);
      instance.attachMedia(audio);
      hls = instance;
    } else {
      audio.src = source.url;
    }
  };

  const load = async (track: Track, key: string, startAt: number) => {
    empty();
    const token = loadToken;
    loadedKey = key;
    state().report({ buffering: true, position: startAt });
    try {
      const source = await resolveStream(track.id);
      if (token !== loadToken) return;
      await attach(source);
      if (token !== loadToken) return;
      if (startAt > 0) seekWhenReady(startAt);
      if (source.preview) {
        state().say(`«${track.title}» — Go+: SoundCloud даёт послушать только 30 секунд`);
      }
      if (state().playing) await playNow();
    } catch (error) {
      if (token === loadToken) fail(error);
    }
  };

  const describe = (track: Track | null) => {
    if (!media) return;
    if (!track || typeof MediaMetadata === "undefined") {
      media.metadata = null;
      return;
    }
    media.metadata = new MediaMetadata({
      title: track.title,
      artist: track.user?.username ?? "",
      album: "Cloudify",
      artwork: track.artworkUrl
        ? [{ src: artworkUrl(track.artworkUrl, 500), sizes: "500x500" }]
        : [],
    });
  };

  const sync = (s: State, prev: State) => {
    const track = currentTrack(s);
    const key = keyOf(s);
    if (s.volume !== prev.volume || s.muted !== prev.muted) {
      audio.volume = s.volume;
      audio.muted = s.muted;
    }
    if (!track) {
      if (loadedKey) empty();
      describe(null);
    } else if (key !== keyOf(prev)) {
      // The element still holds the previous track: file its position under that track.
      if (loadedKey === keyOf(prev)) persist(true, currentTrack(prev));
      describe(track);
      // A new track, or the same one again: load it now if sound is wanted, else on play.
      if (s.playing) void load(track, key, s.startAt);
      else empty();
    } else if (s.playing !== prev.playing) {
      if (!s.playing) {
        audio.pause();
        persist(true);
      } else if (loadedKey === key) void playNow();
      else void load(track, key, s.position);
    }
    if (track && s.seekId !== prev.seekId && loadedKey === key) seekWhenReady(s.position);
    if (media) media.playbackState = track ? (s.playing ? "playing" : "paused") : "none";
  };

  const report = (patch: Parameters<State["report"]>[0]) => {
    if (loadedKey && loadedKey === keyOf(state())) state().report(patch);
  };

  const listeners: [keyof HTMLMediaElementEventMap, () => void][] = [
    [
      "timeupdate",
      () => {
        report({ position: audio.currentTime });
        persist(false);
      },
    ],
    [
      "durationchange",
      () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          report({ duration: audio.duration });
        }
      },
    ],
    ["waiting", () => report({ buffering: true })],
    [
      "playing",
      () => {
        failures = 0;
        report({ buffering: false });
      },
    ],
    [
      "ended",
      () => {
        if (loadedKey) state().next("ended");
      },
    ],
    [
      "error",
      () => {
        // Emptying the element is not a failure; only a real source failing is.
        if (!loadedKey || (!audio.currentSrc && !hls)) return;
        fail(new ApiError("not-available", audio.error?.message || "the audio failed to load"));
      },
    ],
  ];
  for (const [event, handler] of listeners) audio.addEventListener(event, handler);

  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => state().setPlaying(true)],
    ["pause", () => state().setPlaying(false)],
    ["nexttrack", () => state().next("skip")],
    ["previoustrack", () => state().previous()],
    [
      "seekto",
      (details) => {
        if (details.seekTime != null) state().seek(details.seekTime);
      },
    ],
  ];
  for (const [action, handler] of actions) {
    try {
      media?.setActionHandler(action, handler);
    } catch {
      // This webview does not know the action; the in-app buttons still work.
    }
  }

  const initial = state();
  audio.volume = initial.volume;
  audio.muted = initial.muted;
  describe(currentTrack(initial));
  const unsubscribe = usePlayer.subscribe(sync);
  const saveOnExit = () => persist(true);
  window.addEventListener("beforeunload", saveOnExit);

  return () => {
    unsubscribe();
    window.removeEventListener("beforeunload", saveOnExit);
    persist(true);
    for (const [event, handler] of listeners) audio.removeEventListener(event, handler);
    for (const [action] of actions) {
      try {
        media?.setActionHandler(action, null);
      } catch {
        // Never set.
      }
    }
    empty();
    describe(null);
  };
}
