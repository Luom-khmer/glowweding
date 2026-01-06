
export interface Template {
  id: string;
  name: string;
  thumbnailUrl: string;
  style: 'modern' | 'classic' | 'floral' | 'luxury' | 'red-gold' | 'personalized';
  color: string;
}

export interface InvitationData {
  groomName: string;
  groomFather: string;
  groomMother: string;
  brideName: string;
  brideFather: string;
  brideMother: string;
  date: string;
  time: string;
  location: string;
  address: string;
  message: string;
  imageUrl?: string;
  // Các trường tùy chỉnh
  mapUrl?: string;       // Link Google Maps tùy chỉnh
  mapImageUrl?: string;  // Ảnh tròn đại diện cho bản đồ (Mới)
  qrCodeUrl?: string;    // Ảnh QR Ngân hàng
  bankInfo?: string;     // Thông tin số tài khoản
  musicUrl?: string;     // Link nhạc nền (mp3)
  
  // Link Google Sheet Webhook riêng cho từng thiệp
  googleSheetUrl?: string; 

  // Các ảnh mới
  centerImage?: string;  // Ảnh ở giữa phần thông tin cha mẹ
  footerImage?: string;  // Ảnh ở chân trang (đen trắng)
  albumImages?: string[]; // Mảng 5 ảnh album
  
  // Section Trân trọng kính mời (3 ảnh)
  galleryImages?: string[]; 
  lunarDate?: string; // Ngày âm lịch
  
  // Địa chỉ nhà trai/gái
  groomAddress?: string;
  brideAddress?: string;

  // Tiêu đề tùy chỉnh
  invitedTitle?: string; // Thay thế cho "Trân Trọng Kính Mời"
  albumTitle?: string;   // Thay thế cho "Album Hình Cưới"

  // Cấu hình style riêng cho từng element (VD: Font size)
  elementStyles?: Record<string, { fontSize?: number }>;

  // Template Style
  style?: 'modern' | 'classic' | 'floral' | 'luxury' | 'red-gold' | 'personalized';
}

export interface SavedInvitation {
  id: string;
  customerName: string; 
  createdAt: string;
  data: InvitationData;
  link: string;
}

export type UserRole = 'admin' | 'editor' | 'user';

export interface User {
  uid: string;
  name: string;
  email: string;
  picture: string;
  role: UserRole;
}

export type ViewState = 'home' | 'templates' | 'editor' | 'preview' | 'login' | 'pricing' | 'guest-manager' | 'guest-view' | 'admin-dashboard' | 'tool-generator';

export const TEMPLATES: Template[] = [
  {
    id: 't5',
    name: 'Hồng Kim Sang Trọng',
    thumbnailUrl: 'https://statics.pancake.vn/web-media/ab/56/c3/d2/ae46af903d624877e4e71b00dc5ab4badaa10a8956d3c389ccbc73e9-w:1080-h:1620-l:151635-t:image/jpeg.jpeg',
    style: 'red-gold',
    color: 'bg-rose-50'
  },
  {
    id: 't6',
    name: 'Thiệp dùng tên riêng',
    thumbnailUrl: 'https://statics.pancake.vn/web-media/3c/3b/ca/e1/e12ca0e6af675d653327f5a3b5d2c7c2385f71d26b8fee7604b45828-w:1706-h:2560-l:224512-t:image/jpeg.jpg',
    style: 'personalized',
    color: 'bg-amber-50'
  },
  {
    id: 't4',
    name: 'Luxury Gold',
    thumbnailUrl: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1080&auto=format&fit=crop',
    style: 'luxury',
    color: 'bg-yellow-50'
  }
];
    