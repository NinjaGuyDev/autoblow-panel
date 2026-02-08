import { useState } from 'react';
import { ListMusic, Edit, Play, Trash2 } from 'lucide-react';
import type { Playlist } from '../../../server/types/shared';

interface PlaylistCardProps {
  playlist: Playlist;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onPlay: (id: number) => void;
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
 * Playlist card component for grid view
 */
export function PlaylistCard({
  playlist,
  onSelect,
  onDelete,
  onPlay,
}: PlaylistCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete playlist "${playlist.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDelete(playlist.id);
    } catch (err) {
      console.error('Failed to delete playlist:', err);
      setIsDeleting(false);
    }
  };

  const itemCount = playlist.itemCount ?? 0;

  return (
    <div className="relative bg-card border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors">
      {/* Icon and title */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
          <ListMusic className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate" title={playlist.name}>
            {playlist.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>{itemCount} {itemCount === 1 ? 'video' : 'videos'}</span>
            <span>•</span>
            <span>{formatRelativeTime(playlist.lastModified)}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {playlist.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2" title={playlist.description}>
          {playlist.description}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onSelect(playlist.id)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Edit className="w-4 h-4" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onPlay(playlist.id)}
          className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          title="Play playlist"
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
          title="Delete playlist"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
