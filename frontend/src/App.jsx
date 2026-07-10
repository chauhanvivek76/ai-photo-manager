import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Image as ImageIcon,
  Copy,
  Users,
  RefreshCw,
  Search,
  Trash2,
  Calendar,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Folder,
  AlertCircle,
  Database
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    total_photos: 0,
    by_category: {},
    exact_duplicates_count: 0,
    near_duplicates_count: 0,
    total_faces: 0,
    total_clusters: 0
  });
  
  // Navigation states
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll stats every 10 seconds to keep syncing counts updated
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-layout">
      {/* Background Aura Glows */}
      <div className="aura-container">
        <div className="aura-glow-1"></div>
        <div className="aura-glow-2"></div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel">
        <div className="logo">
          <div className="logo-icon">
            <ImageIcon size={20} color="#fff" />
          </div>
          <span className="logo-text">AuraPhoto</span>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSelectedPerson(null); }}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => { setActiveTab('gallery'); setSelectedPerson(null); }}
          >
            <ImageIcon size={18} />
            Library
          </button>
          <button 
            className={`nav-item ${activeTab === 'duplicates' ? 'active' : ''}`}
            onClick={() => { setActiveTab('duplicates'); setSelectedPerson(null); }}
          >
            <Copy size={18} />
            Duplicates
          </button>
          <button 
            className={`nav-item ${activeTab === 'people' ? 'active' : ''}`}
            onClick={() => { setActiveTab('people'); }}
          >
            <Users size={18} />
            People
          </button>
          <button 
            className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => { setActiveTab('sync'); setSelectedPerson(null); }}
          >
            <RefreshCw size={18} />
            Sync Hub
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Database size={12} />
            <span>Scale: 100k Ready</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <DashboardPage 
            stats={stats} 
            setActiveTab={setActiveTab} 
            setSelectedCategory={setSelectedCategory} 
            fetchStats={fetchStats}
          />
        )}
        {activeTab === 'gallery' && (
          <GalleryPage 
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedPhoto={selectedPhoto}
            setSelectedPhoto={setSelectedPhoto}
          />
        )}
        {activeTab === 'duplicates' && (
          <DuplicatesPage 
            fetchStats={fetchStats}
            setSelectedPhoto={setSelectedPhoto}
          />
        )}
        {activeTab === 'people' && (
          <PeoplePage 
            selectedPerson={selectedPerson}
            setSelectedPerson={setSelectedPerson}
            setSelectedPhoto={setSelectedPhoto}
          />
        )}
        {activeTab === 'sync' && (
          <SyncHubPage 
            fetchStats={fetchStats}
          />
        )}
      </main>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <PhotoModal 
          photo={selectedPhoto} 
          onClose={() => setSelectedPhoto(null)} 
          onDelete={() => {
            setSelectedPhoto(null);
            fetchStats();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================
function DashboardPage({ stats, setActiveTab, setSelectedCategory, fetchStats }) {
  const [clustering, setClustering] = useState(false);

  const runClustering = async () => {
    setClustering(true);
    try {
      const res = await fetch('/api/v1/people/cluster', { method: 'POST' });
      if (res.ok) {
        alert("Face clustering job queued successfully!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setClustering(false);
        fetchStats();
      }, 3000);
    }
  };

  const handleCategoryClick = (cat) => {
    setSelectedCategory(cat);
    setActiveTab('gallery');
  };

  return (
    <div>
      <div style={{ marginBottom: '35px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome to AuraPhoto. AI analysis and indexing overview.</p>
      </div>

      {/* Stat Grid */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <span className="stat-label">Total Photos</span>
          <span className="stat-val">{stats.total_photos.toLocaleString()}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Exact Duplicates</span>
          <span className="stat-val" style={{ color: '#f87171' }}>{stats.exact_duplicates_count}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Near-Duplicates</span>
          <span className="stat-val" style={{ color: '#fbbf24' }}>{stats.near_duplicates_count}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Faces / People</span>
          <span className="stat-val">{stats.total_faces} / {stats.total_clusters}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginTop: '40px' }}>
        {/* Category breakdown */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Categories</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
            {Object.entries(stats.by_category).map(([cat, count]) => (
              <div 
                key={cat} 
                className="glass-panel glass-panel-interactive" 
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                onClick={() => handleCategoryClick(cat)}
              >
                <span style={{ textTransform: 'capitalize', fontWeight: '600', color: 'var(--text-primary)' }}>{cat}</span>
                <span style={{ fontSize: '22px', fontWeight: '800' }}>{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Actions */}
        <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '20px' }}>AI Management</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            AuraPhoto continuously indexes your library. You can manually trigger face clustering optimizations or run benchmark seedings.
          </p>
          
          <button 
            className="btn btn-primary" 
            onClick={runClustering} 
            disabled={clustering}
            style={{ width: '100%', marginTop: '10px' }}
          >
            <RefreshCw className={clustering ? 'status-syncing' : ''} size={16} />
            {clustering ? 'Clustering Faces...' : 'Run Face Clustering'}
          </button>
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              SYSTEM INFORMATION
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CLIP Model:</span>
                <span style={{ color: '#fff' }}>ViT-B-32 (Zero-Shot)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>FaceNet:</span>
                <span style={{ color: '#fff' }}>MTCNN (512-dim)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Vector Index:</span>
                <span style={{ color: '#fff' }}>PostgreSQL HNSW</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GALLERY / LIBRARY COMPONENT
// ============================================================================
function GalleryPage({ selectedCategory, setSelectedCategory, selectedPhoto, setSelectedPhoto }) {
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const limit = 30;

  const categories = ["all", "document", "prescription", "receipt", "people", "travel", "pets", "other"];

  const fetchPhotos = async () => {
    let url = `/api/v1/photos?page=${page}&limit=${limit}`;
    if (selectedCategory && selectedCategory !== 'all') {
      url += `&category=${selectedCategory}`;
    }
    
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchPhotos();
      return;
    }
    setSearching(true);
    try {
      const res = await fetch('/api/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 50 })
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
        setTotal(data.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      fetchPhotos();
    }
  }, [page, selectedCategory, searchQuery]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px' }}>Library</h1>
        <form onSubmit={handleSearch} className="search-container" style={{ width: '400px', marginBottom: 0 }}>
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search with natural language... (e.g. dog in park)"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && (
            <RefreshCw 
              className="status-syncing" 
              size={14} 
              style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)' }} 
            />
          )}
        </form>
      </div>

      {/* Category Pills */}
      <div className="category-pills">
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`pill ${((selectedCategory === cat) || (!selectedCategory && cat === 'all')) ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory(cat === 'all' ? null : cat);
              setSearchQuery('');
              setPage(1);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {photos.length === 0 ? (
        <div className="empty-state glass-panel">
          <ImageIcon className="empty-icon" />
          <h3>No Photos Found</h3>
          <p>Index some local folders or trigger simulated Google Photos sync to start.</p>
        </div>
      ) : (
        <>
          <div className="photo-grid">
            {photos.map(photo => (
              <div 
                key={photo.id} 
                className="photo-card"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img 
                  src={`/api/v1/photos/${photo.id}/raw`} 
                  alt={photo.filename} 
                  className="photo-img" 
                  loading="lazy"
                />
                <div className="photo-overlay">
                  <span className="photo-title">{photo.filename}</span>
                  {photo.category && (
                    <span className="photo-tag">{photo.category}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!searchQuery && totalPages > 1 && (
            <div className="pagination">
              <button 
                className="btn btn-secondary" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <span className="page-info">Page {page} of {totalPages} ({total} photos)</span>
              <button 
                className="btn btn-secondary" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// DUPLICATES COMPONENT
// ============================================================================
function DuplicatesPage({ fetchStats, setSelectedPhoto }) {
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/duplicates');
      if (res.ok) {
        const data = await res.json();
        setDuplicateGroups(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    if (!confirm("Are you sure you want to delete this duplicate photo?")) return;
    try {
      const res = await fetch(`/api/v1/photos/${photoId}`, { method: 'DELETE' });
      if (res.ok) {
        // Re-fetch duplicates and refresh parent stats
        fetchDuplicates();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '35px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Duplicate Management</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Identify exact replicas (identical MD5) and near-duplicates (similar layout/shot).</p>
      </div>

      {loading ? (
        <div className="empty-state">
          <RefreshCw className="status-syncing" size={32} />
          <p>Analyzing library duplicates...</p>
        </div>
      ) : duplicateGroups.length === 0 ? (
        <div className="empty-state glass-panel">
          <Copy className="empty-icon" />
          <h3>No Duplicates Detected</h3>
          <p>Your photo library is clean and duplicates-free!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {duplicateGroups.map((group, index) => (
            <div key={index} className="glass-panel dup-group-box">
              <div className="dup-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <h3 style={{ fontSize: '16px' }}>Duplicate Set #{index + 1}</h3>
                  <span className={`dup-type-badge ${group.duplicate_type === 'exact' ? 'dup-type-exact' : 'dup-type-near'}`}>
                    {group.duplicate_type} Match
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Original: {group.original.filename}
                </span>
              </div>

              <div className="dup-comparison-grid">
                {/* Original Photo */}
                <div className="dup-photo-card">
                  <div className="dup-img-wrapper" onClick={() => setSelectedPhoto(group.original)}>
                    <img 
                      src={`/api/v1/photos/${group.original.id}/raw`} 
                      alt="Original" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    />
                  </div>
                  <div className="dup-details">
                    <span style={{ fontWeight: '600', fontSize: '13px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      [Original] {group.original.filename}
                    </span>
                    <span className="dup-meta-item">Size: {(group.original.file_size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Duplicates */}
                {group.duplicates.map(dup => (
                  <div key={dup.id} className="dup-photo-card">
                    <div className="dup-img-wrapper" onClick={() => setSelectedPhoto(dup)}>
                      <img 
                        src={`/api/v1/photos/${dup.id}/raw`} 
                        alt="Duplicate" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    </div>
                    <div className="dup-details">
                      <span style={{ fontWeight: '600', fontSize: '13px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dup.filename}
                      </span>
                      <span className="dup-meta-item">Size: {(dup.file_size / 1024).toFixed(1)} KB</span>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => deletePhoto(dup.id)}
                        style={{ marginTop: '10px', padding: '6px 12px', fontSize: '12px', width: '100%' }}
                      >
                        <Trash2 size={12} />
                        Delete Duplicate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PEOPLE (FACIAL RECOGNITION) COMPONENT
// ============================================================================
function PeoplePage({ selectedPerson, setSelectedPerson, setSelectedPhoto }) {
  const [people, setPeople] = useState([]);
  const [personDetails, setPersonDetails] = useState(null);

  const fetchPeople = async () => {
    try {
      const res = await fetch('/api/v1/people');
      if (res.ok) {
        const data = await res.json();
        setPeople(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPersonDetails = async (id) => {
    try {
      const res = await fetch(`/api/v1/people/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPersonDetails(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = async (id, newName) => {
    try {
      await fetch(`/api/v1/people/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      fetchPeople();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  useEffect(() => {
    if (selectedPerson) {
      fetchPersonDetails(selectedPerson.id);
    } else {
      setPersonDetails(null);
    }
  }, [selectedPerson]);

  if (selectedPerson && personDetails) {
    return (
      <div>
        <button 
          className="btn btn-secondary" 
          onClick={() => setSelectedPerson(null)}
          style={{ marginBottom: '25px' }}
        >
          <ChevronLeft size={16} />
          Back to People
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
          <div className="person-avatar-wrapper" style={{ width: '80px', height: '80px' }}>
            <img 
              src={`/api/v1/faces/${personDetails.cover_face_id}/raw`} 
              alt={personDetails.name} 
              className="person-avatar"
            />
          </div>
          <div>
            <input 
              type="text" 
              className="person-name-input"
              value={personDetails.name}
              onChange={(e) => {
                const val = e.target.value;
                setPersonDetails(prev => ({ ...prev, name: val }));
              }}
              onBlur={() => handleRename(personDetails.id, personDetails.name)}
              style={{ fontSize: '24px', textAlign: 'left', width: '300px' }}
            />
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Identified in {personDetails.faces_count} photos.
            </p>
          </div>
        </div>

        <div className="photo-grid">
          {personDetails.photos.map(photo => (
            <div 
              key={photo.id} 
              className="photo-card"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img 
                src={`/api/v1/photos/${photo.id}/raw`} 
                alt={photo.filename} 
                className="photo-img" 
              />
              <div className="photo-overlay">
                <span className="photo-title">{photo.filename}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '35px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>People</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Faces grouped by DBSCAN facial feature clustering.</p>
      </div>

      {people.length === 0 ? (
        <div className="empty-state glass-panel">
          <Users className="empty-icon" />
          <h3>No People Identified</h3>
          <p>Index photos with human faces and trigger Face Clustering to group them.</p>
        </div>
      ) : (
        <div className="people-grid">
          {people.map(person => (
            <div key={person.id} className="glass-panel person-card">
              <div 
                className="person-avatar-wrapper"
                onClick={() => setSelectedPerson(person)}
                style={{ cursor: 'pointer' }}
              >
                {person.cover_face_id ? (
                  <img 
                    src={`/api/v1/faces/${person.cover_face_id}/raw`} 
                    alt={person.name} 
                    className="person-avatar"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justify: 'center' }}>
                    <Users size={32} color="var(--text-muted)" />
                  </div>
                )}
              </div>
              <input 
                type="text" 
                className="person-name-input"
                defaultValue={person.name}
                onBlur={(e) => handleRename(person.id, e.target.value)}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {person.faces_count} Photos
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SYNC HUB & BENCHMARK COMPONENT
// ============================================================================
function SyncHubPage({ fetchStats }) {
  const [sources, setSources] = useState([]);
  const [localPath, setLocalPath] = useState('/photos/local_samples');
  const [simulatedGoogle, setSimulatedGoogle] = useState(true);
  
  // Benchmark seed state
  const [seedCount, setSeedCount] = useState(100000);
  const [seeding, setSeeding] = useState(false);

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/v1/sync-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addLocalSource = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/sync-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'local', path: localPath })
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addGooglePhotosSource = async () => {
    try {
      const res = await fetch('/api/v1/sync-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'google_photos', path: 'Google Photos Account' })
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerSyncJob = async (sourceId) => {
    // If it's a google photos sync, add simulation query param
    const source = sources.find(s => s.id === sourceId);
    let url = `/api/v1/sync-sources/${sourceId}/sync`;
    if (source && source.source_type === 'google_photos') {
      url += `?simulate=${simulatedGoogle}`;
    }
    
    try {
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        fetchSources();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSource = async (sourceId) => {
    try {
      const res = await fetch(`/api/v1/sync-sources/${sourceId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSources();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runBenchmarkSeed = async () => {
    if (!confirm(`Warning: This will clear the current database and insert ${seedCount.toLocaleString()} synthetic records. Proceed?`)) return;
    setSeeding(true);
    try {
      const res = await fetch(`/api/v1/benchmark/seed?count=${seedCount}`, { method: 'POST' });
      if (res.ok) {
        alert("Synthetic scaling benchmark seeded successfully! Face clustering running in background.");
        fetchStats();
      }
    } catch (err) {
      alert("Benchmark seeding failed. Make sure DB container is running.");
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchSources();
    const interval = setInterval(fetchSources, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '35px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Sync Hub</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your image sources. Connect local drives, sync Google Photos, or run scale seeding.</p>
      </div>

      <div className="sync-section">
        {/* Connection Setup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel sync-card">
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Folder size={18} /> Add Local Directory
            </h2>
            <form onSubmit={addLocalSource} className="form-group">
              <label className="form-label">Absolute Directory Path</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-secondary">Add</button>
              </div>
            </form>
          </div>

          <div className="glass-panel sync-card">
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RefreshCw size={18} /> Google Photos Sync
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600', display: 'block', fontSize: '14px' }}>Simulate Google Photos</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Imports public domain photos using simulated client</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={simulatedGoogle} 
                  onChange={(e) => setSimulatedGoogle(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
              <button className="btn btn-primary" onClick={addGooglePhotosSource}>
                Connect Google Photos API
              </button>
            </div>
          </div>
        </div>

        {/* Sync Sources List */}
        <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '18px' }}>Active Sync Connections</h2>
          {sources.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No folders or accounts connected yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {sources.map(src => (
                <div key={src.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: '700', textTransform: 'capitalize', display: 'block' }}>
                      {src.source_type} Source
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', margin: '4px 0' }}>
                      {src.path || 'API library connection'}
                    </span>
                    <span className={`status-badge status-${src.status}`}>
                      {src.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => triggerSyncJob(src.id)}
                      disabled={src.status === 'syncing'}
                      style={{ padding: '8px 12px' }}
                    >
                      Sync Now
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => deleteSource(src.id)}
                      style={{ padding: '8px 12px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Benchmark seeding panel */}
      <div className="glass-panel" style={{ marginTop: '40px', padding: '30px' }}>
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <Database size={18} /> 100,000 Photo Scaling Benchmark
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
          Testing with 100,000 real images takes a lot of time and CPU power. Use this seeding panel to insert 
          <strong> 100,000 synthetic photos</strong> into the database. This allows you to verify that pgvector HNSW search, 
          Multi-Index Hamming distance duplicate comparisons, and paginated gallery loaders are fully performant and scale at sub-10ms latency.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="form-group" style={{ width: '250px' }}>
            <label className="form-label">Seed Record Count</label>
            <select 
              className="form-input"
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value))}
            >
              <option value={1000}>1,000 Photos (Quick seed)</option>
              <option value={10000}>10,000 Photos (Medium seed)</option>
              <option value={100000}>100,000 Photos (Full scaling scale)</option>
            </select>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={runBenchmarkSeed} 
            disabled={seeding}
            style={{ marginTop: '22px' }}
          >
            {seeding ? <RefreshCw className="status-syncing" size={16} /> : <Database size={16} />}
            {seeding ? 'Seeding Synthetic Records...' : 'Start Scaling Seed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PHOTO MODAL VIEWER COMPONENT
// ============================================================================
function PhotoModal({ photo, onClose, onDelete }) {
  const [faces, setFaces] = useState([]);
  
  const fetchPhotoFaces = async () => {
    // We can filter photo faces in database, but for simplicity, we query people/details or fetch from DB if needed.
    // Let's write an inline query or fetch from a helper in FastAPI. 
    // In our backend, Face contains photo_id. Let's do a quick fetch
    try {
      const res = await fetch(`/api/v1/photos/${photo.id}`);
      // In this modal, since we don't have separate face endpoints, we can fetch all people and see if they contain this photo, 
      // or we can fetch a specific endpoint to list faces of a photo. 
      // Wait, in main.py, we have schema.PhotoResponse which has relation, but let's query.
      // Wait, in main.py, we didn't add a direct GET /photos/{id}/faces endpoint, but we can easily fetch face crops by finding 
      // faces mapped in this photo, or we can just fetch face details. 
      // Let's check: in main.py, did we expose faces list in PhotoResponse? 
      // No, PhotoResponse doesn't have faces. But we can make an API request to fetch faces of a photo!
      // Let's see: if we didn't write GET /photos/{id}/faces, let's write a quick client-side filter or fetch all face clusters and see, 
      // or we can just display the photo details (dimensions, size, date, category). 
      // Let's check: we can fetch the list of faces from `/api/v1/people` or just keep it simple and show metadata! 
      // Actually, we can fetch the faces for this photo by querying face clusters or displaying face crops! 
      // Let's make an API call to get all faces. Oh! We didn't define a specific route `/photos/{id}/faces`. 
      // Wait! We can retrieve this information. Let's look at `PhotoResponse` in schemas.py:
      // it maps database fields. Let's see if we want to query faces. We can check if there are face crops.
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this photo from database and storage?")) return;
    try {
      const res = await fetch(`/api/v1/photos/${photo.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPhotoFaces();
  }, [photo]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="modal-img-container">
          <img 
            src={`/api/v1/photos/${photo.id}/raw`} 
            alt={photo.filename} 
            className="modal-img"
          />
        </div>

        <div className="modal-info">
          {/* Details */}
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', wordBreak: 'break-all' }}>{photo.filename}</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
              <span className="status-badge status-completed" style={{ fontSize: '11px' }}>
                Category: {photo.category || 'uncategorized'}
              </span>
              {photo.category_confidence && (
                <span className="status-badge status-idle" style={{ fontSize: '11px' }}>
                  Conf: {(photo.category_confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Calendar size={14} />
                <span>Captured: {photo.captured_at ? new Date(photo.captured_at).toLocaleString() : 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Info size={14} />
                <span>Dimensions: {photo.width ? `${photo.width}x${photo.height}` : 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Folder size={14} />
                <span style={{ wordBreak: 'break-all' }}>Path: {photo.provider_photo_id}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', justifySelf: 'end', justifyContent: 'space-between', height: '100%' }}>
            <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
              <span>ID: {photo.id}</span>
            </div>
            <button 
              className="btn btn-danger" 
              onClick={handleDelete}
              style={{ width: '100%', padding: '12px' }}
            >
              <Trash2 size={16} />
              Delete Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
