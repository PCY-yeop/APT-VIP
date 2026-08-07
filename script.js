// ====================================================
// VIP 브리핑북 메인 스크립트 (초고속 이미지 압축 & 클라우드 동기화 최적화)
// ====================================================

// ----------------------------------------------------
// [전역 상태 변수 및 데이터 표준화]
// ----------------------------------------------------
let currentUser = null;
let currentSiteId = null;
let userSites = [];

let siteData = {}; 
let isEditMode = false;
let currentMain = null;
let currentSubIndex = 0;

let sortablePrimaryDesktop = null;
let sortablePrimaryMobile = null;
let sortableSecondaryDesktop = null;
let sortableSecondaryMobile = null;

let touchState = { scale: 1, startDist: 0, posX: 0, posY: 0, startX: 0, startY: 0, isDragging: false, lastTapTime: 0 };
let editingSiteId = null;
let isSplashFinished = false;

// 모든 메인 및 서브 목차 데이터 구조 보정 (고유 ID 및 로고 데이터 할당)
function normalizeSiteData(data) {
    if (!data || typeof data !== 'object') return { _logoUrl: 'images/rogo.png', _categoryOrder: [] };
    const normalized = {
        _logoUrl: data._logoUrl || 'images/rogo.png',
        _categoryOrder: Array.isArray(data._categoryOrder) ? [...data._categoryOrder] : []
    };
    
    Object.keys(data).forEach(catKey => {
        if (catKey === '_logoUrl' || catKey === '_categoryOrder') return;
        const cat = data[catKey];
        if (cat && typeof cat === 'object') {
            const subItems = Array.isArray(cat.subItems) ? cat.subItems : [];
            normalized[catKey] = {
                id: catKey,
                title: cat.title || "제목 없음",
                subItems: subItems.map((sub, idx) => ({
                    id: sub.id || `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
                    name: sub.name || "서브목차",
                    images: Array.isArray(sub.images) ? sub.images : []
                }))
            };
            if (!normalized._categoryOrder.includes(catKey)) {
                normalized._categoryOrder.push(catKey);
            }
        }
    });

    // 존재하지 않는 키 제거
    normalized._categoryOrder = normalized._categoryOrder.filter(k => normalized[k]);
    return normalized;
}

// 메인 카테고리 순서 정렬 추출 유틸리티
function getMainKeys() {
    if (!siteData) return [];
    let keys = Array.isArray(siteData._categoryOrder) ? [...siteData._categoryOrder] : [];
    
    Object.keys(siteData).forEach(k => {
        if (k !== '_logoUrl' && k !== '_categoryOrder' && !keys.includes(k) && siteData[k]) {
            keys.push(k);
        }
    });

    keys = keys.filter(k => siteData[k]);
    siteData._categoryOrder = keys;
    return keys;
}

// ----------------------------------------------------
// [커스텀 알림/모달 유틸리티 (alert/confirm 대체)]
// ----------------------------------------------------

async function createNewSite() {
    const siteName = prompt("새 분양 현장 이름을 입력하세요:");
    if (!siteName || !siteName.trim()) return;

    const now = Date.now();
    const firstCatId = `cat_${now}_1`;
    const freshData = {
        _logoUrl: 'images/rogo.png',
        _categoryOrder: [firstCatId],
        [firstCatId]: {
            id: firstCatId,
            title: "사업안내",
            subItems: [
                { id: `sub_${now}_1`, name: "사업개요", images: [] }
            ]
        }
    };

    if (window.supabaseClient) {
        const { error } = await window.supabaseClient
            .from('sites')
            .insert([{ user_id: currentUser ? currentUser.id : 'guest', name: siteName.trim(), data: freshData }]);

        if (error) {
            showToast("현장 추가 실패: " + error.message, true);
            return;
        }
    }

    showToast("새 현장이 생성되었습니다.");
    loadUserSites();
}

async function deleteSite(siteId, event) {
    if (event) event.stopPropagation();
    
    const executeDelete = async () => {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient.from('sites').delete().eq('id', siteId);
            if (error) {
                showToast("삭제 실패: " + error.message, true);
                return;
            }
        }
        showToast("현장이 삭제되었습니다.");
        loadUserSites();
    };

    if (typeof openConfirmModal === 'function') {
        openConfirmModal("현장 삭제", "해당 현장과 모든 브리핑북 자료가 완전히 삭제됩니다. 진행하시겠습니까?", executeDelete);
    } else {
        executeDelete();
    }
}

async function selectSite(siteId) {
    currentSiteId = siteId;

    // [0.01초 터치 반응] 카드 터치 즉시 로딩 오버레이 표시
    const cardEl = document.getElementById(`siteCard_${siteId}`);
    if (cardEl) {
        cardEl.classList.add('opacity-80', 'pointer-events-none');
        cardEl.insertAdjacentHTML('beforeend', `<div id="cardLoader_${siteId}" class="absolute inset-0 bg-slate-950/85 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold z-20 backdrop-blur-sm"><i class="fa-solid fa-circle-notch fa-spin text-lg"></i> 브리핑북 불러오는 중...</div>`);
    }

    try {
        let site = userSites.find(s => s.id === siteId);

        // 해당 현장의 브리핑 데이터만 싱글 쿼리로 초고속 불러오기
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from('sites')
                .select('id, name, data')
                .eq('id', siteId')
                .single();

            if (!error && data) {
                site = data;
            }
        }

        siteData = normalizeSiteData(site ? site.data : {});
        isEditMode = false;
        resetEditUI();
        updateLogoDisplay();

        const keys = getMainKeys();
        currentMain = keys.length > 0 ? keys[0] : null;
        currentSubIndex = 0;

        const splashTitle = document.getElementById('splashSiteTitle');
        if (splashTitle) splashTitle.innerText = site ? site.name : '';

        document.getElementById('siteLobbyModal')?.classList.add('hidden');
        initNav();
    } catch(err) {
        console.error("현장 데이터 로드 오류:", err);
        showToast("현장 데이터를 불러오는 중 오류가 발생했습니다.", true);
    } finally {
        if (cardEl) {
            cardEl.classList.remove('opacity-80', 'pointer-events-none');
            const loader = document.getElementById(`cardLoader_${siteId}`);
            if (loader) loader.remove();
        }
    }
}

async function saveCurrentSiteData() {
    if (!currentSiteId || !window.supabaseClient) return;
    try {
        await window.supabaseClient
            .from('sites')
            .update({ data: siteData })
            .eq('id', currentSiteId);
    } catch(err) {
        console.error("클라우드 동기화 실패:", err);
    }
}

// ----------------------------------------------------
// [4. 로고 변경 및 화면 동기화]
// ----------------------------------------------------
async function changeSiteLogo(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        showToast("로고 이미지 저장 중...");
        const logoUrl = await uploadToStorageOrCompress(file);
        siteData._logoUrl = logoUrl;
        updateLogoDisplay();
        await saveCurrentSiteData();
        showToast("로고 이미지가 성공적으로 변경되었습니다.");
    } catch(err) {
        showToast("로고 변경 중 오류가 발생했습니다.", true);
    }
    event.target.value = '';
}

function updateLogoDisplay() {
    const logoUrl = (siteData && siteData._logoUrl) ? siteData._logoUrl : 'images/rogo.png';
    const mobileLogo = document.getElementById('mobileLogo');
    const desktopLogo = document.getElementById('desktopLogo');
    if (mobileLogo) mobileLogo.src = logoUrl;
    if (desktopLogo) desktopLogo.src = logoUrl;
}

// ----------------------------------------------------
// [5. 편집 모드 및 드래그 앤 드롭 순서 변경]
// ----------------------------------------------------
function toggleEditMode() {
    isEditMode = !isEditMode;

    const btnDesktop = document.getElementById('editToggleBtnDesktop');
    const textDesktop = document.getElementById('editToggleTextDesktop');
    const btnMobile = document.getElementById('editToggleBtnMobile');
    const textMobile = document.getElementById('editToggleTextMobile');
    const statusBadge = document.getElementById('modeStatusBadge');

    const mobileLogoBtn = document.getElementById('mobileLogoEditBtn');
    const desktopLogoBtn = document.getElementById('desktopLogoEditBtn');

    if (isEditMode) {
        if (btnDesktop) {
            btnDesktop.className = "bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow active:scale-95";
            if (textDesktop) textDesktop.innerText = "수정 완료";
        }
        if (btnMobile) {
            btnMobile.className = "bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow";
            if (textMobile) textMobile.innerText = "수정 완료";
        }
        if (statusBadge) {
            statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span><span class="text-amber-700 font-bold">편집 모드</span>`;
        }
        if (mobileLogoBtn) mobileLogoBtn.classList.remove('hidden');
        if (desktopLogoBtn) desktopLogoBtn.classList.remove('hidden');

        showToast("편집 모드가 활성화되었습니다.");
    } else {
        resetEditUI();
        saveCurrentSiteData();
        showToast("변경사항이 클라우드에 저장되었습니다.");
    }
    initNav();
}

function updateMainOrderFromDOM(container) {
    const items = container.querySelectorAll('.main-nav-item');
    const newOrder = [];
    
    items.forEach(item => {
        const key = item.getAttribute('data-key');
        if (key && siteData[key] && !newOrder.includes(key)) {
            newOrder.push(key);
        }
    });

    Object.keys(siteData).forEach(key => {
        if (key !== '_logoUrl' && key !== '_categoryOrder' && !newOrder.includes(key) && siteData[key]) {
            newOrder.push(key);
        }
    });

    siteData._categoryOrder = newOrder;
    saveCurrentSiteData();
    initNav();
}

function updateSubOrderFromDOM(container) {
    if (!currentMain || !siteData[currentMain] || !Array.isArray(siteData[currentMain].subItems)) return;

    const containerMainKey = container.getAttribute('data-main-key');
    if (containerMainKey !== currentMain) return;

    const items = container.querySelectorAll('.sub-nav-item');
    const existingSubItems = siteData[currentMain].subItems;
    const subMap = new Map(existingSubItems.map(item => [item.id, item]));

    const newSubItems = [];
    items.forEach(item => {
        const subId = item.getAttribute('data-sub-id');
        if (subId && subMap.has(subId)) {
            newSubItems.push(subMap.get(subId));
            subMap.delete(subId);
        }
    });

    subMap.forEach(remainingItem => {
        newSubItems.push(remainingItem);
    });

    siteData[currentMain].subItems = newSubItems;

    if (currentSubIndex >= newSubItems.length) {
        currentSubIndex = Math.max(0, newSubItems.length - 1);
    }

    saveCurrentSiteData();
    renderSecondaryNav();
}

function initSortableEvents() {
    if (sortablePrimaryDesktop) {
        try { sortablePrimaryDesktop.destroy(); } catch(e) {}
        sortablePrimaryDesktop = null;
    }
    if (sortablePrimaryMobile) {
        try { sortablePrimaryMobile.destroy(); } catch(e) {}
        sortablePrimaryMobile = null;
    }

    const options = {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'bg-emerald-900/40',
        filter: '.no-drag'
    };

    const navDesktop = document.getElementById('primaryNavDesktop');
    if (navDesktop && isEditMode && typeof Sortable !== 'undefined') {
        sortablePrimaryDesktop = new Sortable(navDesktop, { 
            ...options, 
            onEnd: () => setTimeout(() => updateMainOrderFromDOM(navDesktop), 10) 
        });
    }

    const navMobile = document.getElementById('primaryNavMobile');
    if (navMobile && isEditMode && typeof Sortable !== 'undefined') {
        sortablePrimaryMobile = new Sortable(navMobile, { 
            ...options, 
            onEnd: () => setTimeout(() => updateMainOrderFromDOM(navMobile), 10) 
        });
    }
}

function initSubSortableEvents() {
    if (sortableSecondaryDesktop) {
        try { sortableSecondaryDesktop.destroy(); } catch(e) {}
        sortableSecondaryDesktop = null;
    }
    if (sortableSecondaryMobile) {
        try { sortableSecondaryMobile.destroy(); } catch(e) {}
        sortableSecondaryMobile = null;
    }

    const options = {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'bg-slate-300',
        filter: '.no-drag'
    };

    const subDesktop = document.getElementById('secondaryNavDesktop');
    if (subDesktop && isEditMode && typeof Sortable !== 'undefined') {
        sortableSecondaryDesktop = new Sortable(subDesktop, { 
            ...options, 
            onEnd: () => setTimeout(() => updateSubOrderFromDOM(subDesktop), 10) 
        });
    }

    const subMobile = document.getElementById('secondaryNavMobile');
    if (subMobile && isEditMode && typeof Sortable !== 'undefined') {
        sortableSecondaryMobile = new Sortable(subMobile, { 
            ...options, 
            onEnd: () => setTimeout(() => updateSubOrderFromDOM(subMobile), 10) 
        });
    }
}

// ----------------------------------------------------
// [6. 목차 관리 및 이미지 업로드 (자동 초고속 압축)]
// ----------------------------------------------------
function addMainCategory() {
    const title = prompt("새 메인 목차 이름을 입력하세요:");
    if (!title || !title.trim()) return;
    
    const newKey = 'cat_' + Date.now();
    siteData[newKey] = {
        id: newKey,
        title: title.trim(),
        subItems: []
    };
    
    if (!Array.isArray(siteData._categoryOrder)) {
        siteData._categoryOrder = [];
    }
    siteData._categoryOrder.push(newKey);

    currentMain = newKey;
    currentSubIndex = 0;
    saveCurrentSiteData();
    initNav();
}

function renameMainCategory(key, event) {
    if (event) event.stopPropagation();
    if (!siteData[key]) return;
    const currentTitle = siteData[key].title || '';
    const newTitle = prompt("메인 목차 이름을 변경하세요:", currentTitle);
    if (newTitle !== null && newTitle.trim() !== "") {
        siteData[key].title = newTitle.trim();
        saveCurrentSiteData();
        initNav();
    }
}

function deleteMainCategory(key, event) {
    if (event) event.stopPropagation();
    
    const catName = siteData[key] ? siteData[key].title : '메인목차';
    const executeDelete = () => {
        delete siteData[key];
        if (Array.isArray(siteData._categoryOrder)) {
            siteData._categoryOrder = siteData._categoryOrder.filter(k => k !== key);
        }
        const keys = getMainKeys();
        currentMain = keys.length > 0 ? keys[0] : null;
        currentSubIndex = 0;
        saveCurrentSiteData();
        initNav();
    };

    if (typeof openConfirmModal === 'function') {
        openConfirmModal("메인목차 삭제", `'${catName}' 카테고리를 삭제하시겠습니까?`, executeDelete);
    } else {
        executeDelete();
    }
}

function addSubCategory() {
    if (!currentMain || !siteData[currentMain]) return;
    const subName = prompt("새 서브 목차 이름을 입력하세요:");
    if (!subName || !subName.trim()) return;
    
    if (!Array.isArray(siteData[currentMain].subItems)) {
        siteData[currentMain].subItems = [];
    }

    const newSub = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: subName.trim(),
        images: []
    };

    siteData[currentMain].subItems.push(newSub);
    currentSubIndex = siteData[currentMain].subItems.length - 1;
    saveCurrentSiteData();
    renderSecondaryNav();
}

function renameSubCategory(index, event) {
    if (event) event.stopPropagation();
    if (!currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[index]) return;
    const currentName = siteData[currentMain].subItems[index].name || '';
    const newName = prompt("서브 목차 이름을 변경하세요:", currentName);
    if (newName !== null && newName.trim() !== "") {
        siteData[currentMain].subItems[index].name = newName.trim();
        saveCurrentSiteData();
        renderSecondaryNav();
    }
}

function deleteSubCategory(index, event) {
    if (event) event.stopPropagation();
    
    const executeSubDelete = () => {
        if (siteData[currentMain] && Array.isArray(siteData[currentMain].subItems)) {
            siteData[currentMain].subItems.splice(index, 1);
            currentSubIndex = Math.max(0, siteData[currentMain].subItems.length - 1);
            saveCurrentSiteData();
            renderSecondaryNav();
        }
    };

    if (typeof openConfirmModal === 'function') {
        openConfirmModal("서브목차 삭제", "서브 목차를 삭제하시겠습니까?", executeSubDelete);
    } else {
        executeSubDelete();
    }
}

async function addImageToCurrentSub(event) {
    const file = event.target.files[0];
    if (!file || !currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[currentSubIndex]) return;

    try {
        showToast("고화질 이미지 압축 및 클라우드 업로드 중...");
        const imageUrl = await uploadToStorageOrCompress(file);

        siteData[currentMain].subItems[currentSubIndex].images = [imageUrl];
        await saveCurrentSiteData();
        renderContent();
        showToast("이미지가 성공적으로 저장되었습니다!");
    } catch(err) {
        showToast("이미지 업로드 중 오류가 발생했습니다.", true);
    }
    event.target.value = '';
}

function deleteCurrentImage() {
    if (!currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[currentSubIndex]) return;
    
    const executeImgDelete = async () => {
        siteData[currentMain].subItems[currentSubIndex].images = [];
        await saveCurrentSiteData();
        renderContent();
        showToast("이미지가 삭제되었습니다.");
    };

    if (typeof openConfirmModal === 'function') {
        openConfirmModal("이미지 삭제", "현재 이미지를 삭제하시겠습니까?", executeImgDelete);
    } else {
        executeImgDelete();
    }
}

// ----------------------------------------------------
// [7. 네비게이션 및 콘텐츠 렌더링]
// ----------------------------------------------------
function initNav() {
    const primaryNavDesktop = document.getElementById('primaryNavDesktop');
    const primaryNavMobile = document.getElementById('primaryNavMobile');
    if (primaryNavDesktop) primaryNavDesktop.innerHTML = '';
    if (primaryNavMobile) primaryNavMobile.innerHTML = '';

    const keys = getMainKeys();
    
    if (keys.length === 0) {
        currentMain = null;
        if (primaryNavDesktop && isEditMode) {
            const addBtn = document.createElement('button');
            addBtn.className = "no-drag w-full py-2 px-3 rounded-xl text-xs font-bold border-2 border-dashed border-emerald-400/50 hover:border-emerald-400 text-emerald-300 flex items-center justify-center gap-1 mt-2";
            addBtn.onclick = addMainCategory;
            addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> 메인목차 추가`;
            primaryNavDesktop.appendChild(addBtn);
        }
        if (primaryNavMobile && isEditMode) {
            const addBtnMobile = document.createElement('button');
            addBtnMobile.className = "no-drag py-1.5 px-3 rounded-lg text-[13px] font-bold bg-emerald-600 text-white flex-shrink-0 flex items-center gap-1 shadow active:scale-95";
            addBtnMobile.onclick = addMainCategory;
            addBtnMobile.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i> 메인 추가`;
            primaryNavMobile.appendChild(addBtnMobile);
        }
        renderSecondaryNav();
        return;
    }

    if (!currentMain || !siteData[currentMain]) {
        currentMain = keys[0];
    }

    keys.forEach(key => {
        const item = siteData[key];
        if (!item) return;
        const isActive = key === currentMain;

        // [PC 전용 메인 목차]
        if (primaryNavDesktop) {
            const btn = document.createElement('div');
            btn.className = `main-nav-item w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-sm flex-shrink-0 border cursor-pointer select-none ${isActive ? 'bg-[#1b4d24] text-white border-emerald-600' : 'bg-white text-slate-800 hover:bg-slate-100 border-transparent'}`;
            btn.setAttribute('data-key', key);

            const dragHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 hover:text-emerald-300 mr-2.5 py-1 px-1 text-sm cursor-grab active:cursor-grabbing" onclick="event.stopPropagation()"></i>` : '';
            const editMainHtml = isEditMode ? `<button onclick="renameMainCategory('${key}', event)" class="text-slate-400 hover:text-emerald-300 p-1 rounded" title="이름 변경"><i class="fa-solid fa-pen text-[10px]"></i></button>` : '';
            const delHtml = isEditMode ? `<button onclick="deleteMainCategory('${key}', event)" class="text-rose-400 hover:text-rose-200 p-1 rounded hover:bg-rose-900/30" title="삭제"><i class="fa-solid fa-xmark"></i></button>` : '';

            btn.innerHTML = `
                ${dragHtml}
                <div class="flex-1 truncate py-0.5">
                    <span class="truncate pointer-events-none">${item.title}</span>
                </div>
                ${editMainHtml}
                ${delHtml}
            `;

            const handleMainClick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                e.preventDefault();
                e.stopPropagation();
                currentMain = key;
                currentSubIndex = 0;
                initNav();
            };

            btn.addEventListener('click', handleMainClick);
            primaryNavDesktop.appendChild(btn);
        }

        // [모바일 전용 메인 목차]
        if (primaryNavMobile) {
            const btnM = document.createElement('div');
            btnM.className = `main-nav-item py-1.5 px-3 rounded-lg text-[14px] font-bold whitespace-nowrap flex-shrink-0 touch-manipulation flex items-center gap-2 shadow cursor-pointer select-none ${isActive ? 'bg-[#1b4d24] text-white' : 'bg-white/10 text-slate-200'}`;
            btnM.setAttribute('data-key', key);

            const dragMobileHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-300 text-xs py-1 px-1" onclick="event.stopPropagation()"></i>` : '';
            const editMainMobileHtml = isEditMode ? `<button onclick="renameMainCategory('${key}', event)" class="text-slate-300 hover:text-emerald-300 p-0.5 ml-1" title="이름 변경"><i class="fa-solid fa-pen text-[10px]"></i></button>` : '';
            const delMainMobileHtml = isEditMode ? `<button onclick="deleteMainCategory('${key}', event)" class="text-slate-300 hover:text-rose-400 p-0.5" title="삭제"><i class="fa-solid fa-xmark text-[11px]"></i></button>` : '';

            btnM.innerHTML = `
                ${dragMobileHtml}
                <span class="pointer-events-none">${item.title}</span>
                ${editMainMobileHtml}
                ${delMainMobileHtml}
            `;

            const handleMainMobileClick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                e.preventDefault();
                e.stopPropagation();
                currentMain = key;
                currentSubIndex = 0;
                initNav();
            };

            btnM.addEventListener('click', handleMainMobileClick);
            primaryNavMobile.appendChild(btnM);
        }
    });

    if (primaryNavDesktop && isEditMode) {
        const addBtn = document.createElement('button');
        addBtn.className = "no-drag w-full py-2 px-3 rounded-xl text-xs font-bold border-2 border-dashed border-emerald-400/50 hover:border-emerald-400 text-emerald-300 flex items-center justify-center gap-1 mt-2";
        addBtn.onclick = addMainCategory;
        addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> 메인목차 추가`;
        primaryNavDesktop.appendChild(addBtn);
    }

    if (primaryNavMobile && isEditMode) {
        const addBtnMobile = document.createElement('button');
        addBtnMobile.className = "no-drag py-1.5 px-3 rounded-lg text-[13px] font-bold bg-emerald-600 text-white flex-shrink-0 flex items-center gap-1 shadow active:scale-95";
        addBtnMobile.onclick = addMainCategory;
        addBtnMobile.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i> 메인 추가`;
        primaryNavMobile.appendChild(addBtnMobile);
    }

    initSortableEvents();
    renderSecondaryNav();
}

function renderSecondaryNav() {
    const secondaryNavDesktop = document.getElementById('secondaryNavDesktop');
    const secondaryNavMobile = document.getElementById('secondaryNavMobile');
    const subTitle = document.getElementById('subCategoryTitle');

    if (secondaryNavDesktop) {
        secondaryNavDesktop.innerHTML = '';
        if (currentMain) secondaryNavDesktop.setAttribute('data-main-key', currentMain);
    }
    if (secondaryNavMobile) {
        secondaryNavMobile.innerHTML = '';
        if (currentMain) secondaryNavMobile.setAttribute('data-main-key', currentMain);
    }

    if (!currentMain || !siteData[currentMain]) {
        if (subTitle) subTitle.innerText = "세부목록";
        renderContent();
        return;
    }

    const currentObj = siteData[currentMain];
    if (subTitle) subTitle.innerText = currentObj.title;

    if (!Array.isArray(currentObj.subItems)) {
        currentObj.subItems = [];
    }

    currentObj.subItems.forEach((sub, index) => {
        const isActive = index === currentSubIndex;

        if (secondaryNavDesktop) {
            const btn = document.createElement('div');
            btn.className = `sub-nav-item w-full py-2 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between flex-shrink-0 border cursor-pointer select-none ${isActive ? 'bg-[#0d1b3e] text-white font-bold border-slate-600 shadow-md' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`;
            btn.setAttribute('data-sub-id', sub.id);

            const dragSubHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 hover:text-slate-600 mr-2 py-1 px-1 cursor-grab active:cursor-grabbing text-xs" onclick="event.stopPropagation()"></i>` : '';
            const editSubHtml = isEditMode ? `<button onclick="renameSubCategory(${index}, event)" class="text-slate-400 hover:text-emerald-600 p-1 mr-0.5" title="이름 변경"><i class="fa-solid fa-pen text-[10px]"></i></button>` : '';
            const delSubHtml = isEditMode ? `<button onclick="deleteSubCategory(${index}, event)" class="text-slate-400 hover:text-rose-500 p-1" title="삭제"><i class="fa-solid fa-trash-can"></i></button>` : '';

            btn.innerHTML = `
                ${dragSubHtml}
                <div class="flex-1 truncate py-0.5">
                    <span class="truncate pointer-events-none">${sub.name}</span>
                </div>
                ${editSubHtml}
                ${delSubHtml}
            `;

            const handleSubClick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                e.preventDefault();
                e.stopPropagation();
                currentSubIndex = index;
                renderSecondaryNav();
            };

            btn.addEventListener('click', handleSubClick);
            secondaryNavDesktop.appendChild(btn);
        }

        if (secondaryNavMobile) {
            const btnM = document.createElement('div');
            btnM.className = `sub-nav-item py-1 px-2.5 rounded-md text-[12px] font-semibold whitespace-nowrap flex-shrink-0 touch-manipulation flex items-center gap-1.5 cursor-pointer select-none ${isActive ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 border border-slate-300'}`;
            btnM.setAttribute('data-sub-id', sub.id);

            const dragSubMobileHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 text-[10px] py-1 px-0.5" onclick="event.stopPropagation()"></i>` : '';
            const editSubMobileHtml = isEditMode ? `<button onclick="renameSubCategory(${index}, event)" class="text-slate-400 hover:text-emerald-400 ml-0.5 p-0.5" title="이름 변경"><i class="fa-solid fa-pen text-[10px]"></i></button>` : '';
            const delSubMobileHtml = isEditMode ? `<button onclick="deleteSubCategory(${index}, event)" class="text-slate-400 hover:text-rose-500 p-0.5" title="삭제"><i class="fa-solid fa-xmark text-[11px]"></i></button>` : '';

            btnM.innerHTML = `
                ${dragSubMobileHtml}
                <span class="pointer-events-none">${sub.name}</span>
                ${editSubMobileHtml}
                ${delSubMobileHtml}
            `;

            const handleSubMobileClick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                e.preventDefault();
                e.stopPropagation();
                currentSubIndex = index;
                renderSecondaryNav();
            };

            btnM.addEventListener('click', handleSubMobileClick);
            secondaryNavMobile.appendChild(btnM);
        }
    });

    if (secondaryNavDesktop && isEditMode) {
        const addSubBtn = document.createElement('button');
        addSubBtn.className = "no-drag w-full py-2 px-2.5 rounded-lg text-xs font-bold border-2 border-dashed border-slate-400 hover:border-slate-600 text-slate-600 flex items-center justify-center gap-1 mt-2";
        addSubBtn.onclick = addSubCategory;
        addSubBtn.innerHTML = `<i class="fa-solid fa-plus"></i> 서브목차 추가`;
        secondaryNavDesktop.appendChild(addSubBtn);
    }

    if (secondaryNavMobile && isEditMode) {
        const addSubBtnMobile = document.createElement('button');
        addSubBtnMobile.className = "no-drag py-1 px-2.5 rounded-md text-[12px] font-bold bg-emerald-600 text-white flex-shrink-0 flex items-center gap-1 shadow active:scale-95";
        addSubBtnMobile.onclick = addSubCategory;
        addSubBtnMobile.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i> 서브 추가`;
        secondaryNavMobile.appendChild(addSubBtnMobile);
    }

    initSubSortableEvents();
    renderContent();
}

// ----------------------------------------------------
// [8. 브리핑 이미지 및 헤더 동기화 렌더링]
// ----------------------------------------------------
function renderContent() {
    resetImgTransform();
    const display = document.getElementById('contentDisplayArea');
    const badgeEl = document.getElementById('currentCategoryBadge');
    const titleEl = document.getElementById('currentContentTitle');

    if (badgeEl) {
        badgeEl.innerText = (currentMain && siteData[currentMain]) ? siteData[currentMain].title : "사업안내";
    }

    if (!currentMain || !siteData[currentMain] || !Array.isArray(siteData[currentMain].subItems) || siteData[currentMain].subItems.length === 0) {
        if (titleEl) titleEl.innerText = "서브목차 없음";
        if (display) display.innerHTML = `<div class="text-white text-sm">등록된 서브목차가 없습니다.</div>`;
        return;
    }

    const currentSub = siteData[currentMain].subItems[currentSubIndex];
    if (!currentSub) {
        if (titleEl) titleEl.innerText = "선택 안됨";
        if (display) display.innerHTML = `<div class="text-white text-sm">서브목차를 선택해 주세요.</div>`;
        return;
    }

    if (titleEl) titleEl.innerText = currentSub.name;

    const imageList = currentSub.images || [];

    if (imageList.length === 0) {
        if (isEditMode) {
            display.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-300 gap-3">
                    <i class="fa-regular fa-image text-4xl"></i>
                    <p class="text-xs">등록된 이미지가 없습니다.</p>
                    <label class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow">
                        <i class="fa-solid fa-upload"></i> 이미지 등록하기
                        <input type="file" accept="image/*" class="hidden" onchange="addImageToCurrentSub(event)">
                    </label>
                </div>
            `;
        } else {
            display.innerHTML = `<div class="text-white text-sm">준비된 브리핑 이미지가 없습니다.</div>`;
        }
        return;
    }

    const currentImgSrc = imageList[0];
    const editImgControls = isEditMode ? `
        <div class="absolute bottom-4 right-4 bg-slate-900/90 text-white px-3 py-2 rounded-xl flex items-center gap-4 text-xs z-10 shadow-lg border border-slate-700">
            <label class="hover:text-emerald-400 cursor-pointer flex items-center gap-1.5" title="이미지 변경">
                <i class="fa-solid fa-pen"></i> 이미지 수정
                <input type="file" accept="image/*" class="hidden" onchange="addImageToCurrentSub(event)">
            </label>
            <div class="h-4 w-[1px] bg-slate-600"></div>
            <button onclick="deleteCurrentImage()" class="hover:text-rose-400 text-slate-300 flex items-center gap-1.5" title="이미지 삭제">
                <i class="fa-solid fa-trash-can"></i> 삭제
            </button>
        </div>
    ` : '';

    display.innerHTML = `
        <div class="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl md:rounded-2xl bg-slate-900 shadow-xl border border-slate-300 transform-gpu">
            <img src="${currentImgSrc}" alt="${currentSub.name}" decoding="async" class="max-w-full max-h-full object-contain mx-auto shadow-md transition-transform duration-150 transform-gpu origin-center">
            ${editImgControls}
        </div>
    `;
}

