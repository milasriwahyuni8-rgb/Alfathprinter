import { ReceiptData } from "../types";

const getRasterImage = async (url: string) => {
  try {
    return await new Promise<Uint8Array | null>((resolve) => {
      const img = new Image();
      // Handle CORS for external URLs
      if (url.startsWith('http')) {
        img.crossOrigin = "Anonymous";
      }
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxWidth = 384; // Standard 58mm printer width in pixels
          let w = img.width;
          let h = img.height;
          
          if (w > maxWidth) {
            h = Math.floor(h * (maxWidth / w));
            w = maxWidth;
          }
          
          // Width must be multiple of 8 for bits
          w = Math.floor(w / 8) * 8;
          if (w <= 0) {
            console.warn("Invalid image width after scaling");
            return resolve(null);
          }
          
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          
          const imageData = ctx.getImageData(0, 0, w, h);
          const pixels = imageData.data;
          
          const bytesPerRow = w / 8;
          const raster = new Uint8Array(bytesPerRow * h);
          
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              // Simple grayscale + threshold (inverted for printer: black is 1)
              const brightness = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
              // If alpha is low, treat as white
              const alpha = pixels[i + 3];
              if (alpha > 128 && brightness < 150) {
                raster[y * bytesPerRow + Math.floor(x / 8)] |= (0x80 >> (x % 8));
              }
            }
          }
          
          const xL = bytesPerRow % 256;
          const xH = Math.floor(bytesPerRow / 256);
          const yL = h % 256;
          const yH = Math.floor(h / 256);
          
          // GS v 0 m xL xH yL yH d1...dk
          const header = new Uint8Array([0x1D, 0x76, 0x30, 0, xL, xH, yL, yH]);
          const result = new Uint8Array(header.length + raster.length);
          result.set(header);
          result.set(raster, header.length);
          console.log(`Raster image generated: ${w}x${h}, Total bytes: ${result.length}`);
          resolve(result);
        } catch (e) {
          console.error("Canvas processing error:", e);
          resolve(null);
        }
      };
      
      img.onerror = (e) => {
        console.error("Image load failed for URL:", url, e);
        resolve(null);
      };
      
      img.src = url;
    });
  } catch (e) {
    console.error("Image rasterization process error:", e);
    return null;
  }
};

