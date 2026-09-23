'use client';

import { useEffect, useRef } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';

export default function VideoScroll() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (videoRef.current && videoRef.current.duration) {
      // Calculate current time based on scroll progress and total duration
      const newTime = latest * videoRef.current.duration;
      // Use requestAnimationFrame to ensure smooth updates
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = newTime;
        }
      });
    }
  });

  useEffect(() => {
    // Preload video and ensure it stops playing automatically
    if (videoRef.current) {
      videoRef.current.pause();
      // Force load the first frame
      videoRef.current.currentTime = 0;
    }
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-full -z-10 bg-slate-950 pointer-events-none">
      <video
        ref={videoRef}
        src="/3d-scroll-video.mp4"
        className="w-full h-full object-cover opacity-50 mix-blend-screen"
        muted
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-blue-950/40 to-slate-950/90" />
    </div>
  );
}