function resetImgTransform() {
    touchState = { scale: 1, startDist: 0, posX: 0, posY: 0, startX: 0, startY: 0, isDragging: false, lastTapTime: 0 };
    applyImgTransform();
}

function applyImgTransform() {
    const imgEl = document.querySelector('#contentDisplayArea img');
    if (imgEl) {
        imgEl.style.transform = `translate(${touchState.posX}px, ${touchState.posY}px) scale(${touchState.scale})`;
        imgEl.style.transition = touchState.isDragging ? 'none' : 'transform 0.15s ease-out';
    }
}

function initImageTouchEvents() {
    const displayArea = document.getElementById('contentDisplayArea');
    if (!displayArea) return;

    displayArea.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            touchState.startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        } else if (e.touches.length === 1) {
            const now = Date.now();
            if (now - touchState.lastTapTime < 300) {
                touchState.scale = touchState.scale > 1.2 ? 1 : 2.5;
                if (touchState.scale === 1) { touchState.posX = 0; touchState.posY = 0; }
                applyImgTransform();
            }
            touchState.lastTapTime = now;
            touchState.startX = e.touches[0].clientX - touchState.posX;
            touchState.startY = e.touches[0].clientY - touchState.posY;
            touchState.isDragging = true;
        }
    }, { passive: false });

    displayArea.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && touchState.startDist > 0) {
            e.preventDefault();
            const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const factor = currentDist / touchState.startDist;
            let newScale = touchState.scale * factor;
            touchState.scale = Math.min(Math.max(newScale, 1), 4);
            touchState.startDist = currentDist;
            if (touchState.scale === 1) { touchState.posX = 0; touchState.posY = 0; }
            applyImgTransform();
        } else if (e.touches.length === 1 && touchState.scale > 1 && touchState.isDragging) {
            e.preventDefault();
            touchState.posX = e.touches[0].clientX - touchState.startX;
            touchState.posY = e.touches[0].clientY - touchState.startY;
            applyImgTransform();
        }
    }, { passive: false });

    displayArea.addEventListener('touchend', (e) => {
        touchState.isDragging = false;
        if (e.touches.length < 2) touchState.startDist = 0;
    });
}

function openZoomModal() {
    const modal = document.getElementById('imageZoomModal');
    const zoomedImg = document.getElementById('zoomedImage');
    if (!currentMain || !siteData[currentMain]) return;
    const currentSub = siteData[currentMain].subItems[currentSubIndex];
    
    if (modal && zoomedImg && currentSub && currentSub.images && currentSub.images.length > 0) {
        zoomedImg.src = currentSub.images[0];
        modal.classList.remove('hidden');
    }
}

function closeZoomModal() {
    document.getElementById('imageZoomModal')?.classList.add('hidden');
}

function toggleFullScreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
}

function preloadAllImagesWithProgress() {
    const percentEl = document.getElementById('loadingPercent');
    const progressBar = document.getElementById('loadingProgressBar');

    let progress = 0;
    const timer = setInterval(() => {
        progress += Math.floor(Math.random() * 25) + 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(timer);
            if (percentEl) percentEl.innerText = '100%';
            if (progressBar) progressBar.style.width = '100%';
            setTimeout(() => { forceHideLoadingScreen(); }, 200);
        } else {
            if (percentEl) percentEl.innerText = `${progress}%`;
            if (progressBar) progressBar.style.width = `${progress}%`;
        }
    }, 80);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeZoomModal(); });