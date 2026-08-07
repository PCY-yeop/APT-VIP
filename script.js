// ----------------------------------------------------
// [전역 상태 변수]
// ----------------------------------------------------
let currentUser = null;
let currentSiteId = null;
let userSites = [];

let siteData = {}; 
let isEditMode = false;
let currentMain = null;
let currentSubIndex = 0;
let currentLogoUrl = 'images/rogo.png';

let sortablePrimaryDesktop = null;
let sortablePrimaryMobile = null;
let sortableSecondaryDesktop = null;
let sortableSecondaryMobile = null;

let touchState = { scale: 1, startDist: 0, posX: 0, posY: 0, startX: 0, startY: 0, isDragging: false, lastTapTime: 0 };
let editingSiteId = null;

// ----------------------------------------------------
// [1. 초기 실행 및 Supabase 인증 세션 검사]
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    initAuthEvents();
    initImageTouchEvents();
    preloadAllImagesWithProgress();

    if (window.supabaseClient) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            currentUser = session.user;
            showLobbyModal();
        } else {
            showAuthModal();
        }
    } else {
        showAuthModal();
    }
});

function showAuthModal() {
    document.getElementById('authModal')?.classList.remove('hidden');
    document.getElementById('siteLobbyModal')?.classList.add('hidden');
}

function showLobbyModal() {
    // 로비 진입 시 이전 작업 현장의 상태값 완벽 초기화
    currentSiteId = null;
    siteData = {};
    isEditMode = false;
    currentMain = null;
    currentSubIndex = 0;
    resetEditUI();

    document.getElementById('authModal')?.classList.add('hidden');
    document.getElementById('siteLobbyModal')?.classList.remove('hidden');
    loadUserSites();
}

