/**
 * Resolve and classify a QA target. Destructive QA must only run against a
 * designated non-production environment, so we derive the app URL from the
 * enterprise's environment slug and heuristically flag whether it looks like a
 * test/dev environment. Pure; no I/O — the caller still confirms before running.
 */
import { QaTarget } from './runTypes';

/** Slugs containing these tokens are treated as safe (non-prod) by default. */
const TEST_TOKENS = ['build', 'dev', 'test', 'qa', 'staging', 'stage', 'sandbox', 'sbx', 'demo'];
/** Slugs containing these are treated as production — never auto-allow destructive. */
const PROD_TOKENS = ['prod', 'production', 'live'];

export function isLikelyTestEnv(envSlug: string): boolean {
  const s = envSlug.toLowerCase();
  if (PROD_TOKENS.some(t => new RegExp(`(^|[^a-z])${t}([^a-z]|$)`).test(s))) return false;
  return TEST_TOKENS.some(t => new RegExp(`(^|[^a-z])${t}([^a-z]|$)`).test(s));
}

export function deriveTarget(envSlug: string, overrideUrl?: string): QaTarget {
  const slug = (envSlug || '').trim();
  const url = (overrideUrl && overrideUrl.trim()) || (slug ? `https://${slug}.fuuz.app` : '');
  return { envSlug: slug, url, isTestEnv: isLikelyTestEnv(slug) };
}
