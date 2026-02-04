import { useState } from 'react';
import axios from 'axios';
import { UploadCloud, File, CheckCircle, Loader2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = "http://localhost:8000";

export default function Upload({ onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("idle"); // idle, uploading, success, error
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus("idle");
            setProgress(0);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        try {
            setStatus("uploading");
            setProgress(10);

            // 1. Get Presigned URL from Backend
            const { data } = await axios.post(`${API_URL}/files/upload-url`, null, {
                params: {
                    filename: file.name,
                    content_type: file.type
                }
            });

            const { upload_url } = data;
            setProgress(30);

            // 2. Upload directly to S3 (Using fetch to avoid Axios interceptors)
            const uploadResponse = await fetch(upload_url, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type
                },
                body: file
            });

            if (!uploadResponse.ok) {
                throw new Error(`S3 Upload Failed: ${uploadResponse.statusText}`);
            }

            setProgress(85);

            // 3. Confirm Ingestion to Backend (Save Metadata)
            await axios.post(`${API_URL}/files/ingest`, {
                file_id: file.name, // Use name as ID for now
                filename: file.name,
                content_type: file.type,
                size: file.size,
                upload_url: upload_url.split('?')[0] // Store clean URL
            });
            setProgress(100);

            setStatus("success");
            toast.success("File Uploaded Successfully!");

            setTimeout(() => {
                setStatus("idle");
                setFile(null);
                setProgress(0);
                if (onUploadSuccess) onUploadSuccess();
            }, 1500);

        } catch (error) {
            console.error("Upload Error:", error);
            setStatus("error");
            toast.error(`Upload failed: ${error.message}`);
            setProgress(0);
        }
    };

    return (
        <div className="w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                Upload Document
            </h3>

            {/* Drop Zone */}
            <div className="relative group border-2 border-dashed border-gray-300 rounded-2xl p-8 hover:bg-gray-50 transition-colors">
                <input
                    type="file"
                    onChange={handleFileChange}
                    disabled={status === "uploading"}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                />

                <div className={`transition-opacity duration-300 ${status === 'uploading' ? 'opacity-50' : ''}`}>
                    {!file ? (
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">Click to upload or drag & drop</p>
                            <p className="text-xs text-gray-500 mt-2">PDF, TXT, CSV (Max 100MB)</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative z-20">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <File className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>
                            {status !== 'uploading' && status !== 'success' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setFile(null);
                                        setStatus("idle");
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors relative z-50"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {status === "uploading" && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                        <span>Uploading...</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Success Message */}
            {status === "success" && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
                    <CheckCircle className="w-4 h-4" />
                    File Uploaded & Indexed!
                </div>
            )}

            {/* Upload Button */}
            <button
                onClick={handleUpload}
                disabled={!file || status === "uploading" || status === "success"}
                className={`mt-6 w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2
                    ${!file || status === "uploading" || status === "success"
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-gray-900 to-black text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}
                `}
            >
                {status === "uploading" ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    "Upload File"
                )}
            </button>
        </div>
    );
}
