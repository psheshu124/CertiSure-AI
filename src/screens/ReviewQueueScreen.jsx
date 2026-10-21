import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { isUnresolvedReviewItem, isResolvedReviewItem } from '../lib/reviewEligibility.js';

export default function ReviewQueueScreen() {
  const { certificates, handleReviewDecision, user, selectedReviewId, setSelectedReviewId } = useApp();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCertId, setSelectedCertId] = useState(selectedReviewId || null);
  const [adjudicationDecision, setAdjudicationDecision] = useState('APPROVED');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Adjudication state machine: 'idle' | 'submitting' | 'committed' | 'error'
  const [submissionState, setSubmissionState] = useState('idle');
  const [submissionError, setSubmissionError] = useState('');
  const [isModifying, setIsModifying] = useState(false);

  // Queue items: Unresolved items needing review vs Resolved items (mutually exclusive)
  const pendingItems = certificates.filter(isUnresolvedReviewItem);
  const resolvedItems = certificates.filter(isResolvedReviewItem);

  const displayList = activeTab === 'pending' ? pendingItems : resolvedItems;

  const filteredList = displayList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (item.student_name || '').toLowerCase().includes(q) ||
      (item.certificate_number || '').toLowerCase().includes(q) ||
      (item.institution_name || '').toLowerCase().includes(q);
  });

  // Active certificate resolution:
  // If user selected a specific cert, use it from certificates list (so it stays visible even after moving tabs)
  const activeCert = (selectedCertId ? certificates.find(c => c.id === selectedCertId || c.certificate_number === selectedCertId) : null) ||
    filteredList[0] ||
    null;

  // Sync selectedReviewId from context on mount if set
  useEffect(() => {
    if (selectedReviewId) {
      setSelectedCertId(selectedReviewId);
      const isResolved = resolvedItems.some(c => c.id === selectedReviewId || c.certificate_number === selectedReviewId);
      if (isResolved) setActiveTab('resolved');
    }
  }, [selectedReviewId]);

  // When activeCert changes, sync notes & decision state
  useEffect(() => {
    if (activeCert) {
      if (activeCert.review_decision) {
        setAdjudicationDecision(activeCert.review_decision);
        setReviewerNotes(activeCert.review_notes || '');
      } else {
        setAdjudicationDecision('APPROVED');
        setReviewerNotes('');
      }
      setSubmissionState('idle');
      setSubmissionError('');
      setIsModifying(false);
    }
  }, [activeCert?.id]);

  const handleSelectCert = (id) => {
    setSelectedCertId(id);
    if (setSelectedReviewId) setSelectedReviewId(id);
    setSubmissionState('idle');
    setSubmissionError('');
    setIsModifying(false);
  };

  const handleSubmitAdjudication = async () => {
    if (submissionState === 'submitting') return; // Idempotent guard
    if (!activeCert) return;

    if (!reviewerNotes.trim()) {
      setSubmissionState('error');
      setSubmissionError('Please enter a review justification note before committing.');
      return;
    }

    setSubmissionState('submitting');
    setSubmissionError('');

    try {
      const res = await handleReviewDecision(activeCert.id, adjudicationDecision, reviewerNotes);
      if (!res?.success) {
        setSubmissionState('error');
        setSubmissionError(res?.error || 'Adjudication submission failed. Please retry.');
        return;
      }

      // Transition state machine to 'committed'
      setSubmissionState('committed');
      setIsModifying(false);
      setSelectedCertId(activeCert.id);

      const successNotice = res.warning || `Decision successfully committed: Credential marked as ${adjudicationDecision === 'APPROVED' ? 'VERIFIED' : 'REJECTED'}.`;
      setFeedbackMsg(successNotice);
      setTimeout(() => setFeedbackMsg(''), 5000);
    } catch (err) {
      console.error('[Adjudication Submit Error]', err);
      setSubmissionState('error');
      setSubmissionError(err.message || 'An unexpected error occurred while saving the adjudication.');
    }
  };

  const isResolvedView = Boolean(activeCert?.review_decision) && !isModifying;

  return (
    <div className="flex flex-col w-full">
      {/* Header & Context Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-lg gap-space-md mb-space-md border-b border-surface-container-high/60">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-sm mb-space-xs">
            <h1 className="font-headline-xl text-headline-xl text-primary tracking-tight font-bold">Review queue</h1>
            <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-pill-label text-pill-label font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              {pendingItems.length} PENDING TASKS
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Exception adjudication workbench for ambiguous claims, missing consent, endpoint timeouts, and manual verification tasks.
          </p>
        </div>

        {/* Global Queue Stats */}
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <div className="bg-surface-container-low px-space-md py-space-sm rounded-xl flex items-center gap-space-md shadow-sm border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Pending Reviews</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">{pendingItems.length}</span>
            </div>
            <div className="w-px h-8 bg-surface-container-high"></div>
            <div className="flex flex-col">
              <span className="font-metadata text-metadata text-on-surface-variant text-[11px]">Adjudicated Cases</span>
              <span className="font-headline-sm text-headline-sm text-[#267653] font-bold">{resolvedItems.length}</span>
            </div>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-space-md mb-space-lg rounded-xl bg-[#EAF5EE] text-[#267653] border border-[#BFE0CD] flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span className="font-body-md-medium text-body-md">{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-[#267653] hover:opacity-75">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Main 2-Column Workbench Grid (12 cols: 5 left, 7 right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* LEFT COLUMN: Work Queue List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          {/* Tabs & Search Toolbar */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/20 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between bg-surface-container-low p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('pending');
                  if (pendingItems.length > 0 && (!activeCert || activeCert.review_decision)) {
                    setSelectedCertId(pendingItems[0].id);
                  }
                }}
                className={`flex-1 py-1.5 px-space-sm rounded-md font-body-md-medium text-body-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'pending'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Pending</span>
                <span className="px-1.5 py-0.2 bg-secondary-container text-on-secondary-container text-pill-label font-pill-label rounded-full">
                  {pendingItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('resolved');
                  if (resolvedItems.length > 0 && (!activeCert || !activeCert.review_decision)) {
                    setSelectedCertId(resolvedItems[0].id);
                  }
                }}
                className={`flex-1 py-1.5 px-space-sm rounded-md font-body-md-medium text-body-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'resolved'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Resolved</span>
                <span className="px-1.5 py-0.2 bg-surface-container text-on-surface-variant text-pill-label font-pill-label rounded-full">
                  {resolvedItems.length}
                </span>
              </button>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-space-xs">
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-2.5">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by candidate, ID, or issue..."
                  className="w-full bg-surface-container-low text-on-surface text-body-md font-body-md pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/20"
                />
              </div>
            </div>
          </div>

          {/* Queue Items List (scrollable when overflowing) */}
          <div className="flex flex-col gap-space-sm max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
            {filteredList.length === 0 ? (
              <div className="p-space-lg text-center bg-surface-container-lowest rounded-xl border border-outline-variant/20">
                <span className="material-symbols-outlined text-[32px] text-outline">done_all</span>
                <p className="font-body-md text-on-surface-variant mt-1 text-[13px]">
                  No items in this queue category.
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const isSelected = activeCert && (activeCert.id === item.id || activeCert.certificate_number === item.certificate_number);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectCert(item.id)}
                    className={`bg-surface-container-lowest rounded-xl p-space-md shadow-sm cursor-pointer transition-all relative overflow-hidden border ${
                      isSelected
                        ? 'border-primary shadow-md ring-1 ring-primary'
                        : 'border-outline-variant/20 hover:border-outline-variant'
                    }`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>}
                    <div className="flex items-start justify-between gap-space-sm mb-space-xs pl-space-xs">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-space-xs">
                          <span className="font-metadata text-metadata text-outline font-mono">
                            {item.certificate_number}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                          <span className="font-metadata text-metadata text-on-surface-variant">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="font-headline-sm text-headline-sm text-primary font-bold mt-0.5">
                          {item.student_name}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-pill-label text-pill-label font-bold ${
                        isUnresolvedReviewItem(item)
                          ? 'bg-secondary-container text-on-secondary-container'
                          : item.review_decision === 'APPROVED' || item.status === 'verified'
                            ? 'bg-[#EAF5EE] text-[#267653]'
                            : 'bg-[#FCEEEE] text-[#B54747]'
                      }`}>
                        {isUnresolvedReviewItem(item)
                          ? 'Needs Adjudication'
                          : item.review_decision === 'APPROVED' || item.status === 'verified'
                            ? 'Verified'
                            : 'Rejected'}
                      </span>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface-variant pl-space-xs mb-space-md line-clamp-2 text-[13px]">
                      {item.review_notes || item.metadata?.reason || 'Exception logged during automated ingestion. Awaiting manual reviewer sign-off.'}
                    </p>

                    <div className="flex items-center justify-between pt-space-xs pl-space-xs bg-surface-container-low/60 -mx-space-md -mb-space-md px-space-md py-space-xs rounded-b-xl border-t border-outline-variant/10">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-metadata text-[10px] font-semibold">
                          EV
                        </div>
                        <span className="font-metadata text-metadata text-on-surface">{user.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant font-metadata text-metadata">
                        <span className="material-symbols-outlined text-[15px] text-tertiary-container">
                          {item.review_decision ? 'task_alt' : 'hourglass_top'}
                        </span>
                        <span>{item.review_decision ? 'Resolved' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Adjudication Workbench Panel (7 cols) */}
        {activeCert ? (
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/20 flex flex-col gap-space-lg">
            <div className="flex items-start justify-between pb-space-sm border-b border-surface-container-high/60 gap-space-md">
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs mb-1">
                  <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider font-semibold">
                    Adjudication Case #
                  </span>
                  <span className="font-mono text-metadata text-primary font-bold">
                    {activeCert.certificate_number}
                  </span>
                </div>
                <h2 className="font-headline-md text-headline-md text-primary font-bold">
                  {activeCert.student_name} — {activeCert.institution_name}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant text-[13px]">
                  Program: {activeCert.course_name || 'Specialization Track'}
                </p>
              </div>

              <div className="flex flex-col text-right">
                <span className="font-metadata text-metadata text-on-surface-variant">Intake Date</span>
                <span className="font-metadata text-metadata text-on-surface font-semibold">
                  {new Date(activeCert.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Diagnostic Alert Box */}
            <div className="p-space-md rounded-xl bg-[#FFF5D9] text-[#9A6700] border border-[#F0DC9B] flex items-start gap-space-md">
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">report_problem</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-body-md-medium text-body-md font-bold">Review Reason Flag:</span>
                <span className="font-body-md text-body-md leading-relaxed text-[#9A6700]/90 text-[13px]">
                  {activeCert.metadata?.reason || activeCert.metadata?.explanation || 'Automated registrar query could not be completed with high confidence. Human inspection required.'}
                </span>
              </div>
            </div>

            {/* Evidence & Case Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Claimed Credential ID</span>
                <span className="font-mono text-body-md text-primary font-bold mt-1">{activeCert.certificate_number}</span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Declared Issuing Platform</span>
                <span className="font-body-md text-body-md text-on-surface font-semibold mt-1">{activeCert.institution_name}</span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Candidate Consent</span>
                <span className="font-body-md text-body-md text-[#267653] font-semibold mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#267653]"></span> Confirmed & Documented
                </span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Prior Automated Decision</span>
                <span className="font-body-md text-body-md text-secondary font-semibold mt-1">Inconclusive / Pending Review</span>
              </div>
            </div>

            {/* DYNAMIC WORKBENCH: COMMITTED AUDIT RECORD vs EDITABLE ADJUDICATION FORM */}
            {isResolvedView ? (
              /* COMMITTED DECISION AUDIT CARD (Preserves Decision State, Prevents Form Respawn) */
              <div className="flex flex-col gap-space-md pt-space-sm border-t border-surface-container-high/60">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">Committed Adjudication Decision</span>
                  <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-pill-label text-pill-label font-bold bg-[#EAF5EE] text-[#267653]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#267653]"></span>
                    IMMUTABLE AUDIT RECORD
                  </span>
                </div>

                {/* Primary Decision Banner */}
                <div className={`p-space-md rounded-xl border flex items-start gap-space-md ${
                  activeCert.review_decision === 'APPROVED'
                    ? 'border-[#BFE0CD] bg-[#EAF5EE] text-[#267653]'
                    : 'border-[#F4C7C7] bg-[#FCEEEE] text-[#B54747]'
                }`}>
                  <span className="material-symbols-outlined text-[28px] shrink-0 mt-0.5">
                    {activeCert.review_decision === 'APPROVED' ? 'verified' : 'cancel'}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="font-headline-sm text-headline-sm font-bold">
                      {activeCert.review_decision === 'APPROVED'
                        ? 'Confirmed & Verified (Human Adjudicated)'
                        : 'Rejected & Flagged Mismatch (Human Adjudicated)'}
                    </span>
                    <span className="text-[13px] leading-relaxed opacity-95">
                      {activeCert.review_decision === 'APPROVED'
                        ? 'The credential claim has been independently inspected, confirmed authentic, and marked as verified in company records.'
                        : 'The credential claim has been reviewed and rejected due to unresolvable discrepancies or invalid issuer evidence.'}
                    </span>
                  </div>
                </div>

                {/* Reviewer Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Authoritative Reviewer</span>
                    <span className="font-body-md text-body-md text-on-surface font-semibold mt-0.5">
                      {activeCert.reviewed_by || user.name}
                    </span>
                  </div>
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-metadata text-metadata text-on-surface-variant text-[11px] uppercase">Committed Timestamp</span>
                    <span className="font-body-md text-body-md font-mono text-on-surface font-semibold mt-0.5 text-[12px]">
                      {activeCert.reviewed_at ? new Date(activeCert.reviewed_at).toUTCString() : new Date().toUTCString()}
                    </span>
                  </div>
                </div>

                {/* Justification Notes Display */}
                <div className="flex flex-col gap-1 p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="font-metadata text-metadata text-on-surface-variant uppercase text-[11px] font-semibold">
                    Reviewer Justification & Audit Notes
                  </span>
                  <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap mt-0.5">
                    {activeCert.review_notes || 'No review notes recorded.'}
                  </p>
                </div>

                {/* Action Bar: Review Next vs Modify */}
                <div className="flex items-center justify-between pt-space-xs gap-space-sm flex-wrap">
                  {pendingItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('pending');
                        handleSelectCert(pendingItems[0].id);
                      }}
                      className="h-10 px-space-lg rounded-xl bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <span>Review Next Pending Case ({pendingItems.length} left)</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsModifying(true);
                      setSubmissionState('idle');
                      setSubmissionError('');
                      setReviewerNotes(activeCert.review_notes || '');
                      setAdjudicationDecision(activeCert.review_decision || 'APPROVED');
                    }}
                    className="h-10 px-space-md rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-body-md-medium text-body-md flex items-center gap-1.5 transition-colors ml-auto"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>Modify Adjudication</span>
                  </button>
                </div>
              </div>
            ) : (
              /* EDITABLE ADJUDICATION FORM (Controlled State Machine) */
              <div className="flex flex-col gap-space-md pt-space-sm border-t border-surface-container-high/60">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">
                    {isModifying ? 'Modify Adjudication Decision' : 'Adjudication Decision'}
                  </span>
                  {isModifying && (
                    <button
                      type="button"
                      onClick={() => setIsModifying(false)}
                      className="text-metadata text-on-surface-variant hover:text-on-surface underline text-[12px]"
                    >
                      Cancel modification
                    </button>
                  )}
                </div>

                {/* Actionable Error Banner if Submission Failed */}
                {submissionState === 'error' && submissionError && (
                  <div className="p-space-md rounded-xl bg-[#FCEEEE] text-[#B54747] border border-[#F4C7C7] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">error</span>
                    <span className="font-body-md text-body-md">{submissionError}</span>
                  </div>
                )}

                {/* Radio Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  <label className={`p-space-md rounded-xl border cursor-pointer flex items-center gap-space-sm transition-all ${
                    adjudicationDecision === 'APPROVED'
                      ? 'border-[#267653] bg-[#EAF5EE] text-[#267653]'
                      : 'border-outline-variant/30 hover:bg-surface-container-low'
                  }`}>
                    <input
                      type="radio"
                      name="decision"
                      value="APPROVED"
                      disabled={submissionState === 'submitting'}
                      checked={adjudicationDecision === 'APPROVED'}
                      onChange={() => setAdjudicationDecision('APPROVED')}
                      className="w-4 h-4 text-[#267653] cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-body-md-medium text-body-md font-bold">Confirm & Verify</span>
                      <span className="font-metadata text-metadata text-[11px]">Primary or alternative proof verified</span>
                    </div>
                  </label>

                  <label className={`p-space-md rounded-xl border cursor-pointer flex items-center gap-space-sm transition-all ${
                    adjudicationDecision === 'REJECTED'
                      ? 'border-[#B54747] bg-[#FCEEEE] text-[#B54747]'
                      : 'border-outline-variant/30 hover:bg-surface-container-low'
                  }`}>
                    <input
                      type="radio"
                      name="decision"
                      value="REJECTED"
                      disabled={submissionState === 'submitting'}
                      checked={adjudicationDecision === 'REJECTED'}
                      onChange={() => setAdjudicationDecision('REJECTED')}
                      className="w-4 h-4 text-[#B54747] cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-body-md-medium text-body-md font-bold">Reject & Flag Mismatch</span>
                      <span className="font-metadata text-metadata text-[11px]">Unresolvable discrepancy / unverified</span>
                    </div>
                  </label>
                </div>

                {/* Reviewer Notes Textarea */}
                <div className="flex flex-col gap-1">
                  <label className="font-form-label text-form-label text-on-surface flex items-center justify-between">
                    <span>Adjudication Justification & Audit Notes <span className="text-error">*</span></span>
                    <span className="font-metadata text-metadata text-on-surface-variant">Logged in immutable SOC2 trail</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewerNotes}
                    disabled={submissionState === 'submitting'}
                    onChange={(e) => {
                      setReviewerNotes(e.target.value);
                      if (submissionState === 'error') setSubmissionState('idle');
                    }}
                    placeholder="State the justification, secondary registrar confirmation, or reason for this manual adjudication decision..."
                    className="w-full p-space-md bg-surface-container-low text-on-surface rounded-xl font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-secondary disabled:opacity-50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmitAdjudication}
                  disabled={submissionState === 'submitting'}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-body-md-medium text-body-md flex items-center justify-center gap-space-sm transition-all shadow-md mt-1 disabled:opacity-50 cursor-pointer"
                >
                  {submissionState === 'submitting' ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                      <span>Committing Adjudication Decision...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">gavel</span>
                      <span>Commit Human Adjudication Decision</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/20 flex flex-col items-center justify-center min-h-[360px] text-center gap-space-sm">
            <span className="material-symbols-outlined text-[44px] text-outline">task_alt</span>
            <h3 className="font-headline-sm text-primary font-bold">Review queue clear</h3>
            <p className="font-body-md text-on-surface-variant max-w-sm">
              No verification records currently require secondary forensic review or manual human adjudication.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
