
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InvitationData } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Check, ZoomIn, ZoomOut, RotateCw, Loader2, Link, UploadCloud, Upload } from 'lucide-react';
import { Button } from './Button';
import { convertSolarToLunarFull } from '../utils/lunar';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface TemplateRedGoldProps {
  data: InvitationData;
  onSave?: (newData: InvitationData) => void;
  onAutosave?: (newData: InvitationData) => void;
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

// Portal Component để đưa Modal ra ngoài body
const ModalPortal = ({ children }: { children?: React.ReactNode }) => {
    if (typeof document === 'undefined' || !children) return null;
    return createPortal(children, document.body);
};

export const TemplateRedGold: React.FC<TemplateRedGoldProps> = ({ data: initialData, onSave, onAutosave, readonly = false, invitationId, guestName }) => {
  const [localData, setLocalData] = useState<InvitationData>(initialData);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBankPopup, setShowBankPopup] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [editingField, setEditingField] = useState<EditingFieldState | null>(null);
  
  // Scaling Logic
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // RSVP Logic
  const [guestNameInput, setGuestNameInput] = useState(guestName || ''); 
  const [guestRelation, setGuestRelation] = useState(''); 
  const [guestWishes, setGuestWishes] = useState('');
  const [attendance, setAttendance] = useState('Có Thể Tham Dự');
  const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false);

  // Crop Logic
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
        const DESIGN_WIDTH = 420; // Fixed width from user CSS
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

  // --- AUTOSAVE ---
  useEffect(() => {
    if (!isEditMode || readonly || !onAutosave) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
        onAutosave(localData);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [localData, isEditMode, onAutosave, readonly]);

  // --- ANIMATION OBSERVER (FROM USER CODE) ---
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target as HTMLElement;
                const animName = el.getAttribute('data-anim');
                const duration = el.getAttribute('data-duration') || '1s';
                const delay = el.getAttribute('data-delay') || '0s';
                if (animName) {
                    el.style.animationName = animName;
                    el.style.animationDuration = duration;
                    el.style.animationDelay = delay;
                    el.classList.add('run-anim');
                    observer.unobserve(el);
                }
            }
        });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.is-animation');
    elements.forEach(el => observer.observe(el));

    // Auto play music check
    const playAudio = async () => {
        if (audioRef.current && !isPlaying) {
             try {
                await audioRef.current.play();
                setIsPlaying(true);
             } catch(e) {
                 // Autoplay policy prevented
             }
        }
    }
    // Try auto play on first interaction
    document.addEventListener('click', playAudio, { once: true });

    return () => observer.disconnect();
  }, [localData]); // Re-run when data changes (re-render)

  // Cleanup object URLs when component unmounts
  useEffect(() => {
      return () => {
          if (cropImageSrc && cropImageSrc.startsWith('blob:')) {
              URL.revokeObjectURL(cropImageSrc);
          }
      };
  }, [cropImageSrc]);

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
          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              setLocalData(prev => ({ ...prev, musicUrl: result }));
              setIsPlaying(true);
          };
          reader.readAsDataURL(file);
      }
  }

  const handleRSVPSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!guestNameInput.trim()) {
          alert("Bạn quên nhập tên rồi nè!");
          return;
      }
      setIsSubmittingRSVP(true);
      try {
          if (invitationId) {
              await addDoc(collection(db, "rsvps"), {
                  invitationId: invitationId,
                  guestName: guestNameInput,
                  guestRelation,
                  guestWishes,
                  attendance,
                  createdAt: new Date().toISOString()
              });
          }
          
          const sheetUrl = localData.googleSheetUrl;
          if (sheetUrl && sheetUrl.startsWith("http")) {
             fetch(sheetUrl, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 'Content-Type': 'application/json' },
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

  const openTextEditor = (field: keyof InvitationData | 'mapUrl' | 'googleSheetUrl', label: string, defaultFontSize: number = 14) => {
    if (!isEditMode || readonly) return;
    // @ts-ignore
    const currentValue = localData[field] !== undefined ? localData[field] : '';
    const currentFontSize = localData.elementStyles?.[field]?.fontSize || defaultFontSize;
    setEditingField({ key: field, label: label, value: String(currentValue), fontSize: currentFontSize });
  };

  const saveTextChange = () => {
      if (editingField) {
          const newData = { ...localData, [editingField.key]: editingField.value };
          if (editingField.key === 'date') {
              const newLunarString = convertSolarToLunarFull(editingField.value);
              if (newLunarString) newData.lunarDate = newLunarString;
          }
          if (editingField.fontSize) {
              newData.elementStyles = {
                  ...newData.elementStyles,
                  [editingField.key]: { ...(newData.elementStyles?.[editingField.key] || {}), fontSize: editingField.fontSize }
              };
          }
          setLocalData(newData);
          setEditingField(null);
      }
  };

  // Map fields to Aspect Ratios based on pixel dimensions in CSS
  const getAspectRatioForField = (field: string): number => {
      if (field === 'imageUrl') return 249 / 373; // #w-01kq9cgt
      if (field === 'centerImage') return 354 / 269; // #w-y7yn4bui
      if (field === 'footerImage') return 854 / 1280; // #w-l2pipleo background (approx)
      if (field === 'qrCodeUrl') return 1;
      
      // Albums
      if (field === 'albumImages-0') return 179 / 268;
      if (field === 'albumImages-1') return 179 / 268;
      if (field === 'albumImages-2') return 179 / 268;
      if (field === 'albumImages-3') return 179 / 116;
      if (field === 'albumImages-4') return 179 / 116;
      if (field === 'albumImages-5') return 178 / 267;
      if (field === 'albumImages-6') return 178 / 267;
      if (field === 'albumImages-7') return 178 / 267;
      if (field === 'albumImages-8') return 178 / 267;
      
      // Gallery (Section 3)
      if (field === 'galleryImages-0') return 116 / 165;
      if (field === 'galleryImages-1') return 116 / 165;
      if (field === 'galleryImages-2') return 116 / 165;

      return 1;
  }

  const triggerImageUpload = (field: string) => {
    if (!isEditMode || readonly) return;
    activeImageFieldRef.current = field;
    setCurrentAspect(getAspectRatioForField(field));
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Dùng URL.createObjectURL thay vì FileReader để tránh lag và lỗi màn hình đen trên mobile
      if (cropImageSrc && cropImageSrc.startsWith('blob:')) {
         URL.revokeObjectURL(cropImageSrc); // Dọn dẹp URL cũ
      }
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setIsCropping(true);
      setZoom(1);
      setRotation(0);
      setCrop({ x: 0, y: 0 });
    }
  };

  const performCrop = async () => {
      if (!cropImageSrc || !croppedAreaPixels || !activeImageFieldRef.current) return;
      try {
          const croppedImageBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels, rotation);
          if (!croppedImageBase64) return;
          const currentField = activeImageFieldRef.current as string;
          
          setLocalData(prev => {
            const newData = { ...prev };
            if (currentField === 'imageUrl') newData.imageUrl = croppedImageBase64;
            else if (currentField === 'centerImage') newData.centerImage = croppedImageBase64;
            else if (currentField === 'footerImage') newData.footerImage = croppedImageBase64;
            else if (currentField === 'qrCodeUrl') newData.qrCodeUrl = croppedImageBase64;
            else if (currentField.startsWith('albumImages-')) {
                 const parts = currentField.split('-');
                 const index = parseInt(parts[1], 10);
                 const newAlbum = [...(prev.albumImages || [])];
                 while (newAlbum.length <= index) newAlbum.push(""); 
                 newAlbum[index] = croppedImageBase64;
                 newData.albumImages = newAlbum;
            } else if (currentField.startsWith('galleryImages-')) {
                const parts = currentField.split('-');
                const index = parseInt(parts[1], 10);
                const newGallery = [...(prev.galleryImages || [])];
                while (newGallery.length <= index) newGallery.push(""); 
                newGallery[index] = croppedImageBase64;
                newData.galleryImages = newGallery;
           }
           return newData;
        });
        
        // Dọn dẹp
        setIsCropping(false);
        if (cropImageSrc.startsWith('blob:')) {
            URL.revokeObjectURL(cropImageSrc);
        }
        setCropImageSrc(null);
        activeImageFieldRef.current = null;
      } catch (e) { console.error(e); }
  };

  const handleSave = () => { setIsEditMode(false); if (onSave) onSave(localData); };

  // --- Wrapper Component for Edit Mode ---
  const EditableWrapper = ({ children, field, label, isText = true, defaultFontSize = 14, className = "", style = {}, onClick, ...props }: any) => {
      const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation(); // Stop propagation to prevent music toggle etc.
          if (onClick && !isEditMode) { onClick(); return; }
          if (!isEditMode || readonly) return;
          if (isText) openTextEditor(field, label, defaultFontSize); else triggerImageUpload(field);
      };
      
      const storedStyle = localData.elementStyles?.[field] || {};
      // Merge styles. Note: className handles positioning in this template via IDs usually, so style is mostly for fonts
      const appliedStyle: React.CSSProperties = { ...style, fontSize: storedStyle.fontSize ? `${storedStyle.fontSize}px` : undefined };
      
      const editContainerStyles: React.CSSProperties = (isEditMode && !readonly) ? {
          ...appliedStyle, 
          outline: '2px dashed #ef4444', 
          backgroundColor: 'rgba(255, 255, 255, 0.3)', 
          zIndex: 999, 
          cursor: 'pointer'
      } : { cursor: onClick ? 'pointer' : 'default', ...appliedStyle };

      return (
          <div className={`${className} ${isEditMode && !readonly ? 'hover:bg-white/50' : ''}`} style={editContainerStyles} onClick={handleClick} {...props}>
              {children}
              {(isEditMode && !readonly) && <div className="absolute -top-3 -right-3 bg-rose-600 text-white rounded-full p-1 shadow-md z-[1000] pointer-events-none scale-75">{isText ? <Pencil size={12} /> : <Upload size={12} />}</div>}
          </div>
      )
  };

  const getAlbumImg = (idx: number) => localData.albumImages?.[idx] || '';
  const getGalleryImg = (idx: number) => localData.galleryImages?.[idx] || '';
  
  // Date parsing
  const safeDate = localData.date || new Date().toISOString().split('T')[0];
  const [year, month, day] = safeDate.split('-').map(Number);
  
  // Custom CSS based on User's Code
  const css = `
    @font-face{font-family: "UTM-Cafeta.ttf"; src: url("https://statics.pancake.vn/web-media/04/eb/01/7a/e19221a44fabb6fd54c6339fd43b1c25ebbe20e97f6633beed4cbc79-w:0-h:0-l:31525-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "Ephesis-Regular.ttf"; src: url("https://statics.pancake.vn/web-media/65/48/68/4f/ca5a0c732f276b6fef504eddf0e2d6cdf65cf198b0440dde6d90c5a8-w:0-h:0-l:141767-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "SVN-Mightiest.otf"; src: url("https://statics.pancake.vn/web-media/38/a8/63/6b/be3591beaa1faddc0f76fe23aac05f5d907411cd2b0e4652bc5ed081-w:0-h:0-l:23808-t:application/octet-stream.otf") format("opentype"); font-display:swap;}
    @font-face{font-family: "BlackMango-Medium.otf"; src: url("https://statics.pancake.vn/web-media/f5/f1/41/aa/b6a0dd0c2a8cc07c0be70e066410a2cb9506e4ae9a3d88a8e238b53c-w:0-h:0-l:52546-t:application/octet-stream.otf") format("opentype"); font-display:swap;}
    @font-face{font-family: "UTM-Sloop-1.ttf"; src: url("https://statics.pancake.vn/web-media/bb/41/fd/fd/d607e5e05e3481a7e43e3f8e773d8f6d463215c4cab5107ce736fa5b-w:0-h:0-l:72326-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "UTM-Azkia.ttf"; src: url("https://statics.pancake.vn/web-media/35/7a/ab/a5/2bcc8b3414fa20782f68d8d552b13313f2a24e5b267a97b3cf3a5ec3-w:0-h:0-l:144903-t:application/octet-stream.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "AlexBrush-Regular.ttf"; src: url("https://statics.pancake.vn/web-media/7f/17/e9/f1/cb9ca1db4d08288384fa9e241cbc74923dcbb9c5701b6caf519deb13-w:0-h:0-l:115720-t:font/ttf.ttf") format("truetype"); font-display:swap;}
    @font-face{font-family: "SVN-Gilroy-Italic.otf"; src: url("https://fonts.gstatic.com/s/roboto/v29/KFOkCnqEu92Fr1MmgVxIIzI.woff2") format("woff2");}
    @font-face{font-family: "SVN-Gilroy-Bold-Italic.otf"; src: url("https://fonts.gstatic.com/s/roboto/v29/KFOjCnqEu92Fr1Mu51TzBwc4EsA.woff2") format("woff2");}

    .pageview{width:420px; background:#fff; overflow:hidden; position:relative; box-shadow: 0 0 20px rgba(0,0,0,0.1); margin: 0 auto;}
    
    .p-absolute{position:absolute} .p-relative{position:relative}
    .full-width{width:100%} .full-height{height:100%}
    .image-background{background-position:center center;background-size:cover;background-repeat:no-repeat;width:100%;height:100%}
    
    /* Animation */
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes fadeInUp{from{opacity:0;transform:translate3d(0,100%,0)}to{opacity:1;transform:none}}
    @keyframes fadeInDown{from{opacity:0;transform:translate3d(0,-100%,0)}to{opacity:1;transform:none}}
    @keyframes fadeInLeft{from{opacity:0;transform:translate3d(-100%,0,0)}to{opacity:1;transform:none}}
    @keyframes fadeInRight{from{opacity:0;transform:translate3d(100%,0,0)}to{opacity:1;transform:none}}
    @keyframes zoomIn{from{opacity:0;transform:scale3d(.3,.3,.3)}50%{opacity:1}}
    @keyframes pulse{from{transform:scale3d(1,1,1)}50%{transform:scale3d(1.05,1.05,1.05)}to{transform:scale3d(1,1,1)}}
    @keyframes slideInLeft{from{transform:translate3d(-100%,0,0);visibility:visible}to{transform:translate3d(0,0,0)}}
    @keyframes slideInRight{from{transform:translate3d(100%,0,0);visibility:visible}to{transform:translate3d(0,0,0)}}
    @keyframes flash{from,50%,to{opacity:1}25%,75%{opacity:0}}
    
    .is-animation { opacity: 0; }
    .is-animation.run-anim { opacity: 1; animation-fill-mode: both; }

    /* SPECIFIC IDs MAPPING */
    #section-1 {height: 800px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-kb6stlwe{top:80px;left:3.5px;width:413px;height:60px;}
    #w-kb6stlwe h1{font-family:'UTM-Sloop-1.ttf', sans-serif;font-size:40px;text-align:center;text-shadow:0px 4px 4px #fff;color:#000; margin:0;}
    #w-kcf30pvx{top:244.5px;left:83px;width:254px;height:33px;}
    #w-kcf30pvx h2{font-size:22px;font-weight:bold;letter-spacing:7px;text-align:center;color:#000; margin:0;}
    #w-i3tjofn6{top:41.5px;left:83px;width:254px;height:30px;}
    #w-i3tjofn6 h2{font-family:'Roboto',sans-serif;font-size:20px;letter-spacing:3px;text-align:center;color:#000; margin:0;}
    #w-01kq9cgt{top:286px;left:85.5px;width:249px;height:373px;border:7px solid #8e0101;}
    #w-b38gb1ay{top:222px;left:83px;width:254px;height:22.5px;}
    #w-b38gb1ay h2{font-size:15px;text-align:center;color:#000; margin:0;}
    #w-lf6hdy88{top:135px;left:166.5px;width:87px;height:87px;}
    #w-7r4uk9mb{top:178.7px;left:312px;width:87px;height:87px;}
    #w-xvsp4zia{top:178.7px;left:19px;width:87px;height:87px;}
    #w-eyyclpyr{top:600.5px;left:276px;width:117px;height:117px;}
    #w-l1qm7i9q{top:690px;left:60px;width:300px;height:33px;}
    #w-l1qm7i9q h2{font-family:'SVN-Mightiest.otf',sans-serif;font-size:22px;text-align:center;color:#000; margin:0;}
    #w-lme5ajk5{top:731.8px;left:60px;width:300px;height:48px;}
    #w-lme5ajk5 h2{font-family:'AlexBrush-Regular.ttf',sans-serif;font-size:32px;text-align:center;color:#7d1f2a; margin:0;}
    #w-zvm741p4{top:755.8px;left:92px;width:236px;border-bottom: 1px dotted #000;} 
    #w-1j4sk2pp{top:0;left:420px;width:420px;height:800px;pointer-events:none;}
    #w-lra9lkfk{top:0;left:-420px;width:420px;height:800px;pointer-events:none;}

    /* Section 2 */
    #section-2 {height: 714px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-7sjvq3be{top:243.5px;left:58px;width:304px;}
    #w-7sjvq3be h2{font-family:'BlackMango-Medium.otf',sans-serif;font-size:14px;text-align:center; margin:0;}
    #w-mz04c43b{top:273.5px;left:3.5px;width:413px;}
    #w-mz04c43b h1{font-family:'UTM-Sloop-1.ttf',sans-serif;font-size:40px;text-align:center;text-shadow:0px 4px 4px #fff; margin:0;}
    #w-0vqn3fzh{top:355px;left:3.5px;width:413px;}
    #w-0vqn3fzh h1{font-family:'UTM-Sloop-1.ttf',sans-serif;font-size:40px;text-align:center;text-shadow:0px 4px 4px #fff; margin:0;}
    #w-ejxhihol{top:316px;left:141.5px;width:137px;}
    #w-ejxhihol h1{font-family:'UTM-Azkia.ttf',sans-serif;font-size:40px;text-align:center; margin:0;}
    #w-y7yn4bui{top:424.3px;left:33px;width:354px;height:269px;border:7px solid #8e0101;}
    #w-aqbkkztv{top:99px;left:0;width:200px;}
    #w-aqbkkztv p, #w-oj3482xm p, #w-vq47tj4t p, #w-fynwgspj p {font-family:'UTM-Cafeta.ttf',sans-serif;font-size:16px;text-align:center; margin:0;}
    #w-oj3482xm{top:99px;left:220px;width:200px;}
    #w-vq47tj4t{top:123px;left:0;width:200px;}
    #w-fynwgspj{top:123px;left:220px;width:200px;}
    #w-2wvcu7z3{top:171px;left:237.5px;width:165px;font-size:13px;text-align:center;}
    #w-y1s24e6p{top:171px;left:21.5px;width:165px;font-size:13px;text-align:center;}
    #w-zp11tpir{top:0;left:167px;width:86px;height:86px;}
    #w-dsdbdzxr{top:65px;left:176px;width:68px;height:68px;}

    /* Section 3 */
    #section-3 {height: 515px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-qube8kir{top:390px;left:114.6px;width:185px;}
    #w-qube8kir p{font-family:'Arial',sans-serif;font-size:35px;font-weight:bold;letter-spacing:3px;text-align:center; margin:0;}
    #w-dyyqc44u{top:117.5px;left:24.6px;width:116px;height:165px;}
    #w-p5zt0rep{top:85.5px;left:152px;width:116px;height:165px;}
    #w-to8ewwrh{top:117.5px;left:279.3px;width:116px;height:165px;}
    #w-6rllui0l{top:41.5px;left:58px;width:304px;}
    #w-6rllui0l h2{font-family:'Ephesis-Regular.ttf',sans-serif;font-size:25px;text-align:center; margin:0;}
    #w-20spjy25{top:0;left:127.5px;width:165px;height:35px;}
    #w-8txukiew{top:317.7px;left:-3.5px;width:427px;}
    #w-8txukiew p{font-family:'Arial',sans-serif;font-size:14px;letter-spacing:1px;text-align:center; margin:0;}
    #w-qkyo9emq{top:408.5px;left:-9.8px;width:185px;}
    #w-qkyo9emq p{font-family:'Arial',sans-serif;font-size:14px;letter-spacing:1px;text-align:center; margin:0;}
    #w-atv2737b{top:408.5px;left:244.8px;width:185px;}
    #w-atv2737b p{font-family:'Arial',sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;text-align:center; margin:0;}
    #w-s8t0kmal{top:482.5px;left:-1px;width:422px;}
    #w-s8t0kmal p{font-family:'Arial',sans-serif;font-size:14px;font-style:italic;letter-spacing:1px;text-align:center; margin:0;}
    #w-14ongvqg{top:376px;left:114.6px;width:185px;}
    #w-14ongvqg p{font-family:'Arial',sans-serif;font-size:14px;letter-spacing:3px;text-align:center; margin:0;}
    #w-tfi5tzev{top:441px;left:114.6px;width:185px;}
    #w-tfi5tzev p{font-family:'Arial',sans-serif;font-size:14px;letter-spacing:3px;text-align:center; margin:0;}
    .vertical-line {border-left: 1px solid #536077; height: 65px; position: absolute; top: 408.5px;}
    #line-left {left: 95px; transform: rotate(90deg);}
    #line-right {left: 250.6px; transform: rotate(90deg);}

    /* Section 4 Map */
    #section-4 {height: 605px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-vdwipz9k{top:225px;left:22.5px;width:375px;height:375px;}
    #w-avv4pubr{top:11.5px;left:-3.5px;width:427px;}
    #w-avv4pubr p{font-family:'Arial',sans-serif;font-size:14px;letter-spacing:1px;text-align:center; margin:0;}
    #w-oq2hoi54{top:96.3px;left:62.5px;width:295px;}
    #w-oq2hoi54 p{font-family:'SVN-Gilroy-Italic.otf',sans-serif;font-size:14px;letter-spacing:1px;text-align:center; margin:0;}
    #w-m1u3o3mx{top:58.3px;left:-0.5px;width:421px;}
    #w-m1u3o3mx p{font-family:'SVN-Gilroy-Bold-Italic.otf',sans-serif;font-size:20px;letter-spacing:1px;text-align:center;text-transform:uppercase; margin:0;}
    #w-prbr1wdj{top:154px;left:137px;width:140px;height:32px;display:flex;justify-content:center;align-items:center;background:#b10000;color:#fff;border-radius:42px;text-decoration:none;font-family:'Arial',sans-serif;font-size:15px;box-shadow:0 4px 4px rgba(0,0,0,0.25);}
    #w-zajrqtwu{top:40px;left:53px;width:309px;height:168px;border: 2px solid #8e0101; border-radius: 16px;}
    #w-bv76anck{top:411.5px;left:288px;width:38px;height:38px;}

    /* Section RSVP */
    #section-rsvp {height: 522px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-qp7zqavj{top:124.5px;left:35px;width:350px;height:312px;background:rgba(177, 0, 0, 1);border-radius:16px;border:1px solid #e5e7eb;}
    #w-yj0y61d2{top:14.3px;left:58px;width:304px;}
    #w-yj0y61d2 h2{font-family:'Ephesis-Regular.ttf',sans-serif;font-size:30px;line-height:1;text-align:center;color:#000; margin:0;}
    #w-d688ytkq{top:144px;left:56.5px;width:307px;height:277px;}
    .form-input {width: 307px; height: 43px; background: #fff; border: 1px solid #8e0101; border-radius: 10px; padding: 0 10px; color: #990000; outline:none; font-family: 'Arial', sans-serif;}
    .form-btn {width: 168px; height: 43px; background: #fff; border-radius: 5px; color: #8e0101; font-weight: bold; text-transform: uppercase; border: none; cursor: pointer; box-shadow: 0 4px 4px rgba(0,0,0,0.25); display: flex; justify-content:center; align-items:center;}
    #w-qbpa8242{top:456.4px;left:113px;width:194px;height:40px;display:flex;justify-content:center;align-items:center;background:#b10000;color:#fff;border-radius:9px;font-weight:bold;cursor:pointer;box-shadow:0 4px 4px rgba(0,0,0,0.25);font-family:'Arial', sans-serif;}
    #w-1gjqg7sh{top:0;left:-566px;width:350px;height:667px;pointer-events:none;}

    /* Albums */
    #section-5 {height: 632px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-8job6w7j{top:0;left:20.5px;width:185px;}
    #w-8job6w7j p{font-family:'Ephesis-Regular.ttf',sans-serif;font-size:32px;text-align:center; margin:0;}
    #w-8k7luhft{top:52px;left:25.5px;width:179px;height:268px;}
    #w-damsktmr{top:81.5px;left:214.5px;width:179px;height:268px;}
    #w-mibzihv0{top:359.5px;left:25px;width:179px;height:268px;}
    #w-ui8sxx6m{top:374.5px;left:214px;width:179px;height:116px;}
    #w-grkveilf{top:497px;left:214px;width:179px;height:116px;}
    #w-y4blj2tv{top:6.5px;left:214.5px;width:165px;height:35px;}

    #section-6 {height: 563px; background-image: url('https://content.pancake.vn/1/s840x1600/fwebp/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png');}
    #w-zzn6hpkr{top:283px;left:25.5px;width:178px;height:267px;}
    #w-jz70nzjp{top:283px;left:214px;width:178px;height:267px;}
    #w-05hqo9e4{top:6px;left:25px;width:178px;height:267px;}
    #w-m5s2x14e{top:6px;left:213.5px;width:178px;height:267px;}

    /* Footer */
    #section-7 {height: 630px; position:relative;}
    #w-l2pipleo{top:0;left:0;width:420px;height:630px;}
    #w-k0ppg09a{top:427.5px;left:-30px;width:480px;}
    #w-k0ppg09a p{color:#fff;font-family:'UTM-Azkia.ttf',sans-serif;font-size:38px;text-align:center; margin:0;}
    #w-s8t0kmal{top:338px;left:11px;width:397px;height:155px;}
    #w-way1u3f7{top:0;left:0;width:423px;height:630px;background:rgba(255, 255, 255, 0.62);}
    #w-ycfzoku0{top:354px;left:-17px;width:453px;height:147px;background:rgba(0, 0, 0, 0.48);}

    /* Popup */
    #w-dut1632z{top:87.3px;left:85px;width:230px;height:227px;background:rgba(144, 39, 50, 1);}
    #w-30dwb5gn{top:14.5px;left:73px;width:254px;text-align:center;font-family:'Ephesis-Regular.ttf',sans-serif;font-size:40px;font-weight:bold;}
    #w-aiywg9g7{top:102px;left:101px;width:200px;height:198px;}
    #w-xkuj2dzk{top:323px;left:22px;width:356px;text-align:center;font-family:'Arial',sans-serif;font-size:17px;font-weight:bold;}
  `;

  return (
    <div className="w-full flex justify-center bg-gray-100 overflow-hidden min-h-screen">
      <style>{css}</style>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
      <input type="file" ref={musicInputRef} style={{ display: 'none' }} accept="audio/*" onChange={handleMusicChange} />
      <audio ref={audioRef} src={localData.musicUrl || "https://statics.pancake.vn/web-media/5e/ee/bf/4a/afa10d3bdf98ca17ec3191ebbfd3c829d135d06939ee1f1b712d731d-w:0-h:0-l:2938934-t:audio/mpeg.mp3"} loop />

      {/* --- CÁC MODAL ĐƯỢC RENDER QUA PORTAL ĐỂ TRÁNH LỖI TRANSFORM --- */}
      
      {/* Cropper Modal */}
      <AnimatePresence>
        {isCropping && cropImageSrc && (
            <ModalPortal>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black flex flex-col">
                    <div className="relative flex-1 w-full bg-black overflow-hidden">
                        <Cropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={currentAspect} rotation={rotation} onCropChange={setCrop} onCropComplete={(c, p) => setCroppedAreaPixels(p)} onZoomChange={setZoom} />
                    </div>
                    <div className="bg-white p-4 pb-8 space-y-4 shrink-0">
                         <div className="flex items-center gap-4"><span className="text-xs font-bold text-gray-500 uppercase w-12">Zoom</span><ZoomOut size={16} /><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" /><ZoomIn size={16} /></div>
                         <div className="flex items-center gap-4"><span className="text-xs font-bold text-gray-500 uppercase w-12">Xoay</span><RotateCw size={16} /><input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1" /></div>
                         <div className="flex gap-3 pt-2"><Button variant="secondary" className="flex-1" onClick={() => { setIsCropping(false); setCropImageSrc(null); if (cropImageSrc?.startsWith('blob:')) URL.revokeObjectURL(cropImageSrc); }}>Hủy</Button><Button className="flex-1" onClick={performCrop} icon={<Check className="w-4 h-4" />}>Cắt & Sử Dụng</Button></div>
                    </div>
                </motion.div>
            </ModalPortal>
        )}
      </AnimatePresence>

      {/* Text Editor Modal */}
      <AnimatePresence>
          {editingField && (
             <ModalPortal>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setEditingField(null)}>
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg flex items-center gap-2"><Pencil className="w-5 h-5 text-rose-500" />{editingField.label}</h3><button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600"><X /></button></div>
                        <div className="mb-6 space-y-4">
                            {(editingField.key !== 'mapUrl' && editingField.key !== 'googleSheetUrl') && <input type="range" min="10" max="80" step={1} value={editingField.fontSize || 14} onChange={(e) => setEditingField({ ...editingField, fontSize: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg accent-rose-600" />}
                            {editingField.key === 'date' ? <input type="date" className="w-full p-3 border rounded-lg" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} /> : 
                             (editingField.key === 'mapUrl' || editingField.key === 'googleSheetUrl') ? <input type="text" className="w-full p-3 border rounded-lg" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} /> : 
                             <textarea autoFocus rows={4} className="w-full p-3 border rounded-lg" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} />}
                        </div>
                        <div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setEditingField(null)}>Hủy</Button><Button onClick={saveTextChange} icon={<Check className="w-4 h-4"/>}>Lưu Thay Đổi</Button></div>
                    </motion.div>
                 </motion.div>
             </ModalPortal>
          )}
      </AnimatePresence>

      {/* POPUPS (Bank & Success) */}
      <AnimatePresence>
          {showBankPopup && (
              <ModalPortal>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center" onClick={() => setShowBankPopup(false)}>
                      <div className="w-[400px] h-[381px] bg-white relative border border-gray-200" onClick={e => e.stopPropagation()}>
                          <span className="absolute top-1 right-1 cursor-pointer text-2xl p-2 z-[10001]" onClick={() => setShowBankPopup(false)}>x</span>
                          <div id="w-dut1632z" className="p-absolute"></div>
                          <div id="w-30dwb5gn" className="p-absolute">Gửi Mừng Cưới</div>
                          <EditableWrapper field="qrCodeUrl" isText={false} id="w-aiywg9g7" className="p-absolute">
                              <div className="image-background" style={{backgroundImage: `url('${localData.qrCodeUrl || 'https://statics.pancake.vn/web-media/e2/bc/35/38/dc2d9ddf74d997785eb0c802bd3237a50de1118e505f1e0a89ae4ec1-w:592-h:1280-l:497233-t:image/png.png'}')`}}></div>
                          </EditableWrapper>
                          <EditableWrapper field="bankInfo" label="Thông Tin Ngân Hàng" defaultFontSize={17} id="w-xkuj2dzk" className="p-absolute">
                              <div style={{whiteSpace: 'pre-line'}}>{localData.bankInfo}</div>
                          </EditableWrapper>
                      </div>
                  </motion.div>
              </ModalPortal>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {showSuccessModal && (
              <ModalPortal>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center" onClick={() => setShowSuccessModal(false)}>
                      <div className="bg-white p-8 rounded-xl text-center max-w-sm m-4">
                          <h3 className="text-2xl font-bold text-rose-600 mb-2 font-serif">Cảm ơn bạn!</h3>
                          <p className="text-gray-600">Lời chúc của bạn đã được gửi đến cô dâu chú rể.</p>
                          <Button className="mt-4" onClick={() => setShowSuccessModal(false)}>Đóng</Button>
                      </div>
                  </motion.div>
              </ModalPortal>
          )}
      </AnimatePresence>

      {/* Wrapper để xử lý Scale */}
      <div 
        ref={containerRef}
        style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: '420px', 