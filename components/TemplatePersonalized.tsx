import React, { useEffect, useState, useRef } from 'react';
import { InvitationData } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Save, Upload, Check, Music, ZoomIn, ZoomOut, RotateCw, Heart, Loader2, Link, UploadCloud } from 'lucide-react';
import { Button } from './Button';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { convertSolarToLunarFull } from '../utils/lunar';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface TemplatePersonalizedProps {
  data: InvitationData;
  onSave?: (newData: InvitationData) => void;
  onAutosave?: (newData: InvitationData) => void; // Autosave Prop
  readonly?: boolean; 
  invitationId?: string; 
  guestName?: string; 
}

interface EditingFieldState {
    key: keyof InvitationData | 'mapUrl' | 'googleSheetUrl';
    label: string;
    value: string;
    fontSize?: number;
}

export const TemplatePersonalized: React.FC<TemplatePersonalizedProps> = ({ data: initialData, onSave, onAutosave, readonly = false, invitationId, guestName }) => {
  const [localData, setLocalData] = useState<InvitationData>(initialData);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingField, setEditingField] = useState<EditingFieldState | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  
  // State for Animation Trigger
  const [isOpening, setIsOpening] = useState(false);

  // Scaling Logic
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // State for RSVP & Bank Popups
  const [showBankPopup, setShowBankPopup] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // --- RSVP STATE ---
  const [guestNameInput, setGuestNameInput] = useState(guestName || '');
  const [guestRelation, setGuestRelation] = useState(''); 
  const [guestWishes, setGuestWishes] = useState('');
  const [attendance, setAttendance] = useState('Có Thể Tham Dự');
  const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false);

  // --- CROPPER STATE ---
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [currentAspect, setCurrentAspect] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const activeImageFieldRef = useRef<string | null>(null);

  // --- SCALING EFFECT ---
  useEffect(() => {
    const handleResize = () => {
        const windowWidth = window.innerWidth;
        const DESIGN_WIDTH = 420;
        
        if (windowWidth < DESIGN_WIDTH) {
            setScale(windowWidth / DESIGN_WIDTH);
        } else {
            setScale(1);
        }
    };

    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- AUTOSAVE LOGIC ---
  useEffect(() => {
    // Chỉ autosave nếu đang ở chế độ chỉnh sửa và không phải readonly
    if (!isEditMode || readonly || !onAutosave) return;

    // Set status to saving immediately when data changes
    setSaveStatus('saving');

    const timer = setTimeout(() => {
        onAutosave(localData);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [localData, isEditMode, onAutosave, readonly]);

  // Auto-play and Opening Effect
  useEffect(() => {
    // Start opening immediately
    const timer = setTimeout(() => {
        setIsOpening(true);
        if (audioRef.current && !isPlaying) {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Music Handler
  const handleMusicClick = () => {
      if (isEditMode && !readonly) {
          musicInputRef.current?.click();
      } else {
          if (audioRef.current) {
            if (isPlaying) {
              audioRef.current.pause();
            } else {
              audioRef.current.play().catch(e => console.log("Audio play failed:", e));
            }
            setIsPlaying(!isPlaying);
          }
      }
  };

  const handleMusicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // KIỂM TRA DUNG LƯỢNG FILE: Giới hạn 800KB để an toàn cho Firestore (Max 1MB document)
          if (file.size > 800 * 1024) {
              alert("⚠️ File nhạc quá lớn!\nFirestore giới hạn lưu trữ 1MB/thiệp.\nVui lòng chọn file nhạc < 800KB hoặc cắt ngắn file mp3.");
              return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              setLocalData(prev => ({ ...prev, musicUrl: result }));
              setTimeout(() => {
                if(audioRef.current) {
                    audioRef.current.load();
                    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
              }, 100);
          };
          reader.readAsDataURL(file);
      }
  }

  // Text Editor
  const openTextEditor = (field: keyof InvitationData | 'mapUrl' | 'googleSheetUrl', label: string, defaultFontSize: number = 14) => {
    if (!isEditMode || readonly) return;
    // @ts-ignore
    const currentValue = localData[field] !== undefined ? localData[field] : '';
    const currentFontSize = localData.elementStyles?.[field]?.fontSize || defaultFontSize;

    setEditingField({
        key: field,
        label: label,
        value: String(currentValue),
        fontSize: currentFontSize
    });
  };

  const saveTextChange = () => {
      if (editingField) {
          const newData = { ...localData, [editingField.key]: editingField.value };
          
          if (editingField.key === 'date') {
            const newLunarString = convertSolarToLunarFull(editingField.value);
            if (newLunarString) {
                newData.lunarDate = newLunarString;
            }
          }

          if (editingField.fontSize) {
              newData.elementStyles = {
                  ...newData.elementStyles,
                  [editingField.key]: {
                      ...(newData.elementStyles?.[editingField.key] || {}),
                      fontSize: editingField.fontSize
                  }
              };
          }
          setLocalData(newData);
          setEditingField(null);
      }
  };

  // Image Upload & Crop
  const triggerImageUpload = (field: string, aspect: number = 1) => {
    if (!isEditMode || readonly) return;
    activeImageFieldRef.current = field;
    setCurrentAspect(aspect);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
        setIsCropping(true);
        setZoom(1);
        setRotation(0);
        setCrop({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const performCrop = async () => {
      if (!cropImageSrc || !croppedAreaPixels || !activeImageFieldRef.current) return;
      try {
          const croppedImageBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels, rotation);
          if (!croppedImageBase64) return;
          
          // Explicit cast to prevent TS error
          const currentField = activeImageFieldRef.current as string;
          
          setLocalData(prev => {
            const newData = { ...prev };
            if (currentField === 'mainImage') newData.imageUrl = croppedImageBase64;
            else if (currentField === 'centerImage') newData.centerImage = croppedImageBase64;
            else if (currentField === 'footerImage') newData.footerImage = croppedImageBase64;
            else if (currentField === 'mapImage') newData.mapImageUrl = croppedImageBase64; 
            else if (currentField === 'qrCode') newData.qrCodeUrl = croppedImageBase64; 
            else if (currentField.startsWith('albumImages-')) {
                 const parts = currentField.split('-');
                 const index = parseInt(parts[1], 10);
                 // FIX: Tạo mảng mới và lấp đầy khoảng trống bằng chuỗi rỗng để tránh undefined
                 const newAlbum = [...(prev.albumImages || [])];
                 while (newAlbum.length <= index) newAlbum.push(""); 
                 newAlbum[index] = croppedImageBase64;
                 newData.albumImages = newAlbum;
            } else if (currentField.startsWith('galleryImages-')) {
                const parts = currentField.split('-');
                const index = parseInt(parts[1], 10);
                // FIX: Tạo mảng mới và lấp đầy khoảng trống bằng chuỗi rỗng để tránh undefined
                const newGallery = [...(prev.galleryImages || [])];
                while (newGallery.length <= index) newGallery.push(""); 
                newGallery[index] = croppedImageBase64;
                newData.galleryImages = newGallery;
            }
            return newData;
        });
        setIsCropping(false);
        setCropImageSrc(null);
        activeImageFieldRef.current = null;
      } catch (e) { console.error(e); }
  };

  const handleSave = () => {
      setIsEditMode(false);
      if (onSave) onSave(localData);
  };

  const handleRSVPSubmit = async () => {
      if (!guestNameInput.trim()) {
          alert("Bạn quên nhập tên rồi nè!");
          return;
      }

      setIsSubmittingRSVP(true);
      try {
          // 1. Lưu vào Firebase Firestore
          if (invitationId) {
              await addDoc(collection(db, "rsvps"), {
                  invitationId: invitationId,
                  guestName: guestNameInput,
                  guestRelation,
                  guestWishes,
                  attendance,
                  createdAt: new Date().toISOString()
              });
          } else {
              // Demo mode logic
              console.log("Demo Saved:", { guestName: guestNameInput, guestRelation, guestWishes, attendance });
              await new Promise(resolve => setTimeout(resolve, 500));
          }

          // 2. Gửi sang Google Sheet (Dynamic)
          const sheetUrl = localData.googleSheetUrl;
          if (sheetUrl && sheetUrl.startsWith("http")) {
             fetch(sheetUrl, {
                method: 'POST',
                mode: 'no-cors', 
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    guestName: guestNameInput,
                    guestRelation,
                    guestWishes,
                    attendance,
                    submittedAt: new Date().toLocaleString('vi-VN')
                })
             }).catch(err => console.error("Lỗi gửi Google Sheet:", err));
          }

          setShowSuccessModal(true);
          // Reset form
          setGuestNameInput('');
          setGuestWishes('');
          setGuestRelation('');
      } catch (error) {
          console.error("Error saving RSVP:", error);
          alert("Có lỗi xảy ra, vui lòng thử lại sau!");
      } finally {
          setIsSubmittingRSVP(false);
      }
  };

  // Helper Components
  const EditableWrapper = ({ children, field, label, isText = true, defaultFontSize = 14, className = "", style = {}, onClick, aspect = 1, ...props }: any) => {
      const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (onClick && !isEditMode) { onClick?.(); return; }
          if (!isEditMode || readonly) return;
          if (isText) openTextEditor(field, label, defaultFontSize);
          else triggerImageUpload(field, aspect);
      };
      const storedStyle = localData.elementStyles?.[field] || {};
      const appliedStyle: React.CSSProperties = { ...style, fontSize: `${storedStyle.fontSize || defaultFontSize}px` };
      const editStyle: React.CSSProperties = (isEditMode && !readonly) ? { ...appliedStyle, border: '2px dashed #ef4444', backgroundColor: 'rgba(255, 255, 255, 0.4)', zIndex: 100, cursor: 'pointer', boxShadow: '0 0 10px rgba(255,0,0,0.2)' } : { cursor: onClick ? 'pointer' : 'default', ...appliedStyle };

      // NOTE: Removed transition-all from className to avoid conflict with framer-motion transforms
      return (
          <motion.div className={`${className} relative`} style={editStyle} onClick={handleClick} {...props}>
              {children}
              {(isEditMode && !readonly) && <div className="absolute -top-3 -right-3 bg-rose-600 text-white rounded-full p-1 shadow-md z-50 scale-75">{isText ? <Pencil size={12} /> : <Upload size={12} />}</div>}
          </motion.div>
      )
  };

  const CinematicImage = ({ src, className = "", style, enableKenBurns = false, delay = 0 }: any) => {
      const isBase64 = src?.startsWith('data:');
      const shouldSkipEntry = isBase64;

      return (
          <div className={`w-full h-full overflow-hidden relative bg-gray-200 ${className}`} style={style}>
              <motion.img
                  key={src}
                  src={src}
                  className="w-full h-full object-cover"
                  alt="Wedding content"
                  initial={shouldSkipEntry ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 1.2, filter: 'blur(5px)' }}
                  whileInView={shouldSkipEntry ? undefined : { 
                      opacity: 1, 
                      scale: 1, 
                      filter: 'blur(0px)',
                      transition: { duration: 1.2, ease: "easeOut", delay: delay } 
                  }}
                  animate={enableKenBurns ? {
                      scale: [1, 1.1],
                      transition: {
                        duration: 15,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "reverse",
                      }
                  } : undefined}
                  viewport={{ once: true }}
              />
          </div>
      );
  };

  // Helper Data
  const safeDate = localData.date || new Date().toISOString().split('T')[0];
  const [year, month, day] = safeDate.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const daysOfWeek = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayOfWeek = daysOfWeek[dateObj.getDay()];

  const getAlbumImg = (idx: number) => localData.albumImages?.[idx] || 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop';
  const getGalleryImg = (idx: number) => localData.galleryImages?.[idx] || 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=600&auto=format&fit=crop';

  // --- CALENDAR LOGIC ---
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); 
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const calendarDays = [];
  for(let i=0; i<startOffset; i++) calendarDays.push(null);
  for(let i=1; i<=daysInMonth; i++) calendarDays.push(i);

  // Fonts and Styles - UPDATED WITH MONTSERRAT FOR MAP SECTION
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&display=swap');

    @font-face{font-family: "UTM-Cafeta"; src: url("https://statics.pancake.vn/web-media/04/eb/01/7a/e19221a44fabb6fd54c6339fd43b1c25ebbe20e97f6633beed4cbc79-w:0-h:0-l:31525-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "Ephesis-Regular"; src: url("https://statics.pancake.vn/web-media/65/48/68/4f/ca5a0c732f276b6fef504eddf0e2d6cdf65cf198b0440dde6d90c5a8-w:0-h:0-l:141767-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "SVN-Mightiest"; src: url("https://statics.pancake.vn/web-media/38/a8/63/6b/be3591beaa1faddc0f76fe23aac05f5d907411cd2b0e4652bc5ed081-w:0-h:0-l:23808-t:application/octet-stream.otf") format("opentype"); font-display:swap;}
    @font-face{font-family: "BlackMango-Medium"; src: url("https://statics.pancake.vn/web-media/f5/f1/41/aa/b6a0dd0c2a8cc07c0be70e066410a2cb9506e4ae9a3d88a8e238b53c-w:0-h:0-l:52546-t:application/octet-stream.otf") format("opentype"); font-display:swap;}
    @font-face{font-family: "UTM-Sloop"; src: url("https://statics.pancake.vn/web-media/bb/41/fd/fd/d607e5e05e3481a7e43e3f8e773d8f6d463215c4cab5107ce736fa5b-w:0-h:0-l:72326-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "UTM-Azkia"; src: url("https://statics.pancake.vn/web-media/35/7a/ab/a5/2bcc8b3414fa20782f68d8d552b13313f2a24e5b267a97b3cf3a5ec3-w:0-h:0-l:144903-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "AlexBrush-Regular"; src: url("https://statics.pancake.vn/web-media/7f/17/e9/f1/cb9ca1db4d08288384fa9e241cbc74923dcbb9c5701b6caf519deb13-w:0-h:0-l:115720-t:font/ttf.ttf") format("truetype"); font-display:swap;}
    
    .personalized-root { width: 420px; margin: 0 auto; background-color: #fff; overflow-x: hidden; font-family: 'Roboto', sans-serif; position: relative; color: #000; font-size: 12px; line-height: 1.5; }
    .abs { position: absolute; }
    .rel { position: relative; }
    .bg-cover { background-size: cover; background-position: center; background-repeat: no-repeat; width: 100%; height: 100%; }
    .animate-spin-slow { animation: spin-slow 10s linear infinite; }
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .inp-style { background: white; border: 1px solid rgba(142, 1, 1, 1); border-radius: 10px; color: rgba(153, 0, 0, 1); padding: 0 10px; width: 100%; height: 100%; outline: none; }
    .btn-red { background: rgba(177, 0, 0, 1); color: white; border-radius: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s; }
    .btn-red:active { transform: scale(0.95); }
    
    .section-container { width: 100%; background-position: center; background-size: cover; background-repeat: no-repeat; position: relative; }

    /* Calendar Grid Styles */
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 14px; color: #333; }
    .calendar-cell { height: 36px; display: flex; align-items: center; justify-content: center; position: relative; }
    @keyframes heart-beat { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
    .animate-heart-beat { animation: heart-beat 1.5s infinite; }
  `;

  // Animations (Matching Webcake)
  const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 1.5 } } };
  const fadeInUp = { hidden: { opacity: 0, y: 100 }, visible: { opacity: 1, y: 0, transition: { duration: 1.5 } } };
  const fadeInDown = { hidden: { opacity: 0, y: -100 }, visible: { opacity: 1, y: 0, transition: { duration: 1.5 } } };
  const fadeInLeft = { hidden: { opacity: 0, x: -100 }, visible: { opacity: 1, x: 0, transition: { duration: 1.5 } } };
  const fadeInRight = { hidden: { opacity: 0, x: 100 }, visible: { opacity: 1, x: 0, transition: { duration: 1.5 } } };
  const zoomIn = { hidden: { opacity: 0, scale: 0.3 }, visible: { opacity: 1, scale: 1, transition: { duration: 1.5 } } };
  const slideInLeft = { hidden: { x: '-100%' }, visible: { x: 0, transition: { duration: 1.5 } } };
  const slideInRight = { hidden: { x: '100%' }, visible: { x: 0, transition: { duration: 1.5 } } };
  const slideInUp = { hidden: { y: '100%', opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 1.5 } } };
  const pulse = { visible: { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 2 } } };

  // Curtain Variants (Open from center)
  const curtainLeftVar = {
    closed: { x: 0 },
    open: { x: '-100%', transition: { duration: 2.5, ease: [0.4, 0, 0.2, 1] } }
  };
  const curtainRightVar = {
    closed: { x: 0 },
    open: { x: '100%', transition: { duration: 2.5, ease: [0.4, 0, 0.2, 1] } }
  };

  // Delayed content appearance (Updated timing to match reference)
  const contentContainerVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 }, // Add subtle initial state
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { 
        duration: 2.5,
        ease: "easeOut",
        delay: 0.2,
        delayChildren: 2.2, // Updated delay to 2.2s
        staggerChildren: 0.15 // Updated stagger
      } 
    }
  };

  return (
    <div className="w-full flex justify-center bg-gray-100/50 overflow-hidden min-h-screen">
      <style>{css}</style>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
      <input type="file" ref={musicInputRef} style={{ display: 'none' }} accept="audio/*" onChange={handleMusicChange} />
      
      {/* Cropper Modal - MOVED OUTSIDE OF SCALED CONTAINER */}
      <AnimatePresence>
        {isCropping && cropImageSrc && (
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
                <div className="relative flex-1 w-full bg-black"><Cropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={currentAspect} rotation={rotation} onCropChange={setCrop} onCropComplete={(c, p) => setCroppedAreaPixels(p)} onZoomChange={setZoom} /></div>
                <div className="bg-white p-4 flex flex-col gap-3">
                     <div className="flex items-center gap-4">
                         <ZoomOut size={16} className="text-gray-400" />
                         <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                         <ZoomIn size={16} className="text-gray-400" />
                     </div>
                     <div className="flex items-center gap-4">
                         <RotateCw size={16} className="text-gray-400" />
                         <input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                     </div>
                     <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => { setIsCropping(false); setCropImageSrc(null); }}>Hủy</Button>
                        <Button className="flex-1" onClick={performCrop} icon={<Check className="w-4 h-4" />}>Cắt Ảnh</Button>
                     </div>
                </div>
            </div>
        )}
      </AnimatePresence>
      
      {/* Text Edit Modal - MOVED OUTSIDE OF SCALED CONTAINER */}
      <AnimatePresence>
          {editingField && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setEditingField(null)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold">Chỉnh sửa nội dung</h3><button onClick={() => setEditingField(null)}><X /></button></div>
                    <div className="mb-6 space-y-4">
                        {(editingField.key !== 'mapUrl' && editingField.key !== 'googleSheetUrl') && <input type="range" min="10" max="80" value={editingField.fontSize || 14} onChange={(e) => setEditingField({ ...editingField, fontSize: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg accent-rose-600" />}
                        {editingField.key === 'date' ? <input type="date" className="w-full p-2 border rounded" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} /> : 
                         editingField.key === 'time' ? <input type="time" className="w-full p-2 border rounded" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} /> :
                         (editingField.key === 'mapUrl' || editingField.key === 'googleSheetUrl') ? <input type="text" placeholder={editingField.key === 'googleSheetUrl' ? "Dán link Google Apps Script vào đây..." : "Dán link Google Maps vào đây..."} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} /> :
                         <textarea rows={4} className="w-full p-2 border rounded" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} />}
                    </div>
                    <div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setEditingField(null)}>Hủy</Button><Button onClick={saveTextChange}>Lưu</Button></div>
                </motion.div>
             </motion.div>
          )}
      </AnimatePresence>

      {/* Wrapper xử lý Scale */}
      <div 
        ref={containerRef}
        style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: '420px',
            marginBottom: `-${(1 - scale) * 3500}px` 
        }}
        className="shrink-0"
      >

      <div className="personalized-root shadow-2xl relative">
        <audio ref={audioRef} src={localData.musicUrl || "https://statics.pancake.vn/web-media/5e/ee/bf/4a/afa10d3bdf98ca17ec3191ebbfd3c829d135d06939ee1f1b712d731d-w:0-h:0-l:2938934-t:audio/mpeg.mp3"} loop />
        
        {/* EDIT BUTTON - HIDDEN IN READONLY */}
        {!readonly && (
            <div className="absolute top-4 right-4 z-[150] flex items-center gap-2">
                 {/* Autosave Status Badge */}
                 {isEditMode && saveStatus !== 'idle' && (
                     <motion.div 
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm"
                     >
                         {saveStatus === 'saving' ? (
                             <><UploadCloud className="w-3 h-3 animate-bounce" /> Đang lưu...</>
                         ) : (
                             <><Check className="w-3 h-3 text-green-400" /> Đã lưu</>
                         )}
                     </motion.div>
                 )}

                <button onClick={() => isEditMode ? handleSave() : setIsEditMode(true)} className={`p-2 backdrop-blur-md rounded-full shadow-sm transition-all ${isEditMode ? 'bg-rose-600 text-white shadow-rose-300' : 'bg-white/60 hover:bg-white text-gray-700 hover:text-rose-600'}`}>{isEditMode ? <Check className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}</button>
            </div>
        )}

        {/* --- CURTAINS (OPENING EFFECT) --- */}
        <div className="abs inset-0 z-[999] pointer-events-none overflow-hidden h-[800px]">
             {/* Left Curtain */}
             <motion.div 
                 variants={curtainLeftVar}
                 initial="closed"
                 animate={isOpening ? "open" : "closed"}
                 className="abs top-0 left-0 w-full h-full bg-cover"
                 style={{backgroundImage: 'url("https://statics.pancake.vn/web-media/0e/6c/18/fb/44e9347bb12368a07e646ad45939e6086fc1ce3b2b39c28663352c01-w:1260-h:2400-l:1296984-t:image/png.png")'}}
             />
             {/* Right Curtain */}
             <motion.div 
                 variants={curtainRightVar}
                 initial="closed"
                 animate={isOpening ? "open" : "closed"}
                 className="abs top-0 left-0 w-full h-full bg-cover"
                 style={{backgroundImage: 'url("https://statics.pancake.vn/web-media/fb/1a/3d/db/5397c85e01e68520b6e686acfb8f4b71fc813f563e456d159b222a3c-w:1260-h:2400-l:1301050-t:image/png.png")'}}
             />
        </div>

        {/* --- SECTION 1: HEADER --- */}
        <motion.div 
           className="section-container" 
           style={{ height: '800px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}
           initial="hidden"
           animate={isOpening ? "visible" : "hidden"}
           variants={contentContainerVariants}
        >
            <motion.div variants={zoomIn} className="abs" style={{top:'80px', left:'3.5px', width:'413px', height:'60px', zIndex: 10}}>
                <EditableWrapper field="groomName" label="Tên Dâu Rể" defaultFontSize={40} className="w-full text-center">
                    <h1 style={{fontFamily: 'UTM-Sloop, sans-serif', textShadow: '0px 4px 4px #fff', fontSize:'40px'}}>{localData.groomName || 'Anh Tú'} - {localData.brideName || 'Diệu Nhi'}</h1>
                </EditableWrapper>
            </motion.div>

            <motion.div variants={fadeInUp} className="abs" style={{top:'244.5px', left:'83px', width:'254px', height:'33px', zIndex: 10}}>
                 <EditableWrapper field="date" label="Ngày Cưới" defaultFontSize={22} className="w-full text-center">
                    <h2 style={{fontWeight:'bold', letterSpacing:'7px', fontSize:'22px'}}>{localData.date.split('-').reverse().join('.')}</h2>
                 </EditableWrapper>
            </motion.div>

            {/* RESTORED: THIỆP MỜI Text */}
            <motion.div variants={fadeInDown} className="abs" style={{top:'41.5px', left:'83px', width:'254px', height:'30px', zIndex: 50}}>
                 <EditableWrapper field="invitedTitle" label="Tiêu đề" defaultFontSize={20} className="w-full text-center">
                    <h2 style={{letterSpacing:'3px', fontSize:'20px', fontFamily: 'Roboto, sans-serif', color: '#000', fontWeight: 'bold'}}>{localData.invitedTitle || "THIỆP MỜI"}</h2>
                 </EditableWrapper>
            </motion.div>

            <EditableWrapper field="mainImage" isText={false} aspect={249/373} className="abs" style={{top:'286px', left:'85.5px', width:'249px', height:'373px', border:'7px solid #8e0101', zIndex: 10}}>
                <CinematicImage 
                    src={localData.imageUrl || 'https://statics.pancake.vn/web-media/ab/56/c3/d2/ae46af903d624877e4e71b00dc5ab4badaa10a8956d3c389ccbc73e9-w:1080-h:1620-l:151635-t:image/jpeg.jpeg'} 
                    enableKenBurns={true}
                />
            </EditableWrapper>

            <motion.div variants={fadeInUp} className="abs" style={{top:'222px', left:'83px', width:'254px', height:'22.5px', zIndex: 10}}>
                 <EditableWrapper field="time" label="Giờ" defaultFontSize={15} className="w-full text-center">
                    <h2 style={{fontSize:'15px'}}>{localData.time}</h2>
                 </EditableWrapper>
            </motion.div>

            {/* Decor */}
            <motion.div variants={fadeIn} className="abs bg-cover rounded-full" style={{top:'135px', left:'166.5px', width:'87px', height:'87px', backgroundImage: 'url("https://content.pancake.vn/1/s487x487/fwebp/c9/7c/2a/c5/5ba36c13eb69d83d80e92d1a2eee50cfee36e987297533b6480719a7-w:500-h:500-l:12182-t:image/png.png")'}}></motion.div>
            <motion.div variants={fadeIn} className="abs bg-cover rounded-full" style={{top:'178.7px', left:'312px', width:'87px', height:'87px', backgroundImage: 'url("https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png")'}}></motion.div>
            <motion.div variants={fadeIn} className="abs bg-cover rounded-full" style={{top:'178.7px', left:'19px', width:'87px', height:'87px', backgroundImage: 'url("https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png")'}}></motion.div>
            <motion.div variants={fadeIn} className="abs bg-cover" style={{top:'600.5px', left:'276px', width:'117px', height:'117px', backgroundImage: 'url("https://content.pancake.vn/1/fwebp/f5/0c/65/6f/daee3dc9b5487eb190fd88220ef5e6249cfe15ee9b4b145c97a89ee1-w:500-h:500-l:50319-t:image/png.png")'}}></motion.div>

            <motion.div variants={fadeInUp} className="abs w-full text-center" style={{top:'690px', left:'60px', width:'300px', height:'33px', zIndex: 10}}>
                <h2 style={{fontFamily:'SVN-Mightiest, sans-serif', fontSize:'22px'}}>Trân Trọng Kính Mời:</h2>
            </motion.div>

            <motion.div variants={fadeInUp} className="abs w-full text-center" style={{top:'731.8px', left:'60px', width:'300px', height:'48px', zIndex: 10}}>
                 {/* HIỂN THỊ TÊN KHÁCH MỜI TỪ URL */}
                 <h2 style={{fontFamily:'AlexBrush-Regular, sans-serif', fontSize:'32px', color:'#7d1f2a'}}>
                    {guestName ? guestName : (readonly ? "Khách Quý" : (isEditMode ? "[Tên Khách Mời]" : "Khách Quý"))}
                 </h2>
            </motion.div>
            <motion.div variants={zoomIn} className="abs" style={{top:'755.8px', left:'92px', width:'236px', borderBottom: '1px dotted #000'}}></motion.div>
        </motion.div>

        {/* --- SECTION 2: INFO --- */}
        <div className="section-container" style={{ height: '714px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
             <div className="abs bg-cover" style={{top:0, left:'167px', width:'86px', height:'86px', backgroundImage: 'url("https://statics.pancake.vn/web-media/5d/4d/ed/50/c176e3fd3e67b078488c02451f6a09af9fe9e929c4f113f5c162595e-w:500-h:500-l:22239-t:image/png.png")'}}></div>
             <div className="abs bg-cover" style={{top:'65px', left:'176px', width:'68px', height:'68px', backgroundImage: 'url("https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png")'}}></div>

             <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'243.5px', left:'58px', width:'304px'}}>
                <h2 style={{fontFamily:'BlackMango-Medium, sans-serif', fontSize:'14px', textAlign:'center'}}>Trân Trọng Báo Tin Lễ Thành Hôn Của</h2>
             </motion.div>

             <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'273.5px', left:'3.5px', width:'413px'}}>
                 <EditableWrapper field="groomName" label="Chú Rể" defaultFontSize={40} className="w-full text-center"><h1 style={{fontFamily:'UTM-Sloop, sans-serif', textShadow:'0 4px 4px #fff', fontSize:'40px'}}>{localData.groomName || 'Anh Tú'}</h1></EditableWrapper>
             </motion.div>
             <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'316px', left:'141.5px', width:'137px'}}>
                 <h1 style={{fontFamily:'UTM-Azkia, sans-serif', fontSize:'40px', textAlign:'center'}}>&</h1>
             </motion.div>
             <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'355px', left:'3.5px', width:'413px'}}>
                <EditableWrapper field="brideName" label="Cô Dâu" defaultFontSize={40} className="w-full text-center"><h1 style={{fontFamily:'UTM-Sloop, sans-serif', textShadow:'0 4px 4px #fff', fontSize:'40px'}}>{localData.brideName || 'Diệu Nhi'}</h1></EditableWrapper>
             </motion.div>

             <EditableWrapper field="centerImage" isText={false} aspect={354/269} className="abs" style={{top:'424.3px', left:'33px', width:'354px', height:'269px', border:'7px solid #8e0101'}}>
                <CinematicImage 
                    src={localData.centerImage || 'https://statics.pancake.vn/web-media/e2/8c/c5/37/905dccbcd5bc1c1b602c10c95acb9986765f735e075bff1097e7f457-w:736-h:981-l:47868-t:image/jpeg.jfif'} 
                    enableKenBurns={true} 
                    variants={slideInUp} 
                />
             </EditableWrapper>

             <motion.div variants={fadeInLeft} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'99px', left:0, width:'200px'}}>
                 <p style={{fontFamily:'UTM-Cafeta, sans-serif', fontSize:'16px'}}>NHÀ TRAI</p>
             </motion.div>
             <motion.div variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'99px', left:'220px', width:'200px'}}>
                 <p style={{fontFamily:'UTM-Cafeta, sans-serif', fontSize:'16px'}}>NHÀ GÁI</p>
             </motion.div>

             <motion.div variants={fadeInLeft} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'123px', left:0, width:'200px'}}>
                 <EditableWrapper field="groomFather" label="Cha Chú Rể" defaultFontSize={16}><span className="block font-cafeta" style={{fontFamily:'UTM-Cafeta, sans-serif', fontSize:'16px'}}>{localData.groomFather}</span></EditableWrapper>
                 <EditableWrapper field="groomMother" label="Mẹ Chú Rể" defaultFontSize={16}><span className="block font-cafeta" style={{fontFamily:'UTM-Cafeta, sans-serif', fontSize:'16px'}}>{localData.groomMother}</span></EditableWrapper>
             </motion.div>
             <motion.div variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'123px', left:'220px', width:'200px'}}>
                 <EditableWrapper field="brideFather" label="Cha Cô Dâu" defaultFontSize={16}><span className="block font-cafeta" style={{fontFamily:'UTM-Cafeta, sans-serif', fontSize:'16px'}}>{localData.brideFather}</span></EditableWrapper>
                 <EditableWrapper field="brideMother" label="Mẹ Cô Dâu" defaultFontSize={16}><span className="block font-cafeta" style={{fontFamily:'UTM-Cafeta, sans-serif', fontSize:'16px'}}>{localData.brideMother}</span></EditableWrapper>
             </motion.div>

             <motion.div variants={fadeInLeft} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'171px', left:'21.5px', width:'165px'}}>
                 <EditableWrapper field="groomAddress" label="Địa chỉ Trai" defaultFontSize={13}><p style={{fontSize:'13px'}}>{localData.groomAddress}</p></EditableWrapper>
             </motion.div>
             <motion.div variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'171px', left:'237.5px', width:'165px'}}>
                 <EditableWrapper field="brideAddress" label="Địa chỉ Gái" defaultFontSize={13}><p style={{fontSize:'13px'}}>{localData.brideAddress}</p></EditableWrapper>
             </motion.div>
        </div>

        {/* --- SECTION 3: TIME & CALENDAR --- */}
        <div className="section-container" style={{ height: '515px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'41.5px', left:'58px', width:'304px'}}>
                <h2 style={{fontFamily:'Ephesis-Regular, sans-serif', fontSize:'25px'}}>Trân Trọng Kính Mời</h2>
            </motion.div>
            
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'117.5px', left:'24.6px', width:'116px', height:'165px'}}>
                 <EditableWrapper field="galleryImages-0" isText={false} aspect={116/165} className="w-full h-full border-[3px] border-white shadow-md"><CinematicImage src={getGalleryImg(0)} enableKenBurns={true} /></EditableWrapper>
            </motion.div>
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'85.5px', left:'152px', width:'116px', height:'165px'}}>
                 <EditableWrapper field="galleryImages-1" isText={false} aspect={116/165} className="w-full h-full border-[3px] border-white shadow-md"><CinematicImage src={getGalleryImg(1)} enableKenBurns={true} /></EditableWrapper>
            </motion.div>
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'117.5px', left:'279.3px', width:'116px', height:'165px'}}>
                 <EditableWrapper field="galleryImages-2" isText={false} aspect={116/165} className="w-full h-full border-[3px] border-white shadow-md"><CinematicImage src={getGalleryImg(2)} enableKenBurns={true} /></EditableWrapper>
            </motion.div>

            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'310px', left:'0', width:'420px'}}>
                <p style={{fontSize:'15px', fontFamily:'Arial, sans-serif', letterSpacing:'1px', lineHeight:'1.5', textTransform:'uppercase', color:'#000'}}>THAM DỰ TIỆC MỪNG LỄ THÀNH HÔN<br/><span style={{textTransform:'none'}}>Vào Lúc</span></p>
            </motion.div>

            {/* Calendar Grid - Adjusted Layout */}
            
            {/* Left: Time */}
            <div className="abs text-center" style={{top:'408px', left:'20px', width:'120px'}}>
                <EditableWrapper field="time" label="Giờ" defaultFontSize={16}><p style={{fontSize:'16px', fontFamily:'Arial, sans-serif', color:'#000'}}>{localData.time ? localData.time.replace(':',' giờ ') : '10 giờ 00'}</p></EditableWrapper>
            </div>

            {/* Middle: Date Stack - Adjusted Top to 355px */}
            <motion.div variants={fadeInDown} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'355px', left:'150px', width:'120px'}}>
                 <p style={{fontSize:'15px', fontFamily:'Arial, sans-serif', color:'#000', marginBottom:'5px'}}>{dayOfWeek}</p>
            </motion.div>
            <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'380px', left:'150px', width:'120px'}}>
                <EditableWrapper field="date" label="Ngày" defaultFontSize={48} className="text-center">
                    <p style={{fontSize:'48px', fontWeight:'bold', fontFamily:'Arial, sans-serif', color:'#000', lineHeight: 1}}>{day}</p>
                </EditableWrapper>
            </motion.div>
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs text-center" style={{top:'435px', left:'150px', width:'120px'}}>
                 <p style={{fontSize:'15px', fontFamily:'Arial, sans-serif', color:'#000'}}>Tháng {month}</p>
            </motion.div>

            {/* Right: Year */}
            <div className="abs text-center" style={{top:'408px', left:'280px', width:'120px'}}>
                <EditableWrapper field="date" label="Năm" defaultFontSize={16}><p style={{fontSize:'16px', fontFamily:'Arial, sans-serif', color:'#000'}}>Năm {year}</p></EditableWrapper>
            </div>
            
            {/* Vertical Separator Lines */}
            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{borderLeft:'1px solid #536077', height:'80px', top:'375px', left:'145px'}}></motion.div>
            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{borderLeft:'1px solid #536077', height:'80px', top:'375px', left:'275px'}}></motion.div>

            {/* Lunar Date */}
            <div className="abs w-full text-center" style={{top:'480px', left:'0', width:'420px'}}>
                <EditableWrapper field="lunarDate" label="Ngày Âm" defaultFontSize={15}><p style={{fontStyle:'italic', fontFamily:'Arial, sans-serif', fontSize:'15px', color:'#000'}}>{localData.lunarDate}</p></EditableWrapper>
            </div>
            
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs bg-cover" style={{top:0, left:'127.5px', width:'165px', height:'35px', backgroundImage:'url("https://statics.pancake.vn/web-media/80/ac/eb/cf/85e75c674913047eea133813069cf9dc6d9a1acadb58c454077c94c5-w:500-h:500-l:9074-t:image/png.png")'}}></motion.div>
        </div>

        {/* --- SECTION 4: MAP --- */}
        <div className="section-container" style={{ height: '250px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
            <div className="abs" style={{top:'40px', left:'53px', width:'309px', height:'168px', border:'2px solid #8e0101', borderRadius:'16px'}}></div>
            
            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'11.5px', left:'-3.5px', width:'427px'}}>
                <p style={{fontFamily:'Arial, sans-serif', fontSize:'14px', letterSpacing:'1px'}}>BUỔI TIỆC ĐƯỢC TỔ CHỨC TẠI</p>
            </motion.div>
            
            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'58.3px', left:'-0.5px', width:'421px'}}>
                 <EditableWrapper field="location" label="Địa điểm" defaultFontSize={20}>
                    <p style={{fontFamily:'Montserrat, sans-serif', fontWeight: 700, fontStyle: 'italic', fontSize:'20px', textTransform:'uppercase', letterSpacing:'1px'}}>
                        {localData.location}
                    </p>
                 </EditableWrapper>
            </motion.div>
             <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'96.3px', left:'62.5px', width:'295px'}}>
                 <EditableWrapper field="address" label="Địa chỉ" defaultFontSize={14}>
                    <p style={{fontFamily:'Montserrat, sans-serif', fontStyle: 'italic', fontSize:'14px', letterSpacing:'1px'}}>
                        {localData.address}
                    </p>
                 </EditableWrapper>
            </motion.div>

            <motion.div variants={pulse} initial="visible" whileInView="visible" className="abs" style={{top:'154px', left:'137px'}}>
                 <EditableWrapper 
                    field="mapUrl" 
                    label="Link Bản Đồ (Google Maps)" 
                    isText={true} 
                    className="inline-block"
                    onClick={() => !isEditMode && window.open(localData.mapUrl || 'https://maps.google.com', '_blank')}
                 >
                    <button className="flex justify-center items-center bg-[#b10000] text-white rounded-full text-[15px] shadow-lg font-bold font-sans" style={{width:'140px', height:'32px', border: 'none'}}>
                        {isEditMode ? "Sửa Link Map" : "Xem Chỉ Đường"}
                    </button>
                 </EditableWrapper>
            </motion.div>
        </div>

        {/* --- SECTION 4.5: CALENDAR (NEW) --- */}
        <div className="section-container" style={{ height: '450px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
            <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'30px'}}>
                 <h2 style={{fontFamily:'Ephesis-Regular, sans-serif', fontSize:'36px', color:'#b10000'}}>Lịch Phụng Vụ</h2>
            </motion.div>
            
            <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'80px'}}>
                 <p style={{fontFamily:'Arial, sans-serif', fontSize:'18px', fontWeight:'bold', textTransform:'uppercase'}}>Tháng {month} / {year}</p>
            </motion.div>

            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'120px', left:'35px', width:'350px'}}>
                 <div className="bg-white/80 p-4 rounded-xl shadow-lg border border-rose-100">
                    <div className="calendar-grid mb-2 border-b border-gray-200 pb-2">
                        <div className="font-bold text-rose-700">T2</div>
                        <div className="font-bold text-rose-700">T3</div>
                        <div className="font-bold text-rose-700">T4</div>
                        <div className="font-bold text-rose-700">T5</div>
                        <div className="font-bold text-rose-700">T6</div>
                        <div className="font-bold text-rose-700">T7</div>
                        <div className="font-bold text-rose-700">CN</div>
                    </div>
                    <div className="calendar-grid">
                        {calendarDays.map((d, i) => (
                             <div key={i} className="calendar-cell">
                                 {d === day ? (
                                     <div className="relative flex items-center justify-center w-8 h-8">
                                         <Heart className="absolute w-full h-full text-rose-600 fill-rose-600 animate-heart-beat opacity-20" />
                                         <Heart className="absolute w-5 h-5 text-rose-600 fill-rose-600 animate-heart-beat" />
                                         <span className="relative z-10 text-white text-xs font-bold">{d}</span>
                                     </div>
                                 ) : (
                                     <span className={d ? "text-gray-700 font-medium" : ""}>{d}</span>
                                 )}
                             </div>
                        ))}
                    </div>
                 </div>
            </motion.div>

            {/* Decor */}
            <div className="abs bg-cover" style={{bottom:'20px', right:'-20px', width:'150px', height:'150px', backgroundImage:'url("https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png")', opacity: 0.5, transform: 'rotate(-45deg)'}}></div>
        </div>

        {/* --- SECTION 5: RSVP --- */}
        <div className="section-container" style={{ height: '522px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
            <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'124.5px', left:'35px', width:'350px', height:'312px', background:'rgba(177, 0, 0, 1)', borderRadius:'16px', border:'1px solid #e5e7eb'}}></motion.div>
            
            <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'14.3px', left:'58px', width:'304px'}}>
                <h2 style={{fontFamily:'Ephesis-Regular, sans-serif', fontSize:'30px', lineHeight:1, color:'#000'}}>Xác Nhận Tham Dự<br/>&<br/>Gửi Lời Chúc</h2>
            </motion.div>
            
            <div className="abs" style={{top:'144px', left:'56.5px', width:'307px', height:'277px'}}>
                <div style={{height: '43px', marginBottom: '14px'}}>
                    <input 
                        className="inp-style" 
                        placeholder="Tên của bạn là?" 
                        value={guestNameInput}
                        onChange={(e) => setGuestNameInput(e.target.value)}
                    />
                </div>
                <div style={{height: '43px', marginBottom: '14px'}}>
                    <input 
                        className="inp-style" 
                        placeholder="Bạn là gì của Dâu Rể nhỉ?" 
                        value={guestRelation}
                        onChange={(e) => setGuestRelation(e.target.value)}
                    />
                </div>
                <div style={{height: '43px', marginBottom: '14px'}}>
                    <input 
                        className="inp-style" 
                        placeholder="Gửi lời chúc đến Dâu Rể nhé!" 
                        value={guestWishes}
                        onChange={(e) => setGuestWishes(e.target.value)}
                    />
                </div>
                <div style={{height: '43px'}}>
                    <select 
                        className="inp-style"
                        value={attendance}
                        onChange={(e) => setAttendance(e.target.value)}
                    >
                        <option value="Có Thể Tham Dự">Có Thể Tham Dự</option>
                        <option value="Không Thể Tham Dự">Không Thể Tham Dự</option>
                    </select>
                </div>
                <div style={{marginTop: '24px', display:'flex', justifyContent:'center', alignItems: 'center', gap: '8px', marginLeft: '13px'}}>
                     <button 
                        onClick={handleRSVPSubmit} 
                        disabled={isSubmittingRSVP}
                        className="btn-red" 
                        style={{width: '168px', height: '43px', background: 'white', color: '#8e0101', fontSize: '14px', fontWeight: 'bold', border:'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                     >
                         {isSubmittingRSVP ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                         GỬI NGAY
                     </button>

                     {/* NÚT CẤU HÌNH SHEET (CHỈ HIỆN KHI EDIT MODE) */}
                     {(isEditMode && !readonly) && (
                        <button 
                            onClick={() => openTextEditor('googleSheetUrl', 'Link Google Sheet Script')}
                            className="w-[43px] h-[43px] bg-white rounded-full flex items-center justify-center shadow-lg text-[#8e0101] hover:scale-110 transition-transform"
                            title="Cấu hình Google Sheet"
                        >
                            <Link size={20} />
                        </button>
                     )}
                </div>
            </div>

            <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:'456.4px', left:'113px'}}>
                <button onClick={() => setShowBankPopup(true)} className="btn-red" style={{width: '194px', height: '40px', fontSize: '14px', fontWeight: 'bold', borderRadius: '9px', border:'none'}}>
                    GỬI MỪNG CƯỚI
                </button>
            </motion.div>
            
            <div className="abs pointer-events-none bg-cover" style={{top:0, left:'-566px', width:'350px', height:'667px', backgroundImage:'url("https://statics.pancake.vn/web-media/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")'}}></div >
        </div>

        {/* --- SECTION 6: ALBUM 1 --- */}
        <div className="section-container" style={{ height: '632px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
            <motion.div variants={zoomIn} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs" style={{top:0, left:'20.5px', width:'185px'}}>
                <EditableWrapper field="albumTitle" label="Tiêu đề" defaultFontSize={32}><p style={{fontFamily:'Ephesis-Regular, sans-serif', fontSize:'32px', textAlign:'center'}}>Album hình cưới</p></EditableWrapper>
            </motion.div>
            
            <EditableWrapper field="albumImages-0" isText={false} aspect={179/268} className="abs border-[3px] border-white shadow-md" style={{top:'52px', left:'25.5px', width:'179px', height:'268px'}} variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(0)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-1" isText={false} aspect={179/268} className="abs border-[3px] border-white shadow-md" style={{top:'81.5px', left:'214.5px', width:'179px', height:'268px'}} variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(1)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-2" isText={false} aspect={179/268} className="abs border-[3px] border-white shadow-md" style={{top:'359.5px', left:'25px', width:'179px', height:'268px'}} variants={fadeInLeft} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(2)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-3" isText={false} aspect={179/116} className="abs border-[3px] border-white shadow-md" style={{top:'374.5px', left:'214px', width:'179px', height:'116px'}} variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(3)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-4" isText={false} aspect={179/116} className="abs border-[3px] border-white shadow-md" style={{top:'497px', left:'214px', width:'179px', height:'116px'}} variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(4)} enableKenBurns={true} /></EditableWrapper>
            
            <motion.div variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs bg-cover" style={{top:'6.5px', left:'214.5px', width:'165px', height:'35px', backgroundImage:'url("https://statics.pancake.vn/web-media/80/ac/eb/cf/85e75c674913047eea133813069cf9dc6d9a1acadb58c454077c94c5-w:500-h:500-l:9074-t:image/png.png")'}}></motion.div>
        </div>

        {/* --- SECTION 7: ALBUM 2 --- */}
        <div className="section-container" style={{ height: '563px', backgroundImage: 'url("https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png")' }}>
            <EditableWrapper field="albumImages-5" isText={false} aspect={178/267} className="abs border-[3px] border-white shadow-md" style={{top:'6px', left:'25px', width:'178px', height:'267px'}} variants={fadeInLeft} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(5)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-6" isText={false} aspect={178/267} className="abs border-[3px] border-white shadow-md" style={{top:'6px', left:'213.5px', width:'178px', height:'267px'}} variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(6)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-7" isText={false} aspect={178/267} className="abs border-[3px] border-white shadow-md" style={{top:'283px', left:'25.5px', width:'178px', height:'267px'}} variants={fadeInLeft} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(7)} enableKenBurns={true} /></EditableWrapper>
            <EditableWrapper field="albumImages-8" isText={false} aspect={178/267} className="abs border-[3px] border-white shadow-md" style={{top:'283px', left:'214px', width:'178px', height:'267px'}} variants={fadeInRight} initial="hidden" whileInView="visible" viewport={{once:true}}><CinematicImage src={getAlbumImg(8)} enableKenBurns={true} /></EditableWrapper>
        </div>

        {/* --- SECTION 8: FOOTER --- */}
        <div className="section-container" style={{ height: '630px' }}>
             <EditableWrapper field="footerImage" isText={false} aspect={854/1280} className="abs w-full h-full" style={{top:0, left:0}}>
                <CinematicImage src={localData.footerImage || 'https://statics.pancake.vn/web-media/ad/c0/11/16/06080e040619cef49e87d7e06a574eb61310d3dc4bdc9f0fec3638c9-w:854-h:1280-l:259362-t:image/jpeg.png'} />
             </EditableWrapper>
             <div className="abs w-full h-full pointer-events-none" style={{background:'rgba(255, 255, 255, 0.62)', top:0, left:0}}></div>
             
             <div className="abs pointer-events-none" style={{top:'354px', left:'-17px', width:'453px', height:'147px', background:'rgba(0, 0, 0, 0.48)'}}></div>
             
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ repeat: Infinity, duration: 2, repeatType: 'reverse' }} className="abs bg-contain bg-center bg-no-repeat" style={{top:'338px', left:'11px', width:'397px', height:'155px', backgroundImage: 'url("https://statics.pancake.vn/web-media/cf/cf/28/5f/f9ca08165577556ed2df053b0962a0e8e670490844d7ad5e84fa48b2-w:1366-h:530-l:48754-t:image/png.png")'}}></motion.div>
             
             <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{once:true}} className="abs w-full text-center" style={{top:'427.5px', left:'-30px', width:'480px'}}>
                 <p style={{fontFamily:'UTM-Azkia, sans-serif', fontSize:'38px', color:'#fff', textAlign:'center'}}>Rất hân hạnh được đón tiếp!</p>
             </motion.div>
        </div>

      </div>
      </div>

      {/* --- POPUPS (Moved OUTSIDE the scaled container) --- */}
      <AnimatePresence>
            {showBankPopup && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
                    onClick={() => setShowBankPopup(false)}
                >
                    <motion.div className="relative bg-white w-[400px] h-[381px] border border-gray-200 shadow-xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowBankPopup(false)} className="absolute top-2 right-2 z-10 p-2"><X className="w-6 h-6 text-gray-500" /></button>
                        <div className="abs pointer-events-none" style={{top: '87.3px', left: '85px', width: '230px', height: '227px', backgroundColor: 'rgba(144, 39, 50, 1)'}}></div>
                        <div className="abs w-full text-center" style={{top: '14.5px', left:'73px', width:'254px'}}>
                            <h2 style={{fontFamily: 'Ephesis-Regular, sans-serif', fontSize: '40px', fontWeight: 'bold'}}>Gửi Mừng Cưới</h2>
                        </div>
                        <EditableWrapper field="qrCode" isText={false} className="abs" style={{top: '102px', left: '101px', width: '200px', height: '198px', zIndex: 20}}>
                             <div className="w-full h-full bg-cover" style={{backgroundImage: `url("${localData.qrCodeUrl || 'https://statics.pancake.vn/web-media/e2/bc/35/38/dc2d9ddf74d997785eb0c802bd3237a50de1118e505f1e0a89ae4ec1-w:592-h:1280-l:497233-t:image/png.png'}")`}}></div>
                        </EditableWrapper>
                        <div className="abs w-full text-center" style={{top: '323px', left:'22px', width:'356px', zIndex: 20}}>
                            <EditableWrapper field="bankInfo" label="Thông Tin Ngân Hàng" className="text-[17px] font-bold inline-block bg-white/80 px-2 rounded">
                                <h4 style={{whiteSpace: 'pre-line', fontFamily: 'Arial, sans-serif'}}>{localData.bankInfo}</h4>
                            </EditableWrapper>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {showSuccessModal && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
                    onClick={() => setShowSuccessModal(false)}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="relative aspect-[3/4] w-full">
                             <img 
                                src={localData.imageUrl || 'https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=1080&auto=format&fit=crop'} 
                                className="w-full h-full object-cover" 
                                alt="Thank you"
                             />
                             <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 bg-black/40 py-8 backdrop-blur-[2px] text-center">
                                <h2 style={{fontFamily: 'Ephesis-Regular, cursive'}} className="text-6xl text-white mb-2">thank you</h2>
                                <p className="text-white text-lg tracking-wider italic">Rất hân hạnh được đón tiếp!</p>
                             </div>
                             <button onClick={() => setShowSuccessModal(false)} className="absolute top-2 right-2 text-white/80 hover:text-white bg-black/20 rounded-full p-1 transition-colors">
                                <X size={24} />
                             </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

      {/* Music Button - Moved outside of containerRef to prevent transform context issues */}
      <div className="fixed bottom-4 left-4 z-[9999]">
            <button 
                type="button"
                onClick={handleMusicClick}
                className="w-14 h-14 bg-white/30 backdrop-blur rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform border-none outline-none relative group"
            >
                {isPlaying ? 
                    <img src="https://content.pancake.vn/1/31/08/c9/52/c9f574ca2fa8481e1c8c657100583ddfbf47e33427d480a7dc32e788-w:200-h:200-l:242141-t:image/gif.gif" className="w-11 h-11" alt="Music playing" />
                    : 
                    <img src="https://content.pancake.vn/1/02/d4/a7/88/fef5132f979892c1778a688f2039942fc24b396b332750179775f87e-w:200-h:200-l:8183-t:image/png.png" className="w-11 h-11" alt="Music paused" />
                }
                
                {(isEditMode && !readonly) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                        <Upload className="w-6 h-6 text-white" />
                    </div>
                )}
            </button>
            {(isEditMode && !readonly) && <div className="text-white text-xs bg-black/50 px-2 py-1 rounded mt-1 text-center">Đổi nhạc</div>}
      </div>

    </div>
  );
};
