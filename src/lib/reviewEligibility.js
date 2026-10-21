/**
 * CERTISURE AI — REVIEW QUEUE ELIGIBILITY HELPER
 * Canonical, centralized rules defining unresolved and resolved review items.
 * Used consistently across Review Queue, Sidebar, Dashboard, and History.
 */

/**
 * Determines if a certificate record has received an authoritative human adjudication decision.
 * @param {Object} cert - Certificate or verification record
 * @returns {boolean}
 */
export function isResolvedReviewItem(cert) {
  if (!cert) return false;
  return Boolean(
    cert.review_decision ||
    cert.reviewed_by ||
    cert.metadata?.review_decision ||
    cert.metadata?.adjudication === true
  );
}

/**
 * Determines if a certificate record genuinely requires human adjudication.
 * Excludes settled automated decisions (clean matches and definitive mismatches)
 * that have not been routed or flagged for human review.
 * Mutually exclusive with `isResolvedReviewItem`.
 *
 * @param {Object} cert - Certificate or verification record
 * @returns {boolean}
 */
export function isUnresolvedReviewItem(cert) {
  if (!cert || isResolvedReviewItem(cert)) return false;

  const status = (cert.status || '').toLowerCase();
  const outcome = (cert.metadata?.outcome || '').toLowerCase();
  const uiStatus = (cert.metadata?.uiStatus || '').toUpperCase();

  // 1. Explicit pending/review statuses
  if (status === 'pending' || status === 'needs_review' || status === 'flagged' || status === 'not_found') {
    return true;
  }

  // 2. Explicit metadata review flags
  if (cert.metadata?.requires_review === true || cert.metadata?.adjudication_required === true) {
    return true;
  }

  // 3. Automated pipeline exception states routed for human review
  if (
    uiStatus === 'NEEDS REVIEW' ||
    uiStatus === 'UNABLE TO VERIFY' ||
    uiStatus === 'INCONCLUSIVE / ISSUER UNAVAILABLE' ||
    uiStatus === 'BLOCKED / CONSENT REQUIRED'
  ) {
    return true;
  }

  if (
    outcome === 'unable to verify' ||
    outcome === 'inconclusive / issuer unavailable' ||
    outcome.includes('inconclusive')
  ) {
    return true;
  }

  // 4. Low OCR optical confidence below enterprise threshold
  if (cert.metadata?.lowOcrConfidence === true) {
    return true;
  }

  return false;
}

/**
 * Calculate consistent pending and resolved counts from an array of certificates.
 * @param {Array} certificates
 * @returns {{ pendingCount: number, resolvedCount: number }}
 */
export function getQueueCounts(certificates = []) {
  if (!Array.isArray(certificates)) return { pendingCount: 0, resolvedCount: 0 };
  const pendingCount = certificates.filter(isUnresolvedReviewItem).length;
  const resolvedCount = certificates.filter(isResolvedReviewItem).length;
  return { pendingCount, resolvedCount };
}
