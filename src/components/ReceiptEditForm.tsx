import React from 'react';
import { ReceiptData } from '../types';
import { Calendar, Clock, Hash, Landmark, User, CreditCard, DollarSign, ShieldCheck, Store, MessageSquare } from 'lucide-react';

interface ReceiptEditFormProps {
  data: ReceiptData;
  onChange: (data: ReceiptData) => void;
}

export const ReceiptEditForm: React.FC<ReceiptEditFormProps> = ({ data, onChange }) => {
  const handleChange = (field: keyof ReceiptData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const InputGroup = ({ label, icon: Icon, children }: { label: string, icon: any, children: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <Icon size={12} className="text-indigo-500" />
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
      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
      placeholder={placeholder}
      spellCheck={false}
    />
  );

  const NumberInput = ({ field, placeholder }: { field: keyof ReceiptData, placeholder: string }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const value = data[field] as number;
    
    const handleRawChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const selectionStart = el.selectionStart || 0;
      const oldValue = el.value;

      // Count digits before cursor
      const digitsBeforeCursor = oldValue.slice(0, selectionStart).replace(/\D/g, '').length;

      // Get digits only
      const rawValue = oldValue.replace(/\D/g, '');
      const numericValue = parseInt(rawValue, 10);
      handleChange(field, isNaN(numericValue) ? 0 : numericValue);

      // Restore cursor position
      setTimeout(() => {
        if (!inputRef.current) return;
        const newValue = inputRef.current.value;
        let newPos = 0;
        let digitsFound = 0;
        for (let i = 0; i < newValue.length; i++) {
          if (/\d/.test(newValue[i])) digitsFound++;
          newPos = i + 1;
          if (digitsFound === digitsBeforeCursor) break;
        }
        inputRef.current.setSelectionRange(newPos, newPos);
      }, 0);
    };

    const displayValue = value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value);

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">Rp</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleRawChange}
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
          placeholder={placeholder}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">Informasi Toko & Waktu</h3>
          
          <InputGroup label="Nama Toko / Agen" icon={Store}>
            <TextInput field="namaToko" placeholder="Masukkan nama toko" uppercase />
          </InputGroup>

          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Tanggal" icon={Calendar}>
              <TextInput field="tanggal" placeholder="YYYY-MM-DD" />
            </InputGroup>
            <InputGroup label="Waktu" icon={Clock}>
              <TextInput field="waktu" placeholder="HH:mm" />
            </InputGroup>
          </div>

          <InputGroup label="Nomor Referensi" icon={Hash}>
            <TextInput field="kodeReferensi" placeholder="Nomor Transaksi/RRN" uppercase />
          </InputGroup>
        </div>

        {/* Recipient Info */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">Informasi Penerima</h3>
          
          <InputGroup label="Nama Penerima" icon={User}>
            <TextInput field="namaPenerima" placeholder="Nama Lengkap" uppercase />
          </InputGroup>

          <InputGroup label="Bank Tujuan" icon={Landmark}>
            <TextInput field="bankTujuan" placeholder="Nama Bank (BCA/BRI/dsb)" uppercase />
          </InputGroup>

          <InputGroup label="Nomor Rekening" icon={CreditCard}>
            <TextInput field="noRekening" placeholder="Nomor Rekening" inputMode="numeric" />
          </InputGroup>
        </div>

        {/* Amount Info */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">Nominal & Biaya</h3>
          
          <InputGroup label="Nominal Transfer" icon={DollarSign}>
            <NumberInput field="nominal" placeholder="0" />
          </InputGroup>

          <div className="flex items-center justify-between mb-1">
             <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.showAdminFee ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                   <ShieldCheck size={16} />
                </div>
                <span className="text-sm font-medium text-slate-700">Tampilkan Biaya Admin</span>
             </div>
             <button
                onClick={() => handleChange('showAdminFee', !data.showAdminFee)}
                className={`w-10 h-5 rounded-full transition-colors relative ${data.showAdminFee ? 'bg-indigo-600' : 'bg-slate-300'}`}
             >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${data.showAdminFee ? 'left-5.5' : 'left-0.5'}`}></div>
             </button>
          </div>

          {data.showAdminFee && (
            <InputGroup label="Biaya Admin" icon={ShieldCheck}>
              <NumberInput field="admin" placeholder="0" />
            </InputGroup>
          )}

          <div className="pt-2 mt-2 border-t border-slate-200">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Bayar</span>
              <span className="text-lg font-black text-indigo-600">
                Rp {(data.nominal + (data.showAdminFee ? (data.admin || 0) : 0)).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer & Status */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">Status & Pesan</h3>
          
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
