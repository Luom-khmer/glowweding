
// Mảng dữ liệu cho Can và Chi
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

export const getYearCanChi = (year: number): string => {
  // Can: 0=Canh, 1=Tan... (Year ending in 0 is Canh)
  const canIndex = year % 10;
  // Chi: 0=Than, 1=Dau...
  const chiIndex = year % 12;
  return `${CAN[canIndex]} ${CHI[chiIndex]}`;
};

export const convertSolarToLunarFull = (solarDateStr: string): string => {
    if (!solarDateStr) return '';
    
    try {
        const [year, month, day] = solarDateStr.split('-').map(Number);
        // Lưu ý: Month trong Date constructor bắt đầu từ 0
        const date = new Date(year, month - 1, day);
        
        // SỬA ĐỔI: Sử dụng 'en-US-u-ca-chinese' để đảm bảo trình duyệt trả về SỐ (1, 2, 3...) 
        // thay vì ký tự tiếng Trung, sau đó ta sẽ tự format sang tiếng Việt.
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric' 
        });
        
        const parts = formatter.formatToParts(date);
        
        // Lấy các thành phần ngày tháng năm âm lịch
        const lDay = parts.find(p => p.type === 'day')?.value || '';
        const lMonth = parts.find(p => p.type === 'month')?.value || '';
        
        // relatedYear thường trả về năm dương tương ứng với năm âm
        const lYearVal = parts.find(p => (p.type as string) === 'relatedYear')?.value || parts.find(p => p.type === 'year')?.value;
        
        // Tính Can Chi
        const numericYear = lYearVal ? parseInt(lYearVal) : year;
        const canChiString = getYearCanChi(numericYear);

        // Format Ngày: thêm số 0 ở đầu nếu < 10
        const formattedDay = lDay.padStart(2, '0');

        // Format Tháng: Xử lý Tiếng Việt (Giêng, Chạp)
        let formattedMonth = lMonth;
        if (lMonth === '1') {
            formattedMonth = 'Giêng';
        } else if (lMonth === '12') {
            formattedMonth = 'Chạp';
        } else {
            formattedMonth = lMonth.padStart(2, '0');
        }

        return `(Tức Ngày ${formattedDay} Tháng ${formattedMonth} Năm ${canChiString})`;

    } catch (e) {
        console.warn('Lunar conversion failed', e);
        const [y] = solarDateStr.split('-').map(Number);
        return `(Tức Ngày ... Tháng ... Năm ${getYearCanChi(y)})`;
    }
}

// Giữ lại hàm cũ để tương thích
export const updateLunarWithDetail = (solarDateStr: string, currentLunarStr: string) => {
     return convertSolarToLunarFull(solarDateStr);
}
