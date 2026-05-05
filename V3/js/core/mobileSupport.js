class MobileSupport {
  constructor(game, options = {}) {
    this.game = game;
    this.options = {
      enableFullscreenButton: true,
      ...options
    };
  }

  install() {
    if (MobileSupport._globalBound) return;
    MobileSupport._globalBound = true;

    this.applyViewportFix();
    this.bindResize();
    this.bindTouchUnlock();
    this.bindOrientationHandling();
    this.bindFullscreenOnFirstTap();
  }

  applyViewportFix() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    );
  }

  bindResize() {
    const resize = () => {
      if (!this.game || !this.game.scale) return;
      this.game.scale.refresh();
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(resize, 150);
      },
      { passive: true }
    );
  }

  bindTouchUnlock() {
    const unlock = () => {
      const ctx = window.__antAudio?.ctx;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, {
      passive: true,
      once: true
    });
    window.addEventListener("touchstart", unlock, {
      passive: true,
      once: true
    });
  }

  bindOrientationHandling() {
    const onChange = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      document.body.classList.toggle("portrait", portrait);
      document.body.classList.toggle("landscape", !portrait);
    };

    onChange();
    window.addEventListener("orientationchange", onChange, {
      passive: true
    });
  }

  bindFullscreenOnFirstTap() {
    if (!this.options.enableFullscreenButton) return;

    const tryFullscreen = () => {
      const el = this.game?.canvas;
      if (!el) return;
      const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (typeof request === "function" && !document.fullscreenElement) {
        try {
          request.call(el);
        } catch (e) {
          // Ignore browser fullscreen restrictions.
        }
      }
    };

    document.addEventListener("pointerdown", tryFullscreen, {
      passive: true,
      once: true
    });
  }

  static attachSceneHelpers(scene) {
    if (!scene || scene._mobileHelpersAttached) return;
    scene._mobileHelpersAttached = true;

    scene.isMobileDevice = MobileSupport.isMobileDevice();
    scene.isTouchDevice = MobileSupport.isTouchDevice();
    scene.getViewport = MobileSupport.getViewport;

    scene.createMobileActionBar = function createMobileActionBar(buttons = []) {
      const pad = 12;
      const w = this.scale.width;
      const h = this.scale.height;
      const barY = Math.max(64, h - 62);
      const gap = 10;
      const btnW = Math.min(
        110,
        Math.floor((w - pad * 2 - gap * (buttons.length - 1)) / Math.max(buttons.length, 1))
      );
      const btnH = 42;
      const startX = pad + btnW / 2;

      const group = this.add.container(0, 0).setScrollFactor(0).setDepth(999);
      buttons.forEach((btn, i) => {
        const x = startX + i * (btnW + gap);
        const rect = this.add
          .rectangle(x, barY, btnW, btnH, 0x2d241d, 0.92)
          .setStrokeStyle(2, 0xd88c36, 1)
          .setInteractive({ useHandCursor: true });
        const label = this.add
          .text(x, barY, btn.label, {
            fontSize: "14px",
            color: "#fff7ea",
            fontStyle: "bold"
          })
          .setOrigin(0.5);
        rect.on("pointerdown", () => {
          if (btn.onClick) btn.onClick();
        });
        group.add([rect, label]);
      });
      return group;
    };

    scene.enablePinchZoom = function enablePinchZoom(camera, minZoom = 0.6, maxZoom = 1.4) {
      if (!camera) return;
      let lastDistance = null;
      const pointers = new Map();

      scene.input.on("pointerdown", (pointer) => {
        pointers.set(pointer.id, pointer);
      });
      scene.input.on("pointerup", (pointer) => {
        pointers.delete(pointer.id);
        lastDistance = null;
      });
      scene.input.on("pointermove", () => {
        if (pointers.size < 2) return;
        const pts = [...pointers.values()];
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);
        if (lastDistance == null) {
          lastDistance = dist;
          return;
        }
        const delta = (dist - lastDistance) * 0.0025;
        camera.zoom = Phaser.Math.Clamp(camera.zoom + delta, minZoom, maxZoom);
        lastDistance = dist;
      });
    };
  }

  static isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  static isMobileDevice() {
    return MobileSupport.isTouchDevice() && window.innerWidth <= 1024;
  }

  static getViewport() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      portrait: window.matchMedia("(orientation: portrait)").matches,
      safeArea: {
        top:
          parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-top"), 10) ||
          0,
        right:
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue("--safe-right"),
            10
          ) || 0,
        bottom:
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom"),
            10
          ) || 0,
        left:
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue("--safe-left"),
            10
          ) || 0
      }
    };
  }
}

