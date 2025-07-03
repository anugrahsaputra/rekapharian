document.addEventListener('DOMContentLoaded', () => {
    // === SELEKSI ELEMEN DOM ===
    const form = document.getElementById('form-transaksi');
    const tanggalInput = document.getElementById('tanggal');
    const jenisInput = document.getElementById('jenis');
    const jumlahInput = document.getElementById('jumlah');
    const dailyLogsContainer = document.getElementById('daily-logs-container');
    
    // Wrappers
    const pemasukanWrapper = document.getElementById('pemasukan-deskripsi-wrapper');
    const pengeluaranWrapper = document.getElementById('pengeluaran-deskripsi-wrapper');
    const deskripsiPemasukanInput = document.getElementById('deskripsi-pemasukan');
    const pengeluaranItemsList = document.getElementById('pengeluaran-items-list');
    
    // Buttons
    const btnTambahItem = document.getElementById('btn-tambah-item');
    const btnDownload = document.getElementById('btn-download');
    const btnClear = document.getElementById('btn-clear');

    // Ringkasan Total
    const totalPemasukanEl = document.getElementById('total-pemasukan');
    const totalPengeluaranEl = document.getElementById('total-pengeluaran');
    const saldoAkhirEl = document.getElementById('saldo-akhir');

    // === STATE APLIKASI ===
    let transactions = JSON.parse(localStorage.getItem('transactions_harian_warmindo_v2')) || [];

    // === FUNGSI-FUNGSI BANTU ===
    const saveTransactions = () => localStorage.setItem('transactions_harian_warmindo_v2', JSON.stringify(transactions));
    const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

    const formatTanggalDisplay = (dateStr) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const date = new Date(dateStr + 'T00:00:00');
        if (date.toDateString() === today.toDateString()) return 'Hari Ini';
        if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
        return new Intl.DateTimeFormat('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    };

    // === LOGIKA FORM DINAMIS ===
    const toggleFormType = () => {
        if (jenisInput.value === 'pemasukan') {
            pemasukanWrapper.classList.remove('hidden');
            pengeluaranWrapper.classList.add('hidden');
            jumlahInput.disabled = false;
            jumlahInput.placeholder = "Contoh: 150000";
        } else { // pengeluaran
            pemasukanWrapper.classList.add('hidden');
            pengeluaranWrapper.classList.remove('hidden');
            jumlahInput.disabled = true;
            jumlahInput.placeholder = "Total otomatis dari rincian";
            if (pengeluaranItemsList.children.length === 0) {
                addPengeluaranItemRow();
            }
        }
        updateTotalPengeluaran();
    };

    const addPengeluaranItemRow = () => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'pengeluaran-item';
        itemDiv.innerHTML = `
            <input type="text" class="item-deskripsi" placeholder="Deskripsi item, cth: Tissue" required>
            <input type="number" class="item-jumlah" placeholder="Jumlah" required>
            <button type="button" class="btn-hapus-item">X</button>
        `;
        pengeluaranItemsList.appendChild(itemDiv);

        itemDiv.querySelector('.btn-hapus-item').addEventListener('click', () => {
            itemDiv.remove();
            updateTotalPengeluaran();
        });
        itemDiv.querySelector('.item-jumlah').addEventListener('input', updateTotalPengeluaran);
    };

    const updateTotalPengeluaran = () => {
        if (jenisInput.value === 'pengeluaran') {
            const items = pengeluaranItemsList.querySelectorAll('.item-jumlah');
            const total = [...items].reduce((sum, input) => sum + (+input.value || 0), 0);
            jumlahInput.value = total;
        }
    };

    // === FUNGSI RENDER UTAMA ===
    const render = () => {
        dailyLogsContainer.innerHTML = '';
        updateTotalSummary();
        if (transactions.length === 0) {
            dailyLogsContainer.innerHTML = '<p style="text-align:center; color: #777;">Belum ada catatan. Yuk, mulai mencatat!</p>';
            return;
        }
        const grouped = transactions.reduce((acc, t) => {
            (acc[t.tanggal] = acc[t.tanggal] || []).push(t);
            return acc;
        }, {});
        Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const dailyEl = createDailyLogGroup(date, grouped[date]);
            dailyLogsContainer.appendChild(dailyEl);
        });
    };

    const createDailyLogGroup = (date, dailyTransactions) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'daily-log-group';

        const dailyPemasukan = dailyTransactions.filter(t => t.jenis === 'pemasukan').reduce((sum, t) => sum + t.jumlah, 0);
        const dailyPengeluaran = dailyTransactions.filter(t => t.jenis === 'pengeluaran').reduce((sum, t) => sum + t.jumlah, 0);

        groupDiv.innerHTML = `
            <h3 class="daily-header">${formatTanggalDisplay(date)}</h3>
            <div class="daily-summary">
                <div class="daily-summary-item">Pemasukan: <span class="daily-pemasukan">${formatRupiah(dailyPemasukan)}</span></div>
                <div class="daily-summary-item">Pengeluaran: <span class="daily-pengeluaran">${formatRupiah(dailyPengeluaran)}</span></div>
            </div>
            <div class="table-wrapper"><table class="daily-table"><tbody>
                ${dailyTransactions.map(t => {
                    let deskripsiHtml = '';
                    if (t.jenis === 'pemasukan') {
                        deskripsiHtml = t.deskripsi;
                    } else { // pengeluaran dengan rincian
                        deskripsiHtml = `<ul class="rincian-list">
                            ${t.deskripsi.map(item => `
                                <li>
                                    <span class="item-name">${item.item}</span>
                                    <span class="item-amount">${formatRupiah(item.jumlah)}</span>
                                </li>
                            `).join('')}
                        </ul>`;
                    }
                    return `<tr>
                        <td width="60%">${deskripsiHtml}</td>
                        <td width="30%" class="jumlah-${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatRupiah(t.jumlah)}</td>
                        <td width="10%"><button class="btn-hapus" onclick="removeTransaction(${t.id})">Hapus</button></td>
                    </tr>`;
                }).join('')}
            </tbody></table></div>`;
        return groupDiv;
    };
    
    const updateTotalSummary = () => {
        const pemasukan = transactions.filter(t => t.jenis === 'pemasukan').reduce((sum, t) => sum + t.jumlah, 0);
        const pengeluaran = transactions.filter(t => t.jenis === 'pengeluaran').reduce((sum, t) => sum + t.jumlah, 0);
        saldoAkhirEl.textContent = formatRupiah(pemasukan - pengeluaran);
        totalPemasukanEl.textContent = formatRupiah(pemasukan);
        totalPengeluaranEl.textContent = formatRupiah(pengeluaran);
    };

    // === FUNGSI AKSI (Tambah, Hapus, Dll) ===
    const addTransaction = (e) => {
        e.preventDefault();
        
        let deskripsi;
        if (jenisInput.value === 'pemasukan') {
            deskripsi = deskripsiPemasukanInput.value.trim();
            if (!deskripsi) { alert('Deskripsi pemasukan harus diisi!'); return; }
        } else { // pengeluaran
            deskripsi = [];
            const items = pengeluaranItemsList.querySelectorAll('.pengeluaran-item');
            for (const item of items) {
                const itemDesc = item.querySelector('.item-deskripsi').value.trim();
                const itemJum = +item.querySelector('.item-jumlah').value;
                if (!itemDesc || itemJum <= 0) { alert('Semua rincian pengeluaran (deskripsi dan jumlah) harus diisi dengan benar!'); return; }
                deskripsi.push({ item: itemDesc, jumlah: itemJum });
            }
            if (deskripsi.length === 0) { alert('Tambahkan setidaknya satu item pengeluaran!'); return; }
        }

        const newTransaction = {
            id: Date.now(),
            tanggal: tanggalInput.value,
            jenis: jenisInput.value,
            jumlah: +jumlahInput.value,
            deskripsi: deskripsi
        };

        transactions.push(newTransaction);
        saveTransactions();
        render();
        form.reset();
        pengeluaranItemsList.innerHTML = '';
        setDefaultDate();
        toggleFormType();
    };

    window.removeTransaction = (id) => {
        if (confirm('Yakin mau hapus catatan ini?')) {
            transactions = transactions.filter(t => t.id !== id);
            saveTransactions();
            render();
        }
    };
    
    const downloadCSV = () => {
        // Implementasi download bisa ditambahkan jika diperlukan, dengan penyesuaian untuk data rincian
        alert('Fitur download sedang dalam pengembangan untuk format baru ini.');
    };
    const clearAllData = () => {
        if (confirm('PERINGATAN! Ini akan menghapus SEMUA data rekapanmu secara permanen. Lanjutkan?')) {
            transactions = [];
            saveTransactions();
            render();
        }
    };
    const setDefaultDate = () => {
        tanggalInput.value = new Date().toISOString().slice(0, 10);
    };

    // === INISIALISASI & EVENT LISTENERS ===
    form.addEventListener('submit', addTransaction);
    jenisInput.addEventListener('change', toggleFormType);
    btnTambahItem.addEventListener('click', addPengeluaranItemRow);
    btnDownload.addEventListener('click', downloadCSV);
    btnClear.addEventListener('click', clearAllData);
    
    setDefaultDate();
    toggleFormType();
    render();
});
