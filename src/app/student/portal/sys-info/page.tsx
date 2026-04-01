"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession } from "../actions";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Zap, Loader2 } from "lucide-react";
import Image from "next/image";
import "./portal-about.css";

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

interface Student {
    name: string;
    sin: string;
    image_url?: string;
}

export default function SysInfoPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // KIOSK STATE
  const [ksm, setKsm] = useState({ state: 'idle', main: 'READY', sub: 'Place finger on sensor' });
  const [klog, setKlog] = useState<{ msg: string; type?: string }[]>([
    { msg: '[SYS] ClassTrack Kiosk Online', type: 'lsys' },
    { msg: '[AS608] UART handshake → OK', type: 'lsys' },
    { msg: '[NET] WiFi → Connected', type: 'lsys' },
    { msg: '[READY] Awaiting finger input...', type: 'lsys' }
  ]);
  const [busy, setBusy] = useState(false);

  // MODAL STATE
  const [mOpen, setMOpen] = useState(false);

  useEffect(() => {
    const el = document.getElementById('klog');
    if (el) el.scrollTop = el.scrollHeight;
  }, [klog]);

  useEffect(() => {
    async function checkAuth() {
      const session = await getStudentSession();
      if (!session) { router.push("/student/portal"); return; }
      setStudent(session);
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (loading || !student) return;

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

    const handleScroll = () => {
      const nav = document.getElementById('nav-portal');
      if (nav) nav.classList.toggle('sc', window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      obs.disconnect();
      sObs.disconnect();
    };
  }, [loading, student]);

  // KIOSK LOGIC
  const kladd = (msg: string, type: string = '') => setKlog(prev => [...prev, { msg, type }]);

  const kScan = (ok: boolean) => {
    if (busy) return;
    setBusy(true);
    setKsm({ state: 'scan', main: 'SCANNING', sub: 'Processing hardware data...' });
    
    // Simulate mechanical LED sequence
    const leds = ['kl1','kl2','kl3','kl4'];
    leds.forEach((id, i) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if(el) el.classList.add('o');
      }, i * 200);
    });

    kladd('[AS608] Optical scan initiated...');
    
    setTimeout(() => {
      kladd('[AS608] Extracting minutiae points...');
      setTimeout(() => {
        kladd('[AS608] DSP template matching...');
        setTimeout(() => {
          leds.forEach(id => document.getElementById(id)?.classList.remove('o'));
          if(ok) {
            kladd('[AS608] Match → ID:0x03 · Arden Hero Damaso', 'lok');
            kladd('[ESP32] HTTPS POST /attendance → 200 OK', 'lok');
            setKsm({ state: 'ok', main: 'SUCCESS', sub: 'Attendance Logged ✓' });
            document.getElementById('kl2')?.classList.add('g');
            document.getElementById('kl3')?.classList.add('g');
          } else {
            kladd('[AS608] No match · Confidence: 22 (threshold: 60)', 'lerr');
            kladd('[ESP32] Attendance rejected', 'lerr');
            setKsm({ state: 'fail', main: 'FAILED', sub: 'Identity unrecognized' });
            document.getElementById('kl1')?.classList.add('r');
            document.getElementById('kl4')?.classList.add('r');
          }
          setTimeout(() => {
            setKsm({ state: 'idle', main: 'READY', sub: 'Place finger on sensor' });
            leds.forEach(id => {
              document.getElementById(id)?.classList.remove('g');
              document.getElementById(id)?.classList.remove('r');
            });
            kladd('[READY] Awaiting next input...', 'lsys');
            setBusy(false);
          }, 3200);
        }, 800);
      }, 600);
    }, 500);
  };

  const kReboot = () => {
    if (busy) return;
    setBusy(true);
    setKsm({ state: 'scan', main: 'REBOOTING', sub: 'Clearing buffers...' });
    setKlog([]);
    const leds = ['kl1','kl2','kl3','kl4'];
    leds.forEach(id => document.getElementById(id)?.classList.add('o'));

    const ls = [
      {m: '[SYS] Reboot signal received...', t: 'lsys'},
      {m: '[SYS] Halting all processes...', t: 'lsys'},
      {m: '[SYS] Cleared SRAM buffer', t: 'lsys'},
      {m: '[SYS] ESP32-S3 core restart', t: 'lsys'},
      {m: '[NET] WiFi reconnecting...', t: 'lsys'},
      {m: '[SYS] ClassTrack Kiosk Online ✓', t: 'lsys'}
    ];
    ls.forEach((l, i) => {
      setTimeout(() => {
        kladd(l.m, l.t);
        if (i === ls.length - 1) {
          leds.forEach(id => document.getElementById(id)?.classList.remove('o'));
          setKsm({ state: 'idle', main: 'READY', sub: 'Place finger on sensor' });
          setBusy(false);
        }
      }, i * 450);
    });
  };

  const hwData: Record<string, HWComponent> = {
    esp:{
      fb:'<div class="esp-screen"></div>',badge:'Microcontroller Unit',title:'ESP32-S3 Touch LCD',subt:'// WAVESHARE ESP32-S3-TOUCH-LCD-7',
      desc:'The brain and face of the ClassTrack kiosk. Features a dual-core Xtensa LX7 processor paired with an integrated 7-inch capacitive touch display. Handles fingerprint UART communication, WiFi HTTP requests to Supabase, touch UI rendering, and GPIO LED control — all simultaneously at 240MHz.',
      dims:'PCB: 165.72 × 97.60mm · Display: 192.96 × 110.76mm · 4×M3 + 4×M2.5 mount',
      specs:[{k:'Processor',v:'Dual-Core LX7 @ 240MHz'},{k:'Memory',v:'512KB SRAM + 8MB PSRAM'},{k:'Flash',v:'16MB Onboard Flash'},{k:'Display',v:'7\" Capacitive Touch LCD'},{k:'Connectivity',v:'WiFi 802.11 b/g/n + BLE 5.0'},{k:'Interfaces',v:'UART, SPI, I²C, GPIO'},{k:'Operating Voltage',v:'5V via USB-C'},{k:'Baud Rate',v:'57600 (AS608 comms)'}],
      role:'Acts as the central controller of the ClassTrack kiosk. Receives fingerprint match data from the AS608 via UART, packages the attendance payload, and sends it to Supabase via WiFi HTTPS POST. Simultaneously drives the 7\" touch LCD for real-time user feedback and controls green/red LEDs for visual confirmation of scan results.',
      tags:['Dual-Core LX7','WiFi 2.4GHz','BLE 5.0','7\" Touch LCD','UART + SPI + I²C']
    },
    as608:{
      fb:'<svg viewBox="52 4 105 105" style="width:1.8em; height:1.8em; overflow:visible; filter:drop-shadow(0 20px 30px rgba(0,0,0,0.6));"><defs><linearGradient id="gYellowTop" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef08a" /><stop offset="100%" stop-color="#eab308" /></linearGradient><linearGradient id="gYellowRight" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ca8a04" /><stop offset="100%" stop-color="#854d0e" /></linearGradient><linearGradient id="gBlackTop" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3f3f46" /><stop offset="100%" stop-color="#18181b" /></linearGradient><linearGradient id="gBlackRight" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#18181b" /><stop offset="100%" stop-color="#000000" /></linearGradient><linearGradient id="gBlackSlant" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#27272a" /><stop offset="100%" stop-color="#09090b" /></linearGradient><linearGradient id="gGlass" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e4e4e7" /><stop offset="30%" stop-color="#71717a" /><stop offset="60%" stop-color="#27272a" /><stop offset="100%" stop-color="#000000" /></linearGradient></defs><!-- Yellow Block --><polygon points="127.3,15.8 151.5,29.8 144.2,34.0 120.0,20.0" fill="url(#gYellowTop)" /><polygon points="151.5,29.8 144.2,34.0 144.2,64.1 151.5,59.9" fill="url(#gYellowRight)" /><ellipse cx="128.8" cy="20.9" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 128.8 20.9)" /><ellipse cx="131.1" cy="22.2" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 131.1 22.2)" /><ellipse cx="133.4" cy="23.6" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 133.4 23.6)" /><ellipse cx="135.8" cy="24.9" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 135.8 24.9)" /><ellipse cx="138.1" cy="26.2" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 138.1 26.2)" /><ellipse cx="140.4" cy="27.6" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 140.4 27.6)" /><ellipse cx="142.7" cy="28.9" rx="0.8" ry="0.5" fill="#111" transform="rotate(30 142.7 28.9)" /><!-- Black Body --><polygon points="120.0,20.0 144.2,34.0 120.0,48.0 95.8,34.0" fill="url(#gBlackTop)" /><polygon points="144.2,34.0 120.0,48.0 83.6,92.1 83.6,99.1 144.2,64.1" fill="url(#gBlackRight)" /><!-- Split line right face --><line x1="129.7" y1="42.4" x2="129.7" y2="72.5" stroke="#000" stroke-width="1.2" /><line x1="130.2" y1="42.9" x2="130.2" y2="73.0" stroke="#3f3f46" stroke-width="0.6" /><!-- Details on top face --><ellipse cx="120.0" cy="34.0" rx="2" ry="1.2" fill="#09090b" transform="rotate(30 120.0 34.0)" /><ellipse cx="120.0" cy="34.0" rx="0.8" ry="0.5" fill="#3f3f46" transform="rotate(30 120.0 34.0)" /><polygon points="95.8,34.0 120.0,48.0 83.6,92.1 59.4,78.1" fill="url(#gBlackSlant)" /><polygon points="59.4,78.1 83.6,92.1 83.6,99.1 59.4,85.1" fill="#050505" /><!-- Window --><polygon points="88.3,48.2 106.8,58.9 105.0,65.5 86.5,54.8" fill="#09090b" /><polygon points="106.8,58.9 87.5,82.3 85.7,88.9 105.0,65.5" fill="#000000" /><polygon points="88.3,48.2 68.9,71.6 67.2,78.2 86.5,54.8" fill="#27272a" /><polygon points="68.9,71.6 87.5,82.3 85.7,88.9 67.2,78.2" fill="#3f3f46" /><polygon points="86.5,54.8 105.0,65.5 85.7,88.9 67.2,78.2" fill="url(#gGlass)" /><!-- Glass Reflection --><polygon points="86.5,54.8 105.0,65.5 97.3,74.9 78.8,64.2" fill="white" opacity="0.08" /></svg>',badge:'Biometric Sensor',title:'AS608 Fingerprint',subt:'// OPTICAL FINGERPRINT MODULE',
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
    
    document.getElementById('mspgrid')!.innerHTML = d.specs.map((s: Spec) => `<div class="msp"><div class="mspk">${s.k}</div><div class="mspv">${s.v}</div></div>`).join('');
    document.getElementById('mtagbar')!.innerHTML = d.tags.map((tg: string) => `<div class="mtag">${tg}</div>`).join('');
    
    setMOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setMOpen(false);
    document.body.style.overflow = '';
  };

  if (loading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 text-nwu-red animate-spin" />
      </div>
    );
  }

  return (
    <StudentLayout studentName={student.name} sin={student.sin} imageUrl={student.image_url}>
      <div className="portal-about-container relative">
        
        {/* HERO */}
        <section id="hero-portal">
          <div className="hbadge">Student Portal Experience · V1</div>
          <h1 className="htitle">
            <span className="l1">Your Attendance</span>
            <span className="l2">Reimagined</span>
          </h1>
          <p className="hsub">Your personal hub for managing academic attendance records at Northwestern University. Transparent, real-time, and built for students.</p>
          <div className="hbtns">
            <button className="bp" onClick={() => document.getElementById('what-portal')?.scrollIntoView({behavior:'smooth'})}>Explore ClassTrack <Zap size={16} /></button>
            <button className="bo" onClick={() => document.getElementById('hardware')?.scrollIntoView({behavior:'smooth'})}>See Hardware</button>
          </div>
        </section>

        {/* WHAT IS PORTAL */}
        <section id="what-portal">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl">Inside ClassTrack</div>
            <h2 className="stit">The Student Portal</h2>
            <div className="wgrid">
              <div className="wtxt">
                <p><strong>ClassTrack Student Portal</strong> is your digital gateway to academic accountability. Built specifically for students of Northwestern University, it provides a real-time window into your classroom participation.</p>
                <p>Gone are the days of manual attendance logs and paper excuse letters. Integrated with <strong>Biometric Kiosks</strong> campus-wide, your attendance is logged in seconds and visible instantly in your pocket.</p>
                <div className="wtags">
                  {['Attendance Monitoring', 'Excuse Letter Portal', 'Real-time Alerts', 'Secure Biometrics', 'Academic Analytics'].map(t => (
                    <span key={t} className="wtag">{t}</span>
                  ))}
                </div>
              </div>
              <div className="wsgrid">
                <div className="ws"><div className="wsv">Real-time</div><div className="wsk">Sync</div></div>
                <div className="ws"><div className="wsv">100%</div><div className="wsk">Digital</div></div>
                <div className="ws"><div className="wsv">Secure</div><div className="wsk">Biometrics</div></div>
                <div className="ws"><div className="wsv">AI Chatbot</div><div className="wsk">ClassTrack Assistant</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* INFRASTRUCTURE */}
        <section id="infra">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl">Architecture</div>
            <h2 className="stit">Technology Stack</h2>
            <div className="icgrid">
              <div className="ic">
                <div className="ick">Frontend Framework</div>
                <div className="icv">Next.js 14</div>
                <div className="icd">Utilizing React Server Components and App Router for lighting fast portal navigation and secure data fetching.</div>
              </div>
              <div className="ic">
                <div className="ick">Database & Real-time</div>
                <div className="icv">Supabase (PostgreSQL)</div>
                <div className="icd">Relational data layer with live WebSocket subscriptions ensuring updates appear as they happen.</div>
              </div>
              <div className="ic">
                <div className="ick">Cloud Infrastructure</div>
                <div className="icv">Vercel Edge Runtime</div>
                <div className="icd">Global deployment ensures minimal latency for student interactions across the university campus.</div>
              </div>
              <div className="ic">
                <div className="ick">IoT Ecosystem</div>
                <div className="icv">ESP32 + Tuya Cloud</div>
                <div className="icd">Managing classroom peripherals and biometric kiosks through a unified, secure IoT gateway.</div>
              </div>
            </div>
          </div>
        </section>

        {/* HARDWARE */}
        <section id="hardware">
           <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl">Hardware</div>
            <h2 className="stit">Hardware Deep-Dive</h2>
            <p className="sdesc">Click either hardware component to explore its full spec sheet and technical role.</p>
            <div className="hwcards">
              <div className="hwc" onClick={() => openModal('esp')}>
                <div className="hwcimg">
                  <div className="hwgbg" />
                  <div style={{fontSize:'80px', position:'relative', zIndex:1, filter:'drop-shadow(0 20px 40px rgba(123, 17, 19, 0.35))'}} dangerouslySetInnerHTML={{__html: hwData.esp.fb}}></div>
                  <div className="hwov" />
                  <div className="hwch">Click to explore</div>
                </div>
                <div className="hwbody" style={{padding:'32px'}}>
                  <div className="hwname">ESP32-S3 Touch LCD</div>
                  <div className="hwsub">MICROCONTROLLER + DISPLAY UNIT</div>
                  <div className="hwdesc">The brain and face of the kiosk. Dual-core LX7 processor with integrated 7&quot; capacitive touch display &mdash; handles all I/O, WiFi communication, and UI rendering.</div>
                  <div className="hwtags">
                    <span className="htag">Dual-Core 240MHz</span>
                    <span className="htag">7&quot; Touch LCD</span>
                    <span className="htag">WiFi 2.4GHz</span>
                  </div>
                </div>
              </div>
              <div className="hwc" onClick={() => openModal('as608')}>
                <div className="hwcimg">
                  <div className="hwgbg" />
                  <div style={{fontSize:'80px', position:'relative', zIndex:1, filter:'drop-shadow(0 20px 40px rgba(123, 17, 19, 0.35))'}} dangerouslySetInnerHTML={{__html: hwData.as608.fb}}></div>
                  <div className="hwov" />
                  <div className="hwch">Click to explore</div>
                </div>
                <div className="hwbody" style={{padding:'32px'}}>
                  <div className="hwname">AS608 Fingerprint Sensor</div>
                  <div className="hwsub">OPTICAL BIOMETRIC INPUT</div>
                  <div className="hwdesc">Secure, high-precision optical sensor with onboard DSP. Matches identity templates in under one second at 500 DPI.</div>
                  <div className="hwtags">
                    <span className="htag">162 Templates</span>
                    <span className="htag">&lt;1s Match</span>
                    <span className="htag">500 DPI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE LAB */}
        <section id="lab">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl">Interactive</div>
            <h2 className="stit">The Lab</h2>
            <p className="sdesc">A fully interactive ClassTrack kiosk simulator. Try scanning, failing, and rebooting the device.</p>
            <div className="kwrap">
              <div className="kdev">
                <div className="kscr">
                  <div className="kstat">CLASSTRACK KIOSK v2.1 · ESP32-S3</div>
                  <div className={`kmain ${ksm.state}`}>{ksm.main}</div>
                  <div className="ksub">{ksm.sub}</div>
                </div>
                <div className="kleds">
                    <div className="led" id="kl1"></div>
                    <div className="led" id="kl2"></div>
                    <div className="led" id="kl3"></div>
                    <div className="led" id="kl4"></div>
                </div>
                <div className={`ksen ${ksm.state}`} id="ksen" onClick={() => kScan(true)}>🫆</div>
                <div className="kbtns">
                  <button className="kbtn" onClick={() => kScan(false)}>⚡ Simulate Fail</button>
                  <button className="kbtn" onClick={kReboot}>🔄 Reboot Device</button>
                </div>
              </div>
              <div className="kright">
                <h3 style={{fontFamily:'var(--fd)', fontSize:'1.8rem', fontWeight:800, marginBottom:'16px'}}>Try the Kiosk</h3>
                <p style={{fontSize:'.88rem', color:'var(--mu)', lineHeight:1.75, marginBottom:'24px'}}>Simulate real classroom conditions. Tap the fingerprint sensor for a successful attendance log, trigger a failed scan for an unrecognized finger, or reboot to restart the device boot cycle.</p>
                <div className="klog" id="klog">
                  {klog.map((l, i) => (
                    <div key={i} className={`ll ${l.type}`} style={{fontSize:'12px', color: l.type==='lok'?'#4dce9b':l.type==='lerr'?'#e85454':'inherit'}}>{l.msg}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section id="team">
          <div className="si" style={{padding:'0 52px'}}>
            <div className="slbl">The Builders</div>
            <h2 className="stit">Meet the Team</h2>
            <div className="tgr">
              <div className="tcard">
                <div className="tav"><Image src="/team/arden.png" alt="Arden" fill /></div>
                <div className="tnm">Arden Hero Damaso</div>
                <div className="trl">Full Stack Developer</div>
                <div className="tqt">&quot;Building ClassTrack taught me that great software lives at the intersection of hardware, data, and UX &mdash; all three have to sing together.&quot;</div>
              </div>
              <div className="tcard">
                <div className="tav"><Image src="/team/clemen.png" alt="Clemen" fill /></div>
                <div className="tnm">Clemen Jay Luis</div>
                <div className="trl">Frontend Developer</div>
                <div className="tqt">&quot;Every pixel is a decision. Making ClassTrack feel premium meant obsessing over the details no one notices &mdash; until they do.&quot;</div>
              </div>
              <div className="tcard">
                <div className="tav"><Image src="/team/ace.png" alt="Ace" fill /></div>
                <div className="tnm">Ace Donner Dane Asuncion</div>
                <div className="trl">Backend Developer</div>
                <div className="tqt">&quot;The database schema is the foundation of trust. When attendance data is accurate, everything else falls into place.&quot;</div>
              </div>
            </div>
          </div>
        </section>

         {/* STATS */}
         <section id="stats">
          <div className="si" style={{padding:'0 52px'}}>
             <div className="slbl" style={{justifyContent:'center'}}>By The Numbers</div>
            <div className="sgrid">
              <div className="sbox"><div className="snum" data-t="4200" data-s="+">0</div><div className="slb">Lines of Code</div></div>
              <div className="sbox"><div className="snum" data-t="inf">0</div><div className="slb">Coffee Consumed</div></div>
              <div className="sbox"><div className="snum" data-t="927">0</div><div className="slb">Bugs Crushed</div></div>
              <div className="sbox"><div className="snum" data-t="99" data-s="%">0</div><div className="slb">Student Focus</div></div>
            </div>
          </div>
        </section>

        {/* MODAL */}
        <div id="modal-portal" className={mOpen ? "open" : ""}>
          <div id="mbg" onClick={closeModal}></div>
          <div id="mpanel">
            <div id="mleft">
              <div id="miwrap">
                <div id="mimg-container" style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', minHeight:'200px'}}>
                  <div id="mfb" style={{fontSize:'120px', animation:'mfl 4s ease-in-out infinite', filter:'drop-shadow(0 30px 60px rgba(123, 17, 19, 0.38))'}}></div>
                </div>
                <div id="mdims" style={{fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--mu)', letterSpacing:'.1em', textAlign:'center', lineHeight:1.6}}></div>
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

        <footer style={{padding:'60px 0', borderTop:'1px solid var(--bdr)', textAlign:'center'}}>
           <div style={{fontFamily:'var(--fd)', fontSize:'20px', fontWeight:800}}>Class<span style={{color:'var(--orange)'}}>Track</span> Student Portal</div>
           <div style={{fontSize:'12px', color:'var(--mu2)', letterSpacing:'4px', marginTop:'20px'}}>ICPEP.SE · NWU</div>
           <div style={{fontSize:'11px', marginTop:'20px', opacity:0.5}}>© 2026 CLASSTRACK ECOSYSTEM • BUILDING THE FUTURE</div>
        </footer>

      </div>
    </StudentLayout>
    );
}
