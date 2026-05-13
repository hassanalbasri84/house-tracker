// Data Model Initial Structure
const defaultCategories = [
    { id: 'cat_5', name: 'المكاتب والرسوم', icon: 'business-outline', stages: ['رسوم الخرائط', 'رسوم البلدية', 'إشراف هندسي'] },
    { id: 'cat_1', name: 'الهيكل الأسود', icon: 'hammer-outline', stages: ['القواعد والأساسات', 'الأعمدة', 'الأسقف', 'أعمال الطابوق', 'عزل الأسطح'] },
    { id: 'cat_2', name: 'التشطيبات', icon: 'brush-outline', stages: ['المساح / البلاستر', 'الأرضيات', 'الأصباغ', 'الديكور والأسقف'] },
    { id: 'cat_3', name: 'الكهرباء والخدمات', icon: 'flash-outline', stages: ['تأسيس الكهرباء', 'التكييف', 'التوريدات النهائية'] },
    { id: 'cat_4', name: 'السباكة', icon: 'water-outline', stages: ['تأسيس الصحي', 'أطقم الحمامات', 'الفلتر المركزي'] },
    { id: 'cat_other', name: 'أخرى', icon: 'ellipsis-horizontal-outline', stages: ['عام'] }
];

let globalData = {
    projects: [],
    currentProjectId: null
};

let appData = null;

// DOM Elements
const viewContainers = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const viewTitle = document.getElementById('current-view-title');
const totalExpenseVal = document.getElementById('total-expense-val');
const recentList = document.getElementById('recent-list');
const categoryListContainer = document.getElementById('category-list-container');
const addExpenseModal = document.getElementById('add-expense-modal');
const expenseForm = document.getElementById('expense-form');
const catSelect = document.getElementById('exp-category');
const stageSelect = document.getElementById('exp-stage');
const categoryChartCanvas = document.getElementById('categoryChart');

let categoryChart = null;
let editingExpenseId = null;

// Initialize App
function init() {
    loadData();
    setupNavigation();
    setupEventListeners();
    updateProjectContext();
}

function ensureOtherCategory(cats) {
    if (!cats.find(c => c.id === 'cat_other')) {
        cats.push({ id: 'cat_other', name: 'أخرى', icon: 'ellipsis-horizontal-outline', stages: ['عام'] });
    }
    return cats;
}

// Persistence
function saveData() {
    localStorage.setItem('bunyan_data', JSON.stringify(globalData));
}

function loadData() {
    const saved = localStorage.getItem('bunyan_data');
    if (saved) {
        let parsed = JSON.parse(saved);
        if (!parsed.projects) {
            // Migrate
            globalData.currentProjectId = 'proj_1';
            globalData.projects = [
                {
                    id: 'proj_1',
                    projectName: parsed.projectName || 'قسيمة 402',
                    currency: parsed.currency || 'د.ك',
                    categories: ensureOtherCategory(parsed.categories || JSON.parse(JSON.stringify(defaultCategories))),
                    expenses: parsed.expenses || []
                }
            ];
        } else {
            globalData = parsed;
        }
    } else {
        const id = 'proj_' + Date.now();
        globalData.currentProjectId = id;
        globalData.projects = [
            {
                id: id,
                projectName: 'قسيمة 402',
                currency: 'د.ك',
                categories: JSON.parse(JSON.stringify(defaultCategories)),
                expenses: []
            }
        ];
    }
}

function updateProjectContext() {
    appData = globalData.projects.find(p => p.id === globalData.currentProjectId);
    if (!appData) {
        appData = globalData.projects[0];
        globalData.currentProjectId = appData.id;
    }
    document.getElementById('project-name-input').value = appData.projectName;
    document.getElementById('currency-input').value = appData.currency;
    document.getElementById('project-title-display').textContent = appData.projectName;
    
    populateProjectSelector();
    populateSelects();
    renderDashboard();
    renderCategories();
    renderReports();
}

