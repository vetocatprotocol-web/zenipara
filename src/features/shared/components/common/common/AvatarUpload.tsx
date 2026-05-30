import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { uploadAvatar } from '../../lib/api/users';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { readSessionContext } from '../../lib/sessionContext';
import { notifyDataChanged } from '../../lib/dataSync';

interface AvatarUploadProps {
  onSuccess?: (url: string) => void;
}

/**
 * Komponen upload foto profil.
 * - Mendukung drag-and-drop atau klik untuk memilih file
 * - Preview sebelum upload
 * - Upload ke Supabase Storage bucket "avatars"
 * - Update kolom foto_url di tabel users
 */
export default function AvatarUpload({ onSuccess }: AvatarUploadProps) {
  const { user, restoreSession } = useAuthStore();
  const sessionContext = readSessionContext();
  const { showNotification } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      showNotification('File harus berupa gambar (JPG, PNG, WebP)', 'error');
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      showNotification('Ukuran file maksimal 2 MB', 'error');
      return false;
    }
    return true;
  };

  const handleFile = (file: File) => {
    if (!validateFile(file)) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    const activeUserId = user?.id ?? sessionContext?.user_id;
    if (!selectedFile || !activeUserId) return;
    setIsUploading(true);
    try {
      const { publicUrl } = await uploadAvatar(activeUserId, selectedFile);

      // Re-sync session so authStore.user.foto_url is updated
      await restoreSession();
      notifyDataChanged('users');

      showNotification('Foto profil berhasil diperbarui', 'success');
      setPreview(null);
      setSelectedFile(null);
      onSuccess?.(publicUrl);
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal mengunggah foto',
        'error',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentAvatar = preview ?? user?.foto_url;

  return (
    <div className="space-y-4">
      {/* Current / preview avatar */}
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/10 flex items-center justify-center flex-shrink-0">
          {currentAvatar ? (
            <img
              src={currentAvatar}
              alt="Foto profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-3xl font-bold text-primary">
              {user?.nama?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-sm text-text-muted space-y-1">
          <p className="font-medium text-text-primary">Foto Profil</p>
          <p>Format: JPG, PNG, WebP</p>
          <p>Maks: 2 MB</p>
        </div>
      </div>

      {/* Dropzone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/10'
              : 'border-surface/70 bg-surface/20 hover:border-primary/50 hover:bg-surface/40'
          }`}
        >
          <Camera className="h-6 w-6 text-text-muted" aria-hidden="true" />
          <p className="text-sm text-text-muted text-center">
            Klik atau seret foto ke sini untuk mengganti foto profil
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Pilih foto profil"
          />
        </div>
      )}

      {/* Actions when file is selected */}
      {preview && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUploading}
            className="flex-1 rounded-xl border border-surface/70 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-primary hover:text-text-primary disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isUploading ? 'Mengunggah...' : 'Simpan Foto'}
          </button>
        </div>
      )}
    </div>
  );
}
