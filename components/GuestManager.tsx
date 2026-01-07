
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SavedInvitation } from '../types';
import { Copy, Trash2, ExternalLink, FolderOpen, Eye, Pencil, FileSpreadsheet, Wrench, ChevronDown, ChevronUp, Code, Link as LinkIcon, Check, X, Table, RefreshCw, Zap } from 'lucide-react';
import { Button } from './Button';
import { invitationService } from '../services/invitationService';

interface GuestManagerProps {
  invitations: SavedInvitation[];
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  onView: (invitation: SavedInvitation) => void;
  onEdit: (invitation: SavedInvitation) => void;
}

// CẬP NHẬT SCRIPT GOOGLE: Thêm hàm doGet để xử lý việc lấy Link (ổn định hơn POST)
const APPS_SCRIPT_CODE = `// 1. Hàm xử lý khi Web hỏi lấy Link (Method GET)
function doGet(e) {
  // Trả về JSON cho Web
  if (e.parameter.checkConnection) {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService
      .createTextOutput(JSON.stringify({ 
          'result': 'success', 
          'sheetUrl': doc.getUrl() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. Hàm xử lý khi Web gửi dữ liệu khách (Method POST)
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Logic lưu thông tin khách mời
    var nextRow = sheet.getLastRow() + 1;
    var newRow = [
      data.submittedAt || new Date(),
      data.guestName,
      data.guestRelation,
      data.attendance,
      data.guestWishes
    ];

    sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);

    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'success', 'row': nextRow }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': e }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  finally {
    lock.releaseLock();
  }
}`;

