const defaultCategories = [
    { id: 'cat_office', name: 'المكاتب والرسوم', icon: 'business-outline', stages: ['رسوم الخرائط', 'رسوم البلدية', 'إشراف هندسي'] },
    { id: 'cat_black', name: 'الهيكل الأسود', icon: 'hammer-outline', stages: ['الحفر والتدعيم', 'القواعد والأساسات', 'الأعمدة والرقاب', 'الأسقف والجسور', 'أعمال الطابوق', 'المساح', 'عزل الأسطح'] },
    { id: 'cat_mep', name: 'الكهرباء والتكييف', icon: 'flash-outline', stages: ['تأسيس الكهرباء', 'الأسلاك', 'التشطيبات الكهربائية النهائية', 'التكييف المركزي', 'المصاعد', 'نظام السيكورتي والجرس'] },
    { id: 'cat_plumbing', name: 'السباكة والصحي', icon: 'water-outline', stages: ['تأسيس الصحي', 'أنابيب التغذية', 'جهاز تحلية المياه', 'خزان الماء', 'السخان', 'أطقم الحمامات'] },
    { id: 'cat_interior', name: 'التشطيبات الداخلية', icon: 'brush-outline', stages: ['الأرضيات والبورسلان', 'الأصباغ والديكور', 'النجارة والأبواب', 'الألمنيوم والزجاج'] },
    { id: 'cat_external', name: 'خدمات خارجية', icon: 'home-outline', stages: ['المظلات', 'بركة السباحة'] },
    { id: 'cat_labor', name: 'رسوم الأيدي العاملة', icon: 'people-outline', stages: ['البناء الأسود', 'الكهرباء', 'السباكة', 'الصباغة', 'الديكور'] },
    { id: 'cat_other', name: 'أخرى', icon: 'ellipsis-horizontal-outline', stages: ['عام'] }
];

let globalData = {
    currentProjectId: null,
    backups: [],
    actionCounter: 0,
    preRestoreState: null,
    trash: {
        projects: [],
        categories: [],
        stages: [],
        expenses: []
    }
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
let expandedCategoryId = null;

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
function saveData(isAction = false) {
    if (isAction) {
        globalData.actionCounter++;
        if (globalData.actionCounter >= 5) {
            createAutoBackup();
            globalData.actionCounter = 0;
        }
    }
    localStorage.setItem('bunyan_data', JSON.stringify(globalData));
}

function createAutoBackup() {
    const backup = {
        id: Date.now(),
        date: new Date().toLocaleString('ar-EG'),
        data: JSON.parse(JSON.stringify(globalData.projects)),
        currentId: globalData.currentProjectId
    };
    
    // Keep last 10 backups to save space
    globalData.backups.unshift(backup);
    if (globalData.backups.length > 10) {
        globalData.backups.pop();
    }
}

function loadData() {
    let saved = localStorage.getItem('bunyan_data');
    
    // Recovery check
    if (!saved) {
        // Check for ANY key that might contain data
        const keys = ['bonyan_data', 'house_data', 'expenses', 'expenses_data'];
        for (const k of keys) {
            const d = localStorage.getItem(k);
            if (d) { saved = d; break; }
        }
    }

    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            if (!parsed.projects) {
                // Legacy Migration
                const id = 'proj_1';
                globalData.projects = [{
                    id: id,
                    projectName: parsed.projectName || 'مشروع منتقل',
                    currency: parsed.currency || 'د.ب',
                    categories: ensureOtherCategory(parsed.categories || JSON.parse(JSON.stringify(defaultCategories))),
                    expenses: parsed.expenses || []
                }];
                globalData.currentProjectId = id;
            } else {
                globalData = parsed;
            }

            // Initialization of new fields
            if (!globalData.backups) globalData.backups = [];
            if (!globalData.actionCounter) globalData.actionCounter = 0;
            if (!globalData.trash) {
                globalData.trash = { projects: [], categories: [], stages: [], expenses: [] };
            }
        } catch (e) {
            console.error("Data load error", e);
        }
    } else {
        const id = 'proj_' + Date.now();
        globalData.projects = [{
            id: id, projectName: 'قسيمة 402', currency: 'د.ب',
            categories: JSON.parse(JSON.stringify(defaultCategories)), expenses: []
        }];
        globalData.currentProjectId = id;
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
    document.getElementById('budget-input').value = appData.budget || '';
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
    if (viewId === 'settings') {
        renderBackups();
        renderTrash();
    }
}

