document.addEventListener('DOMContentLoaded', () => {
    // === NAVIGASI & STATE GLOBAL ===
    const navLinks = document.querySelectorAll('.nav-link');
    let transactions = JSON.parse(localStorage.getItem('transactions_harian_warmindo_v4')) || [];
    let employees = JSON.parse(localStorage.getItem('employees_warmindo_v4')) || [];
    let attendance = JSON.parse(localStorage.getItem('attendance_warmindo_v4')) || {};

    const saveTransactions = () => localStorage.setItem('transactions_harian_warmindo_v4', JSON.stringify(transactions));
    const saveEmployees = () => localStorage.setItem('employees_warmindo_v4', JSON.stringify(employees));
    const saveAttendance = () => localStorage.setItem('attendance_warmindo_v4', JSON.stringify(attendance));
    
    // === LOGIKA NAVIGASI HALAMAN ===
    const showSection = (targetId) => {
        document.querySelectorAll('.main-section').forEach(section => section.classList.add('hidden'));
        document.getElementById(targetId).classList.remove('hidden');
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.target === targetId);
        });
    };
    navLinks.forEach(link => link.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(e.target.dataset.target);
    }));

    // === BAGIAN KEUANGAN ===
    const formTransaksi = document.getElementById('form-transaksi');
    const tanggalInput = document.getElementById('tanggal');
    const jenisInput = document.getElementById('jenis');
    const jumlahInput = document.getElementById('jumlah');
    const dailyLogsContainer = document.getElementById('daily-logs-container');
    const pemasukanWrapper = document.getElementById('pemasukan-deskripsi-wrapper');
    const pengeluaranWrapper = document.getElementById('pengeluaran-deskripsi-wrapper');
    const deskripsiPemasukanInput = document.getElementById('deskripsi-pemasukan');
    const pengeluaranItemsList = document.getElementById('pengeluaran-items-list');
    const btnTambahItem = document.getElementById('btn-tambah-item');
    const totalPemasukanEl = document.getElementById('total-pemasukan');
    const totalPengeluaranEl = document.getElementById('total-pengeluaran');
    const hasilBersihEl = document.getElementById('hasil-bersih');
    const hariUntungEl = document.getElementById('hari-untung');
    const hariBorosEl = document.getElementById('hari-boros');
    const rataPemasukanEl = document.getElementById('rata-pemasukan');
    const chartCanvas = document.getElementById('performanceChart').getContext('2d');
    let performanceChart;
    
    // Fungsi Keuangan (direkstrukturisasi untuk kejelasan)
    const keuangan = {
        formatRupiah: (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n),
        formatTanggal: (d) => {
            const today = new Date(), yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const date = new Date(d + 'T00:00:00');
            if (date.toDateString() === today.toDateString()) return 'Hari Ini';
            if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
            return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
        },
        toggleForm: () => {
            const isPemasukan = jenisInput.value === 'pemasukan';
            pemasukanWrapper.classList.toggle('hidden', !isPemasukan);
            pengeluaranWrapper.classList.toggle('hidden', isPemasukan);
            jumlahInput.disabled = !isPemasukan;
            if (!isPemasukan && pengeluaranItemsList.children.length === 0) keuangan.addPengeluaranItem();
            keuangan.updateTotalPengeluaran();
        },
        addPengeluaranItem: () => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'pengeluaran-item';
            itemDiv.innerHTML = `<input type="text" class="item-deskripsi" placeholder="Deskripsi item" required><input type="number" class="item-jumlah" placeholder="Jumlah" required><button type="button" class="btn-hapus-item">X</button>`;
            pengeluaranItemsList.appendChild(itemDiv);
            itemDiv.querySelector('.btn-hapus-item').addEventListener('click', () => { itemDiv.remove(); keuangan.updateTotalPengeluaran(); });
            itemDiv.querySelector('.item-jumlah').addEventListener('input', keuangan.updateTotalPengeluaran);
        },
        updateTotalPengeluaran: () => {
            if (jenisInput.value === 'pengeluaran') {
                const items = pengeluaranItemsList.querySelectorAll('.item-jumlah');
                jumlahInput.value = [...items].reduce((s, i) => s + (+i.value || 0), 0);
            }
        },
        addTransaction: (e) => {
            e.preventDefault();
            let deskripsi;
            if (jenisInput.value === 'pemasukan') {
                deskripsi = deskripsiPemasukanInput.value.trim();
                if (!deskripsi || !jumlahInput.value) { alert('Deskripsi & jumlah harus diisi!'); return; }
            } else {
                deskripsi = [];
                const items = pengeluaranItemsList.querySelectorAll('.pengeluaran-item');
                for (const item of items) {
                    const d = item.querySelector('.item-deskripsi').value.trim();
                    const j = +item.querySelector('.item-jumlah').value;
                    if (!d || j <= 0) { alert('Rincian pengeluaran harus diisi!'); return; }
                    deskripsi.push({ item: d, jumlah: j });
                }
                if (deskripsi.length === 0) { alert('Tambah item pengeluaran!'); return; }
            }
            transactions.push({ id: Date.now(), tanggal: tanggalInput.value, jenis: jenisInput.value, jumlah: +jumlahInput.value, deskripsi: deskripsi });
            saveTransactions();
            keuangan.renderAll();
            formTransaksi.reset();
            pengeluaranItemsList.innerHTML = '';
            keuangan.setDefaultDate();
            keuangan.toggleForm();
        },
        renderDailyLogs: (grouped) => {
            dailyLogsContainer.innerHTML = '';
            Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'daily-log-group';
                const dailyPemasukan = grouped[date].filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0);
                const dailyPengeluaran = grouped[date].filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0);
                groupDiv.innerHTML = `<h3 class="daily-header">${keuangan.formatTanggal(date)}</h3>
                <div class="daily-summary">
                    <div>Pemasukan: <span class="daily-pemasukan">${keuangan.formatRupiah(dailyPemasukan)}</span></div>
                    <div>Pengeluaran: <span class="daily-pengeluaran">${keuangan.formatRupiah(dailyPengeluaran)}</span></div>
                    <div>Hasil Bersih: <span class="daily-hasil-bersih">${keuangan.formatRupiah(dailyPemasukan-dailyPengeluaran)}</span></div>
                </div>
                <div class="table-wrapper"><table class="daily-table"><tbody>
                ${grouped[date].map(t => `<tr>
                    <td width="60%">${t.jenis === 'pemasukan' ? t.deskripsi : `<ul class="rincian-list">${t.deskripsi.map(i => `<li><span>${i.item}</span><span>${keuangan.formatRupiah(i.jumlah)}</span></li>`).join('')}</ul>`}</td>
                    <td width="30%" class="jumlah-${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${keuangan.formatRupiah(t.jumlah)}</td>
                    <td width="10%"><button class="btn-hapus" onclick="window.deleteTransaction(${t.id})">Hapus</button></td>
                </tr>`).join('')}
                </tbody></table></div>`;
                dailyLogsContainer.appendChild(groupDiv);
            });
        },
        renderAnalytics: (grouped) => {
            const dailySummaries = Object.keys(grouped).map(date => {
                const pemasukan = grouped[date].filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0);
                const pengeluaran = grouped[date].filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0);
                return { date, pemasukan, pengeluaran, hasilBersih: pemasukan - pengeluaran };
            });
            if(dailySummaries.length > 0){
                const hariUntung = dailySummaries.reduce((p, c) => (p.hasilBersih > c.hasilBersih) ? p : c);
                const hariBoros = dailySummaries.reduce((p, c) => (p.pengeluaran > c.pengeluaran) ? p : c);
                const totalPemasukan = dailySummaries.reduce((s, d) => s + d.pemasukan, 0);
                hariUntungEl.textContent = keuangan.formatTanggal(hariUntung.date);
                hariBorosEl.textContent = keuangan.formatTanggal(hariBoros.date);
                rataPemasukanEl.textContent = keuangan.formatRupiah(totalPemasukan / dailySummaries.length);
            }
            if (performanceChart) performanceChart.destroy();
            const last7DaysData = dailySummaries.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 7).reverse();
            performanceChart = new Chart(chartCanvas, { type: 'bar', data: {
                labels: last7DaysData.map(d => new Intl.DateTimeFormat('id-ID', {day: '2-digit', month: 'short'}).format(new Date(d.date+'T00:00:00'))),
                datasets: [{label: 'Pemasukan', data: last7DaysData.map(d => d.pemasukan), backgroundColor: 'rgba(0, 132, 61, 0.7)'}, {label: 'Pengeluaran', data: last7DaysData.map(d => d.pengeluaran), backgroundColor: 'rgba(217, 37, 37, 0.7)'}]
            }});
        },
        renderAll: () => {
            const grouped = transactions.reduce((acc, t) => { (acc[t.tanggal] = acc[t.tanggal] || []).push(t); return acc; }, {});
            const totalPemasukan = transactions.filter(t=>t.jenis==='pemasukan').reduce((s,t)=>s+t.jumlah,0);
            const totalPengeluaran = transactions.filter(t=>t.jenis==='pengeluaran').reduce((s,t)=>s+t.jumlah,0);
            totalPemasukanEl.textContent = keuangan.formatRupiah(totalPemasukan);
            totalPengeluaranEl.textContent = keuangan.formatRupiah(totalPengeluaran);
            hasilBersihEl.textContent = keuangan.formatRupiah(totalPemasukan-totalPengeluaran);
            keuangan.renderDailyLogs(grouped);
            keuangan.renderAnalytics(grouped);
        },
        setDefaultDate: () => tanggalInput.value = new Date().toISOString().slice(0, 10),
        init: () => {
            formTransaksi.addEventListener('submit', keuangan.addTransaction);
            jenisInput.addEventListener('change', keuangan.toggleForm);
            btnTambahItem.addEventListener('click', keuangan.addPengeluaranItem);
            document.getElementById('btn-download').addEventListener('click', () => { /* Download logic here */ });
            document.getElementById('btn-clear-keuangan').addEventListener('click', () => { if(confirm('Hapus semua data KEUANGAN?')){ transactions=[]; saveTransactions(); keuangan.renderAll(); } });
            keuangan.setDefaultDate();
            keuangan.toggleForm();
            keuangan.renderAll();
        }
    };
    window.deleteTransaction = (id) => { if(confirm('Hapus catatan ini?')){ transactions = transactions.filter(t=>t.id!==id); saveTransactions(); keuangan.renderAll(); } };


    // === BAGIAN ABSENSI KARYAWAN ===
    const formKaryawan = document.getElementById('form-tambah-karyawan');
    const namaKaryawanInput = document.getElementById('nama-karyawan');
    const listKaryawan = document.getElementById('list-karyawan');
    const pilihMingguInput = document.getElementById('pilih-minggu');
    const tabelAbsensiContainer = document.getElementById('tabel-absensi-container');

    const absensi = {
        renderEmployees: () => {
            listKaryawan.innerHTML = '';
            employees.forEach(emp => {
                const li = document.createElement('li');
                li.textContent = emp;
                const btnHapus = document.createElement('button');
                btnHapus.className = 'btn-hapus-karyawan';
                btnHapus.textContent = 'Hapus';
                btnHapus.onclick = () => absensi.deleteEmployee(emp);
                li.appendChild(btnHapus);
                listKaryawan.appendChild(li);
            });
        },
        addEmployee: (e) => {
            e.preventDefault();
            const newName = namaKaryawanInput.value.trim();
            if (newName && !employees.includes(newName)) {
                employees.push(newName);
                saveEmployees();
                absensi.renderEmployees();
                absensi.renderAttendanceTable(new Date(pilihMingguInput.value));
            }
            namaKaryawanInput.value = '';
        },
        deleteEmployee: (name) => {
            if (confirm(`Yakin hapus karyawan "${name}"? Semua data absensinya juga akan terhapus.`)) {
                employees = employees.filter(emp => emp !== name);
                saveEmployees();
                absensi.renderEmployees();
                absensi.renderAttendanceTable(new Date(pilihMingguInput.value));
            }
        },
        renderAttendanceTable: (selectedDate) => {
            tabelAbsensiContainer.innerHTML = '';
            if (employees.length === 0) return;
            const weekDates = absensi.getWeekDates(selectedDate);
            const table = document.createElement('table');
            table.id = 'tabel-absensi';
            const headerRow = table.createTHead().insertRow();
            headerRow.innerHTML = '<th>Nama Karyawan</th>' + weekDates.map(d => `<th>${new Intl.DateTimeFormat('id-ID',{weekday:'short'}).format(d)}<br>${d.getDate()}/${d.getMonth()+1}</th>`).join('');
            const tbody = table.createTBody();
            employees.forEach(emp => {
                const row = tbody.insertRow();
                row.innerHTML = `<td>${emp}</td>` + weekDates.map(d => {
                    const dateKey = d.toISOString().slice(0, 10);
                    const isPresent = attendance[dateKey] && attendance[dateKey][emp];
                    return `<td><input type="checkbox" class="absen-checkbox" data-date="${dateKey}" data-employee="${emp}" ${isPresent ? 'checked' : ''}></td>`;
                }).join('');
            });
            tabelAbsensiContainer.appendChild(table);
        },
        getWeekDates: (date) => {
            const start = new Date(date);
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
            const monday = new Date(start.setDate(diff));
            return Array.from({length: 7}, (_, i) => new Date(new Date(monday).setDate(monday.getDate() + i)));
        },
        handleCheckboxChange: (e) => {
            if (e.target.classList.contains('absen-checkbox')) {
                const { date, employee } = e.target.dataset;
                if (!attendance[date]) attendance[date] = {};
                attendance[date][employee] = e.target.checked;
                saveAttendance();
            }
        },
        init: () => {
            formKaryawan.addEventListener('submit', absensi.addEmployee);
            pilihMingguInput.addEventListener('change', () => absensi.renderAttendanceTable(new Date(pilihMingguInput.value)));
            tabelAbsensiContainer.addEventListener('change', absensi.handleCheckboxChange);
            document.getElementById('btn-clear-absensi').addEventListener('click', () => { if(confirm('Hapus semua data KARYAWAN & ABSENSI?')){ employees=[]; attendance={}; saveEmployees(); saveAttendance(); absensi.renderAll(); } });
            absensi.renderAll();
        },
        renderAll: () => {
            pilihMingguInput.value = new Date().toISOString().slice(0, 10);
            absensi.renderEmployees();
            absensi.renderAttendanceTable(new Date());
        }
    };
    
    // === INISIALISASI APLIKASI ===
    keuangan.init();
    absensi.init();
    showSection('keuangan-section'); // Tampilkan halaman keuangan saat pertama dibuka
});
