(() => {
  "use strict";

  // Guard against double-injection without exposing an enumerable window property.
  const LOADED_FLAG = Symbol.for("quietscroll.loaded");
  if (window[LOADED_FLAG]) return;
  Object.defineProperty(window, LOADED_FLAG, { value: true });

  const ENABLED_ATTR = "data-quietscroll-enabled";
  const SESSION_MUTED_KEY = "x-video:muted";
  const PLAYER_SELECTOR =
    '[data-press-control], [data-testid="videoComponent"], [data-testid="videoPlayer"]';
  const SOUND_ICON_SELECTOR = 'svg[data-icon^="icon-sound"]';
  const INTERACTION_GRACE_MS = 1000;
  const VISIBILITY_THRESHOLD = 0.15;

  const nativePlay = HTMLMediaElement.prototype.play;
  const mutedDesc = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "muted"
  );
  const nativeGetMuted = mutedDesc?.get;
  const nativeSetMuted = mutedDesc?.set;

  if (!nativePlay || !nativeGetMuted || !nativeSetMuted) return;

  /** @type {WeakRef<HTMLVideoElement> | null} */
  let authorizedVideoRef = null;
  let lastUserInteractionAt = 0;
  let isSyncingMute = false;
  let syncRetryTimer = 0;

  function debugLog(...args) {
    if (window.__quietScrollDebug) {
      console.debug("[QuietScroll]", ...args);
    }
  }

  function isEnabled() {
    return document.documentElement?.getAttribute(ENABLED_ATTR) !== "false";
  }

  function isGlobalSessionUnmuted() {
    try {
      return sessionStorage.getItem(SESSION_MUTED_KEY) === "false";
    } catch {
      return false;
    }
  }

  function setSessionMuted() {
    try {
      sessionStorage.setItem(SESSION_MUTED_KEY, "true");
    } catch {
      // Ignore storage access errors.
    }
  }

  function getPlayerContainer(video) {
    if (!(video instanceof Element)) return null;
    return video.closest(PLAYER_SELECTOR) || video.parentElement;
  }

  function isGifVideo(video) {
    const src = video.currentSrc || video.src || "";
    if (src.includes("/tweet_video/")) return true;
    // Timeline videos (including short clips with loop=true) stream via MSE blob: URLs.
    if (src.startsWith("blob:")) return false;

    const player = getPlayerContainer(video);
    if (!player) return false;

    if (player.querySelector('[data-testid="gifPlayer"]')) return true;

    // Fallback once metadata is loaded: GIF players loop and render no audio controls.
    if (
      video.loop &&
      video.readyState >= 1 &&
      !player.querySelector(SOUND_ICON_SELECTOR) &&
      !player.querySelector('button[data-testid="mute"], button[data-testid="unmute"]')
    ) {
      return true;
    }
    return false;
  }

  function isSoundOnIcon(svg) {
    const icon = svg.getAttribute("data-icon") || "";
    return (
      icon.startsWith("icon-sound") &&
      !/(off|mute|slash|none|disabled)/i.test(icon)
    );
  }

  function findActiveMuteButtonInPlayer(player) {
    if (!(player instanceof Element)) return null;

    // Primary: current player exposes data-icon="icon-sound-high" (language-agnostic).
    const icons = player.querySelectorAll(SOUND_ICON_SELECTOR);
    for (const svg of icons) {
      if (isSoundOnIcon(svg)) {
        const btn = svg.closest("button");
        if (btn) return btn;
      }
    }

    // Fallback: legacy player exposes data-testid="mute" only while unmuted.
    if (isGlobalSessionUnmuted()) {
      return player.querySelector('button[data-testid="mute"]');
    }

    return null;
  }

  function findAnyActivePlayerMuteButton(preferredContainer) {
    const preferredBtn = findActiveMuteButtonInPlayer(preferredContainer);
    if (preferredBtn) return preferredBtn;

    // Scope fallback strictly to video player containers so non-video UI is never clicked.
    const players = document.querySelectorAll(PLAYER_SELECTOR);
    for (const player of players) {
      if (player === preferredContainer) continue;
      const btn = findActiveMuteButtonInPlayer(player);
      if (btn) return btn;
    }
    return null;
  }

  function isPictureInPictureVideo(video) {
    return Boolean(
      video &&
        document.pictureInPictureElement &&
        (document.pictureInPictureElement === video ||
          document.pictureInPictureElement.contains?.(video))
    );
  }

  function getAuthorizedVideo() {
    const video = authorizedVideoRef?.deref();
    return video && video.isConnected ? video : null;
  }

  function setAuthorizedVideo(video) {
    const prev = authorizedVideoRef?.deref() || null;
    if (video && prev === video) return;

    if (prev && prev !== video && observer) {
      observer.unobserve(prev);
    }

    if (video) {
      authorizedVideoRef = new WeakRef(video);
      observeVideo(video);
      debugLog("Authorized video:", video.currentSrc || video.src);
    } else {
      authorizedVideoRef = null;
      debugLog("Cleared authorized video");
    }
  }

  function isAuthorized(video) {
    if (video === getAuthorizedVideo()) return true;

    // Keep audio if user explicitly entered fullscreen or Picture-in-Picture on this video.
    if (
      (document.fullscreenElement &&
        document.fullscreenElement.contains(video)) ||
      isPictureInPictureVideo(video)
    ) {
      return true;
    }

    // If user just clicked a video to open a modal/lightbox, authorize the modal video.
    if (
      Date.now() - lastUserInteractionAt < INTERACTION_GRACE_MS &&
      video.closest('[role="dialog"]')
    ) {
      setAuthorizedVideo(video);
      return true;
    }

    return false;
  }

  /**
   * Synchronizes the player's internal React audio store back to muted by clicking
   * its mute button inside a video container. Only clicks when confirmed unmuted
   * so it never accidentally unmutes a muted video.
   */
  function syncReactMute(preferredContainer, attempt = 0) {
    if (!isEnabled() || isSyncingMute) return;

    const btn = findAnyActivePlayerMuteButton(preferredContainer);
    if (btn) {
      clearTimeout(syncRetryTimer);
      syncRetryTimer = 0;
      isSyncingMute = true;
      try {
        debugLog("Clicking mute button to sync React state", btn);
        btn.click();
      } finally {
        isSyncingMute = false;
      }
      setSessionMuted();
      return;
    }

    if (!isGlobalSessionUnmuted()) return;

    // Retry briefly while keeping session state intact in case React is mid-mount.
    if (attempt < 3) {
      clearTimeout(syncRetryTimer);
      syncRetryTimer = setTimeout(
        () => {
          syncRetryTimer = 0;
          syncReactMute(preferredContainer, attempt + 1);
        },
        attempt === 0 ? 32 : attempt === 1 ? 96 : 200
      );
      return;
    }

    // Final fallback after retries exhaust (e.g. text-only viewport with no mounted player).
    setSessionMuted();
  }

  /**
   * Layer 1: Watch the currently authorized video and re-mute it as soon as it
   * scrolls out of view or unmounts, resetting the global React state early.
   */
  const observer =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            if (!isEnabled()) return;
            const trackedVideo = authorizedVideoRef?.deref();
            if (!trackedVideo) return;

            for (const entry of entries) {
              if (entry.target !== trackedVideo) continue;
              if (
                trackedVideo.isConnected &&
                entry.intersectionRatio >= VISIBILITY_THRESHOLD
              ) {
                continue;
              }

              // Do not mute if user switched tabs, entered fullscreen, or popped into PiP.
              if (
                document.hidden ||
                document.fullscreenElement ||
                isPictureInPictureVideo(trackedVideo)
              ) {
                continue;
              }

              debugLog(
                "Authorized video left viewport or unmounted (ratio:",
                entry.intersectionRatio.toFixed(2),
                ") -> re-muting"
              );

              const container = getPlayerContainer(trackedVideo);
              setAuthorizedVideo(null);
              nativeSetMuted.call(trackedVideo, true);
              syncReactMute(container);
            }
          },
          { threshold: [0, VISIBILITY_THRESHOLD] }
        )
      : null;

  function observeVideo(video) {
    if (observer && video instanceof HTMLVideoElement) {
      observer.observe(video);
    }
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function findMostVisibleVideo() {
    const scope = document.querySelector('[role="dialog"]') || document;
    const videos = scope.querySelectorAll("video");
    const vh = window.innerHeight || document.documentElement?.clientHeight || 0;
    const vw = window.innerWidth || document.documentElement?.clientWidth || 0;
    if (!vh || !vw) return null;

    let bestVideo = null;
    let bestScore = 0;

    for (const video of videos) {
      if (isGifVideo(video)) continue;
      const rect = video.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const visibleW = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
      const visibleH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      const visibleRatio = (visibleW * visibleH) / (rect.width * rect.height);
      if (visibleRatio < VISIBILITY_THRESHOLD) continue;

      const score = visibleRatio + (!video.paused ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    }

    return bestVideo;
  }

  /**
   * Track real (trusted) user interactions inside video players and the "M" shortcut.
   * Capture phase ensures authorization is recorded before React's handlers run.
   */
  function handleTrustedInteraction(event) {
    if (!isEnabled() || !event.isTrusted || isSyncingMute) return;

    const target = event.target;

    if (event.type === "keydown") {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(target)) return;

      const key = event.key;
      if (key !== "m" && key !== "M" && key !== " " && key !== "Enter") {
        return;
      }

      if (key === "m" || key === "M") {
        const player = target instanceof Element ? target.closest(PLAYER_SELECTOR) : null;
        const video = player?.querySelector("video") || findMostVisibleVideo();
        if (video && !isGifVideo(video)) {
          lastUserInteractionAt = Date.now();
          setAuthorizedVideo(video);
        }
        return;
      }
    }

    if (!(target instanceof Element)) return;

    const player = target.closest(PLAYER_SELECTOR);
    const video =
      player?.querySelector("video") ||
      (target instanceof HTMLVideoElement ? target : null);

    if (!video || isGifVideo(video)) return;

    lastUserInteractionAt = Date.now();
    setAuthorizedVideo(video);
  }

  document.addEventListener("pointerdown", handleTrustedInteraction, {
    capture: true,
    passive: true,
  });
  document.addEventListener("click", handleTrustedInteraction, {
    capture: true,
    passive: true,
  });
  document.addEventListener("keydown", handleTrustedInteraction, {
    capture: true,
    passive: true,
  });

  function enforceMuteOnPlayback(video, reason) {
    if (
      !(video instanceof HTMLVideoElement) ||
      !isEnabled() ||
      isSyncingMute ||
      isGifVideo(video) ||
      nativeGetMuted.call(video) ||
      isAuthorized(video)
    ) {
      return;
    }

    debugLog(reason);
    nativeSetMuted.call(video, true);
    setAuthorizedVideo(null);
    const container = getPlayerContainer(video);
    queueMicrotask(() => syncReactMute(container));
  }

  /**
   * Layer 2: Synchronous anti-blip guard.
   * Prevents any unauthorized video from playing unmuted (e.g. during fast scroll
   * when virtualization unmounts the previous video before IntersectionObserver fires).
   */
  Object.defineProperty(HTMLMediaElement.prototype, "muted", {
    configurable: true,
    enumerable: true,
    get() {
      return nativeGetMuted.call(this);
    },
    set(value) {
      const muted = Boolean(value);
      if (
        !muted &&
        this instanceof HTMLVideoElement &&
        isEnabled() &&
        !isSyncingMute &&
        !isGifVideo(this) &&
        !isAuthorized(this)
      ) {
        debugLog("Blocked unmute on unauthorized video");
        nativeSetMuted.call(this, true);
        setAuthorizedVideo(null);
        const container = getPlayerContainer(this);
        queueMicrotask(() => syncReactMute(container));
        return;
      }
      nativeSetMuted.call(this, muted);
    },
  });

  HTMLMediaElement.prototype.play = function play(...args) {
    enforceMuteOnPlayback(this, "Re-muted unauthorized video before play()");
    return nativePlay.apply(this, args);
  };

  // Catch native browser <video autoplay> transitions that do not call JS .play().
  document.addEventListener(
    "play",
    (event) => {
      enforceMuteOnPlayback(
        event.target,
        "Re-muted unauthorized autoplay video on play event"
      );
    },
    { capture: true, passive: true }
  );
})();
