import { Tag, X } from 'lucide-react';

export default function TagFilter({ availableTags, selectedTags, onToggleTag }) {
    if (!availableTags || availableTags.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-4 animate-in fade-in duration-300">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mr-2">
                <Tag className="w-3 h-3" /> Filters
            </span>

            {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                    <button
                        key={tag.name}
                        onClick={() => onToggleTag(tag.name)}
                        className={`
                            px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border flex items-center gap-1.5
                            ${isSelected
                                ? 'bg-gray-900 text-white border-gray-900 shadow-lg scale-105'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                        `}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                        ></span>
                        {tag.name}
                        {isSelected && <X className="w-3 h-3 ml-1" />}
                    </button>
                );
            })}

            {selectedTags.length > 0 && (
                <button
                    onClick={() => selectedTags.forEach(t => onToggleTag(t))}
                    className="ml-2 text-xs text-red-500 hover:text-red-700 font-medium underline decoration-red-200 hover:decoration-red-500"
                >
                    Clear All
                </button>
            )}
        </div>
    );
}
