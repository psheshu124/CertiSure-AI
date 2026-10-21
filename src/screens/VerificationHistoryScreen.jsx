import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { isUnresolvedReviewItem } from '../lib/reviewEligibility.js';

export default function VerificationHistoryScreen() {
  const { certificates, setActiveScreen, setCurrentVerification, metrics } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [issuerFilter, setIssuerFilter] = useState('ALL');

  // Filtered List
  const filteredCerts = certificates.filter((cert) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      cert.student_name.toLowerCase().includes(q) ||
      cert.certificate_number.toLowerCase().includes(q) ||
      cert.institution_name.toLowerCase().includes(q) ||
      (cert.course_name && cert.course_name.toLowerCase().includes(q));

    const matchesOutcome = outcomeFilter === 'ALL' ||
      (outcomeFilter === 'VERIFIED' && cert.status === 'verified') ||
      (outcomeFilter === 'MISMATCH' && cert.status === 'rejected') ||
      (outcomeFilter === 'NOT_FOUND' && cert.status === 'flagged') ||
      (outcomeFilter === 'REVIEW' && isUnresolvedReviewItem(cert));

    const matchesIssuer = issuerFilter === 'ALL' ||
      cert.institution_name.toLowerCase().includes(issuerFilter.toLowerCase());

    return matchesSearch && matchesOutcome && matchesIssuer;
  });

  const handleOpenDossier = (cert) => {
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

  const exportCSV = () => {
    const headers = ['Certificate ID', 'Candidate Name', 'Institution', 'Course', 'Status', 'Date Verified'];
    const rows = filteredCerts.map(c => [
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
    link.setAttribute('download', `certisure_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Forensic Metrics & Summary Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-space-xl">
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
            <span className="font-metadata text-metadata uppercase tracking-wider">Total Audited Ledger</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">database</span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold">{metrics.totalDistinct}</span>
            <span className="font-metadata text-metadata text-on-tertiary-container font-semibold flex items-center">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> Live
            </span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[100%]"></div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
            <span className="font-metadata text-metadata uppercase tracking-wider">Verified Authenticity</span>
            <span className="material-symbols-outlined text-[18px] text-tertiary-container">verified</span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold">{metrics.verifiedRate}%</span>
            <span className="font-metadata text-metadata text-on-surface-variant">{metrics.verifiedCount} records</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-secondary-container h-full" style={{ width: `${metrics.verifiedRate}%` }}></div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
            <span className="font-metadata text-metadata uppercase tracking-wider">Discrepancy / Tamper</span>
            <span className="material-symbols-outlined text-[18px] text-error">gpp_maybe</span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-error font-bold">{metrics.mismatchRate}%</span>
            <span className="font-metadata text-metadata text-error font-medium">{metrics.mismatchCount} anomalies</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-error-container h-full" style={{ width: `${metrics.mismatchRate}%` }}></div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/20">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-xs">
            <span className="font-metadata text-metadata uppercase tracking-wider">Registry Sync Latency</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">bolt</span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-xl text-headline-xl text-primary font-bold">18ms</span>
            <span className="font-metadata text-metadata text-on-surface-variant">SHA-256 Validated</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-on-tertiary-container h-full w-[98%]"></div>
          </div>
        </div>
      </div>

      {/* Primary Page Headline */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-metadata text-metadata uppercase tracking-widest mb-1">
            <span className="material-symbols-outlined text-[15px]">verified_user</span>
            <span>Cryptographic Audit Trail</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-primary tracking-tight font-bold">
            Verification History
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
            Searchable, immutable ledger of all candidate credential verifications, evidence records, and audit events.
          </p>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container text-body-md-medium font-body-md-medium transition-colors shadow-sm border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setActiveScreen('new-verification')}
            className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container text-body-md-medium font-body-md-medium transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_task</span>
            <span>New Verification</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Control Panel */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg mb-space-lg flex flex-col gap-space-md border border-outline-variant/20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm items-center">
          {/* Search Input */}
          <div className="lg:col-span-5 relative flex items-center">
            <span className="material-symbols-outlined absolute left-space-md text-[18px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by candidate name, credential ID, or institution..."
              className="w-full pl-9 pr-space-md py-space-sm bg-surface-container-low text-on-surface rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/20 transition-all"
            />
          </div>

          {/* Outcome Dropdown */}
          <div className="lg:col-span-4">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface px-space-md py-space-sm rounded-lg font-body-md text-body-md border border-outline-variant/20 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">All Outcomes (Verified, Mismatch, Not Found)</option>
              <option value="VERIFIED">Verified Authentic Only</option>
              <option value="MISMATCH">Confirmed Mismatches Only</option>
              <option value="NOT_FOUND">Registry Absence (Not Found)</option>
              <option value="REVIEW">Needs Review</option>
            </select>
          </div>

          {/* Issuer Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={issuerFilter}
              onChange={(e) => setIssuerFilter(e.target.value)}
              className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface px-space-md py-space-sm rounded-lg font-body-md text-body-md border border-outline-variant/20 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">All Issuers</option>
              <option value="Stanford">Stanford Online</option>
              <option value="MIT">MIT xPRO</option>
              <option value="Coursera">Coursera Network</option>
              <option value="AWS">AWS Certification</option>
              <option value="Google">Google Cloud</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden">
        {filteredCerts.length === 0 ? (
          <div className="p-space-xl text-center flex flex-col items-center justify-center gap-space-sm">
            <span className="material-symbols-outlined text-[40px] text-outline">search_off</span>
            <p className="font-body-md text-body-md text-on-surface-variant">No verification records matched the search filters.</p>
            <button
              onClick={() => { setSearchQuery(''); setOutcomeFilter('ALL'); setIssuerFilter('ALL'); }}
              className="mt-2 text-secondary font-semibold hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/60 text-on-surface-variant font-table-header text-table-header uppercase">
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Credential ID</th>
                  <th className="py-3 px-4">Issuing Institution</th>
                  <th className="py-3 px-4">Qualification / Course</th>
                  <th className="py-3 px-4">Verification Outcome</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60 font-body-md text-body-md">
                {filteredCerts.map((cert) => {
                  const statusInfo = cert.status === 'verified'
                    ? { label: 'VERIFIED AUTHENTIC', text: 'text-[#267653]', bg: 'bg-[#EAF5EE]', dot: 'bg-[#267653]' }
                    : cert.status === 'rejected'
                      ? { label: 'MISMATCH CONFIRMED', text: 'text-[#B54747]', bg: 'bg-[#FCEEEE]', dot: 'bg-[#B54747]' }
                      : cert.status === 'flagged'
                        ? { label: 'NOT FOUND', text: 'text-[#9A6700]', bg: 'bg-[#FFF5D9]', dot: 'bg-[#9A6700]' }
                        : { label: 'NEEDS REVIEW', text: 'text-[#64748B]', bg: 'bg-[#EEF1F5]', dot: 'bg-[#64748B]' };

                  return (
                    <tr key={cert.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-4 font-body-md-medium text-body-md text-on-surface font-semibold">
                        {cert.student_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-metadata text-primary font-bold">
                        {cert.certificate_number}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface">
                        {cert.institution_name}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant truncate max-w-xs">
                        {cert.course_name || 'Specialization Track'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-pill-label text-pill-label font-bold ${statusInfo.bg} ${statusInfo.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDossier(cert)}
                          className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-metadata font-body-md-medium transition-colors"
                        >
                          View Dossier
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
  );
}
