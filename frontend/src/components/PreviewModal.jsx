import { X, ExternalLink } from 'lucide-react';

export default function PreviewModal({ file, url, onClose }) {
    if (!file || !url) return null;

    const isPDF = file.filename.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.filename);
    const isText = /\.(txt|csv|md|json)$/i.test(file.filename);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white/90 backdrop-blur-xl w-full max-w-5xl h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-white/50 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/50 bg-white/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{file.filename}</h3>
                        <p className="text-xs text-gray-500">Preview Mode</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Open in New Tab"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 bg-gray-50/50 relative">
                    {isPDF ? (
                        <iframe
                            src={url}
                            className="w-full h-full"
                            title="PDF Preview"
                        ></iframe>
                    ) : isImage ? (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <img src={url} alt={file.filename} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                        </div>
                    ) : isText ? (
                        <iframe
                            src={url}
                            className="w-full h-full bg-white"
                            title="Text Preview"
                        ></iframe>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p>Preview not available for this file type.</p>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                            >
                                Download to View
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
