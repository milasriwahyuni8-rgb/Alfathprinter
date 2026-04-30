export interface HistoryEntry {
  id: string;
  data: ReceiptData;
  timestamp: number;
}

export interface ReceiptData {
  namaToko: string;
  cabang?: string;
  logoUrl?: string;
  tanggal: string;
  waktu: string;
  kodeReferensi: string;
  bankTujuan: string;
  noRekening: string;
  namaPenerima: string;
  nominal: number;
  admin: number;
  status: string;
  footerLine1: string;
  footerLine2: string;
  tid: string;
  namaPengirim?: string;
  showPengirim?: boolean;
  useFallbackAI?: boolean;
  aiEnabled?: boolean;
  scanEngine?: 'ai' | 'local';
}
