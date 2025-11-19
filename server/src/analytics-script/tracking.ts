import { BasePayload, ScriptConfig, TrackingPayload, WebVitalsData, SessionReplayBatch, ProductData, TransactionData } from "./types.js";
import { findMatchingPattern } from "./utils.js";
import { SessionReplayRecorder } from "./sessionReplay.js";

export class Tracker {
  private config: ScriptConfig;
  private customUserId: string | null = null;
  private sessionReplayRecorder?: SessionReplayRecorder;
  private scrollDepthFired: Set<number> = new Set();
  private visibilityObserver?: IntersectionObserver;

  constructor(config: ScriptConfig) {
    this.config = config;
    this.loadUserId();

    if (config.enableSessionReplay) {
      this.initializeSessionReplay();
    }

    // Initialize advanced tracking features
    if (config.scrollTracking) {
      this.initScrollTracking();
    }
    if (config.formTracking) {
      this.initFormTracking();
    }
    if (config.visibilityTracking) {
      this.initVisibilityTracking();
    }
    if (config.timerEvents && config.timerEvents.length > 0) {
      this.initTimerEvents();
    }
  }

  private loadUserId(): void {
    try {
      const storedUserId = localStorage.getItem("rybbit-user-id");
      if (storedUserId) {
        this.customUserId = storedUserId;
      }
    } catch (e) {
      // localStorage not available
    }
  }

  private async initializeSessionReplay(): Promise<void> {
    try {
      this.sessionReplayRecorder = new SessionReplayRecorder(this.config, this.customUserId || "", batch =>
        this.sendSessionReplayBatch(batch)
      );
      await this.sessionReplayRecorder.initialize();
    } catch (error) {
      console.error("Failed to initialize session replay:", error);
    }
  }

