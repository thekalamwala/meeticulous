import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import ImageCropper from '../ImageCropper';

vi.mock('../../../services/api', () => ({ uploadImage: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

describe('ImageCropper (empty state)', () => {
  it('renders the dropzone and a disabled Save until a photo is chosen', () => {
    const { getByText } = render(
      <ImageCropper aspect={1} folder="profiles" onUploaded={() => {}} onClose={() => {}} label="Profile Photo" />
    );
    expect(getByText('Click to choose a photo')).toBeTruthy();
    const save = getByText('Save').closest('button');
    expect(save.disabled).toBe(true);
  });

  it('shows the correct ratio hint for cover vs profile', () => {
    const { getByText, rerender } = render(
      <ImageCropper aspect={1} folder="profiles" onUploaded={() => {}} onClose={() => {}} label="Profile Photo" />
    );
    expect(getByText('Square · shown as a circle')).toBeTruthy();
    rerender(
      <ImageCropper aspect={3} folder="covers" onUploaded={() => {}} onClose={() => {}} label="Cover Photo" />
    );
    expect(getByText('3:1 banner · top of your profile')).toBeTruthy();
  });

  it('closes on Cancel', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <ImageCropper aspect={1} folder="profiles" onUploaded={() => {}} onClose={onClose} label="Profile Photo" />
    );
    fireEvent.click(getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
