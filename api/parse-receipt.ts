import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, mimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY belum diatur di Vercel Environment Variables." });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Anda adalah AI sistem ekstraksi data struk transfer Alfathprint.
      Analisis gambar ini dan keluarkan data JSON dengan format:
      {
        "tanggal": "YYYY-MM-DD",
        "waktu": "HH:MM:SS",
        "kodeReferensi": "ID Transaksi / Ref",
        "bankTujuan": "Nama Bank (HURUF KAPITAL)",
        "noRekening": "Nomor Rekening",
        "namaPenerima": "Nama Penerima (HURUF KAPITAL)",
        "nominal": 0
      }
      Pastikan nominal adalah angka saja tanpa titik/koma.
    `;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
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

    res.status(200).json(JSON.parse(result.text || "{}"));
  } catch (error: any) {
    console.error("Vercel AI Error:", error);
    res.status(500).json({ error: error.message || "Gagal memproses gambar." });
  }
}
