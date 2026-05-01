import { GoogleGenAI } from "@google/genai";

function getAI(apiKey: string) {
  return new GoogleGenAI({ 
    apiKey: apiKey.trim() 
  });
}

export async function parseReceiptFromBase64(base64Data: string, mimeType: string, customKeys?: string) {
  // Convert customKeys string (comma separated) into an array
  const keyList: string[] = [];
  
  if (customKeys && customKeys.trim() !== "") {
    customKeys.split(",").forEach(k => {
      const trimmed = k.trim();
      if (trimmed && trimmed !== "undefined") keyList.push(trimmed);
    });
  }
  
  // If no custom keys, try env vars
  if (keyList.length === 0) {
    // @ts-ignore
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (envKey) keyList.push(envKey);
    else {
      try {
        // @ts-ignore
        const pKey = process.env.GEMINI_API_KEY;
        if (pKey) keyList.push(pKey);
      } catch (e) {}
    }
  }

  if (keyList.length === 0) {
    throw new Error("API Key tidak ditemukan. Silakan masukkan satu atau lebih API Key (pisahkan dengan koma) di menu Pengaturan.");
  }

  let lastError: any = null;

  // Try each key in the list
  for (let i = 0; i < keyList.length; i++) {
    const currentKey = keyList[i];
    try {
      const client = getAI(currentKey);
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            parts: [
              { text: `Ekstrak data Bukti Transfer Bank (JSON murni):
                - tanggal (YYYY-MM-DD)
                - waktu (HH:mm)
                - kodeReferensi (Ref No/ID/RRN)
                - bankTujuan (BCA/BRI/Mandiri/dsb)
                - noRekening (Angka saja)
                - namaPenerima (HURUF KAPITAL)
                - nominal (Jumlah Transfer Asli, angka bulat)
                - admin (Biaya Admin, angka bulat, else 0)

                Abaikan total jika nominal dan admin terpisah. Fokus pada akurasi data bank. Sangat cepat.` },
              {
                inlineData: {
                  data: base64Data.split(",")[1],
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      // Handle the response properly for @google/genai SDK
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return JSON.parse(text || "{}");
    } catch (error: any) {
      console.warn(`Key #${i + 1} failed:`, error.message);
      lastError = error;

      let errorMessage = error.message || "";
      if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
        try {
          const jsonStart = errorMessage.indexOf('{');
          const parsed = JSON.parse(errorMessage.substring(jsonStart));
          errorMessage = parsed.error?.message || parsed.message || errorMessage;
        } catch (e) {}
      }

      // If it's NOT a quota error or bad key, stop trying other keys
      const isQuota = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429');
      const isInvalidKey = errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API Key must be set');
      
      if (!isQuota && !isInvalidKey) {
        break; 
      }
      
      if (i < keyList.length - 1) {
        console.log("Switching to next API Key...");
        continue; 
      }
    }
  }

  // If we reach here, all keys failed
  const error = lastError;
  let errorMessage = error.message || "Gagal memproses gambar struk.";
  
  if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
    try {
      const jsonStart = errorMessage.indexOf('{');
      const parsed = JSON.parse(errorMessage.substring(jsonStart));
      if (parsed.error?.message) errorMessage = parsed.error.message;
      else if (parsed.message) errorMessage = parsed.message;
    } catch (e) {}
  }

  if (errorMessage.includes('API Key must be set') || errorMessage.includes('API_KEY_INVALID')) {
    throw new Error("API Key tidak terbaca/salah. Silakan masukkan API Key Anda secara manual di menu Pengaturan aplikasi.");
  }
  if (errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429')) {
    const keyCount = keyList.length;
    throw new Error(`Semua ${keyCount} API Key Anda sudah mencapai limit. Silakan tunggu 1 menit atau tambahkan Key baru di Pengaturan.`);
  }
  
  throw new Error(errorMessage);
}

export async function testGeminiKey(customKeys: string) {
  const keyList: string[] = [];
  if (customKeys && customKeys.trim() !== "") {
    customKeys.split(",").forEach(k => {
      const trimmed = k.trim();
      if (trimmed && trimmed !== "undefined") keyList.push(trimmed);
    });
  }

  if (keyList.length === 0) throw new Error("API Key kosong");

  let lastError: any = null;
  for (let i = 0; i < keyList.length; i++) {
    try {
      const client = getAI(keyList[i]);
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "Say 'ok'"
      });
      return !!response.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error: any) {
      lastError = error;
    }
  }

  let msg = lastError?.message || "Koneksi gagal";
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
