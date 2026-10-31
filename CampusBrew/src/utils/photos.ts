import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Takes or picks a photo and returns it as a ~1024 px JPEG data URI (what the
 * application endpoints accept), or null if the user cancelled. Throws with a
 * readable message when permission is refused.
 */
export async function pickPhoto(source: 'camera' | 'library', camera: 'front' | 'back' = 'back'): Promise<string | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(`Allow ${source === 'camera' ? 'camera' : 'photo'} access to add this photo.`);
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    cameraType: camera === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const resize = asset.width >= asset.height ? { width: 1024 } : { height: 1024 };
  const small = await manipulateAsync(asset.uri, [{ resize }], {
    compress: 0.6,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/jpeg;base64,${small.base64}`;
}
