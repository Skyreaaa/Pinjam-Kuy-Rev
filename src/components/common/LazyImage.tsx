import React, { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  alt: string;
  className?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
};

const LazyImage: React.FC<Props> = ({ src, alt, className, onError }) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string>('');

  useEffect(() => {
    if (!imgRef.current) return;
    let obs: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs && obs.disconnect();
          }
        });
      }, { rootMargin: '100px' });
      obs.observe(imgRef.current);
    } else {
      // Fallback: show immediately
      setVisible(true);
    }
    return () => { obs && obs.disconnect(); };
  }, []);

  useEffect(() => {
    if (visible) setLoadedSrc(src);
  }, [visible, src]);

  return <img ref={imgRef} src={loadedSrc} alt={alt} className={className} onError={onError} />;
};

export default LazyImage;
