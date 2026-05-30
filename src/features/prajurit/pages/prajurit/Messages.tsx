import { useMemo, useState } from 'react';
import { Inbox, Pencil, Send, Users, Clock3 } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import UserSearchSelect from '../../components/common/UserSearchSelect';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import { useMessages } from '../../hooks/useMessages';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import type { Message } from '../../types';
import Input from '../../components/common/Input';

type Tab = 'inbox' | 'sent';

export default function Messages() {
  const { user } = useAuthStore();
  const { showNotification } = useUIStore();
  const { inbox, sent, unreadCount, isLoading, error, sendMessage, markAsRead, markAllAsRead } = useMessages();

  const [tab, setTab] = useState<Tab>('inbox');
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [searchRaw, setSearchRaw] = useState('');
  const [composeForm, setComposeForm] = useState({ to_user: '', isi: '' });
  const [replyText, setReplyText] = useState('');

  const openComposeForUser = (toUserId: string, isi = '') => {
    setComposeForm({ to_user: toUserId, isi });
    setShowCompose(true);
  };

  const handleOpenMessage = async (msg: Message) => {
    setSelectedMsg(msg);
    setReplyText('');
    if (!msg.is_read && tab === 'inbox') {
      await markAsRead(msg.id);
    }
  };

  const handleQuickReply = async () => {
    if (!selectedMsg?.from_user || !replyText.trim()) {
      showNotification('Tulis balasan terlebih dahulu', 'error');
      return;
    }

    setIsReplying(true);
    try {
      await sendMessage(selectedMsg.from_user, replyText);
      showNotification('Balasan terkirim', 'success');
      setReplyText('');
    } catch {
      showNotification('Gagal mengirim balasan', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  const handleSend = async () => {
    if (!composeForm.to_user || !composeForm.isi.trim()) {
      showNotification('Pilih penerima dan tulis pesan', 'error');
      return;
    }
    setIsSending(true);
    try {
      await sendMessage(composeForm.to_user, composeForm.isi);
      showNotification('Pesan terkirim', 'success');
      setShowCompose(false);
      setComposeForm({ to_user: '', isi: '' });
      setTab('sent');
    } catch {
      showNotification('Gagal mengirim pesan', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const messages = tab === 'inbox' ? inbox : sent;
  const filteredMessages = useMemo(() => {
    const q = searchRaw.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((msg) => {
      const contact = tab === 'inbox' ? msg.sender : msg.receiver;
      return msg.isi.toLowerCase().includes(q)
        || (contact?.nama?.toLowerCase().includes(q) ?? false)
        || (contact?.nrp?.includes(q) ?? false);
    });
  }, [messages, searchRaw, tab]);

  const recentContacts = useMemo(() => {
    const seen = new Map<string, { id: string; nama: string; nrp?: string; pangkat?: string; created_at: string; snippet: string }>();

    [...inbox, ...sent].forEach((msg) => {
      const contact = msg.from_user === user?.id ? msg.receiver : msg.sender;
      if (!contact?.id) return;

      const prev = seen.get(contact.id);
      if (!prev || new Date(msg.created_at).getTime() > new Date(prev.created_at).getTime()) {
        seen.set(contact.id, {
          id: contact.id,
          nama: contact.nama,
          nrp: contact.nrp,
          pangkat: contact.pangkat,
          created_at: msg.created_at,
          snippet: msg.isi,
        });
      }
    });

    return [...seen.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  }, [inbox, sent, user?.id]);

  const inboxCount = inbox.length;
  const sentCount = sent.length;
  const selectedDirection = selectedMsg
    ? selectedMsg.from_user === user?.id
      ? 'sent'
      : 'inbox'
    : tab;

  return (
    <DashboardLayout title="Pesan">
      <div className="space-y-4">
        <PageHeader
          title="Pesan"
          subtitle="Komunikasi internal satuan dengan status baca dan riwayat percakapan."
          meta={
            <>
              <span>Belum dibaca: {unreadCount}</span>
              <span>Masuk: {inboxCount}</span>
              <span>Terkirim: {sentCount}</span>
            </>
          }
          actions={
            <>
              {tab === 'inbox' && unreadCount > 0 && (
                <Button size="sm" variant="ghost" onClick={markAllAsRead}>
                  Tandai semua dibaca
                </Button>
              )}
              <Button onClick={() => setShowCompose(true)} leftIcon={<Pencil className="h-4 w-4" />}>Tulis Pesan</Button>
            </>
          }
        />

        {error && (
          <div className="rounded-2xl border border-accent-red/30 bg-accent-red/5 px-4 py-3 text-sm text-accent-red">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Belum dibaca</p>
            <p className="mt-1 text-2xl font-bold text-primary">{unreadCount}</p>
            <p className="mt-1 text-xs text-text-muted">Pesan masuk yang perlu perhatian.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Kotak masuk</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{inboxCount}</p>
            <p className="mt-1 text-xs text-text-muted">Riwayat pesan yang diterima.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Terkirim</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{sentCount}</p>
            <p className="mt-1 text-xs text-text-muted">Pesan yang sudah Anda kirim.</p>
          </div>
        </div>

        {/* Tab bar + actions */}
        <div className="app-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div role="tablist" aria-label="Pesan" className="flex gap-1 rounded-lg bg-surface/40 p-1">
            {(['inbox', 'sent'] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {t === 'inbox' ? 'Masuk' : 'Terkirim'}
                {t === 'inbox' && unreadCount > 0 && (
                  <span className="ml-1.5 bg-accent-red text-white text-xs rounded-full px-1.5 py-0.5" aria-label={`${unreadCount} belum dibaca`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Input
            type="text"
            placeholder="Cari nama atau isi pesan..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="sm:max-w-sm"
          />
        </div>

        {recentContacts.length > 0 && (
          <div className="app-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Kontak terbaru</p>
                <p className="text-xs text-text-muted">Mulai pesan baru ke personel yang baru saja berinteraksi dengan Anda.</p>
              </div>
              <Users className="h-4 w-4 text-text-muted" aria-hidden="true" />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {recentContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => openComposeForUser(contact.id)}
                  className="flex min-w-[14rem] items-start gap-3 rounded-2xl border border-surface/70 bg-bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(contact.nama ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {contact.pangkat ? `${contact.pangkat} ` : ''}{contact.nama}
                    </p>
                    <p className="truncate text-xs text-text-muted">{contact.nrp ?? 'NRP tidak tersedia'}</p>
                    <p className="mt-1 truncate text-xs text-text-muted">{contact.snippet}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {isLoading ? (
          <LoadingSpinner message="Memuat pesan..." />
        ) : filteredMessages.length === 0 ? (
          <EmptyState
            icon={tab === 'inbox'
              ? <Inbox className="h-6 w-6" aria-hidden="true" />
              : <Send className="h-6 w-6" aria-hidden="true" />}
            title={searchRaw.trim()
              ? 'Tidak ada pesan yang cocok'
              : tab === 'inbox' ? 'Kotak masuk kosong' : 'Belum ada pesan terkirim'}
            description={searchRaw.trim()
              ? 'Coba kata kunci lain'
              : tab === 'inbox' ? 'Pesan masuk dari anggota satuan akan muncul di sini.' : 'Pesan yang Anda kirim akan tampil di sini.'}
          />
        ) : (
          <div className="space-y-2">
            {filteredMessages.map((msg) => {
              const isUnread = tab === 'inbox' && !msg.is_read;
              const contact = tab === 'inbox' ? msg.sender : msg.receiver;
              return (
                <button
                  key={msg.id}
                  onClick={() => handleOpenMessage(msg)}
                  className={`app-card w-full p-4 text-left transition-colors hover:border-primary/50 ${
                    isUnread ? 'border-primary/30' : 'border-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0 text-sm">
                        {(contact?.nama ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isUnread ? 'text-text-primary' : 'text-text-muted'}`}>
                            {tab === 'inbox' ? 'Dari' : 'Kepada'}: {contact?.nama ?? '—'}
                          </span>
                          {isUnread && <Badge variant="info" size="sm">Baru</Badge>}
                        </div>
                        <p className={`text-sm mt-0.5 truncate ${isUnread ? 'font-medium text-text-primary' : 'text-text-muted'}`}>
                          {msg.isi}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-text-muted flex-shrink-0">
                      {new Date(msg.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      <Modal
        isOpen={!!selectedMsg}
        onClose={() => setSelectedMsg(null)}
        title={selectedDirection === 'inbox' ? `Pesan dari ${selectedMsg?.sender?.nama ?? '—'}` : `Pesan ke ${selectedMsg?.receiver?.nama ?? '—'}`}
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setSelectedMsg(null)}>Tutup</Button>
        }
      >
        {selectedMsg && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
              <span>{new Date(selectedMsg.created_at).toLocaleString('id-ID')}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-surface/70 bg-surface/30 px-2.5 py-1 text-xs">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {selectedDirection === 'inbox' ? (selectedMsg.is_read ? 'Sudah dibaca' : 'Belum dibaca') : 'Pesan terkirim'}
              </span>
            </div>
            <div className="bg-surface/30 rounded-lg p-4 text-text-primary whitespace-pre-line">
              {selectedMsg.isi}
            </div>
            {selectedDirection === 'inbox' && selectedMsg.from_user && (
              <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Balas cepat</p>
                  <p className="text-xs text-text-muted">Kirim balasan langsung tanpa menutup pesan ini.</p>
                </div>
                <textarea
                  className="form-control min-h-24"
                  rows={4}
                  placeholder="Tulis balasan singkat..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleQuickReply}
                    isLoading={isReplying}
                    leftIcon={<Send className="h-4 w-4" />}
                  >
                    Kirim Balasan
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => openComposeForUser(selectedMsg.from_user ?? '', '')}
                  >
                    Buka Editor Lengkap
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Compose Modal */}
      <Modal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        title="Tulis Pesan Baru"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCompose(false)}>Batal</Button>
            <Button onClick={handleSend} isLoading={isSending}>Kirim</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="compose-to" className="text-sm font-semibold text-text-primary">Kepada *</label>
            <UserSearchSelect
              className="mt-1 space-y-2"
              value={composeForm.to_user}
              onChange={(toUser) => setComposeForm({ ...composeForm, to_user: toUser })}
              isActive
              excludeUserId={user?.id}
              emptyLabel="Pilih penerima..."
              placeholder="Cari nama/NRP penerima..."
              showRole
            />
          </div>
          <div>
            <label htmlFor="compose-isi" className="text-sm font-semibold text-text-primary">Pesan *</label>
            <textarea
              id="compose-isi"
              className="form-control mt-1 min-h-28"
              rows={5}
              placeholder="Tuliskan pesan Anda..."
              value={composeForm.isi}
              onChange={(e) => setComposeForm({ ...composeForm, isi: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
