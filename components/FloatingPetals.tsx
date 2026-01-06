import React from 'react';
import { motion } from 'framer-motion';

export const FloatingPetals: React.FC = () => {
  // Create an array of 6 petals
  const petals = Array.from({ length: 6 });

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {petals.map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-rose-200 opacity-60"
          initial={{
            top: -50,
            left: `${Math.random() * 100}%`,
            rotate: 0,
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{
            top: '120vh',
            rotate: 360,
            x: Math.sin(i) * 100 // Swaying effect
          }}
          transition={{
            duration: Math.random() * 10 + 10, // 10-20s duration
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
};