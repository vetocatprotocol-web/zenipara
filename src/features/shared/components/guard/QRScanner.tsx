import { useEffect, useRef } from 'react';

export default function QRScanner({ onScan }: { onScan: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let scanner: { clear: () => Promise<void> } | null = null;

    const startScanner = async () => {
      if (!ref.current) return;
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      if (disposed || !ref.current) return;

      const containerWidth = ref.current.offsetWidth || window.innerWidth;
      const qrBoxSize = Math.min(Math.floor(containerWidth * 0.7), 250);
      const nextScanner = new Html5QrcodeScanner(ref.current.id, { fps: 10, qrbox: qrBoxSize }, false);
      scanner = nextScanner;

      nextScanner.render(
        (decodedText: string) => {
          onScan(decodedText);
          void nextScanner.clear();
        },
        () => {},
      );
    };

    void startScanner();

    return () => {
      disposed = true;
      void scanner?.clear().catch(() => {});
    };
  }, [onScan]);

  return <div id="qr-guard-scanner" ref={ref} className="w-full h-64" />;
}
