import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminSeriesForm } from '../components/admin/AdminSeriesForm';
import { AdminSeriesList } from '../components/admin/AdminSeriesList';
import { adminApi } from '../api/admin';
import { User } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

type Tab = 'series' | 'users';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('series');
  const [showForm, setShowForm] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
    enabled: activeTab === 'users',
  });

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    try {
      await adminApi.resetPassword(userId, newPassword);
      setResetMsg('Password reset successfully');
      setResetError('');
      setResetUserId('');
      setNewPassword('');
    } catch {
      setResetError('Failed to reset password');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <span className="text-xs bg-nba-red text-white px-3 py-1 rounded-full font-bold">Admin</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['series', 'users'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-nba-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'series' ? '🏀 Series Management' : '👥 User Management'}
          </button>
        ))}
      </div>

      {activeTab === 'series' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Playoff Series</h2>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary"
            >
              {showForm ? 'Hide Form' : '+ Add Series'}
            </button>
          </div>

          {showForm && <AdminSeriesForm onCreated={() => setShowForm(false)} />}

          <AdminSeriesList />
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Users</h2>

          {resetMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
              {resetMsg}
            </div>
          )}
          {resetError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
              {resetError}
            </div>
          )}

          {usersLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Username</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Joined</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u: User) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.displayName}</td>
                      <td className="px-4 py-3 text-gray-500">@{u.username}</td>
                      <td className="px-4 py-3">
                        {u.isAdmin ? (
                          <span className="text-xs bg-nba-red text-white px-2 py-0.5 rounded-full">Admin</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Member</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {resetUserId === u.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="password"
                              placeholder="New password (min 8)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="input text-xs py-1 px-2 w-40"
                            />
                            <button
                              onClick={() => handleResetPassword(u.id)}
                              className="btn-sm bg-nba-blue text-white hover:bg-blue-800"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setResetUserId(''); setNewPassword(''); }}
                              className="btn-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setResetUserId(u.id); setResetMsg(''); setResetError(''); }}
                            className="btn-sm bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          >
                            Reset Password
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
