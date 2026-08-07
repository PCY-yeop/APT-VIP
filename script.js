const SUPABASE_URL = "https://lmkpwupeinkqbfmhqcrc.supabase.co/rest/v1/";       // <--- 본인 Supabase Project URL 입력
const SUPABASE_ANON_KEY = "sb_publishable_BrgcLKyjLU7et47zEocZdQ_mNvmFNbo";     // <--- 본인 게시 가능한 키(anon key) 입력

// Supabase 클라이언트 초기화
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== 'undefined') {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase Cloud Sync Ready");
    } catch(err) {
        console.log("Supabase Init Error:", err);
    }
}

// ----------------------------------------------------
// [기본 데이터 구조]
// ----------------------------------------------------
let siteData = {
    summary: {
        title: "사업안내",
        subItems: [
            { name: "사업개요", images: ["images/s1.jpg"] },
            { name: "시공사", images: ["images/s2.jpg"] },
            { name: "프리미엄", images: ["images/s3.jpg"] }
        ]
    },
    layout: {
        title: "단지안내",
        subItems: [
            { name: "단지 배치도", images: ["images/d1.jpg"] },
            { name: "동·호수 배치도", images: ["images/d2.jpg"] },
            { name: "커뮤니티 시설", images: ["images/d3.jpg"] },
            { name: "엘리베이터", images: ["images/d4.jpg"] },
            { name: "주차 배치도", images: ["images/d5.jpg"] }
        ]
    },
    location: {
        title: "입지환경",
        subItems: [
            { name: "입지환경", images: ["images/e1.jpg"] },
            { name: "주변 시세 비교", images: ["images/e2.jpg"] }
        ]
    },
    units: {
        title: "타입안내",
        subItems: [
            { name: "59A 타입", images: ["images/59a.jpg"] },
            { name: "59B 타입", images: ["images/59b.jpg"] },
            { name: "84 타입", images: ["images/84.jpg"] },
            { name: "44 오피스텔", images: ["images/44.jpg"] }
        ]
    },
    price: {
        title: "분양안내",
        subItems: [
            { name: "아파트 분양가", images: ["images/b1.png"] },
            { name: "오피스텔 분양가", images: ["images/b2.jpg"] },
            { name: "특별 혜택 분석", images: ["images/b3.jpg"] }
        ]
    },
    officetel: {
        title: "계약안내",
        subItems: [
            { name: "납부계좌", images: ["images/g1.jpg"] }
        ]
    }
};

let isEditMode = false;
let currentMain = Object.keys(siteData)[0] || 'summary';
let currentSubIndex = 0;
let currentLogoUrl = 'images/rogo.png';

// SortableJS 변수 선언
let sortablePrimaryDesktop = null;
let sortablePrimaryMobile = null;
let sortableSecondaryDesktop = null;
let sortableSecondaryMobile = null;

// 터치/핑치 줌 상태 변수
let touchState = {
    scale: 1, startDist: 0, posX: 0, posY: 0, startX: 0, startY: 0, isDragging: false, lastTapTime: 0
};

// ----------------------------------------------------
// [로고 이미지 변경 및 UI 동기화]
// ----------------------------------------------------
function changeSiteLogo(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (currentLogoUrl && currentLogoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentLogoUrl); // 이전 메모리 해제
    }

    currentLogoUrl = URL.createObjectURL(file);
    updateLogoUI();
    event.target.value = '';
}

function updateLogoUI() {
    ['splashLogo', 'mobileLogo', 'desktopLogo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = currentLogoUrl;
    });
}

