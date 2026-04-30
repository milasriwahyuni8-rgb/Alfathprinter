import { ReceiptData } from "../types";

export const printViaBluetooth = async (data: ReceiptData) => {
  let device: any = null;
  try {
     const nav = navigator as any;
     if (!nav.bluetooth) {
         throw new Error("Web Bluetooth tidak didukung. Gunakan Chrome di Android.");
     }

     // 1. Pilih Perangkat
     device = await nav.bluetooth.requestDevice({
       acceptAllDevices: true,
       optionalServices: [
         '000018f0-0000-1000-8000-00805f9b34fb', 
         '0000e781-0000-1000-8000-00805f9b34fb', 
         '4953544c-4a43-4e4c-5353-445054323232'
       ]
     });
     
     // 2. Hubungkan
     const server = await device.gatt?.connect();
     if (!server) throw new Error("Gagal terhubung ke server Bluetooth.");

     // 3. Cari Karakteristik Penulisan (Write)
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

     // 4. Perintah ESC/POS & Encoding
     const encoder = new TextEncoder();
     const esc = {
        init: [0x1B, 0x40],
        center: [0x1B, 0x61, 1],
        left: [0x1B, 0x61, 0],
        bold: [0x1B, 0x45, 1],
        boldOff: [0x1B, 0x45, 0],
        feed: [0x0A]
     };

     const u = (arr: number[]) => new Uint8Array(arr);

     // Urutan Cetak (Per Bagian)
     const steps = [
        u(esc.init),
        u(esc.center),
        u(esc.bold),
        encoder.encode(`${data.namaToko}\n`),
        u(esc.boldOff),
        encoder.encode(`================================\n`),
        u(esc.left),
        encoder.encode(`TGL: ${data.tanggal} ${data.waktu}\n`),
        encoder.encode(`REF: ${data.kodeReferensi}\n`),
        encoder.encode(`--------------------------------\n`),
        ...(data.showPengirim ? [encoder.encode(`Pengirim: ${data.namaPengirim}\n`)] : []),
        encoder.encode(`Penerima: ${data.namaPenerima}\n`),
        encoder.encode(`Bank    : ${data.bankTujuan}\n`),
        encoder.encode(`Rekening: ${data.noRekening}\n`),
        u(esc.bold),
        encoder.encode(`NOMINAL : Rp ${data.nominal.toLocaleString('id-ID')}\n`),
        u(esc.boldOff),
        encoder.encode(`ADMIN   : Rp ${data.admin.toLocaleString('id-ID')}\n`),
        encoder.encode(`--------------------------------\n`),
        u(esc.bold),
        encoder.encode(`TOTAL   : Rp ${(data.nominal + data.admin).toLocaleString('id-ID')}\n`),
        u(esc.boldOff),
        encoder.encode(`================================\n`),
        u(esc.center),
        encoder.encode(`${data.status}\n\n`),
        encoder.encode(`${data.footerLine1}\n`),
        encoder.encode(`${data.footerLine2}\n`),
        u(esc.feed), u(esc.feed), u(esc.feed)
     ];

     // 5. Kirim ke Printer
     for (const step of steps) {
        await char.writeValue(step);
     }
     
     alert("Cetak berhasil dikirim!");
     device.gatt?.disconnect();
     
  } catch (error: any) {
    if (error.name === 'NotFoundError') return; // User cancel
    console.error("Bluetooth Error:", error);
    alert(`Bluetooth Gagal: ${error.message}`);
  }
};
