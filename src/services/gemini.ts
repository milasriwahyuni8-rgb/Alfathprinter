import { GoogleGenAI } from "@google/genai";

export async function parseReceipt(file: File) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;

  const prompt = `
    Anda adalah sistem ekstraksi data yang sangat akurat.
    Analisis gambar struk/bukti transfer ini dan ekstrak detail berikut.
    Kembalikan HANYA objek JSON dengan key berikut (tanpa markdown, tanpa teks tambahan):
    {
      "tanggal": "YYYY-MM-DD (ambil dari tanggal transaksi)",
      "waktu": "HH:MM:SS (ambil dari waktu transaksi)",
      "kodeReferensi": "Nomor referensi / ID Transaksi",
      "bankTujuan": "Nama bank penerima (misal: BANK SEABANK INDONESIA)",
      "noRekening": "Nomor rekening penerima",
      "namaPenerima": "Nama penerima dana",
      "nominal": 70000 (angka saja, tanpa Rp/titik koma)
    }
    
    Jika ada data yang tidak ditemukan, isi dengan string kosong ("") atau 0 untuk nominal.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data.split(",")[1], // Remove the data:image/png;base64, prefix
            mimeType: mimeType
          }
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw error;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
