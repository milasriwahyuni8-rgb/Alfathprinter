import { ReceiptData } from "../types";

export const printViaBluetooth = async (data: ReceiptData) => {
  try {
     if (!navigator.bluetooth) {
         throw new Error("Web Bluetooth tidak didukung. Gunakan Chrome di Android.");
     }

     const device = await navigator.bluetooth.requestDevice({
       acceptAllDevices: true,
       optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000e781-0000-1000-8000-00805f9b34fb', '4953544c-4a43-4e4c-5353-445054323232']
     });
     
     const server = await device.gatt?.connect();
     if (!server) throw new Error("Gagal terhubung.");

     // Find primary service and characteristic for printing
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

     if (!char) throw new Error("Printer tidak mendukung pengiriman data.");

     // Basic ESC/POS formatting
     const encoder = new TextEncoder();
     const text = `
${data.namaToko.toUpperCase()}
================================
TANGGAL  : ${data.tanggal}
WAKTU    : ${data.waktu}
--------------------------------
KODE REF :
${data.kodeReferensi}
--------------------------------
POREJ   : ${data.namaPenerima}
BANK    : ${data.bankTujuan}
NOMINAL  : Rp ${data.nominal.toLocaleString('id-ID')}
ADMIN    : Rp ${data.admin.toLocaleString('id-ID')}
================================
TOTAL    : Rp ${(data.nominal + data.admin).toLocaleString('id-ID')}
================================
** ${data.status} **
      ${data.footerLine2}
\n\n\n\n`;

     await char.writeValue(encoder.encode(text));
     alert("Berhasil dikirim ke printer!");
     
     device.gatt?.disconnect();
     
  } catch (error: any) {
    if (error.name === 'NotFoundError') return;
    console.error("Bluetooth Error:", error);
    alert(`Bluetooth Error: ${error.message}\n\nTips: Sangat direkomendasikan pakai 'Cetak Sistem' + aplikasi RawBT untuk Android agar lebih stabil.`);
  }
};
