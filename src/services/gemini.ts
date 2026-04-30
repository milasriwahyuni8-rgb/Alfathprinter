import { GoogleGenAI } from "@google/genai";

function getAI(customKey?: string) {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key tidak ditemukan.");
  return new GoogleGenAI(apiKey);
}

export async function parseReceiptFromBase64(base64Data: string, mimeType: string, customKey?: string) {
  try {
    const ai = getAI(customKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
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
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const response = await result.response;
    return JSON.parse(response.text() || "{}");
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    let errorMessage = error.message || "Gagal memproses gambar struk.";
    
    if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
      try {
        const jsonStart = errorMessage.indexOf('{');
        const parsed = JSON.parse(errorMessage.substring(jsonStart));
        if (parsed.error?.message) errorMessage = parsed.error.message;
        else if (parsed.message) errorMessage = parsed.message;
      } catch (e) {}
    }

    if (errorMessage.includes('API_KEY_INVALID')) {
      throw new Error("API Key Anda tidak valid. Periksa kembali di Google AI Studio.");
    }
    if (errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429')) {
      throw new Error("Limit tercapai! Akun Google Anda (Free Tier) sudah mencapai batas permintaan per menit (15 RPM). Silakan tunggu 1 menit.");
    }
    if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('entity')) {
      throw new Error("Model gemini-1.5-flash tidak tersedia untuk Key ini. Pastikan akun Google Cloud Anda aktif.");
    }
    
    throw new Error(errorMessage);
  }
}

export async function testGeminiKey(customKey: string) {
  try {
    const ai = getAI(customKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Say 'ok'");
    const response = await result.response;
    return !!response.text();
  } catch (error: any) {
    console.error("Test Key Error:", error);
    let msg = error.message || "Koneksi gagal";
    if (typeof msg === 'string' && msg.includes('{')) {
      try {
        const jsonStart = msg.indexOf('{');
        const parsed = JSON.parse(msg.substring(jsonStart));
        if (parsed.error?.message) msg = parsed.error.message;
        else if (parsed.message) msg = parsed.message;
      } catch (e) {}
    }
    throw new Error(msg);
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
