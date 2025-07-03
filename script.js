document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // --- State (Data) ---
        transactions: JSON.parse(localStorage.getItem('transactions_v6')) || [],
        employees: JSON.parse(localStorage.getItem('employees_v6')) || [],
        // PERUBAHAN: Ganti nama 'attendance' menjadi 'schedule'
        schedule: JSON.parse(localStorage.getItem('schedule_v7')) || {},
        
        // ... (router, showPage, init, formatRupiah, formatTanggal sama seperti sebelumnya) ...
        router() { /* ... */ },
        showPage(page) { /* ... */ },
        updateActiveNav(activePage) { /* ... */ },
        init() { /* ... */ },
        formatRupiah: (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n),
        formatTanggal: (dStr) => { /* ... */ },

        // ======================= SUB-MODUL KEUANGAN (Tidak ada perubahan) =======================
        keuangan: { /* ... (Seluruh modul keuangan sama seperti sebelumnya) ... */ },
        
        // ======================= SUB-MODUL ABSENSI (DIROMBAK TOTAL) =======================
        absensi: {
            parent: null,
            init() { 
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
                this.shiftSummaryContainer = document.getElementById('shift-summary-container');
            },
            initListeners(){
                this.formKaryawan.addEventListener('submit', (e) => this.addEmployee(e));
                this.pilihMingguInput.addEventListener('change', () => this.renderAttendanceTable(new Date(this.pilihMingguInput.value)));
                // Listener untuk seluruh tabel, menangani perubahan dropdown
                this.tabelAbsensiContainer.addEventListener('change', (e) => this.handleScheduleChange(e));
                document.getElementById('btn-clear-absensi').addEventListener('click', () => this.clearData());
                this.listKaryawan.addEventListener('click', e => {
                    if (e.target && e.target.classList.contains('btn-hapus-karyawan')) {
                        this.deleteEmployee(e.target.dataset.name);
                    }
                });
            },
            save() { 
                localStorage.setItem('employees_v6', JSON.stringify(this.parent.employees));
                localStorage.setItem('schedule_v7', JSON.stringify(this.parent.schedule)); 
            },
            clearData() { 
                if(confirm('Hapus semua data KARYAWAN & JADWAL?')){
                    this.parent.employees=[]; 
                    this.parent.schedule={}; 
                    this.save(); 
                    this.renderAll(); 
                }
            },
            setDefaultDate() { this.pilihMingguInput.value = new Date().toISOString().slice(0, 10); },
            renderAll() { 
                this.renderEmployees(); 
                this.renderAttendanceTable(new Date(this.pilihMingguInput.value)); 
            },
            renderEmployees() {
                this.listKaryawan.innerHTML = '';
                this.parent.employees.forEach(emp => {
                    const li = document.createElement('li');
                    li.textContent = emp;
                    li.innerHTML += `<button class="btn-hapus-karyawan" data-name="${emp}">Hapus</button>`;
                    this.listKaryawan.appendChild(li);
                });
            },
            addEmployee(e) {
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
                if (confirm(`Yakin hapus karyawan "${name}"? Semua data jadwalnya juga akan terhapus.`)) {
                    this.parent.employees = this.parent.employees.filter(emp => emp !== name);
                    Object.keys(this.parent.schedule).forEach(date => { delete this.parent.schedule[date][name]; });
                    this.save();
                    this.renderAll();
                }
            },
            // FUNGSI UTAMA YANG DIUBAH: Membuat tabel dengan dropdown
            renderAttendanceTable(selectedDate) {
                this.tabelAbsensiContainer.innerHTML = '';
                if (this.parent.employees.length === 0) { 
                    this.tabelAbsensiContainer.innerHTML = '<p style="text-align:center; color: #777;">Belum ada karyawan.</p>'; 
                    this.renderShiftSummary(null);
                    return; 
                }
                
                const weekDates = this.getWeekDates(selectedDate);
                const table = document.createElement('table');
                table.id = 'tabel-absensi';
                table.innerHTML = `<thead><tr><th>Karyawan</th>${weekDates.map(d => `<th>${new Intl.DateTimeFormat('id-ID',{weekday:'short'}).format(d)}<br>${d.getDate()}</th>`).join('')}</tr></thead>`;
                const tbody = table.createTBody();
                
                const shiftOptions = ['Pilih Jadwal', 'Pagi', 'Siang', 'Malam', 'Libur'];

                this.parent.employees.forEach(emp => {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td>${emp}</td>` + weekDates.map(d => {
                        const dateKey = d.toISOString().slice(0, 10);
                        const currentShift = this.parent.schedule[dateKey]?.[emp] || 'Pilih Jadwal';
                        const shiftClass = `shift-${currentShift.toLowerCase().replace(' ', '-')}`;

                        const optionsHtml = shiftOptions.map(opt => 
                            `<option value="${opt}" ${opt === currentShift ? 'selected' : ''}>${opt}</option>`
                        ).join('');

                        return `<td><select class="shift-select ${shiftClass}" data-date="${dateKey}" data-employee="${emp}">${optionsHtml}</select></td>`;
                    }).join('');
                });
                
                this.tabelAbsensiContainer.appendChild(table);
                this.renderShiftSummary(weekDates);
            },
            // FUNGSI BARU: Menampilkan ringkasan jumlah shift harian
            renderShiftSummary(weekDates) {
                this.shiftSummaryContainer.innerHTML = '';
                if (!weekDates) return;

                let summaryHtml = '<h3>Ringkasan Karyawan Masuk</h3><div class="summary-grid">';
                weekDates.forEach(date => {
                    const dateKey = date.toISOString().slice(0, 10);
                    let workingCount = 0;
                    if (this.parent.schedule[dateKey]) {
                        workingCount = Object.values(this.parent.schedule[dateKey]).filter(shift => shift !== 'Libur' && shift !== 'Pilih Jadwal').length;
                    }
                    summaryHtml += `
                        <div class="summary-day">
                            <div class="day-name">${new Intl.DateTimeFormat('id-ID', {weekday:'long'}).format(date)}</div>
                            <div class="count">${workingCount} orang</div>
                        </div>
                    `;
                });
                summaryHtml += '</div>';
                this.shiftSummaryContainer.innerHTML = summaryHtml;
            },
            getWeekDates(date) {
                const start = new Date(date); const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(start.setDate(diff));
                return Array.from({length: 7}, (_, i) => new Date(new Date(monday).setDate(monday.getDate() + i)));
            },
            // FUNGSI UTAMA YANG DIUBAH: Menangani perubahan dropdown
            handleScheduleChange(e) {
                if (e.target && e.target.classList.contains('shift-select')) {
                    const selectEl = e.target;
                    const { date, employee } = selectEl.dataset;
                    const newShift = selectEl.value;
                    
                    if (!this.parent.schedule[date]) this.parent.schedule[date] = {};
                    this.parent.schedule[date][employee] = newShift;
                    this.save();
                    
                    // Update warna dropdown
                    selectEl.className = 'shift-select'; // Reset class
                    selectEl.classList.add(`shift-${newShift.toLowerCase().replace(' ', '-')}`);
                    
                    // Update ringkasan shift
                    this.renderShiftSummary(this.getWeekDates(new Date(this.pilihMingguInput.value)));
                }
            }
        }
    };
    
    app.init();
});
