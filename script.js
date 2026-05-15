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
let currentExpenseImage = null;
let isSortableDragging = false;
let isSelectionMode = false;
let selectedExpenseIds = new Set();

const expImageInput = document.getElementById('exp-image');
const uploadTrigger = document.getElementById('upload-image-trigger');
const imagePreview = document.getElementById('image-preview');
const previewImg = imagePreview.querySelector('img');
const removeImageBtn = document.getElementById('remove-image');

// Image Handling
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
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
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}

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
    globalData.backups.unshift(backup);
    if (globalData.backups.length > 10) globalData.backups.pop();
}

function loadData() {
    let saved = localStorage.getItem('bunyan_data');
    if (!saved) {
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
            if (!globalData.backups) globalData.backups = [];
            if (!globalData.actionCounter) globalData.actionCounter = 0;
            if (!globalData.trash) globalData.trash = { projects: [], categories: [], stages: [], expenses: [] };
        } catch (e) {
            console.error("Data load error", e);
        }
    } else {
        const id = 'proj_' + Date.now();
        globalData.projects = [{
            id: id, projectName: 'مشروع جديد', currency: 'د.ب',
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
    if (!appData.stagePhotos) appData.stagePhotos = {};
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
    if(sel) sel.innerHTML = globalData.projects.map(p => `<option value="${p.id}" ${p.id === globalData.currentProjectId ? 'selected' : ''}>${p.projectName}</option>`).join('');
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
        if (view.id === `view-${viewId}`) view.classList.add('active');
    });
    const titles = { 'dashboard': 'نظرة عامة', 'categories': 'بنود البناء', 'reports': 'التقارير المالية', 'settings': 'الإعدادات' };
    viewTitle.textContent = titles[viewId];
    if (viewId === 'reports') renderReports();
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'categories') renderCategories();
    if (viewId === 'settings') { renderBackups(); renderTrash(); }
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
    remainingEl.style.color = remaining < 0 ? 'var(--danger-color)' : 'var(--text-primary)';

    recentList.innerHTML = '';
    if (appData.expenses.length === 0) {
        recentList.innerHTML = '<div class="empty-state">لا توجد مصروفات مضافة بعد.</div>';
        return;
    }

    const recent = [...appData.expenses].reverse();
    recent.forEach(exp => {
        const container = document.createElement('div');
        container.className = 'swipe-container';
        container.setAttribute('data-id', exp.id);
        container.innerHTML = `
            <div class="swipe-action delete"><ion-icon name="trash-outline"></ion-icon> <span>حذف</span></div>
            <div class="swipe-action edit"><span>تعديل</span> <ion-icon name="create-outline"></ion-icon></div>
            <div class="swipe-item transaction-item" style="cursor: pointer; margin-bottom: 0;" onclick="handleExpenseClick(event, ${exp.id}, this)">
                <div class="t-info">
                    <span class="t-name">${exp.item}</span>
                    <span class="t-meta">${exp.category} • ${exp.stage}</span>
                    <div class="exp-note-display" style="display: none; color: var(--accent-color); font-style: italic; font-size: 0.75rem; margin-top: 4px; padding-right: 8px; border-right: 2px solid var(--accent-color);">
                        <span style="display:block; color: var(--text-secondary); font-size: 0.7rem; font-style: normal; margin-bottom: 2px;">أضيف في: ${new Date(exp.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        ${exp.notes ? `ملاحظة: ${exp.notes}` : ''}
                        ${exp.image ? `<div style="margin-top: 10px;"><img src="${exp.image}" style="width: 100%; border-radius: 8px; cursor: zoom-in;" onclick="event.stopPropagation(); document.getElementById('viewer-image').src=this.src; document.getElementById('image-viewer-modal').classList.add('active');"></div>` : ''}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <span class="t-amount">${parseFloat(exp.amount).toFixed(2)}</span>
                    ${exp.image ? `<span style="display: flex; align-items: center; gap: 3px; background: rgba(245, 158, 11, 0.15); color: var(--accent-color); border-radius: 20px; padding: 2px 7px; font-size: 0.65rem;"><ion-icon name="receipt-outline" style="font-size: 0.75rem;"></ion-icon>فاتورة</span>` : ''}
                </div>
            </div>
        `;
        if (!isSelectionMode) {
            setupSwipe(container, {
                onSwipeRight: () => deleteExpense(exp.id),
                onSwipeLeft: () => openEditExpense(exp.id)
            });
        }
        recentList.appendChild(container);
    });
}

function handleExpenseClick(event, id, el) {
    if (isSelectionMode) {
        if (selectedExpenseIds.has(id)) selectedExpenseIds.delete(id);
        else selectedExpenseIds.add(id);
        renderDashboard();
        updateBulkActions();
    } else {
        const noteEl = el.querySelector('.exp-note-display');
        if(noteEl) noteEl.style.display = noteEl.style.display === 'none' ? 'block' : 'none';
    }
}

function updateBulkActions() {
    const bar = document.getElementById('selection-bar');
    const countEl = document.getElementById('selected-count');
    if (isSelectionMode) {
        bar.style.display = 'flex';
        countEl.textContent = `${selectedExpenseIds.size} مختارة`;
    } else {
        bar.style.display = 'none';
    }
}

