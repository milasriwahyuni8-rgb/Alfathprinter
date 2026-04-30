import React, { useState, useEffect } from 'react';
import { parseReceipt } from './services/gemini';
import { printViaBluetooth } from './services/bluetooth';
import { ReceiptData } from './types';
import { ReceiptPreview } from './components/ReceiptPreview';
import { AlertCircle, FileText, Smartphone, Bluetooth, CheckCircle2, ChevronDown, Printer, Settings, History, Home, Loader2, ImagePlus, Power, Zap, BookOpen, Edit3, ArrowLeft, Download } from 'lucide-react';

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
};

const LAYOUTS = [
  { id: 'standard', name: '1. Standard' },
  { id: 'modern', name: '2. Modern' },
  { id: 'bank', name: '3. Bank Style' },
] as const;

export default function App() {
  const [view, setView] = useState<'home' | 'preview'>('home');
  const [data, setData] = useState<ReceiptData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLayout, setActiveLayout] = useState<typeof LAYOUTS[number]['id']>('standard');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
// ... (deferredPrompt logic)
    const handler = (e: any) => {
// ...
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
// ...
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
// ...
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const parsedData = await parseReceipt(file);
      setData(prev => ({
        ...prev,
        ...parsedData,
        nominal: Number(parsedData.nominal) || 0,
        admin: 0, 
      }));
      setView('preview');
    } catch (err: any) {
      setError(err.message || "Gagal memproses gambar. Pastikan gambar jelas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintSystem = () => {
    window.print();
  };

  const handlePrintBT = async () => {
    setIsPrinting(true);
    try {
      await printViaBluetooth(data);
    } catch (err) {
      // Error handled in bluetooth service via alert
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f2f4f7] text-slate-800 font-sans overflow-hidden">
      
      {view === 'home' ? (
        // --- HOME SCREEN ---
        <>
          {/* Header */}
          <header className="bg-[#f2f4f7] px-5 py-4 flex items-center justify-between shrink-0 no-print">
            <div className="flex items-center gap-2">
              <Printer className="w-8 h-8 text-neutral-700" />
              <h1 className="text-3xl font-black italic tracking-tighter text-neutral-800 uppercase">Alfathprint</h1>
            </div>
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-100">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
            </div>
          </header>

          {/* Main Scrollable Area */}
          <div className="flex-1 overflow-y-auto px-5 pb-24 no-print flex flex-col gap-4">
            
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
              <button className="text-sm text-indigo-600 font-semibold hover:underline">Lihat Semua</button>
            </div>

            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-slate-50 w-12 h-12 rounded-xl flex items-center justify-center border border-slate-100">
                     <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-0.5">LENIYASARI</h4>
                    <p className="text-xs text-slate-400">2026-04-30 07:42</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Bottom Navigation */}
          <div className="bg-white border-t border-slate-200 p-2 fixed bottom-0 left-0 right-0 z-20 flex justify-around items-center no-print pb-safe">
             <button className="flex flex-col items-center gap-1 p-2 w-16 text-indigo-600">
               <Home className="w-6 h-6" />
               <span className="text-[10px] font-semibold">Beranda</span>
             </button>
             <button className="flex flex-col items-center gap-1 p-2 w-16 text-slate-400 hover:text-slate-600">
               <Printer className="w-6 h-6" />
               <span className="text-[10px] font-semibold">Printer</span>
             </button>
             <button className="flex flex-col items-center gap-1 p-2 w-16 text-slate-400 hover:text-slate-600">
               <Settings className="w-6 h-6" />
               <span className="text-[10px] font-semibold">Setelan</span>
             </button>
          </div>
        </>
      ) : (
        // --- PREVIEW SCREEN ---
        <>
          <header className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 flex items-center shrink-0 z-20 no-print relative">
            <button 
              onClick={() => setView('home')} 
              className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 absolute left-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-center w-full">Preview Struk</h1>
          </header>

          <div className="flex-1 overflow-y-auto no-print flex flex-col items-center bg-[#f2f4f7]">
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
                  data={data} 
                  onChange={setData} 
                  layout={activeLayout}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#f2f4f7] px-4 pt-2 pb-6 shrink-0 no-print z-20 flex gap-3 max-w-md mx-auto w-full">
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
        </>
      )}

      {/* Print Only Container */}
      <div className="hidden print:flex print:absolute print:inset-0 print:items-start print:justify-start">
         <ReceiptPreview data={data} onChange={() => {}} layout={activeLayout} />
      </div>

    </div>
  );
}

