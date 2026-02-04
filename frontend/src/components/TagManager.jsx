import { useState, useEffect } from 'react';
import axios from 'axios';
import { Tag, Trash2, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.PROD ? "" : "http://localhost:8000";

const PRESET_COLORS = [
    '#72dbc8', // Teal (Develop)
    '#df8194', // Pink (Finance)
    '#2aa95c', // Green (Sales)
    '#a855f7', // Purple
    '#60a5fa', // Blue
    '#f59e0b', // Amber
];

export default function TagManager() {
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
    const [creating, setCreating] = useState(false);

    const fetchTags = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_URL}/tags`);
            setTags(data);
        } catch (error) {
            console.error("Failed to fetch tags", error);
            toast.error("Could not load tags");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTags();
    }, []);

    const handleCreateTag = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            setCreating(true);
            await axios.post(`${API_URL}/tags`, {
                name: newName,
                color: selectedColor
            });
            toast.success("Tag created");
            setNewName('');
            fetchTags();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create tag");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteTag = async (tagName) => {
        if (!confirm(`Are you sure you want to delete tag "${tagName}"?`)) return;
        try {
            await axios.delete(`${API_URL}/tags/${tagName}`);
            toast.success("Tag deleted");
            fetchTags();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete tag");
        }
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-indigo-600" />
                        Tag Management
                    </h3>
                    <p className="text-sm text-gray-500">Create and manage colored tags for documents.</p>
                </div>
                <button
                    onClick={fetchTags}
                    className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-50 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Create Form */}
            <form onSubmit={handleCreateTag} className="flex gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                <input
                    type="text"
                    placeholder="New tag name..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />

                <div className="flex items-center gap-2">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${selectedColor === color ? 'border-gray-600 scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>

                <button
                    type="submit"
                    disabled={creating || !newName}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create
                </button>
            </form>

            {/* Tags Table */}
            <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {tags.map((tag) => (
                            <tr key={tag.name} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-bold text-gray-900">{tag.name}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: tag.color }}></div>
                                        <span className="text-xs text-gray-500 font-mono">{tag.color}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {tag.count} docs
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleDeleteTag(tag.name)}
                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tags.length === 0 && !loading && (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-400 italic">
                                    No tags defined. Create one above!
                                </td>
                            </tr>
                        )}
                        {loading && tags.length === 0 && (
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
