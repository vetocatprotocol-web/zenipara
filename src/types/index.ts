// ============================================================
// Core Types
// ============================================================

// ============================================================
// Gate Pass
// ============================================================

export type GatePassStatus =
  | 'pending'
  | 'approved'
  | 'cancelled'
  | 'rejected'
  | 'checked_in'
  | 'completed'
  | 'out'
  | 'returned'
  | 'overdue';

export interface GatePass {
  id: string;
  user_id: string;
  keperluan: string;
  tujuan: string;
  actual_keluar?: string;
  actual_kembali?: string;
  status: GatePassStatus;
  approved_by?: string;
  submit_latitude?: number;
  submit_longitude?: number;
  submit_accuracy?: number;
  qr_token: string;
  created_at: string;
  // Joined field (populated when fetched with user join)
  user?: User;
}

export type Role = 'super_admin' | 'admin_satuan' | 'komandan' | 'prajurit' | 'guard' | 'admin' | 'staf';
export type CommandLevel = 'BATALION' | 'KOMPI' | 'PELETON';

export interface SatuanBranding {
  logo_url?: string;
  warna_primer?: string;
  nama_pendek?: string;
}

export interface Satuan {
  id: string;
  nama: string;
  kode_satuan: string;
  tingkat?: 'battalion' | 'company' | 'squad' | 'detachment';
  branding?: SatuanBranding;
  logo_url?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'approved' | 'rejected';
export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpa' | 'dinas_luar';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

// ============================================================
// User
// ============================================================

export interface User {
  id: string;
  nrp: string;
  nama: string;
  role: Role;
  force_change_pin?: boolean;
  level_komando?: CommandLevel;
  pangkat?: string;
  jabatan?: string;
  satuan: string;
  satuan_id?: string;
  foto_url?: string;
  is_active: boolean;
  is_online: boolean;
  login_attempts: number;
  locked_until?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
  // Extended profile fields
  tempat_lahir?: string;
  tanggal_lahir?: string;
  no_telepon?: string;
  alamat?: string;
  tanggal_masuk_dinas?: string;
  pendidikan_terakhir?: string;
  agama?: string;
  status_pernikahan?: 'lajang' | 'menikah' | 'cerai' | 'duda' | 'janda';
  golongan_darah?: 'A' | 'B' | 'AB' | 'O';
  // Admin-only fields
  nomor_ktp?: string;
  catatan_khusus?: string;
  // Emergency contact
  kontak_darurat_nama?: string;
  kontak_darurat_telp?: string;
}

// ============================================================
// Task
// ============================================================

export interface Task {
  id: string;
  judul: string;
  deskripsi?: string;
  assigned_to?: string;
  assigned_by?: string;
  status: TaskStatus;
  prioritas: 1 | 2 | 3;
  deadline?: string;
  satuan?: string;
  satuan_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee?: User;
  assigner?: User;
}

export interface TaskReport {
  id: string;
  task_id: string;
  user_id: string;
  isi_laporan: string;
  file_url?: string;
  submitted_at: string;
  task?: Task;
  user?: User;
}

// ============================================================
// Attendance
// ============================================================

export interface Attendance {
  id: string;
  user_id: string;
  tanggal: string;
  check_in?: string;
  check_out?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_accuracy?: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_out_accuracy?: number;
  status: AttendanceStatus;
  keterangan?: string;
  created_at: string;
  user?: User;
}

// ============================================================
// Kalender Kegiatan Satuan
// ============================================================

export type KegiatanJenis = 'latihan' | 'upacara' | 'inspeksi' | 'perjalanan' | 'rapat' | 'lainnya';
export type RsvpStatus = 'hadir' | 'tidak_hadir' | 'belum';

export interface Kegiatan {
  id: string;
  satuan: string;
  satuan_id?: string;
  judul: string;
  deskripsi?: string;
  jenis: KegiatanJenis;
  tanggal_mulai: string;
  tanggal_selesai: string;
  lokasi?: string;
  target_role?: string[];
  is_wajib: boolean;
  created_by?: string;
  created_at: string;
  rsvp_hadir?: number;
  rsvp_tidak_hadir?: number;
  rsvp_total?: number;
  my_rsvp?: RsvpStatus;
}

// ============================================================
// Laporan Operasional (Laphar)
// ============================================================

export type LaporanOpsJenis = 'harian' | 'insidentil' | 'latihan' | 'inspeksi' | 'lainnya';
export type LaporanOpsStatus = 'draft' | 'diajukan' | 'diketahui' | 'diarsipkan';

export interface LaporanOps {
  id: string;
  nomor_laporan?: string;
  satuan: string;
  jenis: LaporanOpsJenis;
  tanggal_kejadian: string;
  waktu_kejadian?: string;
  lokasi?: string;
  judul: string;
  uraian: string;
  tindakan?: string;
  rekomendasi?: string;
  status: LaporanOpsStatus;
  dibuat_oleh?: string;
  diketahui_oleh?: string;
  diketahui_at?: string;
  created_at: string;
  pembuat?: Pick<User, 'id' | 'nama' | 'nrp' | 'pangkat'>;
}

export type ApelJenis = 'pagi' | 'siang' | 'malam' | 'upacara';
export type ApelStatus = 'hadir' | 'terlambat' | 'absen' | 'dinas_luar' | 'izin';

export interface ApelSession {
  id: string;
  satuan: string;
  jenis: ApelJenis;
  tanggal: string;
  waktu_buka: string;
  waktu_tutup: string;
  created_by?: string;
  created_at: string;
  hadir_count?: number;
  terlambat_count?: number;
  total_tercatat?: number;
}

export interface ApelAttendance {
  id: string;
  session_id: string;
  user_id: string;
  status: ApelStatus;
  check_in_at?: string;
  keterangan?: string;
  created_at: string;
  user?: Pick<User, 'id' | 'nama' | 'nrp' | 'pangkat'>;
}

// ============================================================
// Leave Request
// ============================================================

export interface LeaveRequest {
  id: string;
  user_id: string;
  jenis_izin: 'cuti' | 'sakit' | 'dinas_luar';
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan: string;
  status: LeaveStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  user?: User;
  reviewer?: User;
}

// ============================================================
// Announcement
// ============================================================

export interface Announcement {
  id: string;
  judul: string;
  isi: string;
  target_role?: Role[];
  target_satuan?: string;
  satuan_id?: string;
  created_by?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
  creator?: User;
}

// ============================================================
// Message
// ============================================================

export interface Message {
  id: string;
  from_user?: string;
  to_user?: string;
  isi: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
  receiver?: User;
}

// ============================================================
// Logistics
// ============================================================

export interface LogisticsItem {
  id: string;
  nama_item: string;
  kategori?: string;
  jumlah: number;
  satuan_item?: string;
  kondisi?: 'baik' | 'rusak_ringan' | 'rusak_berat';
  lokasi?: string;
  catatan?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Audit Log
// ============================================================

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource?: string;
  resource_id?: string;
  detail?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: User;
}

// ============================================================
// Shift Schedule
// ============================================================

export interface ShiftSchedule {
  id: string;
  user_id: string;
  tanggal: string;
  shift_mulai: string;
  shift_selesai: string;
  jenis_shift?: 'pagi' | 'siang' | 'malam' | 'jaga';
  created_by?: string;
  created_at: string;
  user?: User;
}

// ============================================================
// Document
// ============================================================

export interface Document {
  id: string;
  nama: string;
  kategori?: string;
  file_url: string;
  file_size?: number;
  satuan?: string;
  satuan_id?: string;
  uploaded_by?: string;
  created_at: string;
  uploader?: User;
}

// ============================================================
// Discipline Note
// ============================================================

export interface DisciplineNote {
  id: string;
  user_id: string;
  jenis?: 'peringatan' | 'penghargaan' | 'catatan';
  isi: string;
  created_by?: string;
  created_at: string;
  user?: User;
  creator?: User;
}

// ============================================================
// Pos Jaga (Static QR Guard Post)
// ============================================================

export interface PosJaga {
  id: string;
  nama: string;
  qr_token: string;
  is_active: boolean;
  created_at: string;
}

/** Result returned by the `scan_pos_jaga` RPC */
export interface ScanPosJagaResult {
  gate_pass_id: string;
  pos_nama: string;
  status: GatePassStatus;
  message: string;
}

// ============================================================
// Auth Session
// ============================================================

export interface KaryoSession {
  user_id: string;
  role: Role;
  satuan_id: string | null;
  expires_at: string;
}

// ============================================================
// Logistics Request
// ============================================================

export type LogisticsRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LogisticsRequest {
  id: string;
  requested_by: string;
  satuan: string;
  satuan_id?: string;
  nama_item: string;
  jumlah: number;
  satuan_item?: string;
  alasan: string;
  status: LogisticsRequestStatus;
  admin_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  requester?: User;
  reviewer?: User;
}

// ============================================================
// Sprint (Surat Perintah)
// ============================================================

export type SprintStatus = 'draft' | 'approved' | 'active' | 'selesai' | 'dibatalkan';

export interface Sprint {
  id: string;
  nomor_surat: string;
  satuan: string;
  judul: string;
  dasar?: string;
  tujuan: string;
  tempat_tujuan: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  status: SprintStatus;
  dibuat_oleh?: string;
  disetujui_oleh?: string;
  disetujui_at?: string;
  created_at: string;
  pembuat?: Pick<User, 'id' | 'nama' | 'nrp' | 'pangkat'>;
  jumlah_personel: number;
}

export interface SprintPersonel {
  sprint_id: string;
  user_id: string;
  jabatan_dalam_sprint?: string;
  laporan_kembali?: string;
  kembali_at?: string;
  user_info?: Pick<User, 'id' | 'nama' | 'nrp' | 'pangkat' | 'jabatan'>;
}
