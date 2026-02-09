/**
 * Playlist page - browse, create, and edit playlists
 * Two-state view: grid of playlists or active playlist editor
 */

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, ListMusic } from 'lucide-react';
import { PlaylistCard } from '@/components/playlist/PlaylistCard';
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor';
import { CreatePlaylistDialog } from '@/components/playlist/CreatePlaylistDialog';
import type { Playlist, PlaylistItem, LibraryItem } from '../../../server/types/shared';

interface PlaylistPageProps {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: number) => Promise<void>;
  activePlaylist: Playlist | null;
  activeItems: PlaylistItem[];
  selectPlaylist: (id: number) => Promise<void>;
  closePlaylist: () => void;
  addItem: (libraryItemId: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  reorderItems: (itemIds: number[]) => Promise<void>;
  libraryItems: LibraryItem[];
  loadLibraryItems: () => Promise<void>;
  onPlayPlaylist: (playlistId: number) => void;
}

/**
 * Playlist page component
 */
export function PlaylistPage({
  playlists,
  loading,
  error,
  refresh,
  createPlaylist,
  deletePlaylist,
  activePlaylist,
  activeItems,
  selectPlaylist,
  closePlaylist,
  addItem,
  removeItem,
  reorderItems,
  libraryItems,
  loadLibraryItems,
  onPlayPlaylist,
}: PlaylistPageProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Load library items when entering editor view
  useEffect(() => {
    if (activePlaylist && libraryItems.length === 0) {
      loadLibraryItems();
    }
  }, [activePlaylist, libraryItems.length, loadLibraryItems]);

  const handleCreatePlaylist = async (name: string, description?: string) => {
    try {
      await createPlaylist(name, description);
      setShowCreateDialog(false);
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  // If editing a playlist, show the editor
  if (activePlaylist) {
    return (
      <PlaylistEditor
        playlist={activePlaylist}
        items={activeItems}
        libraryItems={libraryItems}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onReorder={reorderItems}
        onClose={closePlaylist}
        onPlay={onPlayPlaylist}
      />
    );
  }

  // Otherwise, show the playlist grid
  return (
    <div
      role="tabpanel"
      id="panel-playlists"
      aria-labelledby="tab-playlists"
      className="container mx-auto px-4 py-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>Playlists</h1>
          <span className="px-2 py-1 text-sm bg-stone-800/50 text-stone-500 rounded-lg" style={{ fontFamily: 'var(--font-mono)' }}>
            {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2 hover:bg-stone-800/50 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh playlists"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-orange-700/10 border border-orange-700 text-orange-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && playlists.length === 0 && (
        <div className="text-center py-12 text-stone-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading playlists...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && playlists.length === 0 && (
        <div className="text-center py-12">
          <ListMusic className="w-16 h-16 mx-auto mb-4 text-stone-500" />
          <h2 className="text-xl font-semibold text-stone-200 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            No playlists yet
          </h2>
          <p className="text-stone-500 mb-4">
            Create your first playlist to organize your videos.
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Playlist</span>
          </button>
        </div>
      )}

      {/* Playlists grid */}
      {playlists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onSelect={selectPlaylist}
              onDelete={deletePlaylist}
              onPlay={onPlayPlaylist}
            />
          ))}
        </div>
      )}

      {/* Create playlist dialog */}
      <CreatePlaylistDialog
        isOpen={showCreateDialog}
        onConfirm={handleCreatePlaylist}
        onCancel={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
