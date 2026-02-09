import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Play, GripVertical, X, Plus } from 'lucide-react';
import type { Playlist, PlaylistItem, LibraryItem } from '../../../server/types/shared';

interface PlaylistEditorProps {
  playlist: Playlist;
  items: PlaylistItem[];
  libraryItems: LibraryItem[];
  onAddItem: (libraryItemId: number) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
  onReorder: (itemIds: number[]) => Promise<void>;
  onClose: () => void;
  onPlay: (playlistId: number) => void;
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
 * Sortable playlist item row
 */
function SortablePlaylistItem({
  item,
  position,
  onRemove,
}: {
  item: PlaylistItem;
  position: number;
  onRemove: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-muted-foreground transition-colors"
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Position number */}
      <div className="flex-shrink-0 w-8 text-center text-sm font-medium text-muted-foreground">
        {position + 1}
      </div>

      {/* Item details */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">
          {item.videoName || 'Unknown video'}
        </div>
        {item.funscriptName && (
          <div className="text-sm text-muted-foreground truncate">
            {item.funscriptName}
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="flex-shrink-0 text-sm text-muted-foreground">
        {formatDuration(item.duration ?? null)}
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.id)}
        className="flex-shrink-0 p-1 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded transition-colors"
        title="Remove from playlist"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Playlist editor with drag-and-drop reordering
 */
export function PlaylistEditor({
  playlist,
  items,
  libraryItems,
  onAddItem,
  onRemoveItem,
  onReorder,
  onClose,
  onPlay,
}: PlaylistEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        const itemIds = reorderedItems.map((item) => item.id);
        await onReorder(itemIds);
      }
    }
  };

  const handleAddItem = async (libraryItemId: number) => {
    setIsAdding(true);
    try {
      await onAddItem(libraryItemId);
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setIsAdding(false);
    }
  };

  // Filter out library items that are already in the playlist
  const availableItems = libraryItems.filter(
    (libItem) => !items.some((playlistItem) => playlistItem.libraryItemId === libItem.id)
  );

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            title="Back to playlists"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-sm text-muted-foreground mt-1">{playlist.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onPlay(playlist.id)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Play className="w-4 h-4" />
          <span>Play Playlist</span>
        </button>
      </div>

      {/* Items list */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Playlist Items ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <p className="text-muted-foreground">No videos in this playlist yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add videos from your library below.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item, index) => (
                  <SortablePlaylistItem
                    key={item.id}
                    item={item}
                    position={index}
                    onRemove={onRemoveItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add videos section */}
      <div className="bg-card border border-border rounded-lg p-4">
        <button
          onClick={() => setShowAddSection(!showAddSection)}
          className="flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Videos to Playlist</span>
        </button>

        {showAddSection && (
          <div className="mt-4">
            {availableItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {libraryItems.length === 0
                  ? 'No videos in your library. Add videos to your library first.'
                  : 'All available videos are already in this playlist.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableItems.map((libItem) => (
                  <div
                    key={libItem.id}
                    className="flex items-center gap-3 bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {libItem.videoName || 'Unknown video'}
                      </div>
                      {libItem.funscriptName && (
                        <div className="text-sm text-muted-foreground truncate">
                          {libItem.funscriptName}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-sm text-muted-foreground">
                      {formatDuration(libItem.duration)}
                    </div>
                    <button
                      onClick={() => handleAddItem(libItem.id)}
                      disabled={isAdding}
                      className="flex-shrink-0 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
