export async function parseReceiptFromBase64(base64Data: string, mimeType: string) {
  const response = await fetch("/api/parse-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data,
      mimeType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Gagal memproses gambar melalui server.");
  }

  return response.json();
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
