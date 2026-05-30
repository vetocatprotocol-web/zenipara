import { useEffect, useState, type ComponentType } from 'react';

interface Props {
  qrToken: string;
}

type QRCodeLikeProps = {
  value: string;
  size?: number;
};

const GatePassQRCode: React.FC<Props> = ({ qrToken }) => {
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

  return (
    <div className="flex flex-col items-center">
      {QRCodeComponent ? (
        <QRCodeComponent value={qrToken} size={128} />
      ) : (
        <div className="h-32 w-32 animate-pulse rounded-lg border border-surface bg-surface/40" aria-hidden="true" />
      )}
      <div className="text-xs mt-2">Tunjukkan QR ini ke pos jaga</div>
    </div>
  );
};

export default GatePassQRCode;
