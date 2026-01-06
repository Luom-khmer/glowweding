
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Link as LinkIcon, Copy, Check, Eye } from 'lucide-react';

interface LinkGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string; // Link gốc của thiệp (vd: domain.com?invitationId=xyz)
  isStandalone?: boolean; // Chế độ hiển thị riêng biệt (cho khách hàng dùng tool)
}

export const LinkGeneratorModal: React.FC<LinkGeneratorModalProps> = ({ isOpen, onClose, baseUrl, isStandalone = false }) => {
  const [guestName, setGuestName] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Reset khi mở lại
  useEffect(() => {
    if (isOpen) {
      setGuestName('');
      setGeneratedLink('');
      setIsCopied(false);
    }
  }, [isOpen]);

  const handleGenerate = () => {
    if (!guestName.trim()) return;
    // Tạo link: BaseURL + &guestName=TenKhach
    // Cần xử lý xem baseUrl đã có '?' chưa
    const separator = baseUrl.includes('?') ? '&' : '?';
    const link = `${baseUrl}${separator}guestName=${encodeURIComponent(guestName.trim())}`;
    setGeneratedLink(link);
    setIsCopied(false);
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center px-4 ${isStandalone ? 'bg-rose-50' : 'bg-black/70 backdrop-blur-sm'}`}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#7d1f2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-rose-900"
      >
        {/* Header */}
        <div className="relative pt-8 pb-4 text-center">
            {!isStandalone && (
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 text-white/70 hover:text-white p-2"
                >
                    <X />
                </button>
            )}
            
            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center border-4 border-rose-200 mb-3 shadow-lg">
                <LinkIcon className="w-10 h-10 text-[#7d1f2a]" />
            </div>
            
            <h2 className="text-white font-bold text-xl uppercase tracking-wider font-serif">
                Công Cụ Tạo Link
            </h2>
            <h3 className="text-rose-200 text-sm font-medium">GLOW WEDDING</h3>
        </div>

        {/* Body Form */}
        <div className="bg-white m-2 rounded-xl p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-center mb-4">
                <p className="text-amber-800 text-sm font-medium">
                    Nhập tên khách mời để tạo thiệp riêng cho từng người.
                </p>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Tên Khách Mời:</label>
                <input 
                    type="text" 
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nhập tên khách (VD: Bạn Tuấn Anh)"
                    className="w-full px-3 py-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#7d1f2a] focus:border-[#7d1f2a] outline-none text-gray-800 text-lg font-medium"
                    autoFocus
                />
            </div>

            <button 
                onClick={handleGenerate}
                className="w-full bg-[#7d1f2a] hover:bg-[#5e161f] text-white font-bold py-3 rounded uppercase text-sm shadow-md transition-all active:scale-95"
            >
                Tạo Link Ngay
            </button>

            {/* Result Box */}
            <div className="border-2 border-dashed border-[#7d1f2a] rounded-lg p-3 min-h-[80px] bg-rose-50/50 flex items-center justify-center text-center relative mt-2">
                {generatedLink ? (
                    <span className="text-sm text-gray-700 break-all font-medium">{generatedLink}</span>
                ) : (
                    <span className="text-sm text-gray-400 italic">Link sau khi tạo sẽ hiện ở đây...</span>
                )}
            </div>

            {generatedLink && (
                <button 
                    onClick={handleCopy}
                    className={`w-full ${isCopied ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-800'} text-white font-bold py-3 rounded uppercase text-sm shadow-md transition-all flex items-center justify-center gap-2`}
                >
                    {isCopied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                    {isCopied ? "Đã Copy" : "Copy Link"}
                </button>
            )}
        </div>

        {/* Footer Instructions / Preview Button for Standalone */}
        <div className="px-6 pb-6 pt-2">
             {isStandalone ? (
                 <button 
                    onClick={onClose} // onClose in standalone acts as "View Card"
                    className="w-full border border-white/30 text-white/90 hover:bg-white/10 hover:text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                 >
                    <Eye className="w-4 h-4" /> Xem Thiệp Gốc
                 </button>
             ) : (
                 <div className="text-white text-xs space-y-2 opacity-90 text-center">
                    <p>Bấm <strong>COPY</strong> và gửi link này cho khách mời.</p>
                 </div>
             )}
        </div>

      </motion.div>
    </div>
  );
};
