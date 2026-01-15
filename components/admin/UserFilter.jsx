'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

export function UserFilter({ value, onChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownRect, setDropdownRect] = useState(null);
  const [portalReady, setPortalReady] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownRect(rect);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Bloquer le scroll du body quand le dropdown est ouvert
  useEffect(() => {
    if (!isOpen) return;

    // Sauvegarder la position de scroll actuelle
    const scrollY = window.scrollY;

    // Calculer la largeur de la scrollbar
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Bloquer le scroll du body et compenser la disparition de la scrollbar
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      // Restaurer le scroll du body
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }
    const searchLower = searchQuery.toLowerCase().trim();
    return users.filter(user => {
      return (
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    });
  }, [users, searchQuery]);

  // Find selected user
  const selectedUser = users.find(u => u.id === value);

  return (
    <>
      <div className="relative" ref={containerRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full md:w-auto flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg border border-white/20 transition-colors text-white text-sm md:min-w-[220px]"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="flex-1 text-left truncate">
            {selectedUser ? (
              <span className="font-medium">{selectedUser.name || selectedUser.email}</span>
            ) : (
              'Tous les utilisateurs'
            )}
          </span>
          <svg
            className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && portalReady && dropdownRect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownRect.bottom + 8,
            left: dropdownRect.left,
            width: Math.max(dropdownRect.width, 320),
            zIndex: 10003,
          }}
          className="bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden"
        >
          {/* Search Input */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 focus:bg-white/10 transition-colors"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* User List */}
          <div ref={scrollContainerRef} className="max-h-80 overflow-y-auto custom-scrollbar [overscroll-behavior:contain]">
            {loading ? (
              <div className="p-8 text-center text-white/60 text-sm">
                Chargement...
              </div>
            ) : (
              <>
                {/* Option "Tous les utilisateurs" - toujours visible */}
                <button
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left ${
                    value === null ? 'bg-blue-500/20' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm">
                      Tous les utilisateurs
                    </div>
                    <div className="text-white/60 text-xs">
                      Voir toutes les données
                    </div>
                  </div>
                  {value === null && (
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Divider */}
                <div className="border-t border-white/10 my-1"></div>

                {/* User List */}
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-white/60 text-sm">
                    Aucun utilisateur trouvé pour "{searchQuery}"
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      onChange(user.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left ${
                      value === user.id ? 'bg-blue-500/20' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {user.name || 'Sans nom'}
                      </div>
                      <div className="text-white/60 text-xs truncate">
                        {user.email}
                      </div>
                    </div>

                    {/* Stats Badge */}
                    {user.cvCount > 0 && (
                      <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded flex-shrink-0">
                        {user.cvCount} CV{user.cvCount > 1 ? 's' : ''}
                      </div>
                    )}

                    {/* Selected Checkmark */}
                    {value === user.id && (
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

    </>
  );
}
