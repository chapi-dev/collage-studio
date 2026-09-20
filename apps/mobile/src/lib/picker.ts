import * as ImagePicker from 'expo-image-picker';
import type { PickedAsset } from '../state/store';

/**
 * Opens the system photo library. Returns an empty array when the user cancels
 * and throws a user facing message when permission is denied.
 */
export async function pickPhotos(limit: number): Promise<PickedAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow access to your photos to build a collage.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
    exif: false,
    quality: 1,
  });

  if (result.canceled) return [];

  return result.assets
    .filter((asset) => asset.width > 0 && asset.height > 0)
    .map((asset) => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      assetId: asset.assetId,
      fileName: asset.fileName,
    }));
}
