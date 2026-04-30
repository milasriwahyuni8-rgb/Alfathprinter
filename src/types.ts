export interface ReceiptData {
  namaToko: string;
  logoUrl?: string; // Tambahan logo
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
}
