// Data Model Initial Structure
const defaultCategories = [
    { id: 'cat_1', name: 'الهيكل الأسود', icon: 'hammer-outline', stages: ['القواعد والأساسات', 'الأعمدة', 'الأسقف', 'أعمال الطابوق'] },
    { id: 'cat_2', name: 'التشطيبات', icon: 'brush-outline', stages: ['المساح / البلاستر', 'الأرضيات', 'الأصباغ', 'الديكور والأسقف'] },
    { id: 'cat_3', name: 'الكهرباء والخدمات', icon: 'flash-outline', stages: ['تأسيس الكهرباء', 'التكييف', 'التوريدات النهائية'] },
    { id: 'cat_4', name: 'السباكة', icon: 'water-outline', stages: ['تأسيس الصحي', 'أطقم الحمامات', 'الفلتر المركزي'] }
];

let appData = {
    projectName: 'قسيمة 402',
    currency: 'د.ك',
    categories: [...defaultCategories],
    expenses: []
};

// DOM Elements
const viewContainers = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const viewTitle = document.getElementById('current-view-title');
const totalExpenseVal = document.getElementById('total-expense-val');
const recentList = document.getElementById('recent-list');
const categoryListContainer = document.getElementById('category-list-container');
const addExpenseModal = document.getElementById('add-expense-modal');
const addSubModal = document.getElementById('add-sub-modal');
const expenseForm = document.getElementById('expense-form');
const catSelect = document.getElementById('exp-category');
const stageSelect = document.getElementById('exp-stage');
const categoryChartCanvas = document.getElementById('categoryChart');

let categoryChart = null;

// Initialize App
function init() {
    loadData();
    setupNavigation();
    populateSelects();
    renderDashboard();
    renderCategories();
    renderReports();
    setupEventListeners();
}

// Persistence
function saveData() {
    localStorage.setItem('bunyan_data', JSON.stringify(appData));
}

function loadData() {
    const saved = localStorage.getItem('bunyan_data');
    if (saved) {
        appData = JSON.parse(saved);
    }
}

// Navigation
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            switchView(viewId);
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchView(viewId) {
    viewContainers.forEach(view => {
        view.classList.remove('active');
        if (view.id === `view-${viewId}`) {
            view.classList.add('active');
        }
    });

    const titles = {
        'dashboard': 'نظرة عامة',
        'categories': 'بنود البناء',
        'reports': 'التقارير المالية',
        'settings': 'الإعدادات'
    };
    viewTitle.textContent = titles[viewId];

    if (viewId === 'reports') renderReports();
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'categories') renderCategories();
}

// Rendering
function renderDashboard() {
    const total = appData.expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    totalExpenseVal.textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2 });

    recentList.innerHTML = '';
    if (appData.expenses.length === 0) {
        recentList.innerHTML = '<div class="empty-state">لا توجد مصروفات مضافة بعد.</div>';
        return;
    }

    const recent = [...appData.expenses].reverse().slice(0, 5);
    recent.forEach(exp => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="t-info">
                <span class="t-name">${exp.item}</span>
                <span class="t-meta">${exp.category} • ${exp.stage}</span>
            </div>
            <span class="t-amount">${parseFloat(exp.amount).toFixed(2)}</span>
        `;
        recentList.appendChild(item);
    });
}

function renderCategories() {
    categoryListContainer.innerHTML = '';
    appData.categories.forEach(cat => {
        const catExpenses = appData.expenses.filter(e => e.categoryId === cat.id);
        const total = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="cat-icon"><ion-icon name="${cat.icon}"></ion-icon></div>
            <div class="cat-details">
                <h4>${cat.name}</h4>
                <div class="cat-stats">${cat.stages.length} مراحل • ${total.toFixed(2)} ${appData.currency}</div>
            </div>
            <ion-icon name="chevron-back-outline"></ion-icon>
        `;
        categoryListContainer.appendChild(card);
    });
}

