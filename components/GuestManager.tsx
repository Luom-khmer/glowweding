
import React from 'react';
import { motion } from 'framer-motion';
import { SavedInvitation } from '../types';
import { Copy, Trash2, ExternalLink, FolderOpen, Eye, Pencil, FileSpreadsheet, Wrench } from 'lucide-react';
import { Button } from './Button';

interface GuestManagerProps {
  invitations: SavedInvitation[];
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  onView: (invitation: SavedInvitation) => void;
  onEdit: (invitation: SavedInvitation) => void;
}

export const GuestManager: React.FC<GuestManagerProps> = ({ invitations, onDelete, onCreateNew, onView, onEdit }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép: ' + text);
  };

  const copyToolLink = (invId: string) => {
      // Tạo link tool riêng: domain/?mode=tool&invitationId=...
      const toolLink = `${window.location.origin}?mode=tool&invitationId=${invId}`;
      copyToClipboard(toolLink);
  };

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
           <h2 className="text-3xl font-bold text-gray-800 serif">Quản Lý Đơn Hàng</h2>
           <p className="text-gray-500">Danh sách các mẫu thiệp đã thiết kế cho khách hàng.</p>
        </div>
        <Button onClick={onCreateNew}>+ Tạo Mẫu Mới</Button>
      </div>
      
      {/* Thông báo hướng dẫn Google Sheet */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-start gap-3">
         <FileSpreadsheet className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
         <div>
            <h4 className="font-bold text-blue-800 text-sm">Quản lý RSVP bằng Google Sheets?</h4>
            <p className="text-sm text-blue-700">
                Để khách hàng nhận được danh sách người tham dự vào Google Sheet của họ: 
                Hãy dán link <strong>Google Apps Script Webhook</strong> vào phần cài đặt trong lúc chỉnh sửa thiệp.
            </p>
         </div>
      </div>

      {invitations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
            <FolderOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Chưa có đơn hàng nào</h3>
            <p className="text-gray-500 mb-6">Hãy thiết kế một mẫu thiệp và lưu lại cho khách hàng đầu tiên.</p>
            <Button variant="outline" onClick={onCreateNew}>Chọn Mẫu Ngay</Button>
        </div>
      ) : (
        <div className="grid gap-4">
            {invitations.map((inv) => (
                <motion.div 
                    key={inv.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:shadow-md"
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg text-rose-700 truncate">{inv.customerName}</span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">{inv.createdAt}</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2 truncate">
                             Dâu rể: {inv.data.groomName} & {inv.data.brideName}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-200 w-full md:w-fit max-w-full">
                             <ExternalLink className="w-3 h-3 flex-shrink-0" />
                             <a href={inv.link} target="_blank" rel="noopener noreferrer" className="truncate hover:text-rose-600 hover:underline">
                                {inv.link}
                             </a>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
                         {/* Nút gửi tool cho khách */}
                         <button
                            onClick={() => copyToolLink(inv.id)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium transition"
                            title="Copy link Tool tạo tên khách (Gửi cho Dâu Rể)"
                        >
                            <Wrench className="w-4 h-4" /> <span className="hidden lg:inline text-xs">Link Tool</span>
                        </button>

                        <div className="w-px h-6 bg-gray-300 mx-1 hidden md:block"></div>

                        <button
                            onClick={() => onEdit(inv)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-medium transition"
                            title="Chỉnh sửa"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onView(inv)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition"
                            title="Xem như khách mời"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => copyToClipboard(inv.link)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 font-medium transition"
                            title="Copy link thiệp gốc"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => {
                                if(window.confirm('Bạn có chắc muốn xóa đơn hàng này không? Hành động này không thể hoàn tác.')) onDelete(inv.id);
                            }}
                            className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Xóa đơn hàng"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            ))}
        </div>
      )}
    </div>
  );
};
