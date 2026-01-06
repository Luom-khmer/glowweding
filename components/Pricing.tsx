import React from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Zap, Heart } from 'lucide-react';
import { Button } from './Button';

interface PricingProps {
  onSelectPlan: (plan: string) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const plans = [
    {
      name: "Cơ Bản",
      price: "0đ",
      description: "Dành cho đám cưới nhỏ, ấm cúng",
      features: [
        "Chọn 1 mẫu thiệp cơ bản",
        "Lưu thiệp không giới hạn",
        "Chia sẻ qua Link",
        "Hỗ trợ quảng cáo"
      ],
      icon: <Heart className="w-6 h-6 text-rose-400" />,
      recommended: false
    },
    {
      name: "Cao Cấp",
      price: "199.000đ",
      description: "Đầy đủ tính năng cho ngày trọng đại",
      features: [
        "Mở khóa tất cả mẫu thiệp",
        "AI viết lời mời chuyên nghiệp",
        "Tải lên Album ảnh cưới (Slide)",
        "Bản đồ chỉ đường Google Maps",
        "Không quảng cáo",
        "Nhạc nền tùy chọn"
      ],
      icon: <Star className="w-6 h-6 text-amber-400" />,
      recommended: true
    },
    {
      name: "Vĩnh Viễn",
      price: "499.000đ",
      description: "Lưu giữ kỷ niệm mãi mãi",
      features: [
        "Mọi tính năng gói Cao Cấp",
        "Tên miền riêng (tenban.com)",
        "Lưu trữ website mãi mãi",
        "Xuất file in ấn chất lượng cao",
        "Hỗ trợ ưu tiên 24/7"
      ],
      icon: <Zap className="w-6 h-6 text-purple-400" />,
      recommended: false
    }
  ];

  return (
    <div className="px-4 py-12 max-w-7xl mx-auto relative z-10">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold mb-4 serif text-gray-900">Bảng Giá Dịch Vụ</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">Chọn gói phù hợp nhất để lưu giữ khoảnh khắc đẹp nhất cuộc đời bạn. Thanh toán một lần, sử dụng trọn đời.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative bg-white rounded-2xl p-8 border ${plan.recommended ? 'border-rose-400 shadow-2xl scale-105 z-10' : 'border-gray-100 shadow-lg'}`}
          >
            {plan.recommended && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md">
                Khuyên Dùng
              </div>
            )}
            
            <div className="flex items-center justify-between mb-4">
               <div className={`p-3 rounded-lg ${plan.recommended ? 'bg-rose-50' : 'bg-gray-50'}`}>
                 {plan.icon}
               </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">{plan.description}</p>
            
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
            </div>

            <ul className="space-y-4 mb-8">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center text-gray-600">
                  <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${plan.recommended ? 'text-rose-500' : 'text-gray-400'}`} />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button 
              variant={plan.recommended ? 'primary' : 'outline'} 
              className="w-full"
              onClick={() => onSelectPlan(plan.name)}
            >
              {plan.price === "0đ" ? "Dùng Miễn Phí" : "Đăng Ký Ngay"}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};