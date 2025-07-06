import React, { useEffect, useRef } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface CardPopupProps {
  type: 'success' | 'error' | 'reject';
  message: string;
  onClose: () => void;
}

const iconMap = {
  success: <CheckCircleIcon className="h-10 w-10 text-green-500" />,
  error: <XCircleIcon className="h-10 w-10 text-red-500" />,
  reject: <XCircleIcon className="h-10 w-10 text-yellow-500" />,
};

// Add global styles for popup animation if not present
if (typeof window !== 'undefined' && document) {
  const styleId = 'card-popup-animations';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .animate-fade-in { animation: fadeInBg 0.3s; }
      .animate-popup-in { animation: popupIn 0.3s cubic-bezier(0.4,0,0.2,1); }
      @keyframes fadeInBg {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes popupIn {
        from { opacity: 0; transform: translateY(40px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
}

const CardPopup: React.FC<CardPopupProps> = ({ type, message, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the OK button for accessibility
    cardRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 transition-opacity duration-300 animate-fade-in">
      <div
        ref={cardRef}
        tabIndex={-1}
        className="bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-700 flex flex-col items-center relative
          transition-all duration-300 transform animate-popup-in"
        style={{ outline: 'none' }}
      >
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl font-bold transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="mb-4 flex flex-col items-center">
          {iconMap[type]}
        </div>
        <div className="text-white text-lg text-center whitespace-pre-line mb-2">
          {message}
        </div>
        <button
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold shadow transition-colors"
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default CardPopup;
