
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { InvitationData, SavedInvitation } from '../types';

const COLLECTION_NAME = 'invitations';

export const invitationService = {
  // Tạo mới thiệp
  createInvitation: async (customerName: string, data: InvitationData, createdBy: string): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        customerName,
        data,
        createdBy,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating invitation:", error);
      throw error;
    }
  },

  // Cập nhật thiệp
  updateInvitation: async (id: string, customerName: string, data: InvitationData): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        customerName,
        data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating invitation:", error);
      throw error;
    }
  },

  // Lấy danh sách tất cả thiệp (Sắp xếp mới nhất trước)
  getAllInvitations: async (): Promise<SavedInvitation[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          customerName: d.customerName,
          createdAt: new Date(d.createdAt).toLocaleDateString('vi-VN'),
          data: d.data as InvitationData,
          link: `${window.location.origin}?invitationId=${doc.id}` // Tạo link động
        };
      });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      return [];
    }
  },

  // Lấy chi tiết 1 thiệp theo ID (Dùng cho khách xem)
  getInvitationById: async (id: string): Promise<SavedInvitation | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          customerName: d.customerName,
          createdAt: new Date(d.createdAt).toLocaleDateString('vi-VN'),
          data: d.data as InvitationData,
          link: `${window.location.origin}?invitationId=${docSnap.id}`
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting invitation:", error);
      return null;
    }
  },

  // Xóa thiệp
  deleteInvitation: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error("Error deleting invitation:", error);
      throw error;
    }
  }
};