// ----------------------------------------------------
// [편집 모드 토글]
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
    } else {
        if (btnDesktop) {
            btnDesktop.className = "bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow active:scale-95";
            if (textDesktop) textDesktop.innerText = "편집하기";
        }
        if (btnMobile) {
            btnMobile.className = "bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow";
            if (textMobile) textMobile.innerText = "편집하기";
        }
        if (statusBadge) {
            statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>상담 전용 모드</span>`;
        }
        if (mobileLogoBtn) mobileLogoBtn.classList.add('hidden');
        if (desktopLogoBtn) desktopLogoBtn.classList.add('hidden');
    }
    initNav();
}

// ----------------------------------------------------
// [이미지 터치/핑치 줌 및 드래그]
// ----------------------------------------------------
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

// ----------------------------------------------------
// [목차 추가 및 삭제 로직]
// ----------------------------------------------------
function addMainCategory() {
    const title = prompt("새 메인 목차 이름을 입력하세요:");
    if (!title || !title.trim()) return;
    const newKey = 'cat_' + Date.now();
    siteData[newKey] = { title: title.trim(), subItems: [] };
    currentMain = newKey;
    currentSubIndex = 0;
    initNav();
}

function deleteMainCategory(key, event) {
    if (event) event.stopPropagation();
    if (!confirm(`'${siteData[key].title}' 삭제하시겠습니까?`)) return;
    delete siteData[key];
    const keys = Object.keys(siteData);
    currentMain = keys.length > 0 ? keys[0] : null;
    currentSubIndex = 0;
    initNav();
}

function addSubCategory() {
    if (!currentMain || !siteData[currentMain]) return;
    const subName = prompt("새 서브 목차 이름을 입력하세요:");
    if (!subName || !subName.trim()) return;
    siteData[currentMain].subItems.push({ name: subName.trim(), images: [] });
    currentSubIndex = siteData[currentMain].subItems.length - 1;
    renderSecondaryNav();
}

function deleteSubCategory(index, event) {
    if (event) event.stopPropagation();
    if (!confirm("서브 목차를 삭제하시겠습니까?")) return;
    siteData[currentMain].subItems.splice(index, 1);
    currentSubIndex = Math.max(0, siteData[currentMain].subItems.length - 1);
    renderSecondaryNav();
}

// ----------------------------------------------------
// [이미지 업로드 (Blob URL 사용으로 버벅거림 방지) 및 삭제]
// ----------------------------------------------------
function addImageToCurrentSub(event) {
    const file = event.target.files[0];
    if (!file || !currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[currentSubIndex]) return;

    const currentSub = siteData[currentMain].subItems[currentSubIndex];
    
    // 메모리에 가벼운 로컬 Blob URL 생성
    const blobUrl = URL.createObjectURL(file);
    currentSub.images = [blobUrl];
    renderContent();
    event.target.value = '';
}

function deleteCurrentImage() {
    if (!currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[currentSubIndex]) return;
    if (!confirm("현재 이미지를 삭제하시겠습니까?")) return;

    siteData[currentMain].subItems[currentSubIndex].images = [];
    renderContent();
}

// ----------------------------------------------------
// [순서 변경 - DOM 순서 기반 추출]
// ----------------------------------------------------
function updateMainOrderFromDOM(container) {
    const items = container.querySelectorAll('.main-nav-item');
    const newSiteData = {};
    items.forEach(item => {
        const key = item.getAttribute('data-key');
        if (key && siteData[key]) {
            newSiteData[key] = siteData[key];
        }
    });
    siteData = newSiteData;
    initNav();
}

function updateSubOrderFromDOM(container) {
    if (!currentMain || !siteData[currentMain] || !siteData[currentMain].subItems) return;
    const items = container.querySelectorAll('.sub-nav-item');
    const currentSubItems = siteData[currentMain].subItems;
    const activeSub = currentSubItems[currentSubIndex];

    const newSubItems = [];
    items.forEach(item => {
        const idx = parseInt(item.getAttribute('data-index'), 10);
        if (!isNaN(idx) && currentSubItems[idx]) {
            newSubItems.push(currentSubItems[idx]);
        }
    });

    siteData[currentMain].subItems = newSubItems;

    if (activeSub) {
        const newIdx = newSubItems.indexOf(activeSub);
        currentSubIndex = newIdx !== -1 ? newIdx : 0;
    } else {
        currentSubIndex = 0;
    }

    renderSecondaryNav();
}

function initSortableEvents() {
    if (sortablePrimaryDesktop) sortablePrimaryDesktop.destroy();
    if (sortablePrimaryMobile) sortablePrimaryMobile.destroy();

    const options = {
        handle: '.drag-handle',
        animation: 150,
        forceFallback: true,        // 모바일/PC 터치 캔버스 활성화
        fallbackTolerance: 2,       // 2px 이상 드래그 시 반응
        ghostClass: 'bg-emerald-900/40',
        filter: '.no-drag'
    };

    const navDesktop = document.getElementById('primaryNavDesktop');
    if (navDesktop && isEditMode) {
        sortablePrimaryDesktop = new Sortable(navDesktop, { ...options, onEnd: () => updateMainOrderFromDOM(navDesktop) });
    }

    const navMobile = document.getElementById('primaryNavMobile');
    if (navMobile && isEditMode) {
        sortablePrimaryMobile = new Sortable(navMobile, { ...options, onEnd: () => updateMainOrderFromDOM(navMobile) });
    }
}

function initSubSortableEvents() {
    if (sortableSecondaryDesktop) sortableSecondaryDesktop.destroy();
    if (sortableSecondaryMobile) sortableSecondaryMobile.destroy();

    const options = {
        handle: '.drag-handle',
        animation: 150,
        forceFallback: true,
        fallbackTolerance: 2,
        ghostClass: 'bg-slate-300',
        filter: '.no-drag'
    };

    const subDesktop = document.getElementById('secondaryNavDesktop');
    if (subDesktop && isEditMode) {
        sortableSecondaryDesktop = new Sortable(subDesktop, { ...options, onEnd: () => updateSubOrderFromDOM(subDesktop) });
    }

    const subMobile = document.getElementById('secondaryNavMobile');
    if (subMobile && isEditMode) {
        sortableSecondaryMobile = new Sortable(subMobile, { ...options, onEnd: () => updateSubOrderFromDOM(subMobile) });
    }
}

// ----------------------------------------------------
// [네비게이션 렌더링]
// ----------------------------------------------------
function initNav() {
    const primaryNavDesktop = document.getElementById('primaryNavDesktop');
    const primaryNavMobile = document.getElementById('primaryNavMobile');
    if (primaryNavDesktop) primaryNavDesktop.innerHTML = '';
    if (primaryNavMobile) primaryNavMobile.innerHTML = '';

    const keys = Object.keys(siteData);
    if (keys.length === 0) { renderSecondaryNav(); return; }
    if (!siteData[currentMain]) currentMain = keys[0];

    keys.forEach(key => {
        const item = siteData[key];
        const isActive = key === currentMain;

        if (primaryNavDesktop) {
            const btn = document.createElement('div');
            btn.className = `main-nav-item w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-sm flex-shrink-0 border ${isActive ? 'bg-[#1b4d24] text-white border-emerald-600' : 'bg-white text-slate-800 hover:bg-slate-100 border-transparent'}`;
            btn.setAttribute('data-key', key);

            const dragHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 hover:text-emerald-300 mr-2.5 py-1 px-1 text-sm cursor-grab active:cursor-grabbing" onclick="event.stopPropagation()"></i>` : '';
            const delHtml = isEditMode ? `<button onclick="deleteMainCategory('${key}', event)" class="text-red-400 hover:text-red-200 p-1 rounded hover:bg-red-900/30"><i class="fa-solid fa-xmark"></i></button>` : '';

            btn.innerHTML = `
                ${dragHtml}
                <div class="flex-1 truncate cursor-pointer py-0.5" onclick="currentMain='${key}'; currentSubIndex=0; initNav();">
                    <span class="truncate">${item.title}</span>
                </div>
                ${delHtml}
            `;
            primaryNavDesktop.appendChild(btn);
        }

        if (primaryNavMobile) {
            const btnM = document.createElement('div');
            btnM.className = `main-nav-item py-1.5 px-3 rounded-lg text-[14px] font-bold whitespace-nowrap flex-shrink-0 touch-manipulation flex items-center gap-2 shadow ${isActive ? 'bg-[#1b4d24] text-white' : 'bg-white/10 text-slate-200'}`;
            btnM.setAttribute('data-key', key);

            const dragMobileHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-300 text-xs py-1 px-1" onclick="event.stopPropagation()"></i>` : '';
            btnM.innerHTML = `
                ${dragMobileHtml}
                <span class="cursor-pointer" onclick="currentMain='${key}'; currentSubIndex=0; initNav();">${item.title}</span>
            `;
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
    initSortableEvents();
    renderSecondaryNav();
}

function renderSecondaryNav() {
    const secondaryNavDesktop = document.getElementById('secondaryNavDesktop');
    const secondaryNavMobile = document.getElementById('secondaryNavMobile');
    const subTitle = document.getElementById('subCategoryTitle');

    if (secondaryNavDesktop) secondaryNavDesktop.innerHTML = '';
    if (secondaryNavMobile) secondaryNavMobile.innerHTML = '';

    if (!currentMain || !siteData[currentMain]) {
        if (subTitle) subTitle.innerText = "세부목록";
        renderContent();
        return;
    }

    const currentObj = siteData[currentMain];
    if (subTitle) subTitle.innerText = currentObj.title;

    if (currentObj.subItems) {
        currentObj.subItems.forEach((sub, index) => {
            const isActive = index === currentSubIndex;

            if (secondaryNavDesktop) {
                const btn = document.createElement('div');
                btn.className = `sub-nav-item w-full py-2 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between flex-shrink-0 border ${isActive ? 'bg-[#0d1b3e] text-white font-bold border-slate-600 shadow-md' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`;
                btn.setAttribute('data-index', index);

                const dragSubHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 hover:text-slate-600 mr-2 py-1 px-1 cursor-grab active:cursor-grabbing text-xs" onclick="event.stopPropagation()"></i>` : '';
                const delSubHtml = isEditMode ? `<button onclick="deleteSubCategory(${index}, event)" class="text-slate-400 hover:text-red-500 p-1"><i class="fa-solid fa-trash-can"></i></button>` : '';

                btn.innerHTML = `
                    ${dragSubHtml}
                    <div class="flex-1 truncate cursor-pointer py-0.5" onclick="currentSubIndex=${index}; renderSecondaryNav();">
                        <span class="truncate">${sub.name}</span>
                    </div>
                    ${delSubHtml}
                `;
                secondaryNavDesktop.appendChild(btn);
            }

            if (secondaryNavMobile) {
                const btnM = document.createElement('div');
                btnM.className = `sub-nav-item py-1 px-2.5 rounded-md text-[12px] font-semibold whitespace-nowrap flex-shrink-0 touch-manipulation flex items-center gap-1.5 ${isActive ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 border border-slate-300'}`;
                btnM.setAttribute('data-index', index);

                const dragSubMobileHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 text-[10px] py-1 px-0.5" onclick="event.stopPropagation()"></i>` : '';
                btnM.innerHTML = `
                    ${dragSubMobileHtml}
                    <span class="cursor-pointer" onclick="currentSubIndex=${index}; renderSecondaryNav();">${sub.name}</span>
                `;
                secondaryNavMobile.appendChild(btnM);
            }
        });
    }

    if (secondaryNavDesktop && isEditMode) {
        const addSubBtn = document.createElement('button');
        addSubBtn.className = "no-drag w-full py-2 px-2.5 rounded-lg text-xs font-bold border-2 border-dashed border-slate-400 hover:border-slate-600 text-slate-600 flex items-center justify-center gap-1 mt-2";
        addSubBtn.onclick = addSubCategory;
        addSubBtn.innerHTML = `<i class="fa-solid fa-plus"></i> 서브목차 추가`;
        secondaryNavDesktop.appendChild(addSubBtn);
    }
    initSubSortableEvents();
    renderContent();
}

// ----------------------------------------------------
// [메인 콘텐츠 영역 렌더링]
// ----------------------------------------------------
function renderContent() {
    resetImgTransform();
    const display = document.getElementById('contentDisplayArea');
    if (!display) return;

    if (!currentMain || !siteData[currentMain] || siteData[currentMain].subItems.length === 0) {
        display.innerHTML = `<div class="text-white text-sm">항목이 없습니다.</div>`;
        return;
    }

    const currentSub = siteData[currentMain].subItems[currentSubIndex];
    document.getElementById('currentCategoryBadge').innerText = siteData[currentMain].title;
    document.getElementById('currentContentTitle').innerText = currentSub.name;

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
            <button onclick="deleteCurrentImage()" class="hover:text-red-400 text-slate-300 flex items-center gap-1.5" title="이미지 삭제">
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

function openZoomModal() {
    const modal = document.getElementById('imageZoomModal');
    const zoomedImg = document.getElementById('zoomedImage');
    if (!currentMain || !siteData[currentMain]) return;
    const currentSub = siteData[currentMain].subItems[currentSubIndex];
    
    if (modal && zoomedImg && currentSub && currentSub.images.length > 0) {
        zoomedImg.src = currentSub.images[0];
        modal.classList.remove('hidden');
    }
}

function closeZoomModal() {
    document.getElementById('imageZoomModal').classList.add('hidden');
}

function toggleFullScreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
}

// ----------------------------------------------------
// [로딩 화면 프로그레스 및 안전 자동 닫기]
// ----------------------------------------------------
function preloadAllImagesWithProgress() {
    const imageUrls = [];
    if (siteData) {
        Object.values(siteData).forEach(category => {
            if (category.subItems) {
                category.subItems.forEach(sub => {
                    if (sub.images && Array.isArray(sub.images)) {
                        imageUrls.push(...sub.images);
                    }
                });
            }
        });
    }

    const percentEl = document.getElementById('loadingPercent');
    const progressBar = document.getElementById('loadingProgressBar');
    const statusText = document.getElementById('loadingStatusText');
    const loadingScreen = document.getElementById('loadingScreen');

    function hideLoadingScreen() {
        if (loadingScreen) {
            loadingScreen.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    if (imageUrls.length === 0) {
        if (percentEl) percentEl.innerText = '100%';
        if (progressBar) progressBar.style.width = '100%';
        setTimeout(hideLoadingScreen, 300);
        return;
    }

    let loadedCount = 0;
    const totalCount = imageUrls.length;

    function updateProgress() {
        loadedCount++;
        const percent = Math.min(Math.round((loadedCount / totalCount) * 100), 100);
        if (percentEl) percentEl.innerText = `${percent}%`;
        if (progressBar) progressBar.style.width = `${percent}%`;

        if (loadedCount >= totalCount) {
            if (statusText) statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> 로딩 완료!`;
            setTimeout(hideLoadingScreen, 400);
        }
    }

    // 1.5초 후 자동 닫기 보장 (버퍼링 무한 멈춤 완전 방지)
    setTimeout(() => {
        if (percentEl) percentEl.innerText = '100%';
        if (progressBar) progressBar.style.width = '100%';
        hideLoadingScreen();
    }, 1500);

    imageUrls.forEach(url => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
            updateProgress();
        } else {
            const img = new Image();
            img.onload = updateProgress;
            img.onerror = updateProgress;
            img.src = url;
        }
    });
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeZoomModal(); });

document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initImageTouchEvents();
    updateLogoUI();
    preloadAllImagesWithProgress();
});