  private async sendSessionReplayBatch(batch: SessionReplayBatch): Promise<void> {
    try {
      await fetch(`${this.config.analyticsHost}/session-replay/record/${this.config.siteId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
        mode: "cors",
        keepalive: false, // Disable keepalive for large session replay requests
      });
    } catch (error) {
      console.error("Failed to send session replay batch:", error);
      throw error;
    }
  }

  createBasePayload(): BasePayload | null {
    const url = new URL(window.location.href);
    let pathname = url.pathname;

    // Handle hash-based SPA routing
    if (url.hash && url.hash.startsWith("#/")) {
      pathname = url.hash.substring(1);
    }

    // Check skip patterns
    if (findMatchingPattern(pathname, this.config.skipPatterns)) {
      return null;
    }

    // Apply mask patterns
    const maskMatch = findMatchingPattern(pathname, this.config.maskPatterns);
    if (maskMatch) {
      pathname = maskMatch;
    }

    const payload: BasePayload = {
      site_id: this.config.siteId,
      hostname: url.hostname,
      pathname: pathname,
      querystring: this.config.trackQuerystring ? url.search : "",
      screenWidth: screen.width,
      screenHeight: screen.height,
      language: navigator.language,
      page_title: document.title,
      referrer: document.referrer,
    };

    if (this.customUserId) {
      payload.user_id = this.customUserId;
    }

    return payload;
  }

  async sendTrackingData(payload: TrackingPayload): Promise<void> {
    try {
      await fetch(`${this.config.analyticsHost}/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        mode: "cors",
        keepalive: true,
      });
    } catch (error) {
      console.error("Failed to send tracking data:", error);
    }
  }

  track(eventType: TrackingPayload["type"], eventName: string = "", properties: Record<string, any> = {}): void {
    if (eventType === "custom_event" && (!eventName || typeof eventName !== "string")) {
      console.error("Event name is required and must be a string for custom events");
      return;
    }

    const basePayload = this.createBasePayload();
    if (!basePayload) {
      return; // Skip tracking
    }

    const payload: TrackingPayload = {
      ...basePayload,
      type: eventType,
      event_name: eventName,
      properties:
        eventType === "custom_event" || eventType === "outbound" || eventType === "error" || eventType === "ecommerce"
          ? JSON.stringify(properties)
          : undefined,
    };

    this.sendTrackingData(payload);
  }

  trackPageview(): void {
    this.track("pageview");
  }

  trackEvent(name: string, properties: Record<string, any> = {}): void {
    this.track("custom_event", name, properties);
  }

  trackOutbound(url: string, text: string = "", target: string = "_self"): void {
    this.track("outbound", "", { url, text, target });
  }

  trackWebVitals(vitals: WebVitalsData): void {
    const basePayload = this.createBasePayload();
    if (!basePayload) {
      return;
    }

    const payload: TrackingPayload = {
      ...basePayload,
      type: "performance",
      event_name: "web-vitals",
      ...vitals,
    };

    this.sendTrackingData(payload);
  }

  trackError(error: Error, additionalInfo: Record<string, any> = {}): void {
    // Industry-standard filtering: Only track errors from the same origin to avoid noise from third-party scripts
    const currentOrigin = window.location.origin;
    const filename = additionalInfo.filename || "";
    const errorStack = error.stack || "";

    // Primary check: Use filename if available (most reliable)
    if (filename) {
      try {
        const fileUrl = new URL(filename);
        if (fileUrl.origin !== currentOrigin) {
          return; // Skip third-party script errors
        }
      } catch (e) {
        // If filename is not a valid URL, it might be a relative path or browser-generated
        // In this case, we'll continue to the stack check
      }
    }

    // Fallback check: Use stack trace if filename check was inconclusive
    else if (errorStack) {
      // Check if stack contains any reference to the current origin
      if (!errorStack.includes(currentOrigin)) {
        return; // Skip third-party script errors
      }
    }

    // If neither filename nor stack can determine origin, track the error
    // This covers cases like NetworkError where the source is unclear but could be first-party

    const errorProperties: Record<string, any> = {
      message: error.message?.substring(0, 500) || "Unknown error", // Truncate to 500 chars
      stack: errorStack.substring(0, 2000) || "", // Truncate to 2000 chars
    };

    // Only include properties if they have meaningful values
    if (filename) {
      errorProperties.fileName = filename;
    }

    if (additionalInfo.lineno) {
      const lineNum =
        typeof additionalInfo.lineno === "string" ? parseInt(additionalInfo.lineno, 10) : additionalInfo.lineno;
      if (lineNum && lineNum !== 0) {
        errorProperties.lineNumber = lineNum;
      }
    }

    if (additionalInfo.colno) {
      const colNum =
        typeof additionalInfo.colno === "string" ? parseInt(additionalInfo.colno, 10) : additionalInfo.colno;
      if (colNum && colNum !== 0) {
        errorProperties.columnNumber = colNum;
      }
    }

    // Add any other additional info
    for (const key in additionalInfo) {
      if (!["lineno", "colno"].includes(key) && additionalInfo[key] !== undefined) {
        errorProperties[key] = additionalInfo[key];
      }
    }

    this.track("error", error.name || "Error", errorProperties);
  }

  identify(userId: string): void {
    if (typeof userId !== "string" || userId.trim() === "") {
      console.error("User ID must be a non-empty string");
      return;
    }

    this.customUserId = userId.trim();
    try {
      localStorage.setItem("rybbit-user-id", this.customUserId);
    } catch (e) {
      console.warn("Could not persist user ID to localStorage");
    }

    // Update session replay recorder with new user ID
    if (this.sessionReplayRecorder) {
      this.sessionReplayRecorder.updateUserId(this.customUserId);
    }
  }

  clearUserId(): void {
    this.customUserId = null;
    try {
      localStorage.removeItem("rybbit-user-id");
    } catch (e) {
      // localStorage not available
    }
  }

  getUserId(): string | null {
    return this.customUserId;
  }

  // Session Replay methods
  startSessionReplay(): void {
    if (this.sessionReplayRecorder) {
      this.sessionReplayRecorder.startRecording();
    } else {
      console.warn("Session replay not initialized");
    }
  }

  stopSessionReplay(): void {
    if (this.sessionReplayRecorder) {
      this.sessionReplayRecorder.stopRecording();
    }
  }

  isSessionReplayActive(): boolean {
    return this.sessionReplayRecorder?.isActive() ?? false;
  }

  // Handle page changes for SPA
  onPageChange(): void {
    if (this.sessionReplayRecorder) {
      this.sessionReplayRecorder.onPageChange();
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.sessionReplayRecorder) {
      this.sessionReplayRecorder.cleanup();
    }
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
    }
  }

  // Advanced Tracking Methods

  private initScrollTracking(): void {
    const thresholds = [25, 50, 75, 100];

    const checkScroll = () => {
      const scrollPercentage = (window.scrollY + window.innerHeight) /
                               document.documentElement.scrollHeight * 100;

      thresholds.forEach(threshold => {
        if (scrollPercentage >= threshold && !this.scrollDepthFired.has(threshold)) {
          this.scrollDepthFired.add(threshold);
          this.trackEvent('scroll_depth', {
            depth_percentage: threshold,
            depth_pixels: window.scrollY
          });
        }
      });
    };

    // Simple throttle
    let scrollTimeout: any;
    const throttledCheckScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        checkScroll();
        scrollTimeout = null;
      }, 500);
    };

    window.addEventListener('scroll', throttledCheckScroll, { passive: true });
  }

  private initFormTracking(): void {
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      const formId = form.id || form.name || 'unknown';
      const formAction = form.action;

      this.trackEvent('form_submission', {
        form_id: formId,
        form_action: formAction,
        form_method: form.method
      });
    }, true);
  }

  private initVisibilityTracking(): void {
    this.visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const eventName = element.dataset.rybbitTrackVisibility;

          if (eventName) {
            this.trackEvent(eventName, {
              element_id: element.id,
              element_class: element.className
            });
            this.visibilityObserver?.unobserve(element);
          }
        }
      });
    }, { threshold: 0.5 });

    // Observe all elements with data-rybbit-track-visibility
    document.querySelectorAll('[data-rybbit-track-visibility]')
      .forEach(el => this.visibilityObserver?.observe(el));
  }

  private initTimerEvents(): void {
    const timers = this.config.timerEvents || [];

    timers.forEach(({ seconds, eventName }) => {
      setTimeout(() => {
        this.trackEvent(eventName, {
          time_on_page: seconds,
          still_on_page: true
        });
      }, seconds * 1000);
    });
  }

  // E-commerce Tracking Methods

  viewProduct(product: ProductData): void {
    this.track('ecommerce', 'view_item', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_category: product.category,
      product_brand: product.brand,
      product_variant: product.variant,
    });
  }

  addToCart(product: ProductData, quantity: number = 1): void {
    this.track('ecommerce', 'add_to_cart', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_category: product.category,
      product_brand: product.brand,
      product_variant: product.variant,
      quantity: quantity,
    });
  }

  purchase(transaction: TransactionData): void {
    this.track('ecommerce', 'purchase', {
      transaction_id: transaction.transaction_id,
      value: transaction.value,
      currency: transaction.currency || 'USD',
      tax: transaction.tax,
      shipping: transaction.shipping,
      items: transaction.items,
    });
  }
}
