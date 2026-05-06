import React from 'react';
import { ReceiptData } from '../types';
import { Calendar, Clock, Hash, Landmark, User, CreditCard, DollarSign, ShieldCheck, Store, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReceiptEditFormProps {
  data: ReceiptData;
  onChange: (data: ReceiptData) => void;
}

export const ReceiptEditForm: React.FC<ReceiptEditFormProps> = ({ data, onChange }) => {
  const handleChange = (field: keyof ReceiptData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const InputGroup = ({ label, icon: Icon, children }: { label: string, icon: any, children: React.ReactNode }) => (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
        <Icon size={12} className="text-brand-500" />
        {label}
      </label>
      {children}
    </div>
  );

  const TextInput = ({ field, placeholder, uppercase = false, inputMode }: { field: keyof ReceiptData, placeholder: string, uppercase?: boolean, inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) => (
    <input
      type="text"
      inputMode={inputMode}
      value={(data[field] as string) || ''}
      onChange={(e) => handleChange(field, uppercase ? e.target.value.toUpperCase() : e.target.value)}
      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all shadow-sm"
      placeholder={placeholder}
      spellCheck={false}
    />
  );

  const NumberInput = ({ field, placeholder }: { field: keyof ReceiptData, placeholder: string }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const value = data[field] as number;
    
    const handleRawChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const originalValue = el.value;
      
      const rawValue = originalValue.replace(/\D/g, '');
      const numericValue = parseInt(rawValue, 10);
      handleChange(field, isNaN(numericValue) ? 0 : numericValue);

      // Simple end-focus for this form version as well to ensure stability
      setTimeout(() => {
        if (!inputRef.current) return;
        const newLen = inputRef.current.value.length;
        inputRef.current.setSelectionRange(newLen, newLen);
      }, 0);
    };

    const displayValue = value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value);

    return (
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm pointer-events-none">Rp</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleRawChange}
          className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-display font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all shadow-sm"
          placeholder={placeholder}
        />
      </div>
    );
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Basic Info */}
        <div className="space-y-6 bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-50 pb-4">Toko & Waktu</h3>
          
          <InputGroup label="Nama Toko / Agen" icon={Store}>
            <TextInput field="namaToko" placeholder="Contoh: Alfath Cell" uppercase />
          </InputGroup>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Tanggal" icon={Calendar}>
              <TextInput field="tanggal" placeholder="YYYY-MM-DD" />
            </InputGroup>
            <InputGroup label="Waktu" icon={Clock}>
              <TextInput field="waktu" placeholder="HH:mm" />
            </InputGroup>
          </div>

          <InputGroup label="Nomor Referensi" icon={Hash}>
            <TextInput field="kodeReferensi" placeholder="Nomor Transaksi" uppercase />
          </InputGroup>
        </div>

        {/* Recipient Info */}
        <div className="space-y-6 bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-50 pb-4">Tujuan Transfer</h3>
          
          <InputGroup label="Nama Penerima" icon={User}>
            <TextInput field="namaPenerima" placeholder="Nama Lengkap" uppercase />
          </InputGroup>

          <InputGroup label="Bank Tujuan" icon={Landmark}>
            <TextInput field="bankTujuan" placeholder="Contoh: BCA" uppercase />
          </InputGroup>

          <InputGroup label="Nomor Rekening" icon={CreditCard}>
            <TextInput field="noRekening" placeholder="Nomor Rekening" inputMode="numeric" />
          </InputGroup>
        </div>

        {/* Amount Info */}
        <div className="space-y-6 bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-50 pb-4">Nominal & Biaya</h3>
          
          <InputGroup label="Nominal Transfer" icon={DollarSign}>
            <NumberInput field="nominal" placeholder="0" />
          </InputGroup>

          <div className="flex items-center justify-between py-2 px-1">
             <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${data.showAdminFee ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-300'}`}>
                   <ShieldCheck size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-800 block leading-tight">Biaya Admin</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Tampilkan di Struk</span>
                </div>
             </div>
             <button
                onClick={() => handleChange('showAdminFee', !data.showAdminFee)}
                className={`w-12 h-6 rounded-full transition-all relative ${data.showAdminFee ? 'bg-brand-600 shadow-lg shadow-brand-100' : 'bg-slate-200'}`}
             >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${data.showAdminFee ? 'left-7' : 'left-1'}`}></div>
             </button>
          </div>

          <AnimatePresence>
            {data.showAdminFee && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <InputGroup label="Biaya Admin" icon={ShieldCheck}>
                  <NumberInput field="admin" placeholder="0" />
                </InputGroup>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-6 mt-2 border-t border-slate-50">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bayar</span>
              <span className="text-2xl font-display font-black text-brand-600 tracking-tight">
                Rp {(data.nominal + (data.showAdminFee ? (data.admin || 0) : 0)).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer & Status */}
        <div className="space-y-6 bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-50 pb-4">Status & Pesan</h3>
          
          <InputGroup label="Status Transaksi" icon={ShieldCheck}>
            <TextInput field="status" placeholder="TRANSAKSI BERHASIL" uppercase />
          </InputGroup>

          <InputGroup label="Pesan Footer 1" icon={MessageSquare}>
            <TextInput field="footerLine1" placeholder="Pesan baris 1" />
          </InputGroup>

          <InputGroup label="Pesan Footer 2" icon={MessageSquare}>
            <TextInput field="footerLine2" placeholder="Pesan baris 2" />
          </InputGroup>
        </div>
      </div>
    </div>
  );
};
