"use client";

import { useEffect } from "react";

/**
 * GlobalExperience Component
 * Handles the application-wide particle background (HeroCanvas)
 * and the custom "dot and ring" cursor animation.
 *
 * Performance optimizations:
 * - Page Visibility API: pauses animation when tab is hidden
 * - Mobile: skip particle connection lines (O(n²) → O(n))
 * - Reduced connection distance: 95px → 80px
 */
export default function GlobalExperience() {

  // PORTAL-WIDE ENABLED

  useEffect(() => {
    // --- CURSOR LOGIC ---
    const dot = document.getElementById('cd');
    const ring = document.getElementById('cr');
    let mx = 0, my = 0, rx = 0, ry = 0;
    
    const isTouch = !window.matchMedia('(pointer: fine)').matches;
    if (isTouch) {
      if (dot) dot.style.display = 'none';
      if (ring) ring.style.display = 'none';
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouch) return;
      mx = e.clientX; 
      my = e.clientY; 
      // Handled in rAF for sync
    };
    if (!isTouch) document.addEventListener('mousemove', handleMouseMove);

    let cursorRaf: number;
    const animateCursor = () => {
      rx += (mx - rx) * 0.3; 
      ry += (my - ry) * 0.3; 
      if(ring) {
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      }
      if(dot) {
        dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      }
      cursorRaf = requestAnimationFrame(animateCursor);
    };
    if (!isTouch) animateCursor();

    const hoverSelector = 'button, a, .hwc, .fs, .tt, .ovc, .tcard, .rmc, .ws, .ksen, .kbtn, #mclose, .mtrybtn, .bp, .bo, [role="button"], .cursor-pointer';
    
    // Use an observer for dynamic content (like tables or modals)
    const applyHoverListeners = (root: ParentNode = document) => {
      root.querySelectorAll(hoverSelector).forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('ch'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('ch'));
      });
    };

    applyHoverListeners();
    
    const observer = new MutationObserver((mutations) => {
       mutations.forEach(m => {
         if(m.type === 'childList') applyHoverListeners();
       });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // --- HERO CANVAS (PARTICLES) LOGIC ---
    const canvas = document.getElementById('hc') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    let W = 0, H = 0, t = 0, hmx = 0, hmy = 0;
    let pColor = '123, 17, 19';

    class P {
      x = 0; y = 0; vx = 0; vy = 0; rad = 0; a = 0;
      constructor() { this.r() }
      r() {
        const isMob = window.innerWidth < 768;
        this.x = Math.random() * W; 
        this.y = Math.random() * H; 
        this.vx = (Math.random() - 0.5) * (isMob ? 0.2 : 0.4);
        this.vy = (Math.random() - 0.5) * (isMob ? 0.2 : 0.4); 
        this.rad = Math.random() * (isMob ? 0.8 : 1.5) + 0.5; 
        this.a = Math.random() * (isMob ? 0.2 : 0.3) + 0.1;
      }
      u() {
        this.x += this.vx; 
        this.y += this.vy; 
        if(hmx && hmy) {
          const dx = hmx - this.x;
          const dy = hmy - this.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if(dist < 150) {
            const angle = Math.atan2(dy, dx);
            const force = (150 - dist) / 150;
            this.vx -= Math.cos(angle) * force * 0.2;
            this.vy -= Math.sin(angle) * force * 0.2;
          }
        }
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.r();
      }
      d() {
        if(!ctx) return;
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, this.rad, 0, Math.PI * 2); 
        ctx.fillStyle = `rgba(${pColor}, ${this.a})`; 
        ctx.fill();
      }
    }

    const parts: P[] = [];

    function resize() {
      if(!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    
    if (canvas && ctx) {
      resize();
      window.addEventListener('resize', resize);
      
      const pCount = window.innerWidth < 768 ? 45 : 150;
      for (let i = 0; i < pCount; i++) parts.push(new P());
      
      const handleCanvasMouse = (e: MouseEvent) => { hmx = e.clientX; hmy = e.clientY; };
      document.addEventListener('mousemove', handleCanvasMouse);
      
      let canvasRaf: number;
      let isVisible = true;

      // Page Visibility API — pause animation when tab is hidden
      const handleVisibility = () => {
        isVisible = !document.hidden;
        if (isVisible) canvasRaf = requestAnimationFrame(draw);
      };
      document.addEventListener('visibilitychange', handleVisibility);

      const isMobile = window.innerWidth < 768;

      const draw = () => {
        if (!ctx || !isVisible) return;
        ctx.clearRect(0, 0, W, H); 
        t += 0.0015;

        const isDark = document.documentElement.className.includes('dark');
        pColor = isDark ? '255, 215, 0' : '123, 17, 19';
        
        // Ambient Gradients
        const g1 = ctx.createRadialGradient(W*.3+Math.sin(t)*80, H*.4+Math.cos(t*.7)*50, 0, W*.3, H*.4, 450);
        g1.addColorStop(0, `rgba(${pColor}, ${isDark ? 0.04 : 0.06})`); 
        g1.addColorStop(1, 'transparent'); 
        ctx.fillStyle = g1; 
        ctx.fillRect(0, 0, W, H);
        
        const g2 = ctx.createRadialGradient(W*.72+Math.cos(t*.8)*70, H*.55+Math.sin(t)*60, 0, W*.72, H*.55, 380);
        g2.addColorStop(0, isDark ? `rgba(255, 215, 0, 0.03)` : 'rgba(158, 26, 28, 0.04)'); 
        g2.addColorStop(1, 'transparent'); 
        ctx.fillStyle = g2; 
        ctx.fillRect(0, 0, W, H);
        
        parts.forEach(p => { p.u(); p.d() });
        
        // Skip connection lines on mobile (O(n²) → O(n))
        if (!isMobile) {
          for (let i = 0; i < parts.length; i++) {
            for (let j = i + 1; j < parts.length; j++) {
              const dx = parts[i].x - parts[j].x;
              const dy = parts[i].y - parts[j].y;
              const d = dx * dx + dy * dy; // Skip sqrt — compare squared distance
              if (d < 6400) { // 80² = 6400
                ctx.beginPath(); 
                ctx.moveTo(parts[i].x, parts[i].y); 
                ctx.lineTo(parts[j].x, parts[j].y); 
                ctx.strokeStyle = `rgba(${pColor}, ${0.05 * (1 - Math.sqrt(d) / 80)})`; 
                ctx.lineWidth = 0.5; 
                ctx.stroke();
              }
            }
          }
        }
        canvasRaf = requestAnimationFrame(draw);
      }
      draw();
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mousemove', handleCanvasMouse);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(cursorRaf);
        cancelAnimationFrame(canvasRaf);
        observer.disconnect();
      };
    }
  }, []);

  return (
    <>
      <canvas id="hc" />
      <div id="cur">
        <div id="cd" />
        <div id="cr" />
      </div>
    </>
  );
}
