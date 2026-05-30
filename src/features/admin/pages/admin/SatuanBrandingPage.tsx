import React, { useEffect, useState } from 'react';
import useSatuanBranding from '../../hooks/useSatuanBranding';
import { supabase } from '../../lib/supabase';
import type { SatuanBranding } from '../../types';

const SatuanBrandingPage: React.FC = () => {
  const { branding, isLoading, error, updateBranding } = useSatuanBranding();
  const [form, setForm] = useState<SatuanBranding>({ nama_pendek: '', warna_primer: '', logo_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const filePath = `satuan-logos/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('satuan-logos').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const urlRes = supabase.storage.from('satuan-logos').getPublicUrl(data.path);
      setForm({ ...form, logo_url: urlRes.data.publicUrl });
    } catch (err) {
      alert('Gagal mengunggah logo: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (branding) setForm({ nama_pendek: branding.nama_pendek ?? '', warna_primer: branding.warna_primer ?? '', logo_url: branding.logo_url ?? '' });
  }, [branding]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBranding(form);
      alert('Branding disimpan');
    } catch (err) {
      alert('Gagal menyimpan branding: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Branding Satuan</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="grid gap-2 max-w-md">
        <label>
          Nama Pendek
          <input name="nama_pendek" value={form.nama_pendek} onChange={handleChange} className="block w-full border rounded px-2 py-1" />
        </label>
        <label>
          Warna Primer
          <input name="warna_primer" value={form.warna_primer} onChange={handleChange} className="block w-full border rounded px-2 py-1" />
        </label>
        <label>
          Logo URL
          <input name="logo_url" value={form.logo_url} onChange={handleChange} className="block w-full border rounded px-2 py-1" />
        </label>
        <label>
          Unggah Logo
          <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="block w-full mt-1" />
          {uploading && <div className="text-sm text-text-muted">Mengunggah...</div>}
        </label>
        <div>
          <button onClick={handleSave} disabled={saving || isLoading} className="bg-blue-600 text-white px-3 py-1 rounded">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SatuanBrandingPage;
