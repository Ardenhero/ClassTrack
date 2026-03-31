"use client";

import { useEffect } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import "./about.css";

interface Spec {
  k: string;
  v: string;
}

interface HWComponent {
  fb: string;
  badge: string;
  title: string;
  subt: string;
  desc: string;
  dims: string;
  specs: Spec[];
  role: string;
  tags: string[];
}

const syne = Syne({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-dm-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains-mono" });

export default function AboutPage() {
  useEffect(() => {
    // REVEAL ON SCROLL
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('vis');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));

    const handleScroll = () => {
        const nav = document.getElementById('nav');
        if(nav) nav.classList.toggle('sc', window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);

    function countUp(el: HTMLElement, target: number | 'inf', sfx?: string) {
      if (target === 'inf') { el.textContent = '∞'; return; }
      let n = 0; const dur = 1800, step = 16, inc = target / (dur / step);
      const tm = setInterval(() => {
        n = Math.min(n + inc, target as number);
        el.textContent = Math.floor(n).toLocaleString() + (sfx || '');
        if (n >= (target as number)) {
          el.textContent = (target as number).toLocaleString() + (sfx || '');
          clearInterval(tm);
        }
      }, step);
    }
    const sObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.snum').forEach((el: Element) => {
             const t = el.getAttribute('data-t');
             const s = el.getAttribute('data-s') || '';
             countUp(el as HTMLElement, t === 'inf' ? 'inf' : parseInt(t || '0'), s);
          });
          sObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    const statsEl = document.getElementById('stats');
    if (statsEl) sObs.observe(statsEl);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      obs.disconnect();
      sObs.disconnect();
    };
  }, []);
  
  const toggleFlow = (id: string) => {
    const el = document.getElementById(id);
    if(!el) return;
    const was = el.classList.contains('act');
    document.querySelectorAll('.fs').forEach(x => x.classList.remove('act'));
    if (!was) el.classList.add('act');
  };


  const hwData: Record<string, HWComponent> = {
    esp:{
      fb:'<div class=\"esp-screen\"></div>',badge:'Microcontroller Unit',title:'ESP32-S3 Touch LCD',subt:'// WAVESHARE ESP32-S3-TOUCH-LCD-7',
      desc:'The brain and face of the ClassTrack kiosk. Features a dual-core Xtensa LX7 processor paired with an integrated 7-inch capacitive touch display. Handles fingerprint UART communication, WiFi HTTP requests to Supabase, touch UI rendering, and GPIO LED control — all simultaneously at 240MHz.',
      dims:'PCB: 165.72 × 97.60mm · Display: 192.96 × 110.76mm · 4×M3 + 4×M2.5 mount',
      specs:[{k:'Processor',v:'Dual-Core LX7 @ 240MHz'},{k:'Memory',v:'512KB SRAM + 8MB PSRAM'},{k:'Flash',v:'16MB Onboard Flash'},{k:'Display',v:'7\" Capacitive Touch LCD'},{k:'Connectivity',v:'WiFi 802.11 b/g/n + BLE 5.0'},{k:'Interfaces',v:'UART, SPI, I²C, GPIO'},{k:'Operating Voltage',v:'5V via USB-C'},{k:'Baud Rate',v:'57600 (AS608 comms)'}],
      role:'Acts as the central controller of the ClassTrack kiosk. Receives fingerprint match data from the AS608 via UART, packages the attendance payload, and sends it to Supabase via WiFi HTTPS POST. Simultaneously drives the 7\" touch LCD for real-time user feedback and controls green/red LEDs for visual confirmation of scan results.',
      tags:['Dual-Core LX7','WiFi 2.4GHz','BLE 5.0','7\" Touch LCD','UART + SPI + I²C']
    },
    as608:{
      fb:'🫆',badge:'Biometric Sensor',title:'AS608 Fingerprint',subt:'// OPTICAL FINGERPRINT MODULE',
      desc:'An optical fingerprint sensor with a built-in DSP chip. Captures high-resolution fingerprint images at 500 DPI, extracts minutiae points, and performs template matching entirely onboard — delivering a match result to the ESP32-S3 via UART in under one second. Supports 360° finger placement rotation.',
      dims:'Module: ~20 × 21 × 21.5mm · Connector: UART TTL · Power: 3.3V/5V',
      specs:[{k:'Scan Resolution',v:'500 DPI'},{k:'Template Storage',v:'Up to 162 templates'},{k:'Match Time',v:'< 1 second'},{k:'Interface',v:'UART TTL 3.3V / 5V'},{k:'Baud Rate',v:'57600 bps'},{k:'FAR',v:'< 0.001%'},{k:'FRR',v:'< 0.1%'},{k:'Rotation Support',v:'360° recognition'}],
      role:'Serves as the biometric input device of the ClassTrack kiosk. When a student places their finger, the AS608 performs an optical scan, extracts minutiae points using its onboard DSP, matches against stored templates, and sends a confirmation packet — including matched template ID and confidence score — to the ESP32-S3 via UART at 57600 baud.',
      tags:['500 DPI','162 Templates','< 1s Match','UART 57600 bps','Onboard DSP']
    }
  };

  const openModal = (key: string) => {
    const d = hwData[key];
    const mfb = document.getElementById('mfb');
    if(mfb) mfb.innerHTML = d.fb;
    
    document.getElementById('mdims')!.textContent = d.dims;
    document.getElementById('mbadge-txt')!.textContent = d.badge;
    document.getElementById('mtitle')!.textContent = d.title;
    document.getElementById('msubt')!.textContent = d.subt;
    document.getElementById('mdesc')!.textContent = d.desc;
    document.getElementById('mrld')!.textContent = d.role;
    
    document.getElementById('mspgrid')!.innerHTML = d.specs.map((s: Spec) => `<div class=\"msp\"><div class=\"mspk\">${s.k}</div><div class=\"mspv\">${s.v}</div></div>`).join('');
    document.getElementById('mtagbar')!.innerHTML = d.tags.map((tg: string) => `<div class=\"mtag\">${tg}</div>`).join('');
    
    document.getElementById('modal')!.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    document.getElementById('modal')!.classList.remove('open');
    document.body.style.overflow = '';
  };

  useEffect(() => {
     const down = (e: KeyboardEvent) => { if(e.key === 'Escape') closeModal(); };
     document.addEventListener('keydown', down);
     return () => document.removeEventListener('keydown', down);
  }, []);

  let busy = false;
  const kleds = (c: string) => {
    [1,2,3,4].forEach(n => {
       const el = document.getElementById('kl'+n);
       if(el) el.className = 'led' + (c ? ' '+c : '');
    });
  };
  const kladd = (msg: string, cls = '') => {
    const klog = document.getElementById('klog');
    if(!klog) return;
    const d = document.createElement('div');
    d.className = 'll' + (cls ? ' '+cls : '');
    d.textContent = msg;
    klog.appendChild(d);
    klog.scrollTop = klog.scrollHeight;
  };
  const setKS = (mainClass:string, mainTxt:string, subTxt:string, senClass:string) => {
    const ksm = document.getElementById('ksm');
    const kss = document.getElementById('kss');
    const ksen = document.getElementById('ksen');
    if(ksm) { ksm.className = 'kmain ' + mainClass; ksm.textContent = mainTxt; }
    if(kss) { kss.textContent = subTxt; }
    if(ksen) { ksen.className = 'ksen ' + senClass; }
  };

  const kScan = (ok: boolean) => {
    if (busy) return;
    busy = true; 
    kleds('');
    setKS('scan', 'SCANNING', '', 'scan');
    kladd('[AS608] Optical scan initiated...');
    setTimeout(() => { kladd('[AS608] Extracting minutiae points...');
    setTimeout(() => { kladd('[AS608] DSP template matching...');
    setTimeout(() => {
      if (ok) {
        kladd('[AS608] Match → ID:0x03 · Juan Dela Cruz', 'lok');
        kladd('[ESP32] HTTPS POST /attendance → 200 OK', 'lok');
        kladd('[SUPABASE] Row inserted + RT broadcast','lok');
        kladd('[UI] Dashboard updated in real-time','lok');
        setKS('ok', 'SUCCESS', 'Juan Dela Cruz — Present', 'ok');
        kleds('g');
      } else {
        kladd('[AS608] No match · Confidence: 22 (threshold: 60)', 'lerr');
        kladd('[ESP32] Attendance rejected', 'lerr');
        setKS('fail', 'FAILED', 'Fingerprint not recognized', 'fail');
        kleds('r');
      }
      setTimeout(() => {
        setKS('idle', 'READY', 'Place finger on sensor', '');
        kleds('');
        kladd('[READY] Awaiting next input...', 'lsys');
        busy = false;
      }, 3200);
    }, 700)}, 600)}, 500);
  };

  const kReboot = () => {
    if (busy) return;
    busy = true;
    setKS('scan', 'REBOOTING', 'Please wait...', '');
    const klog = document.getElementById('klog');
    if(klog) klog.innerHTML = '';
    const ls = [
        '[SYS] Reboot signal received...',
        '[SYS] Halting all processes...',
        '[SYS] Clearing SRAM buffer...',
        '[SYS] ESP32-S3 core restart',
        '[AS608] Sensor handshake...',
        '[NET] WiFi reconnecting...',
        '[NET] Supabase → Connected',
        '[SYS] ClassTrack Kiosk Online ✓'
    ];
    let i = 0;
    const nb = () => {
      if (i < ls.length) {
        kladd(ls[i], 'lsys');
        [1,2,3,4].forEach((n, idx) => {
           const l = document.getElementById('kl'+n);
           if(l) {
               l.className = 'led o';
               setTimeout(() => l.className = 'led', 200 + idx * 80);
           }
        });
        i++;
        setTimeout(nb, 340);
      } else {
        setKS('idle', 'READY', 'Place finger on sensor', '');
        kleds('');
        kladd('[READY] Awaiting finger input...');
        busy = false;
      }
    };
    setTimeout(nb, 300);
  };

  const toggleTech = (id: string) => {
    const el = document.getElementById(id);
    if(!el) return;
    const was = el.classList.contains('op');
    document.querySelectorAll('.tt').forEach(t => t.classList.remove('op'));
    if (!was) el.classList.add('op');
  };

  return (
    <DashboardLayout isFullWidth>
      <div className={`about-container ${syne.variable} ${dmSans.variable} ${jetbrains.variable}`}>
        
        <nav id="nav">
          <ul className="nlinks">
            <li><a href="#what">System</a></li>
            <li><a href="#hardware">Hardware</a></li>
            <li><a href="#lab">Lab</a></li>
            <li><a href="#team">Team</a></li>
            <li><a href="#roadmap">Roadmap</a></li>
          </ul>
        </nav>

        {/* HERO */}
        <section id="hero">
          <div className="hbadge">Smart Classroom Attendance System · V1</div>
          <h1 className="htitle">
            <span className="l1">We Build</span>
            <span className="l2">Digital Excellence</span>
          </h1>
          <p className="hsub">A collaborative masterpiece by three passionate student developers from the Institute of Computer Engineers of the Philippines Student Edition (ICpEP.SE).</p>
          <div className="hbtns">
            <button className="bp" onClick={() => document.getElementById('what')?.scrollIntoView({behavior:'smooth'})}>
              Explore ClassTrack <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="bo" onClick={() => document.getElementById('hardware')?.scrollIntoView({behavior:'smooth'})}>See Hardware</button>
          </div>
          <div className="hscroll"><div className="sbar"></div>Scroll</div>
        </section>

        {/* WHAT IS CLASSTRACK */}
        <section id="what">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">The System</div>
            <h2 className="stit rv d1">What is ClassTrack?</h2>
            <div className="wgrid">
              <div className="wtxt rv d2">
                <p>ClassTrack is a <strong>Smart Classroom Attendance System</strong> designed for Northwestern University. It combines <strong>biometric fingerprint scanning</strong>, <strong>IoT infrastructure</strong>, and <strong>real-time analytics</strong> to fully automate attendance tracking across campus.</p>
                <p>Instructors generate dynamic QR codes from their dashboard, which students scan via their personal portal to log attendance instantly. Alternatively, students interact with <strong>ESP32-powered biometric kiosks</strong> for fingerprint verification — no paper, no manual counting, no errors.</p>
                <p>Built on a modern full-stack: Next.js 14, Supabase (PostgreSQL + WebSockets), and custom embedded firmware — delivering a seamless, real-time experience for every role in the institution.</p>

                <div className="wtags">
                  <span className="wtag">Biometric Auth</span>
                  <span className="wtag">Infrastructure Health</span>
                  <span className="wtag">Real-time Analytics</span>
                  <span className="wtag">QR Verification</span>
                  <span className="wtag">Administrator Control</span>
                </div>
              </div>
              <div className="wsgrid rv d3">
                <div className="ws"><div className="wsv">4</div><div className="wsk">Roles</div><div className="wsd">Administrator, Dept Admin, Instructor, Student</div></div>
                <div className="ws"><div className="wsv">Multi</div><div className="wsk">Departments</div><div className="wsd">Fully scoped data isolation per department</div></div>
                <div className="ws"><div className="wsv">ESP32</div><div className="wsk">IoT Kiosks</div><div className="wsd">Hardware biometric logging at classroom level</div></div>
                <div className="ws"><div className="wsv">Offline</div><div className="wsk">Kiosk Mode</div><div className="wsd">Local data buffer when internet drops</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* FLOW */}
        <section id="flow">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">Data Journey</div>
            <h2 className="stit rv d1">The Life of a Log</h2>
            <p className="sdesc rv d2">Click any step to see what happens inside. Every attendance record makes this exact journey &mdash; in under 2 seconds.</p>
            <div className="ftrack">
              <div id="flow-1" className="fs rv" onClick={() => toggleFlow('flow-1')}>
                <div className="fdot">👆</div>
                <div className="fbody"><div className="fnum">{"// 01"}</div><div className="fname">Touch</div><div className="fdesc">Student places finger on AS608. Optical scan captures template in ~400ms.</div>
                <div className="fcode"><div className="cblock">{"[AS608] Optical scan → ID:0x03\n[AS608] Confidence: 97 → MATCH\n[UART] Payload ready → sending"}</div></div></div>
              </div>
              <div id="flow-2" className="fs rv d1" onClick={() => toggleFlow('flow-2')}>
                <div className="fdot">⚡</div>
                <div className="fbody"><div className="fnum">{"// 02"}</div><div className="fname">Process</div><div className="fdesc">ESP32 receives UART, packages event, fires HTTPS POST to Supabase.</div>
                <div className="fcode"><div className="cblock">{"[ESP32] UART: 0xEF01 received\n[ESP32] WiFi POST /attendance\nBody:{id:3,ts:1700000000}\n[ESP32] HTTP 200 OK ✓"}</div></div></div>
              </div>
              <div id="flow-3" className="fs rv d2" onClick={() => toggleFlow('flow-3')}>
                <div className="fdot">☁️</div>
                <div className="fbody"><div className="fnum">{"// 03"}</div><div className="fname">Cloud</div><div className="fdesc">Supabase validates, stores to PostgreSQL, broadcasts real-time event.</div>
                <div className="fcode"><div className="cblock">{"[PG] INSERT attendance row\n[RLS] Policy check → pass\n[RT] Broadcast → all clients\n[WS] Event fired ✓"}</div></div></div>
              </div>
              <div id="flow-4" className="fs rv d3" onClick={() => toggleFlow('flow-4')}>
                <div className="fdot">🖥️</div>
                <div className="fbody"><div className="fnum">{"// 04"}</div><div className="fname">Dashboard</div><div className="fdesc">Admin browser receives WS event. Row animates in. Toast notification fires.</div>
                <div className="fcode"><div className="cblock">{"[WS] attendance:INSERT\n[UI] Row injected at index 0\n[UI] Toast: \"Juan → Present\"\n[UI] Analytics recalculated"}</div></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* HARDWARE */}
        <section id="hardware">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">The Machines</div>
            <h2 className="stit rv d1">Hardware Deep-Dive</h2>
            <p className="sdesc rv d2">Click either hardware component to explore its full spec sheet, technical role, and how it fits into ClassTrack.</p>
            <div className="hwcards">
              <div className="hwc rv d2" onClick={() => openModal('esp')}>
                <div className="hwcimg">
                  <div className="hwgbg"></div>
                  <div style={{fontSize:'72px', filter:'drop-shadow(0 20px 40px rgba(123, 17, 19, 0.35))', zIndex:1, position:'relative'}} dangerouslySetInnerHTML={{__html: hwData.esp.fb}}></div>
                  <div className="hwov"></div>
                  <div className="hwch">Click to explore</div>
                </div>
                <div className="hwbody">
                  <div className="hwname">ESP32-S3 Touch LCD</div>
                  <div className="hwsub">{"// MICROCONTROLLER + DISPLAY UNIT"}</div>
                  <div className="hwdesc">The brain and face of the kiosk. Dual-core LX7 processor with integrated 7&quot; capacitive touch display &mdash; handles all I/O, WiFi communication, and UI rendering.</div>
                  <div className="hwtags">
                    <span className="htag">Dual-Core 240MHz</span>
                    <span className="htag">7&quot; Touch LCD</span>
                    <span className="htag">WiFi 2.4GHz</span>
                    <span className="htag">BLE 5.0</span>
                    <span className="htag">UART + SPI</span>
                  </div>
                </div>
              </div>
              <div className="hwc rv d3" onClick={() => openModal('as608')}>
                <div className="hwcimg">
                  <div className="hwgbg"></div>
                  <div style={{fontSize:'72px', filter:'drop-shadow(0 20px 40px rgba(123, 17, 19, 0.35))', zIndex:1, position:'relative'}} dangerouslySetInnerHTML={{__html: hwData.as608.fb}}></div>
                  <div className="hwov"></div>
                  <div className="hwch">Click to explore</div>
                </div>
                <div className="hwbody">
                  <div className="hwname">AS608 Fingerprint Sensor</div>
                  <div className="hwsub">{"// OPTICAL BIOMETRIC INPUT"}</div>
                  <div className="hwdesc">Optical fingerprint sensor with onboard DSP. Stores up to 162 templates, matches in under 1 second at 500 DPI. Communicates via UART at 57600 baud directly with the ESP32-S3.</div>
                  <div className="hwtags"><span className="htag">162 Templates</span><span className="htag">&lt;1s Match</span><span className="htag">500 DPI</span><span className="htag">UART 57600</span><span className="htag">Onboard DSP</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MODAL */}
        <div id="modal">
          <div id="mbg" onClick={closeModal}></div>
          <div id="mpanel">
            <div id="mleft">
              <div id="mlglow"></div>
              <div id="miwrap">
                <div id="mimg-container" style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', minHeight:'200px'}}>
                  <div id="mfb" style={{fontSize:'120px', animation:'mfl 4s ease-in-out infinite', filter:'drop-shadow(0 30px 60px rgba(123, 17, 19, 0.38))'}}></div>
                </div>
                <div id="mdims" style={{fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--mu)', letterSpacing:'.1em', textAlign:'center', lineHeight:1.6, marginBottom:'24px'}}></div>
                <div id="mtagbar" style={{display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center', marginTop:'4px'}}></div>
              </div>
            </div>
            <div id="mright">
              <button id="mclose" onClick={closeModal}>✕</button>
              <div className="mbadge"><div className="mbdot"></div><span id="mbadge-txt">Hardware</span></div>
              <h2 className="mtitle" id="mtitle">—</h2>
              <div className="msubt" id="msubt">—</div>
              <p className="mdesc" id="mdesc">—</p>
              <div className="msptt">Technical Specifications</div>
              <div className="mspgrid" id="mspgrid"></div>
              <div className="mrl"><div className="mrlt">Role in ClassTrack</div><div className="mrld" id="mrld">—</div></div>
              <button className="mtrybtn" onClick={() => { closeModal(); setTimeout(()=>document.getElementById('lab')?.scrollIntoView({behavior:'smooth'}),300); }}>Try the Simulator →</button>
            </div>
          </div>
        </div>

        {/* LAB */}
        <section id="lab">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">Interactive</div>
            <h2 className="stit rv d1">The Lab</h2>
            <p className="sdesc rv d2">A fully interactive ClassTrack kiosk simulator. Try scanning, failing, and rebooting the device.</p>
            <div className="kwrap">
              <div className="kdev rv">
                <div className="kscr">
                  <div className="kstat">CLASSTRACK KIOSK v2.1 · ESP32-S3</div>
                  <div className="kmain idle" id="ksm">READY</div>
                  <div className="ksub" id="kss">Place finger on sensor</div>
                </div>
                <div className="kleds">
                    <div className="led" id="kl1"></div>
                    <div className="led" id="kl2"></div>
                    <div className="led" id="kl3"></div>
                    <div className="led" id="kl4"></div>
                </div>
                <div className="ksen" id="ksen" onClick={() => kScan(true)}>🫆</div>
                <div className="kbtns">
                  <button className="kbtn" onClick={() => kScan(false)}>⚡ Simulate Fail</button>
                  <button className="kbtn" onClick={kReboot}>🔄 Reboot Device</button>
                </div>
              </div>
              <div className="kright rv d2">
                <h3>Try the Kiosk</h3>
                <p>Simulate real classroom conditions. Tap the fingerprint sensor for a successful attendance log, trigger a failed scan for an unrecognized finger, or reboot to restart the device boot cycle.</p>
                <div className="klog" id="klog">
                  <div className="ll lsys">[SYS] ClassTrack Kiosk Online</div>
                  <div className="ll lsys">[AS608] UART handshake → OK</div>
                  <div className="ll lsys">[NET] WiFi → Connected</div>
                  <div className="ll">[READY] Awaiting finger input...</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* OVERVIEW */}
        <section id="overview">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">Features</div>
            <h2 className="stit rv d1">System Overview</h2>
            <div className="ovgrid">
              <div className="ovc rv d1"><div className="ovico">🔐</div><div className="ovtit">Biometric Authentication</div><div className="ovdesc">AS608 optical sensor captures and matches fingerprints with onboard DSP. Up to 162 enrolled templates per device with sub-second matching accuracy.</div></div>
              <div className="ovc rv d2"><div className="ovico">📱</div><div className="ovtit">QR Verification</div><div className="ovdesc">Instructors generate unique QR codes per session from their dashboard. Students scan via their portal — a fast, secondary attendance method.</div></div>
              <div className="ovc rv d3"><div className="ovico">📊</div><div className="ovtit">Real-time Analytics</div><div className="ovdesc">WebSocket-powered live dashboard. Attendance events propagate instantly from ESP32 → Supabase → Admin UI. No refresh needed, ever.</div></div>
              <div className="ovc rv d4"><div className="ovico">🛡️</div><div className="ovtit">Administrator Control</div><div className="ovdesc">Full CRUD over students, sections, subjects, and schedules. Role-based access control ensures each user sees only what they&apos;re permitted to.</div></div>
            </div>
          </div>
        </section>

        {/* STACK */}
        <section id="stack">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">Under the Hood</div>
            <h2 className="stit rv d1">Tech Stack</h2>
            <div className="tgrid">
              <div id="tech-1" className="tt rv" onClick={() => toggleTech('tech-1')}><span className="tico">▲</span><div className="tname">Next.js 14</div><div className="trole">{"// Frontend Framework"}</div><div className="tdet">App Router, Server Components, and API Routes power the entire admin platform with blazing performance and SSR.</div></div>
              <div id="tech-2" className="tt rv d1" onClick={() => toggleTech('tech-2')}><span className="tico">⚡</span><div className="tname">Supabase</div><div className="trole">{"// Backend + Realtime"}</div><div className="tdet">PostgreSQL hosting, Row-Level Security, Auth, and WebSocket real-time subscriptions for live attendance updates.</div></div>
              <div id="tech-3" className="tt rv d2" onClick={() => toggleTech('tech-3')}><span className="tico">🐘</span><div className="tname">PostgreSQL</div><div className="trole">{"// Primary Database"}</div><div className="tdet">Relational schema with attendance, students, sections, subjects. ACID compliance and optimized query performance.</div></div>
              <div id="tech-4" className="tt rv d3" onClick={() => toggleTech('tech-4')}><span className="tico">🔲</span><div className="tname">ESP32-S3</div><div className="trole">{"// Embedded Controller"}</div><div className="tdet">Dual-core LX7 MCU running custom firmware. UART with AS608, WiFi HTTPS POST, touch LCD rendering, LED GPIO.</div></div>
              <div id="tech-5" className="tt rv d4" onClick={() => toggleTech('tech-5')}><span className="tico">🫆</span><div className="tname">AS608 Sensor</div><div className="trole">{"// Biometric Hardware"}</div><div className="tdet">Optical fingerprint sensor with onboard DSP. 500 DPI, 360° rotation, UART output, up to 162 stored templates.</div></div>
              <div id="tech-6" className="tt rv d5" onClick={() => toggleTech('tech-6')}><span className="tico">🌐</span><div className="tname">Vercel</div><div className="trole">{"// Deployment"}</div><div className="tdet">Edge-optimized deployment for Next.js. Automatic CI/CD from Git, global CDN, serverless function support.</div></div>
            </div>
          </div>
        </section>


        {/* TEAM */}
        <section id="team">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">The Builders</div>
            <h2 className="stit rv d1">Meet the Team</h2>
            <div className="tgr">
              <div className="tcard rv">
                <div className="tav av1"><Image src="/team/arden.png" alt="Arden" width={120} height={120} style={{objectFit:'cover', borderRadius:'50%'}} /></div>
                <div className="tnm">Arden Hero Damaso</div>
                <div className="trl">Full Stack Developer</div>
                <div className="tqt">&quot;Building ClassTrack taught me that great software lives at the intersection of hardware, data, and UX &mdash; all three have to sing together.&quot;</div>
              </div>
              <div className="tcard rv d2">
                <div className="tav av2"><Image src="/team/clemen.png" alt="Clemen" width={120} height={120} style={{objectFit:'cover', borderRadius:'50%'}} /></div>
                <div className="tnm">Clemen Jay Luis</div>
                <div className="trl">Frontend Developer</div>
                <div className="tqt">&quot;Every pixel is a decision. Making ClassTrack feel premium meant obsessing over the details no one notices &mdash; until they do.&quot;</div>
              </div>
              <div className="tcard rv d3">
                <div className="tav av3"><Image src="/team/ace.png" alt="Ace" width={120} height={120} style={{objectFit:'cover', borderRadius:'50%'}} /></div>
                <div className="tnm">Ace Donner Dane Asuncion</div>
                <div className="trl">Backend Developer</div>
                <div className="tqt">&quot;The database schema is the foundation of trust. When attendance data is accurate, everything else falls into place.&quot;</div>
              </div>
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section id="roadmap">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv">What&apos;s Next</div>
            <h2 className="stit rv d1">Future Roadmap</h2>
            <div className="rmgrid">
              <div className="rmc rv"><div className="rmbg brs">Researching</div><span className="rmico">🤖</span><div className="rmtit">AI Analytics</div><div className="rmdesc">Predictive attendance patterns, anomaly detection, and smart insights powered by machine learning models.</div></div>
              <div className="rmc rv d1"><div className="rmbg bpl">Planned</div><span className="rmico">📱</span><div className="rmtit">Mobile App</div><div className="rmdesc">Dedicated mobile experience for students and instructors with push notifications and quick check-ins.</div></div>
              <div className="rmc rv d2"><div className="rmbg bex">Exploring</div><span className="rmico">👁️</span><div className="rmtit">Face Recognition</div><div className="rmdesc">Camera-based facial recognition as a secondary biometric layer for contactless attendance.</div></div>
              <div className="rmc rv d3"><div className="rmbg bpl">Planned</div><span className="rmico">🏫</span><div className="rmtit">Multi-Campus</div><div className="rmdesc">Support for multiple campuses under one administrator account with cross-campus reporting.</div></div>
              <div className="rmc rv d4"><div className="rmbg bwip">In Progress</div><span className="rmico">🌡️</span><div className="rmtit">Smart Sensors</div><div className="rmdesc">Integrating environmental sensors for room temperature and air quality monitoring alongside attendance.</div></div>
              <div className="rmc rv d5"><div className="rmbg bpl">Planned</div><span className="rmico">👥</span><div className="rmtit">Parent Portal</div><div className="rmdesc">Real-time attendance tracking and instant SMS/Email alerts for parents and guardians.</div></div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section id="stats">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl rv" style={{justifyContent:'center'}}>By The Numbers</div>
            <div className="sgrid">
              <div className="sbox rv"><div className="snum" data-t="37200" data-s="+">0</div><div className="slb">Lines of Code</div></div>
              <div className="sbox rv d1"><div className="snum" data-t="1480" data-s="+">0</div><div className="slb">Bugs Crushed</div></div>
              <div className="sbox rv d2"><div className="snum" data-t="98" data-s="%">0</div><div className="slb">Efficiency Boost</div></div>
              <div className="sbox rv d3"><div className="snum" data-t="inf">0</div><div className="slb">Coffee Consumed</div></div>
            </div>
          </div>
        </section>

        <footer>
          <div className="flogo">Class<span>Track</span></div>
          <div className="fcp">© 2026 ClassTrack · Institute of Computer Engineers of the Philippines Student Edition (ICpEP.SE)</div>
        </footer>

      </div>
    </DashboardLayout>
  );
}
