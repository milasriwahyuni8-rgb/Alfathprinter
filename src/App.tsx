import React, { useState, useEffect } from 'react';
import { parseReceipt, parseReceiptFromBase64, parseReceiptFromText, testGeminiKey } from './services/gemini';
import { scanReceiptLocally } from './services/localOcr';
import { printViaBluetooth } from './services/bluetooth';
import { ReceiptData, HistoryEntry } from './types';
import { ReceiptPreview } from './components/ReceiptPreview';
import { ReceiptEditForm } from './components/ReceiptEditForm';
import { AdminPanel } from './components/AdminPanel';
import { auth, db, loginWithGoogle, logout } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, setDoc as firestoreSetDoc, addDoc } from 'firebase/firestore';
import { AlertCircle, FileText, Smartphone, Bluetooth, CheckCircle2, ChevronDown, Printer, Settings, History, Home, Loader2, ImagePlus, Power, Zap, BookOpen, Edit3, ArrowLeft, Download, Clock, LogIn, LogOut, ShieldAlert, Key, RefreshCw, Share2, Search, Trash2, ShieldCheck } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'none' | 'valid' | 'invalid'>(data.customApiKey ? 'valid' : 'none');
  const receiptRef = React.useRef<HTMLDivElement>(null);

  const testApiKey = async () => {
    const trimmedKey = data.customApiKey.trim();
    if (!trimmedKey) return;
    setIsTestingKey(true);
    try {
      await testGeminiKey(trimmedKey);
      setKeyStatus('valid');
      alert("✅ API Key Valid! AI sekarang akan menggunakan kuota Anda.");
    } catch (err: any) {
      setKeyStatus('invalid');
      alert("❌ " + err.message);
    } finally {
      setIsTestingKey(false);
    }
  };

  // Sync keyStatus when data.customApiKey changes
  useEffect(() => {
    if (!data.customApiKey) setKeyStatus('none');
    // We don't automatically set to 'valid' because we haven't tested it in this session yet
    // But if it was loaded from localStorage, showing 'valid' or 'none' based on existence is okay
  }, [data.customApiKey]);

  const deleteHistory = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('alfathprint_history', JSON.stringify(newHistory));
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
       setError("Gambar diterima dari Share! Silakan masuk dengan Google untuk memproses struk otomatis.");
    }

    if (!isAuthLoaded || !user || !sharedId) return;
    
    // 2. Check for shared image from Web Share Target
    const fetchShared = async () => {
      if (!sharedId || isLoading) return;
      
      try {
        setIsLoading(true);
        setError(null);
        console.log("Mencoba mengambil data share ID:", sharedId);
        
        const res = await fetch(`/api/shared/${sharedId}`);
        if (!res.ok) {
          throw new Error("Data share tidak ditemukan atau sudah kadaluarsa.");
        }
        
        const sharedData = await res.json();
        
        // Remove param from URL first to prevent retry on refresh
        window.history.replaceState({}, document.title, "/");
        
        // Use current settings with safety check
        let apiKey = '';
        let engine = 'ai';
        try {
          const settingsStr = localStorage.getItem('alfathprint_settings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            apiKey = settings.customApiKey || '';
            engine = settings.scanEngine || 'ai';
          }
        } catch (e) {
          console.error("Gagal membaca settings di fetchShared:", e);
        }

        let parsedData;
        if (sharedData.type === 'text') {
           console.log("Memproses shared text...");
           parsedData = await parseReceiptFromText(sharedData.text, apiKey);
        } else {
           console.log("Memproses shared image...");
           if (engine === 'local') {
             parsedData = await scanReceiptLocally(sharedData.base64Data);
           } else {
             parsedData = await parseReceiptFromBase64(sharedData.base64Data, sharedData.mimeType, apiKey);
           }
        }

        if (!parsedData) throw new Error("Gagal mengurai data struk.");

        setData(prev => ({
          ...prev,
          ...parsedData,
          kodeReferensi: parsedData.kodeReferensi || '-',
          nominal: cleanNominal(parsedData.nominal),
          admin: cleanNominal(parsedData.admin), 
        }));
        
        setView('preview');
      } catch (err: any) {
        console.error("Shared content error:", err);
        // Clear param anyway on error so user isn't stuck
        window.history.replaceState({}, document.title, "/");
        
        const isQuota = err.message?.toLowerCase().includes('quota') || err.message?.includes('429');
        if (isQuota) {
           setData(prev => ({
             ...prev,
             tanggal: new Date().toISOString().split('T')[0],
             waktu: new Date().toTimeString().split(' ')[0],
             nominal: 0,
             admin: 0,
           }));
           setView('preview');
           setError("Kuota AI Habis. Silakan isi data secara manual.");
        } else {
           setError(err.message || "Gagal memproses share gambar.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (sharedId && isAuthLoaded && user) {
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
    const processedData = { ...updatedData };
    if (processedData.customApiKey !== undefined) {
      processedData.customApiKey = processedData.customApiKey.trim();
    }

    const newSettings = {
      namaToko: processedData.namaToko || data.namaToko,
      cabang: processedData.cabang || data.cabang,
      footerLine1: processedData.footerLine1 || data.footerLine1,
      footerLine2: processedData.footerLine2 || data.footerLine2,
      logoUrl: processedData.logoUrl || data.logoUrl,
      namaPengirim: processedData.namaPengirim !== undefined ? processedData.namaPengirim : data.namaPengirim,
      showPengirim: processedData.showPengirim !== undefined ? processedData.showPengirim : data.showPengirim,
      useFallbackAI: processedData.useFallbackAI !== undefined ? processedData.useFallbackAI : data.useFallbackAI,
      aiEnabled: processedData.aiEnabled !== undefined ? processedData.aiEnabled : data.aiEnabled,
      scanEngine: processedData.scanEngine !== undefined ? processedData.scanEngine : data.scanEngine,
      customApiKey: processedData.customApiKey !== undefined ? processedData.customApiKey : data.customApiKey,
      showAdminFee: processedData.showAdminFee !== undefined ? processedData.showAdminFee : data.showAdminFee,
      tid: processedData.tid || data.tid,
    };
    localStorage.setItem('alfathprint_settings', JSON.stringify(newSettings));
    setData(prev => ({ ...prev, ...processedData }));
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
        admin: cleanNominal(parsedData.admin), 
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
      const showAdmin = entry.data.showAdminFee !== false;
      const adminFee = showAdmin ? (entry.data.admin || 0) : 0;
      
      const row: any = {
        'No.': index + 1,
        'Tanggal': entry.data.tanggal,
        'Waktu': entry.data.waktu,
        'Nama Penerima': entry.data.namaPenerima,
        'Bank Tujuan': entry.data.bankTujuan,
        'No. Rekening': entry.data.noRekening,
        'Nominal': entry.data.nominal,
      };

      if (showAdmin) {
        row['Admin'] = adminFee;
      }
      
      row['Total'] = entry.data.nominal + adminFee;
      row['Ref'] = entry.data.kodeReferensi;
      row['Cashier'] = entry.data.cabang || '-';
      
      return row;
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
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text("Laporan Transaksi Alfathprint", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 28);
    doc.text(`Total Transaksi: ${history.length}`, 14, 33);

    const showAdminColumn = history.some(h => h.data.showAdminFee);
    const headers = ['No', 'Tanggal', 'Penerima', 'Bank', 'Nominal'];
    if (showAdminColumn) headers.push('Admin');
    headers.push('Total');

    const tableData = history.map((entry, index) => {
      const showAdmin = entry.data.showAdminFee !== false;
      const adminFee = (showAdmin && entry.data.admin) ? entry.data.admin : 0;
      
      const row: any[] = [
        index + 1,
        entry.data.tanggal,
        entry.data.namaPenerima,
        entry.data.bankTujuan,
        `Rp ${entry.data.nominal.toLocaleString('id-ID')}`,
      ];

      if (showAdminColumn) {
        row.push(adminFee > 0 ? `Rp ${adminFee.toLocaleString('id-ID')}` : '-');
      }

      row.push(`Rp ${(entry.data.nominal + adminFee).toLocaleString('id-ID')}`);
      return row;
    });

    (doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 10 },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });

    doc.save(`Laporan_Alfathprint_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const shareDigitalReceipt = async () => {
    if (!receiptRef.current) {
       alert("Gagal mengambil gambar struk. Pastikan struk terlihat di layar.");
       return;
    }
    
    setIsPrinting(true);
    try {
      // Small delay to ensure any pending renders settling
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
        `*Nominal:* Rp ${data.nominal.toLocaleString('id-ID')}%0A` +
        (data.showAdminFee && adminFee > 0 ? `*Admin:* Rp ${adminFee.toLocaleString('id-ID')}%0A` : '') +
        `*TOTAL:* Rp ${total.toLocaleString('id-ID')}%0A` +
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
        (data.showAdminFee && adminFee > 0 ? `*Admin:* Rp ${adminFee.toLocaleString('id-ID')}%0A` : '') +
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
      <div className="flex flex-col h-screen bg-[#f2f4f7] items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-[2rem] p-10 shadow-2xl border border-white text-center flex flex-col items-center"
        >
          <div className="bg-brand-50 p-5 rounded-3xl mb-8">
            <Printer className="w-12 h-12 text-brand-600" />
          </div>
          <h1 className="text-4xl font-display font-black tracking-tighter text-slate-900 uppercase mb-3">Alfathprint</h1>
          <p className="text-slate-500 font-medium text-sm mb-10 leading-relaxed px-4">
            Sistem Kasir & Struk Pintar.<br/>Silakan masuk untuk melanjutkan.
          </p>
          <button 
            onClick={async () => {
              setIsLoggingIn(true);
              try { await loginWithGoogle(); }
              catch(e) {}
              finally { setIsLoggingIn(false); }
            }}
            className="w-full bg-brand-600 hover:bg-brand-700 active:scale-95 transition-all text-white font-bold py-4.5 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs shadow-lg shadow-brand-100"
          >
            <LogIn className="w-5 h-5" /> Masuk dengan Google
          </button>
        </motion.div>
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

  const NavItem = ({ id, icon: Icon, label, active }: { id: typeof view, icon: any, label: string, active: boolean }) => (
    <button 
      onClick={() => setView(id)} 
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer group ${
        active 
          ? 'bg-brand-50 text-brand-600 font-bold shadow-sm' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-brand-500'
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-400'}`} />
      <span className="text-xs uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f2f4f7] text-slate-800 font-sans overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="p-8 flex items-center gap-3">
          <Printer className="w-8 h-8 text-brand-600" />
          <h1 className="text-2xl font-display font-black tracking-tighter text-slate-900 uppercase">Alfathprint</h1>
        </div>
        
        <nav className="flex-1 px-4 py-2 space-y-2">
          <NavItem id="home" icon={Home} label="Beranda" active={view === 'home'} />
          <NavItem id="history" icon={History} label="Riwayat" active={view === 'history'} />
          <NavItem id="settings" icon={Settings} label="Pengaturan" active={view === 'settings'} />
          {isAdminUser && <NavItem id="admin" icon={ShieldAlert} label="Admin" active={view === 'admin'} />}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-4 p-4 mb-4 bg-slate-50 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold uppercase">
              {user.email?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.displayName || 'User'}</p>
              <p className="text-[10px] text-brand-600 font-black uppercase">{userProfile?.role || 'Karyawan'}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-rose-500 hover:bg-rose-50 font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-8 max-w-xs w-full text-center"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-slate-100 border-t-brand-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <Zap className="w-10 h-10 text-brand-600 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-display font-black text-slate-900 uppercase tracking-tight italic">Analisis AI</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">Sistem sedang mengekstrak data dari struk Anda dengan presisi tinggi...</p>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                      className="w-2.5 h-2.5 bg-brand-600 rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-auto bg-white lg:bg-[#f2f4f7]">
          <div className="w-full max-w-5xl mx-auto h-full flex flex-col">
            <AnimatePresence mode="wait">
              {view === 'home' ? (
                <motion.div 
                  key="home"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col min-h-full"
                >
                  <header className="px-6 py-8 flex items-center justify-between lg:hidden shrink-0">
                    <div className="flex items-center gap-2">
                      <Printer className="w-8 h-8 text-brand-600" />
                      <h1 className="text-3xl font-display font-black tracking-tighter text-slate-900 uppercase">Alfathprint</h1>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={testBluetooth} className="p-3 text-slate-400 hover:text-brand-500 transition-colors bg-white rounded-2xl shadow-sm">
                        <Bluetooth className="w-6 h-6" />
                      </button>
                    </div>
                  </header>

                  <div className="flex-1 px-6 pb-32 flex flex-col gap-8 max-w-3xl mx-auto w-full py-0 lg:py-12">
                    {error && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start text-rose-700 text-sm animate-in fade-in slide-in-from-top-4">
                        <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                        <p className="font-medium">{error}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-6 relative">
                       {/* Main Scan Card */}
                       <div 
                        className="bg-brand-600 rounded-[2.5rem] p-6 text-white shadow-2xl shadow-brand-200/50 cursor-pointer active:scale-[0.98] transition-all group overflow-hidden relative"
                        onClick={() => document.getElementById('fileInput')?.click()}
                      >
                        <div className="relative z-10">
                          <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <ImagePlus className="w-7 h-7" />}
                          </div>
                          <h2 className="text-2xl font-display font-black mb-1 uppercase leading-tight tracking-tight">Pindai Struk</h2>
                          <p className="text-brand-100 text-[11px] font-medium leading-relaxed max-w-[180px]">
                            Otomatis ekstraksi data struk transfer dengan AI Alfath.
                          </p>
                          <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={handleImageSelected} disabled={isLoading} />
                        </div>
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Zap className="w-24 h-24 rotate-12" />
                        </div>
                      </div>
                    </div>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="font-display font-black text-lg text-slate-900 uppercase">Riwayat Terbaru</h3>
                        <button onClick={() => setView('history')} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline">
                          Lihat Semua
                        </button>
                      </div>

                      <div className="grid gap-3">
                        {history.length > 0 ? (
                          history.slice(0, 5).map((entry) => (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              key={entry.id} 
                              onClick={() => { setData(entry.data); setView('preview'); }}
                              className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 hover:border-brand-200 transition-all cursor-pointer group"
                            >
                              <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center border border-slate-50 group-hover:bg-brand-50 transition-colors">
                                <FileText className="w-5 h-5 text-slate-400 group-hover:text-brand-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 text-xs mb-0.5 uppercase truncate">{entry.data.namaPenerima}</h4>
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                  <span>{entry.data.bankTujuan}</span>
                                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span>{new Date(entry.timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="text-right">
                                    <p className="text-xs font-black text-slate-900">Rp {entry.data.nominal.toLocaleString('id-ID')}</p>
                                    <p className="text-[9px] text-brand-600 font-bold uppercase">Berhasil</p>
                                 </div>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setData(entry.data); setTimeout(shareDigitalReceipt, 100); }}
                                   className="p-2.5 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors"
                                 >
                                   <Share2 className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="py-20 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                              <Clock className="w-8 h-8 text-slate-200" />
                            </div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Belum ada riwayat transaksi</p>
                          </div>
                        )}
                      </div>
                    </section>

                    <div className="mt-10 py-10 border-t border-slate-100 text-center">
                      <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] mb-2">© 2026 Alfathprint Studio</p>
                      <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-400">
                        <span className="hover:text-brand-500 cursor-pointer">Panduan</span>
                        <span className="hover:text-brand-500 cursor-pointer">Kebijakan</span>
                        <span className="hover:text-brand-500 cursor-pointer">Support</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
                  ) : view === 'settings' ? (
        // --- SETTINGS SCREEN ---
        <motion.div 
          key="settings"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex flex-col h-screen bg-white lg:bg-[#f2f4f7] no-print overflow-hidden"
        >
          <header className="px-6 py-6 bg-white border-b border-slate-100 flex items-center shrink-0 gap-4">
            <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-xl lg:hidden">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-display font-black text-slate-900 uppercase tracking-tight">Pengaturan</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Kustomisasi Toko & Sistem</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 pb-32 lg:pb-12 overscroll-contain touch-pan-y max-w-4xl w-full mx-auto">
            
            {/* Logo Section */}
            <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
              <div className="w-28 h-28 bg-slate-50 rounded-[2rem] mx-auto mb-6 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner group relative">
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="Store Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImagePlus className="w-10 h-10 text-slate-200" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <RefreshCw className="w-8 h-8 text-white animate-spin-slow" />
                </div>
              </div>
              <label className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-2xl text-xs font-black cursor-pointer shadow-lg shadow-brand-100 inline-block transition-all active:scale-95 uppercase tracking-widest">
                Unggah Logo Toko
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
              {data.logoUrl && (
                <button 
                  onClick={() => saveSettings({ logoUrl: undefined })}
                  className="block mx-auto mt-4 text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest"
                >
                  Hapus Logo
                </button>
              )}
            </section>

            {/* General Info */}
            <section className="space-y-6">
              <div className="px-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Informasi Dasar</h3>
                <p className="text-[10px] text-slate-400 font-medium">Beban kerja struk utama Anda</p>
              </div>
              
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Toko</label>
                    <input 
                      type="text" 
                      value={data.namaToko || ''}
                      onChange={(e) => saveSettings({ namaToko: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                      placeholder="ALFATHPRINT"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ID Terminal (TID)</label>
                    <input 
                      type="text" 
                      value={data.tid || ''}
                      onChange={(e) => saveSettings({ tid: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                      placeholder="NK-000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teks Footer 1</label>
                    <input 
                      type="text" 
                      value={data.footerLine1 || ''}
                      onChange={(e) => saveSettings({ footerLine1: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teks Footer 2</label>
                    <input 
                      type="text" 
                      value={data.footerLine2 || ''}
                      onChange={(e) => saveSettings({ footerLine2: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Intelligence Settings */}
            <section className="space-y-6">
              <div className="px-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Sistem Pintar (AI)</h3>
                <p className="text-[10px] text-slate-400 font-medium">Pengaturan otomatisasi ekstraksi data</p>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div 
                  className="p-8 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => saveSettings({ aiEnabled: !data.aiEnabled })}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${data.aiEnabled ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Zap className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-0.5">Ekstraksi AI Otomatis</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Gunakan Gemini 3 Flash</p>
                    </div>
                  </div>
                  <div className={`w-14 h-7 rounded-full transition-all relative ${data.aiEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${data.aiEnabled ? 'left-[2rem]' : 'left-1'}`}></div>
                  </div>
                </div>

                <AnimatePresence>
                  {data.aiEnabled && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-8 pb-8 space-y-6 border-t border-slate-50 pt-8"
                    >
                      <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1.5">
                        <button 
                          onClick={() => saveSettings({ scanEngine: 'ai' })}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${data.scanEngine === 'ai' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Google Gemini (Cloud)
                        </button>
                        <button 
                          onClick={() => saveSettings({ scanEngine: 'local' })}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${data.scanEngine === 'local' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Tesseract OCR (Local)
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Custom API Key (Rotasi Otomatis)</label>
                          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] font-black text-brand-600 uppercase hover:underline">Ambil Key Gratis</a>
                        </div>
                        <div className="relative">
                          <textarea 
                            value={data.customApiKey || ''}
                            onChange={(e) => { saveSettings({ customApiKey: e.target.value }); setKeyStatus('none'); }}
                            className="w-full bg-slate-50 border border-slate-100 rounded-3xl px-6 py-5 text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all min-h-[120px] resize-none"
                            placeholder="Key 1, Key 2, Key 3..."
                          />
                          <button 
                            onClick={testApiKey}
                            disabled={isTestingKey}
                            className="absolute right-4 bottom-4 p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-brand-600 hover:bg-brand-50 transition-colors"
                          >
                            {isTestingKey ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">Pisahkan dengan koma untuk fitur rotasi otomatis</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Account & Device */}
            <section className="space-y-6">
              <div className="px-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Perangkat & Akun</h3>
                <p className="text-[10px] text-slate-400 font-medium">Manajemen koneksi printer dan sesi</p>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-4">
                <button 
                  onClick={testBluetooth}
                  className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-slate-200 transition-all active:scale-[0.99]"
                >
                  <Bluetooth className="w-5 h-5" /> Hubungkan Printer BT
                </button>
                
                <button 
                  onClick={logout}
                  className="w-full bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-colors"
                >
                  <LogOut className="w-5 h-5" /> Keluar dari Sistem
                </button>
              </div>
            </section>

            <div className="pt-10 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.3em]">
              Alfathprint V2.1.0 • 2026
            </div>
          </div>
        </motion.div>
      ) : view === 'history' ? (
        // --- ALL HISTORY SCREEN ---
        <motion.div 
          key="history"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex flex-col h-screen bg-[#f2f4f7] no-print overflow-hidden"
        >
          <header className="px-6 py-6 bg-white border-b border-slate-100 flex items-center shrink-0 gap-4">
            <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-xl lg:hidden">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-display font-black text-slate-900 uppercase tracking-tight">Arsip Struk</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Total {history.length} Lembar Tersimpan</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={exportToExcel}
                className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 hover:bg-emerald-100 transition-colors"
                title="Ekspor Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={exportToPDF}
                className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100 hover:bg-rose-100 transition-colors"
                title="Ekspor PDF"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="px-6 py-4 bg-white border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama atau nominal..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 pb-32 lg:pb-12 overscroll-contain max-w-4xl w-full mx-auto">
            {history.length > 0 ? (
              history
                .filter(h => 
                   h.data.namaPenerima?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   h.data.nominal?.toString().includes(searchQuery) ||
                   h.data.bankTujuan?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((entry) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={entry.id} 
                    onClick={() => { setData(entry.data); setView('preview'); }}
                    className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 hover:border-brand-200 transition-all cursor-pointer group"
                  >
                    <div className="bg-slate-50 w-14 h-14 rounded-[1.25rem] flex items-center justify-center border border-slate-50 group-hover:bg-brand-50 transition-colors">
                      <History className="w-6 h-6 text-slate-300 group-hover:text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 mb-0.5 uppercase truncate">{entry.data.namaPenerima}</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none flex items-center gap-2">
                        <span>{entry.data.bankTujuan}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span>{new Date(entry.timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'2-digit'})}</span>
                      </p>
                    </div>
                    <div className="text-right">
                       <p className="text-base font-black text-slate-900">Rp {entry.data.nominal.toLocaleString('id-ID')}</p>
                       <div className="flex items-center justify-end gap-1.5 mt-1">
                         {entry.data.cabang && <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">{entry.data.cabang}</span>}
                         <button 
                           onClick={(e) => { e.stopPropagation(); if(confirm('Hapus transaksi ini?')) deleteHistory(entry.id); }}
                           className="p-1 text-rose-300 hover:text-rose-500 transition-colors"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </div>
                  </motion.div>
                ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                    <History className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Belum Ada Data</p>
                </div>
            )}
          </div>
          
          <div className="p-6 bg-white border-t border-slate-100 no-print">
            <button 
              onClick={() => {
                const isAdmin = userProfile?.role === 'admin' || user?.email === 'peciwaru@gmail.com';
                if(confirm(isAdmin ? "Hapus semua riwayat PERMANEN?" : "Bersihkan riwayat lokal?")) {
                   setHistory([]);
                   localStorage.removeItem('alfathprint_history');
                }
              }}
              className="w-full py-4.5 rounded-2xl text-[10px] font-black text-rose-500 border-2 border-rose-50 hover:bg-rose-50 uppercase tracking-[0.2em] transition-all active:scale-[0.98]"
            >
              Hapus Semua Riwayat
            </button>
          </div>
        </motion.div>
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
        <motion.div 
          key="preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col h-screen overflow-hidden bg-[#f2f4f7]"
        >
          <header className="bg-white shadow-sm border-b border-slate-100 px-6 py-4 flex items-center shrink-0 z-20 no-print relative">
            <button 
              onClick={() => setView('home')} 
              className="w-11 h-11 border border-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-display font-black tracking-tight text-slate-900 uppercase">Preview Struk</h1>
            </div>
            <div className="w-11" /> {/* Spacer */}
          </header>

          <div className="flex-1 overflow-y-auto no-print flex flex-col items-center bg-[#f2f4f7] overscroll-contain touch-pan-y">
            <div className="w-full max-w-xl mx-auto p-4 flex flex-col gap-4 pb-40">
              
              {/* Tab Selector */}
              <div className="bg-white p-1.5 rounded-[1.5rem] shadow-sm flex items-center gap-1.5 border border-slate-200">
                <button 
                  onClick={() => setActiveTab('preview')}
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  Visual Struk
                </button>
                <button 
                  onClick={() => setActiveTab('edit')}
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'edit' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  Edit Data Toko
                </button>
              </div>

              {activeTab === 'preview' ? (
                <>
                  {/* Style Selector */}
                  <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar -mx-2 px-2">
                    {LAYOUTS.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setActiveLayout(l.id)}
                        className={`shrink-0 px-5 py-2.5 rounded-xl text-[9px] font-black transition-all uppercase tracking-widest
                          ${activeLayout === l.id 
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-100' 
                            : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>

                  {/* Receipt Canvas */}
                  <motion.div 
                    layout
                    className="flex justify-center items-center py-2 relative"
                  >
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none -z-10 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[length:24px_24px]" />
                    
                    <div className="shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] bg-white max-w-full overflow-hidden">
                      <ReceiptPreview 
                        ref={receiptRef}
                        data={data} 
                        onChange={setData} 
                        layout={activeLayout}
                      />
                    </div>
                  </motion.div>
                  
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      💡 Klik pada nama, nominal, atau tanggal di dalam struk <br/> untuk melakukan koreksi cepat dengan keyboard HP Anda.
                    </p>
                  </div>
                </>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 max-w-xl mx-auto w-full"
                >
                  <ReceiptEditForm data={data} onChange={setData} />
                </motion.div>
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 px-6 pt-3 pb-8 pb-safe shrink-0 no-print z-30 flex gap-3 max-w-4xl mx-auto w-full rounded-t-[2rem] shadow-[0_-15px_30px_rgba(0,0,0,0.04)]">
            <button 
              onClick={shareDigitalReceipt}
              disabled={isPrinting}
              className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-100 active:scale-90 disabled:opacity-50"
              title="Bagikan Struk Digital"
            >
              {isPrinting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Share2 className="w-6 h-6" />}
            </button>
            
            <button 
              onClick={handlePrintBT}
              disabled={isPrinting}
              className="flex-1 bg-brand-600 active:scale-[0.98] disabled:bg-slate-400 text-white h-14 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-brand-100"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <Bluetooth className="w-5 h-5" />
                  Cetak (BT)
                </>
              )}
            </button>

            <button 
              onClick={handlePrintSystem}
              className="w-14 h-14 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center transition-all active:scale-90"
              title="Cetak Sistem"
            >
              <Printer className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Mobile Navigation */}
      {view !== 'preview' && (
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2rem] flex items-center justify-around h-20 px-4 z-40 shadow-2xl shadow-slate-900/20">
          <button 
            onClick={() => setView('home')} 
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${view === 'home' ? 'text-brand-400 scale-110' : 'text-slate-400 opacity-60'}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button 
            onClick={() => setView('history')} 
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${view === 'history' ? 'text-brand-400 scale-110' : 'text-slate-400 opacity-60'}`}
          >
            <History className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">History</span>
          </button>
          <div className="relative -top-8">
             <button 
               onClick={() => document.getElementById('fileInput')?.click()}
               className="w-16 h-16 bg-brand-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-brand-500/40 border-4 border-[#f2f4f7] active:scale-95 transition-all"
             >
               <Zap className="w-7 h-7" />
             </button>
          </div>
          <button 
            onClick={() => setView('settings')} 
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${view === 'settings' ? 'text-brand-400 scale-110' : 'text-slate-400 opacity-60'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Settings</span>
          </button>
          {isAdminUser && (
            <button 
              onClick={() => setView('admin')} 
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${view === 'admin' ? 'text-brand-400 scale-110' : 'text-slate-400 opacity-60'}`}
            >
              <ShieldAlert className="w-5 h-5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Admin</span>
            </button>
          )}
        </nav>
      )}

      {/* Print Only Container */}
      <div className="hidden print:flex print:absolute print:inset-0 print:items-start print:justify-start">
         <ReceiptPreview data={data} onChange={() => {}} layout={activeLayout} />
      </div>
    </div>
  );
}

