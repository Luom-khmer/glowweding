
import React from 'react';
import { motion } from 'framer-motion';
import { InvitationData, Template } from '../types';
import { MapPin, Calendar, Clock, Heart, ArrowLeft, Lock } from 'lucide-react';
import { Button } from './Button';
import { TemplatePersonalized } from './TemplatePersonalized';

interface PreviewProps {
  data: InvitationData;
  template: Template;
  onBack: () => void;
  onSave?: (newData: InvitationData) => void;
  onAutosave?: (newData: InvitationData) => void; // New Prop for Autosave
  readonly?: boolean; 
}

export const Preview: React.FC<PreviewProps> = ({ data, template, onBack, onSave, onAutosave, readonly = false }) => {
  
  // Logic render cho mẫu Personalized
  if (template.style === 'personalized') {
     return (
        <div className="min-h-screen bg-gray-100/50 flex flex-col items-center justify-start py-0 relative overflow-x-hidden">
           
           {/* Chỉ hiện cảnh báo này nếu đang ở chế độ readonly (User thường) */}
           {readonly && (
               <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] bg-black/70 text-white px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg pointer-events-none">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium">Chế độ chỉ xem (Cần quyền Editor để sửa)</span>
               </div>
           )}
           
           <div className="w-full relative">
               <div className="fixed top-0 left-0 w-full bg-black/50 text-white text-center py-1 z-50 text-xs md:hidden">
                   {readonly ? "Vuốt để xem thiệp mẫu" : "Vuốt để xem • Nhấn bút chì góc phải để sửa"}
               </div>
               
               <TemplatePersonalized 
                    data={data} 
                    onSave={onSave} 
                    onAutosave={onAutosave} 
                    readonly={readonly} 
               />
           </div>
        </div>
     );
  }

  // Fallback cho các mẫu cũ nếu còn tồn tại trong data cũ
  const getStyleClasses = () => {
    switch(template.style) {
        case 'floral': return 'border-8 border-rose-100 bg-white text-emerald-900';
        case 'modern': return 'border-2 border-slate-800 bg-white text-slate-900';
        default: return 'border-8 border-white shadow-2xl bg-rose-50 text-rose-900';
    }
  };

  const getAccentColor = () => {
    switch(template.style) {
        case 'floral': return 'text-rose-400';
        case 'modern': return 'text-slate-500';
        default: return 'text-rose-500';
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 px-4 flex flex-col items-center justify-center relative z-10">
        
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className={`w-full max-w-md p-8 rounded-xl shadow-2xl relative overflow-hidden ${getStyleClasses()}`}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-white opacity-20 rounded-full -translate-x-10 -translate-y-10 blur-2xl"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-pink-500 opacity-10 rounded-full translate-x-10 translate-y-10 blur-3xl"></div>

        <div className="text-center relative z-10 space-y-6">
            <p className="uppercase tracking-[0.2em] text-xs font-bold opacity-70">Save The Date</p>
            
            <div className="space-y-2">
                <h1 className="script-font text-6xl leading-tight text-gradient bg-clip-text">
                    {data.groomName}
                </h1>
                <div className={`flex items-center justify-center my-2 ${getAccentColor()}`}>
                    <span className="h-px w-10 bg-current opacity-50"></span>
                    <Heart className="w-6 h-6 mx-3 fill-current animate-pulse" />
                    <span className="h-px w-10 bg-current opacity-50"></span>
                </div>
                <h1 className="script-font text-6xl leading-tight">
                    {data.brideName}
                </h1>
            </div>

            <div className="py-6">
                <p className="italic font-serif opacity-80 mb-6 text-lg leading-relaxed px-4">
                    "{data.message}"
                </p>
                <div className="w-16 h-1 mx-auto rounded-full bg-rose-300"></div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm font-semibold uppercase tracking-wider">
                <div className="flex items-center justify-center space-x-2">
                    <Calendar className={`w-5 h-5 ${getAccentColor()}`} />
                    <span>{data.date}</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                    <Clock className={`w-5 h-5 ${getAccentColor()}`} />
                    <span>{data.time}</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                    <MapPin className={`w-5 h-5 ${getAccentColor()}`} />
                    <span className="text-center">{data.location}</span>
                </div>
            </div>
            
            <div className="pt-4 text-xs opacity-60">
                {data.address}
            </div>
        </div>
      </motion.div>

      <div className="mt-8 flex gap-4">
        <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Chọn mẫu khác
        </Button>
        {/* Chỉ hiện nút Lưu nếu không phải readonly */}
        {!readonly && (
            <Button onClick={() => onSave ? onSave(data) : alert("Tính năng chia sẻ đang phát triển!")}>Lưu mẫu này</Button>
        )}
      </div>
    </div>
  );
};
