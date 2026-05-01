import React, { useState, useEffect } from 'react';
import { parseReceipt, parseReceiptFromBase64, testGeminiKey } from './services/gemini';
import { scanReceiptLocally } from './services/localOcr';
import { printViaBluetooth } from './services/bluetooth';
import { ReceiptData, HistoryEntry } from './types';
import { ReceiptPreview } from './components/ReceiptPreview';
import { AdminPanel } from './components/AdminPanel';
import { auth, db, loginWithGoogle, logout } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, setDoc as firestoreSetDoc, addDoc } from 'firebase/firestore';
import { AlertCircle, FileText, Smartphone, Bluetooth, CheckCircle2, ChevronDown, Printer, Settings, History, Home, Loader2, ImagePlus, Power, Zap, BookOpen, Edit3, ArrowLeft, Download, Clock, LogIn, LogOut, ShieldAlert, Key, RefreshCw, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';

const INITIAL_DATA: ReceiptData = {
  namaToko: 'ALFATHPRINT',
  tanggal: new Date().toISOString().split('T')[0],
  waktu: new Date().toTimeString().split(' ')[0],
  kodeReferensi: '-',
  bankTujuan: '-',
  noRekening: '-',
  namaPenerima: '-',
  nominal: 0,
  admin: 0,
  status: 'TRANSAKSI BERHASIL',
  footerLine1: 'SALINAN - VIA ALFATHPRINT APP',
  footerLine2: 'TERIMA KASIH',
  tid: 'NK-000',
  namaPengirim: '-',
  showPengirim: false,
  useFallbackAI: true,
  aiEnabled: true,
  scanEngine: 'ai',
  customApiKey: '',
  showAdminFee: true,
};

const LAYOUTS = [
  { id: 'pro', name: '1. Pro (Default)' },
  { id: 'standard', name: '2. Standard' },
  { id: 'modern', name: '3. Modern' },
  { id: 'bank', name: '4. Bank Style' },
  { id: 'elegant', name: '5. Elegant' },
  { id: 'digital', name: '6. Digital (WA)' },
] as const;

export default function App() {
  const [view, setView] = useState<'home' | 'preview' | 'settings' | 'history' | 'admin'>('home');
  const [data, setData] = useState<ReceiptData>(INITIAL_DATA);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  
  // Auth & Profile State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLayout, setActiveLayout] = useState<typeof LAYOUTS[number]['id']>('pro');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'none' | 'valid' | 'invalid'>(data.customApiKey ? 'valid' : 'none');
  const receiptRef = React.useRef<HTMLDivElement>(null);

  const testApiKey = async () => {
    if (!data.customApiKey) return;
    setIsTestingKey(true);
    try {
      await testGeminiKey(data.customApiKey);
      setKeyStatus('valid');
      alert("✅ API Key Valid! AI sekarang akan menggunakan kuota Anda.");
    } catch (err: any) {
      setKeyStatus('invalid');
      alert("❌ " + err.message);
    } finally {
      setIsTestingKey(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Initialize Firebase Auth & Profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(userRef);
          if (!docSnap.exists()) {
            const isDefaultAdmin = u.email === 'peciwaru@gmail.com';
            const newProfile = {
              email: u.email,
              role: isDefaultAdmin ? 'admin' : 'karyawan',
              status: isDefaultAdmin ? 'active' : 'pending',
              createdAt: Date.now()
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          } else {
            onSnapshot(userRef, (snap) => {
              setUserProfile(snap.data());
            });
          }
        } catch (err) {
          console.error("Profile fetch error:", err);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthLoaded(true);
    });
    return () => unsub();
  }, []);

  const cleanNominal = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return 0;
    // Remove all non-digits (handles symbols like Rp, dots, commas)
    const cleaned = val.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
  };

  // Sync settings when auth is loaded
  useEffect(() => {
    // 1. Load settings first
    try {
      const savedSettings = localStorage.getItem('alfathprint_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setData(prev => ({
          ...prev,
          namaToko: settings.namaToko || prev.namaToko,
          cabang: settings.cabang || prev.cabang,
          footerLine1: settings.footerLine1 || prev.footerLine1,
          footerLine2: settings.footerLine2 || prev.footerLine2,
          logoUrl: settings.logoUrl || prev.logoUrl,
          namaPengirim: settings.namaPengirim || prev.namaPengirim,
          showPengirim: settings.showPengirim !== undefined ? settings.showPengirim : prev.showPengirim,
          useFallbackAI: settings.useFallbackAI !== undefined ? settings.useFallbackAI : prev.useFallbackAI,
          aiEnabled: settings.aiEnabled !== undefined ? settings.aiEnabled : prev.aiEnabled,
          customApiKey: settings.customApiKey || prev.customApiKey,
          showAdminFee: settings.showAdminFee !== undefined ? settings.showAdminFee : prev.showAdminFee,
          tid: settings.tid || prev.tid,
        }));
      }
    } catch (e) {
      console.error("Gagal memuat pengaturan lokal:", e);
    }

    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('sharedId');
    
    if (sharedId && !user && isAuthLoaded) {
       setError("Gambar diterima! Silakan masuk dengan Google untuk memproses.");
    }

    if (!isAuthLoaded || !user) return;
    
    // 2. Check for shared image from Web Share Target
    if (sharedId) {
      const fetchShared = async () => {
        try {
          setIsLoading(true);
          const res = await fetch(`/api/shared/${sharedId}`);
          if (!res.ok) throw new Error("Gagal mengambil data share");
          const sharedData = await res.json();
          // Remove param from URL
          window.history.replaceState({}, document.title, "/");
          
          // Use latest settings from localStorage directly to be safe
          const currentSettings = JSON.parse(localStorage.getItem('alfathprint_settings') || '{}');
          const apiKey = currentSettings.customApiKey || '';
          const engine = currentSettings.scanEngine || 'ai';

          setIsLoading(true);
          let parsedData;
          if (engine === 'local') {
            parsedData = await scanReceiptLocally(sharedData.base64Data);
          } else {
            parsedData = await parseReceiptFromBase64(sharedData.base64Data, sharedData.mimeType, apiKey);
          }

          setData(prev => ({
            ...prev,
            ...parsedData,
            kodeReferensi: parsedData.kodeReferensi || '-',
            nominal: cleanNominal(parsedData.nominal),
            admin: 0, 
          }));
          setView('preview');
        } catch (err: any) {
          console.error("Shared content error:", err);
          const isQuota = err.message?.toLowerCase().includes('quota') || err.message?.includes('429');
          const isInvalidKey = err.message?.includes('API Key');
          
          if (isQuota || isInvalidKey) {
            setData(prev => ({
              ...prev,
              tanggal: new Date().toISOString().split('T')[0],
              waktu: new Date().toTimeString().split(' ')[0],
              kodeReferensi: 'ID-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
              bankTujuan: 'INPUT MANUAL',
              noRekening: '-',
              namaPenerima: 'EDIT NAMA DISINI',
              nominal: 0,
              admin: 0,
            }));
            setView('preview');
            setError(err.message || "Batas AI habis, silakan isi data secara manual.");
          } else {
            setError(err.message || "Gagal memproses data share");
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchShared();
    }
  }, [isAuthLoaded, user]);

  // Sync history based on branch
  useEffect(() => {
    const local = localStorage.getItem('alfathprint_history');
    if (local) {
      try { setHistory(JSON.parse(local)); } catch(e) {}
    }

    if (!user || !userProfile || userProfile.status !== 'active') return;
    
    if (userProfile.branchId) {
      const branchRef = doc(db, 'branches', userProfile.branchId);
      const historyCol = collection(branchRef, 'printHistory');
      
      const unsub = onSnapshot(historyCol, (snapshot) => {
        const remoteHistory = snapshot.docs.map(d => ({ 
          id: d.id, 
          timestamp: d.data().timestamp,
          data: d.data().receiptData || {
            nominal: d.data().nominal,
            namaPenerima: d.data().namaPenerima,
            bankTujuan: d.data().bankTujuan
          }
        })) as HistoryEntry[];
        
        // Merge with local history to ensure immediate feedback
        const localStr = localStorage.getItem('alfathprint_history');
        const local = localStr ? JSON.parse(localStr) : [];
        const merged = [...remoteHistory, ...local.filter((l: any) => !remoteHistory.find(r => r.id === l.id))];
        merged.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(merged.slice(0, 50));
      }, (err) => {
        console.error("Error fetching history:", err);
      });
      return () => unsub();
    }
  }, [userProfile]);

  useEffect(() => {
    const handler = (e: any) => {
      setDeferredPrompt(true);
    };
    window.addEventListener('pwa-installable', handler);
    return () => window.removeEventListener('pwa-installable', handler);
  }, []);

  const saveSettings = (updatedData: Partial<ReceiptData>) => {
    const newSettings = {
      namaToko: updatedData.namaToko || data.namaToko,
      cabang: updatedData.cabang || data.cabang,
      footerLine1: updatedData.footerLine1 || data.footerLine1,
      footerLine2: updatedData.footerLine2 || data.footerLine2,
      logoUrl: updatedData.logoUrl || data.logoUrl,
      namaPengirim: updatedData.namaPengirim !== undefined ? updatedData.namaPengirim : data.namaPengirim,
      showPengirim: updatedData.showPengirim !== undefined ? updatedData.showPengirim : data.showPengirim,
      useFallbackAI: updatedData.useFallbackAI !== undefined ? updatedData.useFallbackAI : data.useFallbackAI,
      aiEnabled: updatedData.aiEnabled !== undefined ? updatedData.aiEnabled : data.aiEnabled,
      scanEngine: updatedData.scanEngine !== undefined ? updatedData.scanEngine : data.scanEngine,
      customApiKey: updatedData.customApiKey !== undefined ? updatedData.customApiKey : data.customApiKey,
      showAdminFee: updatedData.showAdminFee !== undefined ? updatedData.showAdminFee : data.showAdminFee,
    };
    localStorage.setItem('alfathprint_settings', JSON.stringify(newSettings));
    setData(prev => ({ ...prev, ...updatedData }));
  };

  const addToHistory = async (receipt: ReceiptData) => {
    const entry: HistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      data: receipt
    };

    // Save locally first
    try {
      const localHistory = JSON.parse(localStorage.getItem('alfathprint_history') || '[]');
      const newHistory = [entry, ...localHistory].slice(0, 50);
      localStorage.setItem('alfathprint_history', JSON.stringify(newHistory));
      
      // Update state immediately for everyone
      setHistory(newHistory);
    } catch (e) {
      console.error("Local history error:", e);
    }

    if (!user || userProfile?.status !== 'active' || !userProfile?.branchId) return; 

    try {
      const branchRef = doc(db, 'branches', userProfile.branchId);
      const historyCol = collection(branchRef, 'printHistory');
      
      await firestoreSetDoc(doc(historyCol, entry.id), {
        userId: user.uid,
        userEmail: user.email,
        timestamp: entry.timestamp,
        nominal: receipt.nominal || 0,
        namaPenerima: receipt.namaPenerima || 'Tanpa Nama',
        bankTujuan: receipt.bankTujuan || 'Lainnya',
        namaPengirim: receipt.namaPengirim || '',
        showPengirim: receipt.showPengirim || false,
        receiptData: receipt
      });
    } catch (err) {
      console.error("Failed to add to Firebase history:", err);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        saveSettings({ logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const testBluetooth = async () => {
    setIsPrinting(true);
    try {
      await printViaBluetooth({
        ...data,
        namaToko: "TES KONEKSI",
        status: "PRINTER SIAP!",
        nominal: 0,
        admin: 0,
        namaPenerima: "TESTER",
        bankTujuan: "BLUETOOTH",
        kodeReferensi: "OK-123"
      }, activeLayout);
    } catch (err) {}
    finally { setIsPrinting(false); }
  };

  const handleInstallClick = async () => {
    if ((window as any).promptPWAInstall) {
      await (window as any).promptPWAInstall();
    }
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (data.aiEnabled === false) {
      setData(prev => ({
        ...prev,
        tanggal: new Date().toISOString().split('T')[0],
        waktu: new Date().toTimeString().split(' ')[0],
        kodeReferensi: '-',
        tid: 'NK-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      }));
      setView('preview');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const base64Data = await fileToBase64(file);
      
      let parsedData;
      if (data.scanEngine === 'local') {
        parsedData = await scanReceiptLocally(base64Data);
      } else {
        const mimeType = file.type;
        parsedData = await parseReceiptFromBase64(base64Data, mimeType, data.customApiKey);
      }

      setData(prev => ({
        ...prev,
        ...parsedData,
        kodeReferensi: parsedData.kodeReferensi || '-',
        nominal: cleanNominal(parsedData.nominal),
        admin: 0, 
      }));
      setView('preview');
    } catch (err: any) {
      const isQuota = err.message?.toLowerCase().includes('quota') || err.message?.includes('429');
      const isInvalidKey = err.message?.includes('API Key');
      
      if ((isQuota || isInvalidKey) && data.useFallbackAI) {
        setData(prev => ({
          ...prev,
          tanggal: new Date().toISOString().split('T')[0],
          waktu: new Date().toTimeString().split(' ')[0],
          kodeReferensi: 'ID-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          namaPenerima: 'INPUT MANUAL',
          nominal: 0,
        }));
        setView('preview');
        setError(err.message || "AI Limit: Silakan isi data secara manual.");
      } else {
        setError(err.message || "Gagal memproses gambar. Pastikan gambar jelas.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintSystem = () => {
    addToHistory(data);
    window.print();
  };

  const handlePrintBT = async () => {
    setIsPrinting(true);
    try {
      await printViaBluetooth(data, activeLayout);
      addToHistory(data);
    } catch (err) {
      // Error handled in bluetooth service via alert
    } finally {
      setIsPrinting(false);
    }
  };

  const exportToExcel = () => {
    if (history.length === 0) {
      alert("Tidak ada data riwayat untuk diekspor.");
      return;
    }

    const exportData = history.map((entry, index) => {
      const adminFee = entry.data.showAdminFee !== false ? (entry.data.admin || 0) : 0;
      return {
        'No.': index + 1,
        'Tanggal': entry.data.tanggal,
        'Waktu': entry.data.waktu,
        'Nama Penerima': entry.data.namaPenerima,
        'Bank Tujuan': entry.data.bankTujuan,
        'No. Rekening': entry.data.noRekening,
        'Nominal': entry.data.nominal,
        'Admin': adminFee,
        'Total': entry.data.nominal + adminFee,
        'Ref': entry.data.kodeReferensi,
        'Cashier': entry.data.cabang || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Transaksi");
    XLSX.writeFile(wb, `Laporan_Alfathprint_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (history.length === 0) {
      alert("Tidak ada data riwayat untuk diekspor.");
      return;
    }

    const doc = new jsPDF();
    doc.text("Laporan Transaksi Alfathprint", 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableData = history.map((entry, index) => {
      const adminFee = entry.data.showAdminFee !== false ? (entry.data.admin || 0) : 0;
      return [
        index + 1,
        entry.data.tanggal,
        entry.data.namaPenerima,
        entry.data.bankTujuan,
        `Rp ${entry.data.nominal.toLocaleString('id-ID')}`,
        `Rp ${adminFee.toLocaleString('id-ID')}`,
        `Rp ${(entry.data.nominal + adminFee).toLocaleString('id-ID')}`
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['No', 'Tanggal', 'Penerima', 'Bank', 'Nominal', 'Admin', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 8 }
    });

    doc.save(`Laporan_Alfathprint_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const shareDigitalReceipt = async () => {
    if (!receiptRef.current) return;
    
    setIsPrinting(true);
    try {
      // Small delay to ensure any pending renders (like input focus changes) are settled
      await new Promise(resolve => setTimeout(resolve, 150));

      // Create a high-quality capture
      const dataUrl = await toPng(receiptRef.current, { 
        cacheBust: true, 
        pixelRatio: 3, // 3 is usually enough for mobile clarity without huge file size
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          borderRadius: '0',
          margin: '0',
          padding: '0'
        }
      });
      
      const adminFee = data.showAdminFee ? (data.admin || 0) : 0;
      const total = data.nominal + adminFee;

      // Prepare for sharing
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `Struk_${data.namaPenerima}_${data.tanggal.replace(/-/g, '')}.png`, { type: 'image/png' });

      // Build text message for context
      const textSummary = `*${data.namaToko} - BUKTI TRANSFER*%0A` +
        `--------------------------------------%0A` +
        `*Penerima:* ${data.namaPenerima}%0A` +
        `*Total:* Rp ${total.toLocaleString('id-ID')}%0A` +
        `--------------------------------------%0A` +
        `%0A_Bukti Transfer Digital_`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Struk ${data.namaToko}`,
          text: `Bukti Transfer an. ${data.namaPenerima} - Rp ${total.toLocaleString('id-ID')}`
        });
      } else {
        // Fallback for desktop/unsupported browsers: Download + WhatsApp Link
        const link = document.createElement('a');
        link.download = `Struk_Digital_${data.namaPenerima}.png`;
        link.href = dataUrl;
        link.click();
        
        // Also open WhatsApp with text
        window.open(`https://wa.me/?text=${textSummary}`, '_blank');
      }
      
      // Add to history after successful "share trigger"
      addToHistory(data);
    } catch (err: any) {
      console.error("Digital share error:", err);
      // Final fallback to text
      const adminFee = data.showAdminFee ? (data.admin || 0) : 0;
      const total = data.nominal + adminFee;
      const message = `*${data.namaToko} - BUKTI TRANSFER*%0A` +
        `--------------------------------------%0A` +
        `*Tgl/Jam:* ${data.tanggal} ${data.waktu}%0A` +
        `*Penerima:* ${data.namaPenerima}%0A` +
        `*Bank:* ${data.bankTujuan}%0A` +
        `*Rekening:* ${data.noRekening}%0A` +
        `--------------------------------------%0A` +
        `*Nominal:* Rp ${data.nominal.toLocaleString('id-ID')}%0A` +
        (data.showAdminFee ? `*Admin:* Rp ${adminFee.toLocaleString('id-ID')}%0A` : '') +
        `*TOTAL:* Rp ${total.toLocaleString('id-ID')}%0A` +
        `--------------------------------------%0A` +
        `*Ref:* ${data.kodeReferensi}%0A` +
        `%0A_Terima kasih telah bertransaksi_`;

      window.open(`https://wa.me/?text=${message}`, '_blank');
    } finally {
      setIsPrinting(false);
    }
  };

  const isAdminUser = userProfile?.role === 'admin' || user?.email === 'peciwaru@gmail.com';

  if (!isAuthLoaded || isLoggingIn) {
    return (
      <div className="flex flex-col h-screen bg-[#f2f4f7] items-center justify-center text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-bold animate-pulse tracking-widest uppercase">Memuat sistem...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-[#f2f4f7] items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center flex flex-col items-center">
          <div className="bg-indigo-50 p-4 rounded-full mb-6">
            <Printer className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-neutral-800 uppercase mb-2">Alfathprint</h1>
          <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
            Sistem Kasir & Struk Pintar<br/>Masuk untuk mengakses layanan.
          </p>
          <button 
            onClick={async () => {
              setIsLoggingIn(true);
              try { await loginWithGoogle(); }
              catch(e) {}
              finally { setIsLoggingIn(false); }
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            <LogIn className="w-5 h-5" /> Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  if (userProfile?.status === 'pending') {
    return (
      <div className="flex flex-col h-screen bg-[#f2f4f7] items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-amber-500 mb-6" />
        <h2 className="text-xl font-black text-slate-800 mb-2 uppercase">Menunggu Persetujuan</h2>
        <p className="text-slate-500 font-medium mb-8">
          Akun Anda ({user.email}) sedang menunggu persetujuan Admin atau pengaturan Cabang.
        </p>
        <button 
          onClick={logout}
          className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest active:bg-slate-50"
        >
          Keluar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f4f7] text-slate-800 font-sans">
      
      {/* Processing Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full text-center"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <Zap className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">Analisis Gambar</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">Kecerdasan Buatan (AI) sedang memproses data struk Anda...</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-2 h-2 bg-indigo-600 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {view === 'home' ? (
        // --- HOME SCREEN ---
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <header className="bg-[#f2f4f7] px-5 py-4 flex items-center justify-between shrink-0 no-print">
            <div className="flex items-center gap-2">
              <Printer className="w-8 h-8 text-neutral-700" />
              <h1 className="text-3xl font-black italic tracking-tighter text-neutral-800 uppercase">Alfathprint</h1>
            </div>
            <div className="flex gap-2">
              {isAdminUser && (
                <button onClick={() => setView('admin')} className="p-2 text-indigo-600 hover:text-indigo-800 transition-colors">
                  <ShieldAlert className="w-6 h-6" />
                </button>
              )}
              <button onClick={testBluetooth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <Bluetooth className="w-6 h-6" />
              </button>
              <button onClick={() => setView('settings')} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </header>

          {/* Main Scrollable Area */}
          <div className="flex-1 overflow-y-auto px-5 pb-32 no-print flex flex-col gap-4 overscroll-contain touch-pan-y">
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start text-red-700 text-sm mb-2 animate-in fade-in">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* PWA Install Banner */}
            {deferredPrompt && (
              <div className="bg-indigo-600 p-4 rounded-2xl text-white flex items-center justify-between animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Instal Aplikasi</h3>
                    <p className="text-[10px] text-indigo-100 italic">Lebih cepat & stabil di Android</p>
                  </div>
                </div>
                <button 
                  onClick={handleInstallClick}
                  className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform"
                >
                  INSTAL
                </button>
              </div>
            )}

            {/* Main Action Banner */}
            <div 
              className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">Cetak Bukti Transfer</h2>
                <p className="text-indigo-100 text-sm mb-6 max-w-[200px] leading-relaxed">
                  Pilih bukti transfer dari galeri, ubah menjadi struk.
                </p>
                <div className="inline-flex">
                  <input 
                    id="fileInput"
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageSelected} 
                    disabled={isLoading} 
                    onClick={(e) => e.stopPropagation()} // Prevent double trigger
                  />
                  <div className="bg-white/20 hover:bg-white/30 backdrop-blur-md transition-colors p-4 rounded-2xl">
                    {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <ImagePlus className="w-8 h-8" />}
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-400/30 rounded-full blur-2xl pointer-events-none"></div>
            </div>

            {/* Secondary Action */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-transform">
               <div className="flex items-center gap-4">
                  <div className="bg-orange-50 text-orange-500 w-12 h-12 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Cetak Token Listrik</h3>
                    <p className="text-xs text-slate-400 mt-1">Upload screenshot PLN (Coming Soon)</p>
                  </div>
               </div>
               <ChevronDown className="w-5 h-5 text-slate-300 -rotate-90" />
            </div>

            {/* Guide Link */}
            <div className="flex justify-center mt-2 mb-4">
               <button className="flex items-center gap-2 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 px-4 py-2 rounded-full text-sm font-semibold transition-colors">
                  <BookOpen className="w-4 h-4" /> Panduan Upload & Share
               </button>
            </div>

            {/* History Section */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg text-slate-800">Riwayat Cetak</h3>
              <button 
                onClick={() => setView('history')}
                className="text-sm text-indigo-600 font-semibold hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            <div className="space-y-3">
              {history.length > 0 ? (
                history.slice(0, 5).map((entry) => (
                  <div 
                    key={entry.id} 
                    onClick={() => {
                        setData(entry.data);
                        setView('preview');
                    }}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-transform"
                  >
                    <div className="bg-slate-50 w-12 h-12 rounded-xl flex items-center justify-center border border-slate-100">
                      <FileText className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 mb-0.5 uppercase truncate w-32">{entry.data.namaPenerima}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(entry.timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} • {new Date(entry.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setData(entry.data);
                           // Small delay to let state update
                           setTimeout(shareDigitalReceipt, 100);
                         }}
                         className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                         title="Share"
                       >
                         <Share2 className="w-4 h-4" />
                       </button>
                       <div className="text-right ml-1">
                          <p className="text-xs font-black text-indigo-600">Rp {entry.data.nominal.toLocaleString('id-ID')}</p>
                       </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white p-10 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                  <Clock className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">Belum ada riwayat cetak.<br/>Mulai dengan upload struk!</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-indigo-900">Cara Pakai Fitur Share</h3>
                </div>
                <ul className="space-y-3 text-sm text-indigo-800/80">
                  <li className="flex gap-2">
                    <span className="font-bold text-indigo-600">1.</span>
                    <span>Klik ikon **"Install"** di pojok kanan atas layar ini atau gunakan menu browser **"Tambahkan ke Layar Utama"**.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-indigo-600">2.</span>
                    <span>Buka galeri/aplikasi bank Anda dan pilih screenshot bukti transfer.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-indigo-600">3.</span>
                    <span>Klik **Share/Bagikan** dan pilih ikon **Alfathprint**. Data akan otomatis terproses!</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest pb-10">
              © 2026 Alfathprint • Versi 2.0.1
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="bg-white border-t border-slate-200 p-2 fixed bottom-0 left-0 right-0 z-20 flex justify-around items-center no-print pb-safe">
             <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 p-2 w-16 ${view === 'home' ? 'text-indigo-600' : 'text-slate-400'}`}>
               <Home className="w-6 h-6" />
               <span className="text-[10px] font-black uppercase">Home</span>
             </button>
             <button onClick={testBluetooth} className="flex flex-col items-center gap-1 p-2 w-16 text-slate-400 hover:text-slate-600">
               <Bluetooth className="w-6 h-6" />
               <span className="text-[10px] font-black uppercase">Printer</span>
             </button>
             <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1 p-2 w-16 ${view === 'settings' ? 'text-indigo-600' : 'text-slate-400'}`}>
               <Settings className="w-6 h-6" />
               <span className="text-[10px] font-black uppercase">Setting</span>
             </button>
          </div>
        </div>
      ) : view === 'settings' ? (
        // --- SETTINGS SCREEN ---
        <div className="flex flex-col h-screen bg-white no-print overflow-hidden">
          <header className="px-5 py-6 flex items-center shrink-0 gap-4">
            <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center text-slate-500">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Pengaturan</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kustomisasi Struk & Toko</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 space-y-8 pb-10 overscroll-contain touch-pan-y">
            {/* Logo Settings */}
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 text-center">
              <div className="w-24 h-24 bg-white rounded-2xl mx-auto mb-4 border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm relative group">
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="Store Logo" className="w-full h-full object-contain" />
                ) : (
                  <ImagePlus className="w-10 h-10 text-slate-200" />
                )}
              </div>
              <label className="bg-white border border-slate-200 px-6 py-3 rounded-2xl text-xs font-black text-slate-700 cursor-pointer hover:bg-white active:bg-slate-50 shadow-sm inline-block transition-colors">
                GANTI LOGO STRUK
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
              {data.logoUrl && (
                <button 
                  onClick={() => saveSettings({ logoUrl: undefined })}
                  className="block mx-auto mt-3 text-[10px] font-black text-rose-500 hover:underline uppercase tracking-widest"
                >
                  Hapus Logo
                </button>
              )}
            </div>

            {/* Shop Info */}
            <div className="space-y-5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Profil Toko</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nama Toko</label>
                  <input 
                    type="text" 
                    value={data.namaToko || ''}
                    onChange={(e) => saveSettings({ namaToko: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Contoh: ALFATHPRINT"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">TID Struk</label>
                  <input 
                    type="text" 
                    value={data.tid || ''}
                    onChange={(e) => saveSettings({ tid: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Contoh: NK-000"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Teks Bawah 1</label>
                <input 
                  type="text" 
                  value={data.footerLine1 || ''}
                  onChange={(e) => saveSettings({ footerLine1: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Teks Bawah 2</label>
                <input 
                  type="text" 
                  value={data.footerLine2 || ''}
                  onChange={(e) => saveSettings({ footerLine2: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-sm font-bold text-slate-800">Tampilkan Pengirim</span>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Muncul di struk cetak</p>
                </div>
                <button 
                  onClick={() => saveSettings({ showPengirim: !data.showPengirim })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${data.showPengirim ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.showPengirim ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
              {data.showPengirim && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nama Pengirim (Default)</label>
                  <input 
                    type="text" 
                    value={data.namaPengirim || ''}
                    onChange={(e) => saveSettings({ namaPengirim: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Contoh: AGEN BERKAH"
                  />
                </div>
              )}
            </div>

            {/* AI Settings */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Kecerdasan Buatan (AI)</h3>
              
              <div 
                className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer active:bg-slate-100 transition-colors"
                onClick={() => saveSettings({ aiEnabled: !data.aiEnabled })}
              >
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.aiEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                     <Zap className="w-6 h-6" />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-800 text-sm">Gunakan AI Intelijen</h4>
                     <p className="text-[10px] text-slate-400 font-medium">Otomatis ekstraksi data dari foto</p>
                   </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full transition-colors relative ${data.aiEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.aiEnabled ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>

              {!data.aiEnabled && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 leading-tight font-bold">
                    AI DINONAKTIFKAN: Anda harus mengisi nominal dan tujuan secara manual.
                  </p>
                </div>
              )}

              {data.aiEnabled && (
                <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 flex gap-1 p-1 h-12">
                   <button 
                     onClick={() => saveSettings({ scanEngine: 'ai' })}
                     className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${data.scanEngine === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400'}`}
                   >
                     <Zap className="w-3 h-3" />
                     Mesin Cloud (AI)
                   </button>
                   <button 
                     onClick={() => saveSettings({ scanEngine: 'local' })}
                     className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${data.scanEngine === 'local' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-slate-400'}`}
                   >
                     <Smartphone className="w-3 h-3" />
                     Mesin Lokal (OCR)
                   </button>
                </div>
              )}

              {data.aiEnabled && data.scanEngine === 'local' && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-700 leading-tight font-bold">
                    SCAN LOKAL AKTIF: Gratis selamanya, privasi aman, berjalan di HP Anda. Pastikan gambar tajam!
                  </p>
                </div>
              )}

              <div 
                className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer active:bg-slate-100 transition-colors"
                onClick={() => saveSettings({ useFallbackAI: !data.useFallbackAI })}
              >
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.useFallbackAI ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                     <Zap className="w-6 h-6" />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-800 text-sm">Mode Cadangan AI</h4>
                     <p className="text-[10px] text-slate-400 font-medium">Aktifkan input manual jika kuota AI habis</p>
                   </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full transition-colors relative ${data.useFallbackAI ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.useFallbackAI ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl flex gap-3 items-start border border-indigo-100">
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-indigo-800 leading-relaxed font-semibold">
                   Jika kuota harian AI habis, sistem akan langsung membuka form pengisian manual agar Anda tetap bisa mencetak struk dengan cepat.
                </p>
              </div>

              {/* Custom API Key Section */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Milik Sendiri (BYOK)</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gratis & Tanpa Limit</p>
                  </div>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg"
                  >
                    Dapatkan Key
                  </a>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Gemini API Key (Multi-Key Rotation)</label>
                  <div className="relative">
                    <textarea 
                      value={data.customApiKey || ''}
                      onChange={(e) => {
                        saveSettings({ customApiKey: e.target.value });
                        setKeyStatus('none');
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12 min-h-[80px]"
                      placeholder="Input 1 atau lebih API Key, pisahkan dengan koma..."
                    />
                    {data.customApiKey && (
                      <button 
                        onClick={testApiKey}
                        disabled={isTestingKey}
                        className="absolute right-2 top-2 p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors"
                        title="Cek keaktifan Key"
                      >
                        {isTestingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
                    <span className="text-indigo-600 font-bold block mb-1">PRO TIP: Masukkan beberapa Key dipisah tanda koma (,) agar jika satu kena limit, aplikasi otomatis pakai Key lain.</span>
                    Kunci disimpan <span className="text-emerald-600 font-bold italic">hanya di HP Anda</span>. 
                    {keyStatus === 'valid' && <span className="text-emerald-500 font-bold ml-1">✓ Terhubung</span>}
                    {keyStatus === 'invalid' && <span className="text-red-500 font-bold ml-1">✗ Ada Key Bermasalah</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Bluetooth Test Section */}
            <div className="pt-4 border-t border-slate-50 space-y-4">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Pengujian Perangkat</h3>
               <button 
                  onClick={testBluetooth}
                  disabled={isPrinting}
                  className="w-full bg-neutral-900 active:bg-black text-white py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-colors shadow-xl"
                >
                  {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bluetooth className="w-5 h-5" />}
                  TES CETAK BLUETOOTH
                </button>
                
                <div 
                  className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer active:bg-slate-100 transition-colors"
                  onClick={() => saveSettings({ showAdminFee: !data.showAdminFee })}
                >
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.showAdminFee ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                       <Zap className="w-6 h-6" />
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-800 text-sm">Aktifkan Biaya Admin</h4>
                       <p className="text-[10px] text-slate-400 font-medium">Tampilkan baris Biaya Admin di struk</p>
                     </div>
                  </div>
                  <div 
                    className={`w-12 h-6 rounded-full transition-colors relative ${data.showAdminFee ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.showAdminFee ? 'left-7' : 'left-1'}`}></div>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-400 text-center mt-2 font-medium italic">Pastikan izin Bluetooth sudah diberikan ke browser.</p>
            </div>

            {/* PWA Help Section */}
            <div className="bg-indigo-900/5 p-5 rounded-3xl border border-indigo-100 mb-4">
              <h3 className="text-sm font-black text-indigo-900 mb-2 uppercase italic">Tips "Share ke Aplikasi"</h3>
              <p className="text-[11px] text-indigo-700/70 leading-relaxed font-medium">
                Agar nama <span className="font-bold">Alfathprint</span> muncul saat Anda klik "Share" di aplikasi Bank:
              </p>
              <ul className="mt-2 space-y-1 text-[10px] text-indigo-800 font-bold list-disc ml-4">
                <li>Buka di Chrome Android atau Safari iOS.</li>
                <li>Klik tombol menu browser (titik tiga) {"->"} <span className="text-indigo-600">"Instal"</span>.</li>
                <li>Jika hanya muncul "Tambah ke Layar Utama", pastikan cache sudah dihapus {"&"} buka link aplikasi yang benar.</li>
                <li>Setelah terinstal, Alfathprint bisa menerima "Share Gambar" langsung dari aplikasi Bank.</li>
              </ul>
            </div>

            {/* Admin Area Button (Settings) */}
            {isAdminUser && (
              <div className="pt-4 border-t border-slate-50">
                <button 
                  onClick={() => setView('admin')}
                  className="w-full bg-indigo-50 border border-indigo-100 active:bg-indigo-100 text-indigo-600 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-colors uppercase tracking-widest"
                >
                  <ShieldAlert className="w-5 h-5" />
                  Buka Panel Admin
                </button>
              </div>
            )}

            {/* Logout button */}
            <div className="pt-4 border-t border-slate-50">
               <button 
                  onClick={logout}
                  className="w-full bg-white border border-rose-100 active:bg-rose-50 text-rose-500 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-colors uppercase tracking-widest"
                >
                  <LogOut className="w-5 h-5" />
                  Keluar Akun
                </button>
            </div>
          </div>
        </div>
      ) : view === 'history' ? (
        // --- ALL HISTORY SCREEN ---
        <div className="flex flex-col h-screen bg-slate-50 no-print overflow-hidden">
          <header className="px-5 py-6 bg-white border-b border-slate-100 flex items-center shrink-0 gap-4">
            <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center text-slate-500">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Riwayat Struk</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total: {history.length} Transaksi</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button 
                onClick={exportToExcel}
                className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100"
                title="Ekspor Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={exportToPDF}
                className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100"
                title="Ekspor PDF"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 overscroll-contain">
            {history.length > 0 ? (
              history.map((entry) => (
                <div 
                  key={entry.id} 
                  onClick={() => {
                      setData(entry.data);
                      setView('preview');
                  }}
                  className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                  <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center border border-slate-50">
                    <History className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 mb-0.5 uppercase">{entry.data.namaPenerima}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                      {entry.data.bankTujuan} • {new Date(entry.timestamp).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-black text-slate-800">Rp {entry.data.nominal.toLocaleString('id-ID')}</p>
                     {entry.data.cabang && <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">{entry.data.cabang}</span>}
                  </div>
                </div>
              ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <History className="w-16 h-16 text-slate-200 mb-4" />
                  <p className="text-sm font-bold text-slate-400">TIDAK ADA DATA</p>
                </div>
            )}
          </div>
          
          <div className="p-5 bg-white border-t border-slate-100 no-print">
            <button 
              onClick={() => {
                if(confirm("Hapus semua riwayat?")) {
                   setHistory([]);
                   localStorage.removeItem('alfathprint_history');
                }
              }}
              className="w-full py-4 rounded-2xl text-xs font-black text-rose-500 border-2 border-rose-50 hover:bg-rose-50 uppercase tracking-widest transition-colors"
            >
              Kosongkan Riwayat
            </button>
          </div>
        </div>
      ) : view === 'admin' ? (
         // --- ADMIN SCREEN ---
         <div className="flex flex-col h-screen bg-white no-print overflow-hidden">
           <header className="px-5 py-6 flex items-center shrink-0 gap-4 border-b border-slate-100">
             <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center text-slate-500">
               <ArrowLeft className="w-6 h-6" />
             </button>
             <div>
               <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Admin Area</h2>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manajemen Karyawan & Cabang</p>
             </div>
           </header>
           <div className="flex-1 overflow-hidden">
             <AdminPanel />
           </div>
         </div>
      ) : (
        // --- PREVIEW SCREEN ---
        <div className="flex flex-col h-screen overflow-hidden bg-[#f2f4f7]">
          <header className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 flex items-center shrink-0 z-20 no-print relative">
            <button 
              onClick={() => setView('home')} 
              className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 absolute left-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-center w-full">Preview Struk</h1>
          </header>

          <div className="flex-1 overflow-y-auto no-print flex flex-col items-center bg-[#f2f4f7] overscroll-contain touch-pan-y">
            <div className="w-full max-w-md mx-auto p-4 flex flex-col gap-6 pb-32">
              
              {/* Style Selector */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {LAYOUTS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLayout(l.id)}
                    className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all snap-center whitespace-nowrap
                      ${activeLayout === l.id 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>

              {/* Receipt Canvas */}
              <div className="flex justify-center items-center py-4 relative">
                {/* Dotted bg behind receipt */}
                <div className="absolute inset-x-[-20px] inset-y-[-20px] opacity-20 pointer-events-none -z-10" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                
                <ReceiptPreview 
                  ref={receiptRef}
                  data={data} 
                  onChange={setData} 
                  layout={activeLayout}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#f2f4f7] px-4 pt-2 pb-6 pb-safe shrink-0 no-print z-20 flex gap-2 max-w-md mx-auto w-full">
            <button 
              onClick={shareDigitalReceipt}
              disabled={isPrinting}
              className="flex-none bg-emerald-500 hover:bg-emerald-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-lg shadow-emerald-100 disabled:opacity-50"
              title="Bagikan Struk Digital"
            >
              {isPrinting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Share2 className="w-6 h-6" />}
            </button>
            <button 
              onClick={handlePrintSystem}
              className="flex-none bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-sm"
              title="Cetak Sistem (PDF/Awan)"
            >
              <FileText className="w-6 h-6" />
            </button>
            <button 
              onClick={handlePrintBT}
              disabled={isPrinting}
              className="flex-1 bg-indigo-600 active:bg-indigo-700 disabled:bg-indigo-400 text-white h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-200 text-sm"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  MENGHUBUNGKAN...
                </>
              ) : (
                <>
                  <Bluetooth className="w-5 h-5" />
                  CETAK LANGSUNG (BT)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Print Only Container */}
      <div className="hidden print:flex print:absolute print:inset-0 print:items-start print:justify-start">
         <ReceiptPreview data={data} onChange={() => {}} layout={activeLayout} />
      </div>

    </div>
  );
}

