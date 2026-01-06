
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, limit } from 'firebase/firestore';
import { User, UserRole } from '../types';

// Danh sách email được mặc định là Admin (Super Admin) - Đã thêm email của bạn
const SUPER_ADMINS = ['danhluom68g1@gmail.com'];

export const userService = {
  // Đồng bộ user khi đăng nhập
  syncUser: async (firebaseUser: any): Promise<User> => {
    const email = firebaseUser.email || '';
    let role: UserRole = 'user';

    // 1. Xác định role dự kiến (Fallback) trước khi gọi DB
    if (SUPER_ADMINS.includes(email)) {
        role = 'admin';
    }

    try {
        // Cố gắng kết nối Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        // Logic xác định role từ DB (Nếu kết nối thành công)
        if (SUPER_ADMINS.includes(email)) {
            role = 'admin';
        } else if (userSnap.exists()) {
            // Nếu user thường đã tồn tại, lấy role từ DB
            const userData = userSnap.data();
            role = userData.role || 'user';
        } else {
            // Nếu là user mới tinh, kiểm tra xem có phải user đầu tiên của hệ thống không
            // Sử dụng limit(1) để tối ưu hiệu năng, không tải toàn bộ user
            const usersCol = collection(db, 'users');
            const q = query(usersCol, limit(1));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                role = 'admin';
            }
        }

        const userDataToSave = {
            email: email,
            name: firebaseUser.displayName || 'User',
            role: role,
            lastLogin: new Date().toISOString()
        };
        
        // Nếu user chưa tồn tại thì thêm createdAt
        if (!userSnap.exists()) {
            Object.assign(userDataToSave, { createdAt: new Date().toISOString() });
        }

        // Dùng setDoc với merge: true để cập nhật thông tin và quyền mới nhất
        await setDoc(userRef, userDataToSave, { merge: true });

    } catch (error: any) {
        console.warn("Firestore sync failed:", error.code, error.message);
        // Nếu lỗi là 'permission-denied', user vẫn đăng nhập được nhưng không lưu được vào DB
        // Role sẽ giữ giá trị Fallback đã tính ở trên.
    }

    return {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'User',
      email: email,
      picture: firebaseUser.photoURL || '',
      role: role
    };
  },

  // Lấy danh sách tất cả user (Chỉ dành cho Admin)
  getAllUsers: async (): Promise<any[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting users:", error);
        return [];
    }
  },

  // Cập nhật quyền hạn (Chỉ dành cho Admin)
  updateUserRole: async (uid: string, newRole: UserRole) => {
    try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { role: newRole });
    } catch (error) {
        console.error("Error updating role:", error);
        throw error;
    }
  }
};
