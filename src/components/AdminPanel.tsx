import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { Users, Building2, Plus, Check, Loader2, X, Trash2 } from 'lucide-react';

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

  const handleApproveUser = async (userId: string, branchId: string, currentData: any) => {
    try {
      if (!branchId) return alert('Pilih cabang untuk karyawan ini');
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

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex bg-white shadow-sm shrink-0 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('cabang')}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest ${activeTab === 'cabang' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}
        >
          <Building2 className="w-5 h-5 mx-auto mb-1" />
          Cabang
        </button>
        <button 
          onClick={() => setActiveTab('karyawan')}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest ${activeTab === 'karyawan' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}
        >
          <Users className="w-5 h-5 mx-auto mb-1" />
          Karyawan
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'cabang' ? (
          <div className="space-y-6">
            <form onSubmit={handleAddBranch} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Tambah Cabang Baru</h3>
              <div>
                <input 
                  type="text" 
                  placeholder="Nama Cabang" 
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <input 
                  type="text" 
                  placeholder="Alamat (opsional)" 
                  value={newBranchAddress}
                  onChange={e => setNewBranchAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit" 
                disabled={isAddingBranch}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                {isAddingBranch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Tambah
              </button>
            </form>

            <div className="space-y-3">
              {branches.map(branch => (
                <div key={branch.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800">{branch.name}</h4>
                    {branch.address && <p className="text-xs text-slate-500">{branch.address}</p>}
                  </div>
                  <button onClick={() => handleDeleteBranch(branch.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {users.filter(u => u.role !== 'admin').map(user => (
              <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800">{user.email}</h4>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {user.status}
                    </span>
                  </div>
                </div>
                
                {user.status !== 'active' ? (
                  <div className="flex gap-2 items-center pt-2">
                    <select 
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-medium"
                      onChange={(e) => {
                        handleApproveUser(user.id, e.target.value, user);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Pilih Cabang untuk Approve</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="text-xs text-indigo-600 font-bold bg-indigo-50 inline-block px-2 py-1 rounded">
                    Cabang: {branches.find(b => b.id === user.branchId)?.name || user.branchId}
                  </div>
                )}
              </div>
            ))}
            {users.filter(u => u.role !== 'admin').length === 0 && (
              <p className="text-center text-sm text-slate-400 py-10 font-medium">Belum ada karyawan.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
