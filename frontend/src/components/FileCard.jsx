import { useState } from 'react';
import { FileText, History, Eye, Tag, Plus, RotateCcw, ChevronDown, Check, Trash2, Download, Shield, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.PROD ? "" : "http://localhost:8000";

export default function FileCard({ file, viewingVersions, versions, onPreview, onFetchVersions, availableTags, onUpdateFileTags, isContributor, onDelete, onDownload, isTrash, onRestore, isSelected, onToggleSelect }) {
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [showPii, setShowPii] = useState(false);

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
        <div className={`glass-card p-5 rounded-2xl flex flex-col group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 border ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-transparent hover:border-indigo-100'} ${isTagDropdownOpen ? 'relative z-30' : 'relative z-0'}`}>

            {/* CHECKBOX: Contributor Only, Not Trash, Top-Left */}
            {!isTrash && isContributor && (
                <div className="absolute top-4 left-4 z-20">
                    <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => onToggleSelect(file.file_id)}
                        className="w-5 h-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm opacity-0 group-hover:opacity-100 transition-opacity data-[checked=true]:opacity-100"
                        data-checked={!!isSelected}
                    />
                </div>
            )}

            <div className="flex items-start justify-between w-full pl-8"> {/* Added padding-left to avoid overlap */}
                <div className="flex items-start gap-5">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>

                    {/* Info */}
                    <div>
                        <h4 className="font-bold text-gray-900 text-lg line-clamp-1">{file.filename}</h4>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">

                            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>

                            {/* PII Warning */}

                            {/* PII Toggle */}
                            {file.status === 'indexed' && (
                                <div className="flex items-center">
                                    {file.pii_flags && file.pii_flags.length > 0 ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowPii(!showPii); }}
                                            className={`flex items-center gap-0.5 px-1 py-0 rounded text-[7px] font-bold border transition-colors leading-none h-4 ${showPii
                                                ? 'bg-red-50 text-red-600 border-red-200'
                                                : 'bg-white text-gray-400 border-gray-100 hover:border-red-200 hover:text-red-500 hover:bg-red-50/50'
                                                }`}
                                        >
                                            <ShieldAlert className="w-2 h-2" />
                                            {showPii ? 'Hide' : 'PII'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-400 border border-gray-100 bg-gray-50/50">
                                            <Shield className="w-3 h-3" />
                                            No PII
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Expanded PII Details */}
                            {showPii && Array.isArray(file.pii_flags) && file.pii_flags.length > 0 && (
                                <div className="w-full mt-2 p-2 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 animate-in slide-in-from-top-1">
                                    <p className="font-bold mb-1">Sensitive Data Found:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {file.pii_flags.map((flag, i) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-white rounded border border-red-200 text-[10px]">
                                                {flag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tag Chips */}
                            {Array.isArray(file.tags) && file.tags.map(tagName => {
                                const tagInfo = (Array.isArray(availableTags) ? availableTags : []).find(t => t.name === tagName);
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
                    {/* TRASH MODE ACTIONS */}
                    {isTrash ? (
                        <>
                            <button
                                onClick={() => onRestore(file.filename)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all flex items-center gap-2"
                                title="Restore File"
                            >
                                <RotateCcw className="w-5 h-5" />
                                <span className="text-xs font-bold hidden group-hover:block">RESTORE</span>
                            </button>
                            <button
                                onClick={() => onDelete(file.filename)}
                                className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all flex items-center gap-2"
                                title="Delete Forever"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span className="text-xs font-bold hidden group-hover:block">FOREVER</span>
                            </button>
                        </>
                    ) : (
                        /* NORMAL MODE ACTIONS */
                        <>
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
                                                {availableTags && Array.isArray(availableTags) && availableTags.length === 0 ? (
                                                    <p className="text-xs text-gray-500 px-2 py-2 italic text-center">No tags created yet.</p>
                                                ) : (
                                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                                        {Array.isArray(availableTags) && availableTags.map(tag => {
                                                            const isSelected = Array.isArray(file.tags) && file.tags.includes(tag.name);
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
                        </>
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
                        {Array.isArray(versions) && versions.map((v) => (
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
