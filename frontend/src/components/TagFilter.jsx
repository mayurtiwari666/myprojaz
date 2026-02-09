import { Tag, X, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function TagFilter({ availableTags, selectedTags, onToggleTag }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!availableTags || availableTags.length === 0) return null;

    const selectedCount = selectedTags.length;

    return (
        <div className="relative mb-6" ref={dropdownRef}>
            <div className="flex items-center gap-2">
                {/* Trigger Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-gray-200 shadow-sm
                        ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-400' : 'hover:border-indigo-300 hover:bg-gray-50'}
                        ${selectedCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-700'}
                    `}
                >
                    <Tag className="w-4 h-4" />
                    <span>Filter by Tags</span>
                    {selectedCount > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                            {selectedCount}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Clear Button */}
                {selectedCount > 0 && (
                    <button
                        onClick={() => selectedTags.forEach(t => onToggleTag(t))}
                        className="text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        Clear
                    </button>
                )}
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                    <div className="max-h-60 overflow-y-auto space-y-1 p-1">
                        {Array.isArray(availableTags) && availableTags.map((tag) => {
                            const isSelected = Array.isArray(selectedTags) && selectedTags.includes(tag.name);
                            return (
                                <button
                                    key={tag.name}
                                    onClick={() => onToggleTag(tag.name)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group
                                        ${isSelected ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-gray-50 text-gray-700'}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Checkbox */}
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                                            ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}
                                        `}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>

                                        {/* Color & Name */}
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></div>
                                            <span>{tag.name}</span>
                                        </div>
                                    </div>

                                    {/* Count */}
                                    <span className={`text-xs ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`}>
                                        ({tag.count || 0})
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
