import { useState } from 'react';
import { FileText, History, Eye, Tag, Plus, RotateCcw, ChevronDown, Check, Trash2, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = "http://localhost:8000";

export default function FileCard({ file, viewingVersions, versions, onPreview, onFetchVersions, availableTags, onUpdateFileTags, isContributor, onDelete, onDownload }) {
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    const handleAssignTag = async (tagName) => {
        try {
            const currentTags = file.tags || [];
            let newTags;
            // Toggle logic
            if (currentTags.includes(tagName)) {
                newTags = currentTags.filter(t => t !== tagName);
            } else {
                newTags = [...currentTags, tagName];
            }

            await axios.post(`${API_URL}/tags/assign`, {
                file_id: file.file_id,
                tags: newTags
            });

            // Optimistic Update
            onUpdateFileTags(file.file_id, newTags);
            toast.success(`Tags updated`);
        } catch (error) {
            console.error("Tag update failed", error);
            toast.error("Failed to update tag");
        }
    };

    return (
        <div className={`glass-card p-5 rounded-2xl flex flex-col group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 border border-transparent hover:border-indigo-100 ${isTagDropdownOpen ? 'relative z-30' : 'relative z-0'}`}>
            <div className="flex items-start justify-between w-full">
                <div className="flex items-start gap-5">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>

                    {/* Info */}
                    <div>
                        <h4 className="font-bold text-gray-900 text-lg line-clamp-1">{file.filename}</h4>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs font-medium text-gray-500 px-2 py-0.5 bg-gray-100 rounded-md">v1.0</span>
                            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>

                            {/* Tag Chips */}
                            {file.tags && file.tags.map(tagName => {
                                const tagInfo = availableTags.find(t => t.name === tagName);
                                return (
                                    <span
                                        key={tagName}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-700 shadow-sm border border-black/5"
                                        style={{ backgroundColor: tagInfo?.color || '#e5e7eb' }}
                                    >
                                        {tagName}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Preview Button */}
                    <button
                        onClick={() => onPreview(file)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Quick Look"
                    >
                        <Eye className="w-5 h-5" />
                    </button>

                    {/* Download Button (Contributors/Admins) */}
                    {isContributor && (
                        <button
                            onClick={() => onDownload(file.filename)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Download File"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}

                    {/* Versions Button (Contributors/Admins only) */}
                    {isContributor && (
                        <button
                            onClick={() => onFetchVersions(file.filename)}
                            className={`p-2 rounded-lg transition-all ${viewingVersions === file.filename ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="View History"
                        >
                            <History className="w-5 h-5" />
                        </button>
                    )}

                    {/* Delete Button (Contributors/Admins) */}
                    {isContributor && (
                        <button
                            onClick={() => onDelete(file.filename)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete File"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}

                    {/* Tags Dropdown - RESTRICTED TO CONTRIBUTORS */}
                    {isContributor && (
                        <div className="relative">
                            <button
                                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                                className={`p-2 rounded-lg transition-all ${isTagDropdownOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                                title="Manage Tags"
                            >
                                <Tag className="w-5 h-5" />
                            </button>

                            {isTagDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsTagDropdownOpen(false)}
                                    ></div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                                        <h6 className="text-xs font-bold text-gray-400 uppercase px-2 py-1 mb-1">Assign Tags</h6>
                                        {availableTags.length === 0 ? (
                                            <p className="text-xs text-gray-500 px-2 py-2 italic text-center">No tags created yet.</p>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto space-y-1">
                                                {availableTags.map(tag => {
                                                    const isSelected = file.tags?.includes(tag.name);
                                                    return (
                                                        <button
                                                            key={tag.name}
                                                            onClick={() => handleAssignTag(tag.name)}
                                                            className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-between group/item"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></div>
                                                                <span className="text-gray-700 font-medium">{tag.name}</span>
                                                            </div>
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Version History Drawer */}
            {viewingVersions === file.filename && (
                <div className="mt-4 pt-4 border-t border-gray-100 pl-16 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <History className="w-3 h-3" /> Version History
                    </h5>
                    <div className="space-y-2">
                        {versions.map((v) => (
                            <div key={v.version_id} className="flex justify-between items-center text-sm p-3 bg-white/50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${v.is_latest ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                                    <span className="font-medium text-gray-700">
                                        {v.is_latest ? 'Current Version' : 'Previous Version'}
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                        {new Date(v.last_modified).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-mono text-gray-400">{(v.size / 1024).toFixed(1)} KB</span>
                                    {!v.is_latest && (
                                        <button className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1">
                                            <RotateCcw className="w-3 h-3" /> Restore
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {versions.length === 0 && <p className="text-xs text-gray-400 italic">No history found.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