// 편집 상태 UI 강제 리셋 함수
function resetEditUI() {
    const btnDesktop = document.getElementById('editToggleBtnDesktop');
    const textDesktop = document.getElementById('editToggleTextDesktop');
    const btnMobile = document.getElementById('editToggleBtnMobile');
    const textMobile = document.getElementById('editToggleTextMobile');
    const statusBadge = document.getElementById('modeStatusBadge');

    if (btnDesktop) {
        btnDesktop.className = "bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95";
        if (textDesktop) textDesktop.innerText = "편집하기";
    }
    if (btnMobile) {
        btnMobile.className = "bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow";
        if (textMobile) textMobile.innerText = "편집하기";
    }
    if (statusBadge) {
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>상담 전용 모드</span>`;
    }
}

async function logout() {
    if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
    }
    currentUser = null;
    showAuthModal();
}

// ----------------------------------------------------
// [2. Supabase 회원가입 및 로그인 처리]
// ----------------------------------------------------
function initAuthEvents() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('authUserId').value.trim();
            const password = document.getElementById('authPassword').value;
            const email = `${userId}@vip.com`;

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            
            if (error) {
                alert("로그인 실패: 아이디 또는 비밀번호를 확인해 주세요.");
            } else {
                currentUser = data.user;
                showLobbyModal();
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('signupUserId').value.trim();
            const password = document.getElementById('signupPassword').value;
            const email = `${userId}@vip.com`;

            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });

            if (error) {
                alert("회원가입 실패: " + error.message);
            } else {
                alert(`'${userId}' 계정이 생성되었습니다! 로그인해 주세요.`);
                toggleAuthMode('login');
                document.getElementById('authUserId').value = userId;
            }
        });
    }
}

// ----------------------------------------------------
// [3. Supabase 서버에서 현장 목록 읽기 / 추가 / 수정 / 삭제]
// ----------------------------------------------------
async function loadUserSites() {
    const container = document.getElementById('siteListContainer');
    if (!container) return;

    container.innerHTML = `<div class="col-span-full text-center text-slate-400 py-16"><i class="fa-solid fa-spinner fa-spin mr-2"></i>클라우드 데이터를 불러오는 중...</div>`;

    const { data, error } = await window.supabaseClient
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("데이터 로드 오류:", error);
        container.innerHTML = `<div class="col-span-full text-center text-red-400 py-16">데이터를 불러오지 못했습니다. DB 설정을 확인해 주세요.</div>`;
        return;
    }

    userSites = data || [];
    renderSiteList();
}

function renderSiteList() {
    const container = document.getElementById('siteListContainer');
    if (!container) return;

    if (userSites.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-slate-400 py-16 bg-slate-900/60 rounded-3xl border border-slate-800/80">
                <i class="fa-solid fa-folder-open text-4xl text-slate-600 mb-3"></i>
                <p class="text-sm font-semibold text-slate-300">등록된 분양 현장이 없습니다.</p>
                <p class="text-xs text-slate-500 mt-1">상단 [+ 새 현장 등록] 버튼을 눌러 첫 현장을 만드세요.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = userSites.map(site => {
        const isEditing = editingSiteId === site.id;

        const nameTitleHtml = isEditing ? `
            <div class="flex items-center gap-2 mb-2" onclick="event.stopPropagation()">
                <input type="text" id="editInput_${site.id}" value="${site.name}" 
                    class="bg-slate-800 border border-emerald-500 rounded-lg px-2.5 py-1 text-sm font-bold text-white w-full focus:outline-none"
                    onkeydown="if(event.key==='Enter') saveSiteName('${site.id}', event)">
                <button onclick="saveSiteName('${site.id}', event)" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1 rounded-lg font-bold flex-shrink-0">
                    저장
                </button>
                <button onclick="cancelEditSiteName(event)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2 py-1 rounded-lg flex-shrink-0">
                    취소
                </button>
            </div>
        ` : `
            <h3 class="font-bold text-base text-white group-hover:text-emerald-400 transition-colors line-clamp-1 mb-1">${site.name}</h3>
        `;

        return `
            <div onclick="${isEditing ? '' : `selectSite('${site.id}')`}" class="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between group shadow-xl hover:shadow-2xl ${isEditing ? 'ring-2 ring-emerald-500/50' : 'hover:-translate-y-1'} duration-200">
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 px-2.5 py-1 rounded-md">분양 현장</span>
                        <div class="flex items-center gap-1">
                            <button onclick="startEditSiteName('${site.id}', event)" class="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="이름 수정">
                                <i class="fa-solid fa-pen-to-square text-xs"></i>
                            </button>
                            <button onclick="deleteSite('${site.id}', event)" class="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="현장 삭제">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                    ${nameTitleHtml}
                    <p class="text-xs text-slate-400">브리핑북 목차 및 이미지 관리</p>
                </div>
                
                <div class="flex items-center justify-between text-xs font-semibold text-slate-300 pt-4 mt-6 border-t border-slate-800/80 group-hover:text-white">
                    <span>브리핑북 열기</span>
                    <div class="w-7 h-7 rounded-full bg-slate-800 group-hover:bg-emerald-600 flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-arrow-right text-xs text-slate-300 group-hover:text-white"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function startEditSiteName(siteId, event) {
    if (event) event.stopPropagation();
    editingSiteId = siteId;
    renderSiteList();
    
    setTimeout(() => {
        const input = document.getElementById(`editInput_${siteId}`);
        if (input) {
            input.focus();
            input.select();
        }
    }, 50);
}

async function saveSiteName(siteId, event) {
    if (event) event.stopPropagation();
    const input = document.getElementById(`editInput_${siteId}`);
    if (!input) return;

    const newName = input.value.trim();
    if (!newName) {
        alert("현장 이름을 입력해 주세요.");
        return;
    }

    const { error } = await window.supabaseClient
        .from('sites')
        .update({ name: newName })
        .eq('id', siteId);

    if (error) {
        alert("이름 수정 실패: " + error.message);
    } else {
        editingSiteId = null;
        loadUserSites();
    }
}

function cancelEditSiteName(event) {
    if (event) event.stopPropagation();
    editingSiteId = null;
    renderSiteList();
}

// [개선 1] 타임스탬프 기반 고유 키를 가진 100% 독립된 깨끗한 기본 틀로 생성
async function createNewSite() {
    const siteName = prompt("새 분양 현장 이름을 입력하세요:");
    if (!siteName || !siteName.trim()) return;

    const now = Date.now();
    const freshData = {
        [`cat_${now}_1`]: {
            title: "사업안내",
            subItems: [
                { name: "사업개요", images: [] }
            ]
        },
        [`cat_${now}_2`]: {
            title: "단지안내",
            subItems: [
                { name: "단지 배치도", images: [] }
            ]
        }
    };

    const { error } = await window.supabaseClient
        .from('sites')
        .insert([{ user_id: currentUser.id, name: siteName.trim(), data: freshData }]);

    if (error) {
        alert("현장 추가 실패: " + error.message);
    } else {
        loadUserSites();
    }
}

async function deleteSite(siteId, event) {
    if (event) event.stopPropagation();
    if (!confirm("해당 현장과 모든 브리핑북 자료가 서버에서 완전히 삭제됩니다. 진행하시겠습니까?")) return;

    const { error } = await window.supabaseClient.from('sites').delete().eq('id', siteId);

    if (error) {
        alert("삭제 실패: " + error.message);
    } else {
        loadUserSites();
    }
}

// [개선 2] 현장 선택 시 깊은 복사(Deep Clone) 및 상태값 완전 초기화
function selectSite(siteId) {
    currentSiteId = siteId;
    const site = userSites.find(s => s.id === siteId);
    if (!site) return;

    // 데이터 복제를 통한 참조 혼선 차단
    siteData = JSON.parse(JSON.stringify(site.data || {}));
    isEditMode = false;
    resetEditUI();

    const keys = Object.keys(siteData);
    currentMain = keys.length > 0 ? keys[0] : null;
    currentSubIndex = 0;

    const splashTitle = document.getElementById('splashSiteTitle');
    if (splashTitle) splashTitle.innerText = site.name;

    document.getElementById('siteLobbyModal')?.classList.add('hidden');
    initNav();
}

async function saveCurrentSiteData() {
    if (!currentSiteId || !currentUser) return;
    await window.supabaseClient
        .from('sites')
        .update({ data: siteData })
        .eq('id', currentSiteId);
}

// ----------------------------------------------------
// [4. 편집 모드 및 드래그 앤 드롭 순서 변경]
// ----------------------------------------------------
function toggleEditMode() {
    isEditMode = !isEditMode;

    const btnDesktop = document.getElementById('editToggleBtnDesktop');
    const textDesktop = document.getElementById('editToggleTextDesktop');
    const btnMobile = document.getElementById('editToggleBtnMobile');
    const textMobile = document.getElementById('editToggleTextMobile');
    const statusBadge = document.getElementById('modeStatusBadge');

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
    } else {
        resetEditUI();
        saveCurrentSiteData();
    }
    initNav();
}

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
    saveCurrentSiteData();
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

    saveCurrentSiteData();
    renderSecondaryNav();
}

