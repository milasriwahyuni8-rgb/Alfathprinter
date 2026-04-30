import { createWorker } from 'tesseract.js';
import { ReceiptData } from '../types';

export async function scanReceiptLocally(base64Data: string): Promise<Partial<ReceiptData>> {
  const worker = await createWorker('ind'); // Menggunakan bahasa Indonesia
  
  try {
    const { data: { text } } = await worker.recognize(base64Data);
    console.log('Local OCR Raw Text:', text);

    const lines = text.split('\n');
    const result: Partial<ReceiptData> = {
      tanggal: new Date().toISOString().split('T')[0],
      waktu: new Date().toTimeString().split(' ')[0],
    };

    // 1. Cari Nominal (Mencari angka besar setelah kata kunci)
    const nominalMatch = text.match(/(?:TOTAL|JUMLAH|NOMINAL|TRANSFER|BAYAR)[\s\S]*?(?:RP|[^\d])\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i);
    if (nominalMatch) {
      result.nominal = parseInt(nominalMatch[1].replace(/\./g, '').replace(/,/g, ''));
    }

    // 2. Cari Rekening (Deretan angka 10-16 digit)
    const rekMatch = text.match(/\b\d{10,16}\b/);
    if (rekMatch) {
      result.noRekening = rekMatch[0];
    }

    // 3. Cari Bank (Daftar bank populer)
    const banks = ['BCA', 'BRI', 'MANDIRI', 'BNI', 'BSI', 'CIMB', 'DANAMON', 'PERMATA', 'SEA BANK', 'DANA', 'OVO', 'GOPAY', 'NOBU', 'QRIS'];
    for (const bank of banks) {
      if (text.toUpperCase().includes(bank)) {
        result.bankTujuan = bank;
        break;
      }
    }

    // 4. Cari Nama (Biasanya setelah kata PENERIMA atau TO)
    const nameMatch = text.match(/(?:PENERIMA|KEPADA|TO|NAME)\s*[:\-]?\s*([A-Z\s]{3,20})/i);
    if (nameMatch) {
      result.namaPenerima = nameMatch[1].trim();
    }

    // 5. Cari Ref
    const refMatch = text.match(/(?:REF|NO\.?)\s*[:\-]?\s*([A-Z0-9]{8,20})/i);
    if (refMatch) {
      result.kodeReferensi = refMatch[1];
    }

    await worker.terminate();
    return result;
  } catch (error) {
    console.error('Local OCR Error:', error);
    await worker.terminate();
    return {};
  }
}
