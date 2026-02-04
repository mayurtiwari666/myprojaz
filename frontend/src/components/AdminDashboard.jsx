import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity, Users, Database, AlertCircle,
    BarChart2, Clock
} from 'lucide-react';
import TagManager from './TagManager';

const API_URL = import.meta.env.PROD ? "" : "http://localhost:8000";

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState(null);

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/stats`);
            setStats(res.data);
        } catch (err) {
            console.error("Stats fetch failed", err);
            // Don't set global error for stats if others might work, but maybe show a warning
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/users`);
            setUsers(res.data);
        } catch (err) {
            console.error("Users fetch failed", err);
            setError(prev => `${prev ? prev + ' ' : ''}Users API: ${err.message}.`);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/audit-logs`);
            setLogs(res.data);
        } catch (err) {
            console.error("Logs fetch failed", err);
            setError(prev => `${prev ? prev + ' ' : ''}Logs API: ${err.message}.`);
        }
    };

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            setError(null);
            await Promise.allSettled([fetchStats(), fetchUsers(), fetchLogs()]);
            setLoading(false);
        };
        loadAll();
    }, []);

    const handleExport = async () => {
        try {
            const response = await axios.get(`${API_URL}/admin/export-audit`, {
                responseType: 'blob', // Important for file download
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (e) {
            console.error("Export failed", e);
            alert("Failed to export audit logs. Check console.");
        }
    };

    if (loading) return (
        <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Admin Hub</h2>
                    <p className="text-gray-500 mt-1">System Observability & User Management</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700 font-bold">
                                Error connecting to backend:
                            </p>
                            <p className="text-sm text-red-600">
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Audit Logs
                </button>
                <button
                    onClick={() => setActiveTab('tags')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'tags' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Tags
                </button>
            </div>
            {/* Content Switcher */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <StatCard icon={Users} label="Active Users" value={stats?.online_users_count || 0} color="emerald" />
                        <StatCard icon={Database} label="Storage Used" value={stats?.storage_used || "0 KB"} color="purple" />
                    </div>

                    {/* Active Users List (Embedded in Overview) */}
                    <div className="glass p-8 rounded-[2rem] border border-white/50 shadow-xl shadow-indigo-500/5">
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" />
                            User Directory
                        </h3>
                        <div className="overflow-hidden rounded-xl border border-gray-100">
                            <table className="min-w-full bg-white/50 backdrop-blur-sm">
                                <thead className="bg-gray-50/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Username</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map((u) => {
                                        const isOnline = stats?.online_users_list?.includes(u.username);
                                        return (
                                            <tr key={u.username} className="hover:bg-indigo-50/30">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.username}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${isOnline
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-gray-50 text-gray-500 border-gray-100'
                                                        }`}>
                                                        {isOnline ? '● Online' : '○ Offline'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{u.groups.join(', ') || 'Reader'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )
            }

            {
                activeTab === 'audit' && (
                    <div className="glass p-8 rounded-[2rem] border border-white/50 shadow-xl shadow-indigo-500/5">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-indigo-500" />
                                Audit Trail
                            </h3>
                            <button onClick={handleExport} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 flex items-center gap-2">
                                Download CSV
                            </button>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-gray-100">
                            <table className="min-w-full bg-white/50 backdrop-blur-sm">
                                <thead className="bg-gray-50/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {logs.map((log) => (
                                        <tr key={log.event_id} className="hover:bg-indigo-50/30">
                                            <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.user || 'anonymous'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 text-xs font-bold rounded-md ${log.method === 'LOGIN' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {log.method} {log.path}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{log.details || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
            {
                activeTab === 'tags' && (
                    <TagManager />
                )
            }
        </div >
    );
}

function StatCard({ icon: Icon, label, value, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        purple: 'bg-purple-50 text-purple-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className="glass p-6 rounded-2xl border border-white/50 shadow-lg hover:scale-105 transition-transform duration-300">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                    <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
                </div>
            </div>
        </div>
    );
}
