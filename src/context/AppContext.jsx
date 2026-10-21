import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { isUnresolvedReviewItem, isResolvedReviewItem } from '../lib/reviewEligibility.js';

const AppContext = createContext();

// Safely purge stale demo/mock items from previous sessions if present in localStorage
try {
  const cached = localStorage.getItem('certisure_certificates');
  if (cached) {
    const items = JSON.parse(cached);
    if (Array.isArray(items) && items.some(c => c.id === 'cert-101' || c.certificate_number === 'STAN-ML-99201-X')) {
      localStorage.removeItem('certisure_certificates');
    }
  }
} catch (e) {
  localStorage.removeItem('certisure_certificates');
}

export function AppProvider({ children }) {
  // Navigation State
  const [activeScreen, setActiveScreen] = useState('overview'); // overview, new-verification, approval-gate, agent-activity, verification-result, verification-history, review-queue, test-lab, settings

  // Authentication State
  const [user, setUser] = useState({
    id: null,
    email: null,
    name: 'Authorized User',
    role: 'Enterprise Recruiter',
    isDemo: true,
  });
  const [authSession, setAuthSession] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'

  // Real Database Data State (starts empty when no live records exist, or restores guest session)
  const [certificates, setCertificates] = useState(() => {
    try {
      const cached = sessionStorage.getItem('certisure_guest_certificates');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [authRequired, setAuthRequired] = useState(false);

  // Current active verification workflow payload with sessionStorage persistence
  const [currentVerification, _setCurrentVerification] = useState(() => {
    try {
      const stored = sessionStorage.getItem('certisure_current_verification');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setCurrentVerification = (val) => {
    _setCurrentVerification(val);
    try {
      if (val) {
        sessionStorage.setItem('certisure_current_verification', JSON.stringify(val));
      } else {
        sessionStorage.removeItem('certisure_current_verification');
      }
    } catch (e) {
      console.warn('[SessionStorage Warning]', e);
    }
  };

  const [activeTrace, setActiveTrace] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [timeRangeFilter, setTimeRangeFilter] = useState('30d');
  const [serverHealth, setServerHealth] = useState(null);

  // Load Real Data from Supabase
  const loadSupabaseData = async (userId = null) => {
    if (!userId) {
      // In Guest Mode (no user ID), Supabase RLS returns empty array or permission error.
      // Retain the guest session certificates from sessionStorage / in-memory state.
      try {
        const stored = sessionStorage.getItem('certisure_guest_certificates');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCertificates(parsed);
          }
        }
      } catch (e) {
        console.warn('[SessionStorage Warning]', e);
      }
      setVerificationHistory([]);
      setDbLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setCertificates([]);
      setVerificationHistory([]);
      setDbLoading(false);
      return;
    }

    try {
      setDbLoading(true);
      setDbError(null);

      // Query real tables from Supabase
      let certsQuery = supabase
        .from('certificates')
        .select('*')
        .order('created_at', { ascending: false });

      let historyQuery = supabase
        .from('verification_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        certsQuery = certsQuery.eq('user_id', userId);
        historyQuery = historyQuery.eq('user_id', userId);
      }

      const [certsRes, historyRes] = await Promise.all([certsQuery, historyQuery]);

      if (historyRes.error) {
        console.warn('[Supabase Verification History Query Error]', historyRes.error);
        setVerificationHistory([]);
      } else {
        setVerificationHistory(historyRes.data || []);
      }

      if (certsRes.error) {
        console.warn('[Supabase Certificates Query Error]', certsRes.error);
        if (certsRes.error.code === 'PGRST301' || certsRes.error.message?.includes('JWT') || certsRes.error.message?.includes('permission')) {
          setAuthRequired(true);
        }
        setDbError(certsRes.error.message);
        // Do not silently overwrite valid session certificates if DB read fails
      } else {
        // Build map of verification history details by certificate_id
        const historyMap = {};
        (historyRes.data || []).forEach(h => {
          if (h.certificate_id && !historyMap[h.certificate_id]) {
            historyMap[h.certificate_id] = h;
          }
        });

        // Enrich certificates with verification history details so full report metadata is available
        const enriched = (certsRes.data || []).map(cert => {
          const hist = historyMap[cert.id];
          return {
            ...cert,
            review_decision: cert.review_decision || hist?.details?.review_decision || null,
            review_notes: cert.review_notes || hist?.details?.review_notes || null,
            reviewed_by: cert.reviewed_by || hist?.details?.reviewed_by || null,
            reviewed_at: cert.reviewed_at || hist?.details?.reviewed_at || null,
            metadata: {
              ...(cert.metadata || {}),
              ...(hist?.details || {})
            }
          };
        });

        setCertificates(enriched);
        setDbError(null);
      }
    } catch (err) {
      console.error('[Supabase load error]', err);
      setDbError(err.message);
    } finally {
      setDbLoading(false);
    }
  };

  // Check Supabase Auth session on mount and load live database records
  useEffect(() => {
    let isMounted = true;

    async function initializeAuthAndData() {
      if (!isSupabaseConfigured || !supabase) {
        if (isMounted) {
          setCertificates([]);
          setVerificationHistory([]);
          setDbLoading(false);
        }
        return;
      }

      try {
        setDbLoading(true);
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

        if (session?.user) {
          if (isMounted) {
            setAuthSession(session);
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
              role: 'Enterprise Recruiter',
              isDemo: false,
            });
            setAuthRequired(false);
          }
          await loadSupabaseData(session.user.id);
        } else {
          if (isMounted) {
            setAuthSession(null);
            setUser({
              id: null,
              email: null,
              name: 'Authorized User',
              role: 'Enterprise Recruiter',
              isDemo: true,
            });
          }
          // Fetch from Supabase as unauthenticated session (RLS enforced)
          await loadSupabaseData(null);
        }
      } catch (err) {
        console.warn('[Supabase Session Init Warning]', err);
        if (isMounted) {
          setDbError(err.message);
          setCertificates([]);
          setVerificationHistory([]);
        }
      } finally {
        if (isMounted) {
          setDbLoading(false);
        }
      }
    }

    initializeAuthAndData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setAuthSession(session);
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          role: 'Enterprise Recruiter',
          isDemo: false,
        });
        setAuthRequired(false);
        await loadSupabaseData(session.user.id);
      } else {
        setAuthSession(null);
        setUser({
          id: null,
          email: null,
          name: 'Authorized User',
          role: 'Enterprise Recruiter',
          isDemo: true,
        });
        await loadSupabaseData(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch Server Health
  const refreshServerHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setServerHealth(data);
      return data;
    } catch (err) {
      console.warn('[App] Server health check warning:', err);
      return null;
    }
  };

  useEffect(() => {
    refreshServerHealth();
  }, []);

  // Supabase Realtime Subscription: listens for changes to certificates for authenticated user
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user?.id) {
      return;
    }

    const channelName = `realtime-certificates-${user.id}`;
    const certsChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'certificates',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Supabase Realtime Certificate Change]', payload);
          loadSupabaseData(user.id);
        }
      )
      .subscribe((status) => {
        console.log(`[Supabase Realtime Channel: ${channelName}] Status:`, status);
      });

    return () => {
      supabase.removeChannel(certsChannel);
    };
  }, [user?.id]);

  // Screen Change Refetch Fallback: guarantees fresh statistics when returning to screens
  useEffect(() => {
    if (['overview', 'settings', 'verification-history', 'review-queue'].includes(activeScreen)) {
      if (user?.id) {
        loadSupabaseData(user.id);
      }
    }
  }, [activeScreen, user?.id]);

  // Sign In Handler
  const handleSignIn = async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo login
      setUser({
        id: 'recruiter-demo-uuid',
        email,
        name: email.split('@')[0],
        role: 'Authorized Recruiter (Demo Mode)',
        isDemo: true,
      });
      setAuthModalOpen(false);
      return { success: true };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.session) {
      setAuthSession(data.session);
    }
    setUser({
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
      role: 'Enterprise Recruiter',
      isDemo: false,
    });
    setAuthRequired(false);
    setAuthModalOpen(false);
    await loadSupabaseData(data.user.id);
    return { success: true, user: data.user };
  };

  // Sign Up Handler
  const handleSignUp = async (email, password, fullName) => {
    if (!isSupabaseConfigured || !supabase) {
      setUser({
        id: 'recruiter-new-uuid',
        email,
        name: fullName || email.split('@')[0],
        role: 'Authorized Recruiter (Demo Mode)',
        isDemo: true,
      });
      setAuthModalOpen(false);
      return { success: true };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    if (data.user) {
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: fullName || data.user.email.split('@')[0],
        role: 'Enterprise Recruiter',
        isDemo: false,
      });
    }
    setAuthModalOpen(false);
    return { success: true, user: data.user };
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser({
      id: null,
      email: null,
      name: 'Authorized User',
      role: 'Enterprise Recruiter',
      isDemo: true,
    });
    setAuthSession(null);
    setCertificates([]);
    setVerificationHistory([]);
    try {
      sessionStorage.removeItem('certisure_guest_certificates');
    } catch (e) {
      console.warn('[SessionStorage Warning]', e);
    }
  };

  // Add / Save Verified Record to State & Supabase
  // Returns { certRecord, persistenceWarning } where persistenceWarning is a non-empty string
  // when the result was NOT persisted to Supabase (so callers can surface it in the UI).
  const saveVerificationResult = async (result, inputData) => {
    const isAuthenticated = Boolean(authSession?.user);
    const currentUserId = authSession?.user?.id || null;

    // Always keep the current result accessible in the workflow (sessionStorage-backed)
    setCurrentVerification(result);

    const reportDetails = {
      requestId: result.requestId || `REQ-${Date.now()}`,
      proofHash: result.proofHash,
      confidenceScore: result.confidenceScore,
      comparisonMatrix: result.comparisonMatrix || [],
      sourceUrl: result.sourceUrl,
      sourceType: result.sourceType,
      verificationMethod: result.verificationMethod,
      outcome: result.outcome,
      uiStatus: result.uiStatus,
      explanation: result.explanation,
      aiForensicSummary: result.aiForensicSummary || result.explanation,
      stages: result.stages || [],
      logs: result.logs || [],
      candidateNameSubmitted: result.candidateNameSubmitted,
      credentialId: result.credentialId,
      issuer: result.issuer,
      courseTitle: result.courseTitle,
      issueDate: result.issueDate,
      filePath: inputData?.filePath || null,
      previewUrl: inputData?.previewUrl || null,
      consentGranted: Boolean(inputData?.consentGranted),
      consentTimestamp: inputData?.consentTimestamp || new Date().toISOString(),
    };

    const newCertRecord = {
      id: `cert-${Date.now()}`,
      certificate_number: result.credentialId,
      student_name: result.candidateNameSubmitted,
      institution_name: result.issuer,
      course_name: result.courseTitle || null,
      issue_date: result.issueDate ? result.issueDate : null,
      status: ['verified', 'rejected', 'flagged', 'pending'].includes(result.dbStatus)
        ? result.dbStatus
        : (result.outcome === 'Verified' ? 'verified' : result.outcome === 'Mismatch' ? 'rejected' : result.outcome === 'Not Found' ? 'flagged' : 'pending'),
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      metadata: reportDetails
    };

    // Guest session — skip DB write and return a clear warning.
    if (!isSupabaseConfigured || !supabase || !isAuthenticated) {
      const warning = 'Result not saved — sign in to persist records.';
      setDbError(null); // no DB error, just unauthenticated
      setCurrentVerification({ ...result, persistenceWarning: warning });

      // In guest mode, maintain session certificates so eligible review items appear in the queue
      setCertificates(prev => {
        const existingIdx = prev.findIndex(c =>
          (newCertRecord.certificate_number && c.certificate_number === newCertRecord.certificate_number) ||
          (newCertRecord.id && c.id === newCertRecord.id)
        );
        let updated;
        if (existingIdx >= 0) {
          updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], ...newCertRecord };
        } else {
          updated = [newCertRecord, ...prev];
        }
        try {
          sessionStorage.setItem('certisure_guest_certificates', JSON.stringify(updated));
        } catch (e) {
          console.warn('[SessionStorage Warning]', e);
        }
        return updated;
      });

      return { certRecord: newCertRecord, persistenceWarning: warning };
    }

    // Authenticated session — attempt Supabase persistence.
    try {
      const certDbRow = {
        certificate_number: newCertRecord.certificate_number,
        student_name: newCertRecord.student_name,
        institution_name: newCertRecord.institution_name,
        course_name: newCertRecord.course_name,
        issue_date: newCertRecord.issue_date,
        status: newCertRecord.status,
        user_id: authSession.user.id,
      };

      const { data: certData, error: certErr } = await supabase
        .from('certificates')
        .upsert(certDbRow, { onConflict: 'certificate_number' })
        .select()
        .single();

      if (certErr) {
        console.error('[Supabase Certificates Upsert Error]', certErr);
        const warning = `Verification result could not be saved: ${certErr.message}`;
        setDbError(certErr.message);
        setCurrentVerification({ ...result, persistenceWarning: warning });
        return { certRecord: newCertRecord, persistenceWarning: warning };
      }

      if (!certData) {
        const warning = 'Supabase did not confirm the write. Record may not be persisted.';
        setDbError(warning);
        setCurrentVerification({ ...result, persistenceWarning: warning });
        return { certRecord: newCertRecord, persistenceWarning: warning };
      }

      newCertRecord.id = certData.id;

      const { error: histErr } = await supabase.from('verification_history').insert({
        certificate_id: certData.id,
        verification_status: result.outcome || 'Verified',
        verification_method: result.verificationMethod || 'Registry Ledger SHA-256 Digest',
        user_id: authSession.user.id,
        details: reportDetails
      });

      if (histErr) {
        console.error('[Supabase Verification History Save Error]', histErr);
        // Certificate was saved; only the audit trail insert failed — still a partial success.
        const warning = `Audit trail entry could not be saved: ${histErr.message}`;
        setDbError(histErr.message);
        setCurrentVerification({ ...result, persistenceWarning: warning });
        // Authoritative refresh so counts reflect the persisted certificate
        await loadSupabaseData(authSession.user.id);
        return { certRecord: newCertRecord, persistenceWarning: warning };
      }

      setDbError(null);
      // Authoritative refresh: synchronize context with confirmed Supabase records
      await loadSupabaseData(authSession.user.id);
      return { certRecord: newCertRecord, persistenceWarning: null };
    } catch (err) {
      console.error('[Supabase Persistence Error]', err);
      const warning = `Verification result could not be saved: ${err.message}`;
      setDbError(err.message);
      setCurrentVerification({ ...result, persistenceWarning: warning });
      return { certRecord: newCertRecord, persistenceWarning: warning };
    }
  };


  // Review Queue Adjudication Handler
  const handleReviewDecision = async (certId, decision, notes) => {
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return { success: false, error: 'Valid adjudication decision (APPROVED or REJECTED) is required.' };
    }
    if (!notes || !notes.trim()) {
      return { success: false, error: 'Reviewer justification notes are required for compliance.' };
    }

    const reviewerName = user?.name || 'Enterprise Recruiter';
    const timestamp = new Date().toISOString();
    const newStatus = decision === 'APPROVED' ? 'verified' : 'rejected';

    let updatedRecord = null;

    // 1. Update in-memory state
    setCertificates(prev => {
      const nextList = prev.map(c => {
        if (c.id === certId || c.certificate_number === certId) {
          updatedRecord = {
            ...c,
            status: newStatus,
            review_decision: decision,
            review_notes: notes.trim(),
            reviewed_by: reviewerName,
            reviewed_at: timestamp,
            metadata: {
              ...c.metadata,
              outcome: decision === 'APPROVED' ? 'Verified (Human Adjudicated)' : 'Mismatch (Human Adjudicated)',
              humanReviewer: reviewerName,
              humanNotes: notes.trim(),
              adjudicationTimestamp: timestamp,
            }
          };
          return updatedRecord;
        }
        return c;
      });

      if (!isAuthenticated) {
        try {
          sessionStorage.setItem('certisure_guest_certificates', JSON.stringify(nextList));
        } catch (e) {
          console.warn('[SessionStorage Warning]', e);
        }
      }
      return nextList;
    });

    const targetCert = certificates.find(c => c.id === certId || c.certificate_number === certId);
    const effectiveCert = updatedRecord || (targetCert ? {
      ...targetCert,
      status: newStatus,
      review_decision: decision,
      review_notes: notes.trim(),
      reviewed_by: reviewerName,
      reviewed_at: timestamp,
    } : null);

    if (!effectiveCert) {
      return { success: false, error: `Certificate '${certId}' not found in active review queue.` };
    }

    // 2. Persist to Supabase if authenticated session exists
    const isAuthenticated = Boolean(authSession?.user);
    if (isSupabaseConfigured && supabase && isAuthenticated) {
      try {
        let certUpdateErr = null;

        // Try updating full record on certificates table
        const fullUpdate = await supabase
          .from('certificates')
          .update({
            status: newStatus,
            review_decision: decision,
            review_notes: notes.trim(),
            reviewed_by: reviewerName,
            reviewed_at: timestamp,
          })
          .eq('id', effectiveCert.id);

        if (fullUpdate.error) {
          if (fullUpdate.error.code === 'PGRST204' || fullUpdate.error.message?.includes('review_decision')) {
            // Column does not exist in schema: update core status column
            const statusUpdate = await supabase
              .from('certificates')
              .update({ status: newStatus })
              .eq('id', effectiveCert.id);
            if (statusUpdate.error) certUpdateErr = statusUpdate.error;
          } else {
            certUpdateErr = fullUpdate.error;
          }
        }

        if (certUpdateErr) {
          console.error('[Supabase Review Update Error]', certUpdateErr);
          setDbError(certUpdateErr.message);
          return { success: false, error: `Database update failed: ${certUpdateErr.message}` };
        }

        // Always append immutable audit log to verification_history
        const { error: histErr } = await supabase
          .from('verification_history')
          .insert({
            certificate_id: effectiveCert.id,
            verification_status: decision === 'APPROVED' ? 'Verified (Human Adjudicated)' : 'Mismatch (Human Adjudicated)',
            verification_method: 'Human-in-the-Loop Adjudication',
            user_id: authSession.user.id,
            details: {
              review_decision: decision,
              review_notes: notes.trim(),
              reviewed_by: reviewerName,
              reviewed_at: timestamp,
              outcome: decision === 'APPROVED' ? 'Verified (Human Adjudicated)' : 'Mismatch (Human Adjudicated)',
              humanReviewer: reviewerName,
              humanNotes: notes.trim(),
              adjudication: true,
              priorStatus: targetCert?.status || 'pending',
            }
          });

        if (histErr) {
          console.warn('[Supabase Review History Warning]', histErr);
        }

        // Authoritative refresh to ensure synchronization
        await loadSupabaseData(authSession.user.id);
        setDbError(null);
        return { success: true, certRecord: effectiveCert, persisted: true };
      } catch (err) {
        console.error('[Supabase Adjudication Exception]', err);
        setDbError(err.message);
        return { success: false, error: `Persistence error: ${err.message}` };
      }
    }

    // Unauthenticated / Demo mode: commit to local session
    return {
      success: true,
      certRecord: effectiveCert,
      persisted: false,
      warning: 'Adjudication saved in local session. Sign in to commit records to permanent Supabase history.'
    };
  };

  // Computed Metrics (Distinct Certificates)
  const totalDistinct = certificates.length;
  const verifiedCount = certificates.filter(c => c.status === 'verified').length;
  const mismatchCount = certificates.filter(c => c.status === 'rejected').length;
  const notFoundCount = certificates.filter(c => c.status === 'flagged').length;
  const awaitingReviewCount = certificates.filter(isUnresolvedReviewItem).length;

  const verifiedRate = totalDistinct > 0 ? ((verifiedCount / totalDistinct) * 100).toFixed(1) : '0.0';
  const mismatchRate = totalDistinct > 0 ? ((mismatchCount / totalDistinct) * 100).toFixed(1) : '0.0';
  const notFoundRate = totalDistinct > 0 ? ((notFoundCount / totalDistinct) * 100).toFixed(1) : '0.0';
  const awaitingReviewRate = totalDistinct > 0 ? ((awaitingReviewCount / totalDistinct) * 100).toFixed(1) : '0.0';

  return (
    <AppContext.Provider value={{
      activeScreen,
      setActiveScreen,
      user,
      authSession,
      authModalOpen,
      setAuthModalOpen,
      authMode,
      setAuthMode,
      handleSignIn,
      handleSignUp,
      handleSignOut,
      certificates,
      currentVerification,
      setCurrentVerification,
      activeTrace,
      setActiveTrace,
      selectedReviewId,
      setSelectedReviewId,
      timeRangeFilter,
      setTimeRangeFilter,
      serverHealth,
      refreshServerHealth,
      saveVerificationResult,
      handleReviewDecision,
      verificationHistory,
      dbLoading,
      dbError,
      authRequired,
      loadSupabaseData,
      metrics: {
        totalDistinct,
        verifiedCount,
        mismatchCount,
        notFoundCount,
        awaitingReviewCount,
        verifiedRate,
        mismatchRate,
        notFoundRate,
        awaitingReviewRate,
      }
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
