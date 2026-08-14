'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

// TODO: Note for pre-launch cleanup: clear test teacher accounts before production launch.

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  subdomain: string;
  plan: string;
  status: 'active' | 'suspended' | 'invited' | string;
  created_at: string;
}

export default function TeachersManagementPage() {
  const toast = useToast();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePlan, setInvitePlan] = useState<'free' | 'basic' | 'pro'>('basic');
  const [isInviting, setIsInviting] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null);
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (planFilter !== 'all') params.set('plan', planFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/teachers?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load teachers list (${res.status})`);
      }
      const data = await res.json();
      setTeachers(data.teachers || []);
    } catch (err: any) {
      console.error('Error loading teachers:', err);
      setError(err.message || 'Failed to fetch teachers from database');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, statusFilter]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // Toggle Suspend / Reactivate
  const toggleSuspendTeacher = async (teacher: TeacherRow) => {
    const newStatus = teacher.status === 'active' ? 'suspended' : 'active';
    try {
      setActionLoadingId(teacher.id);
      const res = await fetch('/api/admin/teachers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teacher.id, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update teacher status.');
      }

      toast(
        `Teacher ${teacher.name} has been ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.`,
        newStatus === 'suspended' ? 'error' : 'success'
      );
      await fetchTeachers();
    } catch (err: any) {
      console.error('Error suspending teacher:', err);
      toast(err.message || 'Error updating status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Submit Invite Teacher
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast('Please provide both name and email.', 'error');
      return;
    }

    try {
      setIsInviting(true);
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          plan: invitePlan,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to invite teacher.');
      }

      toast(`Teacher invited with status 'invited'. (Email invitation will be sent once Resend is active).`, 'success');
      setIsInviteModalOpen(false);
      setInviteName('');
      setInviteEmail('');
      await fetchTeachers();
    } catch (err: any) {
      console.error('Error inviting teacher:', err);
      toast(err.message || 'Failed to send invite', 'error');
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Plan Change
  const handleChangePlan = async (newPlan: 'free' | 'basic' | 'pro') => {
    if (!selectedTeacher) return;
    try {
      setActionLoadingId(selectedTeacher.id);
      const res = await fetch('/api/admin/teachers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTeacher.id, plan: newPlan }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update plan.');
      }

      toast(`Plan for ${selectedTeacher.name} updated to ${newPlan.toUpperCase()}.`, 'success');
      setIsChangePlanModalOpen(false);
      setSelectedTeacher(null);
      await fetchTeachers();
    } catch (err: any) {
      toast(err.message || 'Error updating plan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatJoinedDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 pb-12 font-inter">
      {/* Header & Invite Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white flex items-center gap-2.5">
            Teacher Accounts Management
          </h1>
          <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-1">
            Real Supabase teacher records. Assign subscription tiers, suspend accounts, and invite new educators.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchTeachers}
            disabled={loading}
            className="px-3 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-light-mint hover:bg-gray-50 text-xs font-semibold transition flex items-center gap-1.5"
            title="Refresh database records"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2.5 rounded-card bg-primary-teal hover:bg-primary-teal/90 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            + Invite Teacher
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchTeachers} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or subdomain..."
            className="w-full pl-9 pr-4 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-teal transition"
          />
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-text-dark/40 dark:text-light-mint/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-text-dark/50 dark:text-light-mint/50 font-semibold">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white font-medium focus:outline-none"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-text-dark/50 dark:text-light-mint/50 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white font-medium focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Teachers Table Card */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between text-xs text-text-dark/60 dark:text-light-mint/60">
          <span>Showing <strong className="text-deep-teal dark:text-white">{teachers.length}</strong> teachers</span>
          <span>Sorted by recent registration date (created_at DESC)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 font-semibold text-text-dark/60 dark:text-light-mint/60 uppercase tracking-wider">
                <th className="py-3 px-4">Teacher Name & Subdomain</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Subscription Plan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-text-dark/40 dark:text-light-mint/40 animate-pulse">
                    Loading real teachers from Supabase database...
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-text-dark/40 dark:text-light-mint/40">
                    No teacher records found matching criteria.
                  </td>
                </tr>
              ) : (
                teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-deep-teal text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'T'}
                        </div>
                        <div>
                          <p className="font-bold text-deep-teal dark:text-white">{t.name}</p>
                          <p className="text-[11px] font-mono text-primary-teal">
                            {t.subdomain}.examly.com
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-text-dark/80 dark:text-light-mint font-mono">
                      {t.email}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge color={t.plan?.toLowerCase() === 'pro' ? 'gold' : t.plan?.toLowerCase() === 'basic' ? 'teal' : 'gray'}>
                        {(t.plan || 'free').toUpperCase()} Plan
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      {t.status === 'active' ? (
                        <Badge color="green">Active</Badge>
                      ) : t.status === 'invited' ? (
                        <Badge color="gold">Invited</Badge>
                      ) : (
                        <Badge color="red">Suspended</Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-text-dark/60 dark:text-light-mint/60 font-mono">
                      {formatJoinedDate(t.created_at)}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      {/* View details button */}
                      <button
                        onClick={() => {
                          setSelectedTeacher(t);
                          setIsDetailsModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-gray-100 dark:bg-white/10 text-text-dark/80 dark:text-light-mint hover:bg-gray-200 text-[11px] font-semibold transition"
                      >
                        Details
                      </button>

                      {/* Change Plan button */}
                      <button
                        onClick={() => {
                          setSelectedTeacher(t);
                          setIsChangePlanModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded border border-primary-teal text-primary-teal hover:bg-primary-teal hover:text-white text-[11px] font-semibold transition"
                      >
                        Plan
                      </button>

                      {/* Suspend / Reactivate Toggle */}
                      <button
                        onClick={() => toggleSuspendTeacher(t)}
                        disabled={actionLoadingId === t.id}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition disabled:opacity-50 ${
                          t.status === 'active'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {actionLoadingId === t.id ? 'Saving...' : t.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: + Invite Teacher Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface max-w-md w-full rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-primary-teal/20 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
              <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Educator
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-text-dark/40 hover:text-text-dark dark:text-light-mint/40 dark:hover:text-light-mint"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 rounded-card bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-medium">
              ℹ️ <strong>Note:</strong> Creating this record will assign status <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded">invited</code>. Automatic email invitation link delivery will be enabled once Resend integration is connected.
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep-teal dark:text-light-mint mb-1.5">
                  Teacher Full Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Prof. Charles Xavier"
                  required
                  className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep-teal dark:text-light-mint mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="charles.xavier@mutant-test.edu"
                  required
                  className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep-teal dark:text-light-mint mb-1.5">
                  Initial Plan Assignment
                </label>
                <select
                  value={invitePlan}
                  onChange={(e) => setInvitePlan(e.target.value as 'free' | 'basic' | 'pro')}
                  className="w-full px-4 py-2.5 rounded-card border border-gray-300 dark:border-white/10 bg-white dark:bg-deep-teal text-text-dark dark:text-white text-xs focus:outline-none"
                >
                  <option value="free">Free Plan (Trial)</option>
                  <option value="basic">Basic Plan ($15/mo)</option>
                  <option value="pro">Pro Plan ($29/mo)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-card text-xs font-semibold text-text-dark/60 dark:text-light-mint/60 hover:text-text-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-6 py-2.5 rounded-card bg-primary-teal text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isInviting ? 'Inviting...' : 'Create Invited Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Change Plan Modal */}
      {isChangePlanModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface max-w-sm w-full rounded-2xl p-6 space-y-6 shadow-2xl border border-primary-teal/20">
            <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">
              Change Plan for {selectedTeacher.name}
            </h3>
            <p className="text-xs text-text-dark/60 dark:text-light-mint/70">
              Current Plan: <span className="font-bold text-primary-teal">{selectedTeacher.plan.toUpperCase()}</span>
            </p>

            <div className="space-y-2">
              {(['free', 'basic', 'pro'] as ('free' | 'basic' | 'pro')[]).map((plan) => (
                <button
                  key={plan}
                  onClick={() => handleChangePlan(plan)}
                  className={`w-full p-3 rounded-card text-xs font-bold border transition flex justify-between items-center ${
                    selectedTeacher.plan.toLowerCase() === plan
                      ? 'border-primary-teal bg-primary-teal/10 text-primary-teal'
                      : 'border-gray-200 dark:border-white/10 text-deep-teal dark:text-white hover:border-primary-teal/50'
                  }`}
                >
                  <span>{plan.toUpperCase()} Tier</span>
                  {selectedTeacher.plan.toLowerCase() === plan && <span>(Current)</span>}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsChangePlanModalOpen(false)}
              className="w-full py-2 text-xs font-semibold text-text-dark/50 dark:text-light-mint/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Modal 3: View Teacher Details */}
      {isDetailsModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface max-w-md w-full rounded-2xl p-6 space-y-6 shadow-2xl border border-primary-teal/20">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4">
              <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">
                Teacher Account Details
              </h3>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-text-dark/40 hover:text-text-dark">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-dark/50">Full Name</span>
                <span className="font-bold text-deep-teal dark:text-white">{selectedTeacher.name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-dark/50">Email</span>
                <span className="font-mono text-deep-teal dark:text-white">{selectedTeacher.email}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-dark/50">Custom Subdomain</span>
                <span className="font-mono text-primary-teal">{selectedTeacher.subdomain}.examly.com</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-dark/50">Plan</span>
                <Badge color={selectedTeacher.plan.toLowerCase() === 'pro' ? 'gold' : 'teal'}>{selectedTeacher.plan.toUpperCase()} Plan</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-dark/50">Status</span>
                <Badge color={selectedTeacher.status === 'active' ? 'green' : selectedTeacher.status === 'invited' ? 'gold' : 'red'}>
                  {selectedTeacher.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-dark/50">Registration Date</span>
                <span className="font-mono text-deep-teal dark:text-white">{formatJoinedDate(selectedTeacher.created_at)}</span>
              </div>
            </div>

            <button
              onClick={() => setIsDetailsModalOpen(false)}
              className="w-full py-2.5 rounded-card bg-primary-teal text-white font-bold text-xs"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
