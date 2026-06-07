# Google AI Studio - GitHub Integration Setup

## Konfigurasi GitHub Authentication untuk AI Studio

### Prasyarat:
- ✅ Repository GitHub sudah ada
- ✅ Anda adalah owner dari repository
- ✅ GitHub Personal Access Token (PAT) sudah dibuat

### Langkah Setup:

#### 1. Buat Personal Access Token (PAT)
**URL:** https://github.com/settings/tokens

**Scopes yang diperlukan:**
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows  
- `write:packages` - Upload packages

**Catatan:** Simpan token dengan aman!

#### 2. Konfigurasi di Google AI Studio

1. Buka AI Studio: https://aistudio.google.com
2. Buka project Anda
3. Pergi ke **Settings** → **Integrations** → **GitHub**
4. Masukkan:
   - **Repository:** `milasriwahyuni8-rgb/Alfathprinter`
   - **Personal Access Token:** [Paste token dari Step 1]
   - **Default Branch:** `main`

#### 3. Test Koneksi
Di AI Studio, coba push code kecil untuk test koneksi sudah bekerja.

---

## ⚠️ Troubleshooting

### Error: "Failed to push commit"
**Solusi:**
1. Verify token belum expired
2. Check token memiliki scopes yang tepat
3. Pastikan branch `main` tidak terkunci dengan branch protection rules

### Error: "Permission denied"
**Solusi:**
1. Regenerate token dengan scopes lengkap
2. Pastikan PAT bukan fine-grained token (gunakan classic)
3. Cek user memiliki push access ke repository

### Error: "Network timeout"
**Solusi:**
1. Cek koneksi internet
2. Coba push ulang setelah 5-10 detik
3. Check status GitHub: https://www.githubstatus.com

---

## 🔐 Security Best Practices

- ❌ JANGAN share token dengan siapapun
- ❌ JANGAN commit token ke repository
- ✅ Simpan token di environment variable
- ✅ Regenerate token setiap 3-6 bulan
- ✅ Delete token yang tidak dipakai

---

## Referensi
- [GitHub Personal Access Token Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [AI Studio GitHub Integration](https://ai.google.dev/studio/integrations)
