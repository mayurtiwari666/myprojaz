
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, Trash2, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.PROD ? "" : "http://localhost:8000";

export default function StoragePathManager() {
    const [paths, setPaths] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newPathName, setNewPathName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchPaths = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_URL}/storage-paths`);
            setPaths(data);
        } catch (error) {
            console.error("Failed to fetch paths", error);
            toast.error("Could not load storage paths");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaths();
    }, []);

    const handleCreatePath = async (e) => {
        e.preventDefault();
        if (!newPathName.trim()) return;

        try {
            setCreating(true);
            await axios.post(`${API_URL}/storage-paths`, {
                path_name: newPathName,
                description: newDescription
            });
            toast.success("Storage Path created");
            setNewPathName('');
            setNewDescription('');
            fetchPaths();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create path (might already exist)");
        } finally {
            setCreating(false);
        }
    };

    const handleDeletePath = async (pathName) => {
        if (!confirm(`Are you sure you want to delete path "${pathName}"?`)) return;

        // Encode path to handle special characters like "/" or spaces
        const encodedPath = encodeURIComponent(pathName);

        try {
            await axios.delete(`${API_URL}/storage-paths/${encodedPath}`);
            toast.success("Path deleted");
            fetchPaths();
        } catch (error) {
            console.error("Delete Error:", error);
            const detail = error.response?.data?.detail || "";

            // Check for "non-empty" in error message
            if (error.response?.status === 400 && (detail.includes("non-empty") || detail.includes("force"))) {
                if (confirm(`Path "${pathName}" contains files.\n\nDo you want to MOVE these files to the main list (Root) and delete this folder?`)) {
                    try {
                        console.log(`Force deleting ${pathName}...`);
                        await axios.delete(`${API_URL}/storage-paths/${encodedPath}?force=true`);
                        toast.success("Path deleted (files moved to root)");
                        fetchPaths();
                        return;
                    } catch (forceError) {
                        console.error("Force Delete Failed:", forceError);
                        toast.error("Force delete failed: " + (forceError.response?.data?.detail || forceError.message));
                    }
                }
            } else {
                toast.error(detail || "Failed to delete path");
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Folder className="w-5 h-5 text-indigo-600" />
                        Storage Paths
                    </h3>
                    <p className="text-sm text-gray-500">Create virtual folders to organize documents (e.g., "Finance/2024").</p>
                </div>
                <button
                    onClick={fetchPaths}
                    className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-50 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Create Form */}
            <form onSubmit={handleCreatePath} className="flex gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200/60 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Path Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Finance/Reports"
                        value={newPathName}
                        onChange={(e) => setNewPathName(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description (Optional)</label>
                    <input
                        type="text"
                        placeholder="e.g. Q4 Financial Reports"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={creating || !newPathName}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mb-0.5"
                >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create
                </button>
            </form>

            {/* Paths Table */}
            <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {paths.map((path) => (
                            <tr key={path.path_name} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-bold text-gray-900 font-mono">{path.path_name}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {path.description || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {path.count || 0} docs
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleDeletePath(path.path_name)}
                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                        title={path.count > 0 ? "Cannot delete non-empty path" : "Delete"}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {paths.length === 0 && !loading && (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-400 italic">
                                    No paths defined. Create one above!
                                </td>
                            </tr>
                        )}
                        {loading && paths.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
