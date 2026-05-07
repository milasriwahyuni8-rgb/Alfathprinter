import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { Users, Building2, Plus, Check, Loader2, X, Trash2, MapPin, Shield, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'karyawan' | 'cabang'>('cabang');
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Branch Form
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'branches'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => {
      unsubBranches();
      unsubUsers();
    };
  }, []);

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName) return;
    setIsAddingBranch(true);
    try {
      const branchId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'branches', branchId), {
        name: newBranchName,
        address: newBranchAddress,
        createdAt: Date.now()
      });
      setNewBranchName('');
      setNewBranchAddress('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `branches`);
    } finally {
      setIsAddingBranch(false);
    }
  };

  const handleApproveUser = async (userId: string, branchId: string) => {
    try {
      if (!branchId) return;
      await updateDoc(doc(db, 'users', userId), {
        branchId,
        status: 'active'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Yakin ingin menghapus cabang ini?')) return;
    try {
      await deleteDoc(doc(db, 'branches', branchId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `branches/${branchId}`);
    }
  };

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Tab Switcher */}
      <div className="bg-white p-2 rounded-[2rem] shadow-sm flex items-center gap-2 border border-slate-100">
        <button 
          onClick={() => setActiveTab('cabang')}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'cabang' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Building2 className="w-5 h-5" />
          Cabang
        </button>
        <button 
          onClick={() => setActiveTab('karyawan')}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'karyawan' ? 'bg-brand-600 text-white shadow-lg shadow-brand-100' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Users className="w-5 h-5" />
          Karyawan
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'cabang' ? (
          <motion.div 
            key="cabang"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-10"
          >
            {/* Add Branch Form */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-brand-600">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight leading-none">Tambah Cabang</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registrasi Lokasi Baru</p>
                </div>
              </div>

              <form onSubmit={handleAddBranch} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lokasi</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: AlfathPulsa Cabang Garut" 
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Lengkap</label>
                  <input 
                    type="text" 
                    placeholder="Jl. Raya No. 123..." 
                    value={newBranchAddress}
                    onChange={e => setNewBranchAddress(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isAddingBranch}
                  className="w-full bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-2xl py-4.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-brand-100 flex items-center justify-center gap-3 mt-4"
                >
                  {isAddingBranch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Daftarkan Cabang
                </button>
              </form>
            </div>

            {/* Branches List */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Daftar Cabang Aktif</h3>
              <div className="grid grid-cols-1 gap-4">
                {branches.map(branch => (
                  <motion.div 
                    layout
                    key={branch.id} 
                    className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 hover:border-brand-200 transition-all group"
                  >
                    <div className="w-14 h-14 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-all border border-slate-50 group-hover:border-brand-100">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-black text-slate-900 uppercase tracking-tight text-lg mb-0.5 truncate">{branch.name}</h4>
                      <div className="flex items-center gap-2 text-slate-400">
                         <MapPin className="w-3 h-3 shrink-0" />
                         <p className="text-[10px] font-bold truncate uppercase tracking-widest">{branch.address || 'Alamat Belum Diatur'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteBranch(branch.id)} 
                      className="w-11 h-11 flex items-center justify-center text-rose-300 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all active:scale-90"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="karyawan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {users.filter(u => u.role !== 'admin').map(user => (
              <motion.div 
                layout
                key={user.id} 
                className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 group hover:border-brand-100 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-slate-300 group-hover:text-brand-500 transition-all border border-slate-50">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-black text-slate-900 uppercase tracking-tight truncate">{user.email}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                        {user.status}
                      </span>
                      {user.branchId && (
                         <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-brand-50 text-brand-600 border border-brand-100">
                           {branches.find(b => b.id === user.branchId)?.name || 'Cabang Luar'}
                         </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {user.status !== 'active' && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Otorisasi & Penempatan Cabang</p>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                        onChange={(e) => handleApproveUser(user.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Pilih Cabang...</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button className="bg-brand-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-100 active:scale-95 transition-all">
                        <Shield className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            {users.filter(u => u.role !== 'admin').length === 0 && (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Belum Ada Data Karyawan</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
