import React, { useState } from 'react';
import { ReceiptData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Landmark, User, CreditCard, Hash, Calendar, Clock, DollarSign, ShieldCheck } from 'lucide-react';

interface ReceiptPreviewProps {
  data: ReceiptData;
  onChange: (data: ReceiptData) => void;
  fontFamily?: string;
  className?: string;
  layout?: 'standard' | 'modern' | 'bank' | 'elegant' | 'pro' | 'digital';
  logoType?: 'full' | 'text' | 'none';
}

interface EditingField {
  key: keyof ReceiptData;
  label: string;
  value: any;
  type: 'text' | 'number' | 'date' | 'time';
}

export const ReceiptPreview = React.forwardRef<HTMLDivElement, ReceiptPreviewProps>(({ data, onChange, fontFamily = 'monospace', className = '', layout = 'standard', logoType = 'full' }, ref) => {
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const total = data.nominal + (data.showAdminFee ? (data.admin || 0) : 0);

  const openEditor = (key: keyof ReceiptData, label: string, type: 'text' | 'number' | 'date' | 'time' = 'text') => {
    setEditingField({
      key,
      label,
      value: data[key],
      type
    });
  };

  const saveEdit = (val: any) => {
    if (editingField) {
      onChange({ ...data, [editingField.key]: val });
      setEditingField(null);
    }
  };

  const InlineInput = ({ value, label, keyName, align = 'left', isBold = false, uppercase = false }: { value: string, label: string, keyName: keyof ReceiptData, align?: string, isBold?: boolean, uppercase?: boolean }) => (
    <div 
      onClick={() => openEditor(keyName, label)}
      className={`cursor-pointer hover:bg-brand-50 transition-all px-1 -mx-1 border border-transparent hover:border-brand-200 group relative ${isBold ? 'font-bold' : ''}`}
      style={{ textAlign: align as any }}
    >
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] bg-brand-600 text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-20 font-black uppercase tracking-widest shadow-lg shadow-brand-100">Edit {label}</div>
      {value || '-'}
    </div>
  );

  const InlineCurrencyInput = ({ value, label, keyName, align = 'right', isBold = false }: { value: number, label: string, keyName: keyof ReceiptData, align?: string, isBold?: boolean }) => (
    <div 
      onClick={() => openEditor(keyName, label, 'number')}
      className={`cursor-pointer hover:bg-brand-50 transition-all px-1 -mx-4 border border-transparent hover:border-brand-200 group relative flex items-center gap-1 ${isBold ? 'font-bold' : ''}`}
      style={{ justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}
    >
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] bg-brand-600 text-white px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-20 font-black uppercase tracking-widest shadow-lg shadow-brand-100">Ubah Nominal</div>
      <span className="opacity-40 text-[0.8em]">Rp</span>
      <span>{new Intl.NumberFormat('id-ID').format(value)}</span>
    </div>
  );

  const renderStandard = () => (
    <>
      {data.showStoreName && (
        <>
          <div className="text-center font-bold text-xs mb-0.5 uppercase tracking-tighter">
            <InlineInput value={data.namaToko} label="Nama Toko" keyName="namaToko" align="center" isBold uppercase />
          </div>
          <div className="text-center mb-0.5 select-none font-bold text-xs opacity-40">
            {'=' .repeat(32)}
          </div>
        </>
      )}
      
      <div className="flex justify-between items-center gap-1 leading-none py-0.25">
        <span className="shrink-0 select-none text-[9px] opacity-60">TANGGAL</span>
        <div className="flex-1">
           <InlineInput value={data.tanggal || ''} label="Tanggal" keyName="tanggal" align="right" />
        </div>
      </div>
      <div className="flex justify-between items-center gap-1 leading-none py-0.25">
        <span className="shrink-0 select-none text-[9px] opacity-60">WAKTU</span>
        <div className="flex-1">
          <InlineInput value={data.waktu || ''} label="Waktu" keyName="waktu" align="right" />
        </div>
      </div>
      <div className="flex justify-between items-center gap-1 leading-none py-0.25">
        <span className="shrink-0 select-none text-[9px] opacity-60 uppercase tracking-tighter">REFF</span>
        <div className="flex-1">
          <InlineInput value={data.kodeReferensi || ''} label="Ref No" keyName="kodeReferensi" align="right" isBold />
        </div>
      </div>
      
      <div className="text-center my-0.25 select-none font-bold text-xs opacity-20">
        {'-'.repeat(32)}
      </div>

      {data.showPengirim && (
        <div className="w-full flex justify-between items-center gap-1 py-0.25">
          <span className="shrink-0 whitespace-nowrap select-none text-[10px] opacity-70 uppercase">DR</span>
          <div className="flex-1 w-full overflow-hidden">
            <InlineInput value={data.namaPengirim || ''} label="Pengirim" keyName="namaPengirim" align="right" />
          </div>
        </div>
      )}

      <div className="w-full flex justify-between items-center gap-1 py-0.25 mt-0.5">
         <span className="shrink-0 whitespace-nowrap select-none text-[10px] font-black opacity-40 uppercase tracking-widest">NAMA</span>
         <div className="flex-1 w-full overflow-hidden">
            <InlineInput value={data.namaPenerima} label="Penerima" keyName="namaPenerima" align="right" isBold />
         </div>
      </div>
      <div className="w-full flex justify-between items-center gap-1 py-0.25">
         <span className="shrink-0 whitespace-nowrap select-none text-[10px] opacity-70">BANK</span>
         <div className="flex-1 w-full overflow-hidden">
           <InlineInput value={data.bankTujuan} label="Bank" keyName="bankTujuan" align="right" />
         </div>
      </div>
      <div className="w-full flex justify-between items-center gap-1 py-0.25">
         <span className="shrink-0 whitespace-nowrap select-none text-[10px] opacity-70">REK</span>
         <div className="flex-1 w-full text-right font-mono text-[11px]">
           <InlineInput value={data.noRekening} label="No Rekening" keyName="noRekening" align="right" />
         </div>
      </div>

      <div className="text-center my-0.25 select-none font-bold text-xs opacity-20">
        {'-'.repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-1 py-0.25">
        <span className="shrink-0 select-none text-[10px] opacity-70">NOMINAL</span>
        <div className="flex-1 font-mono text-xs">
          <InlineCurrencyInput value={data.nominal} label="Nominal" keyName="nominal" align="right" />
        </div>
      </div>
      {data.showAdminFee && (
        <div className="flex justify-between items-center gap-1 py-0.25">
          <span className="shrink-0 select-none text-[10px] opacity-70">ADMIN</span>
          <div className="flex-1 font-mono text-xs">
            <InlineCurrencyInput value={data.admin || 0} label="Admin" keyName="admin" align="right" />
          </div>
        </div>
      )}

      <div className="text-center my-0.25 select-none font-bold text-xs opacity-40">
        {'=' .repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-1 leading-none py-0.5">
        <span className="shrink-0 select-none font-bold text-[11px]">TOTAL</span>
        <div className="flex-1">
          <InlineCurrencyInput value={total} label="Total" keyName="nominal" align="right" isBold />
        </div>
      </div>

      <div className="text-center mb-1 select-none font-bold text-xs opacity-40">
        {'=' .repeat(32)}
      </div>
      
      <div className="text-center mt-1 mb-0.5">
        <div className="flex items-center justify-center gap-1 uppercase tracking-tighter text-[11px]">
           <InlineInput value={data.status || ''} label="Status" keyName="status" align="center" isBold uppercase />
        </div>
      </div>
      <div className="text-center text-[9px] leading-tight opacity-70">
         <InlineInput value={data.footerLine1 || ''} label="Footer 1" keyName="footerLine1" align="center" uppercase />
      </div>
      <div className="text-center font-bold text-[10px] leading-tight mt-0.5">
         <InlineInput value={data.footerLine2 || ''} label="Footer 2" keyName="footerLine2" align="center" isBold uppercase />
      </div>
    </>
  );

  const renderModern = () => (
    <>
      {data.showStoreName && (
        <div className="text-center font-bold text-sm mb-1 uppercase tracking-tight">
          <InlineInput value={data.namaToko} label="Nama Toko" keyName="namaToko" align="center" isBold uppercase />
        </div>
      )}
      
      <div className="text-center my-1 select-none font-bold text-xs tracking-[-1px]">
        {'===================================='}
      </div>
      <div className="text-center font-bold tracking-widest my-1 uppercase">
        BUKTI TRANSFER
      </div>
      <div className="text-center my-1 select-none font-bold text-xs tracking-[-1px]">
        {'===================================='}
      </div>

      <div className="flex justify-between items-center gap-2 text-[10px] mb-2 opacity-60">
        <div><InlineInput value={data.tanggal || ''} label="Tanggal" keyName="tanggal" align="left" /></div>
        <div><InlineInput value={data.waktu || ''} label="Waktu" keyName="waktu" align="right" /></div>
      </div>

      <div className="flex items-center gap-2 font-bold mb-4 mt-2">
        <span className="shrink-0 select-none">NO REF:</span>
        <div className="flex-1">
           <InlineInput value={data.kodeReferensi || ''} label="Ref No" keyName="kodeReferensi" align="left" isBold uppercase />
        </div>
      </div>

      {data.showPengirim && (
        <div className="flex items-center gap-2 font-bold mb-2">
          <span className="shrink-0 w-20 select-none">PENGIRIM</span>
          <div className="flex-1">
             <InlineInput value={data.namaPengirim || ''} label="Pengirim" keyName="namaPengirim" align="right" isBold uppercase />
          </div>
        </div>
      )}

      <div className="font-bold mb-1 uppercase">KEPADA:</div>
      <div className="flex items-center gap-2 font-bold">
         <span className="shrink-0 w-20 select-none">PENERIMA</span>
         <div className="flex-1">
            <InlineInput value={data.namaPenerima || ''} label="Penerima" keyName="namaPenerima" align="right" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center gap-2 font-bold">
         <span className="shrink-0 w-20 select-none">BANK</span>
         <div className="flex-1">
           <InlineInput value={data.bankTujuan || ''} label="Bank" keyName="bankTujuan" align="right" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center gap-2 font-bold mb-4">
         <span className="shrink-0 w-20 select-none">REK</span>
         <div className="flex-1">
           <InlineInput value={data.noRekening || ''} label="No Rekening" keyName="noRekening" align="right" isBold uppercase />
         </div>
      </div>

      <div className="bg-gray-200 print:bg-gray-200/50 print:border-y print:border-black print:border-dashed py-2 px-3 flex flex-col items-center justify-center font-bold my-2 rounded-sm">
         <div className="w-full flex justify-between text-[10px] items-center mb-1">
           <span className="opacity-60 uppercase">NOMINAL</span>
           <div className="w-24"><InlineCurrencyInput value={data.nominal} label="Nominal" keyName="nominal" align="right" /></div>
         </div>
         {data.showAdminFee && (
           <div className="w-full flex justify-between text-[10px] items-center mb-1">
             <span className="opacity-60 uppercase">ADMIN</span>
             <div className="w-24"><InlineCurrencyInput value={data.admin || 0} label="Admin" keyName="admin" align="right" /></div>
           </div>
         )}
         <div className="w-full h-[1px] bg-black/10 my-1"></div>
         <span className="uppercase tracking-widest text-[12px]">TOTAL BAYAR</span>
         <div className="w-full mt-1 text-base">
           <InlineCurrencyInput value={total} label="Total" keyName="nominal" align="center" isBold />
         </div>
      </div>

      <div className="text-center mt-6 mb-1 font-bold">
        <div className="flex items-center justify-center gap-1">
           <span className="select-none">**</span>
           <InlineInput value={data.status || ''} label="Status" keyName="status" align="center" isBold uppercase />
           <span className="select-none">**</span>
        </div>
      </div>
      <div className="text-center mb-1">
         <InlineInput value={data.footerLine1 || ''} label="Footer 1" keyName="footerLine1" align="center" uppercase />
      </div>
      <div className="text-center font-bold mt-2">
         <InlineInput value={data.footerLine2 || ''} label="Footer 2" keyName="footerLine2" align="center" isBold uppercase />
      </div>
    </>
  );

  const renderBank = () => (
    <>
      {data.showStoreName && (
        <div className="text-center font-bold text-sm mb-1 uppercase tracking-tight">
          <InlineInput value={data.namaToko} label="Nama Toko" keyName="namaToko" align="center" isBold uppercase />
        </div>
      )}
      <div className="text-center font-bold mb-4 uppercase">
        BUKTI TRANSAKSI
      </div>

      <div className="flex items-center font-bold">
         <div className="flex-1">
           <InlineInput value={data.tanggal || ''} label="Tanggal" keyName="tanggal" align="left" isBold uppercase />
         </div>
         <div className="flex-1">
           <InlineInput value={data.waktu || ''} label="Waktu" keyName="waktu" align="right" isBold uppercase />
         </div>
      </div>
      
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">ID REF</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.kodeReferensi || ''} label="Ref No" keyName="kodeReferensi" align="left" isBold uppercase />
         </div>
      </div>

      <div className="flex items-center font-bold mb-4">
         <span className="shrink-0 w-[120px] select-none">NO REF</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.kodeReferensi || ''} label="Ref No" keyName="kodeReferensi" align="left" isBold uppercase />
         </div>
      </div>

      {data.showPengirim && (
        <div className="flex items-center font-bold">
           <span className="shrink-0 w-[120px] select-none">PENGIRIM</span>
           <span className="select-none mr-2">:</span>
           <div className="flex-1">
             <InlineInput value={data.namaPengirim || ''} label="Pengirim" keyName="namaPengirim" align="left" isBold uppercase />
           </div>
        </div>
      )}

      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">TRANSAKSI</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={'TRANSFER BANK'} label="Jenis Transaksi" keyName="status" align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">BANK TUJUAN</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.bankTujuan || ''} label="Bank" keyName="bankTujuan" align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">NO REKENING</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.noRekening || ''} label="No Rekening" keyName="noRekening" align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">PENERIMA</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.namaPenerima || ''} label="Penerima" keyName="namaPenerima" align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">JUMLAH</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineCurrencyInput value={data.nominal} label="Nominal" keyName="nominal" align="left" isBold />
         </div>
      </div>
      {data.showAdminFee && (
        <div className="flex items-center font-bold">
           <span className="shrink-0 w-[120px] select-none uppercase">ADMIN FEE</span>
           <span className="select-none mr-2">:</span>
           <div className="flex-1">
             <InlineCurrencyInput value={data.admin || 0} label="Admin" keyName="admin" align="left" isBold />
           </div>
        </div>
      )}
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">TOTAL</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineCurrencyInput value={total} label="Total" keyName="nominal" align="left" isBold />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">STATUS</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.status === 'TRANSAKSI BERHASIL' ? 'SUKSES' : 'PENDING'} label="Status" keyName="status" align="left" isBold uppercase />
         </div>
      </div>

      <div className="text-center font-bold mt-8 mb-1">
         <InlineInput value={data.footerLine2} label="Footer 2" keyName="footerLine2" align="center" isBold />
      </div>
      <div className="text-center mb-1">
         <InlineInput value={data.footerLine1} label="Footer 1" keyName="footerLine1" align="center" uppercase />
      </div>
    </>
  );

  const renderElegant = () => (
    <div className="flex flex-col w-full">
      {data.showStoreName && (
        <div className="text-center font-bold text-base mb-1 tracking-widest uppercase">
          <InlineInput value={data.namaToko || ''} label="Nama Toko" keyName="namaToko" align="center" isBold uppercase />
        </div>
      )}
      <div className="text-center text-[10px] mb-4 opacity-50 italic">
        --- OFFICIAL RECEIPT ---
      </div>
      
      <div className="flex justify-between border-y border-black/10 py-2 mb-4">
        <div className="flex flex-col">
          <span className="text-[9px] opacity-40 font-bold uppercase">Transaction Date</span>
          <InlineInput value={data.tanggal || ''} label="Tanggal" keyName="tanggal" align="left" />
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[9px] opacity-40 font-bold uppercase">Time</span>
          <InlineInput value={data.waktu || ''} label="Waktu" keyName="waktu" align="right" />
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {data.showPengirim && (
          <div className="flex flex-col">
            <span className="text-[9px] opacity-40 font-bold uppercase underline decoration-indigo-200">Sender</span>
            <div className="font-bold text-[13px]">
              <InlineInput value={data.namaPengirim || ''} label="Pengirim" keyName="namaPengirim" align="left" isBold uppercase />
            </div>
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-[9px] opacity-40 font-bold uppercase underline decoration-indigo-200">Recipient</span>
          <div className="font-bold text-[13px]">
            <InlineInput value={data.namaPenerima || ''} label="Penerima" keyName="namaPenerima" align="left" isBold uppercase />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] opacity-40 font-bold uppercase underline decoration-indigo-200">Destination</span>
          <div className="flex items-center gap-2">
             <div className="w-1/3">
              <InlineInput value={data.bankTujuan || ''} label="Bank" keyName="bankTujuan" align="left" isBold uppercase />
             </div>
             <span className="opacity-20">|</span>
             <div className="flex-1">
              <InlineInput value={data.noRekening || ''} label="No Rekening" keyName="noRekening" align="left" isBold />
             </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2 mb-6">
        <div className="flex justify-between items-center text-[11px]">
          <span className="opacity-60">Amount</span>
          <div className="w-24">
            <InlineCurrencyInput value={data.nominal} label="Nominal" keyName="nominal" align="right" />
          </div>
        </div>
        {data.showAdminFee && (
          <div className="flex justify-between items-center text-[11px]">
            <span className="opacity-60">Service Fee</span>
            <div className="w-24">
              <InlineCurrencyInput value={data.admin || 0} label="Admin" keyName="admin" align="right" />
            </div>
          </div>
        )}
        <div className="border-t border-black/10 pt-2 flex justify-between items-center font-bold text-sm">
          <span className="text-indigo-600">TOTAL</span>
          <span>Rp {total.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black tracking-widest uppercase">
          {data.status}
        </div>
      </div>

      <div className="text-center space-y-1">
        <div className="text-[10px] font-bold uppercase">
          <InlineInput value={data.footerLine1 || ''} label="Footer 1" keyName="footerLine1" align="center" uppercase />
        </div>
        <div className="text-[10px] uppercase opacity-60">
          <InlineInput value={data.footerLine2 || ''} label="Footer 2" keyName="footerLine2" align="center" />
        </div>
      </div>
      <div className="mt-4 text-center opacity-30 text-[8px] font-mono">
        REF: {data.kodeReferensi}
      </div>
    </div>
  );

  const renderPro = () => (
    <>
      {data.showStoreName && (
        <div className="text-center font-bold text-sm mb-2 uppercase tracking-tight border-b-2 border-slate-100 pb-2">
          <InlineInput value={data.namaToko} label="Nama Toko" keyName="namaToko" align="center" isBold uppercase />
        </div>
      )}
      
      <div className="flex justify-between items-center gap-2">
        <span className="shrink-0 font-bold">TANGGAL</span>
        <div className="flex-1">
           <InlineInput value={data.tanggal || ''} label="Tanggal" keyName="tanggal" align="right" />
        </div>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="shrink-0 font-bold">WAKTU</span>
        <div className="flex-1">
          <InlineInput value={data.waktu || ''} label="Waktu" keyName="waktu" align="right" />
        </div>
      </div>
      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>

      <div className="text-center mb-1">
        <div className="font-bold uppercase tracking-wider">KODE REFERENSI</div>
        <InlineInput value={data.kodeReferensi || '-'} label="Ref No" keyName="kodeReferensi" align="center" isBold />
      </div>
      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>
      
      <div className="text-center my-4">
        <div className="font-bold underline uppercase tracking-widest text-[#1e293b]">DATA PENERIMA</div>
      </div>

      <div className="w-full flex justify-between items-center gap-1 mb-1">
         <span className="shrink-0 font-bold">BANK TUJUAN</span>
         <div className="flex-1 w-full overflow-hidden">
           <InlineInput value={data.bankTujuan} label="Bank" keyName="bankTujuan" align="right" uppercase />
         </div>
      </div>
      <div className="w-full flex justify-between items-center gap-1 mb-1">
         <span className="shrink-0 font-bold">NO REKENING</span>
         <div className="flex-1 w-full">
           <InlineInput value={data.noRekening} label="No Rekening" keyName="noRekening" align="right" />
         </div>
      </div>
      <div className="w-full flex justify-between items-center gap-1 mb-4">
         <span className="shrink-0 font-bold">PENERIMA</span>
         <div className="flex-1 w-full overflow-hidden">
            <InlineInput value={data.namaPenerima} label="Penerima" keyName="namaPenerima" align="right" uppercase />
         </div>
      </div>

      <div className="text-center mb-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-2 mb-1">
        <span className="shrink-0 font-bold">NOMINAL</span>
        <div className="flex-1">
          <InlineCurrencyInput value={data.nominal} label="Nominal" keyName="nominal" align="right" />
        </div>
      </div>
      {data.showAdminFee && (
        <div className="flex justify-between items-center gap-2 mb-1">
          <span className="shrink-0 font-bold">ADMIN</span>
          <div className="flex-1">
            <InlineCurrencyInput value={data.admin || 0} label="Admin" keyName="admin" align="right" />
          </div>
        </div>
      )}
      
      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-2 font-bold mb-1">
        <span className="shrink-0 font-bold text-base">TOTAL</span>
        <div className="flex-1 text-right">
           <span className="mr-1">Rp</span>
           <span className="text-base font-black">{new Intl.NumberFormat('id-ID').format(total)}</span>
        </div>
      </div>

      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>
      <div className="h-4"></div>
      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>
      
      <div className="text-center mt-6 mb-1">
        <div className="flex items-center justify-center gap-1">
           <span className="font-black tracking-widest italic text-indigo-900 leading-none">** {data.status} **</span>
        </div>
      </div>
      <div className="text-center mb-1 text-[10px] opacity-60 font-medium">
         <InlineInput value={data.footerLine1 || ''} label="Footer 1" keyName="footerLine1" align="center" uppercase />
      </div>
      <div className="text-center font-bold text-slate-800">
         <InlineInput value={data.footerLine2 || ''} label="Footer 2" keyName="footerLine2" align="center" isBold uppercase />
      </div>
    </>
  );

  const renderDigital = () => (
    <div className="flex flex-col gap-0 text-[11px] leading-tight font-mono">
      {data.showStoreName && (
        <>
          <div className="text-center font-bold text-sm mb-1 uppercase tracking-wider">
            <InlineInput value={data.namaToko} label="Nama Toko" keyName="namaToko" align="center" isBold uppercase />
          </div>
          <div className="text-center select-none opacity-40 -mt-1">{'='.repeat(32)}</div>
        </>
      )}
      
      <div className="px-1 space-y-0.5">
        <div className="flex justify-between uppercase">
          <span className="shrink-0 select-none opacity-80 font-bold">TANGGAL</span>
          <div className="flex-1 w-full truncate text-right">
             <InlineInput value={data.tanggal || ''} label="Tanggal" keyName="tanggal" align="right" />
          </div>
        </div>
        <div className="flex justify-between uppercase">
          <span className="shrink-0 select-none opacity-80 font-bold">WAKTU</span>
          <div className="flex-1 w-full truncate text-right">
             <InlineInput value={data.waktu || ''} label="Waktu" keyName="waktu" align="right" />
          </div>
        </div>
      </div>
      
      <div className="text-center select-none opacity-30 my-0.5">{'-'.repeat(32)}</div>
      
      <div className="text-center font-bold uppercase mb-0.5 select-none opacity-70 text-[10px]">KODE REFERENSI</div>
      <div className="text-center break-all font-bold text-xs px-1">
        <InlineInput value={data.kodeReferensi || ''} label="Ref No" keyName="kodeReferensi" align="center" isBold uppercase />
      </div>
      
      <div className="text-center select-none opacity-30 my-0.5">{'-'.repeat(32)}</div>
      
      <div className="text-center font-black uppercase mb-1 select-none opacity-70 text-[10px] tracking-wider">DATA PENERIMA</div>
      <div className="px-1 space-y-0.5">
        <div className="flex justify-between gap-2 uppercase">
          <span className="shrink-0 select-none opacity-80 font-bold">BANK TUJUAN</span>
          <div className="flex-1 w-full truncate text-right font-bold">
             <InlineInput value={data.bankTujuan} label="Bank" keyName="bankTujuan" align="right" uppercase />
          </div>
        </div>
        <div className="flex justify-between gap-2 uppercase">
          <span className="shrink-0 select-none opacity-80 font-bold tracking-tighter">NO REKENING</span>
          <div className="flex-1 w-full truncate text-right">
             <InlineInput value={data.noRekening} label="No Rekening" keyName="noRekening" align="right" />
          </div>
        </div>
        <div className="flex justify-between gap-2 uppercase">
          <span className="shrink-0 select-none opacity-80 font-bold">PENERIMA</span>
          <div className="flex-1 w-full truncate text-right">
             <InlineInput value={data.namaPenerima} label="Penerima" keyName="namaPenerima" align="right" isBold uppercase />
          </div>
        </div>
      </div>
      
      <div className="text-center select-none opacity-30 my-0.5">{'-'.repeat(32)}</div>
      
      <div className="px-1 space-y-0.5">
        <div className="flex justify-between font-bold uppercase text-[12px]">
          <span className="select-none opacity-90">NOMINAL</span>
          <div className="w-28 text-right">
             <InlineCurrencyInput value={data.nominal} label="Nominal" keyName="nominal" align="right" isBold />
          </div>
        </div>
        {data.showAdminFee && (
          <div className="flex justify-between font-bold uppercase text-[12px]">
            <span className="select-none opacity-90">ADMIN</span>
            <div className="w-28 text-right">
               <InlineCurrencyInput value={data.admin || 0} label="Admin" keyName="admin" align="right" isBold />
            </div>
          </div>
        )}
      </div>
      
      <div className="text-center select-none opacity-40 pt-0.5">{'='.repeat(32)}</div>
      <div className="flex justify-between font-bold uppercase px-1 py-1">
        <span className="select-none text-xs">TOTAL</span>
        <div className="w-32 text-right">
           <span className="mr-1 text-xs">Rp</span>
           <span className="text-sm">{new Intl.NumberFormat('id-ID').format(total)}</span>
        </div>
      </div>
      <div className="text-center select-none opacity-40 -mt-1 pb-1">{'='.repeat(32)}</div>
      
      <div className="text-center space-y-0.5 px-1 py-2">
        <div className="font-bold uppercase tracking-wider text-[13px]">
           <div className="flex items-center justify-center gap-1">
              <InlineInput value={data.status || 'TRANSAKSI BERHASIL'} label="Status" keyName="status" align="center" isBold uppercase />
           </div>
        </div>
        <div className="text-[10px] uppercase opacity-60">
           <InlineInput value={data.footerLine1 || ''} label="Footer 1" keyName="footerLine1" align="center" uppercase />
        </div>
        <div className="font-bold text-base mt-1 uppercase tracking-widest leading-none">
           <InlineInput value="TERIMA KASIH" label="Footer" keyName="status" align="center" isBold />
        </div>
        <div className="text-[10px] opacity-40 uppercase mt-0.5">
           <div className="flex items-center justify-center gap-1">
             <span className="select-none">TID:</span>
             <div className="w-20">
               <InlineInput value={data.tid || 'NK-000'} label="TID" keyName="tid" align="left" uppercase />
             </div>
           </div>
        </div>
      </div>
    </div>
  );

  const PopupEditor = ({ field, onSave, onCancel }: { field: EditingField, onSave: (val: any) => void, onCancel: () => void }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState(
      field.type === 'number' 
        ? (field.value === 0 ? '' : field.value.toString())
        : (field.value || '')
    );

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const originalValue = el.value;
      const cursorPosition = el.selectionStart || 0;
      
      // Digits only
      const cleanVal = originalValue.replace(/[^0-9]/g, '');
      setInputValue(cleanVal);

      // Restore cursor position logic for formatted input
      if (field.type === 'number') {
        setTimeout(() => {
          if (!inputRef.current) return;
          
          const formatted = new Intl.NumberFormat('id-ID').format(parseInt(cleanVal || '0', 10));
          const isDeleting = originalValue.length < (inputRef.current.dataset.lastLength ? parseInt(inputRef.current.dataset.lastLength) : 0);
          
          if (!cleanVal) {
            inputRef.current.setSelectionRange(0, 0);
          } else if (isDeleting && cursorPosition >= originalValue.length) {
            // If deleting at the end, keep it at the end
            const newLen = inputRef.current.value.length;
            inputRef.current.setSelectionRange(newLen, newLen);
          } else {
            // For general typing, we try to match the digit position
            // But to simplify and meet user request of "focus at back when delete"
            // we'll just stick to a reliable end-focus if it feels like a natural deletion
            const newLen = inputRef.current.value.length;
            inputRef.current.setSelectionRange(newLen, newLen);
          }
          
          inputRef.current.dataset.lastLength = originalValue.length.toString();
        }, 0);
      }
    };

    const formattedDisplay = () => {
      if (field.type !== 'number') return inputValue;
      if (!inputValue) return '';
      return new Intl.NumberFormat('id-ID').format(parseInt(inputValue, 10));
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
        >
          <div className="bg-brand-600 p-6 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {field.type === 'number' ? <DollarSign size={20} /> : <Hash size={20} />}
              </div>
              <div>
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest leading-none mb-1">Koreksi Data</p>
                <h3 className="text-sm font-black uppercase tracking-widest">{field.label}</h3>
              </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95">
              <X size={24} />
            </button>
          </div>

          <div className="p-8">
            <div className="relative group">
              {field.type === 'number' && (
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xl">Rp</span>
              )}
              <input
                ref={inputRef}
                autoFocus
                inputMode={field.type === 'number' ? 'numeric' : 'text'}
                type="text"
                value={field.type === 'number' ? formattedDisplay() : inputValue}
                onChange={(e) => {
                  if (field.type === 'number') {
                    handleNumericChange(e);
                  } else {
                    setInputValue(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const finalVal = field.type === 'number' ? parseInt(inputValue || '0', 10) : inputValue;
                    onSave(finalVal);
                  }
                  if (e.key === 'Escape') onCancel();
                }}
                className={`w-full ${field.type === 'number' ? 'pl-16' : 'px-6'} py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-display font-black text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white transition-all`}
                placeholder={`Masukkan ${field.label}...`}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button 
                onClick={onCancel}
                className="py-4 rounded-2xl text-xs font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest active:scale-95"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  const finalVal = field.type === 'number' ? parseInt(inputValue || '0', 10) : inputValue;
                  onSave(finalVal);
                }}
                className="py-4 rounded-2xl bg-brand-600 text-white text-xs font-black shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-[0.98]"
              >
                <Check size={18} />
                Simpan
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <>
      <div 
        ref={ref}
        className={`relative w-[320px] max-w-full bg-white shadow-xl shadow-slate-200/50 border-t-4 border-brand-600 print:w-[58mm] print:shadow-none print:border-none print:p-0 mx-auto overflow-hidden ${className}`} 
        style={{ fontFamily }}
      >
        <div className="p-4 md:p-5 pb-6">
          <div className="receipt-content flex flex-col gap-0.5 relative z-10 bg-white">
          
          {/* Logo Section */}
          {logoType !== 'none' && (
            <div className="flex flex-col items-center mb-4 pt-2">
              {logoType === 'full' && (
                <div className="mb-2 relative">
                   <div className="w-12 h-12 border-2 border-black rounded-lg flex items-center justify-center relative">
                      <div className="text-black transform -rotate-12">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                      </div>
                      <div className="absolute -top-1 -right-1 bg-white">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="black" stroke="black" strokeWidth="1"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      </div>
                   </div>
                </div>
              )}
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-tighter leading-none text-black">
                  ALFATH<span className="opacity-50">PULSA</span>
                </h1>
                {logoType === 'full' && (
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] mt-1 opacity-40">Digital Payment</p>
                )}
              </div>
            </div>
          )}

          {data.logoUrl && logoType === 'none' && (
            <div className="flex justify-center mb-4 no-print-logo">
              <img src={data.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
          )}
          {layout === 'standard' && renderStandard()}
          {layout === 'modern' && renderModern()}
          {layout === 'bank' && renderBank()}
          {layout === 'elegant' && renderElegant()}
          {layout === 'pro' && renderPro()}
          {layout === 'digital' && renderDigital()}
          </div>
        </div>
        
        {/* Paper Jagged Edge Representation */}
        <div className="absolute -bottom-[14px] left-0 right-0 h-[14px] bg-white print:hidden pointer-events-none z-0" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>
      </div>

      {/* Popup Editor Modal */}
      <AnimatePresence>
        {editingField && (
          <PopupEditor 
            field={editingField} 
            onSave={saveEdit} 
            onCancel={() => setEditingField(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
});

ReceiptPreview.displayName = 'ReceiptPreview';