function renderReports() {
    if (categoryChart) categoryChart.destroy();

    const catData = appData.categories.map(cat => {
        const total = appData.expenses
            .filter(e => e.categoryId === cat.id)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        return { name: cat.name, total: total };
    });

    const labels = catData.map(d => d.name);
    const values = catData.map(d => d.total);

    categoryChart = new Chart(categoryChartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Tajawal' } }
                }
            },
            cutout: '70%'
        }
    });

    // Render detailed list in reports
    const reportList = document.getElementById('report-details-list');
    reportList.innerHTML = '<h3>تفاصيل البنود</h3>';
    catData.forEach(d => {
        if (d.total > 0) {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div class="t-info"><span class="t-name">${d.name}</span></div>
                <span class="t-amount">${d.total.toFixed(2)} ${appData.currency}</span>
            `;
            reportList.appendChild(item);
        }
    });
}

// Logic & Events
function populateSelects() {
    catSelect.innerHTML = appData.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    updateStageSelect();
}

function updateStageSelect() {
    const catId = catSelect.value;
    const cat = appData.categories.find(c => c.id === catId);
    if (cat) {
        stageSelect.innerHTML = cat.stages.map(s => `<option value="${s}">${s}</option>`).join('');
    }
}

function setupEventListeners() {
    document.getElementById('add-expense-btn').onclick = () => addExpenseModal.classList.add('active');
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            addExpenseModal.classList.remove('active');
            addSubModal.classList.remove('active');
        };
    });

    catSelect.onchange = updateStageSelect;

    expenseForm.onsubmit = (e) => {
        e.preventDefault();
        const newExpense = {
            id: Date.now(),
            categoryId: catSelect.value,
            category: catSelect.options[catSelect.selectedIndex].text,
            stage: stageSelect.value,
            item: document.getElementById('exp-item').value,
            amount: document.getElementById('exp-amount').value,
            notes: document.getElementById('exp-notes').value,
            date: new Date().toISOString()
        };

        appData.expenses.push(newExpense);
        saveData();
        renderDashboard();
        expenseForm.reset();
        addExpenseModal.classList.remove('active');
    };

    document.getElementById('add-new-stage-btn').onclick = () => {
        addSubModal.classList.add('active');
    };

    document.getElementById('save-sub-btn').onclick = () => {
        const val = document.getElementById('sub-modal-input').value;
        if (val) {
            const catId = catSelect.value;
            const cat = appData.categories.find(c => c.id === catId);
            if (cat && !cat.stages.includes(val)) {
                cat.stages.push(val);
                saveData();
                updateStageSelect();
                stageSelect.value = val;
                addSubModal.classList.remove('active');
                document.getElementById('sub-modal-input').value = '';
            }
        }
    };

    document.getElementById('reset-data').onclick = () => {
        if (confirm('هل أنت متأكد من مسح جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
            localStorage.clear();
            location.reload();
        }
    };

    // Project Settings
    document.getElementById('project-name-input').onchange = (e) => {
        appData.projectName = e.target.value;
        saveData();
    };

    document.getElementById('currency-input').onchange = (e) => {
        appData.currency = e.target.value;
        saveData();
    };

    // Export Excel
    document.getElementById('export-excel').onclick = () => {
        const worksheet = XLSX.utils.json_to_sheet(appData.expenses.map(e => ({
            'التاريخ': new Date(e.date).toLocaleDateString('ar-EG'),
            'البند': e.category,
            'المرحلة': e.stage,
            'نوع المصروف': e.item,
            'المبلغ': e.amount,
            'ملاحظات': e.notes
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "مصروفات البناء");
        XLSX.writeFile(workbook, `${appData.projectName}_مصروفات.xlsx`);
    };

    // Export PDF
    document.getElementById('export-pdf').onclick = () => {
        const element = document.getElementById('view-reports').cloneNode(true);
        element.style.color = '#000';
        element.style.background = '#fff';
        const opt = {
            margin: 1,
            filename: `${appData.projectName}_تقرير.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    // Backup JSON
    document.getElementById('export-json').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${appData.projectName}_backup.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // Import JSON
    document.getElementById('import-trigger').onclick = () => document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (importedData.expenses && importedData.categories) {
                    appData = importedData;
                    saveData();
                    location.reload();
                } else {
                    alert('ملف غير صالح');
                }
            } catch (err) {
                alert('خطأ في قراءة الملف');
            }
        };
        reader.readAsText(file);
    };
}

init();