function renderCategories() {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '';

    appData.categories.forEach((cat, catIdx) => {
        const isExpanded = expandedCategoryId === cat.id;
        const catExpenses = appData.expenses.filter(e => String(e.categoryId) === String(cat.id));
        const total = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

        const card = document.createElement('div');
        card.className = 'swipe-container category-swipe-container';
        card.setAttribute('data-id', cat.id);
        
        card.innerHTML = `
            <div class="swipe-action delete" style="border-radius: 20px;"><ion-icon name="trash-outline"></ion-icon><span>حذف</span></div>
            <div class="swipe-action edit" style="border-radius: 20px;"><ion-icon name="create-outline"></ion-icon><span>تعديل</span></div>
            <div class="swipe-item category-card ${isExpanded ? 'expanded' : ''}" data-id="${cat.id}" style="border-radius: 20px;">
                <div class="category-header">
                    <div class="drag-handle" style="cursor: grab; padding: 10px; margin-right: -10px;"><ion-icon name="reorder-two-outline"></ion-icon></div>
                    <div class="cat-icon"><ion-icon name="${cat.icon || 'folder-outline'}"></ion-icon></div>
                    <div class="cat-details" onclick="toggleCategoryExpand('${cat.id}')">
                        <h4>${cat.name}</h4>
                        <div class="cat-stats">${cat.stages.length} مراحل • ${total.toFixed(2)} ${appData.currency}</div>
                    </div>
                    <ion-icon name="chevron-down-outline" style="margin-right: 10px; transition: transform 0.3s; transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};" onclick="toggleCategoryExpand('${cat.id}')"></ion-icon>
                </div>
                <div class="category-body" style="display: ${isExpanded ? 'block' : 'none'};">
                    <div class="stage-list stages-sortable" data-catid="${cat.id}"></div>
                    ${cat.id !== 'cat_other' ? `<button class="inline-add" onclick="addStagePrompt('${cat.id}')" style="width: 100%; text-align: right;">+ إضافة مرحلة جديدة</button>` : ''}
                </div>
            </div>
        `;

        const stageList = card.querySelector('.stage-list');
        
        // Self-healing: Ensure all stages from expenses exist in the category
        let healed = false;
        const expenseStages = [...new Set(catExpenses.map(e => e.stage))];
        expenseStages.forEach(s => {
            if (s && !cat.stages.includes(s)) {
                cat.stages.push(s);
                healed = true;
            }
        });
        if (healed) saveData();

        cat.stages.forEach((stage, idx) => {
            const sExps = catExpenses.filter(e => e.stage === stage);
            const sTotal = sExps.reduce((sum, e) => sum + parseFloat(e.amount), 0);
            
            const photoKey = cat.id + '_' + stage;
            const photoCount = (appData.stagePhotos[photoKey] || []).length;

            const stageCard = document.createElement('div');
            stageCard.className = 'swipe-container stage-swipe-container stage-item-wrapper';
            stageCard.setAttribute('data-name', stage);
            stageCard.style.marginBottom = '8px';
            stageCard.innerHTML = `
                <div class="swipe-action delete" style="border-radius: 12px; font-size: 0.8rem;"><ion-icon name="trash-outline"></ion-icon></div>
                <div class="swipe-action edit" style="border-radius: 12px; font-size: 0.8rem;"><ion-icon name="create-outline"></ion-icon></div>
                <div class="swipe-item stage-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                        <ion-icon name="reorder-two-outline" class="stage-drag-handle" style="cursor: grab; color: var(--text-secondary); opacity: 0.5; padding: 10px; margin-left: -10px;"></ion-icon>
                        <span style="font-size: 0.9rem; font-weight: 500;">${stage}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="text-btn" onclick="openStagePhotos('${cat.id}', '${stage}')" style="color: var(--accent-color); display: flex; align-items: center; gap: 4px; padding: 5px; position: relative;">
                            <ion-icon name="camera-outline" style="font-size: 1.2rem;"></ion-icon>
                            ${photoCount > 0 ? `<span style="background: var(--accent-color); color: #fff; font-size: 0.6rem; padding: 1px 5px; border-radius: 10px; font-weight: bold;">${photoCount}</span>` : ''}
                        </button>
                        <span style="font-size: 0.85rem; color: var(--accent-color); font-weight: bold;">${sTotal.toFixed(2)}</span>
                    </div>
                </div>
            `;
            stageList.appendChild(stageCard);
            setupSwipe(stageCard, {
                onSwipeRight: () => deleteStage(cat.id, idx),
                onSwipeLeft: () => editStage(cat.id, idx)
            });
        });

        container.appendChild(card);
        
        setupSwipe(card, {
            onSwipeRight: () => deleteCategory(cat.id), 
            onSwipeLeft: () => editCategory(cat.id)
        });
    });

    // Sortable for Categories
    new Sortable(container, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onStart: () => { isSortableDragging = true; },
        onEnd: () => {
            isSortableDragging = false;
            const newOrderIds = Array.from(container.querySelectorAll('.category-swipe-container')).map(el => el.getAttribute('data-id'));
            const reordered = newOrderIds.map(id => appData.categories.find(c => c.id === id)).filter(c => c);
            if (reordered.length === appData.categories.length) {
                appData.categories = reordered;
                saveData();
                renderCategories(); // Sync UI after reorder
            }
        }
    });

    // Sortable for Stages
    container.querySelectorAll('.stages-sortable').forEach(list => {
        const catId = list.getAttribute('data-catid');
        new Sortable(list, {
            handle: '.stage-drag-handle',
            animation: 150,
            onStart: () => { isSortableDragging = true; },
            onEnd: () => {
                isSortableDragging = false;
                const cat = appData.categories.find(c => c.id === catId);
                const newOrder = Array.from(list.querySelectorAll('.stage-item-wrapper')).map(el => el.getAttribute('data-name'));
                cat.stages = newOrder;
                saveData();
                renderCategories();
            }
        });
    });
}

