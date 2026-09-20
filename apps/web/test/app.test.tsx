import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { extensionFor, formatBytes, FORMAT_LABELS } from '../src/render/export';
import { isSupportedImage } from '../src/lib/images';

describe('app shell', () => {
  it('renders the brand and the empty state', () => {
    render(<App />);
    expect(screen.getByText('Collage Studio')).toBeDefined();
    expect(screen.getByText('Drop your photos here')).toBeDefined();
  });

  it('exposes every settings panel', () => {
    render(<App />);
    for (const title of ['Photos', 'Format', 'Layout', 'Style', 'Framing', 'Export']) {
      expect(screen.getByText(title)).toBeDefined();
    }
  });

  it('offers the standard aspect ratios', () => {
    render(<App />);
    for (const label of ['1:1', '4:5', '9:16', '16:9', '3:2']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('disables the download button until there are photos', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Download collage' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe('export helpers', () => {
  it('maps formats to file extensions', () => {
    expect(extensionFor('jpeg')).toBe('jpg');
    expect(extensionFor('png')).toBe('png');
    expect(extensionFor('webp')).toBe('webp');
  });

  it('labels every format', () => {
    expect(Object.keys(FORMAT_LABELS).sort()).toEqual(['jpeg', 'png', 'webp']);
  });

  it('formats byte counts', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('file filtering', () => {
  it('accepts images and rejects anything else', () => {
    expect(isSupportedImage(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedImage(new File([], 'a.heic', { type: '' }))).toBe(true);
    expect(isSupportedImage(new File([], 'notes.txt', { type: 'text/plain' }))).toBe(false);
  });
});
