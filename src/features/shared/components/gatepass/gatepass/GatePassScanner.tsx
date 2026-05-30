import React, { useEffect, useRef } from 'react';

interface Props {
  onScan: (qrToken: string) => void;
}

const GatePassScanner: React.FC<Props> = ({ onScan }) => {
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let scanner: { clear: () => Promise<void> } | null = null;

    const startScanner = async () => {
      if (!scannerRef.current) return;
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      if (disposed || !scannerRef.current) return;

      const nextScanner = new Html5QrcodeScanner(
        scannerRef.current.id,
        { fps: 10, qrbox: 250 },
        false,
      );
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

  return <div id="gatepass-scanner" ref={scannerRef} className="w-full h-64" />;
};
export default GatePassScanner;
