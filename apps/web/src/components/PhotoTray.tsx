import { useRef, useState } from 'react';
import { MAX_PHOTOS } from '@collage/core';
import { useStudio } from '../state/store';
import { ACCEPT_ATTRIBUTE } from '../lib/images';
import { Section } from './ui';

export function PhotoTray() {
  const photos = useStudio((state) => state.photos);
  const loading = useStudio((state) => state.loading);
  const addFiles = useStudio((state) => state.addFiles);
  const removePhoto = useStudio((state) => state.removePhoto);
  const movePhoto = useStudio((state) => state.movePhoto);
  const shufflePhotos = useStudio((state) => state.shufflePhotos);
  const clearPhotos = useStudio((state) => state.clearPhotos);
  const select = useStudio((state) => state.select);
  const selected = useStudio((state) => state.selected);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const full = photos.length >= MAX_PHOTOS;

  return (
    <Section
      title="Photos"
      hint={`${photos.length} of ${MAX_PHOTOS} · drag the thumbnails to reorder`}
      action={
        <div className="section__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={shufflePhotos}
            disabled={photos.length < 2}
          >
            Shuffle
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={clearPhotos}
            disabled={photos.length === 0}
          >
            Clear
          </button>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void addFiles(files);
          event.target.value = '';
        }}
      />

      <div className="tray">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`tray__item${selected === index ? ' tray__item--active' : ''}${
              dragIndex === index ? ' tray__item--dragging' : ''
            }`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null) movePhoto(dragIndex, index);
              setDragIndex(null);
            }}
          >
            <button
              type="button"
              className="tray__thumb"
              onClick={() => select(index)}
              title={photo.name}
              aria-label={`Select ${photo.name}`}
            >
              <img src={photo.previewUrl} alt="" loading="lazy" />
              <span className="tray__index">{index + 1}</span>
            </button>
            <button
              type="button"
              className="tray__remove"
              onClick={() => removePhoto(photo.id)}
              aria-label={`Remove ${photo.name}`}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          className="tray__add"
          onClick={() => inputRef.current?.click()}
          disabled={full || loading}
          title={full ? `A collage holds up to ${MAX_PHOTOS} photos` : 'Add photos'}
        >
          <span aria-hidden="true">+</span>
          <span className="tray__add-label">{loading ? 'Loading…' : 'Add photos'}</span>
        </button>
      </div>
    </Section>
  );
}
