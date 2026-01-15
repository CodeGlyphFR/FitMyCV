'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * ImagePickerModal - Modal to browse and select images from /public folder
 */
export function ImagePickerModal({ isOpen, onClose, onSelect }) {
  const [images, setImages] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  // Fetch images
  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedFolder
        ? `/api/admin/public-images?folder=${encodeURIComponent(selectedFolder)}`
        : '/api/admin/public-images';

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch images');

      const data = await res.json();
      setImages(data.images || []);
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder]);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, fetchImages]);

  // Filter images by search query
  const filteredImages = images.filter((img) => {
    if (!searchQuery) return true;
    return img.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group images by folder
  const imagesByFolder = filteredImages.reduce((acc, img) => {
    const folder = img.folder || '/';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(img);
    return acc;
  }, {});

  // Handle image selection
  const handleSelect = (image) => {
    onSelect(image.path);
    onClose();
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-white/10 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🖼️</span>
            Bibliotheque d'images
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-4 border-b border-white/10">
          {/* Search */}
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une image..."
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-hidden focus:border-emerald-500/50"
            />
          </div>

          {/* Folder filter */}
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-hidden focus:border-emerald-500/50"
          >
            <option value="">Tous les dossiers</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder || '/'}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchImages}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="Rafraichir"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-white/60">Aucune image trouvee</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(imagesByFolder).map(([folder, folderImages]) => (
                <div key={folder}>
                  <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    {folder || '/'}
                    <span className="text-white/40">({folderImages.length})</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {folderImages.map((image) => (
                      <button
                        key={image.path}
                        onClick={() => handleSelect(image)}
                        onMouseEnter={() => setPreviewImage(image)}
                        onMouseLeave={() => setPreviewImage(null)}
                        className="group relative bg-white/5 rounded-lg border border-white/10 hover:border-emerald-500/50 hover:bg-white/10 transition-all overflow-hidden"
                      >
                        {/* Image preview */}
                        <div className="aspect-square flex items-center justify-center p-2 bg-white/5">
                          {image.extension === '.svg' ? (
                            <img
                              src={image.path}
                              alt={image.name}
                              className="max-w-full max-h-full object-contain"
                              style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}
                            />
                          ) : (
                            <img
                              src={image.path}
                              alt={image.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          )}
                        </div>

                        {/* Image info */}
                        <div className="p-2 border-t border-white/10">
                          <p className="text-xs text-white truncate" title={image.name}>
                            {image.name}
                          </p>
                          <p className="text-xs text-white/40">
                            {formatSize(image.size)}
                          </p>
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded">
                            Selectionner
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with preview */}
        <div className="border-t border-white/10 p-4 flex items-center justify-between">
          <div className="text-sm text-white/60">
            {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''} disponible{filteredImages.length !== 1 ? 's' : ''}
          </div>

          {previewImage && (
            <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded-lg">
              <img
                src={previewImage.path}
                alt={previewImage.name}
                className="w-8 h-8 object-contain"
              />
              <div>
                <p className="text-sm text-white">{previewImage.name}</p>
                <p className="text-xs text-white/40">{previewImage.path}</p>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImagePickerModal;
