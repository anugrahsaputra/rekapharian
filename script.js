document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // --- State (Data) ---
        transactions: JSON.parse(localStorage.getItem('transactions_v6')) || [],
        employees: JSON.parse(localStorage.getItem('employees_v6')) || [],
        attendance: JSON.parse(localStorage.getItem('attendance_v6')) || {},
        
        // --- Router & Navigasi ---
        router() {
            const hash = window.location.hash || '#/keuangan';
            const targetPage = hash.substring(2); // remove '#/'
            this.showPage(targetPage);
        },
        showPage(page) {
            const appRoot = document.getElementById('app-root');
            appRoot.innerHTML = ''; // Kosongkan konten
            
            const templateId = `template-${page}`;
            const template = document.getElementById(templateId);
            if (template) {
                appRoot.appendChild(template.content.cloneNode(true));
                if (page === 'keuangan') this.keuangan.init();
                if (page === 'absensi') this.absensi.init();
            } else { // Fallback ke halaman keuangan jika URL tidak valid
                this.showPage('keuangan');
                window.location.hash = '#/keuangan';
            }
            this.updateActiveNav(page);
        },
        updateActiveNav(activePage) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#/${activePage}`);
            });
        },
        
        // --- Inisialisasi Aplikasi ---
        init() {
            window.addEventListener('hashchange', () => this.router());
            this.router(); // Panggil router saat pertama kali load
        },
        
        // --- Fungsi Utilitas ---
        formatRupiah: (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n),
        formatTanggal: (dStr) => {
            const date = new Date(dStr + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
            if(date.getTime() === today.getTime()) return 'Hari Ini';
            if(date.getTime() === yesterday.getTime()) return 'Kemarin';
            return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
        },

        // ======================= SUB-MODUL KEUANGAN =======================
        keuangan: {
            parent: null,
            init() { 
                this.parent = app;
                this.initSelectors();
                this.initListeners();
                this.setDefaultDate();
                this.toggleForm();
                this.renderAll();
            },
            initSelectors() {
                // Selektor khusus halaman keuangan
                this.formTransaksi = document.getElementById('form-transaksi');
                this.tanggalInput = document.getElementById('tanggal');
                this.jenisInput = document.getElementById('jenis');
                this.jumlahInput = document.getElementById('jumlah');
                this.pemasukanFields = document.getElementById('pemasukan-form-fields');
                this.pengeluaranFields = document.getElementById('pengeluaran-form-fields');
                this.deskripsiPemasukanInput = document.getElementById('deskripsi-pemasukan');
                this.pengeluaranItemsList = document.getElementById('pengeluaran-items-list');
                this.btnTambahItem = document.getElementById('btn-tambah-item');
                this.totalPemasukanEl = document.getElementById('total-pemasukan');
                this.totalPengeluaranEl = document.getElementById('total-pengeluaran');
                this.hasilBersihEl = document.getElementById('hasil-bersih');
                this.hariUntungEl = document.getElementById('hari-untung');
                this.hariBorosEl = document.getElementById('hari-boros');
                this.rataPemasukanEl = document.getElementById('rata-pemasukan');
                this.incomeChartCanvas = document.getElementById('incomeChart').getContext('2d');
                this.expenseChartCanvas = document.getElementById('expenseChart').getContext('2d');
                this.dailyLogsContainer = document.getElementById('daily-logs-container');
                this.incomeChart = null;
                this.expenseChart = null;
            },
            initListeners(){
                this.formTransaksi.addEventListener('submit', (e) => this.addTransaction(e));
                this.jenisInput.addEventListener('change', () => this.toggleForm());
                this.btnTambahItem.addEventListener('click', () => this.addPengeluaranItem());
                document.getElementById('btn-clear-keuangan').addEventListener('click', () => this.clearData());
            },
            save() { localStorage.setItem('transactions_v6', JSON.stringify(this.parent.transactions)); },
            clearData() { if(confirm('Hapus semua data KEUANGAN?')){ this.parent.transactions=[]; this.save(); this.renderAll(); }},
            setDefaultDate() { this.tanggalInput.value = new Date().toISOString().slice(0, 10); },
            toggleForm() {
                const isPemasukan = this.jenisInput.value === 'pemasukan';
                this.pemasukanFields.classList.toggle('hidden', !isPemasukan);
                this.pengeluaranFields.classList.toggle('hidden', isPemasukan);
                this.jumlahInput.disabled = !isPemasukan;
                if (!isPemasukan && this.pengeluaranItemsList.children.length === 0) this.addPengeluaranItem();
                this.updateTotalPengeluaran();
            },
            addPengeluaranItem() {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'pengeluaran-item';
                itemDiv.innerHTML = `<input type="text" class="item-deskripsi" placeholder="Deskripsi item" required><input type="number" class="item-jumlah" placeholder="Jumlah" required><button type="button" class="btn-hapus-item">X</button>`;
                this.pengeluaranItemsList.appendChild(itemDiv);
                itemDiv.querySelector('.btn-hapus-item').addEventListener('click', () => { itemDiv.remove(); this.updateTotalPengeluaran(); });
                itemDiv.querySelector('.item-jumlah').addEventListener('input', () => this.updateTotalPengeluaran());
            },
            updateTotalPengeluaran() {
                if (this.jenisInput.value === 'pengeluaran') {
                    const items = this.pengeluaranItemsList.querySelectorAll('.item-jumlah');
                    this.jumlahInput.value = [...items].reduce((s, i) => s + (+i.value || 0), 0);
                }
            },
            addTransaction(e) { /* ... (logika sama, hanya referensi this.parent -> this) ... */
                e.preventDefault();
                let deskripsi;
                if(this.jenisInput.value === 'pemasukan'){
                    deskripsi = this.deskripsiPemasukanInput.value.trim();
                    if (!deskripsi || !this.jumlahInput.value) { alert('Deskripsi & jumlah harus diisi!'); return; }
                } else {
                    deskripsi = [];
                    const items = this.pengeluaranItemsList.querySelectorAll('.pengeluaran-item');
                    for (const item of items) {
                        const d = item.querySelector('.item-deskripsi').value.trim();
                        const j = +item.querySelector('.item-jumlah').value;
                        if (!d || j <= 0) { alert('Rincian pengeluaran harus diisi!'); return; }
                        deskripsi.push({ item: d, jumlah: j });
                    }
                    if (deskripsi.length === 0) { alert('Tambah item pengeluaran!'); return; }
                }
                this.parent.transactions.push({ id: Date.now(), tanggal: this.tanggalInput.value, jenis: this.jenisInput.value, jumlah: +this.jumlahInput.value, deskripsi });
                this.save();
                this.renderAll();
                this.formTransaksi.reset();
                this.pengeluaranItemsList.innerHTML = '';
                this.setDefaultDate();
                this.toggleForm();
            },
            deleteTransaction(id) {
                if(confirm('Hapus catatan ini?')) {
                    this.parent.transactions = this.parent.transactions.filter(t => t.id !== id);
                    this.save();
                    this.renderAll();
                }
            },
            renderAll() {
                const grouped = this.parent.transactions.reduce((acc, t) => { (acc[t.tanggal] = acc[t.tanggal] || []).push(t); return acc; }, {});
                const totalPemasukan = this.parent.transactions.filter(t=>t.jenis==='pemasukan').reduce((s,t)=>s+t.jumlah,0);
                const totalPengeluaran = this.parent.transactions.filter(t=>t.jenis==='pengeluaran').reduce((s,t)=>s+t.jumlah,0);
                this.totalPemasukanEl.textContent = this.parent.formatRupiah(totalPemasukan);
                this.totalPengeluaranEl.textContent = this.parent.formatRupiah(totalPengeluaran);
                this.hasilBersihEl.textContent = this.parent.formatRupiah(totalPemasukan-totalPengeluaran);
                this.renderDailyLogs(grouped);
                this.renderAnalytics(grouped);
            },
            renderDailyLogs(grouped) { /* ... (logika sama, hanya referensi this.parent -> this) ... */
                this.dailyLogsContainer.innerHTML = '';
                if(Object.keys(grouped).length === 0) {
                     this.dailyLogsContainer.innerHTML = '<p style="text-align:center; color: #777;">Belum ada catatan keuangan.</p>';
                     return;
                }
                Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'daily-log-group';
                    const dailyPemasukan = grouped[date].filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0);
                    const dailyPengeluaran = grouped[date].filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0);
                    groupDiv.innerHTML = `<h3 class="daily-header">${this.parent.formatTanggal(date)}</h3>
                    <div class="daily-summary"><span>Pemasukan: <b class="jumlah-pemasukan">${this.parent.formatRupiah(dailyPemasukan)}</b></span><span>Pengeluaran: <b class="jumlah-pengeluaran">${this.parent.formatRupiah(dailyPengeluaran)}</b></span></div>
                    <div class="table-wrapper"><table class="daily-table"><tbody>
                    ${grouped[date].map(t => `<tr>
                        <td width="60%">${t.jenis === 'pemasukan' ? t.deskripsi : `<ul class="rincian-list">${t.deskripsi.map(i => `<li><span>${i.item}</span><span>${this.parent.formatRupiah(i.jumlah)}</span></li>`).join('')}</ul>`}</td>
                        <td width="30%" class="jumlah-${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${this.parent.formatRupiah(t.jumlah)}</td>
                        <td width="10%"><button class="btn-hapus" onclick="app.keuangan.deleteTransaction(${t.id})">Hapus</button></td>
                    </tr>`).join('')}
                    </tbody></table></div>`;
                    this.dailyLogsContainer.appendChild(groupDiv);
                });
            },
            renderAnalytics(grouped) { /* ... (logika sama, plus logika dua grafik) ... */
                const dailySummaries = Object.keys(grouped).map(date => ({
                    date,
                    pemasukan: grouped[date].filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0),
                    pengeluaran: grouped[date].filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0),
                }));
                 if(dailySummaries.length > 0){
                    const hariUntung = dailySummaries.reduce((p, c) => ((p.pemasukan - p.pengeluaran) > (c.pemasukan - c.pengeluaran)) ? p : c);
                    const hariBoros = dailySummaries.reduce((p, c) => p.pengeluaran > c.pengeluaran ? p : c);
                    this.hariUntungEl.textContent = this.parent.formatTanggal(hariUntung.date);
                    this.hariBorosEl.textContent = this.parent.formatTanggal(hariBoros.date);
                    this.rataPemasukanEl.textContent = this.parent.formatRupiah(dailySummaries.reduce((s,d)=>s+d.pemasukan,0) / dailySummaries.length);
                } else {
                    this.hariUntungEl.textContent = 'N/A';
                    this.hariBorosEl.textContent = 'N/A';
                    this.rataPemasukanEl.textContent = 'Rp 0';
                }
                const last7DaysData = dailySummaries.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 7).reverse();
                const labels = last7DaysData.map(d => new Intl.DateTimeFormat('id-ID', {day: '2-digit', month: 'short'}).format(new Date(d.date+'T00:00:00')));
                
                if (this.incomeChart) this.incomeChart.destroy();
                this.incomeChart = new Chart(this.incomeChartCanvas, {type:'line', data:{labels, datasets:[{label:'Pemasukan', data:last7DaysData.map(d=>d.pemasukan), borderColor: 'rgba(67, 160, 71, 1)', backgroundColor: 'rgba(67, 160, 71, 0.2)', fill:true, tension: 0.3}]}});
                
                if (this.expenseChart) this.expenseChart.destroy();
                this.expenseChart = new Chart(this.expenseChartCanvas, {type:'line', data:{labels, datasets:[{label:'Pengeluaran', data:last7DaysData.map(d=>d.pengeluaran), borderColor: 'rgba(229, 57, 53, 1)', backgroundColor: 'rgba(229, 57, 53, 0.2)', fill:true, tension: 0.3}]}});
            },
        },

        // ======================= SUB-MODUL ABSENSI =======================
        absensi: {
            parent: null,
            init() { /* ... (sama seperti sebelumnya, hanya initSelectors & initListeners) ... */
                this.parent = app;
                this.initSelectors();
                this.initListeners();
                this.setDefaultDate();
                this.renderAll();
            },
            initSelectors() {
                this.formKaryawan = document.getElementById('form-tambah-karyawan');
                this.namaKaryawanInput = document.getElementById('nama-karyawan');
                this.listKaryawan = document.getElementById('list-karyawan');
                this.pilihMingguInput = document.getElementById('pilih-minggu');
                this.tabelAbsensiContainer = document.getElementById('tabel-absensi-container');
            },
            initListeners(){
                this.formKaryawan.addEventListener('submit', (e) => this.addEmployee(e));
                this.pilihMingguInput.addEventListener('change', () => this.renderAttendanceTable(new Date(this.pilihMingguInput.value)));
                this.tabelAbsensiContainer.addEventListener('change', (e) => this.handleCheckboxChange(e));
                document.getElementById('btn-clear-absensi').addEventListener('click', () => this.clearData());
            },
            save() { localStorage.setItem('employees_v6', JSON.stringify(this.parent.employees)); localStorage.setItem('attendance_v6', JSON.stringify(this.parent.attendance)); },
            clearData() { if(confirm('Hapus semua data KARYAWAN & ABSENSI?')){ this.parent.employees=[]; this.parent.attendance={}; this.save(); this.renderAll(); }},
            setDefaultDate() { this.pilihMingguInput.value = new Date().toISOString().slice(0, 10); },
            renderAll() { this.renderEmployees(); this.renderAttendanceTable(new Date(this.pilihMingguInput.value)); },
            renderEmployees() {
                this.listKaryawan.innerHTML = '';
                this.parent.employees.forEach(emp => {
                    const li = document.createElement('li');
                    li.textContent = emp;
                    li.innerHTML += `<button class="btn-hapus-karyawan" onclick="app.absensi.deleteEmployee('${emp}')">Hapus</button>`;
                    this.listKaryawan.appendChild(li);
                });
            },
            addEmployee(e) { /* ... (logika sama) ... */
                e.preventDefault();
                const newName = this.namaKaryawanInput.value.trim();
                if (newName && !this.parent.employees.includes(newName)) {
                    this.parent.employees.push(newName);
                    this.save();
                    this.renderAll();
                }
                this.namaKaryawanInput.value = '';
            },
            deleteEmployee(name) {
                if (confirm(`Yakin hapus karyawan "${name}"?`)) {
                    this.parent.employees = this.parent.employees.filter(emp => emp !== name);
                    this.save();
                    this.renderAll();
                }
            },
            renderAttendanceTable(selectedDate) {
                this.tabelAbsensiContainer.innerHTML = '';
                if (this.parent.employees.length === 0) {
                     this.tabelAbsensiContainer.innerHTML = '<p style="text-align:center; color: #777;">Belum ada karyawan. Tambahkan di atas.</p>';
                    return;
                }
                const weekDates = this.getWeekDates(selectedDate);
                const table = document.createElement('table');
                table.id = 'tabel-absensi';
                table.innerHTML = `<thead><tr><th>Karyawan</th>${weekDates.map(d => `<th>${new Intl.DateTimeFormat('id-ID',{weekday:'short'}).format(d)}<br>${d.getDate()}/${d.getMonth()+1}</th>`).join('')}</tr></thead>`;
                const tbody = table.createTBody();
                this.parent.employees.forEach(emp => {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td>${emp}</td>` + weekDates.map(d => {
                        const dateKey = d.toISOString().slice(0, 10);
                        const isPresent = this.parent.attendance[dateKey] && this.parent.attendance[dateKey][emp];
                        return `<td><input type="checkbox" class="absen-checkbox" data-date="${dateKey}" data-employee="${emp}" ${isPresent ? 'checked' : ''}></td>`;
                    }).join('');
                });
                this.tabelAbsensiContainer.appendChild(table);
            },
            getWeekDates(date) {
                const start = new Date(date);
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(start.setDate(diff));
                return Array.from({length: 7}, (_, i) => new Date(new Date(monday).setDate(monday.getDate() + i)));
            },
            handleCheckboxChange(e) {
                if (e.target.classList.contains('absen-checkbox')) {
                    const { date, employee } = e.target.dataset;
                    if (!this.parent.attendance[date]) this.parent.attendance[date] = {};
                    this.parent.attendance[date][employee] = e.target.checked;
                    this.save();
                }
            }
        }
    };
    
    app.init();
});
