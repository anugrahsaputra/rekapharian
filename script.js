document.addEventListener('DOMContentLoaded', () => {
    const app = {
        transactions: JSON.parse(localStorage.getItem('transactions_v7')) || [],
        employees: JSON.parse(localStorage.getItem('employees_v7')) || [],
        schedule: JSON.parse(localStorage.getItem('schedule_v7')) || {},
        
        router() {
            const hash = window.location.hash || '#/keuangan';
            const targetPage = hash.substring(2);
            this.showPage(targetPage);
        },
        showPage(page) {
            const appRoot = document.getElementById('app-root');
            appRoot.innerHTML = '';
            const templateId = `template-${page}`;
            const template = document.getElementById(templateId);
            if (template) {
                appRoot.appendChild(template.content.cloneNode(true));
                if (page === 'keuangan') this.keuangan.init();
                if (page === 'absensi') this.absensi.init();
            } else {
                window.location.hash = '#/keuangan';
            }
            this.updateActiveNav(page);
        },
        updateActiveNav(activePage) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#/${activePage}`);
            });
        },
        init() {
            window.addEventListener('hashchange', () => this.router());
            if (!window.location.hash) {
                window.location.replace(window.location.pathname + '#/keuangan');
            } else {
                this.router();
            }
        },
        formatRupiah: (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n),
        formatTanggal: (dStr) => {
            const date = new Date(dStr + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
            if(date.getTime() === today.getTime()) return 'Hari Ini';
            if(date.getTime() === yesterday.getTime()) return 'Kemarin';
            return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
        },

        keuangan: {
            parent: null,
            init() { 
                this.parent = app; this.initSelectors(); this.initListeners();
                this.setDefaultDate(); this.toggleForm(); this.renderAll();
            },
            initSelectors() {
                this.formTransaksi = document.getElementById('form-transaksi'); this.tanggalInput = document.getElementById('tanggal'); this.jenisInput = document.getElementById('jenis'); this.jumlahInput = document.getElementById('jumlah');
                this.pemasukanFields = document.getElementById('pemasukan-form-fields'); this.pengeluaranFields = document.getElementById('pengeluaran-form-fields');
                this.deskripsiPemasukanInput = document.getElementById('deskripsi-pemasukan'); this.pengeluaranItemsList = document.getElementById('pengeluaran-items-list');
                this.btnTambahItem = document.getElementById('btn-tambah-item'); this.totalPemasukanEl = document.getElementById('total-pemasukan');
                this.totalPengeluaranEl = document.getElementById('total-pengeluaran'); this.hasilBersihEl = document.getElementById('hasil-bersih');
                this.dailyLogsContainer = document.getElementById('daily-logs-container'); this.chartCanvas = document.getElementById('statementChart')?.getContext('2d');
                this.statementChart = null;
            },
            initListeners(){
                this.formTransaksi.addEventListener('submit', (e) => this.addTransaction(e));
                this.jenisInput.addEventListener('change', () => this.toggleForm());
                this.btnTambahItem.addEventListener('click', () => this.addPengeluaranItem());
                document.getElementById('btn-clear-keuangan').addEventListener('click', () => this.clearData());
                document.getElementById('btn-download').addEventListener('click', () => this.downloadCSV());
                this.dailyLogsContainer.addEventListener('click', (e) => {
                    if (e.target && e.target.classList.contains('btn-hapus')) {
                        this.deleteTransaction(e.target.dataset.id);
                    }
                });
            },
            save() { localStorage.setItem('transactions_v7', JSON.stringify(this.parent.transactions)); },
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
                const itemDiv = document.createElement('div'); itemDiv.className = 'pengeluaran-item';
                itemDiv.innerHTML = `<input type="text" class="item-deskripsi" placeholder="Deskripsi item" required><input type="number" class="item-jumlah" placeholder="Jumlah" required><button type="button" class="btn-hapus-item">X</button>`;
                this.pengeluaranItemsList.appendChild(itemDiv);
                itemDiv.querySelector('.btn-hapus-item').addEventListener('click', () => { itemDiv.remove(); this.updateTotalPengeluaran(); });
                itemDiv.querySelector('.item-jumlah').addEventListener('input', () => this.updateTotalPengeluaran());
            },
            updateTotalPengeluaran() {
                if (this.jenisInput.value === 'pengeluaran') {
                    this.jumlahInput.value = [...this.pengeluaranItemsList.querySelectorAll('.item-jumlah')].reduce((s, i) => s + (+i.value || 0), 0);
                }
            },
            addTransaction(e) {
                e.preventDefault(); let deskripsi;
                if(this.jenisInput.value === 'pemasukan'){
                    deskripsi = this.deskripsiPemasukanInput.value.trim();
                    if (!deskripsi || !this.jumlahInput.value) { alert('Deskripsi & jumlah harus diisi!'); return; }
                } else {
                    deskripsi = []; const items = this.pengeluaranItemsList.querySelectorAll('.pengeluaran-item');
                    for (const item of items) {
                        const d = item.querySelector('.item-deskripsi').value.trim(); const j = +item.querySelector('.item-jumlah').value;
                        if (!d || j <= 0) { alert('Rincian pengeluaran harus diisi!'); return; }
                        deskripsi.push({ item: d, jumlah: j });
                    }
                    if (deskripsi.length === 0) { alert('Tambah item pengeluaran!'); return; }
                }
                this.parent.transactions.push({ id: Date.now(), tanggal: this.tanggalInput.value, jenis: this.jenisInput.value, jumlah: +this.jumlahInput.value, deskripsi });
                this.save(); this.renderAll(); this.formTransaksi.reset();
                this.pengeluaranItemsList.innerHTML = ''; this.setDefaultDate(); this.toggleForm();
            },
            deleteTransaction(id) {
                if(confirm('Hapus catatan ini?')) {
                    this.parent.transactions = this.parent.transactions.filter(t => t.id != id);
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
                this.renderDailyLogs(grouped); this.renderChart(grouped);
            },
            renderDailyLogs(grouped) {
                this.dailyLogsContainer.innerHTML = '';
                if(Object.keys(grouped).length === 0) { this.dailyLogsContainer.innerHTML = '<p style="text-align:center; color: #777; padding: 2rem 0;">Belum ada catatan keuangan.</p>'; return; }
                Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
                    const groupDiv = document.createElement('div'); groupDiv.className = 'daily-log-group';
                    const dailyPemasukan = grouped[date].filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0);
                    const dailyPengeluaran = grouped[date].filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0);
                    groupDiv.innerHTML = `<h3 class="daily-header">${this.parent.formatTanggal(date)}</h3>
                    <div class="daily-summary"><span>Pemasukan: <b class="jumlah-pemasukan">${this.parent.formatRupiah(dailyPemasukan)}</b></span><span>Pengeluaran: <b class="jumlah-pengeluaran">${this.parent.formatRupiah(dailyPengeluaran)}</b></span></div>
                    <div class="table-wrapper"><table class="daily-table"><tbody>
                    ${grouped[date].map(t => `<tr>
                        <td width="60%">${t.jenis === 'pemasukan' ? t.deskripsi : `<ul class="rincian-list">${t.deskripsi.map(i => `<li><span>${i.item}</span><span>${this.parent.formatRupiah(i.jumlah)}</span></li>`).join('')}</ul>`}</td>
                        <td width="30%" class="jumlah-${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${this.parent.formatRupiah(t.jumlah)}</td>
                        <td width="10%"><button class="btn-hapus" data-id="${t.id}">Hapus</button></td>
                    </tr>`).join('')}
                    </tbody></table></div>`;
                    this.dailyLogsContainer.appendChild(groupDiv);
                });
            },
            renderChart(grouped) {
                if (!this.chartCanvas) return; if (this.statementChart) this.statementChart.destroy();
                const today = new Date(); const labels = Array.from({length: 7}, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - i); return d; }).reverse();
                const dataIn = labels.map(labelDate => { const dateKey = labelDate.toISOString().slice(0, 10); return grouped[dateKey]?.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0) || 0; });
                const dataOut = labels.map(labelDate => { const dateKey = labelDate.toISOString().slice(0, 10); return grouped[dateKey]?.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0) || 0; });
                const expenseGradient = this.chartCanvas.createLinearGradient(0, 0, 0, 180);
                expenseGradient.addColorStop(0, 'rgba(229, 57, 53, 0.4)'); expenseGradient.addColorStop(1, 'rgba(16, 142, 233, 0)');
                this.statementChart = new Chart(this.chartCanvas, { type: 'line', data: {
                    labels: labels.map(d => new Intl.DateTimeFormat('id-ID', {day:'numeric', month:'short'}).format(d)),
                    datasets: [{ label: 'Pemasukan', data: dataIn, borderColor: '#43a047', pointBackgroundColor: '#43a047', pointBorderColor: '#fff', tension: 0.4 }, { label: 'Pengeluaran', data: dataOut, borderColor: '#e53935', backgroundColor: expenseGradient, fill: true, pointBackgroundColor: '#e53935', pointBorderColor: '#fff', tension: 0.4 }]
                }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { ticks: { color: 'rgba(255,255,255,0.8)' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }});
            },
            downloadCSV() {
                if (this.parent.transactions.length === 0) { alert('Tidak ada data untuk diunduh.'); return; }
                let csvContent = "ID,Tanggal,Jenis,Jumlah,Rincian\n";
                [...this.parent.transactions].sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal)).forEach(t => {
                    let rincian = (t.jenis === 'pemasukan') ? t.deskripsi : t.deskripsi.map(item => `${item.item}: ${item.jumlah}`).join('; ');
                    const safeRincian = `"${rincian.replace(/"/g, '""')}"`;
                    csvContent += `${t.id},${t.tanggal},${t.jenis},${t.jumlah},${safeRincian}\n`;
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a'); link.setAttribute('href', URL.createObjectURL(blob));
                link.setAttribute('download', `rekap-keuangan-warmindo-${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            }
        },
        
        absensi: {
            parent: null,
            init() { 
                this.parent = app; this.initSelectors(); this.initListeners();
                this.setDefaultDate(); this.renderAll();
            },
            initSelectors() {
                this.formKaryawan = document.getElementById('form-tambah-karyawan'); this.namaKaryawanInput = document.getElementById('nama-karyawan');
                this.listKaryawan = document.getElementById('list-karyawan'); this.pilihMingguInput = document.getElementById('pilih-minggu');
                this.tabelAbsensiContainer = document.getElementById('tabel-absensi-container'); this.shiftSummaryContainer = document.getElementById('shift-summary-container');
            },
            initListeners(){
                this.formKaryawan.addEventListener('submit', (e) => this.addEmployee(e));
                this.pilihMingguInput.addEventListener('change', () => this.renderAttendanceTable(new Date(this.pilihMingguInput.value)));
                this.tabelAbsensiContainer.addEventListener('change', (e) => this.handleScheduleChange(e));
                document.getElementById('btn-clear-absensi').addEventListener('click', () => this.clearData());
                this.listKaryawan.addEventListener('click', e => {
                    if (e.target && e.target.classList.contains('btn-hapus-karyawan')) {
                        this.deleteEmployee(e.target.dataset.name);
                    }
                });
            },
            save() { localStorage.setItem('employees_v7', JSON.stringify(this.parent.employees)); localStorage.setItem('schedule_v7', JSON.stringify(this.parent.schedule)); },
            clearData() { if(confirm('Hapus semua data KARYAWAN & JADWAL?')){ this.parent.employees=[]; this.parent.schedule={}; this.save(); this.renderAll(); }},
            setDefaultDate() { this.pilihMingguInput.value = new Date().toISOString().slice(0, 10); },
            renderAll() { this.renderEmployees(); this.renderAttendanceTable(new Date(this.pilihMingguInput.value)); },
            renderEmployees() {
                this.listKaryawan.innerHTML = '';
                this.parent.employees.forEach(emp => {
                    const li = document.createElement('li'); li.textContent = emp;
                    li.innerHTML += `<button class="btn-hapus-karyawan" data-name="${emp}">Hapus</button>`;
                    this.listKaryawan.appendChild(li);
                });
            },
            addEmployee(e) {
                e.preventDefault(); const newName = this.namaKaryawanInput.value.trim();
                if (newName && !this.parent.employees.includes(newName)) { this.parent.employees.push(newName); this.save(); this.renderAll(); }
                this.namaKaryawanInput.value = '';
            },
            deleteEmployee(name) {
                if (confirm(`Yakin hapus karyawan "${name}"?`)) {
                    this.parent.employees = this.parent.employees.filter(emp => emp !== name);
                    Object.keys(this.parent.schedule).forEach(date => { delete this.parent.schedule[date][name]; });
                    this.save(); this.renderAll();
                }
            },
            renderAttendanceTable(selectedDate) {
                this.tabelAbsensiContainer.innerHTML = '';
                if (this.parent.employees.length === 0) { this.tabelAbsensiContainer.innerHTML = '<p style="text-align:center; color: #777;">Belum ada karyawan.</p>'; this.renderShiftSummary(null); return; }
                const weekDates = this.getWeekDates(selectedDate);
                const table = document.createElement('table'); table.id = 'tabel-absensi';
                table.innerHTML = `<thead><tr><th>Karyawan</th>${weekDates.map(d => `<th>${new Intl.DateTimeFormat('id-ID',{weekday:'short'}).format(d)}<br>${d.getDate()}</th>`).join('')}</tr></thead>`;
                const tbody = table.createTBody();
                const shiftOptions = ['Pilih Jadwal', 'Pagi', 'Siang', 'Malam', 'Libur'];
                this.parent.employees.forEach(emp => {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td>${emp}</td>` + weekDates.map(d => {
                        const dateKey = d.toISOString().slice(0, 10);
                        const currentShift = this.parent.schedule[dateKey]?.[emp] || 'Pilih Jadwal';
                        const shiftClass = `shift-${currentShift.toLowerCase().replace(' ', '-')}`;
                        const optionsHtml = shiftOptions.map(opt => `<option value="${opt}" ${opt === currentShift ? 'selected' : ''}>${opt}</option>`).join('');
                        return `<td><select class="shift-select ${shiftClass}" data-date="${dateKey}" data-employee="${emp}">${optionsHtml}</select></td>`;
                    }).join('');
                });
                this.tabelAbsensiContainer.appendChild(table); this.renderShiftSummary(weekDates);
            },
            renderShiftSummary(weekDates) {
                this.shiftSummaryContainer.innerHTML = ''; if (!weekDates) return;
                let summaryHtml = '<h3>Ringkasan Karyawan Masuk</h3><div class="summary-grid">';
                weekDates.forEach(date => {
                    const dateKey = date.toISOString().slice(0, 10); let workingCount = 0;
                    if (this.parent.schedule[dateKey]) { workingCount = Object.values(this.parent.schedule[dateKey]).filter(shift => shift !== 'Libur' && shift !== 'Pilih Jadwal').length; }
                    summaryHtml += `<div class="summary-day"><div class="day-name">${new Intl.DateTimeFormat('id-ID', {weekday:'long'}).format(date)}</div><div class="count">${workingCount} orang</div></div>`;
                });
                summaryHtml += '</div>'; this.shiftSummaryContainer.innerHTML = summaryHtml;
            },
            getWeekDates(date) {
                const start = new Date(date); const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(start.setDate(diff));
                return Array.from({length: 7}, (_, i) => new Date(new Date(monday).setDate(monday.getDate() + i)));
            },
            handleScheduleChange(e) {
                if (e.target && e.target.classList.contains('shift-select')) {
                    const selectEl = e.target;
                    const { date, emp
