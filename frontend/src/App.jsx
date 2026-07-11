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
  Database,
  FileText,
  Activity,
  Receipt,
  Compass,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  Filter
} from 'lucide-react';

const CATEGORY_DECORATIONS = {
  document: { icon: FileText, color: 'var(--color-document)' },
  prescription: { icon: Activity, color: 'var(--color-prescription)' },
  receipt: { icon: Receipt, color: 'var(--color-receipt)' },
  people: { icon: Users, color: 'var(--color-people)' },
  travel: { icon: Compass, color: 'var(--color-travel)' },
  pets: { icon: Sparkles, color: 'var(--color-pets)' },
  other: { icon: HelpCircle, color: 'var(--color-other)' }
};

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
    const interval = setInterval(fetchStats, 8000);
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
            <ImageIcon size={22} color="#fff" />
          </div>
          <span className="logo-text">AuraPhoto</span>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSelectedPerson(null); }}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => { setActiveTab('gallery'); setSelectedPerson(null); }}
          >
            <ImageIcon size={20} />
            Library
          </button>
          <button 
            className={`nav-item ${activeTab === 'duplicates' ? 'active' : ''}`}
            onClick={() => { setActiveTab('duplicates'); setSelectedPerson(null); }}
          >
            <Copy size={20} />
            Duplicates
          </button>
          <button 
            className={`nav-item ${activeTab === 'people' ? 'active' : ''}`}
            onClick={() => { setActiveTab('people'); }}
          >
            <Users size={20} />
            People
          </button>
          <button 
            className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => { setActiveTab('sync'); setSelectedPerson(null); }}
          >
            <RefreshCw size={20} />
            Sync Hub
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Database size={14} />
            <span>Scale: 100k Benchmark Ready</span>
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
        // Simple UI feedback
        setTimeout(fetchStats, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setClustering(false);
        fetchStats();
      }, 4000);
    }
  };

  const handleCategoryClick = (cat) => {
    setSelectedCategory(cat);
    setActiveTab('gallery');
  };

  return (
    <div>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px' }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome to AuraPhoto. Real-time AI analysis & photo indexing overview.</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card glass-panel card-blue">
          <span className="stat-label">Total Photos</span>
          <span className="stat-val">{stats.total_photos.toLocaleString()}</span>
        </div>
        <div className="stat-card glass-panel card-red">
          <span className="stat-label">Exact Duplicates</span>
          <span className="stat-val" style={{ color: '#fca5a5' }}>{stats.exact_duplicates_count}</span>
        </div>
        <div className="stat-card glass-panel card-gold">
          <span className="stat-label">Near-Duplicates</span>
          <span className="stat-val" style={{ color: '#fde047' }}>{stats.near_duplicates_count}</span>
        </div>
        <div className="stat-card glass-panel card-purple">
          <span className="stat-label">Faces / People</span>
          <span className="stat-val">{stats.total_faces.toLocaleString()} / {stats.total_clusters}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '30px', marginTop: '40px' }}>
        {/* Category Breakdown Panel */}
        <div className="glass-panel" style={{ padding: '35px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700' }}>AI Categorization</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Based on zero-shot CLIP analysis</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
            {Object.entries(stats.by_category).map(([cat, count]) => {
              const config = CATEGORY_DECORATIONS[cat] || { icon: HelpCircle, color: 'var(--color-other)' };
              const Icon = config.icon;
              const percentage = stats.total_photos > 0 ? (count / stats.total_photos) * 100 : 0;
              
              return (
                <div 
                  key={cat} 
                  className="glass-panel glass-panel-interactive category-dashboard-card" 
                  onClick={() => handleCategoryClick(cat)}
                >
                  <div className="category-header">
                    <span className="category-title">{cat}</span>
                    <div className="category-icon-wrapper" style={{ borderLeft: `3px solid ${config.color}` }}>
                      <Icon size={16} color={config.color} />
                    </div>
                  </div>
                  <span className="category-count">{count.toLocaleString()}</span>
                  
                  <div className="progress-bar-bg">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${percentage}%`, background: config.color }}
                    ></div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {percentage.toFixed(1)}% of library
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Management Panel */}
        <div className="glass-panel" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700' }}>AI Management</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            AuraPhoto clusters similar human profiles using custom mathematical projection on vector embeddings.
          </p>
          
          <button 
            className="btn btn-primary" 
            onClick={runClustering} 
            disabled={clustering}
            style={{ width: '100%', marginTop: '10px', height: '48px' }}
          >
            <RefreshCw className={clustering ? 'status-syncing' : ''} size={18} />
            {clustering ? 'Clustering Faces...' : 'Run Face Clustering'}
          </button>
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '15px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '12px' }}>
              INDEX ENGINE INFORMATION
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '8px' }}>
                <span>CLIP Embedding Model:</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>ViT-B-32 (Zero-Shot)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '8px' }}>
                <span>FaceNet Model:</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>MTCNN (512-dim)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span>Database Vector Index:</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>PostgreSQL HNSW</span>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '800' }}>Photo Library</h1>
        
        <form onSubmit={handleSearch} className="search-container" style={{ width: '420px', marginBottom: 0 }}>
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search with natural language... (e.g. scenic travel)"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && (
            <RefreshCw 
              className="status-syncing" 
              size={14} 
              style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} 
            />
          )}
        </form>
      </div>

      {/* Category Filter Pills */}
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
          <ImageIcon className="empty-icon" size={40} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>No Photos Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No indexed files match the selected filter. Trigger a sync or seed data inside Sync Hub.</p>
        </div>
      ) : (
        <>
          <div className="photo-grid">
            {photos.map(photo => {
              const config = CATEGORY_DECORATIONS[photo.category] || { color: 'var(--color-other)' };
              return (
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
                      <span className="photo-tag" style={{ background: config.color }}>{photo.category}</span>
                    )}
                  </div>
                </div>
              );
            })}
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
              <span className="page-info">Page {page} of {totalPages} ({total.toLocaleString()} photos)</span>
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
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px' }}>Duplicate Management</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Identify exact replicas (identical MD5) and near-duplicates (similar layout and pHash segment matches).</p>
      </div>

      {loading ? (
        <div className="empty-state">
          <RefreshCw className="status-syncing" size={32} />
          <p>Analyzing library duplicates...</p>
        </div>
      ) : duplicateGroups.length === 0 ? (
        <div className="empty-state glass-panel">
          <Copy className="empty-icon" size={40} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>No Duplicates Detected</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Your photo library is clean and duplicate-free!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {duplicateGroups.map((group, index) => (
            <div key={index} className="glass-panel dup-group-box">
              <div className="dup-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Duplicate Cluster #{index + 1}</h3>
                  <span className={`dup-type-badge ${group.duplicate_type === 'exact' ? 'dup-type-exact' : 'dup-type-near'}`}>
                    {group.duplicate_type} Match
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Orig: {group.original.filename}
                </span>
              </div>

              <div className="dup-comparison-grid">
                {/* Original Photo */}
                <div className="dup-photo-card">
                  <div className="dup-img-wrapper" onClick={() => setSelectedPhoto(group.original)}>
                    <img 
                      src={`/api/v1/photos/${group.original.id}/raw`} 
                      alt="Original File" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div className="dup-details">
                    <span style={{ fontWeight: '700', fontSize: '13px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>
                      [Original] {group.original.filename}
                    </span>
                    <span className="dup-meta-item">Size: {(group.original.file_size / 1024).toFixed(1)} KB</span>
                    <span className="dup-meta-item">Category: {group.original.category || 'other'}</span>
                  </div>
                </div>

                {/* Duplicates */}
                {group.duplicates.map(dup => (
                  <div key={dup.id} className="dup-photo-card">
                    <div className="dup-img-wrapper" onClick={() => setSelectedPhoto(dup)}>
                      <img 
                        src={`/api/v1/photos/${dup.id}/raw`} 
                        alt="Duplicate File" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div className="dup-details">
                      <span style={{ fontWeight: '600', fontSize: '13px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>
                        {dup.filename}
                      </span>
                      <span className="dup-meta-item">Size: {(dup.file_size / 1024).toFixed(1)} KB</span>
                      <span className="dup-meta-item" style={{ color: 'var(--danger)', fontWeight: '600' }}>
                        {group.duplicate_type === 'exact' ? '100% Exact match' : 'Near-duplicate match'}
                      </span>
                      
                      <button 
                        className="btn btn-danger" 
                        onClick={() => deletePhoto(dup.id)}
                        style={{ marginTop: '14px', padding: '8px 12px', fontSize: '12px', width: '100%' }}
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
    if (!newName.trim()) return;
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
          style={{ marginBottom: '30px' }}
        >
          <ChevronLeft size={16} />
          Back to People
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '40px' }}>
          <div className="person-avatar-wrapper" style={{ width: '90px', height: '90px' }}>
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
              style={{ fontSize: '26px', fontWeight: '800', textAlign: 'left', width: '320px' }}
            />
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
              Facial structures identified in {personDetails.faces_count} photos.
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
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px' }}>People Explorer</h1>
        <p style={{ color: 'var(--text-secondary)' }}>People groups generated via DBSCAN clustering on FaceNet MTCNN vector spaces.</p>
      </div>

      {people.length === 0 ? (
        <div className="empty-state glass-panel">
          <Users className="empty-icon" size={40} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>No Face Clusters Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Run Face Clustering on the Dashboard once photos with faces are successfully indexed.</p>
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
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
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
        fetchStats();
      }
    } catch (err) {
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
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px' }}>Sync Connections Hub</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your folder streams, connect Google Photos client, or trigger simulated database seedings.</p>
      </div>

      <div className="sync-section">
        {/* Connections Setup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel sync-card">
            <h2 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Folder size={20} color="var(--primary)" /> Connect Local Directory
            </h2>
            <form onSubmit={addLocalSource} className="form-group">
              <label className="form-label">Absolute Directory Path</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-secondary">Connect</button>
              </div>
            </form>
          </div>

          <div className="glass-panel sync-card">
            <h2 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={20} color="var(--accent)" /> Google Photos Integration
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '700', display: 'block', fontSize: '15px' }}>Simulate Account Sync</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Connects mock server pipeline to load sample library</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={simulatedGoogle} 
                  onChange={(e) => setSimulatedGoogle(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
              <button className="btn btn-primary" onClick={addGooglePhotosSource} style={{ height: '44px' }}>
                Authenticate Google Photos API
              </button>
            </div>
          </div>
        </div>

        {/* Connections List */}
        <div className="glass-panel" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Active Streams</h2>
          {sources.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No synced directories or accounts active.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sources.map(src => (
                <div key={src.id} className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <div>
                    <span style={{ fontWeight: '700', textTransform: 'capitalize', display: 'block', fontSize: '15px' }}>
                      {src.source_type} Stream
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', margin: '4px 0 8px 0', wordBreak: 'break-all' }}>
                      {src.path}
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
                      style={{ padding: '10px 16px', fontSize: '13px' }}
                    >
                      Sync
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => deleteSource(src.id)}
                      style={{ padding: '10px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seeder Benchmark Card */}
      <div className="glass-panel" style={{ marginTop: '40px', padding: '35px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <Database size={20} color="var(--primary)" /> 100,000 Photo Scale Seeding Panel
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
          Seeding synthetic entries into PostgreSQL pgvector allows you to evaluate backend performance index mappings (B-Tree Bins, HNSW vectors) on heavy transactions under sub-10ms query load times.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="form-group" style={{ width: '280px' }}>
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
            style={{ marginTop: '24px', height: '46px' }}
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={26} />
        </button>

        <div className="modal-img-container">
          <img 
            src={`/api/v1/photos/${photo.id}/raw`} 
            alt={photo.filename} 
            className="modal-img"
          />
        </div>

        <div className="modal-info">
          {/* Metadata information */}
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px', wordBreak: 'break-all' }}>{photo.filename}</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <span className="status-badge status-completed" style={{ fontSize: '11px' }}>
                Category: {photo.category || 'other'}
              </span>
              {photo.category_confidence && (
                <span className="status-badge status-idle" style={{ fontSize: '11px' }}>
                  Confidence: {(photo.category_confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Calendar size={15} color="var(--primary)" />
                <span>Captured: {photo.captured_at ? new Date(photo.captured_at).toLocaleString() : 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Info size={15} color="var(--accent)" />
                <span>Resolution: {photo.width ? `${photo.width}x${photo.height}` : 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Folder size={15} color="var(--text-muted)" />
                <span style={{ wordBreak: 'break-all' }}>Location: {photo.provider_photo_id}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', justifySelf: 'end', justifyContent: 'space-between', height: '100%', minWidth: '150px' }}>
            <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
              <span>Database ID: {photo.id}</span>
            </div>
            
            <button 
              className="btn btn-danger" 
              onClick={handleDelete}
              style={{ width: '100%', padding: '14px', height: '48px' }}
            >
              <Trash2 size={16} />
              Delete Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
