import React from 'react';
import { ReceiptData } from '../types';

interface ReceiptPreviewProps {
  data: ReceiptData;
  onChange: (data: ReceiptData) => void;
  fontFamily?: string;
  className?: string;
  layout?: 'standard' | 'modern' | 'bank';
}

const InlineInput = ({ value, onChange, align = 'left', isBold = false, uppercase = false }: { value: string, onChange: (v: string) => void, align?: string, isBold?: boolean, uppercase?: boolean }) => (
  <input
    value={value}
    onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
    className={`bg-transparent outline-none border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white hover:bg-slate-50 rounded transition-all w-full ${isBold ? 'font-bold' : ''} print:border-none print:bg-transparent print:p-0 my-0`}
    style={{ textAlign: align as any, padding: '2px 4px', margin: '-2px -4px', width: 'calc(100% + 8px)' }}
    spellCheck={false}
  />
);

const InlineCurrencyInput = ({ value, onChange, align = 'right', isBold = false }: { value: number, onChange: (v: number) => void, align?: string, isBold?: boolean }) => {
  const [focused, setFocused] = React.useState(false);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('Rp', 'Rp ');
  };

  return (
    <input
      type="text"
      value={focused ? (value || '') : formatCurrency(value || 0)}
      onChange={(e) => {
         const val = Number(e.target.value.replace(/[^0-9]/g, ''));
         onChange(val);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`bg-transparent outline-none border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white hover:bg-slate-50 rounded transition-all w-full ${isBold ? 'font-bold' : ''} print:border-none print:bg-transparent print:p-0 my-0`}
      style={{ textAlign: align as any, padding: '2px 4px', margin: '-2px -4px', width: 'calc(100% + 8px)' }}
      spellCheck={false}
    />
  );
};

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ data, onChange, fontFamily = 'monospace', className = '', layout = 'standard' }) => {
  const total = data.nominal + data.admin;

  const renderStandard = () => (
    <>
      <div className="text-center font-bold text-base mb-1 uppercase">
        <InlineInput value={data.namaToko} onChange={v => onChange({...data, namaToko: v})} align="center" isBold uppercase />
      </div>
      
      <div className="text-center mb-1 select-none font-bold">
        {'='.repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-2">
        <span className="shrink-0 select-none">TANGGAL</span>
        <div className="flex-1">
           <InlineInput value={data.tanggal} onChange={v => onChange({...data, tanggal: v})} align="right" />
        </div>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="shrink-0 select-none">WAKTU</span>
        <div className="flex-1">
          <InlineInput value={data.waktu} onChange={v => onChange({...data, waktu: v})} align="right" />
        </div>
      </div>
      
      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>

      <div className="text-center select-none font-bold pt-1">KODE REFERENSI</div>
      <div className="text-center break-all font-bold">
         <InlineInput value={data.kodeReferensi} onChange={v => onChange({...data, kodeReferensi: v})} align="center" isBold />
      </div>

      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>

      <div className="text-center mb-1 select-none font-bold pt-1">DATA PENERIMA</div>
      <div className="w-full flex justify-between items-center gap-1">
         <span className="shrink-0 whitespace-nowrap select-none">BANK TUJUAN</span>
         <div className="flex-1 w-full overflow-hidden">
           <InlineInput value={data.bankTujuan} onChange={v => onChange({...data, bankTujuan: v})} align="right" />
         </div>
      </div>
      <div className="w-full flex justify-between items-center gap-1">
         <span className="shrink-0 whitespace-nowrap select-none">NO REKENING</span>
         <div className="flex-1 w-full">
           <InlineInput value={data.noRekening} onChange={v => onChange({...data, noRekening: v})} align="right" />
         </div>
      </div>
      <div className="w-full flex justify-between items-center gap-1">
         <span className="shrink-0 whitespace-nowrap select-none">PENERIMA</span>
         <div className="flex-1 w-full overflow-hidden">
            <InlineInput value={data.namaPenerima} onChange={v => onChange({...data, namaPenerima: v})} align="right" />
         </div>
      </div>

      <div className="text-center my-1 select-none font-bold">
        {'-'.repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-2">
        <span className="shrink-0 select-none">NOMINAL</span>
        <div className="flex-1">
          <InlineCurrencyInput value={data.nominal} onChange={v => onChange({...data, nominal: v})} align="right" />
        </div>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="shrink-0 select-none">ADMIN</span>
        <div className="flex-1">
          <InlineCurrencyInput value={data.admin} onChange={v => onChange({...data, admin: v})} align="right" />
        </div>
      </div>

      <div className="text-center my-1 select-none font-bold">
        {'='.repeat(32)}
      </div>

      <div className="flex justify-between items-center gap-2 font-bold">
        <span className="shrink-0 select-none">TOTAL</span>
        <div className="flex-1">
          <InlineCurrencyInput value={total} onChange={() => {}} align="right" isBold />
        </div>
      </div>

      <div className="text-center my-1 select-none font-bold">
        {'='.repeat(32)}
      </div>
      
      <div className="text-center mt-2 mb-1 font-bold">
        <div className="flex items-center justify-center gap-1">
           <span className="select-none">**</span>
           <InlineInput value={data.status} onChange={v => onChange({...data, status: v})} align="center" isBold uppercase />
           <span className="select-none">**</span>
        </div>
      </div>
      <div className="text-center mb-1">
         <InlineInput value={data.footerLine1} onChange={v => onChange({...data, footerLine1: v})} align="center" uppercase />
      </div>
      <div className="text-center font-bold">
         <InlineInput value={data.footerLine2} onChange={v => onChange({...data, footerLine2: v})} align="center" isBold uppercase />
      </div>
      <div className="text-center mt-2 flex items-center justify-center gap-1">
         <span className="select-none">TID:</span>
         <div className="w-[100px]">
           <InlineInput value={data.tid || ''} onChange={v => onChange({...data, tid: v})} align="left" uppercase />
         </div>
      </div>
    </>
  );

  const renderModern = () => (
    <>
      <div className="text-center font-bold text-base mb-1 uppercase">
        <InlineInput value={data.namaToko} onChange={v => onChange({...data, namaToko: v})} align="center" isBold uppercase />
      </div>
      
      <div className="text-center my-1 select-none font-bold text-xs tracking-[-1px]">
        {'===================================='}
      </div>
      <div className="text-center font-bold tracking-widest my-1 uppercase">
        BUKTI TRANSFER
      </div>
      <div className="text-center my-1 select-none font-bold text-xs tracking-[-1px]">
        {'===================================='}
      </div>

      <div className="flex items-center gap-2 font-bold mb-4 mt-2">
        <span className="shrink-0 select-none">REF</span>
        <div className="flex-1">
           <InlineInput value={data.kodeReferensi} onChange={v => onChange({...data, kodeReferensi: v})} align="left" isBold uppercase />
        </div>
      </div>

      <div className="font-bold mb-1 uppercase">KEPADA:</div>
      <div className="flex items-center gap-2 font-bold">
         <span className="shrink-0 w-20 select-none">PENERIMA</span>
         <div className="flex-1">
            <InlineInput value={data.namaPenerima} onChange={v => onChange({...data, namaPenerima: v})} align="right" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center gap-2 font-bold">
         <span className="shrink-0 w-20 select-none">BANK</span>
         <div className="flex-1">
           <InlineInput value={data.bankTujuan} onChange={v => onChange({...data, bankTujuan: v})} align="right" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center gap-2 font-bold mb-4">
         <span className="shrink-0 w-20 select-none">REK</span>
         <div className="flex-1">
           <InlineInput value={data.noRekening} onChange={v => onChange({...data, noRekening: v})} align="right" isBold uppercase />
         </div>
      </div>

      <div className="bg-gray-200 print:bg-gray-200/50 print:border-y print:border-black print:border-dashed py-2 px-3 flex flex-col items-center justify-center font-bold my-4 rounded-sm">
         <span className="uppercase tracking-widest text-[12px]">TOTAL BAYAR</span>
         <div className="w-full mt-1 text-base">
           <InlineCurrencyInput value={total} onChange={() => {}} align="center" isBold />
         </div>
      </div>

      <div className="text-center mt-6 mb-1 font-bold">
        <div className="flex items-center justify-center gap-1">
           <span className="select-none">**</span>
           <InlineInput value={data.status} onChange={v => onChange({...data, status: v})} align="center" isBold uppercase />
           <span className="select-none">**</span>
        </div>
      </div>
      <div className="text-center mb-1">
         <InlineInput value={data.footerLine1} onChange={v => onChange({...data, footerLine1: v})} align="center" uppercase />
      </div>
      <div className="text-center font-bold mt-2">
         <InlineInput value={data.footerLine2} onChange={v => onChange({...data, footerLine2: v})} align="center" isBold uppercase />
      </div>
      <div className="text-center mt-2 flex items-center justify-center gap-1">
         <span className="select-none">TID:</span>
         <div className="w-[100px]">
           <InlineInput value={data.tid || ''} onChange={v => onChange({...data, tid: v})} align="left" uppercase />
         </div>
      </div>
    </>
  );

  const renderBank = () => (
    <>
      <div className="text-center font-bold text-base mb-1 uppercase">
        <InlineInput value={data.namaToko} onChange={v => onChange({...data, namaToko: v})} align="center" isBold uppercase />
      </div>
      <div className="text-center font-bold mb-4 uppercase">
        BUKTI TRANSAKSI
      </div>

      <div className="flex items-center font-bold">
         <div className="flex-1">
           <InlineInput value={data.tanggal + ' ' + data.waktu} onChange={v => {
             const [t, w] = v.split(' ');
             onChange({...data, tanggal: t || '', waktu: w || ''});
           }} align="left" isBold uppercase />
         </div>
      </div>
      
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">TID TERMINAL</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.tid || ''} onChange={v => onChange({...data, tid: v})} align="left" isBold uppercase />
         </div>
      </div>

      <div className="flex items-center font-bold mb-4">
         <span className="shrink-0 w-[120px] select-none">NO REF</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.kodeReferensi} onChange={v => onChange({...data, kodeReferensi: v})} align="left" isBold uppercase />
         </div>
      </div>

      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">TRANSAKSI</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={'TRANSFER BANK'} onChange={() => {}} align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">BANK TUJUAN</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.bankTujuan} onChange={v => onChange({...data, bankTujuan: v})} align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">NO REKENING</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.noRekening} onChange={v => onChange({...data, noRekening: v})} align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">PENERIMA</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.namaPenerima} onChange={v => onChange({...data, namaPenerima: v})} align="left" isBold uppercase />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">JUMLAH</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineCurrencyInput value={data.nominal} onChange={v => onChange({...data, nominal: v})} align="left" isBold />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">BIAYA ADMIN</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineCurrencyInput value={data.admin} onChange={v => onChange({...data, admin: v})} align="left" isBold />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">TOTAL</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineCurrencyInput value={total} onChange={() => {}} align="left" isBold />
         </div>
      </div>
      <div className="flex items-center font-bold">
         <span className="shrink-0 w-[120px] select-none">STATUS</span>
         <span className="select-none mr-2">:</span>
         <div className="flex-1">
           <InlineInput value={data.status === 'TRANSAKSI BERHASIL' ? 'SUKSES' : 'PENDING'} onChange={() => {}} align="left" isBold uppercase />
         </div>
      </div>

      <div className="text-center font-bold mt-8 mb-1">
         <InlineInput value={data.footerLine2} onChange={v => onChange({...data, footerLine2: v})} align="center" isBold />
      </div>
      <div className="text-center mb-1">
         <InlineInput value={data.footerLine1} onChange={v => onChange({...data, footerLine1: v})} align="center" uppercase />
      </div>
    </>
  );

  return (
    <div className={`relative w-[300px] max-w-full bg-white shadow-xl md:shadow-2xl p-6 text-[12px] leading-[1.3] text-black border-t-8 border-indigo-600 print:w-[58mm] print:shadow-none print:border-none print:p-0 mx-auto overflow-hidden ${className}`} style={{ fontFamily }}>
      
      <div className="receipt-content flex flex-col gap-[2px] relative z-10 bg-white">
        {data.logoUrl && (
          <div className="flex justify-center mb-4 no-print-logo">
            <img src={data.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
          </div>
        )}
        {layout === 'standard' && renderStandard()}
        {layout === 'modern' && renderModern()}
        {layout === 'bank' && renderBank()}
      </div>
      
      {/* Paper Jagged Edge Representation */}
      <div className="absolute -bottom-[14px] left-0 right-0 h-[14px] bg-white print:hidden pointer-events-none z-0" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>
    </div>
  );
};

