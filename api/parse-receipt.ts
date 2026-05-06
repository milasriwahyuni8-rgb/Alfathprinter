import { GoogleGenerativeAI } from "@google/generative-ai";

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    
    const prompt = `Ekstrak data Bukti Transfer Bank (JSON murni):
      - tanggal (YYYY-MM-DD)
      - waktu (HH:mm)
      - kodeReferensi (Ref No/ID/RRN)
      - bankTujuan (BCA/BRI/Mandiri/dsb)
      - noRekening (Angka saja)
      - namaPenerima (HURUF KAPITAL)
      - nominal (Jumlah Transfer Asli, angka bulat)
      - admin (Biaya Admin, angka bulat, else 0)

      Abaikan total jika nominal dan admin terpisah. Fokus pada akurasi data bank.`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          data: base64Data.split(",")[1],
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    res.status(200).json(JSON.parse(response.text() || "{}"));
  } catch (error: any) {
    console.error("Vercel AI Error:", error);
    res.status(500).json({ error: error.message || "Gagal memproses gambar." });
  }
}
