import { ReceiptData } from "../types";

export const printViaBluetooth = async (data: ReceiptData, layout: string = 'standard') => {
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
        right: [0x1B, 0x61, 2],
        bold: [0x1B, 0x45, 1],
        boldOff: [0x1B, 0x45, 0],
        feed: [0x0A]
     };

     const u = (arr: number[]) => new Uint8Array(arr);
     const line = (text: string) => encoder.encode(text + '\n');

     let steps: Uint8Array[] = [u(esc.init)];

     // --- Header & Body ---
     if (layout === 'pro') {
        const lv = (l: string, v: string) => {
           const spaces = 32 - l.length - v.length;
           return l + (spaces > 0 ? " ".repeat(spaces) : " ") + v;
        };
        
        steps.push(u(esc.center), u(esc.bold), line(data.namaToko), u(esc.boldOff), line(''));
        steps.push(u(esc.left), line(lv('TANGGAL', data.tanggal)));
        steps.push(line(lv('WAKTU', data.waktu)));
        steps.push(line('--------------------------------'));
        
        steps.push(u(esc.center), line('KODE REFERENSI'), line(data.kodeReferensi || '-'), line('--------------------------------'), line(''));
        
        steps.push(line('DATA PENERIMA'));
        steps.push(u(esc.left), line(lv('BANK TUJUAN', data.bankTujuan.toUpperCase())));
        steps.push(line(lv('NO REKENING', data.noRekening)));
        steps.push(line(lv('PENERIMA', data.namaPenerima.toUpperCase())));
        steps.push(line('--------------------------------'));
        
        steps.push(line(lv('NOMINAL', `RP ${data.nominal.toLocaleString('id-ID')}`)));
        steps.push(line(lv('ADMIN', `RP ${data.admin.toLocaleString('id-ID')}`)));
        steps.push(line('--------------------------------'));
        
        steps.push(u(esc.bold), line(lv('TOTAL', `RP ${(data.nominal + data.admin).toLocaleString('id-ID')}`)), u(esc.boldOff));
        steps.push(line('--------------------------------'));
        steps.push(line(' '));
        steps.push(line('--------------------------------'));
        
        steps.push(u(esc.center), line('** TRANSAKSI BERHASIL **'));
        steps.push(line('SALINAN - VIA ALFATHTRF APP'));
        steps.push(line('TERIMA KASIH'));
     } else {
        steps.push(u(esc.center), u(esc.bold), line(data.namaToko), u(esc.boldOff));
        
        if (layout === 'elegant') {
           steps.push(line('--- OFFICIAL RECEIPT ---'), line(''));
        } else if (layout === 'bank') {
           steps.push(u(esc.bold), line('BUKTI TRANSAKSI'), u(esc.boldOff));
        } else if (layout === 'modern') {
           steps.push(line('================================'), u(esc.bold), line('BUKTI TRANSFER'), u(esc.boldOff), line('================================'));
        } else {
           steps.push(line('================================'));
        }

        steps.push(u(esc.left));
        
        if (layout === 'elegant') {
           steps.push(line(''), line(`Date: ${data.tanggal}`), line(`Time: ${data.waktu}`), line(`Ref : ${data.kodeReferensi}`), line('--------------------------------'));
           if (data.showPengirim) {
              steps.push(u(esc.bold), line(`SENDER`), u(esc.boldOff), line(`${data.namaPengirim}`));
           }
           steps.push(u(esc.bold), line(`RECIPIENT`), u(esc.boldOff), line(`${data.namaPenerima}`));
           steps.push(u(esc.bold), line(`DESTINATION`), u(esc.boldOff), line(`${data.bankTujuan} | ${data.noRekening}`));
        } else if (layout === 'modern' || layout === 'bank') {
           steps.push(line(`${data.tanggal} ${data.waktu}`), line(`NO REF: ${data.kodeReferensi}`), line('--------------------------------'));
           if (data.showPengirim) {
              steps.push(u(esc.bold), line(`PENGIRIM: ${data.namaPengirim}`), u(esc.boldOff));
           }
           steps.push(u(esc.bold), line(`PENERIMA: ${data.namaPenerima}`), u(esc.boldOff));
           steps.push(line(`BANK    : ${data.bankTujuan}`));
           steps.push(line(`REKENING: ${data.noRekening}`));
        } else {
           steps.push(line(`TGL: ${data.tanggal}`), line(`JAM: ${data.waktu}`), line(`REF: ${data.kodeReferensi}`), line('--------------------------------'));
           if (data.showPengirim) {
              steps.push(line(`Pengirim: ${data.namaPengirim}`));
           }
           steps.push(line(`Penerima: ${data.namaPenerima}`));
           steps.push(line(`Bank    : ${data.bankTujuan}`));
           steps.push(line(`Rekening: ${data.noRekening}`));
        }
        
        steps.push(line('--------------------------------'));
        steps.push(line(`NOMINAL : Rp ${data.nominal.toLocaleString('id-ID')}`));
        steps.push(line(`ADMIN   : Rp ${data.admin.toLocaleString('id-ID')}`));
        steps.push(u(esc.bold), line(`TOTAL   : Rp ${(data.nominal + data.admin).toLocaleString('id-ID')}`), u(esc.boldOff));
        steps.push(line('================================'));

        steps.push(u(esc.center), line(''));
        steps.push(u(esc.bold), line(data.status), u(esc.boldOff), line(''));
        steps.push(line(data.footerLine1));
        steps.push(line(data.footerLine2));
     }
     
     // Extra Feed at the end
     steps.push(u(esc.feed), u(esc.feed), u(esc.feed), u(esc.feed), u(esc.feed), u(esc.feed));

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
