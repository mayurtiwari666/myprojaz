import { useState, useEffect } from 'react';
import { UploadCloud, Search, FileText, LogOut, Loader2, History, RotateCcw, ShieldCheck, Tag, X, Trash2, Folder } from 'lucide-react';
import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import Upload from './components/Upload';
import AdminDashboard from './components/AdminDashboard';
import FileCard from './components/FileCard';
import TagFilter from './components/TagFilter';
import PreviewModal from './components/PreviewModal';
import axios from 'axios';

const API_URL = import.meta.env.PROD ? "" : "http://localhost:8000";

// --- REFACTORED COMPONENT: Separating Auth from Content ---

function Dashboard({ user, signOut }) {
  const [activeTab, setActiveTab] = useState('browser');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchMode, setSearchMode] = useState('metadata');

  // Auth & RBAC State
  const [userGroups, setUserGroups] = useState([]);
  const [token, setToken] = useState(null);

  // Versioning State
  const [viewingVersions, setViewingVersions] = useState(null);
  const [versions, setVersions] = useState([]);

  // Tag & Preview State
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Bulk Selection State
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
  const [targetMovePath, setTargetMovePath] = useState('');

  // Storage Paths State
  const [storagePaths, setStoragePaths] = useState([]);
  const [selectedStoragePath, setSelectedStoragePath] = useState(null);

  const handleToggleSelect = (fileId) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(fileId)) {
      newSet.delete(fileId);
    } else {
      newSet.add(fileId);
    }
    setSelectedFileIds(newSet);
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleBulkTag = async (tagsToAdd) => {
    try {
      await axios.post(`${API_URL}/tags/bulk-assign`, {
        file_ids: Array.from(selectedFileIds),
        tags: tagsToAdd,
        mode: 'add'
      });

      // Optimistic Update
      setFiles(prev => prev.map(f => {
        if (selectedFileIds.has(f.file_id)) {
          const current = new Set(f.tags || []);
          tagsToAdd.forEach(t => current.add(t));
          return { ...f, tags: Array.from(current) };
        }
        return f;
      }));

      handleClearSelection();
      setIsBulkTagModalOpen(false);

      // Delay to allow backend consistency
      setTimeout(() => {
        fetchTags();
      }, 500);

      alert("Tags assigned to " + selectedFileIds.size + " files.");
    } catch (e) {
      console.error("Bulk tag failed", e);
      alert("Failed to assign tags");
    }
  };

  const handleBulkMove = async () => {
    try {
      await axios.post(`${API_URL}/storage-paths/bulk-assign`, {
        file_ids: Array.from(selectedFileIds),
        target_path: targetMovePath || null
      });

      // Optimistic Update
      const newPath = targetMovePath || null;
      setFiles(prev => prev.map(f =>
        selectedFileIds.has(f.file_id) ? { ...f, storage_path: newPath } : f
      ));

      // Update Search Results too
      if (searchResults) {
        setSearchResults(prev => prev.map(f =>
          selectedFileIds.has(f.file_id) ? { ...f, storage_path: newPath } : f
        ));
      }

      // Refresh if filtering by path
      if (selectedStoragePath) {
        setFiles(prev => prev.filter(f => !selectedFileIds.has(f.file_id)));
      } else {
        fetchFiles(activeTab === 'trash');
      }

      handleClearSelection();
      setIsBulkMoveModalOpen(false);
      setTargetMovePath('');

      fetchStoragePaths(); // Refresh counts

      alert(`Moved ${selectedFileIds.size} files.`);
    } catch (e) {
      console.error("Bulk move failed", e);
      alert("Failed to move files");
    }
  };

  const fetchTags = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/tags`);
      setAvailableTags(data);
    } catch (e) {
      console.error("Failed to fetch tags", e);
    }
  };

  const fetchStoragePaths = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/storage-paths`);
      setStoragePaths(data);
    } catch (e) {
      console.error("Failed to fetch storage paths", e);
    }
  };

  // ... (Other handlers same) ...

  const handlePreview = async (file) => {
    try {
      setPreviewFile(file);
      const { data } = await axios.get(`${API_URL}/files/${file.filename}/view`);
      setPreviewUrl(data.view_url);
    } catch (e) {
      console.error("Preview failed", e);
      setPreviewFile(null);
    }
  };

  const handleUpdateFileTags = (fileId, newTags) => {
    setFiles(prev => prev.map(f =>
      f.file_id === fileId ? { ...f, tags: newTags } : f
    ));
    if (searchResults) {
      setSearchResults(prev => prev.map(f =>
        f.file_id === fileId ? { ...f, tags: newTags } : f
      ));
    }
    fetchTags();
  };

  const handleDeleteFile = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      await axios.delete(`${API_URL}/files/${filename}`);

      // Remove from local state
      setFiles(prev => prev.filter(f => f.filename !== filename));
      if (searchResults) {
        setSearchResults(prev => prev.filter(f => f.filename !== filename));
      }
      // toast.success("File deleted"); // Assuming toast is available or just rely on UI update
    } catch (e) {
      console.error("Delete failed", e);
      alert("Failed to delete file");
    }
  };

  const handleDownloadFile = async (filename) => {
    try {
      const { data } = await axios.get(`${API_URL}/files/${filename}/download`);
      // Trigger download by opening in new tab
      window.open(data.download_url, '_blank');
    } catch (e) {
      console.error("Download failed", e);
      alert("Failed to get download link");
    }
  };

  // Setup Auth Session
  useEffect(() => {
    const getSession = async () => {
      try {
        // Get Token
        const session = await fetchAuthSession();
        const accessToken = session.tokens?.accessToken || session.tokens?.idToken;

        if (accessToken) {
          setToken(accessToken.toString());
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken.toString()}`;

          // Fetch roles
          try {
            // Use explicit backend resolution for attributes
            const userResp = await axios.get(`${API_URL}/auth/me`);
            let groups = userResp.data.groups || [];

            // Ensure it's an array
            if (!Array.isArray(groups)) {
              groups = [];
            }
            const username = userResp.data.username;

            console.log("Auth Success", { username, groups });

            // Log Login
            if (groups.length > 0) {
              axios.post(`${API_URL}/admin/log-login`, {
                username: username,
                source: 'web'
              }).catch(err => console.error("Login log", err));
            }

            setUserGroups(groups);

            // Set default tab
            if (groups.includes('Contributors') || groups.includes('Admins')) {
              setActiveTab('upload');
            } else {
              setActiveTab('browser');
            }

          } catch (backendErr) {
            console.error("Backend Auth Failed", backendErr);
          }
        }
      } catch (e) {
        console.error("Session error", e);
      }
    };

    // Run ONLY if user object exists (implies login)
    if (user) {
      getSession();
    }
  }, [user]);

  const isAdmin = userGroups.includes('Admins');
  const isContributor = userGroups.includes('Contributors') || isAdmin;

  const fetchFiles = async (isTrash = false) => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (isTrash) query.append('trash', 'true');
      if (selectedStoragePath) query.append('storage_path', selectedStoragePath);

      const { data } = await axios.get(`${API_URL}/files?${query.toString()}`);
      setFiles(data);
      setSearchResults(null);
    } catch (error) {
      console.error("Error fetching files", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFile = async (filename) => {
    try {
      await axios.post(`${API_URL}/files/${filename}/restore`);
      setFiles(prev => prev.filter(f => f.filename !== filename)); // Remove from trash list
    } catch (e) {
      console.error("Restore failed", e);
      alert("Failed to restore file");
    }
  };

  const handleDeletePermanent = async (filename) => {
    if (!window.confirm(`PERMANENTLY DELETE "${filename}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/files/${filename}/permanent`);
      setFiles(prev => prev.filter(f => f.filename !== filename));
    } catch (e) {
      console.error("Permanent delete failed", e);
      alert("Failed to delete permanently");
    }
  };

  // ... (Search logic same) ...

  const executeSearch = async (e) => {
    if (e.key === 'Enter') {
      if (!searchQuery.trim()) {
        fetchFiles();
        return;
      }
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/search?q=${searchQuery}`);
        setSearchResults(data);
      } catch (error) {
        console.error("Search failed", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchVersions = async (filename) => {
    if (viewingVersions === filename) {
      setViewingVersions(null);
      setVersions([]);
      return;
    }
    try {
      setViewingVersions(filename);
      const { data } = await axios.get(`${API_URL}/files/${filename}/versions`);
      setVersions(data);
    } catch (error) {
      console.error("Error fetching versions", error);
    }
  };

  useEffect(() => {
    if (activeTab === 'browser') {
      fetchFiles(false);
      fetchTags();
      fetchStoragePaths();
    } else if (activeTab === 'trash') {
      fetchFiles(true);
    }
  }, [activeTab, selectedStoragePath]);

  return (
    <div className="min-h-screen font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Navbar */}
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                  RnD Knowledge Hub
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-700">
                  {user?.attributes?.email || user?.username}
                </span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex gap-1">
                  {userGroups.length > 0 ? userGroups.join(', ') : 'Reader'}
                </span>
              </div>
              <button
                onClick={signOut}
                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tabs */}
        <div className="flex justify-center mb-12">
          <div className="glass p-1.5 rounded-2xl inline-flex shadow-lg shadow-gray-200/50">
            {[
              { id: 'upload', icon: UploadCloud, label: 'Upload', visible: isContributor },
              { id: 'browser', icon: Search, label: 'Search', visible: true },
              { id: 'trash', icon: Trash2, label: 'Trash', visible: isContributor },
              { id: 'admin', icon: ShieldCheck, label: 'Admin Hub', visible: isAdmin },
            ].filter(t => t.visible).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-xl scale-105'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="max-w-4xl mx-auto">
          <div className="transition-all duration-500 ease-in-out transform">
            {activeTab === 'upload' && isContributor && (
              <div className="glass p-10 rounded-[2.5rem] border border-white/50 shadow-2xl shadow-indigo-500/10">
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload Knowledge</h2>
                </div>
                <Upload onUploadSuccess={() => setActiveTab('browser')} />
              </div>
            )}

            {activeTab === 'browser' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-bold text-gray-900">Knowledge Base</h2>
                      {/* Storage Path Filter */}
                      <div className="relative">
                        <select
                          value={selectedStoragePath || ''}
                          onChange={(e) => setSelectedStoragePath(e.target.value || null)}
                          className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-10 pr-8 rounded-xl text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors cursor-pointer"
                        >
                          <option value="">All Storage Paths</option>
                          {storagePaths.map(path => (
                            <option key={path.path_name} value={path.path_name}>
                              {path.path_name} ({path.count || 0})
                            </option>
                          ))}
                        </select>
                        <Folder className="absolute left-3 top-2.5 w-4 h-4 text-indigo-500 pointer-events-none" />
                      </div>
                    </div>

                    {/* Search Mode Toggle */}
                    <div className="bg-gray-100 p-1 rounded-xl inline-flex">
                      <button
                        onClick={() => { setSearchMode('metadata'); setSearchResults(null); setSearchQuery(''); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${searchMode === 'metadata' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Normal Search
                      </button>
                      <button
                        onClick={() => { setSearchMode('semantic'); setSearchResults(null); setSearchQuery(''); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${searchMode === 'semantic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Semantic Search
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className={`w-5 h-5 absolute left-4 top-3.5 ${searchMode === 'semantic' ? "text-indigo-500" : "text-gray-400"}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                      }}
                      onKeyDown={searchMode === 'semantic' ? executeSearch : undefined}
                      placeholder={searchMode === 'semantic' ? "Ask a question about content... (Press Enter)" : "Filter by filename..."}
                      className={`pl-12 pr-6 py-3 border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 w-full transition-all text-gray-900 font-medium ${searchMode === 'semantic' ? "bg-indigo-50/50 focus:bg-white" : "bg-white/80"
                        }`}
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                    <p className="text-gray-500 animate-pulse">{searchMode === 'semantic' ? "Searching knowledge base..." : "Loading..."}</p>
                  </div>
                ) : (
                  <>
                    {/* Semantic Results */}
                    {searchMode === 'semantic' && searchResults && (
                      <div className="grid gap-4">
                        {searchResults.map((result, idx) => (
                          <div key={idx} className="glass-card p-6 rounded-2xl border-l-4 border-indigo-500">
                            <p className="text-gray-700 italic mb-4 leading-relaxed">"...{result.content}..."</p>
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 border-t border-gray-100 pt-3">
                              <span className="font-bold text-indigo-600 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {result.source}
                              </span>
                              <span>Relevance: {(result.score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                        {searchResults.length === 0 && (
                          <div className="text-center py-12 text-gray-500">
                            No relevant content found.
                          </div>
                        )}
                      </div>
                    )}

                    {/* File List (Metadata Search) */}
                    {searchMode === 'metadata' && (
                      <>
                        <TagFilter
                          availableTags={availableTags}
                          selectedTags={selectedTags}
                          onToggleTag={(tagName) => {
                            setSelectedTags(prev =>
                              prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
                            );
                          }}
                        />

                        <div className="grid gap-4">
                          {files
                            .filter(f => {
                              // Filename Search
                              const nameMatch = f.filename.toLowerCase().includes(searchQuery.toLowerCase());
                              // Tag Filter
                              const tagMatch = selectedTags.length === 0 || selectedTags.some(t => f.tags?.includes(t));
                              return nameMatch && tagMatch;
                            })
                            .map((file) => (
                              <FileCard
                                key={file.file_id}
                                file={file}
                                viewingVersions={viewingVersions}
                                versions={versions}
                                onPreview={handlePreview}
                                onFetchVersions={fetchVersions}
                                availableTags={availableTags}
                                onUpdateFileTags={handleUpdateFileTags}
                                isContributor={isContributor}
                                onDelete={handleDeleteFile}
                                onDownload={handleDownloadFile}
                                isSelected={selectedFileIds.has(file.file_id)}
                                onToggleSelect={handleToggleSelect}
                              />
                            ))}

                          {files.length === 0 && !loading && (
                            <div className="text-center py-20 glass rounded-3xl border-dashed border-2 border-gray-200">
                              <p className="text-gray-500 font-medium">No files found.</p>
                            </div>
                          )}
                        </div>

                        {/* BULK ACTION BAR */}
                        {selectedFileIds.size > 0 && isContributor && (
                          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white backdrop-blur-md px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300 border border-white/10">
                            <span className="font-bold text-sm tracking-wide">{selectedFileIds.size} Selected</span>

                            <div className="h-4 w-px bg-gray-700"></div>

                            <button
                              onClick={() => setIsBulkMoveModalOpen(true)}
                              className="flex items-center gap-2 text-sm font-semibold hover:text-indigo-400 transition-colors"
                            >
                              <Folder className="w-4 h-4" />
                              Move
                            </button>

                            <button
                              onClick={() => setIsBulkTagModalOpen(true)}
                              className="flex items-center gap-2 text-sm font-semibold hover:text-indigo-400 transition-colors"
                            >
                              <Tag className="w-4 h-4" />
                              Add Tags
                            </button>

                            <button
                              onClick={handleClearSelection}
                              className="p-1 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* BULK MOVE MODAL */}
                        {isBulkMoveModalOpen && (
                          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsBulkMoveModalOpen(false)}></div>
                            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200">
                              <h3 className="text-xl font-bold mb-4 text-gray-900">Move {selectedFileIds.size} files</h3>
                              <p className="text-sm text-gray-500 mb-6">Select a destination storage path.</p>

                              <div className="mb-6 space-y-4">
                                <label className="block text-sm font-medium text-gray-700">Storage Path</label>
                                <select
                                  value={targetMovePath}
                                  onChange={(e) => setTargetMovePath(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                >
                                  <option value="">Move to Root (No Path)</option>
                                  {storagePaths.map(path => (
                                    <option key={path.path_name} value={path.path_name}>{path.path_name}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex gap-3">
                                <button
                                  onClick={() => setIsBulkMoveModalOpen(false)}
                                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleBulkMove}
                                  className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors"
                                >
                                  Move Files
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* BULK TAG MODAL */}
                        {isBulkTagModalOpen && (
                          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsBulkTagModalOpen(false)}></div>
                            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200">
                              <h3 className="text-xl font-bold mb-4 text-gray-900">Add Tags to {selectedFileIds.size} files</h3>
                              <p className="text-sm text-gray-500 mb-6">Select tags to assign. These will be added to existing tags.</p>

                              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto mb-6">
                                {availableTags.map(tag => (
                                  <button
                                    key={tag.name}
                                    onClick={() => handleBulkTag([tag.name])}
                                    className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-indigo-200 transition-all group text-left"
                                  >
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: tag.color }}></div>
                                    <span className="font-medium text-gray-700 group-hover:text-indigo-700">{tag.name}</span>
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setIsBulkTagModalOpen(false)}
                                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'trash' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-2 bg-red-100 rounded-lg text-red-600">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    Trash Bin
                  </h2>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
                    <p className="text-gray-500">Loading trash...</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {files.map((file) => (
                      <FileCard
                        key={file.file_id}
                        file={file}
                        viewingVersions={null}
                        versions={[]}
                        onPreview={() => { }}
                        onFetchVersions={() => { }}
                        availableTags={[]}
                        onUpdateFileTags={() => { }}
                        isContributor={isContributor}
                        onDelete={handleDeletePermanent}
                        onDownload={() => { }}
                        isTrash={true}
                        onRestore={handleRestoreFile}
                      />
                    ))}
                    {files.length === 0 && (
                      <div className="text-center py-20 glass rounded-3xl border-dashed border-2 border-gray-200">
                        <p className="text-gray-500 font-medium">Trash is empty. All safe!</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Admin Tab */}
            {activeTab === 'admin' && isAdmin && (
              <div className="max-w-6xl mx-auto">
                <AdminDashboard />
              </div>
            )}

          </div>
        </div>

      </main>

      <PreviewModal
        file={previewFile}
        url={previewUrl}
        onClose={() => { setPreviewFile(null); setPreviewUrl(null); }}
      />
    </div>
  );
}

// --- APP WRAPPER ---

function App() {
  return (
    <Authenticator
      hideSignUp={true}
      loginMechanisms={['username']}
      components={{
        Header: () => (
          <div className="flex flex-col items-center gap-3 p-8">
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl shadow-xl shadow-indigo-500/20">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
              RnD Knowledge Hub
            </h1>
            <p className="text-gray-500 font-medium">Secure Access Portal</p>
          </div>
        )
      }}
    >
      {({ signOut, user }) => (
        <Dashboard user={user} signOut={signOut} />
      )}
    </Authenticator>
  );
}

export default App;
