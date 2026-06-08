import crypto from "node:crypto";

export const BILLING_POLICY_KEY = "billing_policy";
export const BILLING_POLICY_KEY_ID = "billing-policy-2026-01";
export const MINIMUM_BILLING_CLIENT_VERSION = "0.1.6";

const VALID_BILLING_MODES = new Set(["free_access", "paid"]);
const APP_POLICY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BUSINESS_WORKSPACE_LIMIT = 5;
const FREE_ACCESS_TEMPLATE_LIMIT = null;

const FREE_ACCESS_CAPABILITIES = Object.freeze({
  exportPreview: true,
  secondaryWorkspace: true,
  proxySettings: true,
  customTemplates: true
});

const signingKeyPair = crypto.generateKeyPairSync("ed25519");

function isoFromNow(now) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}

function timeMs(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function oppositeMode(mode) {
  return mode === "paid" ? "free_access" : "paid";
}

function normalizeMode(value, fallback = "free_access") {
  return VALID_BILLING_MODES.has(value) ? value : fallback;
}

export function resolveBillingPolicyForNow(policy = {}, now = new Date()) {
  const nowMs = timeMs(now) ?? Date.now();
  const effectiveAt = policy.effectiveAt || null;
  const pendingMode = normalizeMode(policy.pendingMode, null);
  const base = {
    mode: normalizeMode(policy.mode),
    version: Number(policy.version || 1),
    pendingMode: pendingMode || null,
    effectiveAt: pendingMode ? effectiveAt : null,
    updatedAt: policy.updatedAt || isoFromNow(now),
    updatedBy: policy.updatedBy || null
  };
  if (!base.pendingMode) return base;
  const effectiveMs = timeMs(base.effectiveAt);
  if (!effectiveMs || effectiveMs <= nowMs) {
    return {
      ...base,
      mode: base.pendingMode,
      pendingMode: null,
      effectiveAt: null
    };
  }
  return base;
}

export function createDefaultBillingPolicy(now = new Date(), options = {}) {
  return {
    mode: normalizeMode(options.mode, "free_access"),
    version: 1,
    pendingMode: null,
    effectiveAt: null,
    updatedAt: isoFromNow(now),
    updatedBy: null
  };
}

export function normalizeBillingPolicyRecord({ valueJson, version, updatedAt, updatedBy, now = new Date() } = {}) {
  const parsed = valueJson ? JSON.parse(valueJson) : {};
  const fallback = createDefaultBillingPolicy(now);
  let mode = normalizeMode(parsed.mode, fallback.mode);
  let pendingMode = normalizeMode(parsed.pendingMode, null);
  const effectiveAt = parsed.effectiveAt || null;
  if (!pendingMode && effectiveAt && timeMs(effectiveAt) > (timeMs(now) ?? Date.now())) {
    pendingMode = mode;
    mode = normalizeMode(parsed.activeMode, oppositeMode(mode));
  }
  return resolveBillingPolicyForNow({
    mode,
    pendingMode,
    version: Number(version || parsed.version || fallback.version),
    effectiveAt,
    updatedAt: updatedAt || parsed.updatedAt || fallback.updatedAt,
    updatedBy: updatedBy ?? parsed.updatedBy ?? null
  }, now);
}

export function billingPolicyValueJson(policy) {
  return JSON.stringify({
    mode: policy.mode,
    pendingMode: policy.pendingMode || null,
    effectiveAt: policy.effectiveAt || null,
    updatedAt: policy.updatedAt,
    updatedBy: policy.updatedBy || null
  });
}

export function buildBillingPolicyUpdate(current, { mode, effectiveAt = null, expectedVersion, adminUserId, now = new Date() } = {}) {
  current = resolveBillingPolicyForNow(current, now);
  if (!VALID_BILLING_MODES.has(mode)) throw new Error("BILLING_POLICY_MODE_INVALID");
  if (Number(expectedVersion) !== Number(current.version)) throw new Error("BILLING_POLICY_VERSION_CONFLICT");
  const effectiveMs = effectiveAt === null || effectiveAt === undefined || effectiveAt === "" ? null : timeMs(effectiveAt);
  if (effectiveAt !== null && effectiveAt !== undefined && effectiveAt !== "" && effectiveMs === null) {
    throw new Error("BILLING_POLICY_EFFECTIVE_AT_INVALID");
  }
  const isScheduled = effectiveMs !== null && effectiveMs > (timeMs(now) ?? Date.now()) && mode !== current.mode;
  return {
    mode: isScheduled ? current.mode : mode,
    version: Number(current.version) + 1,
    pendingMode: isScheduled ? mode : null,
    effectiveAt: isScheduled ? effectiveAt : null,
    updatedAt: isoFromNow(now),
    updatedBy: adminUserId || null
  };
}

export function entitlementBillingOverlay(policy, plan = {}) {
  const mode = policy.mode === "paid" ? "paid" : "free_access";
  if (mode === "free_access") {
    return {
      billingPolicy: policy,
      billingMode: "free_access",
      unlimitedDailyUsage: true,
      hideBillingNavigation: true,
      effectiveCapabilities: { ...FREE_ACCESS_CAPABILITIES },
      effectiveWorkspaceLimit: BUSINESS_WORKSPACE_LIMIT,
      effectiveTemplateLimit: FREE_ACCESS_TEMPLATE_LIMIT
    };
  }
  return {
    billingPolicy: policy,
    billingMode: "paid",
    unlimitedDailyUsage: false,
    hideBillingNavigation: false,
    effectiveCapabilities: {
      exportPreview: Boolean(plan.id && plan.id !== "free"),
      secondaryWorkspace: Number(plan.workspaceLimit || 0) > 1,
      proxySettings: Boolean(plan.id && plan.id !== "free"),
      customTemplates: Number(plan.templateLimit || 0) > 1 || plan.templateLimit === null
    },
    effectiveWorkspaceLimit: Number(plan.workspaceLimit || 1),
    effectiveTemplateLimit: plan.templateLimit === null ? null : Number(plan.templateLimit || 0)
  };
}

export function signedAppPolicyResponse(policy, now = new Date()) {
  policy = resolveBillingPolicyForNow(policy, now);
  const fetchedAt = isoFromNow(now);
  const cacheExpiresAt = new Date(new Date(fetchedAt).getTime() + APP_POLICY_CACHE_TTL_MS).toISOString();
  const billing = {
    mode: policy.mode,
    version: policy.version,
    pendingMode: policy.pendingMode || null,
    effectiveAt: policy.effectiveAt || null,
    updatedAt: policy.updatedAt,
    updatedBy: policy.updatedBy || null,
    fetchedAt,
    cacheExpiresAt,
    keyId: BILLING_POLICY_KEY_ID
  };
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(billing)), signingKeyPair.privateKey).toString("base64");
  return {
    billing: { ...billing, signature },
    minimumBillingClientVersion: MINIMUM_BILLING_CLIENT_VERSION
  };
}
