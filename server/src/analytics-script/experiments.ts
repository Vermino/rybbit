import { ScriptConfig } from "./types.js";

interface Experiment {
  id: number;
  name: string;
  type: string;
  status: string;
  variants: Array<{
    id: string;
    name: string;
    trafficWeight: number;
    isControl: boolean;
    redirectUrl?: string;
    customCode?: string;
  }>;
  targetingRules: any;
  trafficAllocation: number;
  cloakedUrl?: string;
  targetUrl?: string;
}

interface VariantAssignment {
  experimentId: number;
  variantId: string;
  assignedAt: number;
}

export class ExperimentManager {
  private config: ScriptConfig;
  private experiments: Experiment[] = [];
  private assignments: Map<number, VariantAssignment> = new Map();
  private forcedVariants: Map<number, string> = new Map();

  constructor(config: ScriptConfig) {
    this.config = config;
    this.loadAssignments();
    this.checkForcedVariants();
  }

  /**
   * Check URL parameters for forced variant assignments
   * Format: ?rb_variant=experimentId:variantId or ?rb_variant=variantId (for single experiment)
   */
  private checkForcedVariants(): void {
    try {
      const url = new URL(window.location.href);
      const forceParam = url.searchParams.get("rb_variant");
      const forceExpParam = url.searchParams.get("rb_experiment");

      if (forceParam) {
        // Format: experimentId:variantId or just variantId
        if (forceParam.includes(":")) {
          const [expId, variantId] = forceParam.split(":");
          this.forcedVariants.set(parseInt(expId), variantId);
          console.log(`[Rybbit] Forced variant ${variantId} for experiment ${expId}`);
        } else if (forceExpParam) {
          // Single experiment specified
          this.forcedVariants.set(parseInt(forceExpParam), forceParam);
          console.log(`[Rybbit] Forced variant ${forceParam} for experiment ${forceExpParam}`);
        }
      }
    } catch (e) {
      console.error("[Rybbit] Error checking forced variants:", e);
    }
  }