export const printViaBluetooth = async (data: ReceiptData, layout: string = 'standard', logoType: 'full' | 'text' | 'none' = 'full') => {
  let device: any = null;
  try {
     const nav = navigator as any;
     if (!nav.bluetooth) {
         throw new Error("Web Bluetooth tidak didukung. Gunakan Chrome di Android.");
     }

     device = await nav.bluetooth.requestDevice({
       acceptAllDevices: true,
       optionalServices: [
         '000018f0-0000-1000-8000-00805f9b34fb', 
         '0000e781-0000-1000-8000-00805f9b34fb', 
         '4953544c-4a43-4e4c-5353-445054323232'
       ]
     });
     
     const server = await device.gatt?.connect();
     if (!server) throw new Error("Gagal terhubung ke server Bluetooth.");

     // Stabilization delay
     await new Promise(resolve => setTimeout(resolve, 500));

     const services = await server.getPrimaryServices();
     let char = null;

     for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const c of characteristics) {
           if (c.properties.write || c.properties.writeWithoutResponse) {
              char = c;
              break;
           }
        }
        if (char) break;
     }

     if (!char) throw new Error("Printer tidak mendukung pengiriman data langsung.");

     // Characteristic selection delay
     await new Promise(resolve => setTimeout(resolve, 200));

     const encoder = new TextEncoder();
     const esc = {
        init: [0x1B, 0x40],
        center: [0x1B, 0x61, 1],
        left: [0x1B, 0x61, 0],
        right: [0x1B, 0x61, 2],
        bold: [0x1B, 0x45, 1],
        boldOff: [0x1B, 0x45, 0],
        feed: [0x0A]
     };

     const u = (arr: number[]) => new Uint8Array(arr);
     const line = (text: string) => encoder.encode(text + '\n');
     
     // Helper for aligned text (32 chars width)
     const lv = (l: string, v: string) => {
        const spaces = 32 - l.length - v.length;
        return l + (spaces > 0 ? " ".repeat(spaces) : " ") + v;
     };

     let steps: Uint8Array[] = [u(esc.init)];

     // --- Logo Section ---
     if (logoType !== 'none') {
        steps.push(u(esc.center));
        
        let imageBytes: Uint8Array | null = null;
        if (logoType === 'full' && data.logoUrl) {
           imageBytes = await getRasterImage(data.logoUrl);
        }
        
        if (imageBytes) {
           steps.push(u([0x1B, 0x33, 0])); 
           steps.push(imageBytes);
           steps.push(u([0x1B, 0x32]));
           steps.push(u(esc.feed));
        } else {
           if (logoType === 'full') {
              steps.push(u(esc.bold), line("ALFATH PULSA"), u(esc.boldOff));
              steps.push(line("Digital Payment"));
              steps.push(line(""));
           }
        }
        
        if (data.showStoreName) {
           steps.push(u(esc.bold), line(data.namaToko.toUpperCase()), u(esc.boldOff));
        }
     }

     if (logoType !== 'none' || data.showStoreName) {
        if (layout === 'standard' || layout === 'modern' || layout === 'digital') {
           steps.push(line('================================'));
        }
     }

     // --- Body Section ---
     steps.push(u(esc.left));
     
     if (layout === 'pro') {
        steps.push(line(lv('TANGGAL', data.tanggal)));
        steps.push(line(lv('WAKTU', data.waktu)));
        steps.push(line('--------------------------------'));
        
        steps.push(u(esc.center), line('KODE REFERENSI'), u(esc.bold), line(data.kodeReferensi || '-'), u(esc.boldOff), line('--------------------------------'), line(''));
        
        steps.push(u(esc.left), line('DATA PENERIMA'));
        steps.push(line(lv('BANK TUJUAN', data.bankTujuan.toUpperCase())));
        steps.push(line(lv('NO REKENING', data.noRekening)));
        steps.push(line(lv('PENERIMA', data.namaPenerima.toUpperCase())));
        steps.push(line('--------------------------------'));
        
        steps.push(line(lv('NOMINAL', `RP ${data.nominal.toLocaleString('id-ID')}`)));
        if (data.showAdminFee) {
           steps.push(line(lv('ADMIN FEE', `RP ${data.admin.toLocaleString('id-ID')}`)));
        }
        steps.push(line('--------------------------------'));
        
        const total = data.nominal + (data.showAdminFee ? data.admin : 0);
        steps.push(u(esc.bold), line(lv('TOTAL', `RP ${total.toLocaleString('id-ID')}`)), u(esc.boldOff));
        steps.push(line('--------------------------------'), line(' '));
        
        steps.push(u(esc.center), line('** TRANSAKSI BERHASIL **'));
        if (data.footerLine1) steps.push(line(data.footerLine1));
        if (data.footerLine2) steps.push(u(esc.bold), line(data.footerLine2), u(esc.boldOff));
     } else if (layout === 'elegant') {
        steps.push(u(esc.center), line('--- OFFICIAL RECEIPT ---'), line(''), u(esc.left));
        steps.push(line(lv('DATE', data.tanggal)));
        steps.push(line(lv('TIME', data.waktu)));
        steps.push(line('--------------------------------'));
        if (data.showPengirim && data.namaPengirim) {
           steps.push(u(esc.bold), line(`SENDER`), u(esc.boldOff), line(data.namaPengirim.toUpperCase()));
        }
        steps.push(u(esc.bold), line(`RECIPIENT`), u(esc.boldOff), line(data.namaPenerima.toUpperCase()));
        steps.push(u(esc.bold), line(`DESTINATION`), u(esc.boldOff), line(`${data.bankTujuan.toUpperCase()} | ${data.noRekening}`));
        
        steps.push(line('--------------------------------'));
        steps.push(line(lv('NOMINAL', `Rp ${data.nominal.toLocaleString('id-ID')}`)));
        if (data.showAdminFee) {
           steps.push(line(lv('ADMIN FEE', `Rp ${data.admin.toLocaleString('id-ID')}`)));
        }
        steps.push(line('--------------------------------'));
        const total = data.nominal + (data.showAdminFee ? data.admin : 0);
        steps.push(u(esc.bold), line(lv('TOTAL', `Rp ${total.toLocaleString('id-ID')}`)), u(esc.boldOff));
        
        steps.push(line(''), u(esc.center), line(`[ ${data.status.toUpperCase()} ]`));
        if (data.footerLine1) steps.push(line(data.footerLine1));
        if (data.footerLine2) steps.push(line(data.footerLine2));
        steps.push(line(''), line(`REF: ${data.kodeReferensi}`));
     } else if (layout === 'modern') {
        steps.push(u(esc.center), u(esc.bold), line('BUKTI TRANSFER'), u(esc.boldOff), line('================================'), u(esc.left));
        steps.push(line(lv(data.tanggal, data.waktu)));
        steps.push(u(esc.bold), line(`NO REF: ${data.kodeReferensi}`), u(esc.boldOff));
        steps.push(line('--------------------------------'));
        if (data.showPengirim && data.namaPengirim) {
           steps.push(u(esc.bold), line(`PENGIRIM: ${data.namaPengirim.toUpperCase()}`), u(esc.boldOff));
        }
        steps.push(u(esc.bold), line(`KEPADA:`), u(esc.boldOff));
        steps.push(u(esc.bold), line(`PENERIMA: ${data.namaPenerima.toUpperCase()}`), u(esc.boldOff));
        steps.push(u(esc.bold), line(`BANK    : ${data.bankTujuan.toUpperCase()}`), u(esc.boldOff));
        steps.push(u(esc.bold), line(`REK     : ${data.noRekening}`), u(esc.boldOff));
        steps.push(line('--------------------------------'));
        steps.push(line(lv('NOMINAL', `Rp ${data.nominal.toLocaleString('id-ID')}`)));
        if (data.showAdminFee) {
           steps.push(line(lv('ADMIN FEE', `Rp ${data.admin.toLocaleString('id-ID')}`)));
        }
        steps.push(line('--------------------------------'));
        const total = data.nominal + (data.showAdminFee ? data.admin : 0);
        steps.push(u(esc.center), line('TOTAL BAYAR'));
        steps.push(u(esc.bold), line(`Rp ${total.toLocaleString('id-ID')}`), u(esc.boldOff));
        steps.push(line(''));
        steps.push(u(esc.bold), line(`** ${data.status.toUpperCase()} **`), u(esc.boldOff));
        if (data.footerLine1) steps.push(line(data.footerLine1));
        if (data.footerLine2) steps.push(u(esc.bold), line(data.footerLine2), u(esc.boldOff));
     } else if (layout === 'bank') {
        steps.push(u(esc.center), u(esc.bold), line('BUKTI TRANSAKSI'), u(esc.boldOff), line(''), u(esc.left));
        steps.push(u(esc.bold), line(lv(data.tanggal, data.waktu)), u(esc.boldOff));
        steps.push(u(esc.bold), line(lv('ID REF', `: ${data.kodeReferensi}`)), u(esc.boldOff));
        steps.push(u(esc.bold), line(lv('NO REF', `: ${data.kodeReferensi}`)), u(esc.boldOff));
        if (data.showPengirim && data.namaPengirim) {
           steps.push(u(esc.bold), line(lv('PENGIRIM', `: ${data.namaPengirim.toUpperCase()}`)), u(esc.boldOff));
        }
        steps.push(u(esc.bold), line(lv('TRANSAKSI', `: TRANSFER BANK`)), u(esc.boldOff));
        steps.push(u(esc.bold), line(lv('BANK TUJUAN', `: ${data.bankTujuan.toUpperCase()}`)), u(esc.boldOff));
        steps.push(u(esc.bold), line(lv('NO REKENING', `: ${data.noRekening}`)), u(esc.boldOff));
        steps.push(u(esc.bold), line(lv('PENERIMA', `: ${data.namaPenerima.toUpperCase()}`)), u(esc.boldOff));
        
        steps.push(u(esc.bold), line(lv('JUMLAH', `: Rp ${data.nominal.toLocaleString('id-ID')}`)), u(esc.boldOff));
        if (data.showAdminFee) {
           steps.push(u(esc.bold), line(lv('ADMIN FEE', `: Rp ${data.admin.toLocaleString('id-ID')}`)), u(esc.boldOff));
        }
        const total = data.nominal + (data.showAdminFee ? data.admin : 0);
        steps.push(u(esc.bold), line(lv('TOTAL', `: Rp ${total.toLocaleString('id-ID')}`)), u(esc.boldOff));
        const statusStr = data.status === 'TRANSAKSI BERHASIL' ? 'SUKSES' : 'PENDING';
        steps.push(u(esc.bold), line(lv('STATUS', `: ${statusStr}`)), u(esc.boldOff));
        steps.push(line(''));
        steps.push(u(esc.center), u(esc.bold), line(data.footerLine2 || ''), u(esc.boldOff));
        steps.push(line(data.footerLine1 || ''));
     } else if (layout === 'digital') {
        steps.push(line(lv('TANGGAL', data.tanggal)));
        steps.push(line(lv('WAKTU', data.waktu)));
        steps.push(line('--------------------------------'));
        steps.push(u(esc.center), line('KODE REFERENSI'), u(esc.bold), line(data.kodeReferensi || '-'), u(esc.boldOff), line('--------------------------------'));
        steps.push(line('DATA PENERIMA'));
        steps.push(u(esc.bold), line(lv('BANK TUJUAN', data.bankTujuan.toUpperCase())), u(esc.boldOff));
        steps.push(line(lv('NO REKENING', data.noRekening)));
        steps.push(u(esc.bold), line(lv('PENERIMA', data.namaPenerima.toUpperCase())), u(esc.boldOff));
        steps.push(line('--------------------------------'));
        steps.push(u(esc.bold), line(lv('NOMINAL', `Rp ${data.nominal.toLocaleString('id-ID')}`)), u(esc.boldOff));
        if (data.showAdminFee) {
           steps.push(u(esc.bold), line(lv('ADMIN FEE', `Rp ${data.admin.toLocaleString('id-ID')}`)), u(esc.boldOff));
        }
        steps.push(line('================================'));
        const total = data.nominal + (data.showAdminFee ? data.admin : 0);
        steps.push(line(lv('TOTAL', `Rp ${total.toLocaleString('id-ID')}`)));
        steps.push(line('================================'), line(''));
        steps.push(u(esc.bold), line(data.status), u(esc.boldOff));
        if (data.footerLine1) steps.push(line(data.footerLine1));
        if (data.footerLine2) steps.push(u(esc.bold), line(data.footerLine2), u(esc.boldOff));
        steps.push(line(`TID: ${data.tid || 'NK-000'}`));
     } else {
        // Standard Layout
        steps.push(line(lv('TANGGAL', data.tanggal)));
        steps.push(line(lv('WAKTU', data.waktu)));
        steps.push(line(lv('REFF', data.kodeReferensi)));
        steps.push(line('--------------------------------'));
        if (data.showPengirim && data.namaPengirim) {
           steps.push(line(lv('DR', data.namaPengirim.toUpperCase())));
        }
        steps.push(u(esc.bold), line(lv('NAMA', data.namaPenerima.toUpperCase())), u(esc.boldOff));
        steps.push(line(lv('BANK', data.bankTujuan.toUpperCase())));
        steps.push(line(lv('REK', data.noRekening)));
        steps.push(line('--------------------------------'));
        steps.push(line(lv('NOMINAL', `Rp ${data.nominal.toLocaleString('id-ID')}`)));
        if (data.showAdminFee) {
           steps.push(line(lv('ADMIN FEE', `Rp ${data.admin.toLocaleString('id-ID')}`)));
        }
        steps.push(line('================================'));
        const total = data.nominal + (data.showAdminFee ? data.admin : 0);
        steps.push(u(esc.bold), line(lv('TOTAL', `Rp ${total.toLocaleString('id-ID')}`)), u(esc.boldOff));
        steps.push(line('================================'), line(''));
        steps.push(u(esc.center), u(esc.bold), line(data.status.toUpperCase()), u(esc.boldOff));
        if (data.footerLine1) steps.push(line(data.footerLine1));
        if (data.footerLine2) steps.push(u(esc.bold), line(data.footerLine2), u(esc.boldOff));
     }
     
     // Extra Feed at the end
     steps.push(u(esc.feed), u(esc.feed), u(esc.feed), u(esc.feed), u(esc.feed));

     for (const step of steps) {
        // Smaller chunks for better compatibility with low-MTU devices
        // Some printers have very small buffers (e.g. 64 or 128 bytes)
        const chunkSize = 64; 
        for (let i = 0; i < step.length; i += chunkSize) {
          const chunk = step.slice(i, i + chunkSize);
          await char.writeValue(chunk);
          // Small delay between chunks to prevent buffer overflow
          await new Promise(resolve => setTimeout(resolve, 15));
        }
     }
     
     alert("Cetak berhasil dikirim!");
     device.gatt?.disconnect();
     
  } catch (error: any) {
    if (error.name === 'NotFoundError') return;
    console.error("Bluetooth Error:", error);
    alert(`Bluetooth Gagal: ${error.message}`);
  }
};
