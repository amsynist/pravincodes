'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';

export default function ImageSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollYProgress } = useScroll();
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [firstFrameLoaded, setFirstFrameLoaded] = useState(false);
  const frameCount = 191; 
  const frameDir = '/frames/Man_tilting_head_sideways_1080p_20260923122100_frames';

  const drawFrame = useCallback((index: number, imgArray: HTMLImageElement[]) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const img = imgArray[index];
    if (img && img.complete && img.naturalWidth > 0) {
      const canvas = canvasRef.current;
      // Setup canvas dimensions if not set
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
         canvas.width = window.innerWidth;
         canvas.height = window.innerHeight;
      }
      
      // Use COVER logic for canvas drawing to maintain aspect ratio and fill screen
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imgRatio) {
          // Canvas is wider than image -> fit to width, crop height
          drawWidth = canvas.width;
          drawHeight = canvas.width / imgRatio;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
      } else {
          // Canvas is taller than image -> fit to height, crop width
          drawHeight = canvas.height;
          drawWidth = canvas.height * imgRatio;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }
  }, []);

  useEffect(() => {
    // Preload images
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      const frameNum = i.toString().padStart(3, '0');
      img.src = `${frameDir}/frame_${frameNum}.png`;
      
      img.onload = () => {
        loadedCount++;
        if (loadedCount === 1) {
          setFirstFrameLoaded(true);
        }
      };
      loadedImages.push(img);
    }
    setImages(loadedImages);
  }, []);

  // Keep a ref to the latest frame index so we can redraw on resize or load
  const latestFrameRef = useRef(0);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (images.length === 0) return;
    const frameIndex = Math.min(
      frameCount - 1,
      Math.max(0, Math.floor(latest * frameCount))
    );
    latestFrameRef.current = frameIndex;
    
    requestAnimationFrame(() => {
      drawFrame(frameIndex, images);
    });
  });

  useEffect(() => {
    // Attempt to draw immediately in case scroll event hasn't fired yet
    if (images.length > 0 && firstFrameLoaded) {
      drawFrame(latestFrameRef.current, images);
    }
  }, [firstFrameLoaded, images, drawFrame]);

  useEffect(() => {
    const handleResize = () => {
      if (images.length > 0) {
        // Force dimension update on resize
        if (canvasRef.current) {
           canvasRef.current.width = window.innerWidth;
           canvasRef.current.height = window.innerHeight;
        }
        drawFrame(latestFrameRef.current, images);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [images, drawFrame]);

  return (
    <div className="fixed top-0 left-0 w-full h-full -z-10 bg-black pointer-events-none">
      {!firstFrameLoaded && (
        <img 
          src="/hero-image.jpg" 
          alt="Hero" 
          className="w-full h-full object-cover opacity-100" 
        />
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full transition-opacity duration-1000 ${firstFrameLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Vertical gradient overlay to match aesthetic */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-[#0a0a0a] pointer-events-none" />
    </div>
  );
}
