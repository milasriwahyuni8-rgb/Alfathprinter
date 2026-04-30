import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseReceiptFromBase64(base64Data: string, mimeType: string) {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: "Ekstrak data JSON dari struk ini. Format: {tanggal, waktu, kodeReferensi, bankTujuan, noRekening, namaPenerima, nominal}" },
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

export async function parseReceipt(file: File) {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;
  return parseReceiptFromBase64(base64Data, mimeType);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
