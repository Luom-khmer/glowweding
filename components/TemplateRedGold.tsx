
import React, { useEffect, useState, useRef } from 'react';
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
        setIsCropping(false);
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
    #w-sram9ddz{top:338px;left:11px;width:397px;height:155px;}
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

      {/* Wrapper để xử lý Scale */}
      <div 
        ref={containerRef}
        style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: '420px', 
            marginBottom: `-${(1 - scale) * 3000}px` 
        }}
        className="shrink-0"
      >

      {/* Cropper Modal */}
      <AnimatePresence>
        {isCropping && cropImageSrc && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black flex flex-col">
                <div className="relative flex-1 w-full bg-black"><Cropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={currentAspect} rotation={rotation} onCropChange={setCrop} onCropComplete={(c, p) => setCroppedAreaPixels(p)} onZoomChange={setZoom} /></div>
                <div className="bg-white p-4 pb-8 space-y-4">
                     <div className="flex items-center gap-4"><span className="text-xs font-bold text-gray-500 uppercase w-12">Zoom</span><ZoomOut size={16} /><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" /><ZoomIn size={16} /></div>
                     <div className="flex items-center gap-4"><span className="text-xs font-bold text-gray-500 uppercase w-12">Xoay</span><RotateCw size={16} /><input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1" /></div>
                     <div className="flex gap-3 pt-2"><Button variant="secondary" className="flex-1" onClick={() => { setIsCropping(false); setCropImageSrc(null); }}>Hủy</Button><Button className="flex-1" onClick={performCrop} icon={<Check className="w-4 h-4" />}>Cắt & Sử Dụng</Button></div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Text Editor Modal */}
      <AnimatePresence>
          {editingField && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setEditingField(null)}>
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
          )}
      </AnimatePresence>

      <div className="pageview shadow-2xl relative">
        
        {/* EDIT & SAVE BUTTONS */}
        {!readonly && (
            <div className="absolute top-4 right-4 z-[150] flex items-center gap-2">
                 {isEditMode && saveStatus !== 'idle' && <div className="bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">{saveStatus === 'saving' ? <><UploadCloud className="w-3 h-3 animate-bounce" /> Đang lưu...</> : <><Check className="w-3 h-3 text-green-400" /> Đã lưu</>}</div>}
                 <button onClick={() => isEditMode ? handleSave() : setIsEditMode(true)} className={`p-2 backdrop-blur-md rounded-full shadow-sm transition-all ${isEditMode ? 'bg-rose-600 text-white shadow-rose-300' : 'bg-white/60 hover:bg-white text-gray-700'}`}>{isEditMode ? <Check className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}</button>
            </div>
        )}

        {/* SECTION 1 */}
        <div id="section-1" className="p-relative image-background">
            <EditableWrapper field="groomName" label="Tên Dâu Rể" defaultFontSize={40} id="w-kb6stlwe" className="p-absolute is-animation" data-anim="zoomIn" data-delay="0s" data-duration="4s">
                <h1>{localData.groomName || 'Anh Tú'} - {localData.brideName || 'Diệu Nhi'}</h1>
            </EditableWrapper>
            <EditableWrapper field="date" label="Ngày Cưới" defaultFontSize={22} id="w-kcf30pvx" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <h2>{localData.date.split('-').reverse().join('.')}</h2>
            </EditableWrapper>
            <EditableWrapper field="invitedTitle" label="Tiêu đề" defaultFontSize={20} id="w-i3tjofn6" className="p-absolute is-animation" data-anim="fadeInDown" data-duration="3s">
                <h2>{localData.invitedTitle || "THIỆP MỜI"}</h2>
            </EditableWrapper>
            <EditableWrapper field="imageUrl" isText={false} id="w-01kq9cgt" className="p-absolute">
                <div className="image-background" style={{backgroundImage: `url('${localData.imageUrl || 'https://statics.pancake.vn/web-media/ab/56/c3/d2/ae46af903d624877e4e71b00dc5ab4badaa10a8956d3c389ccbc73e9-w:1080-h:1620-l:151635-t:image/jpeg.jpeg'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="time" label="Giờ" defaultFontSize={15} id="w-b38gb1ay" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <h2>{localData.time ? `${localData.time} - ` : ''}THỨ 5</h2>
            </EditableWrapper>
            
            {/* Decor Images */}
            <div id="w-lf6hdy88" className="p-absolute is-animation" data-anim="fadeIn" data-duration="7s"><div className="image-background" style={{backgroundImage: "url('https://content.pancake.vn/1/s487x487/fwebp/c9/7c/2a/c5/5ba36c13eb69d83d80e92d1a2eee50cfee36e987297533b6480719a7-w:500-h:500-l:12182-t:image/png.png')"}}></div></div>
            <div id="w-7r4uk9mb" className="p-absolute is-animation" data-anim="fadeIn" data-duration="7s"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png')"}}></div></div>
            <div id="w-xvsp4zia" className="p-absolute is-animation" data-anim="fadeIn" data-duration="7s"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png')"}}></div></div>
            <div id="w-eyyclpyr" className="p-absolute is-animation" data-anim="fadeIn" data-duration="7s"><div className="image-background" style={{backgroundImage: "url('https://content.pancake.vn/1/fwebp/f5/0c/65/6f/daee3dc9b5487eb190fd88220ef5e6249cfe15ee9b4b145c97a89ee1-w:500-h:500-l:50319-t:image/png.png')"}}></div></div>
            
            <div id="w-l1qm7i9q" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s"><h2>Trân Trọng Kính Mời:</h2></div>
            <div id="w-lme5ajk5" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <h2>{guestName || (readonly ? "Khách Quý" : "[Tên Khách Mời]")}</h2>
            </div>
            <div id="w-zvm741p4" className="p-absolute is-animation" data-anim="zoomIn" data-duration="4s"></div>
            
            {/* Curtains */}
            <div id="w-1j4sk2pp" className="p-absolute is-animation" data-anim="slideInLeft" data-duration="8s"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/fb/1a/3d/db/5397c85e01e68520b6e686acfb8f4b71fc813f563e456d159b222a3c-w:1260-h:2400-l:1301050-t:image/png.png')"}}></div></div>
            <div id="w-lra9lkfk" className="p-absolute is-animation" data-anim="slideInRight" data-duration="8s"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/0e/6c/18/fb/44e9347bb12368a07e646ad45939e6086fc1ce3b2b39c28663352c01-w:1260-h:2400-l:1296984-t:image/png.png')"}}></div></div>
        </div>

        {/* SECTION 2 */}
        <div id="section-2" className="p-relative image-background">
            <div id="w-zp11tpir" className="p-absolute"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/5d/4d/ed/50/c176e3fd3e67b078488c02451f6a09af9fe9e929c4f113f5c162595e-w:500-h:500-l:22239-t:image/png.png')"}}></div></div>
            <div id="w-dsdbdzxr" className="p-absolute"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/b3/56/e9/68/af4129e31d91132cb5316f8ce714f78a520be70fd480db42ff8122ce-w:500-h:500-l:43453-t:image/png.png')"}}></div></div>
            <div id="w-7sjvq3be" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s"><h2>Trân Trọng Báo Tin Lễ Thành Hôn Của</h2></div>
            
            <EditableWrapper field="groomName" label="Tên Chú Rể" defaultFontSize={40} id="w-mz04c43b" className="p-absolute is-animation" data-anim="zoomIn" data-duration="4s">
                <h1>{localData.groomName || 'Anh Tú'}</h1>
            </EditableWrapper>
            <div id="w-ejxhihol" className="p-absolute is-animation" data-anim="zoomIn" data-duration="4s"><h1>&</h1></div>
            <EditableWrapper field="brideName" label="Tên Cô Dâu" defaultFontSize={40} id="w-0vqn3fzh" className="p-absolute is-animation" data-anim="zoomIn" data-duration="4s">
                <h1>{localData.brideName || 'Diệu Nhi'}</h1>
            </EditableWrapper>
            
            <EditableWrapper field="centerImage" isText={false} id="w-y7yn4bui" className="p-absolute is-animation" data-anim="slideInUp" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${localData.centerImage || 'https://statics.pancake.vn/web-media/e2/8c/c5/37/905dccbcd5bc1c1b602c10c95acb9986765f735e075bff1097e7f457-w:736-h:981-l:47868-t:image/jpeg.jfif'}')`}}></div>
            </EditableWrapper>
            
            <div id="w-aqbkkztv" className="p-absolute is-animation" data-anim="fadeInLeft" data-duration="3s"><p>NHÀ TRAI<br/><br/></p></div>
            <div id="w-oj3482xm" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s"><p>NHÀ GÁI<br/><br/></p></div>
            
            <div id="w-vq47tj4t" className="p-absolute is-animation" data-anim="fadeInLeft" data-duration="3s">
                <EditableWrapper field="groomFather" label="Cha Chú Rể" defaultFontSize={16}><p>{localData.groomFather}</p></EditableWrapper>
                <EditableWrapper field="groomMother" label="Mẹ Chú Rể" defaultFontSize={16}><p>{localData.groomMother}</p></EditableWrapper>
            </div>
            <div id="w-fynwgspj" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s">
                <EditableWrapper field="brideFather" label="Cha Cô Dâu" defaultFontSize={16}><p>{localData.brideFather}</p></EditableWrapper>
                <EditableWrapper field="brideMother" label="Mẹ Cô Dâu" defaultFontSize={16}><p>{localData.brideMother}</p></EditableWrapper>
            </div>
            
            <div id="w-y1s24e6p" className="p-absolute is-animation" data-anim="fadeInLeft" data-duration="3s">
                <EditableWrapper field="groomAddress" label="Đ/C Nhà Trai" defaultFontSize={13}><p>{localData.groomAddress}</p></EditableWrapper>
            </div>
            <div id="w-2wvcu7z3" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s">
                <EditableWrapper field="brideAddress" label="Đ/C Nhà Gái" defaultFontSize={13}><p>{localData.brideAddress}</p></EditableWrapper>
            </div>
        </div>

        {/* SECTION 3 */}
        <div id="section-3" className="p-relative image-background">
            <div id="w-6rllui0l" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s"><h2>Trân Trọng Kính Mời</h2></div>
            
            <EditableWrapper field="galleryImages-0" isText={false} id="w-dyyqc44u" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getGalleryImg(0) || 'https://statics.pancake.vn/web-media/21/54/83/cb/163b4872b6600196d0ac068b1f046c5dd5f9d20c3ddad5e7c0abea9b-w:736-h:980-l:48194-t:image/jpeg.jfif'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="galleryImages-1" isText={false} id="w-p5zt0rep" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getGalleryImg(1) || 'https://statics.pancake.vn/web-media/3c/3b/ca/e1/e12ca0e6af675d653327f5a3b5d2c7c2385f71d26b8fee7604b45828-w:1706-h:2560-l:224512-t:image/jpeg.jpg'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="galleryImages-2" isText={false} id="w-to8ewwrh" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getGalleryImg(2) || 'https://statics.pancake.vn/web-media/6f/2b/71/1d/03a457a718b5bf78c5639d6de0521b7a19ec698dcd5737408a50bd16-w:1707-h:2560-l:275640-t:image/jpeg.jpg'}')`}}></div>
            </EditableWrapper>
            
            <div id="w-8txukiew" className="p-absolute is-animation" data-anim="fadeIn" data-duration="3s"><p>THAM DỰ TIỆC MỪNG LỄ THÀNH HÔN<br/>Vào Lúc</p></div>
            
            <EditableWrapper field="date" label="Ngày" defaultFontSize={35} id="w-qube8kir" className="p-absolute is-animation" data-anim="zoomIn" data-duration="3s">
                <p>{day}</p>
            </EditableWrapper>
            <div id="w-14ongvqg" className="p-absolute is-animation" data-anim="fadeInDown" data-duration="3s"><p>Thứ 5</p></div>
            <div id="w-tfi5tzev" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s"><p>Tháng {month}</p></div>
            
            <EditableWrapper field="time" label="Giờ" defaultFontSize={14} id="w-qkyo9emq" className="p-absolute">
                <p>{localData.time ? localData.time.replace(':',' giờ ') : '10 giờ 00'}</p>
            </EditableWrapper>
            <EditableWrapper field="date" label="Năm" defaultFontSize={14} id="w-atv2737b" className="p-absolute">
                <p>Năm {year}</p>
            </EditableWrapper>
            
            <div id="line-left" className="vertical-line is-animation" data-anim="fadeIn" data-duration="3s"></div>
            <div id="line-right" className="vertical-line is-animation" data-anim="fadeIn" data-duration="3s"></div>
            
            <EditableWrapper field="lunarDate" label="Ngày Âm" defaultFontSize={14} id="w-s8t0kmal" className="p-absolute">
                <p>{localData.lunarDate}</p>
            </EditableWrapper>
            
            <div id="w-20spjy25" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="5s"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/80/ac/eb/cf/85e75c674913047eea133813069cf9dc6d9a1acadb58c454077c94c5-w:500-h:500-l:9074-t:image/png.png')"}}></div></div>
        </div>

        {/* SECTION 4 MAP */}
        <div id="section-4" className="p-relative image-background">
            <div id="w-zajrqtwu" className="p-absolute"></div>
            <div id="w-avv4pubr" className="p-absolute is-animation" data-anim="fadeIn" data-duration="3s"><p>BUỔI TIỆC ĐƯỢC TỔ CHỨC TẠI</p></div>
            <EditableWrapper field="location" label="Địa điểm" defaultFontSize={20} id="w-m1u3o3mx" className="p-absolute is-animation" data-anim="fadeIn" data-duration="2s">
                <p>{localData.location}</p>
            </EditableWrapper>
            <EditableWrapper field="address" label="Địa chỉ" defaultFontSize={14} id="w-oq2hoi54" className="p-absolute is-animation" data-anim="fadeIn" data-duration="2s">
                <p>{localData.address}</p>
            </EditableWrapper>
            
            <EditableWrapper 
                field="mapUrl" 
                label="Link Bản Đồ" 
                isText={true} 
                id="w-prbr1wdj"
                className="p-absolute is-animation" 
                data-anim="pulse" 
                data-duration="4s"
                onClick={() => !isEditMode && window.open(localData.mapUrl || 'https://maps.google.com', '_blank')}
            >
                Xem Chỉ Đường
            </EditableWrapper>
            
            <EditableWrapper field="mapImageUrl" isText={false} id="w-vdwipz9k" className="p-absolute is-animation" data-anim="fadeIn" data-duration="4s">
                <div className="image-background" style={{backgroundImage: `url('${localData.mapImageUrl || 'https://statics.pancake.vn/web-media/f9/98/70/54/59b84c281bf331dc5baccfb671f74826f2cc248fe6459e58d0fd17bc-w:1200-h:1200-l:51245-t:image/png.png'}')`, borderRadius: '50%'}}></div>
            </EditableWrapper>
            <div id="w-bv76anck" className="p-absolute is-animation" data-anim="flash" data-duration="4s" style={{animationIterationCount: 'infinite'}}><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/59/9d/0d/23/829a2a25903e5b03a029f62911ad0300b2c875df84e143b3258f9633-w:3600-h:3600-l:165926-t:image/png.png')"}}></div></div>
        </div>

        {/* SECTION 5 RSVP */}
        <div id="section-rsvp" className="p-relative image-background">
            <div id="w-qp7zqavj" className="p-absolute is-animation" data-anim="fadeIn" data-duration="3s"></div>
            <div id="w-yj0y61d2" className="p-absolute is-animation" data-anim="zoomIn" data-duration="3s"><h2>Xác Nhận Tham Dự<br/>&<br/>Gửi Lời Chúc</h2></div>
            
            <div id="w-d688ytkq" className="p-absolute">
                 <input 
                    className="form-input p-absolute" 
                    style={{top:'0px', left:'0px'}}
                    placeholder="Tên của bạn là?" 
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                 />
                 <input 
                    className="form-input p-absolute" 
                    style={{top:'57px', left:'0px'}}
                    placeholder="Bạn là gì của Dâu Rể nhỉ?" 
                    value={guestRelation}
                    onChange={(e) => setGuestRelation(e.target.value)}
                 />
                 <input 
                    className="form-input p-absolute" 
                    style={{top:'114.5px', left:'0px'}}
                    placeholder="Gửi lời chúc đến Dâu Rể nhé!" 
                    value={guestWishes}
                    onChange={(e) => setGuestWishes(e.target.value)}
                 />
                 <select 
                    className="form-input p-absolute" 
                    style={{top:'167.5px', left:'0px', appearance: 'none', backgroundColor: '#fff'}}
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value)}
                 >
                    <option value="Có Thể Tham Dự">Có Thể Tham Dự</option>
                    <option value="Không Thể Tham Dự">Không Thể Tham Dự</option>
                 </select>
                 
                 <button 
                    className="form-btn p-absolute" 
                    style={{top:'234.5px', left:'69.5px'}}
                    onClick={(e) => handleRSVPSubmit(e as any)}
                 >
                     {isSubmittingRSVP ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                     GỬI NGAY
                 </button>
                 
                 {/* Google Sheet Config Button */}
                 {(isEditMode && !readonly) && (
                    <button 
                        onClick={() => openTextEditor('googleSheetUrl', 'Link Google Sheet Script')}
                        className="absolute p-absolute z-50 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-rose-600 hover:scale-110"
                        style={{top: '238px', right: '10px'}}
                        title="Cấu hình Google Sheet"
                    >
                        <Link size={14} />
                    </button>
                 )}
            </div>

            <div id="w-qbpa8242" className="p-absolute is-animation" data-anim="zoomIn" data-duration="3s" onClick={() => setShowBankPopup(true)}>
                GỬI MỪNG CƯỚI
            </div>
            
            <div id="w-1gjqg7sh" className="p-absolute"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/fd/42/7d/0c/1ca1e8525f99e3105eb930cd8ed684a64b07a0d9df7e0c725ca9779c-w:1260-h:2400-l:65030-t:image/png.png')"}}></div></div>
        </div>

        {/* SECTION 6 ALBUM 1 */}
        <div id="section-5" className="p-relative image-background">
            <EditableWrapper field="albumTitle" label="Tiêu đề Album" defaultFontSize={32} id="w-8job6w7j" className="p-absolute is-animation" data-anim="zoomIn" data-duration="3s">
                <p>Album hình cưới</p>
            </EditableWrapper>
            
            <EditableWrapper field="albumImages-0" isText={false} id="w-8k7luhft" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(0) || 'https://statics.pancake.vn/web-media/e9/80/6a/05/fcf14d0545da0e656237816d3712c50d2792afda074a96abfd9bcec5-w:878-h:1280-l:99344-t:image/jpeg.png'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="albumImages-1" isText={false} id="w-damsktmr" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(1) || 'https://statics.pancake.vn/web-media/09/00/8a/b4/692735fdc0775ae1530963a767ce4264df77078f659771a3cde9c5ac-w:840-h:1280-l:177736-t:image/jpeg.png'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="albumImages-2" isText={false} id="w-mibzihv0" className="p-absolute is-animation" data-anim="fadeInLeft" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(2) || 'https://statics.pancake.vn/web-media/84/b3/f5/cd/cc7957b9f0e497f01a17d05f9e73406b7650b249c169b424c7ee1767-w:854-h:1280-l:94691-t:image/jpeg.png'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="albumImages-3" isText={false} id="w-ui8sxx6m" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(3) || 'https://statics.pancake.vn/web-media/60/b1/5e/e9/89fd2d2d6cd9a62db6e70776243eb9ed8603fc1fb415bdc95da92104-w:1286-h:857-l:255701-t:image/jpeg.jpg'}')`}}></div>
            </EditableWrapper>
            <EditableWrapper field="albumImages-4" isText={false} id="w-grkveilf" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(4) || 'https://statics.pancake.vn/web-media/7a/e8/d6/f6/da197a5a3542dfe09e7faa9e118999103385582808a2e2014fc72986-w:1286-h:988-l:154700-t:image/jpeg.jpg'}')`}}></div>
            </EditableWrapper>
            
            <div id="w-y4blj2tv" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s"><div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/80/ac/eb/cf/85e75c674913047eea133813069cf9dc6d9a1acadb58c454077c94c5-w:500-h:500-l:9074-t:image/png.png')"}}></div></div>
        </div>

        {/* SECTION 7 ALBUM 2 */}
        <div id="section-6" className="p-relative image-background">
             <EditableWrapper field="albumImages-5" isText={false} id="w-05hqo9e4" className="p-absolute is-animation" data-anim="fadeInLeft" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(5) || 'https://statics.pancake.vn/web-media/ad/c0/11/16/06080e040619cef49e87d7e06a574eb61310d3dc4bdc9f0fec3638c9-w:854-h:1280-l:259362-t:image/jpeg.png'}')`}}></div>
             </EditableWrapper>
             <EditableWrapper field="albumImages-6" isText={false} id="w-m5s2x14e" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(6) || 'https://statics.pancake.vn/web-media/9d/60/03/fe/ecbd36b01369b3064a01426c59166451161e648939a52fd952564e21-w:862-h:1280-l:233470-t:image/jpeg.jpg'}')`}}></div>
             </EditableWrapper>
             <EditableWrapper field="albumImages-7" isText={false} id="w-zzn6hpkr" className="p-absolute is-animation" data-anim="fadeInLeft" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(7) || 'https://statics.pancake.vn/web-media/cb/87/1f/67/25cdb38375c4ffc82ea938461257c5fbb49f3407e402f3e6ff903387-w:854-h:1280-l:160168-t:image/jpeg.jpg'}')`}}></div>
             </EditableWrapper>
             <EditableWrapper field="albumImages-8" isText={false} id="w-jz70nzjp" className="p-absolute is-animation" data-anim="fadeInRight" data-duration="3s">
                <div className="image-background" style={{backgroundImage: `url('${getAlbumImg(8) || 'https://statics.pancake.vn/web-media/43/f6/88/e6/33fad2e85f20c3cab3d076535139371b0378fccc049b1083efffb1c5-w:894-h:1280-l:100553-t:image/jpeg.jpg'}')`}}></div>
             </EditableWrapper>
        </div>

        {/* SECTION 8 FOOTER */}
        <div id="section-7" className="p-relative">
            <EditableWrapper field="footerImage" isText={false} id="w-l2pipleo" className="p-absolute">
                <div className="image-background" style={{backgroundImage: `url('${localData.footerImage || 'https://statics.pancake.vn/web-media/ad/c0/11/16/06080e040619cef49e87d7e06a574eb61310d3dc4bdc9f0fec3638c9-w:854-h:1280-l:259362-t:image/jpeg.png'}')`}}></div>
            </EditableWrapper>
            <div id="w-way1u3f7" className="p-absolute"></div>
            <div id="w-ycfzoku0" className="p-absolute"></div>
            <div id="w-sram9ddz" className="p-absolute is-animation" data-anim="pulse" data-duration="3s" style={{animationIterationCount: 'infinite'}}>
                <div className="image-background" style={{backgroundImage: "url('https://statics.pancake.vn/web-media/cf/cf/28/5f/f9ca08165577556ed2df053b0962a0e8e670490844d7ad5e84fa48b2-w:1366-h:530-l:48754-t:image/png.png')"}}></div>
            </div>
            <div id="w-k0ppg09a" className="p-absolute is-animation" data-anim="fadeInUp" data-duration="3s">
                <p>Rất hân hạnh được đón tiếp!</p>
            </div>
        </div>

        {/* Music Control Button */}
        <div 
            onClick={handleMusicClick}
            className={`fixed left-4 bottom-4 z-[9999] w-[45px] h-[45px] bg-white/90 rounded-full flex justify-center items-center cursor-pointer shadow-md border border-gray-300 ${isPlaying ? 'animate-spin' : ''}`}
            style={{animationDuration: '4s'}}
        >
            {isPlaying ? (
               // Pause Icon
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
               // Play Icon
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
            
            {(isEditMode && !readonly) && (
                <div className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-1 w-5 h-5 flex items-center justify-center">
                    <Upload className="w-3 h-3 text-white" />
                </div>
            )}
        </div>

        {/* POPUPS */}
        <AnimatePresence>
            {showBankPopup && (
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
            )}
        </AnimatePresence>

        <AnimatePresence>
            {showSuccessModal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center" onClick={() => setShowSuccessModal(false)}>
                    <div className="bg-white p-8 rounded-xl text-center max-w-sm m-4">
                        <h3 className="text-2xl font-bold text-rose-600 mb-2 font-serif">Cảm ơn bạn!</h3>
                        <p className="text-gray-600">Lời chúc của bạn đã được gửi đến cô dâu chú rể.</p>
                        <Button className="mt-4" onClick={() => setShowSuccessModal(false)}>Đóng</Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

      </div>
      </div>
    </div>
  );
};
