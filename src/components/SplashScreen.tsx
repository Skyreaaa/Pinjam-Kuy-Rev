import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen: React.FC<{ onFinish?: () => void }> = ({ onFinish }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFade(true), 3000); // 3 detik
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 3500); // Tambahan waktu untuk animasi fade out
    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-container${fade ? ' fade-out' : ''}`}>
      {/* PERBAIKAN: Mengganti require dengan path statis */}
      <img src="/Logo.png" alt="Splash Pinjam Kuy" className="splash-img" />
    </div>
  );
};

export default SplashScreen;