function populateProjectSelector() {
    const sel = document.getElementById('project-selector');
    if(sel) {
        sel.innerHTML = globalData.projects.map(p => `<option value="${p.id}" ${p.id === globalData.currentProjectId ? 'selected' : ''}>${p.projectName}</option>`).join('');
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
    document.getElementById('currency-display').textContent = appData.currency;

    recentList.innerHTML = '';
    if (appData.expenses.length === 0) {
        recentList.innerHTML = '<div class="empty-state">لا توجد مصروفات مضافة بعد.</div>';
        return;
    }

    const recent = [...appData.expenses].reverse();
    recent.forEach(exp => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div class="t-info">
                <span class="t-name">${exp.item}</span>
                <span class="t-meta">${exp.category} • ${exp.stage}</span>
            </div>
            <span class="t-amount">${parseFloat(exp.amount).toFixed(2)}</span>
        `;
        item.onclick = () => openEditExpense(exp.id);
        recentList.appendChild(item);
    });
}

function renderCategories() {
    categoryListContainer.innerHTML = '';
    appData.categories.forEach((cat, catIdx) => {
        const catExpenses = appData.expenses.filter(e => e.categoryId === cat.id);
        const total = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="cat-reorder">
                    <button onclick="event.stopPropagation(); moveCategory('${cat.id}', 'up')"><ion-icon name="chevron-up-outline"></ion-icon></button>
                    <button onclick="event.stopPropagation(); moveCategory('${cat.id}', 'down')"><ion-icon name="chevron-down-outline"></ion-icon></button>
                </div>
                <div class="cat-icon"><ion-icon name="${cat.icon}"></ion-icon></div>
                <div class="cat-details">
                    <h4>${cat.name}</h4>
                    <div class="cat-stats">${cat.stages.length} مراحل • ${total.toFixed(2)} ${appData.currency}</div>
                </div>
                ${cat.id !== 'cat_other' ? `
                <div class="cat-actions">
                    <button onclick="event.stopPropagation(); editCategory('${cat.id}')"><ion-icon name="create-outline"></ion-icon></button>
                    <button onclick="event.stopPropagation(); deleteCategory('${cat.id}')"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
                ` : ''}
                <ion-icon name="chevron-down-outline" style="margin-right: 10px;"></ion-icon>
            </div>
            <div class="category-body">
                <div class="stage-list">
                    ${cat.stages.map((stage, idx) => {
                        const stageExpenses = catExpenses.filter(e => e.stage === stage);
                        const stageTotal = stageExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                        return `
                        <div class="stage-item">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="cat-reorder" style="flex-direction: row; gap: 5px;">
                                    <button onclick="event.stopPropagation(); moveStage('${cat.id}', ${idx}, 'up')"><ion-icon name="caret-up-outline"></ion-icon></button>
                                    <button onclick="event.stopPropagation(); moveStage('${cat.id}', ${idx}, 'down')"><ion-icon name="caret-down-outline"></ion-icon></button>
                                </div>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-weight: 500;">${stage}</span>
                                    <span class="stage-total">${stageTotal.toFixed(2)} ${appData.currency}</span>
                                </div>
                            </div>
                            ${(cat.id !== 'cat_other' || stage !== 'عام') ? `
                            <div class="stage-actions">
                                <button onclick="editStage('${cat.id}', ${idx})"><ion-icon name="create-outline"></ion-icon></button>
                                <button onclick="deleteStage('${cat.id}', ${idx})"><ion-icon name="trash-outline"></ion-icon></button>
                            </div>
                            ` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
                ${cat.id !== 'cat_other' ? `
                <button class="inline-add" style="width: 100%; text-align: right; padding: 10px 0;" onclick="addStagePrompt('${cat.id}')">+ إضافة مرحلة جديدة</button>
                ` : ''}
            </div>
        `;
        categoryListContainer.appendChild(card);
    });
}

window.moveCategory = (catId, direction) => {
    const idx = appData.categories.findIndex(c => c.id === catId);
    if (direction === 'up' && idx > 0) {
        [appData.categories[idx], appData.categories[idx-1]] = [appData.categories[idx-1], appData.categories[idx]];
    } else if (direction === 'down' && idx < appData.categories.length - 1) {
        [appData.categories[idx], appData.categories[idx+1]] = [appData.categories[idx+1], appData.categories[idx]];
    }
    saveData();
    renderCategories();
};

window.moveStage = (catId, stageIdx, direction) => {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return;
    if (direction === 'up' && stageIdx > 0) {
        [cat.stages[stageIdx], cat.stages[stageIdx-1]] = [cat.stages[stageIdx-1], cat.stages[stageIdx]];
    } else if (direction === 'down' && stageIdx < cat.stages.length - 1) {
        [cat.stages[stageIdx], cat.stages[stageIdx+1]] = [cat.stages[stageIdx+1], cat.stages[stageIdx]];
    }
    saveData();
    renderCategories();
};

function renderReports() {
    if (categoryChart) categoryChart.destroy();

    const catData = appData.categories.map(cat => {
        const catExpenses = appData.expenses.filter(e => e.categoryId === cat.id);
        const total = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        const stages = cat.stages.map(stage => {
            const sExps = catExpenses.filter(e => e.stage === stage);
            return {
                name: stage,
                total: sExps.reduce((sum, e) => sum + parseFloat(e.amount), 0),
                expenses: sExps
            };
        }).filter(s => s.total > 0);

        return { id: cat.id, name: cat.name, total: total, stages: stages };
    }).filter(c => c.total > 0);

    const labels = catData.map(d => d.name);
    const values = catData.map(d => d.total);

    categoryChart = new Chart(categoryChartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b', '#ef4444', '#14b8a6'],
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

    const reportList = document.getElementById('report-details-list');
    reportList.innerHTML = '<h3 style="margin-bottom: 15px;">ملخص المصروفات المبوب</h3>';
    
    catData.forEach(cat => {
        const catEl = document.createElement('div');
        catEl.style.marginBottom = '20px';
        catEl.innerHTML = `
            <div style="background: var(--accent-color); color: white; padding: 10px; border-radius: 10px; display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px;">
                <span>${cat.name}</span>
                <span>${cat.total.toFixed(2)} ${appData.currency}</span>
            </div>
            ${cat.stages.map(stage => `
                <div style="margin-right: 15px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--accent-color); font-weight: 600; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-bottom: 5px;">
                        <span>${stage.name}</span>
                        <span>${stage.total.toFixed(2)}</span>
                    </div>
                    ${stage.expenses.map(e => `
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 5px 0;">
                            <span>- ${e.item}</span>
                            <span style="color: var(--text-secondary);">${parseFloat(e.amount).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
        reportList.appendChild(catEl);
    });
}

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

function openEditExpense(id) {
    editingExpenseId = id;
    const exp = appData.expenses.find(e => e.id === id);
    if (!exp) return;
    
    catSelect.value = exp.categoryId;
    updateStageSelect();
    stageSelect.value = exp.stage;
    document.getElementById('exp-item').value = exp.item;
    document.getElementById('exp-amount').value = exp.amount;
    document.getElementById('exp-notes').value = exp.notes || '';
    
    document.getElementById('modal-expense-title').textContent = 'تعديل المصروف';
    document.getElementById('delete-expense-btn').style.display = 'block';
    addExpenseModal.classList.add('active');
}

// Logic & Events
function setupEventListeners() {
    document.getElementById('add-expense-btn').onclick = () => {
        editingExpenseId = null;
        expenseForm.reset();
        document.getElementById('modal-expense-title').textContent = 'إضافة مصروف جديد';
        document.getElementById('delete-expense-btn').style.display = 'none';
        populateSelects();
        addExpenseModal.classList.add('active');
    };
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            addExpenseModal.classList.remove('active');
        };
    });

    catSelect.onchange = updateStageSelect;

    expenseForm.onsubmit = (e) => {
        e.preventDefault();
        const catName = catSelect.options[catSelect.selectedIndex].text;
        if (editingExpenseId) {
            const exp = appData.expenses.find(e => e.id === editingExpenseId);
            if (exp) {
                exp.categoryId = catSelect.value;
                exp.category = catName;
                exp.stage = stageSelect.value;
                exp.item = document.getElementById('exp-item').value;
                exp.amount = document.getElementById('exp-amount').value;
                exp.notes = document.getElementById('exp-notes').value;
            }
        } else {
            const newExpense = {
                id: Date.now() + Math.random(),
                categoryId: catSelect.value,
                category: catName,
                stage: stageSelect.value,
                item: document.getElementById('exp-item').value,
                amount: document.getElementById('exp-amount').value,
                notes: document.getElementById('exp-notes').value,
                date: new Date().toISOString()
            };
            appData.expenses.push(newExpense);
        }
        saveData();
        updateProjectContext();
        addExpenseModal.classList.remove('active');
    };

    document.getElementById('delete-expense-btn').onclick = () => {
        if(confirm('هل تريد فعلاً حذف هذا المصروف؟')) {
            appData.expenses = appData.expenses.filter(e => e.id !== editingExpenseId);
            saveData();
            updateProjectContext();
            addExpenseModal.classList.remove('active');
        }
    };

    document.getElementById('add-new-stage-btn').onclick = () => {
        const catId = catSelect.value;
        const cat = appData.categories.find(c => c.id === catId);
        if (cat) {
            const name = prompt('أدخل اسم المرحلة الجديدة:');
            if(name && !cat.stages.includes(name)) {
                cat.stages.push(name);
                saveData();
                updateStageSelect();
                stageSelect.value = name;
            }
        }
    };

    document.getElementById('reset-data').onclick = () => {
        if (confirm('تنبيه هام! هل أنت متأكد من مسح جميع المشاريع والبيانات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
            localStorage.removeItem('bunyan_data');
            location.reload();
        }
    };

    // Project Settings
    document.getElementById('project-selector').onchange = (e) => {
        globalData.currentProjectId = e.target.value;
        saveData();
        updateProjectContext();
    };

    document.getElementById('add-project-btn').onclick = () => {
        const name = prompt("أدخل اسم المشروع/الفيلا الجديدة:");
        if (name) {
            const id = 'proj_' + Date.now();
            globalData.projects.push({
                id: id,
                projectName: name,
                currency: 'د.ك',
                categories: JSON.parse(JSON.stringify(defaultCategories)),
                expenses: []
            });
            globalData.currentProjectId = id;
            saveData();
            updateProjectContext();
        }
    };

    document.getElementById('project-name-input').onchange = (e) => {
        appData.projectName = e.target.value;
        saveData();
        document.getElementById('project-title-display').textContent = appData.projectName;
        populateProjectSelector();
    };

    document.getElementById('currency-input').onchange = (e) => {
        appData.currency = e.target.value;
        saveData();
        renderDashboard();
        renderCategories();
        renderReports();
    };

    // Category Management
    document.getElementById('add-main-cat-btn').onclick = () => {
        const name = prompt('أدخل اسم البند الرئيسي الجديد:');
        if(name) {
            appData.categories.push({
                id: 'cat_' + Date.now(),
                name: name,
                icon: 'folder-outline',
                stages: ['عام']
            });
            saveData();
            updateProjectContext();
        }
    };

    window.editCategory = (catId) => {
        const cat = appData.categories.find(c => c.id === catId);
        if(cat) {
            const newName = prompt('تعديل اسم البند:', cat.name);
            if(newName && newName !== cat.name) {
                cat.name = newName;
                appData.expenses.forEach(e => {
                    if(e.categoryId === catId) e.category = newName;
                });
                saveData();
                updateProjectContext();
            }
        }
    };

    window.deleteCategory = (catId) => {
        const expensesCount = appData.expenses.filter(e => e.categoryId === catId).length;
        let confirmMsg = 'هل تريد فعلاً حذف هذا البند الرئيسي بجميع مراحله؟';
        if(expensesCount > 0) {
            confirmMsg = `يوجد ${expensesCount} مصروفات مسجلة تحت هذا البند. عند الحذف سيتم نقلها إلى بند "أخرى". هل أنت متأكد؟`;
        }
        
        if(confirm(confirmMsg)) {
            if(expensesCount > 0) {
                const otherCat = appData.categories.find(c => c.id === 'cat_other');
                appData.expenses.forEach(e => {
                    if(e.categoryId === catId) {
                        e.categoryId = 'cat_other';
                        e.category = otherCat.name;
                        if(!otherCat.stages.includes(e.stage)) e.stage = 'عام';
                    }
                });
            }
            appData.categories = appData.categories.filter(c => c.id !== catId);
            saveData();
            updateProjectContext();
        }
    };

    window.addStagePrompt = (catId) => {
        const cat = appData.categories.find(c => c.id === catId);
        if(cat) {
            const name = prompt('أدخل اسم المرحلة الجديدة:');
            if(name && !cat.stages.includes(name)) {
                cat.stages.push(name);
                saveData();
                updateProjectContext();
            }
        }
    };

    window.editStage = (catId, stageIndex) => {
        const cat = appData.categories.find(c => c.id === catId);
        if(cat) {
            const oldName = cat.stages[stageIndex];
            const newName = prompt('تعديل اسم المرحلة:', oldName);
            if(newName && newName !== oldName && !cat.stages.includes(newName)) {
                cat.stages[stageIndex] = newName;
                appData.expenses.forEach(e => {
                    if(e.categoryId === catId && e.stage === oldName) e.stage = newName;
                });
                saveData();
                updateProjectContext();
            }
        }
    };

    window.deleteStage = (catId, stageIndex) => {
        const cat = appData.categories.find(c => c.id === catId);
        if(cat) {
            const stageName = cat.stages[stageIndex];
            const expensesCount = appData.expenses.filter(e => e.categoryId === catId && e.stage === stageName).length;
            
            let confirmMsg = 'هل تريد حذف هذه المرحلة؟';
            if(expensesCount > 0) {
                confirmMsg = `يوجد ${expensesCount} مصروفات مسجلة في هذه المرحلة. عند الحذف سيتم نقلها إلى بند "أخرى". هل أنت متأكد؟`;
            }
            
            if(confirm(confirmMsg)) {
                if(expensesCount > 0) {
                    const otherCat = appData.categories.find(c => c.id === 'cat_other');
                    appData.expenses.forEach(e => {
                        if(e.categoryId === catId && e.stage === stageName) {
                            e.categoryId = 'cat_other';
                            e.category = otherCat.name;
                            e.stage = 'عام';
                        }
                    });
                }
                cat.stages.splice(stageIndex, 1);
                saveData();
                updateProjectContext();
            }
        }
    };

    // Exports & Imports
    document.getElementById('export-excel').onclick = () => {
        const rows = [];
        let grandTotal = 0;

        appData.categories.forEach(cat => {
            const catExps = appData.expenses.filter(e => e.categoryId === cat.id);
            if (catExps.length === 0) return;

            // Category Header
            rows.push({ 'التاريخ': `*** ${cat.name} ***`, 'البند': '', 'المرحلة': '', 'نوع المصروف': '', 'المبلغ': '', 'ملاحظات': '' });
            
            let catTotal = 0;
            cat.stages.forEach(stage => {
                const sExps = catExps.filter(e => e.stage === stage);
                if (sExps.length === 0) return;

                let stageTotal = 0;
                sExps.forEach(e => {
                    rows.push({
                        'التاريخ': new Date(e.date).toLocaleDateString('ar-EG'),
                        'البند': e.category,
                        'المرحلة': e.stage,
                        'نوع المصروف': e.item,
                        'المبلغ': parseFloat(e.amount),
                        'ملاحظات': e.notes || ''
                    });
                    stageTotal += parseFloat(e.amount);
                });

                // Stage Subtotal
                rows.push({ 'التاريخ': '', 'البند': '', 'المرحلة': `مجموع ${stage}`, 'نوع المصروف': '', 'المبلغ': stageTotal, 'ملاحظات': '' });
                catTotal += stageTotal;
            });

            // Category Total
            rows.push({ 'التاريخ': '', 'البند': `إجمالي ${cat.name}`, 'المرحلة': '', 'نوع المصروف': '', 'المبلغ': catTotal, 'ملاحظات': '' });
            rows.push({}); // Empty row for spacing
            grandTotal += catTotal;
        });

        rows.push({ 'التاريخ': 'الإجمالي الكلي', 'البند': '', 'المرحلة': '', 'نوع المصروف': '', 'المبلغ': grandTotal, 'ملاحظات': appData.currency });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير البنيان");
        XLSX.writeFile(workbook, `${appData.projectName}_تقرير_مفصل.xlsx`);
    };

    document.getElementById('import-excel-trigger').onclick = () => document.getElementById('import-excel-file').click();
    document.getElementById('import-excel-file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {raw: false});
            
            let importedCount = 0;
            rows.forEach(row => {
                const amount = parseFloat(row['المبلغ']);
                if(!isNaN(amount) && row['البند'] && row['نوع المصروف']) {
                    let catId = 'cat_other';
                    const cat = appData.categories.find(c => c.name === row['البند']);
                    if(cat) catId = cat.id;
                    else {
                        const otherCat = appData.categories.find(c => c.id === 'cat_other');
                        if (otherCat) catId = otherCat.id;
                    }

                    let stage = row['المرحلة'] || 'عام';
                    const actualCat = appData.categories.find(c => c.id === catId);
                    if(actualCat && !actualCat.stages.includes(stage)) {
                        actualCat.stages.push(stage);
                    }

                    appData.expenses.push({
                        id: Date.now() + Math.random(),
                        categoryId: catId,
                        category: actualCat ? actualCat.name : row['البند'],
                        stage: stage,
                        item: row['نوع المصروف'],
                        amount: amount.toString(),
                        notes: row['ملاحظات'] || '',
                        date: new Date().toISOString()
                    });
                    importedCount++;
                }
            });
            if(importedCount > 0) {
                saveData();
                updateProjectContext();
                alert(`تم استيراد ${importedCount} مصروف بنجاح!`);
            } else {
                alert('لم يتم العثور على بيانات صالحة. يرجى التأكد من تطابق الأعمدة مع نموذج التصدير.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = ''; 
    };

    document.getElementById('export-pdf').onclick = () => {
        window.scrollTo(0, 0);
        const originalCanvas = document.getElementById('categoryChart');
        let imgUrl = '';
        if(originalCanvas) {
            imgUrl = originalCanvas.toDataURL("image/png");
        }
        
        const element = document.createElement('div');
        element.style.padding = '20px';
        element.style.background = '#fff';
        element.style.color = '#000';
        element.style.direction = 'rtl';
        element.style.fontFamily = 'Tajawal, sans-serif';
        
        element.innerHTML = `
            <h2 style="text-align: center; margin-bottom: 20px; color: #f59e0b;">تقرير مصروفات - ${appData.projectName}</h2>
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${imgUrl}" style="max-width: 100%; height: auto;" />
            </div>
            <div>
                ${document.getElementById('report-details-list').innerHTML}
            </div>
        `;

        const opt = {
            margin: 0.5,
            filename: `${appData.projectName}_تقرير.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    document.getElementById('export-json').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Bunyan_Backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    document.getElementById('import-trigger').onclick = () => document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if(importedData.projects) {
                    globalData = importedData;
                } else if (importedData.expenses && importedData.categories) {
                    const id = 'proj_' + Date.now();
                    globalData.projects.push({
                        id: id,
                        projectName: importedData.projectName || 'مشروع مستورد',
                        currency: importedData.currency || 'د.ك',
                        categories: ensureOtherCategory(importedData.categories),
                        expenses: importedData.expenses
                    });
                    globalData.currentProjectId = id;
                }
                saveData();
                location.reload();
            } catch (err) {
                alert('خطأ في قراءة الملف');
            }
        };
        reader.readAsText(file);
    };
}

init();
