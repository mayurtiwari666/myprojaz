import { useState, useEffect } from 'react';
import { UploadCloud, Search, FileText, LogOut, Loader2, History, RotateCcw, ShieldCheck } from 'lucide-react';
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

  const fetchTags = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/tags`);
      setAvailableTags(data);
    } catch (e) {
      console.error("Failed to fetch tags", e);
    }
  };

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

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/files`);
      // Sort by file_id 
      setFiles(data);
      setSearchResults(null);
    } catch (error) {
      console.error("Error fetching files", error);
    } finally {
      setLoading(false);
    }
  };

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
      fetchFiles();
      fetchTags();
    }
  }, [activeTab]);

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
              { id: 'browser', icon: Search, label: 'Deep Search', visible: true },
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
                    <h2 className="text-2xl font-bold text-gray-900">Knowledge Base</h2>

                    {/* Search Mode Toggle */}
                    <div className="bg-gray-100 p-1 rounded-xl inline-flex">
                      <button
                        onClick={() => { setSearchMode('metadata'); setSearchResults(null); setSearchQuery(''); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${searchMode === 'metadata' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Metadata Search
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
                              />
                            ))}

                          {files.length === 0 && !loading && (
                            <div className="text-center py-20 glass rounded-3xl border-dashed border-2 border-gray-200">
                              <p className="text-gray-500 font-medium">No files found.</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
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