// Rendering
function renderDashboard() {
    const total = appData.expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const budget = parseFloat(appData.budget) || 0;
    const remaining = budget - total;

    totalExpenseVal.textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById('currency-display').textContent = appData.currency;
    
    document.getElementById('total-budget-val').textContent = budget.toLocaleString(undefined, { minimumFractionDigits: 2 });
    
    const remainingEl = document.getElementById('remaining-budget-val');
    remainingEl.textContent = remaining.toLocaleString(undefined, { minimumFractionDigits: 2 });
    if (remaining < 0) {
        remainingEl.style.color = 'var(--danger-color)';
    } else {
        remainingEl.style.color = 'var(--text-primary)';
    }

    recentList.innerHTML = '';
    if (appData.expenses.length === 0) {
        recentList.innerHTML = '<div class="empty-state">لا توجد مصروفات مضافة بعد.</div>';
        return;
    }

    const recent = [...appData.expenses].reverse();
    recent.forEach(exp => {
        const container = document.createElement('div');
        container.className = 'swipe-container';
        container.innerHTML = `
            <div class="swipe-action delete"><ion-icon name="trash-outline"></ion-icon> <span>حذف</span></div>
            <div class="swipe-action edit"><span>تعديل</span> <ion-icon name="create-outline"></ion-icon></div>
            <div class="swipe-item transaction-item" style="cursor: pointer; margin-bottom: 0;" onclick="const noteEl = this.querySelector('.exp-note-display'); if(noteEl) noteEl.style.display = noteEl.style.display === 'none' ? 'block' : 'none';">
                <div class="t-info">
                    <span class="t-name">${exp.item}</span>
                    <span class="t-meta">${exp.category} • ${exp.stage}</span>
                    <div class="exp-note-display" style="display: none; color: var(--accent-color); font-style: italic; font-size: 0.75rem; margin-top: 4px; padding-right: 8px; border-right: 2px solid var(--accent-color);">
                        <span style="display:block; color: var(--text-secondary); font-size: 0.7rem; font-style: normal; margin-bottom: 2px;">أضيف في: ${new Date(exp.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        ${exp.notes ? `ملاحظة: ${exp.notes}` : ''}
                    </div>
                </div>
                <span class="t-amount">${parseFloat(exp.amount).toFixed(2)}</span>
            </div>
        `;
        
        setupSwipe(container, {
            onSwipeRight: () => deleteExpense(exp.id),
            onSwipeLeft: () => openEditExpense(exp.id)
        });
        
        recentList.appendChild(container);
    });
}

function deleteExpense(id) {
    if(confirm('هل تريد فعلاً حذف هذا المصروف؟')) {
        const expense = appData.expenses.find(e => e.id === id);
        if (expense) {
            globalData.trash.expenses.push(expense);
        }
        appData.expenses = appData.expenses.filter(e => e.id !== id);
        saveData();
        updateProjectContext();
    } else {
        renderDashboard(); // Snap back
    }
}

