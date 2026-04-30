import { GoogleGenAI } from "@google/genai";

function getAI(customKey?: string) {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey });
}

export async function parseReceiptFromBase64(base64Data: string, mimeType: string, customKey?: string) {
  try {
    const ai = getAI(customKey);
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: `Ekstrak data transaksi dari gambar bukti transfer bank ini secara akurat.
            Output harus berupa JSON murni dengan key: 
            - tanggal (format: YYYY-MM-DD)
            - waktu (format: HH:mm)
            - kodeReferensi (cari juga "No. Referensi", "ID Transaksi", dsb)
            - bankTujuan (nama bank tujuan transfer)
            - noRekening (nomor rekening penerima)
            - namaPenerima (nama lengkap penerima)
            - nominal (angka murni, ambil dari "Jumlah", "Total", "Nominal Transfer", "Jumlah Bayar", "Total Bayar", atau "Total Transfer")

            Pastikan nominal adalah angka bulat tanpa simbol mata uang. Abaikan biaya admin jika tertulis terpisah.` },
          {
            inlineData: {
              data: base64Data.split(",")[1],
              mimeType: mimeType
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "Gagal memproses gambar struk.");
  }
}

export async function parseReceipt(file: File, customKey?: string) {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;
  return parseReceiptFromBase64(base64Data, mimeType, customKey);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