function initSortableEvents() {
    if (sortablePrimaryDesktop) sortablePrimaryDesktop.destroy();
    if (sortablePrimaryMobile) sortablePrimaryMobile.destroy();

    const options = {
        handle: '.drag-handle',
        animation: 150,
        forceFallback: true,
        fallbackTolerance: 2,
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
// [5. 목차 관리 및 이미지 업로드]
// ----------------------------------------------------
function addMainCategory() {
    const title = prompt("새 메인 목차 이름을 입력하세요:");
    if (!title || !title.trim()) return;
    const newKey = 'cat_' + Date.now();
    siteData[newKey] = { title: title.trim(), subItems: [] };
    currentMain = newKey;
    currentSubIndex = 0;
    saveCurrentSiteData();
    initNav();
}

function deleteMainCategory(key, event) {
    if (event) event.stopPropagation();
    if (!confirm(`'${siteData[key].title}' 삭제하시겠습니까?`)) return;
    delete siteData[key];
    const keys = Object.keys(siteData);
    currentMain = keys.length > 0 ? keys[0] : null;
    currentSubIndex = 0;
    saveCurrentSiteData();
    initNav();
}

function addSubCategory() {
    if (!currentMain || !siteData[currentMain]) return;
    const subName = prompt("새 서브 목차 이름을 입력하세요:");
    if (!subName || !subName.trim()) return;
    
    if (!siteData[currentMain].subItems) {
        siteData[currentMain].subItems = [];
    }

    siteData[currentMain].subItems.push({ name: subName.trim(), images: [] });
    currentSubIndex = siteData[currentMain].subItems.length - 1;
    saveCurrentSiteData();
    renderSecondaryNav();
}

function deleteSubCategory(index, event) {
    if (event) event.stopPropagation();
    if (!confirm("서브 목차를 삭제하시겠습니까?")) return;
    siteData[currentMain].subItems.splice(index, 1);
    currentSubIndex = Math.max(0, siteData[currentMain].subItems.length - 1);
    saveCurrentSiteData();
    renderSecondaryNav();
}

function addImageToCurrentSub(event) {
    const file = event.target.files[0];
    if (!file || !currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[currentSubIndex]) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Image = e.target.result;
        siteData[currentMain].subItems[currentSubIndex].images = [base64Image];
        saveCurrentSiteData();
        renderContent();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function deleteCurrentImage() {
    if (!currentMain || !siteData[currentMain] || !siteData[currentMain].subItems[currentSubIndex]) return;
    if (!confirm("현재 이미지를 삭제하시겠습니까?")) return;

    siteData[currentMain].subItems[currentSubIndex].images = [];
    saveCurrentSiteData();
    renderContent();
}

// ----------------------------------------------------
// [6. UI 및 이미지 터치/줌]
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

function initNav() {
    const primaryNavDesktop = document.getElementById('primaryNavDesktop');
    const primaryNavMobile = document.getElementById('primaryNavMobile');
    if (primaryNavDesktop) primaryNavDesktop.innerHTML = '';
    if (primaryNavMobile) primaryNavMobile.innerHTML = '';

    const keys = Object.keys(siteData);

    // 목차가 비어있는 경우에도 편집 모드 시 추가 버튼이 사라지지 않도록 보장
    if (keys.length === 0) {
        currentMain = null;
        if (primaryNavDesktop && isEditMode) {
            const addBtn = document.createElement('button');
            addBtn.className = "no-drag w-full py-2 px-3 rounded-xl text-xs font-bold border-2 border-dashed border-emerald-400/50 hover:border-emerald-400 text-emerald-300 flex items-center justify-center gap-1 mt-2";
            addBtn.onclick = addMainCategory;
            addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> 메인목차 추가`;
            primaryNavDesktop.appendChild(addBtn);
        }
        renderSecondaryNav();
        return;
    }

    if (!currentMain || !siteData[currentMain]) {
        currentMain = keys[0];
    }

    keys.forEach(key => {
        const item = siteData[key];
        const isActive = key === currentMain;

        if (primaryNavDesktop) {
            const btn = document.createElement('div');
            btn.className = `main-nav-item w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-sm flex-shrink-0 border cursor-pointer ${isActive ? 'bg-[#1b4d24] text-white border-emerald-600' : 'bg-white text-slate-800 hover:bg-slate-100 border-transparent'}`;
            btn.setAttribute('data-key', key);

            // 전체 탭 클릭 바인딩 (이벤트 누락 방지)
            btn.onclick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                currentMain = key;
                currentSubIndex = 0;
                initNav();
            };

            const dragHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 hover:text-emerald-300 mr-2.5 py-1 px-1 text-sm cursor-grab active:cursor-grabbing" onclick="event.stopPropagation()"></i>` : '';
            const delHtml = isEditMode ? `<button onclick="deleteMainCategory('${key}', event)" class="text-red-400 hover:text-red-200 p-1 rounded hover:bg-red-900/30"><i class="fa-solid fa-xmark"></i></button>` : '';

            btn.innerHTML = `
                ${dragHtml}
                <div class="flex-1 truncate py-0.5">
                    <span class="truncate">${item.title}</span>
                </div>
                ${delHtml}
            `;
            primaryNavDesktop.appendChild(btn);
        }

        if (primaryNavMobile) {
            const btnM = document.createElement('div');
            btnM.className = `main-nav-item py-1.5 px-3 rounded-lg text-[14px] font-bold whitespace-nowrap flex-shrink-0 touch-manipulation flex items-center gap-2 shadow cursor-pointer ${isActive ? 'bg-[#1b4d24] text-white' : 'bg-white/10 text-slate-200'}`;
            btnM.setAttribute('data-key', key);

            btnM.onclick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                currentMain = key;
                currentSubIndex = 0;
                initNav();
            };

            const dragMobileHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-300 text-xs py-1 px-1" onclick="event.stopPropagation()"></i>` : '';
            btnM.innerHTML = `
                ${dragMobileHtml}
                <span>${item.title}</span>
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

    if (!currentObj.subItems) {
        currentObj.subItems = [];
    }

    currentObj.subItems.forEach((sub, index) => {
        const isActive = index === currentSubIndex;

        if (secondaryNavDesktop) {
            const btn = document.createElement('div');
            btn.className = `sub-nav-item w-full py-2 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between flex-shrink-0 border cursor-pointer ${isActive ? 'bg-[#0d1b3e] text-white font-bold border-slate-600 shadow-md' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`;
            btn.setAttribute('data-index', index);

            btn.onclick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                currentSubIndex = index;
                renderSecondaryNav();
            };

            const dragSubHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 hover:text-slate-600 mr-2 py-1 px-1 cursor-grab active:cursor-grabbing text-xs" onclick="event.stopPropagation()"></i>` : '';
            const delSubHtml = isEditMode ? `<button onclick="deleteSubCategory(${index}, event)" class="text-slate-400 hover:text-red-500 p-1"><i class="fa-solid fa-trash-can"></i></button>` : '';

            btn.innerHTML = `
                ${dragSubHtml}
                <div class="flex-1 truncate py-0.5">
                    <span class="truncate">${sub.name}</span>
                </div>
                ${delSubHtml}
            `;
            secondaryNavDesktop.appendChild(btn);
        }

        if (secondaryNavMobile) {
            const btnM = document.createElement('div');
            btnM.className = `sub-nav-item py-1 px-2.5 rounded-md text-[12px] font-semibold whitespace-nowrap flex-shrink-0 touch-manipulation flex items-center gap-1.5 cursor-pointer ${isActive ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 border border-slate-300'}`;
            btnM.setAttribute('data-index', index);

            btnM.onclick = (e) => {
                if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
                currentSubIndex = index;
                renderSecondaryNav();
            };

            const dragSubMobileHtml = isEditMode ? `<i class="fa-solid fa-bars drag-handle text-slate-400 text-[10px] py-1 px-0.5" onclick="event.stopPropagation()"></i>` : '';
            const delSubMobileHtml = isEditMode ? `<button onclick="deleteSubCategory(${index}, event)" class="text-slate-400 hover:text-red-500 ml-1 p-0.5"><i class="fa-solid fa-xmark text-[11px]"></i></button>` : '';

            btnM.innerHTML = `
                ${dragSubMobileHtml}
                <span>${sub.name}</span>
                ${delSubMobileHtml}
            `;
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
        addSubBtnMobile.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i> 추가`;
        secondaryNavMobile.appendChild(addSubBtnMobile);
    }

    initSubSortableEvents();
    renderContent();
}

function renderContent() {
    resetImgTransform();
    const display = document.getElementById('contentDisplayArea');
    if (!display) return;

    if (!currentMain || !siteData[currentMain] || !siteData[currentMain].subItems || siteData[currentMain].subItems.length === 0) {
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
    document.getElementById('imageZoomModal')?.classList.add('hidden');
}

function toggleFullScreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
}

function preloadAllImagesWithProgress() {
    const percentEl = document.getElementById('loadingPercent');
    const progressBar = document.getElementById('loadingProgressBar');
    const loadingScreen = document.getElementById('loadingScreen');

    setTimeout(() => {
        if (percentEl) percentEl.innerText = '100%';
        if (progressBar) progressBar.style.width = '100%';
        if (loadingScreen) {
            loadingScreen.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
        }
    }, 1200);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeZoomModal(); });