  /**
   * Load variant assignments from localStorage
   */
  private loadAssignments(): void {
    try {
      const stored = localStorage.getItem("rybbit-experiment-assignments");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.assignments = new Map(Object.entries(parsed).map(([k, v]) => [parseInt(k), v as VariantAssignment]));
      }
    } catch (e) {
      console.error("[Rybbit] Error loading assignments:", e);
    }
  }

  /**
   * Save variant assignments to localStorage
   */
  private saveAssignments(): void {
    try {
      const obj = Object.fromEntries(this.assignments);
      localStorage.setItem("rybbit-experiment-assignments", JSON.stringify(obj));
    } catch (e) {
      console.error("[Rybbit] Error saving assignments:", e);
    }
  }

  /**
   * Fetch active experiments for this site
   */
  async fetchExperiments(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.analyticsHost}/experiments/active/${this.config.siteId}`,
        {
          method: "GET",
          mode: "cors",
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.experiments = data.experiments || [];
        console.log(`[Rybbit] Loaded ${this.experiments.length} active experiments`);
      }
    } catch (e) {
      console.error("[Rybbit] Error fetching experiments:", e);
    }
  }

  /**
   * Check if current user matches targeting rules
   */
  private matchesTargeting(experiment: Experiment): boolean {
    const rules = experiment.targetingRules || {};
    const currentUrl = window.location.href;
    const currentPath = window.location.pathname;

    // URL pattern matching
    if (rules.urlPatterns && Array.isArray(rules.urlPatterns)) {
      const matches = rules.urlPatterns.some((pattern: string) => {
        // Convert simple wildcards to regex
        const regexPattern = pattern
          .replace(/\*/g, ".*")
          .replace(/\?/g, "\\?");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(currentPath) || regex.test(currentUrl);
      });
      if (!matches) return false;
    }

    // Device type matching
    if (rules.deviceTypes && Array.isArray(rules.deviceTypes)) {
      const deviceType = this.getDeviceType();
      if (!rules.deviceTypes.includes(deviceType)) return false;
    }

    // Check if we should apply traffic allocation
    if (experiment.trafficAllocation < 100) {
      const hash = this.hashString(this.getUserId() + experiment.id);
      const bucket = hash % 100;
      if (bucket >= experiment.trafficAllocation) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get device type
   */
  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "tablet";
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return "mobile";
    }
    return "desktop";
  }

  /**
   * Simple hash function for consistent bucketing
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get or create user ID for consistent variant assignment
   */
  private getUserId(): string {
    let userId = localStorage.getItem("rybbit-user-id");
    if (!userId) {
      userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem("rybbit-user-id", userId);
    }
    return userId;
  }

  /**
   * Assign variant for an experiment
   */
  private assignVariant(experiment: Experiment): VariantAssignment | null {
    // Check if forced variant
    const forcedVariantId = this.forcedVariants.get(experiment.id);
    if (forcedVariantId) {
      const variant = experiment.variants.find(v => v.id === forcedVariantId);
      if (variant) {
        const assignment: VariantAssignment = {
          experimentId: experiment.id,
          variantId: variant.id,
          assignedAt: Date.now(),
        };
        this.assignments.set(experiment.id, assignment);
        this.saveAssignments();
        console.log(`[Rybbit] Assigned forced variant ${variant.id} for experiment ${experiment.id}`);
        return assignment;
      }
    }

    // Check if already assigned
    const existing = this.assignments.get(experiment.id);
    if (existing) {
      return existing;
    }

    // Check targeting rules
    if (!this.matchesTargeting(experiment)) {
      return null;
    }

    // Assign based on traffic weights
    const userId = this.getUserId();
    const hash = this.hashString(userId + experiment.id);
    let cumulative = 0;
    const bucket = hash % 100;

    for (const variant of experiment.variants) {
      cumulative += variant.trafficWeight;
      if (bucket < cumulative) {
        const assignment: VariantAssignment = {
          experimentId: experiment.id,
          variantId: variant.id,
          assignedAt: Date.now(),
        };
        this.assignments.set(experiment.id, assignment);
        this.saveAssignments();
        console.log(`[Rybbit] Assigned variant ${variant.id} for experiment ${experiment.id}`);
        return assignment;
      }
    }

    return null;
  }

  /**
   * Process all active experiments
   */
  processExperiments(): void {
    for (const experiment of this.experiments) {
      const assignment = this.assignVariant(experiment);
      if (assignment) {
        this.applyVariant(experiment, assignment.variantId);
      }
    }
  }

  /**
   * Apply variant changes to the page
   */
  private applyVariant(experiment: Experiment, variantId: string): void {
    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant || variant.isControl) {
      return; // Control variant - no changes needed
    }

    // URL Redirect experiments
    if (experiment.type === "url" && variant.redirectUrl) {
      // Check if we're on the cloaked URL
      const currentPath = window.location.pathname;
      const cloakedPath = experiment.cloakedUrl || "";

      if (currentPath === cloakedPath || window.location.href.includes(cloakedPath)) {
        console.log(`[Rybbit] Redirecting to ${variant.redirectUrl}`);
        window.location.href = variant.redirectUrl;
      }
    }

    // Visual experiments - inject custom code
    if (experiment.type === "visual" && variant.customCode) {
      try {
        // Create a script element to inject custom code
        const script = document.createElement("script");
        script.textContent = variant.customCode;
        document.head.appendChild(script);
        console.log(`[Rybbit] Applied visual changes for variant ${variantId}`);
      } catch (e) {
        console.error(`[Rybbit] Error applying visual changes:`, e);
      }
    }
  }

  /**
   * Get active variant assignments for tracking
   */
  getActiveAssignments(): Record<string, string> {
    const active: Record<string, string> = {};
    for (const [expId, assignment] of this.assignments) {
      active[`exp_${expId}`] = assignment.variantId;
    }
    return active;
  }

  /**
   * Initialize experiments
   */
  async initialize(): Promise<void> {
    await this.fetchExperiments();
    this.processExperiments();
  }
}
