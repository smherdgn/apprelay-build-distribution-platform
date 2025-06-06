
import React from 'react';
import GlassCard from './ui/GlassCard';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  url: string; 
  altText?: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ url, altText = "QR Code for build download" }) => {
  return (
    <GlassCard className="p-4 flex flex-col items-center">
      {url && url !== "#" ? (
        <div className="bg-white p-2 rounded-lg inline-block border-2 border-slate-600">
          <QRCodeSVG
            value={url}
            size={144} // 144px -> results in a 160x160 image with padding for a w-40 h-40 container
            bgColor={"#ffffff"}
            fgColor={"#0f172a"} // slate-900
            level={"L"} // Error correction level
            includeMargin={false} 
          />
        </div>
      ) : (
        <div 
            className="w-40 h-40 rounded-lg border-2 border-slate-600 bg-slate-700 flex items-center justify-center text-slate-400 text-xs text-center"
            aria-label="QR Code not available"
        >
            QR Code not available (No valid URL)
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3 text-center">
        {url && url !== "#" ? altText : "Download URL not available for QR code."}
      </p>
    </GlassCard>
  );
};

export default QRCodeDisplay;