export const GuestManager: React.FC<GuestManagerProps> = ({ invitations, onDelete, onCreateNew, onView, onEdit }) => {
  const [showScript, setShowScript] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState(''); // Script URL (User nhập tay)
  const [sheetViewUrlInput, setSheetViewUrlInput] = useState(''); // View URL (Tự động lấy)
  const [isSavingSheet, setIsSavingSheet] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép!');
  };

  const copyToolLink = (invId: string) => {
      const toolLink = `${window.location.origin}?mode=tool&invitationId=${invId}`;
      copyToClipboard(toolLink);
  };

  const openSheetConfig = (inv: SavedInvitation) => {
      setEditingSheetId(inv.id);
      setSheetUrlInput(inv.data.googleSheetUrl || '');
      setSheetViewUrlInput(inv.data.sheetViewUrl || '');
  };

  // HÀM MỚI: Sử dụng GET request thay vì POST để tránh lỗi CORS khi chỉ đọc dữ liệu
  const autoDetectSheetLink = async () => {
      if (!sheetUrlInput || !sheetUrlInput.includes('/exec')) {
          alert("Vui lòng nhập Link Apps Script chính xác trước (kết thúc bằng /exec)");
          return;
      }

      setIsAutoDetecting(true);
      try {
          // Sử dụng GET request với query param
          // Google Apps Script redirect 302, fetch mặc định follow redirect này
          const response = await fetch(`${sheetUrlInput}?checkConnection=true`);
          
          if (!response.ok) {
              throw new Error("Network response was not ok");
          }

          const data = await response.json();
          
          if (data && data.sheetUrl) {
              setSheetViewUrlInput(data.sheetUrl);
              alert("✅ Thành công! Đã tìm thấy Link File Google Sheet.");
          } else {
              throw new Error("Dữ liệu trả về không đúng định dạng");
          }
      } catch (e) {
          console.error(e);
          alert("⚠️ Lỗi kết nối!\n\nQUAN TRỌNG: Bạn cần cập nhật code trong Google Sheet và tạo BẢN TRIỂN KHAI MỚI.\n\nCách làm:\n1. Copy mã mới bên dưới -> Dán vào Script.\n2. Bấm 'Triển khai' (Deploy) -> 'Tùy chọn triển khai mới' (New Deployment).\n3. Bấm 'Triển khai' -> Copy link mới dán vào đây.");
      } finally {
          setIsAutoDetecting(false);
      }
  };

  const saveSheetConfig = async (inv: SavedInvitation) => {
      setIsSavingSheet(true);
      try {
          const newData = { 
              ...inv.data, 
              googleSheetUrl: sheetUrlInput,
              sheetViewUrl: sheetViewUrlInput
          };
          await invitationService.updateInvitation(inv.id, inv.customerName, newData);
          
          // Cập nhật UI tạm thời
          inv.data.googleSheetUrl = sheetUrlInput; 
          inv.data.sheetViewUrl = sheetViewUrlInput;
          setEditingSheetId(null);
          alert("Đã lưu cấu hình Google Sheet thành công!");
      } catch (e) {
          alert("Lỗi lưu cấu hình.");
      } finally {
          setIsSavingSheet(false);
      }
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
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-8 shadow-sm">
         <div className="flex items-start gap-3">
             <FileSpreadsheet className="w-8 h-8 text-green-600 mt-1 flex-shrink-0" />
             <div className="flex-1">
                <h4 className="font-bold text-blue-800 text-base mb-2">Quy trình kết nối Google Sheets (Làm cho mỗi khách mới):</h4>
                <ol className="text-sm text-blue-700 list-decimal ml-4 space-y-2 mb-4">
                    <li>Tạo 1 file <strong>Google Sheet mới</strong> cho khách hàng này.</li>
                    <li>Vào menu <strong>Tiện ích mở rộng (Extensions)</strong> &rarr; <strong>Apps Script</strong>.</li>
                    <li>
                        Copy đoạn mã bên dưới và dán đè vào trình soạn thảo code.
                        <button 
                            onClick={() => setShowScript(!showScript)}
                            className="ml-2 inline-flex items-center text-xs bg-white border border-blue-200 px-2 py-1 rounded text-blue-600 font-bold hover:bg-blue-50"
                        >
                            <Code className="w-3 h-3 mr-1" /> {showScript ? 'Ẩn Mã' : 'Xem & Copy Mã'} {showScript ? <ChevronUp className="w-3 h-3 ml-1"/> : <ChevronDown className="w-3 h-3 ml-1"/>}
                        </button>
                    </li>
                    <AnimatePresence>
                        {showScript && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }} 
                                animate={{ height: 'auto', opacity: 1 }} 
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="relative mt-2 mb-2">
                                    <pre className="bg-slate-800 text-slate-100 p-4 rounded-md text-xs font-mono overflow-x-auto border border-slate-700">
                                        {APPS_SCRIPT_CODE}
                                    </pre>
                                    <button 
                                        onClick={() => copyToClipboard(APPS_SCRIPT_CODE)}
                                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs flex items-center gap-1 backdrop-blur-sm"
                                    >
                                        <Copy className="w-3 h-3" /> Copy
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <li className="font-bold text-red-600">QUAN TRỌNG: Bấm "Triển khai" (Deploy) &rarr; "Tùy chọn triển khai mới" (New Deployment).</li>
                    <li>Chọn loại: <strong>Ứng dụng Web</strong>. Quyền truy cập: <strong>Bất kỳ ai (Anyone)</strong>.</li>
                    <li>Bấm Triển khai và <strong>Copy URL ứng dụng web</strong> (kết thúc bằng <code>/exec</code>).</li>
                    <li>Quay lại đây, bấm nút <strong>Kết nối Sheet</strong> &rarr; Dán link vào ô số 1 &rarr; Bấm "Tự động lấy Link".</li>
                </ol>
             </div>
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
                        
                        {/* Status Bar */}
                        <div className="flex flex-wrap gap-2 text-xs">
                             <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-500 max-w-[200px]">
                                 <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                 <a href={inv.link} target="_blank" rel="noopener noreferrer" className="truncate hover:text-rose-600 hover:underline">
                                    Xem Thiệp
                                 </a>
                             </div>
                             
                             {/* Sheet Connection Status */}
                             <div 
                                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors ${inv.data.googleSheetUrl ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'}`}
                                onClick={() => openSheetConfig(inv)}
                                title={inv.data.googleSheetUrl ? "Đã kết nối Sheet. Bấm để sửa." : "Chưa kết nối Sheet. Bấm để thêm."}
                             >
                                 <FileSpreadsheet className="w-3 h-3" />
                                 {inv.data.googleSheetUrl ? 'Đã nối Sheet' : 'Chưa nối Sheet'}
                             </div>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end mt-2 md:mt-0">
                         {/* Nếu đã có Link Sheet View thì hiện nút Copy gửi khách */}
                         {inv.data.sheetViewUrl && (
                             <button
                                onClick={() => copyToClipboard(inv.data.sheetViewUrl!)}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 font-medium transition shadow-sm border border-green-200"
                                title="Copy link Google Sheet gửi cho Cô Dâu Chú Rể"
                            >
                                <Table className="w-4 h-4" /> <span className="hidden lg:inline text-xs font-bold">Copy Link Báo Cáo</span>
                            </button>
                         )}

                         <button
                            onClick={() => copyToolLink(inv.id)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium transition"
                            title="Lấy Link gửi cho khách"
                        >
                            <LinkIcon className="w-4 h-4" /> <span className="hidden lg:inline text-xs font-bold">Lấy Link Mời</span>
                        </button>

                        <div className="w-px h-6 bg-gray-300 mx-1 hidden md:block"></div>

                        <button
                            onClick={() => onEdit(inv)}
                            className="p-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition"
                            title="Sửa nội dung thiệp"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => {
                                if(window.confirm('Bạn có chắc muốn xóa đơn hàng này không? Hành động này không thể hoàn tác.')) onDelete(inv.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Xóa đơn hàng"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            ))}
        </div>
      )}

      {/* MODAL CẤU HÌNH SHEET */}
      <AnimatePresence>
          {editingSheetId && (
              <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
                  onClick={() => setEditingSheetId(null)}
              >
                  <motion.div 
                      initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                      className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg"
                      onClick={e => e.stopPropagation()}
                  >
                      <div className="flex justify-between items-center mb-4 border-b pb-3">
                          <div className="flex items-center gap-2">
                              <div className="bg-green-100 p-2 rounded-lg"><FileSpreadsheet className="w-6 h-6 text-green-700" /></div>
                              <h3 className="font-bold text-lg text-gray-900">Kết Nối Google Sheet</h3>
                          </div>
                          <button onClick={() => setEditingSheetId(null)} className="text-gray-400 hover:text-gray-600"><X /></button>
                      </div>
                      
                      <div className="space-y-4">
                          {/* INPUT 1: Script URL */}
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">1. Link Apps Script (Quan trọng)</label>
                              <p className="text-xs text-gray-500 mb-2">Link kết thúc bằng <code>/exec</code>. Hãy đảm bảo bạn đã cập nhật mã Script mới và chọn "Triển khai mới".</p>
                              <input 
                                  type="text" 
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono text-sm"
                                  placeholder="https://script.google.com/macros/s/.../exec"
                                  value={sheetUrlInput}
                                  onChange={(e) => setSheetUrlInput(e.target.value)}
                                  autoFocus
                              />
                          </div>

                          {/* INPUT 2: Sheet View URL (AUTO DETECT) */}
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700">2. Link File Sheet Gốc</label>
                                <button 
                                    onClick={autoDetectSheetLink}
                                    disabled={isAutoDetecting || !sheetUrlInput}
                                    className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full hover:bg-amber-200 font-bold border border-amber-200 disabled:opacity-50 transition-all shadow-sm"
                                >
                                    {isAutoDetecting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-600" />}
                                    {isAutoDetecting ? 'Đang lấy...' : 'Tự động lấy Link'}
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">Bấm nút vàng ở trên để hệ thống tự điền link này cho bạn.</p>
                              <input 
                                  type="text" 
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono text-sm bg-white"
                                  placeholder="https://docs.google.com/spreadsheets/d/..."
                                  value={sheetViewUrlInput}
                                  onChange={(e) => setSheetViewUrlInput(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6">
                          <Button variant="ghost" onClick={() => setEditingSheetId(null)}>Hủy</Button>
                          <button 
                              onClick={() => {
                                  const targetInv = invitations.find(i => i.id === editingSheetId);
                                  if (targetInv) saveSheetConfig(targetInv);
                              }}
                              disabled={isSavingSheet}
                              className="bg-green-600 text-white px-4 py-2 rounded-full font-medium hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200"
                          >
                              {isSavingSheet ? "Đang lưu..." : <><Check className="w-4 h-4" /> Lưu Kết Nối</>}
                          </button>
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};