window.toggleCategoryExpand = (id) => {
    const wasExpanded = expandedCategoryId === id;
    expandedCategoryId = wasExpanded ? null : id;
    renderCategories();
    
    // If we just expanded a category, scroll it to the top
    if (!wasExpanded) {
        setTimeout(() => {
            const el = document.querySelector(`.category-swipe-container[data-id="${id}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
};

window.deleteCategory = (id) => {
    if (confirm('هل أنت متأكد من حذف هذا البند بالكامل؟ سيتم حذف جميع المصروفات المرتبطة به.')) {
        const cat = appData.categories.find(c => c.id === id);
        if (cat) globalData.trash.categories.push(cat);
        appData.categories = appData.categories.filter(c => c.id !== id);
        appData.expenses = appData.expenses.filter(e => String(e.categoryId) !== String(id));
        saveData();
        renderCategories();
        renderDashboard();
    }
};

window.editCategory = (id) => {
    const cat = appData.categories.find(c => c.id === id);
    if (!cat) return;
    const newName = prompt('تعديل اسم البند:', cat.name);
    if (newName && newName !== cat.name) {
        cat.name = newName;
        // Update all expenses with the new category name
        appData.expenses.forEach(e => {
            if (String(e.categoryId) === String(id)) e.category = newName;
        });
        saveData();
        renderCategories();
        renderDashboard();
    }
};

window.addStagePrompt = (catId) => {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return;
    const name = prompt('اسم المرحلة الفرعية الجديدة:');
    if (name && !cat.stages.includes(name)) {
        cat.stages.push(name);
        saveData();
        renderCategories();
    }
};

window.editStage = (catId, idx) => {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat || !cat.stages[idx]) return;
    const oldName = cat.stages[idx];
    const newName = prompt('تعديل اسم المرحلة:', oldName);
    if (newName && newName !== oldName) {
        cat.stages[idx] = newName;
        // Update all expenses with the new stage name
        appData.expenses.forEach(e => {
            if (String(e.categoryId) === String(catId) && e.stage === oldName) {
                e.stage = newName;
            }
        });
        saveData();
        renderCategories();
        renderDashboard();
    }
};

window.deleteStage = (catId, idx) => {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat || !cat.stages[idx]) return;
    if (confirm(`هل تريد حذف المرحلة "${cat.stages[idx]}"؟`)) {
        cat.stages.splice(idx, 1);
        saveData();
        renderCategories();
    }
};

window.addMainCategory = () => {
    const name = prompt('اسم البند الرئيسي الجديد:');
    if (!name) return;
    const icons = ['hammer-outline', 'flash-outline', 'water-outline', 'brush-outline', 'home-outline', 'construct-outline', 'business-outline', 'cube-outline'];
    const icon = prompt('اختر أيقونة (مثلاً: hammer-outline, flash-outline, water-outline, brush-outline):', icons[0]);
    const id = 'cat_' + Date.now();
    appData.categories.push({ id, name, icon: icon || 'folder-outline', stages: [] });
    saveData();
    renderCategories();
};

window.resetToStandardCategories = () => {
    if (confirm('هل تريد استيراد جميع البنود القياسية؟ لن يتم حذف بنودك الحالية.')) {
        defaultCategories.forEach(def => {
            if (!appData.categories.find(c => c.name === def.name)) {
                appData.categories.push(JSON.parse(JSON.stringify(def)));
            }
        });
        saveData();
        renderCategories();
    }
};

window.deleteCurrentProject = () => {
    if (globalData.projects.length <= 1) return alert('لا يمكن حذف المشروع الوحيد. أضف مشروعاً آخر أولاً.');
    if (confirm(`هل أنت متأكد من حذف مشروع "${appData.projectName}" نهائياً؟`)) {
        globalData.trash.projects.push(appData);
        globalData.projects = globalData.projects.filter(p => p.id !== appData.id);
        globalData.currentProjectId = globalData.projects[0].id;
        saveData();
        updateProjectContext();
    }
};

// Swipe Implementation
function setupSwipe(container, actions) {
    const children = Array.from(container.children);
    const item = children.find(c => c.classList.contains('swipe-item'));
    const delBtn = children.find(c => c.classList.contains('swipe-action') && c.classList.contains('delete'));
    const editBtn = children.find(c => c.classList.contains('swipe-action') && c.classList.contains('edit'));
    if (!item) return;

    let startX = 0, currentX = 0, isDragging = false, hasMoved = false, revealed = 0, lastTap = 0, canSwipe = false;
    const buttonWidth = 80;

    const onStart = (e) => {
        if (isSortableDragging) return;
        
        // Strictly ignore if touching any drag handle
        const isHandle = e.target.closest('.drag-handle') || e.target.closest('.stage-drag-handle') || e.target.closest('[class*="drag-handle"]');
        if (isHandle) {
            canSwipe = false;
            return;
        }
        
        // Stop propagation if this is a nested swipe
        if (container.classList.contains('stage-swipe-container')) {
            e.stopPropagation();
        }

        const now = Date.now();
        if (now - lastTap < 300) {
            canSwipe = true;
            item.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            item.style.transform = 'scale(1.02)';
            setTimeout(() => { item.style.transform = 'scale(1)'; }, 200);
            if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(30);
        } else {
            canSwipe = false;
        }
        lastTap = now;

        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        isDragging = false; hasMoved = false;
        item.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!startX) return;
        const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const delta = (x - startX);

        // Strictly ignore if touching any drag handle
        if (e.target.closest('.drag-handle') || e.target.closest('.stage-drag-handle')) {
            return;
        }

        // Stop propagation if this is a nested swipe
        if (container.classList.contains('stage-swipe-container')) {
            e.stopPropagation();
        }

        isDragging = true; if (Math.abs(delta) > 5) hasMoved = true;
        if (!hasMoved) return;
        
        // Breakthrough logic: High resistance until 200px
        const breakthroughPoint = 200;
        const hintPoint = 50;
        let displayX = 0;
        
        // Haptic hint at 50px
        if (Math.abs(delta) > hintPoint && Math.abs(delta) < hintPoint + 10) {
            if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(20);
        }

        if (Math.abs(delta) < breakthroughPoint) {
            // High resistance phase (rubber band)
            displayX = delta * 0.1; 
            if (delBtn) { delBtn.style.opacity = '0.2'; delBtn.style.visibility = 'visible'; }
            if (editBtn) { editBtn.style.opacity = '0.2'; editBtn.style.visibility = 'visible'; }
        } else {
            // Breakthrough phase
            if (!canSwipe) {
                canSwipe = true;
                if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(40);
            }
            if (delBtn) { delBtn.style.opacity = '1'; delBtn.style.visibility = 'visible'; }
            if (editBtn) { editBtn.style.opacity = '1'; editBtn.style.visibility = 'visible'; }
            
            // Move more freely after breakthrough
            displayX = (delta > 0 ? 20 : -20) + (delta - (delta > 0 ? breakthroughPoint : -breakthroughPoint)) * 0.5;
            
            // Limit to button width
            if (Math.abs(displayX) > buttonWidth) {
                displayX = (displayX > 0 ? buttonWidth : -buttonWidth);
            }
        }
        
        currentX = delta;
        item.style.transform = `translateX(${displayX}px)`;
    };

    const onEnd = () => {
        if (isSortableDragging) return;
        startX = 0;
        item.style.transform = item.style.transform.replace(/scale\(.*?\)/, 'scale(1)');
        
        if (!isDragging) return;
        isDragging = false; 
        
        item.style.transition = 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        const breakthroughThreshold = 200;
        
        if (currentX > breakthroughThreshold) { 
            item.style.transform = `translateX(${buttonWidth}px)`; 
            revealed = 1; 
        } else if (currentX < -breakthroughThreshold) { 
            item.style.transform = `translateX(-${buttonWidth}px)`; 
            revealed = -1; 
        } else { 
            item.style.transform = `translateX(0)`; 
            revealed = 0;
            canSwipe = false;
            if (delBtn) { delBtn.style.opacity = '0'; delBtn.style.visibility = 'hidden'; }
            if (editBtn) { editBtn.style.opacity = '0'; editBtn.style.visibility = 'hidden'; }
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
            e.preventDefault(); e.stopPropagation();
            item.style.transition = 'transform 0.3s ease';
            item.style.transform = 'translateX(0)';
            revealed = 0;
            if (delBtn) { delBtn.style.opacity = '0'; delBtn.style.visibility = 'hidden'; }
            if (editBtn) { editBtn.style.opacity = '0'; editBtn.style.visibility = 'hidden'; }
        }
    }, true);

    if(delBtn) delBtn.onclick = (e) => { 
        e.stopPropagation(); 
        actions.onSwipeRight(); 
        item.style.transform = 'translateX(0)'; 
        revealed = 0; 
        delBtn.style.opacity = '0'; delBtn.style.visibility = 'hidden';
    };
    if(editBtn) editBtn.onclick = (e) => { 
        e.stopPropagation(); 
        actions.onSwipeLeft(); 
        item.style.transform = 'translateX(0)'; 
        revealed = 0; 
        editBtn.style.opacity = '0'; editBtn.style.visibility = 'hidden';
    };
}

function renderReports() {
    const reportList = document.getElementById('report-details-list');
    const chartCanvas = document.getElementById('categoryChart');
    if(!reportList || !chartCanvas) return;
    
    if (categoryChart) categoryChart.destroy();
    reportList.innerHTML = '';

    try {
        const catData = appData.categories.map(cat => {
            const catExpenses = appData.expenses.filter(e => String(e.categoryId) === String(cat.id));
            const total = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
            
            const stages = cat.stages.map(stageName => {
                const sExps = catExpenses.filter(e => e.stage === stageName);
                return {
                    name: stageName,
                    total: sExps.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0),
                    expenses: sExps
                };
            }).filter(s => s.total > 0 || s.expenses.length > 0);

            return { id: cat.id, name: cat.name, total: total, stages: stages };
        }).filter(c => c.total > 0);

        if (catData.length === 0) {
            reportList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">لا توجد مصروفات لعرضها في التقرير.</div>';
            return;
        }

        // Render Chart
        const ctx = chartCanvas.getContext('2d');
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: catData.map(c => c.name),
                datasets: [{
                    data: catData.map(c => c.total),
                    backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#f97316', '#64748b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Tajawal', size: 10 } } } }
            }
        });

        // Render 3-Level Accordion
        catData.forEach(cat => {
            const catEl = document.createElement('div');
            catEl.className = 'report-cat-group';
            catEl.style.marginBottom = '15px';
            catEl.innerHTML = `
                <div class="accordion-header cat-header" onclick="toggleAccordion(this)" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <ion-icon name="chevron-down-outline" class="arrow" style="transition: transform 0.3s; color: var(--accent-color);"></ion-icon>
                        <span style="font-weight: bold; color: var(--text-primary); font-size: 1rem;">${cat.name}</span>
                    </div>
                    <span style="font-weight: bold; color: var(--accent-color);">${cat.total.toFixed(2)}</span>
                </div>
                <div class="accordion-content details-container" style="display: none; padding: 10px; background: rgba(255,158,11,0.03); border: 1px solid var(--border-color); border-top: none; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                    ${cat.stages.map(stage => `
                        <div class="stage-group" style="margin-bottom: 8px;">
                            <div class="stage-header" onclick="toggleAccordion(this)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <ion-icon name="chevron-forward-outline" class="arrow" style="transition: transform 0.3s; font-size: 0.8rem; color: var(--text-secondary);"></ion-icon>
                                    <span style="font-weight: 500; color: var(--text-primary); font-size: 0.9rem;">${stage.name}</span>
                                </div>
                                <span style="font-size: 0.85rem; color: var(--accent-color);">${stage.total.toFixed(2)}</span>
                            </div>
                            <div class="stage-content" style="display: none; padding: 8px 10px 8px 30px;">
                                ${stage.expenses.map(e => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,0.05); font-size: 0.8rem;">
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="color: var(--text-primary);">${e.item}</span>
                                            <span style="font-size: 0.65rem; color: var(--text-secondary);">${new Date(e.date).toLocaleDateString('ar-EG')}</span>
                                        </div>
                                        <span style="font-weight: 500; color: var(--text-primary);">${parseFloat(e.amount || 0).toFixed(2)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            reportList.appendChild(catEl);
        });
    } catch (err) {
        console.error("Report Rendering Error:", err);
        reportList.innerHTML = '<div style="color: #ef4444; padding: 20px;">حدث خطأ أثناء عرض التقرير.</div>';
    }
}

let currentStagePhotoKey = null;
let isDeleteMode = false;
let currentViewerPhotos = [];
let currentViewerIndex = 0;

window.openStagePhotos = (catId, stageName) => {
    currentStagePhotoKey = catId + '_' + stageName;
    isDeleteMode = false;
    document.getElementById('modal-stage-title').textContent = 'توثيق: ' + stageName;
    document.getElementById('manage-photos-btn').textContent = 'حذف';
    renderStagePhotos();
    document.getElementById('stage-photos-modal').classList.add('active');
};

window.toggleDeleteMode = () => {
    isDeleteMode = !isDeleteMode;
    document.getElementById('manage-photos-btn').textContent = isDeleteMode ? 'تم' : 'حذف';
    document.getElementById('manage-photos-btn').style.borderColor = isDeleteMode ? 'var(--accent-color)' : 'var(--border-color)';
    renderStagePhotos();
};

function renderStagePhotos() {
    const list = document.getElementById('stage-photos-list');
    list.innerHTML = '';
    const photos = appData.stagePhotos[currentStagePhotoKey] || [];
    
    if (photos.length === 0) {
        list.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد صور لهذه المرحلة بعد.</div>';
        document.getElementById('manage-photos-btn').style.display = 'none';
    } else {
        document.getElementById('manage-photos-btn').style.display = 'block';
        photos.forEach((img, idx) => {
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.borderRadius = '8px';
            div.style.overflow = 'hidden';
            div.innerHTML = `
                <img src="${img}" style="width: 100%; height: 100px; object-fit: cover; cursor: zoom-in;" onclick="openPhotoViewer(${idx})">
                ${isDeleteMode ? `
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; pointer-events: none;">
                        <button onclick="event.stopPropagation(); deleteStagePhoto(${idx})" style="pointer-events: auto; background: var(--danger); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                ` : ''}
            `;
            list.appendChild(div);
        });
    }
}

window.openPhotoViewer = (idx) => {
    currentViewerPhotos = appData.stagePhotos[currentStagePhotoKey] || [];
    currentViewerIndex = idx;
    updateViewerImage();
    document.getElementById('image-viewer-modal').classList.add('active');
};

function updateViewerImage() {
    const img = document.getElementById('viewer-image');
    if (currentViewerPhotos[currentViewerIndex]) {
        img.src = currentViewerPhotos[currentViewerIndex];
        document.getElementById('viewer-prev').style.display = currentViewerIndex > 0 ? 'flex' : 'none';
        document.getElementById('viewer-next').style.display = currentViewerIndex < currentViewerPhotos.length - 1 ? 'flex' : 'none';
    }
}

window.showPrevPhoto = () => {
    if (currentViewerIndex > 0) {
        currentViewerIndex--;
        updateViewerImage();
    }
};

window.showNextPhoto = () => {
    if (currentViewerIndex < currentViewerPhotos.length - 1) {
        currentViewerIndex++;
        updateViewerImage();
    }
};

// Viewer Swipe Logic
const viewerModal = document.getElementById('image-viewer-modal');
if (viewerModal) {
    let vStartX = 0;
    viewerModal.addEventListener('touchstart', e => { vStartX = e.touches[0].clientX; }, {passive: true});
    viewerModal.addEventListener('touchend', e => {
        const deltaX = e.changedTouches[0].clientX - vStartX;
        if (deltaX > 70) showPrevPhoto(); // Swipe right -> previous (RTL)
        else if (deltaX < -70) showNextPhoto(); // Swipe left -> next
    }, {passive: true});

    // Close on click outside image
    viewerModal.addEventListener('click', (e) => {
        if (e.target.id === 'image-viewer-modal' || e.target.closest('.close-modal')) {
            viewerModal.classList.remove('active');
        }
    });
}

window.deleteStagePhoto = (idx) => {
    if (confirm('هل أنت متأكد من حذف هذه الصورة؟')) {
        appData.stagePhotos[currentStagePhotoKey].splice(idx, 1);
        saveData();
        renderStagePhotos();
        // If we were in delete mode, stay in it
    }
};

const stagePhotoInput = document.getElementById('stage-photo-input');
if (stagePhotoInput) {
    stagePhotoInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (!appData.stagePhotos[currentStagePhotoKey]) appData.stagePhotos[currentStagePhotoKey] = [];
        
        files.forEach(file => {
            compressImage(file, (b64) => {
                appData.stagePhotos[currentStagePhotoKey].push(b64);
                saveData();
                renderStagePhotos();
            });
        });
        stagePhotoInput.value = '';
    };
}

window.toggleAccordion = (header) => {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.arrow');
    const isOpen = content.style.display === 'block';
    
    content.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
};

// Toggle All Reports
const toggleAllBtn = document.getElementById('toggle-all-reports');
if (toggleAllBtn) {
    toggleAllBtn.onclick = (e) => {
        const btn = e.target;
        const isExpanding = btn.textContent === 'فتح الكل';
        const contents = document.querySelectorAll('#report-details-list .accordion-content');
        const arrows = document.querySelectorAll('#report-details-list .arrow');
        
        contents.forEach(c => c.style.display = isExpanding ? 'block' : 'none');
        arrows.forEach(a => a.style.transform = isExpanding ? 'rotate(180deg)' : 'rotate(0deg)');
        
        btn.textContent = isExpanding ? 'إغلاق الكل' : 'فتح الكل';
    };
}

function renderBackups() {
    const list = document.getElementById('auto-backups-list');
    if (!list) return;
    list.innerHTML = '';
    if (globalData.preRestoreState) {
        const undoEl = document.createElement('div');
        undoEl.style.marginBottom = '15px';
        undoEl.innerHTML = `<div style="background: rgba(59, 130, 246, 0.1); border: 1px dashed var(--accent-color); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 0.85rem; color: var(--accent-color); font-weight: 600;">تمت الاستعادة بنجاح. هل تريد التراجع؟</span><button class="action-btn" onclick="undoRestore()" style="width: 100%; padding: 8px;">إلغاء الاستعادة والرجوع للحالة السابقة</button></div>`;
        list.appendChild(undoEl);
    }
    if (globalData.backups.length === 0) { list.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 10px;">لا توجد نسخ تلقائية بعد.</div>'; return; }
    list.innerHTML += globalData.backups.map(b => `<div style="background: var(--card-bg); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); margin-bottom: 8px;"><div style="display: flex; flex-direction: column;"><span style="font-size: 0.9rem; font-weight: 600;">${b.date}</span><span style="font-size: 0.75rem; color: var(--text-secondary);">نسخة تلقائية</span></div><button class="text-btn" onclick="restoreBackup(${b.id})" style="color: var(--accent-color); font-size: 0.85rem;">استعادة</button></div>`).join('');
}

window.restoreBackup = (id) => {
    if (confirm('هل أنت متأكد من استعادة هذه النسخة؟')) {
        const backup = globalData.backups.find(b => b.id === id);
        if (backup) {
            globalData.preRestoreState = { projects: JSON.parse(JSON.stringify(globalData.projects)), currentId: globalData.currentProjectId };
            globalData.projects = JSON.parse(JSON.stringify(backup.data));
            globalData.currentProjectId = backup.currentId;
            saveData(); location.reload();
        }
    }
};

window.undoRestore = () => {
    if (globalData.preRestoreState) {
        globalData.projects = JSON.parse(JSON.stringify(globalData.preRestoreState.projects));
        globalData.currentProjectId = globalData.preRestoreState.currentId;
        globalData.preRestoreState = null; saveData(); location.reload();
    }
};

function renderTrash() {
    const list = document.getElementById('trash-list');
    if (!list) return;
    const allTrash = [
        ...globalData.trash.projects.map(p => ({ type: 'project', name: p.projectName, id: p.id, info: 'مشروع' })),
        ...globalData.trash.categories.map(c => ({ type: 'category', name: c.name, id: c.id, info: 'بند أساسي' })),
        ...globalData.trash.expenses.map(e => ({ type: 'expense', name: e.item, id: e.id, info: `${e.amount}` }))
    ];
    if (allTrash.length === 0) { list.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 10px;">سلة المحذوفات فارغة.</div>'; return; }
    list.innerHTML = allTrash.map(item => `<div style="background: var(--card-bg); padding: 10px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); margin-bottom: 5px;"><div style="display: flex; flex-direction: column;"><span style="font-size: 0.85rem; font-weight: 600;">${item.name}</span><span style="font-size: 0.7rem; color: var(--text-secondary);">${item.info}</span></div><button class="text-btn" onclick="restoreFromTrash('${item.type}', '${item.id}')" style="color: var(--accent-color); font-size: 0.8rem;">استعادة</button></div>`).join('');
}

window.restoreFromTrash = (type, id) => {
    if (type === 'project') { const it = globalData.trash.projects.find(p => p.id === id); if (it) { globalData.projects.push(it); globalData.trash.projects = globalData.trash.projects.filter(p => p.id !== id); } }
    else if (type === 'category') { const it = globalData.trash.categories.find(c => c.id === id); if (it) { appData.categories.push(it); globalData.trash.categories = globalData.trash.categories.filter(c => c.id !== id); } }
    else if (type === 'expense') { const it = globalData.trash.expenses.find(e => e.id == id); if (it) { appData.expenses.push(it); globalData.trash.expenses = globalData.trash.expenses.filter(e => e.id != id); } }
    saveData(); updateProjectContext(); renderTrash();
};

function populateSelects() {
    catSelect.innerHTML = appData.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    updateStageSelect();
}

function updateStageSelect() {
    const cat = appData.categories.find(c => c.id === catSelect.value);
    if (cat) stageSelect.innerHTML = cat.stages.map(s => `<option value="${s}">${s}</option>`).join('');
}

function openEditExpense(id) {
    editingExpenseId = id; const exp = appData.expenses.find(e => e.id === id); if (!exp) return;
    catSelect.value = exp.categoryId; updateStageSelect(); stageSelect.value = exp.stage;
    document.getElementById('exp-item').value = exp.item; document.getElementById('exp-amount').value = exp.amount;
    document.getElementById('exp-notes').value = exp.notes || '';
    currentExpenseImage = exp.image || null;
    if (currentExpenseImage) { previewImg.src = currentExpenseImage; imagePreview.style.display = 'block'; }
    else imagePreview.style.display = 'none';
    document.getElementById('modal-expense-title').textContent = 'تعديل المصروف';
    document.getElementById('delete-expense-btn').style.display = 'block';
    addExpenseModal.classList.add('active');
}

function setupEventListeners() {
    document.getElementById('add-expense-btn').onclick = () => {
        editingExpenseId = null; expenseForm.reset(); currentExpenseImage = null;
        imagePreview.style.display = 'none'; document.getElementById('modal-expense-title').textContent = 'إضافة مصروف جديد';
        document.getElementById('delete-expense-btn').style.display = 'none'; populateSelects();
        addExpenseModal.classList.add('active');
    };
    document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = (e) => { const m = e.target.closest('.modal'); if (m) m.classList.remove('active'); });
    document.getElementById('bulk-export-receipts').onclick = exportSelectedReceiptsPDF;
    catSelect.onchange = updateStageSelect;
    expenseForm.onsubmit = (e) => {
        e.preventDefault(); const catName = catSelect.options[catSelect.selectedIndex].text;
        if (editingExpenseId) {
            const exp = appData.expenses.find(e => e.id === editingExpenseId);
            if (exp) { Object.assign(exp, { categoryId: catSelect.value, category: catName, stage: stageSelect.value, item: document.getElementById('exp-item').value, amount: document.getElementById('exp-amount').value, notes: document.getElementById('exp-notes').value, image: currentExpenseImage }); }
        } else {
            appData.expenses.push({ id: Date.now() + Math.random(), categoryId: catSelect.value, category: catName, stage: stageSelect.value, item: document.getElementById('exp-item').value, amount: document.getElementById('exp-amount').value, notes: document.getElementById('exp-notes').value, image: currentExpenseImage, date: new Date().toISOString() });
        }
        saveData(true); updateProjectContext(); addExpenseModal.classList.remove('active');
    };
    document.getElementById('delete-expense-btn').onclick = () => { if(confirm('حذف؟')) { appData.expenses = appData.expenses.filter(e => e.id !== editingExpenseId); saveData(); updateProjectContext(); addExpenseModal.classList.remove('active'); } };
    uploadTrigger.onclick = () => expImageInput.click();
    expImageInput.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.type === 'application/pdf') {
            const reader = new FileReader(); reader.onload = async function() {
                try {
                    const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
                    const page = await pdf.getPage(1); const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
                    canvas.height = viewport.height; canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    currentExpenseImage = canvas.toDataURL('image/jpeg', 0.8); previewImg.src = currentExpenseImage; imagePreview.style.display = 'block';
                } catch (error) { alert('خطأ في معالجة PDF'); }
            }; reader.readAsArrayBuffer(file);
        } else { compressImage(file, (b64) => { currentExpenseImage = b64; previewImg.src = b64; imagePreview.style.display = 'block'; }); }
    };
    removeImageBtn.onclick = () => { currentExpenseImage = null; imagePreview.style.display = 'none'; expImageInput.value = ''; };
    document.getElementById('add-new-stage-btn').onclick = () => {
        const cat = appData.categories.find(c => c.id === catSelect.value);
        if (cat) { const name = prompt('اسم المرحلة:'); if(name && !cat.stages.includes(name)) { cat.stages.push(name); saveData(); updateStageSelect(); stageSelect.value = name; } }
    };
    document.getElementById('project-selector').onchange = (e) => { globalData.currentProjectId = e.target.value; saveData(); updateProjectContext(); };
    document.getElementById('add-project-btn').onclick = () => { const name = prompt("اسم المشروع:"); if (name) { const id = 'proj_' + Date.now(); globalData.projects.push({ id, projectName: name, currency: 'د.ب', categories: JSON.parse(JSON.stringify(defaultCategories)), expenses: [] }); globalData.currentProjectId = id; saveData(); updateProjectContext(); } };
    document.getElementById('project-name-input').onchange = (e) => { appData.projectName = e.target.value; saveData(); document.getElementById('project-title-display').textContent = appData.projectName; populateProjectSelector(); };
    document.getElementById('currency-input').onchange = (e) => { appData.currency = e.target.value; saveData(); renderDashboard(); renderCategories(); renderReports(); };
    document.getElementById('budget-input').onchange = (e) => { appData.budget = parseFloat(e.target.value) || 0; saveData(); renderDashboard(); };
    document.getElementById('export-excel').onclick = () => {
        const rows = []; let grandTotal = 0;
        appData.expenses.forEach((e, idx) => { rows.push({ 'م': idx+1, 'التاريخ': new Date(e.date).toLocaleDateString('ar-EG'), 'البند': e.category, 'المرحلة': e.stage, 'نوع المصروف': e.item, 'المبلغ': parseFloat(e.amount), 'ملاحظات': e.notes || '' }); grandTotal += parseFloat(e.amount); });
        rows.push({}); rows.push({ 'نوع المصروف': 'الإجمالي الكلي:', 'المبلغ': grandTotal });
        const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "تقرير"); XLSX.writeFile(wb, `${appData.projectName}_تقرير.xlsx`);
    };
    document.getElementById('add-main-cat-btn').onclick = addMainCategory;
    document.getElementById('reset-to-standard-cats-btn').onclick = resetToStandardCategories;
    document.getElementById('delete-current-project-btn').onclick = deleteCurrentProject;
    document.getElementById('reset-data').onclick = () => { if(confirm('سيتم مسح جميع البيانات والمشاريع نهائياً. هل أنت متأكد؟')) { localStorage.removeItem('bunyan_data'); location.reload(); } };

    document.getElementById('export-pdf').onclick = async () => {
        const btn = document.getElementById('export-pdf');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon><span>جاري التحميل...</span>';
        btn.disabled = true;

        try {
            const chartImg = document.getElementById('categoryChart').toDataURL("image/png");
            const totalSpent = appData.expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
            const budget = parseFloat(appData.budget) || 0;
            const remaining = budget - totalSpent;

            const reportHTML = `
                <div id="pdf-export-container" style="padding: 40px; direction: rtl; font-family: 'Tajawal', sans-serif; background: #fff; color: #000; width: 210mm; min-height: 297mm; box-sizing: border-box;">
                    <div style="text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px;">
                        <h1 style="color: #f59e0b; margin: 0; font-size: 28pt;">تقرير المصروفات المالي</h1>
                        <h2 style="margin: 10px 0; color: #333; font-size: 20pt;">${appData.projectName}</h2>
                        <p style="color: #666; font-size: 12pt;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 40px; gap: 20px;">
                        <div style="flex: 1; background: #f8fafc; padding: 20px; border-radius: 15px; text-align: center; border: 1px solid #e2e8f0;">
                            <div style="font-size: 12pt; color: #64748b; margin-bottom: 8px;">الميزانية</div>
                            <div style="font-size: 16pt; font-weight: bold; color: #1e293b;">${budget.toFixed(2)} ${appData.currency}</div>
                        </div>
                        <div style="flex: 1; background: #fffbeb; padding: 20px; border-radius: 15px; text-align: center; border: 1px solid #fef3c7;">
                            <div style="font-size: 12pt; color: #b45309; margin-bottom: 8px;">إجمالي المصروف</div>
                            <div style="font-size: 16pt; font-weight: bold; color: #92400e;">${totalSpent.toFixed(2)} ${appData.currency}</div>
                        </div>
                        <div style="flex: 1; background: ${remaining < 0 ? '#fef2f2' : '#f0fdf4'}; padding: 20px; border-radius: 15px; text-align: center; border: 1px solid ${remaining < 0 ? '#fee2e2' : '#dcfce7'};">
                            <div style="font-size: 12pt; color: ${remaining < 0 ? '#ef4444' : '#15803d'}; margin-bottom: 8px;">المتبقي</div>
                            <div style="font-size: 16pt; font-weight: bold; color: ${remaining < 0 ? '#b91c1c' : '#166534'};">${remaining.toFixed(2)} ${appData.currency}</div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-bottom: 50px; page-break-inside: avoid;">
                        <h3 style="color: #475569; margin-bottom: 20px; font-size: 16pt;">توزيع المصروفات حسب البنود</h3>
                        <div style="display: flex; justify-content: center;">
                            <img src="${chartImg}" style="width: 500px; height: auto;">
                        </div>
                    </div>

                    <div style="margin-top: 20px;">
                        <h3 style="color: #475569; border-right: 6px solid #f59e0b; padding-right: 15px; margin-bottom: 25px; font-size: 18pt;">تفصيل البنود والمراحل</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                            <thead>
                                <tr style="background: #f59e0b; color: white;">
                                    <th style="padding: 15px; border: 1px solid #d97706; text-align: right; font-size: 12pt;">البند / المرحلة</th>
                                    <th style="padding: 15px; border: 1px solid #d97706; text-align: left; font-size: 12pt;">المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${appData.categories.map(cat => {
                                    const catExps = appData.expenses.filter(e => String(e.categoryId) === String(cat.id));
                                    if (catExps.length === 0) return '';
                                    const catTotal = catExps.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                                    
                                    let rows = `
                                        <tr style="background: #fff8e6; font-weight: bold; page-break-inside: avoid;">
                                            <td style="padding: 15px; border: 1px solid #fde68a; text-align: right; font-size: 12pt;">${cat.name}</td>
                                            <td style="padding: 15px; border: 1px solid #fde68a; text-align: left; font-size: 12pt;">${catTotal.toFixed(2)}</td>
                                        </tr>
                                    `;

                                    cat.stages.forEach(stage => {
                                        const sExps = catExps.filter(e => e.stage === stage);
                                        if (sExps.length === 0) return;
                                        const sTotal = sExps.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                                        rows += `
                                            <tr style="page-break-inside: avoid;">
                                                <td style="padding: 12px 40px; border: 1px solid #eee; text-align: right; color: #444; font-size: 11pt;">${stage}</td>
                                                <td style="padding: 12px; border: 1px solid #eee; text-align: left; color: #444; font-size: 11pt;">${sTotal.toFixed(2)}</td>
                                            </tr>
                                        `;
                                    });
                                    return rows;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            const opt = {
                margin: 0,
                filename: `${appData.projectName}_ملخص_مالي.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    letterRendering: true,
                    logging: false,
                    windowWidth: 1200
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // Create a temporary hidden container to render from
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'fixed';
            tempContainer.style.left = '0';
            tempContainer.style.top = '0';
            tempContainer.style.width = '210mm';
            tempContainer.style.zIndex = '-1000';
            tempContainer.style.backgroundColor = '#ffffff';
            tempContainer.innerHTML = reportHTML;
            document.body.appendChild(tempContainer);

            // Wait for image and fonts to settle
            setTimeout(() => {
                html2pdf().set(opt).from(tempContainer).save().then(() => {
                    document.body.removeChild(tempContainer);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                });
            }, 1000);


        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء إنشاء التقرير.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    document.getElementById('trigger-export-selection').onclick = openReceiptSelectionModal;
    document.getElementById('modal-select-all').onclick = () => {
        const checks = document.querySelectorAll('.expense-selection-check');
        checks.forEach(c => c.checked = true);
    };
    document.getElementById('modal-select-images').onclick = () => {
        const checks = document.querySelectorAll('.expense-selection-check');
        checks.forEach(c => {
            const hasImg = c.getAttribute('data-has-img') === 'true';
            c.checked = hasImg;
        });
    };
    document.getElementById('modal-confirm-export').onclick = () => {
        const checks = document.querySelectorAll('.expense-selection-check:checked');
        selectedExpenseIds = new Set(Array.from(checks).map(c => parseFloat(c.value)));
        if (selectedExpenseIds.size === 0) return alert('يرجى اختيار مصروف واحد على الأقل.');
        exportSelectedReceiptsPDF();
        document.getElementById('receipt-selection-modal').classList.remove('active');
    };

    document.getElementById('export-json').onclick = () => { const blob = new Blob([JSON.stringify(globalData)], {type: "application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "backup.json"; a.click(); };
}

function openReceiptSelectionModal() {
    const container = document.getElementById('selection-list-container');
    container.innerHTML = '';
    
    if (appData.expenses.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد مصروفات متاحة.</div>';
    } else {
        const sorted = [...appData.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach(exp => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '10px';
            item.style.padding = '10px';
            item.style.borderBottom = '1px solid var(--border-color)';
            item.innerHTML = `
                <input type="checkbox" class="expense-selection-check" value="${exp.id}" data-has-img="${!!exp.image}" style="width: 20px; height: 20px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${exp.item}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${exp.category} • ${parseFloat(exp.amount).toFixed(2)} ${appData.currency}</div>
                </div>
                ${exp.image ? '<ion-icon name="image-outline" style="color: var(--accent-color); font-size: 1.2rem;"></ion-icon>' : ''}
            `;
            container.appendChild(item);
        });
    }
    document.getElementById('receipt-selection-modal').classList.add('active');
}

init();

async function exportSelectedReceiptsPDF() {
    const selectedExpenses = appData.expenses.filter(exp => selectedExpenseIds.has(exp.id));
    if (selectedExpenses.length === 0) return alert('تحديد؟');
    const expensesWithImages = selectedExpenses.filter(exp => exp.image);
    
    if (expensesWithImages.length === 0) {
        if (!confirm('لا توجد صور للمصروفات المختارة. هل تريد تصدير تقرير نصي فقط؟')) return;
    }

    let printHTML = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>تقرير المصروفات والأرصدة</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
            .print-page { page-break-after: always; min-height: 260mm; display: flex; flex-direction: column; padding-bottom: 20px; border-bottom: 1px solid #eee; margin-bottom: 20px; }
            .header { text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 20px; }
            .header h2 { color: #f59e0b; margin: 0; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .info-table th, .info-table td { border: 1px solid #e2e8f0; padding: 10px; text-align: right; }
            .info-table th { background: #f8fafc; color: #64748b; width: 25%; }
            .img-container { flex: 1; display: flex; justify-content: center; align-items: center; background: #f9fafb; border: 1px dashed #cbd5e1; border-radius: 10px; overflow: hidden; max-height: 180mm; }
            .img-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
            .no-print { display: none; }
            @media print { .no-print { display: none; } }
        </style>
    </head>
    <body>
    `;

    selectedExpenses.forEach((exp, index) => {
        printHTML += `
        <div class="print-page">
            <div class="header">
                <h2>إثبات مصروف (${index + 1} من ${selectedExpenses.length})</h2>
                <div style="font-size: 10pt; color: #666;">مشروع: ${appData.projectName}</div>
            </div>
            <table class="info-table">
                <tr>
                    <th>البيان (نوع المصروف)</th>
                    <td>${exp.item}</td>
                    <th>التاريخ</th>
                    <td>${new Date(exp.date).toLocaleDateString('ar-EG')}</td>
                </tr>
                <tr>
                    <th>البند / المرحلة</th>
                    <td>${exp.category} - ${exp.stage}</td>
                    <th>المبلغ</th>
                    <td style="font-weight: bold; color: #f59e0b;">${parseFloat(exp.amount).toFixed(2)} ${appData.currency}</td>
                </tr>
                ${exp.notes ? `<tr><th>ملاحظات</th><td colspan="3">${exp.notes}</td></tr>` : ''}
            </table>
            <div class="img-container">
                ${exp.image ? `<img src="${exp.image}">` : '<div style="color: #94a3b8; font-size: 14pt;">لا توجد صورة مرفقة</div>'}
            </div>
        </div>
        `;
    });

    printHTML += `
    <script>
        window.onload = () => {
            setTimeout(() => {
                window.print();
                // Optional: window.close();
            }, 500);
        };
    </script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(printHTML);
    win.document.close();
}
