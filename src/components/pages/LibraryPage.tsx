/**
 * Library page - browse, search, filter, and quick-load content
 * Displays saved video/funscript items with metadata
 */

import { useState } from 'react';
import { Search, RefreshCw, Trash2, Play, Video, FileText, Globe } from 'lucide-react';
import { mediaApi } from '@/lib/apiClient';
import { isEmbedUrl } from '@/lib/videoUtils';
import type { LibraryItem } from '../../../server/types/shared';
import type { LibraryFilter } from '@/hooks/useLibrary';

interface LibraryPageProps {
  items: LibraryItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: LibraryFilter;
  setFilter: (f: LibraryFilter) => void;
  deleteItem: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  onLoadItem: (item: LibraryItem) => void;
}

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  // Format as date for older items
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Library page component
 */
export function LibraryPage({
  items,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  deleteItem,
  refresh,
  onLoadItem,
}: LibraryPageProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number, name: string) => {
    const confirmed = window.confirm(`Delete "${name}"? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteItem(id);
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      role="tabpanel"
      id="panel-library"
      aria-labelledby="tab-library"
      className="container mx-auto px-4 py-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Content Library</h1>
          <span className="px-2 py-1 text-sm bg-muted text-muted-foreground rounded-full">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="p-2 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
          title="Refresh library"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by video or script name..."
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('has-video')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'has-video'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Has Video
        </button>
        <button
          onClick={() => setFilter('has-funscript')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'has-funscript'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Has Funscript
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading library...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery ? `No results for "${searchQuery}"` : 'No items in your library yet'}
          </h2>
          {!searchQuery && (
            <p className="text-muted-foreground">
              Load a video or funscript to get started.
            </p>
          )}
        </div>
      )}

      {/* Items grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative bg-card border border-border rounded-lg overflow-hidden hover:border-muted-foreground transition-colors"
            >
              {/* Thumbnail background — low opacity, centered, covers full card (only for local videos) */}
              {item.videoName && !isEmbedUrl(item.videoName) && (
                <img
                  src={mediaApi.thumbnailUrl(item.videoName)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}

              {/* Card content — sits above the thumbnail */}
              <div className="relative p-4">
                {/* Badges */}
                <div className="flex gap-2 mb-3">
                  {item.videoName && !isEmbedUrl(item.videoName) && (
                    <div className="flex items-center gap-1 text-xs bg-muted/80 px-2 py-1 rounded">
                      <Video className="w-3 h-3" />
                      <span>Video</span>
                    </div>
                  )}
                  {item.videoName && isEmbedUrl(item.videoName) && (
                    <div className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                      <Globe className="w-3 h-3" />
                      <span>Embed</span>
                    </div>
                  )}
                  {item.funscriptName && (
                    <div className="flex items-center gap-1 text-xs bg-muted/80 px-2 py-1 rounded">
                      <FileText className="w-3 h-3" />
                      <span>Script</span>
                    </div>
                  )}
                  {item.duration && (
                    <div className="ml-auto text-xs bg-muted/80 px-2 py-1 rounded">
                      {formatDuration(item.duration)}
                    </div>
                  )}
                </div>

                {/* Video name (title) */}
                <h3 className="text-lg font-semibold text-foreground mb-1 truncate" title={item.videoName || 'No video'}>
                  {item.videoName || item.funscriptName || 'Unnamed'}
                </h3>

                {/* Funscript name (subtitle) */}
                {item.funscriptName && item.videoName && (
                  <p className="text-sm text-muted-foreground mb-2 truncate" title={item.funscriptName}>
                    {item.funscriptName}
                  </p>
                )}

                {/* Metadata */}
                <div className="text-xs text-muted-foreground mb-4">
                  <span>{formatRelativeTime(item.lastModified)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onLoadItem(item)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Load</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.videoName || item.funscriptName || 'this item')}
                    disabled={deletingId === item.id}
                    className="px-3 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
