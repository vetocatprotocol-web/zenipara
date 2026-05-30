import { useEffect, useRef, useState, type ComponentType } from 'react';
import Button from '../common/Button';
import { Download, Printer } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

interface Props {
  posJaga: { nama: string; qr_token: string };
}

type QRCodeLikeProps = {
  value: string;
  size?: number;
};

/**
 * Menampilkan QR statis pos jaga lengkap dengan nama pos.
 * Mendukung cetak dan unduh PNG/JPG agar mudah dipasang di pos jaga.
 */
export default function PosJagaQRCode({ posJaga }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const showNotification = useUIStore((s) => s.showNotification);
  const [QRCodeComponent, setQRCodeComponent] = useState<ComponentType<QRCodeLikeProps> | null>(null);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      const mod = await import('react-qr-code');
      if (!disposed) {
        setQRCodeComponent(() => mod.default as ComponentType<QRCodeLikeProps>);
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, []);

  const buildFilename = (ext: 'png' | 'jpg') => {
    const base = posJaga.nama
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pos-jaga';
    return `qr-pos-jaga-${base}.${ext}`;
  };

  const drawWrappedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ) => {
    const words = text.split(' ');
    let line = '';
    let lineY = y;

    words.forEach((word) => {
      const testLine = `${line}${word} `;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && line) {
        ctx.fillText(line.trim(), x, lineY);
        line = `${word} `;
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) {
      ctx.fillText(line.trim(), x, lineY);
      lineY += lineHeight;
    }

    return lineY;
  };

  const handleDownloadImage = async (format: 'png' | 'jpeg') => {
    const wrapper = printRef.current;
    const svg = wrapper?.querySelector('svg');

    if (!wrapper || !svg) {
      showNotification('QR tidak ditemukan untuk diunduh', 'error');
      return;
    }

    try {
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Gagal membaca QR'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      const canvasWidth = 800;
      const canvasHeight = 980;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        throw new Error('Browser tidak mendukung export gambar');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, canvasWidth - 80, canvasHeight - 80);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 44px Arial';
      const titleBottom = drawWrappedText(ctx, posJaga.nama, canvasWidth / 2, 120, canvasWidth - 120, 52);

      const qrSize = 420;
      const qrX = (canvasWidth - qrSize) / 2;
      const qrY = Math.max(220, titleBottom + 24);
      ctx.drawImage(image, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#4b5563';
      ctx.font = '24px Arial';
      drawWrappedText(
        ctx,
        'Pindai QR ini menggunakan aplikasi KARYO OS untuk mencatat waktu keluar / kembali',
        canvasWidth / 2,
        qrY + qrSize + 60,
        canvasWidth - 140,
        34,
      );

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'png' ? undefined : 0.95;
      const dataUrl = canvas.toDataURL(mimeType, quality);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = buildFilename(format === 'png' ? 'png' : 'jpg');
      link.click();

      URL.revokeObjectURL(svgUrl);
      showNotification(`QR berhasil diunduh (${format === 'png' ? 'PNG' : 'JPG'})`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengunduh QR';
      showNotification(message, 'error');
    }
  };

  const handlePrint = () => {
    if (!QRCodeComponent) {
      showNotification('QR belum siap, tunggu sebentar lalu coba cetak lagi', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow || !printRef.current) {
      showNotification('Browser memblokir jendela cetak QR', 'error');
      return;
    }

    // Escape user-supplied name to prevent XSS in the document.write context
    const safeName = posJaga.nama
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const qrContent = printRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>QR Pos Jaga — ${safeName}</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px;
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              font-family: Arial, sans-serif; 
              background: white;
            }
            .wrap { 
              text-align: center; 
              padding: 32px; 
              border: 2px solid #333; 
              border-radius: 12px; 
              page-break-inside: avoid;
            }
            h2 { 
              margin: 0 0 24px; 
              font-size: 1.5rem; 
              color: #333;
            }
            img {
              display: block;
              margin: 0 auto;
            }
            p { 
              margin: 12px 0 0; 
              font-size: 0.85rem; 
              color: #666; 
            }
            @media print {
              body { padding: 0; }
              .wrap { border: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            ${qrContent}
          </div>
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 250);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={printRef} className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-surface bg-white">
        <h2 className="text-xl font-bold text-gray-900 text-center">{posJaga.nama}</h2>
        {QRCodeComponent ? (
          <QRCodeComponent value={posJaga.qr_token} size={200} />
        ) : (
          <div className="h-[200px] w-[200px] animate-pulse rounded-xl border border-surface bg-surface/40" aria-hidden="true" />
        )}
        <p className="text-xs text-gray-500 text-center max-w-[200px]">
          Pindai QR ini menggunakan aplikasi KARYO OS untuk mencatat waktu keluar / kembali
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Printer className="w-4 h-4" />}
        onClick={handlePrint}
        disabled={!QRCodeComponent}
      >
        Cetak QR
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={() => void handleDownloadImage('png')}
        >
          Unduh PNG
        </Button>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={() => void handleDownloadImage('jpeg')}
        >
          Unduh JPG
        </Button>
      </div>
    </div>
  );
}
