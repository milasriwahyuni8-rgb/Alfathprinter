import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, mimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set on Vercel environment variables." });
    }

    const genAI = new GoogleGenAI({ apiKey }) as any;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
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
    const text = response.text();
    res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    console.error("Vercel AI Error:", error);
    res.status(500).json({ error: error.message || "Gagal memproses gambar." });
  }
}