function renderCategories() {
    categoryListContainer.innerHTML = '';
    appData.categories.forEach((cat, catIdx) => {
        const isExpanded = expandedCategoryId === cat.id;
        const catExpenses = appData.expenses.filter(e => e.categoryId === cat.id);
        const total = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        const card = document.createElement('div');
        card.className = 'swipe-container category-swipe-container';
        card.setAttribute('data-id', cat.id);
        card.innerHTML = `
            <div class="swipe-action delete" style="border-radius: 20px;"><ion-icon name="trash-outline"></ion-icon><span>حذف</span></div>
            <div class="swipe-action edit" style="border-radius: 20px;"><ion-icon name="create-outline"></ion-icon><span>تعديل</span></div>
            <div class="swipe-item category-card ${isExpanded ? 'expanded' : ''}" style="border-radius: 20px;">
                <div class="category-header">
                    <div class="drag-handle"><ion-icon name="reorder-two-outline"></ion-icon></div>
                    <div class="cat-icon"><ion-icon name="${cat.icon}"></ion-icon></div>
                    <div class="cat-details">
                        <h4>${cat.name}</h4>
                        <div class="cat-stats">${cat.stages.length} مراحل • ${total.toFixed(2)} ${appData.currency}</div>
                    </div>
                    <ion-icon name="chevron-down-outline" style="margin-right: 10px;"></ion-icon>
                </div>
                <div class="category-body">
                    <div class="stage-list" data-cat-id="${cat.id}">
                        ${cat.stages.map((stage, idx) => {
                            const stageExpenses = catExpenses.filter(e => e.stage === stage);
                            const stageTotal = stageExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                            return `
                                <div class="swipe-container stage-swipe-container" data-cat-id="${cat.id}" data-idx="${idx}" style="margin-bottom: 5px;">
                                    <div class="swipe-action delete" style="border-radius: 12px;"><ion-icon name="trash-outline"></ion-icon></div>
                                    <div class="swipe-action edit" style="border-radius: 12px;"><ion-icon name="create-outline"></ion-icon></div>
                                    <div class="swipe-item stage-item" data-name="${stage}" style="border-radius: 12px; padding: 10px; border: 1px solid var(--border-color);">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div class="drag-handle" style="font-size: 1rem;"><ion-icon name="reorder-two-outline"></ion-icon></div>
                                            <div style="display: flex; flex-direction: column;">
                                                <span style="font-weight: 500;">${stage}</span>
                                                <span class="stage-total">${stageTotal.toFixed(2)} ${appData.currency}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${cat.id !== 'cat_other' ? `
                    <button class="inline-add" style="width: 100%; text-align: right; padding: 10px 0;" onclick="addStagePrompt('${cat.id}')">+ إضافة مرحلة جديدة</button>
                    ` : ''}
                </div>
            </div>
        `;

        setupSwipe(card, {
            onSwipeRight: () => deleteCategory(cat.id),
            onSwipeLeft: () => editCategory(cat.id)
        });

        const header = card.querySelector('.category-header');
        header.onclick = () => {
            const innerCard = card.querySelector('.category-card');
            const wasExpanded = innerCard.classList.contains('expanded');
            document.querySelectorAll('.category-card').forEach(c => c.classList.remove('expanded'));
            if (!wasExpanded) {
                innerCard.classList.add('expanded');
                expandedCategoryId = cat.id;
            } else {
                expandedCategoryId = null;
            }
        };

        categoryListContainer.appendChild(card);
    });

    // Initialize Sortable for categories
    new Sortable(categoryListContainer, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: function () {
            const newOrder = Array.from(categoryListContainer.querySelectorAll('.category-card')).map(el => el.getAttribute('data-id'));
            appData.categories.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            saveData();
            // We don't re-render here to prevent losing expanded state/flickering
        }
    });

    // Initialize Sortable for stages
    document.querySelectorAll('.stage-list').forEach(list => {
        const catId = list.getAttribute('data-cat-id');
        
        // Initialize Swipe for each stage
        list.querySelectorAll('.stage-swipe-container').forEach(sContainer => {
            const idx = parseInt(sContainer.getAttribute('data-idx'));
            const stageName = appData.categories.find(c => c.id === catId).stages[idx];
            
            if (catId !== 'cat_other' || stageName !== 'عام') {
                setupSwipe(sContainer, {
                    onSwipeRight: () => deleteStage(catId, idx),
                    onSwipeLeft: () => editStage(catId, idx)
                });
            }
        });

        new Sortable(list, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: function () {
                const cat = appData.categories.find(c => c.id === catId);
                const newOrder = Array.from(list.querySelectorAll('.stage-item')).map(el => el.getAttribute('data-name'));
                cat.stages.sort((a, b) => newOrder.indexOf(a) - newOrder.indexOf(b));
                saveData();
                renderCategories(); // Re-render to update idx attributes
            }
        });
    });
}

// Swipe Implementation
function setupSwipe(container, actions) {
    const children = Array.from(container.children);
    const item = children.find(c => c.classList.contains('swipe-item'));
    const delBtn = children.find(c => c.classList.contains('swipe-action') && c.classList.contains('delete'));
    const editBtn = children.find(c => c.classList.contains('swipe-action') && c.classList.contains('edit'));
    
    if (!item) return;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let hasMoved = false;
    let revealed = 0;
    let holdTimer = null;
    let canSwipe = false;
    
    const threshold = 35;
    const buttonWidth = 80;

    const onStart = (e) => {
        e.stopPropagation();
        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        canSwipe = false;
        isDragging = false;
        hasMoved = false;
        
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
            canSwipe = true;
            item.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
            item.style.transform = 'scale(0.97)';
            item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            if(window.navigator.vibrate) window.navigator.vibrate(30);
        }, 300);

        item.style.transition = 'none';
    };

    const onMove = (e) => {
        const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const delta = (x - startX);

        if (!canSwipe) {
            if (Math.abs(delta) > 10) {
                clearTimeout(holdTimer); 
            }
            return;
        }

        e.stopPropagation();
        isDragging = true;
        if (Math.abs(delta) > 5) {
            hasMoved = true;
        }
        
        if (!hasMoved) return;

        currentX = delta + (revealed * buttonWidth);
        let displayX = currentX;
        if (Math.abs(currentX) > buttonWidth) {
            displayX = (currentX > 0 ? buttonWidth : -buttonWidth) + (currentX - (currentX > 0 ? buttonWidth : -buttonWidth)) * 0.3;
        }
        // Keep scale while swiping
        item.style.transform = `translateX(${displayX}px) scale(0.97)`;
    };

    const onEnd = (e) => {
        e.stopPropagation();
        clearTimeout(holdTimer);
        item.style.boxShadow = 'none';
        // Reset scale but keep translation
        item.style.transform = item.style.transform.replace(/scale\(.*?\)/, 'scale(1)');

        if (!isDragging) {
            item.style.transform = `translateX(${revealed * buttonWidth}px)`;
            return;
        }
        isDragging = false;
        if (!hasMoved) {
            item.style.transform = `translateX(${revealed * buttonWidth}px)`;
            return;
        }

        item.style.transition = 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        const snapThreshold = buttonWidth * 0.5;
        if (currentX > snapThreshold) {
            item.style.transform = `translateX(${buttonWidth}px)`;
            revealed = 1;
        } else if (currentX < -snapThreshold) {
            item.style.transform = `translateX(-${buttonWidth}px)`;
            revealed = -1;
        } else {
            item.style.transform = `translateX(0)`;
            revealed = 0;
        }
    };

    item.addEventListener('touchstart', onStart, {passive: false});
    item.addEventListener('touchmove', onMove, {passive: false});
    item.addEventListener('touchend', onEnd);
    item.addEventListener('mousedown', onStart);
    item.addEventListener('mousemove', onMove);
    item.addEventListener('mouseup', onEnd);
    item.addEventListener('mouseleave', onEnd);

    item.addEventListener('click', (e) => {
        if (revealed !== 0) {
            e.preventDefault();
            e.stopPropagation();
            item.style.transition = 'transform 0.3s ease';
            item.style.transform = 'translateX(0)';
            revealed = 0;
        }
    }, true);

    if(delBtn) delBtn.onclick = (e) => {
        e.stopPropagation();
        actions.onSwipeRight();
        item.style.transform = 'translateX(0)';
        revealed = 0;
    };
    if(editBtn) editBtn.onclick = (e) => {
        e.stopPropagation();
        actions.onSwipeLeft();
        item.style.transform = 'translateX(0)';
        revealed = 0;
    };
}

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
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="const noteEl = this.querySelector('.report-note-display'); if(noteEl) noteEl.style.display = noteEl.style.display === 'none' ? 'block' : 'none';">
                            <div style="display: flex; flex-direction: column;">
                                <span>- ${e.item}</span>
                                <div class="report-note-display" style="display: none; margin-right: 12px; padding-top: 4px;">
                                    <span style="display:block; color: var(--text-secondary); font-size: 0.7rem;">أضيف في: ${new Date(e.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    ${e.notes ? `<span style="color: var(--text-secondary); font-size: 0.75rem;">(${e.notes})</span>` : ''}
                                </div>
                            </div>
                            <span style="color: var(--text-secondary);">${parseFloat(e.amount).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
        reportList.appendChild(catEl);
    });
}

function renderBackups() {
    const list = document.getElementById('auto-backups-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Show Undo Restore button if available
    if (globalData.preRestoreState) {
        const undoEl = document.createElement('div');
        undoEl.style.marginBottom = '15px';
        undoEl.innerHTML = `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px dashed var(--accent-color); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px;">
                <span style="font-size: 0.85rem; color: var(--accent-color); font-weight: 600;">تمت الاستعادة بنجاح. هل تريد التراجع؟</span>
                <button class="action-btn" onclick="undoRestore()" style="width: 100%; padding: 8px;">إلغاء الاستعادة والرجوع للحالة السابقة</button>
            </div>
        `;
        list.appendChild(undoEl);
    }

    if (globalData.backups.length === 0) {
        const empty = document.createElement('div');
        empty.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 10px;">لا توجد نسخ تلقائية بعد. ستظهر هنا بعد إضافة 5 مصروفات.</div>';
        list.appendChild(empty);
        return;
    }

    const backupsGrid = document.createElement('div');
    backupsGrid.style.display = 'flex';
    backupsGrid.style.flexDirection = 'column';
    backupsGrid.style.gap = '8px';
    backupsGrid.innerHTML = globalData.backups.map(b => `
        <div style="background: var(--card-bg); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color);">
            <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.9rem; font-weight: 600;">${b.date}</span>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">نسخة تلقائية</span>
            </div>
            <button class="text-btn" onclick="restoreBackup(${b.id})" style="color: var(--accent-color); font-size: 0.85rem;">استعادة</button>
        </div>
    `).join('');
    list.appendChild(backupsGrid);
}

window.restoreBackup = (id) => {
    if (confirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال البيانات الحالية ببيانات النسخة المختارة.')) {
        const backup = globalData.backups.find(b => b.id === id);
        if (backup) {
            // Save current state as pre-restore before overwriting
            const currentState = {
                projects: JSON.parse(JSON.stringify(globalData.projects)),
                currentId: globalData.currentProjectId
            };
            
            globalData.projects = JSON.parse(JSON.stringify(backup.data));
            globalData.currentProjectId = backup.currentId;
            globalData.preRestoreState = currentState;
            
            saveData();
            location.reload();
        }
    }
};

window.undoRestore = () => {
    if (globalData.preRestoreState) {
        globalData.projects = JSON.parse(JSON.stringify(globalData.preRestoreState.projects));
        globalData.currentProjectId = globalData.preRestoreState.currentId;
        globalData.preRestoreState = null; // Clear it after undo
        saveData();
        location.reload();
    }
};

function renderTrash() {
    const list = document.getElementById('trash-list');
    if (!list) return;
    
    const allTrash = [
        ...globalData.trash.projects.map(p => ({ type: 'project', name: p.projectName, id: p.id, info: 'مشروع (فيلا)' })),
        ...globalData.trash.categories.map(c => ({ type: 'category', name: c.name, id: c.id, info: 'بند أساسي' })),
        ...globalData.trash.expenses.map(e => ({ type: 'expense', name: e.item, id: e.id, info: `${e.amount} ${appData.currency}` })),
        ...globalData.trash.stages.map(s => ({ type: 'stage', name: s.stageName, id: s.catId + s.stageName, info: 'مرحلة' }))
    ];

    if (allTrash.length === 0) {
        list.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 10px;">سلة المحذوفات فارغة.</div>';
        return;
    }

    list.innerHTML = allTrash.map(item => `
        <div style="background: var(--card-bg); padding: 10px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); margin-bottom: 5px;">
            <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.85rem; font-weight: 600;">${item.name}</span>
                <span style="font-size: 0.7rem; color: var(--text-secondary);">${item.info}</span>
            </div>
            <button class="text-btn" onclick="restoreFromTrash('${item.type}', '${item.id}')" style="color: var(--accent-color); font-size: 0.8rem;">استعادة</button>
        </div>
    `).join('');
}

window.restoreFromTrash = (type, id) => {
    let item;
    if (type === 'project') {
        item = globalData.trash.projects.find(p => p.id === id);
        if (item) {
            globalData.projects.push(item);
            globalData.trash.projects = globalData.trash.projects.filter(p => p.id !== id);
        }
    } else if (type === 'category') {
        item = globalData.trash.categories.find(c => c.id === id);
        if (item) {
            const targetProj = globalData.projects.find(p => p.id === item.projectId) || appData;
            targetProj.categories.push(item);
            globalData.trash.categories = globalData.trash.categories.filter(c => c.id !== id);
        }
    } else if (type === 'expense') {
        item = globalData.trash.expenses.find(e => e.id == id);
        if (item) {
            appData.expenses.push(item);
            globalData.trash.expenses = globalData.trash.expenses.filter(e => e.id != id);
        }
    } else if (type === 'stage') {
        item = globalData.trash.stages.find(s => (s.catId + s.stageName) === id);
        if (item) {
            const cat = appData.categories.find(c => c.id === item.catId);
            if (cat) cat.stages.push(item.stageName);
            globalData.trash.stages = globalData.trash.stages.filter(s => (s.catId + s.stageName) !== id);
        }
    }
    
    saveData();
    updateProjectContext();
    renderTrash();
    alert('تمت استعادة العنصر بنجاح!');
};

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
        saveData(true);
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
        if (confirm('تنبيه هام! هل أنت متأكد من مسح جميع المشاريع والبيانات الحالية؟ سيتم نقلها إلى سلة المحذوفات لتتمكن من استعادتها لاحقاً إذا أردت.')) {
            // Move all current projects to trash for safety
            globalData.projects.forEach(p => {
                globalData.trash.projects.push(JSON.parse(JSON.stringify(p)));
            });
            
            // Reset to default state but KEEP backups and trash
            const id = 'proj_' + Date.now();
            globalData.projects = [{
                id: id, projectName: 'مشروع جديد', currency: 'د.ب',
                categories: JSON.parse(JSON.stringify(defaultCategories)), expenses: []
            }];
            globalData.currentProjectId = id;
            globalData.actionCounter = 0;
            
            saveData();
            alert('تم مسح البيانات بنجاح ونقل النسخة القديمة إلى سلة المحذوفات.');
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
                currency: 'د.ب',
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

    document.getElementById('budget-input').onchange = (e) => {
        appData.budget = parseFloat(e.target.value) || 0;
        saveData();
        renderDashboard();
    };

    document.getElementById('reset-to-standard-cats-btn').onclick = () => {
        if (confirm('هل تريد استيراد جميع البنود والمراحل القياسية (الستاندرد)؟ سيتم إضافة المراحل الناقصة لبنودك الحالية دون حذف أي بيانات.')) {
            defaultCategories.forEach(defCat => {
                const existingCat = appData.categories.find(c => c.name === defCat.name);
                if (existingCat) {
                    // Merge missing stages
                    defCat.stages.forEach(s => {
                        if (!existingCat.stages.includes(s)) {
                            existingCat.stages.push(s);
                        }
                    });
                } else {
                    // Add new category
                    appData.categories.push(JSON.parse(JSON.stringify(defCat)));
                }
            });
            saveData();
            renderCategories();
            populateSelects();
            alert('تم تحديث واستيراد البنود القياسية بنجاح!');
        }
    };

    document.getElementById('delete-current-project-btn').onclick = () => {
        if (!globalData.trash) globalData.trash = { projects: [], categories: [], stages: [], expenses: [] };
        
        if (globalData.projects.length <= 1) {
            alert("لا يمكن حذف المشروع الوحيد. قم بإضافة مشروع جديد أولاً.");
            return;
        }
        
        const projName = appData.projectName;
        if (confirm(`هل أنت متأكد من حذف مشروع "${projName}"؟ سيتم نقله إلى سلة المحذوفات.`)) {
            // Move to trash
            globalData.trash.projects.push(JSON.parse(JSON.stringify(appData)));
            
            // Remove from projects
            const deletedId = appData.id;
            globalData.projects = globalData.projects.filter(p => p.id !== deletedId);
            
            // Switch to another project
            globalData.currentProjectId = globalData.projects[0].id;
            
            saveData();
            alert(`تم نقل مشروع "${projName}" إلى سلة المحذوفات.`);
            location.reload();
        }
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
        const cat = appData.categories.find(c => c.id === catId);
        globalData.trash.categories.push({ ...cat, projectId: appData.id });
        
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
                globalData.trash.stages.push({ catId, stageName, projectId: appData.id });
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
        let index = 1;

        // Loop through Categories and Stages to maintain logical grouping/order
        appData.categories.forEach(cat => {
            const catExps = appData.expenses.filter(e => e.categoryId === cat.id);
            if (catExps.length === 0) return;

            cat.stages.forEach(stage => {
                const sExps = catExps.filter(e => e.stage === stage);
                if (sExps.length === 0) return;

                sExps.forEach(e => {
                    rows.push({
                        'م': index++,
                        'التاريخ': new Date(e.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        'البند': e.category,
                        'المرحلة': e.stage,
                        'نوع المصروف': e.item,
                        'المبلغ': parseFloat(e.amount),
                        'العملة': appData.currency,
                        'ملاحظات': e.notes || ''
                    });
                    grandTotal += parseFloat(e.amount);
                });
            });
        });

        if (rows.length === 0) {
            alert('لا توجد مصروفات لتصديرها.');
            return;
        }

        // Add a single Grand Total row at the very bottom
        rows.push({}); // Empty row for separation
        rows.push({
            'م': '',
            'التاريخ': '',
            'البند': '',
            'المرحلة': '',
            'نوع المصروف': 'الإجمالي الكلي:',
            'المبلغ': grandTotal,
            'العملة': appData.currency,
            'ملاحظات': ''
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        
        // Define wider Column Widths for better readability
        worksheet['!cols'] = [
            { wch: 5 },  // م
            { wch: 15 }, // التاريخ
            { wch: 25 }, // البند
            { wch: 25 }, // المرحلة
            { wch: 35 }, // نوع المصروف
            { wch: 15 }, // المبلغ
            { wch: 10 }, // العملة
            { wch: 55 }  // ملاحظات
        ];

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
