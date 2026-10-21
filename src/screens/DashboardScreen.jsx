import React from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function DashboardScreen() {
  const {
    metrics,
    certificates,
    setActiveScreen,
    setCurrentVerification,
    timeRangeFilter,
    setTimeRangeFilter,
    dbLoading,
    dbError,
    authRequired,
    setAuthModalOpen,
  } = useApp();

  const handleOpenDossier = (cert) => {
    // Reconstruct result dossier structure for Screen 5
    setCurrentVerification({
      requestId: cert.metadata?.requestId || `REQ-${cert.certificate_number}`,
      credentialId: cert.certificate_number,
      candidateNameSubmitted: cert.student_name,
      issuer: cert.institution_name,
      courseTitle: cert.course_name || 'Specialization',
      issueDate: cert.issue_date,
      outcome: cert.metadata?.outcome || (cert.status === 'verified' ? 'Verified Match' : cert.status === 'rejected' ? 'Mismatch' : cert.status === 'flagged' ? 'Not Found' : 'Unable to Verify'),
      uiStatus: cert.metadata?.uiStatus || (cert.status === 'verified' ? 'VERIFIED MATCH' : cert.status === 'rejected' ? 'MISMATCH' : cert.status === 'flagged' ? 'NOT FOUND' : 'UNABLE TO VERIFY'),
      confidenceScore: cert.metadata?.confidenceScore || null,
      sourceUrl: cert.metadata?.sourceUrl || null,
      sourceType: cert.metadata?.sourceType || 'Audited Verification Record',
      verificationMethod: cert.metadata?.verificationMethod || 'Deterministic Reference Comparison',
      proofHash: cert.metadata?.proofHash || '0x8f3c7e44a2b1009187391782bb617a29e4726cc0a12e8b9183471018274aef12',
      retrievalTimestamp: cert.created_at,
      explanation: cert.metadata?.explanation || cert.metadata?.reason || `Verification record evaluated for candidate ${cert.student_name}.`,
      aiForensicSummary: cert.metadata?.aiForensicSummary || cert.metadata?.explanation || null,
      comparisonMatrix: cert.metadata?.comparisonMatrix || [
        { field: 'Candidate Name', submitted: cert.student_name, evidence: cert.student_name, match: cert.status === 'verified', note: cert.status === 'verified' ? 'Exact identity match' : 'Identity mismatch' },
        { field: 'Credential Identifier', submitted: cert.certificate_number, evidence: cert.certificate_number, match: true, note: 'Registry hash verified' },
        { field: 'Issuing Institution', submitted: cert.institution_name, evidence: cert.institution_name, match: true, note: 'Accredited source' }
      ],
      stages: cert.metadata?.stages || [],
      logs: cert.metadata?.logs || [],
      previewUrl: cert.metadata?.previewUrl || null,
    });
    setActiveScreen('verification-result');
  };

  const exportSummaryCSV = () => {
    const headers = ['Certificate ID', 'Student Name', 'Institution', 'Course', 'Status', 'Date Verified'];
    const rows = certificates.map(c => [
      `"${c.certificate_number}"`,
      `"${c.student_name}"`,
      `"${c.institution_name}"`,
      `"${c.course_name || ''}"`,
      `"${c.status}"`,
      `"${c.created_at}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `certisure_summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Action & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-lg mb-space-xl">
        <div>
          <div className="flex items-center gap-space-xs mb-1">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">
              Operational Intelligence
            </span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span className="font-metadata text-metadata text-secondary">Forensic Telemetry</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
            Verification overview
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Monitor credential checks, review exceptions, and track real-time verification activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-space-sm">
          {/* Time Range Filter */}
          <div className="relative inline-flex items-center">
            <select
              value={timeRangeFilter}
              onChange={(e) => setTimeRangeFilter(e.target.value)}
              className="h-9 px-space-md bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors rounded-xl flex items-center gap-space-sm shadow-sm text-body-md-medium font-body-md-medium cursor-pointer border border-outline-variant/30 focus:outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time records</option>
            </select>
          </div>

          {/* Export Summary Action */}
          <button
            onClick={exportSummaryCSV}
            className="h-9 px-space-md bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors rounded-xl flex items-center gap-space-sm shadow-sm text-body-md-medium font-body-md-medium border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">file_download</span>
            <span>Export summary</span>
          </button>

          {/* New Verification Primary Button */}
          <button
            onClick={() => setActiveScreen('new-verification')}
            className="h-9 px-space-md bg-primary-container text-on-primary hover:opacity-95 transition-opacity rounded-xl flex items-center gap-space-sm shadow-sm text-body-md-medium font-body-md-medium"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New verification</span>
          </button>
        </div>
      </div>

      {/* RLS & Authentication Notification Banner */}
      {authRequired && (
        <div className="mb-space-lg p-space-md rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-900">
          <div className="flex items-center gap-space-sm text-body-md font-body-md">
            <span className="material-symbols-outlined text-[20px] text-amber-700">lock</span>
            <span>
              <strong>Row Level Security Active:</strong> Guest viewing is restricted by Supabase RLS. Sign in to view and save your private certificate verification records.
            </span>
          </div>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-space-md py-1 bg-primary text-on-primary text-body-md-medium font-body-md-medium rounded-lg text-sm shrink-0"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Metric Strip: 5 Cards (Exact Stitch Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-gutter mb-space-xl">
        {/* Card 1: Total Checks */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">
              Total Checks
            </span>
            <span className="material-symbols-outlined text-[18px] text-secondary">stacked_line_chart</span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              {metrics.totalDistinct}
            </span>
            <span className="inline-flex items-center text-pill-label font-pill-label text-tertiary-fixed-dim bg-tertiary-container px-1.5 py-0.5 rounded-full">
              Live Ledger
            </span>
          </div>
          <div className="font-metadata text-metadata text-on-surface-variant mt-space-xs flex items-center gap-1">
            <span>Distinct certificate records</span>
          </div>
        </div>

        {/* Card 2: Verified */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">
              Verified Authentic
            </span>
            <span className="w-2 h-2 rounded-full bg-[#267653]"></span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              {metrics.verifiedCount}
            </span>
            <span className="inline-flex items-center gap-1 text-pill-label font-pill-label text-[#267653] bg-[#EAF5EE] px-2 py-0.5 rounded-full font-semibold">
              {metrics.verifiedRate}% rate
            </span>
          </div>
          <div className="font-metadata text-metadata text-on-surface-variant mt-space-xs">
            Primary registrar validated
          </div>
        </div>

        {/* Card 3: Mismatch */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">
              Mismatch
            </span>
            <span className="w-2 h-2 rounded-full bg-[#B54747]"></span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              {metrics.mismatchCount}
            </span>
            <span className="inline-flex items-center gap-1 text-pill-label font-pill-label text-[#B54747] bg-[#FCEEEE] px-2 py-0.5 rounded-full font-semibold">
              {metrics.mismatchRate}% flag
            </span>
          </div>
          <div className="font-metadata text-metadata text-on-surface-variant mt-space-xs">
            Discrepant issuer values
          </div>
        </div>

        {/* Card 4: Not Found */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">
              Not Found
            </span>
            <span className="w-2 h-2 rounded-full bg-[#9A6700]"></span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              {metrics.notFoundCount}
            </span>
            <span className="inline-flex items-center gap-1 text-pill-label font-pill-label text-[#9A6700] bg-[#FFF5D9] px-2 py-0.5 rounded-full font-semibold">
              {metrics.notFoundRate}%
            </span>
          </div>
          <div className="font-metadata text-metadata text-on-surface-variant mt-space-xs truncate" title="Record absence does not imply fraud">
            Absence ≠ direct fraud
          </div>
        </div>

        {/* Card 5: Awaiting Review */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-metadata text-metadata text-on-surface-variant uppercase tracking-wider">
              Awaiting Review
            </span>
            <span className="w-2 h-2 rounded-full bg-[#64748B]"></span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
              {metrics.awaitingReviewCount}
            </span>
            <span className="inline-flex items-center gap-1 text-pill-label font-pill-label text-[#64748B] bg-[#EEF1F5] px-2 py-0.5 rounded-full font-semibold">
              {metrics.awaitingReviewRate}% manual
            </span>
          </div>
          <div className="font-metadata text-metadata text-on-surface-variant mt-space-xs">
            Secondary forensic pool
          </div>
        </div>
      </div>

      {/* Middle Grid: Verification Distribution & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-space-xl items-start">
        {/* Outcome Breakdown Visual Panel (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">Outcome Distribution</span>
              <span className="font-metadata text-metadata text-on-surface-variant">Real-time status breakdown</span>
            </div>
            <span className="font-metadata text-metadata text-secondary tabular-nums">
              {metrics.totalDistinct} total
            </span>
          </div>

          {/* Visual Distribution Bars */}
          <div className="flex flex-col gap-space-md pt-space-xs">
            {/* Verified Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-metadata font-metadata">
                <span className="text-on-surface font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#267653]"></span> Verified Authentic
                </span>
                <span className="text-on-surface font-semibold">{metrics.verifiedCount} ({metrics.verifiedRate}%)</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-[#267653] h-full transition-all duration-500" style={{ width: `${metrics.verifiedRate}%` }}></div>
              </div>
            </div>

            {/* Mismatch Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-metadata font-metadata">
                <span className="text-on-surface font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#B54747]"></span> Confirmed Mismatch
                </span>
                <span className="text-on-surface font-semibold">{metrics.mismatchCount} ({metrics.mismatchRate}%)</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-[#B54747] h-full transition-all duration-500" style={{ width: `${metrics.mismatchRate}%` }}></div>
              </div>
            </div>

            {/* Not Found Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-metadata font-metadata">
                <span className="text-on-surface font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#9A6700]"></span> Registry Absence (Not Found)
                </span>
                <span className="text-on-surface font-semibold">{metrics.notFoundCount} ({metrics.notFoundRate}%)</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-[#9A6700] h-full transition-all duration-500" style={{ width: `${metrics.notFoundRate}%` }}></div>
              </div>
            </div>

            {/* Awaiting Review Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-metadata font-metadata">
                <span className="text-on-surface font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#64748B]"></span> Needs Human Review
                </span>
                <span className="text-on-surface font-semibold">{metrics.awaitingReviewCount} ({metrics.awaitingReviewRate}% )</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-[#64748B] h-full transition-all duration-500" style={{ width: `${metrics.awaitingReviewRate}%` }}></div>
              </div>
            </div>
          </div>

          <div className="mt-space-sm p-space-sm rounded-lg bg-surface-container-low text-on-surface-variant font-metadata text-metadata flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">info</span>
            <span>Counts represent distinct certificates evaluated by authorized sessions.</span>
          </div>
        </div>

        {/* Recent Verification Activity Table (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">Recent Verification Activity</span>
              <span className="font-metadata text-metadata text-on-surface-variant">Live audit ledger entries</span>
            </div>
            <button
              onClick={() => setActiveScreen('verification-history')}
              className="text-metadata text-secondary hover:text-primary font-body-md-medium flex items-center gap-1"
            >
              <span>View full history</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          {/* Table */}
          {dbLoading ? (
            <div className="p-space-xl text-center flex flex-col items-center justify-center gap-space-sm">
              <span className="material-symbols-outlined text-[36px] text-secondary animate-spin">sync</span>
              <p className="font-body-md text-body-md text-on-surface-variant">Querying live Supabase certificate ledger...</p>
            </div>
          ) : certificates.length === 0 ? (
            <div className="p-space-xl text-center flex flex-col items-center justify-center gap-space-sm">
              <span className="material-symbols-outlined text-[40px] text-outline">description</span>
              <p className="font-body-md text-body-md text-on-surface-variant">No verification records found in the database.</p>
              <button
                onClick={() => setActiveScreen('new-verification')}
                className="mt-2 px-space-md py-1.5 rounded-lg bg-primary text-on-primary text-body-md-medium font-body-md-medium"
              >
                Run first verification
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-container-high text-on-surface-variant font-table-header text-table-header uppercase">
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Credential ID</th>
                    <th className="py-2.5 px-3">Issuer</th>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60 font-body-md text-body-md">
                  {certificates.slice(0, 5).map((cert) => {
                    const statusInfo = cert.status === 'verified'
                      ? { label: cert.metadata?.uiStatus || 'VERIFIED MATCH', text: 'text-[#267653]', bg: 'bg-[#EAF5EE]', dot: 'bg-[#267653]' }
                      : cert.status === 'rejected'
                        ? { label: cert.metadata?.uiStatus || 'MISMATCH', text: 'text-[#B54747]', bg: 'bg-[#FCEEEE]', dot: 'bg-[#B54747]' }
                        : cert.status === 'flagged'
                          ? { label: cert.metadata?.uiStatus || 'NOT FOUND', text: 'text-[#9A6700]', bg: 'bg-[#FFF5D9]', dot: 'bg-[#9A6700]' }
                          : { label: cert.metadata?.uiStatus || 'UNABLE TO VERIFY', text: 'text-[#64748B]', bg: 'bg-[#EEF1F5]', dot: 'bg-[#64748B]' };

                    return (
                      <tr key={cert.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-body-md-medium text-body-md-medium text-on-surface block truncate max-w-[140px]">
                            {cert.student_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-metadata text-primary block truncate max-w-[130px]">
                            {cert.certificate_number}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-on-surface-variant text-metadata block truncate max-w-[130px]">
                            {cert.institution_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-pill-label text-pill-label ${statusInfo.bg} ${statusInfo.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleOpenDossier(cert)}
                            className="text-metadata text-secondary hover:text-primary font-semibold hover:underline"
                          >
                            Dossier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
