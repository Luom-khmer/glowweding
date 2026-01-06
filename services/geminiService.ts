import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateWeddingWishes = async (
  groom: string,
  bride: string,
  location: string,
  style: string
): Promise<string> => {
  try {
    const prompt = `
      Hãy viết một đoạn lời mời đám cưới ngắn gọn, lãng mạn và xúc động bằng tiếng Việt.
      
      Thông tin:
      - Chú rể: ${groom}
      - Cô dâu: ${bride}
      - Địa điểm: ${location}
      - Phong cách lời văn: ${style} (ví dụ: Trang trọng, Hài hước, Ấm áp)
      
      Yêu cầu:
      - Độ dài khoảng 3-4 câu.
      - Không dùng các ký tự đặc biệt như markdown.
      - Tập trung vào tình yêu và sự hiện diện của khách mời.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Rất hân hạnh được đón tiếp quý khách tại lễ thành hôn của chúng tôi.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Trân trọng kính mời quý khách đến dự lễ thành hôn của chúng tôi.";
  }
};