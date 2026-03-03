import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { 
  ArrowRight, Home, ClipboardCheck, RotateCcw, Plus, Minus,
  User, CheckCircle2, History, ArrowLeft, Package2, AlertCircle
} from 'lucide-react';

// --- Types ---
type Screen = 'home' | 'borrow_form' | 'borrow_proof' | 'borrow_receipt' | 'return_form' | 'return_receipt' | 'history';
interface Inventory { [key: string]: number; }
interface TransactionRecord { id: number; type: 'borrow' | 'return'; person_name: string; items: Inventory; proof_image?: string; timestamp: string; }
const ITEM_NAMES = ['Kabel Roll', 'Speaker', 'Spidol'] as const;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [inventory, setInventory] = useState<Inventory>({});
  const [history, setHistory] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowItems, setBorrowItems] = useState<Inventory>({ 'Kabel Roll': 0, 'Speaker': 0, 'Spidol': 0 });
  const [borrowProof, setBorrowProof] = useState<string | null>(null);
  const [lastBorrowDate, setLastBorrowDate] = useState('');
  const [returnerName, setReturnerName] = useState('');
  const [returnItems, setReturnItems] = useState<Inventory>({ 'Kabel Roll': 0, 'Speaker': 0, 'Spidol': 0 });
  const [lastReturnDate, setLastReturnDate] = useState('');
  const [showBorrowerList, setShowBorrowerList] = useState(false);
  const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);

  const getActiveLoans = useCallback(() => {
    const activeLoans: { [name: string]: Inventory } = {};
    [...history].reverse().forEach(record => {
      if (!activeLoans[record.person_name]) {
        activeLoans[record.person_name] = { 'Kabel Roll': 0, 'Speaker': 0, 'Spidol': 0 };
      }
      Object.entries(record.items).forEach(([item, qty]) => {
        const q = qty as number;
        if (record.type === 'borrow') {
          activeLoans[record.person_name][item] += q;
        } else {
          activeLoans[record.person_name][item] -= q;
        }
      });
    });
    return Object.fromEntries(
      Object.entries(activeLoans).filter(([_, items]) => 
        Object.values(items).some(q => q > 0)
      )
    );
  }, [history]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, histRes] = await Promise.all([fetch('/api/inventory'), fetch('/api/history')]);
      if (!invRes.ok || !histRes.ok) throw new Error('Gagal narik data dari server bray!');
      setInventory(await invRes.json());
      setHistory(await histRes.json());
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const socket = io();
    socket.on('data_updated', (data) => { setInventory(data.inventory); setHistory(data.history); });
    return () => { socket.disconnect(); };
  }, [fetchData]);

  const submitBorrow = async () => {
    if (!borrowerName.trim()) return alert('Isi nama dulu cuy!');
    if (!borrowProof) return alert('Kirim bukti izin guru dulu dong!');
    
    const res = await fetch('/api/borrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        person_name: borrowerName, 
        items: borrowItems,
        proof_image: borrowProof
      })
    });
    if (res.ok) { 
      setLastBorrowDate(new Date().toLocaleString()); 
      setCurrentScreen('borrow_receipt'); 
      setBorrowProof(null);
      setBorrowerName('');
      setBorrowItems({ 'Kabel Roll': 0, 'Speaker': 0, 'Spidol': 0 });
      fetchData(); 
    }
    else { const d = await res.json(); alert(d.error); }
  };

  const submitReturn = async () => {
    if (!returnerName.trim()) return alert('Isi nama dulu cuy!');
    const res = await fetch('/api/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_name: returnerName, items: returnItems })
    });
    if (res.ok) { setLastReturnDate(new Date().toLocaleString()); setCurrentScreen('return_receipt'); fetchData(); }
  };

  const updateBorrowItem = (item: string, delta: number) => {
    setBorrowItems(prev => ({ ...prev, [item]: Math.max(0, prev[item] + delta) }));
  };

  const updateReturnItem = (item: string, delta: number) => {
    setReturnItems(prev => ({ ...prev, [item]: Math.max(0, prev[item] + delta) }));
  };

  const renderHome = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center space-y-8 p-6 w-full max-w-4xl">
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.img 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          src="/logo28.png" 
          alt="Logo SMAN 28" 
          className="w-28 h-28 object-contain mb-2 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]" 
        />
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-300">
            SMAN 28 Jakarta
          </h1>
          <p className="text-emerald-100 font-bold">Sistem Peminjaman Barang Digital</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
        {ITEM_NAMES.map(item => (
          <motion.div key={item} whileHover={{ y: -5 }} className="bg-red-500 p-6 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center relative overflow-hidden group">
            <span className="text-xs font-bold text-white uppercase tracking-widest mb-2">{item}</span>
            <span className="text-4xl font-black text-white">{inventory[item] ?? '-'}</span>
            <span className="text-xs text-red-100 mt-1 font-bold">Tersedia Saat Ini</span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4 w-full max-md">
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { setBorrowerName(''); setBorrowItems({ 'Kabel Roll': 0, 'Speaker': 0, 'Spidol': 0 }); setBorrowProof(null); setCurrentScreen('borrow_form'); }} className="bg-white text-black py-5 px-6 rounded-2xl font-bold border-2 border-black flex flex-col items-center justify-center gap-3 hover:bg-zinc-100 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <ClipboardCheck size={28} />
            <span>Pinjam</span>
          </button>
          <button onClick={() => { setReturnerName(''); setReturnItems({ 'Kabel Roll': 0, 'Speaker': 0, 'Spidol': 0 }); setCurrentScreen('return_form'); }} className="bg-blue-600 text-white py-5 px-6 rounded-2xl font-bold border-2 border-black flex flex-col items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <RotateCcw size={28} />
            <span>Kembali</span>
          </button>
        </div>
        <button onClick={() => setCurrentScreen('history')} className="w-full bg-red-500 text-white border-2 border-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-600 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <History size={20} />
          Riwayat Peminjaman
        </button>
      </div>
    </motion.div>
  );

  const renderBorrowForm = () => (
    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md space-y-8 p-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentScreen('home')} className="p-2 hover:bg-zinc-100/10 rounded-full transition-colors text-white"><ArrowLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-white">Form Pinjam</h2>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider ml-1">Nama Peminjam</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input type="text" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="Siapa yang meminjam?" className="w-full pl-12 pr-4 py-4 bg-white border-2 border-black rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" />
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider ml-1">Daftar Barang</label>
          {ITEM_NAMES.map(item => (
            <div key={item} className="flex items-center justify-between p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
              <div className="flex flex-col">
                <span className="font-bold text-zinc-800 text-lg">{item}</span>
                <span className="text-[11px] font-bold text-emerald-600">Tersedia: {inventory[item] ?? 0}</span>
              </div>
              <div className="flex items-center gap-4 bg-zinc-50 p-2 rounded-xl border-2 border-black">
                <button onClick={() => updateBorrowItem(item, -1)} className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-zinc-400 transition-all"><Minus size={20} /></button>
                <span className="w-6 text-center font-black text-xl text-zinc-800">{borrowItems[item]}</span>
                <button onClick={() => updateBorrowItem(item, 1)} disabled={borrowItems[item] >= (inventory[item] ?? 0)} className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-emerald-600 disabled:opacity-20 transition-all"><Plus size={20} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button 
        onClick={() => {
          if (!borrowerName.trim()) return alert('Isi nama dulu cuy!');
          if (Object.values(borrowItems).every(q => q === 0)) return alert('Pilih barang dulu dong!');
          setCurrentScreen('borrow_proof');
        }} 
        className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg border-2 border-black flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        Lanjut ke Bukti <ArrowRight size={22} />
      </button>
    </motion.div>
  );

  const renderBorrowProof = () => {
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Check file size (3MB = 3 * 1024 * 1024 bytes)
        if (file.size > 3 * 1024 * 1024) {
          alert('Ukuran file kegedean cuy! Maksimal 3 MB ya.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Compress to 60% quality
            setBorrowProof(dataUrl);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    };

    return (
      <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md space-y-8 p-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentScreen('borrow_form')} className="p-2 hover:bg-zinc-100/10 rounded-full transition-colors text-white"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-bold text-white">Bukti Izin Guru</h2>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center gap-6">
            <div className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group">
              {borrowProof ? (
                <>
                  <img src={borrowProof} alt="Bukti Izin" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setBorrowProof(null)}
                    className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600 transition-all"
                  >
                    <Plus className="rotate-45" size={20} />
                  </button>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3 w-full h-full justify-center">
                  <Package2 size={48} className="text-zinc-300" />
                  <span className="text-zinc-400 font-bold text-sm">Upload Foto/SS Izin Guru</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-500 text-xs text-center font-medium leading-relaxed">
                Silakan upload bukti chat atau foto yang menunjukkan bahwa guru telah mengizinkan peminjaman barang ini.
              </p>
              <p className="text-red-500 text-[10px] font-black uppercase tracking-wider">
                Maksimal ukuran file 3 MB
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={submitBorrow} 
          disabled={!borrowProof}
          className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg border-2 border-black flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
        >
          Konfirmasi Pinjam <ArrowRight size={22} />
        </button>
      </motion.div>
    );
  };

  const renderReturnForm = () => {
    const activeLoans = getActiveLoans();
    const borrowerNames = Object.keys(activeLoans);

    const handleSelectBorrower = (name: string) => {
      setReturnerName(name);
      setReturnItems(activeLoans[name]);
      setShowBorrowerList(false);
    };

    return (
      <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md space-y-8 p-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentScreen('home')} className="p-2 hover:bg-zinc-100/10 rounded-full transition-colors text-white"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-bold text-white">Form Kembali</h2>
        </div>
        <div className="space-y-6">
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider ml-1">Pilih Peminjam</label>
            <button 
              onClick={() => setShowBorrowerList(!showBorrowerList)}
              className="w-full flex items-center justify-between pl-12 pr-4 py-4 bg-white border-2 border-black rounded-2xl focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-left"
            >
              <User className="absolute left-4 top-[38px] text-zinc-400" size={20} />
              <span className={returnerName ? "text-zinc-800 font-bold" : "text-zinc-400"}>
                {returnerName || "Siapa yang mengembalikan?"}
              </span>
              <Plus className={`transition-transform ${showBorrowerList ? 'rotate-45' : ''}`} size={20} />
            </button>

            <AnimatePresence>
              {showBorrowerList && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 w-full mt-2 bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                >
                  {borrowerNames.length === 0 ? (
                    <div className="p-4 text-center text-zinc-400 font-bold">Tidak ada peminjaman aktif</div>
                  ) : (
                    borrowerNames.map(name => (
                      <button 
                        key={name}
                        onClick={() => handleSelectBorrower(name)}
                        className="w-full p-4 text-left hover:bg-emerald-50 border-b border-zinc-100 last:border-0 font-bold text-zinc-800 transition-colors"
                      >
                        {name}
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {returnerName && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider ml-1">Barang yang Akan Dikembalikan</label>
              {Object.entries(returnItems).filter(([_, q]) => (q as number) > 0).map(([item, qty]) => (
                <div key={item} className="flex items-center justify-between p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-800 text-lg">{item}</span>
                  </div>
                  <div className="bg-emerald-100 px-4 py-2 rounded-xl border-2 border-black font-black text-emerald-700">
                    {qty}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button 
          onClick={submitReturn} 
          disabled={!returnerName}
          className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg border-2 border-black flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
        >
          Konfirmasi Kembali <ArrowRight size={22} />
        </button>
      </motion.div>
    );
  };

  const renderHistory = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-2xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentScreen('home')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-bold text-zinc-900">Riwayat Transaksi</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { 
              const a = document.createElement('a');
              a.href = '/api/download-db';
              a.download = 'inventory.db';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-all flex items-center gap-2 font-bold text-xs"
            title="Download Database (.db)"
          >
            <Package2 size={20} />
            Download DB
          </button>
          <button onClick={fetchData} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-all"><RotateCcw size={20} /></button>
        </div>
      </div>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-4"><AlertCircle size={48} strokeWidth={1} /><p className="font-medium">Belum ada riwayat transaksi</p></div>
        ) : (
          history.map((record) => (
            <div key={record.id} className="bg-white p-5 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl border-2 border-black ${record.type === 'borrow' ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-600'}`}>
                    {record.type === 'borrow' ? <ClipboardCheck size={20} /> : <RotateCcw size={20} />}
                  </div>
                  <div><p className="font-bold text-zinc-800">{record.person_name}</p><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{new Date(record.timestamp).toLocaleString('id-ID')}</p></div>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border-2 border-black ${record.type === 'borrow' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'}`}>{record.type === 'borrow' ? 'PINJAM' : 'KEMBALI'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(record.items).filter(([_, q]) => (q as number) > 0).map(([name, qty]) => (
                  <span key={name} className="bg-zinc-50 text-zinc-600 text-[11px] font-bold px-3 py-1 rounded-full border-2 border-black">{name}: {qty}</span>
                ))}
              </div>
              {record.type === 'borrow' && (
                <div className="mt-2">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Bukti Izin Guru:</p>
                  {record.proof_image ? (
                    <button 
                      onClick={() => setSelectedProofImage(record.proof_image!)}
                      className="w-full h-32 rounded-xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative group"
                    >
                      <img src={record.proof_image} alt="Bukti Izin" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-bold text-xs">Klik untuk Perbesar</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full h-12 rounded-xl border-2 border-dashed border-red-300 flex items-center justify-center bg-red-50">
                      <span className="text-red-400 text-[10px] font-bold italic">Gak ada bukti foto (Data lama/Error)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <button onClick={() => setCurrentScreen('home')} className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><Home size={20} /> Kembali ke Beranda</button>
    </motion.div>
  );

  const renderReceipt = (title: string, name: string, items: Inventory, color: string) => (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-6 p-6">
      <div className="bg-white border-4 border-black rounded-[2.5rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className={`${color} p-8 text-white border-b-4 border-black flex items-center justify-between`}>
          <div><h2 className="text-2xl font-black">Bukti {title}</h2><p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">Berhasil Disimpan</p></div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border-2 border-white/30"><CheckCircle2 size={32} className="text-white" /></div>
        </div>
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1"><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Nama</span><p className="font-bold text-zinc-800 text-lg">{name}</p></div>
            <div className="space-y-1"><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Waktu</span><p className="font-bold text-zinc-800 text-xs leading-relaxed">{lastBorrowDate || lastReturnDate}</p></div>
          </div>
          <div className="space-y-4">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Rincian Barang</span>
            <div className="space-y-3">
              {Object.entries(items).filter(([_, q]) => (q as number) > 0).map(([n, q]) => (
                <div key={n} className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border-2 border-black"><span className="text-zinc-700 font-bold">{n}</span><span className="font-black text-emerald-600 text-lg">x{q}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <button onClick={() => setCurrentScreen('home')} className="w-full bg-black text-white py-5 rounded-2xl font-black text-lg border-2 border-black flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><Home size={22} /> Selesai</button>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#064e3b] flex flex-col items-center font-sans selection:bg-emerald-800 py-12 px-4">
      {isLoading && currentScreen === 'home' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" /><p className="text-white font-black animate-pulse">Memuat Data...</p></div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <AnimatePresence mode="wait">
          {currentScreen === 'home' && renderHome()}
          {currentScreen === 'borrow_form' && renderBorrowForm()}
          {currentScreen === 'borrow_proof' && renderBorrowProof()}
          {currentScreen === 'borrow_receipt' && renderReceipt("Pinjam", borrowerName, borrowItems, "bg-indigo-600")}
          {currentScreen === 'return_form' && renderReturnForm()}
          {currentScreen === 'return_receipt' && renderReceipt("Kembali", returnerName, returnItems, "bg-emerald-600")}
          {currentScreen === 'history' && renderHistory()}
        </AnimatePresence>
      </div>
      <div className="mt-12 flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity pb-4">
        <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.3em]">SMAN 28 Jakarta</p>
        <div className="h-[2px] w-12 bg-emerald-100" />
        <p className="text-emerald-200 text-[8px] font-bold uppercase tracking-[0.1em]">Inventory Management System v2.0</p>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; }`}</style>
      
      <AnimatePresence>
        {selectedProofImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedProofImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedProofImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors flex items-center gap-2 font-bold"
              >
                Tutup <Plus className="rotate-45" size={24} />
              </button>
              <div className="w-full h-full border-4 border-white rounded-3xl overflow-hidden shadow-2xl">
                <img src={selectedProofImage} alt="Bukti Izin Full" className="w-full h-full object-contain bg-zinc-900" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
