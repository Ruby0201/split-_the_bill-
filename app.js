(function () {
    const STORAGE_KEY = "hk-split-groups";
    const LAST_ID_KEY = "hk-last-group-id"; // 專門記住最後開啟的群組 ID

    const $ = (id) => document.getElementById(id);
    const createEl = (tag, className, text) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    };

    const createId = () => `id_${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
    const escapeHtml = (str) => String(str || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

    let groups = [];
    let currentGroupId = null;

    // DOM 元素
    const createGroupForm = $("createGroupForm");
    const existingGroupsSection = $("existingGroups");
    const groupsList = $("groupsList");
    const splitInterface = $("splitInterface");
    const currentGroupName = $("currentGroupName");
    const membersList = $("membersList");
    const expensesList = $("expensesList");
    const settlementResult = $("settlementResult");

    // 1. 載入資料
    function loadGroups() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            groups = raw ? JSON.parse(raw) : [];
        } catch (e) {
            groups = [];
        }
        renderGroups();

        // 【自動記住】檢查上次是不是有打開過的群組
        const lastId = localStorage.getItem(LAST_ID_KEY);
        if (lastId && groups.some(g => g.id === lastId)) {
            openGroup(lastId);
        }
    }

    function saveGroups() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    }

    // 2. 顯示群組選單
    function renderGroups() {
        groupsList.innerHTML = "";
        if (groups.length === 0) {
            existingGroupsSection.style.display = "none";
            return;
        }
        existingGroupsSection.style.display = "block";
        
        groups.forEach((g) => {
            const card = createEl("div", "group-card");
            card.innerHTML = `<div><strong>${escapeHtml(g.name)}</strong> <small>(${g.currency})</small></div>`;
            
            const btnGroup = createEl("div", "actions");
            const openBtn = createEl("button", "btn-secondary", "進入");
            openBtn.onclick = () => openGroup(g.id);
            
            const delBtn = createEl("button", "btn-secondary", "刪除");
            delBtn.style.backgroundColor = "#ffccd5"; // 淡淡的刪除色
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("確定要刪除整個群組嗎？資料不能復原喔！")) deleteGroup(g.id);
            };

            btnGroup.append(openBtn, delBtn);
            card.appendChild(btnGroup);
            groupsList.appendChild(card);
        });
    }

    // 3. 開啟群組 (關鍵：記住當前 ID)
    function openGroup(id) {
        currentGroupId = id;
        localStorage.setItem(LAST_ID_KEY, id); // 存入 LocalStorage
        
        const group = groups.find(g => g.id === id);
        if (!group) return;

        currentGroupName.textContent = `${group.name} (${group.currency})`;
        splitInterface.style.display = "block";
        
        // 捲動到內容區，讓手機使用者知道已經開啟了
        splitInterface.scrollIntoView({ behavior: 'smooth' });

        renderMembers();
        renderExpenses();
        renderSettlement();
    }

    function deleteGroup(id) {
        groups = groups.filter(g => g.id !== id);
        if (currentGroupId === id) {
            currentGroupId = null;
            localStorage.removeItem(LAST_ID_KEY);
            splitInterface.style.display = "none";
        }
        saveGroups();
        renderGroups();
    }

    // 4. 新增群組
    createGroupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("groupName").value.trim();
        if (!name) return;

        const newGroup = {
            id: createId(),
            name: name,
            currency: $("currency").value,
            members: [],
            expenses: []
        };

        groups.push(newGroup);
        saveGroups();
        renderGroups();
        openGroup(newGroup.id); // 新增完直接進入
        createGroupForm.reset();
    });

    // --- 成員與費用邏輯 (保持原本的) ---

    $("addMemberForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("memberName").value.trim();
        const group = groups.find(g => g.id === currentGroupId);
        if (!group || !name) return;

        group.members.push({ id: createId(), name });
        saveGroups();
        renderMembers();
        $("memberName").value = "";
    });

    function renderMembers() {
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) return;
        membersList.innerHTML = group.members.map(m => `
            <div class="member-card">
                ${escapeHtml(m.name)}
                <button class="btn-secondary" onclick="window.removeMember('${m.id}')">刪除</button>
            </div>
        `).join('');
        
        const payerSelect = $("expensePayer");
        payerSelect.innerHTML = group.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('') || '<option value="">請先新增成員</option>';
    }

    window.removeMember = (memberId) => {
        const group = groups.find(g => g.id === currentGroupId);
        if (!group || !confirm("刪除成員會連同相關費用一起刪除喔！")) return;
        group.members = group.members.filter(m => m.id !== memberId);
        group.expenses = group.expenses.filter(ex => ex.payerId !== memberId);
        saveGroups();
        renderMembers();
        renderExpenses();
        renderSettlement();
    };

    $("addExpenseForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const group = groups.find(g => g.id === currentGroupId);
        const amount = Number($("expenseAmount").value);
        if (!group || amount <= 0) return;

        group.expenses.push({
            id: createId(),
            desc: $("expenseDesc").value,
            amount,
            payerId: $("expensePayer").value,
            splitType: "equal" // 簡化版預設平均分攤
        });

        saveGroups();
        renderExpenses();
        renderSettlement();
        $("addExpenseForm").reset();
    });

    function renderExpenses() {
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) return;
        expensesList.innerHTML = group.expenses.map(ex => {
            const payer = group.members.find(m => m.id === ex.payerId);
            return `
                <div class="expense-card">
                    <div><strong>${escapeHtml(ex.desc)}</strong><br>${group.currency} ${ex.amount.toFixed(2)} (${payer ? payer.name : '?'})</div>
                    <button class="btn-secondary" onclick="window.removeExpense('${ex.id}')">刪除</button>
                </div>
            `;
        }).join('');
    }

    window.removeExpense = (id) => {
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) return;
        group.expenses = group.expenses.filter(e => e.id !== id);
        saveGroups();
        renderExpenses();
        renderSettlement();
    };

    function renderSettlement() {
        settlementResult.innerHTML = "";
        const group = groups.find(g => g.id === currentGroupId);
        if (!group || !group.expenses.length || !group.members.length) {
            settlementResult.textContent = "尚無結算資料 ✨";
            return;
        }

        const balances = {};
        group.members.forEach(m => balances[m.id] = 0);

        group.expenses.forEach(ex => {
            const share = ex.amount / group.members.length;
            if (balances[ex.payerId] !== undefined) balances[ex.payerId] += ex.amount;
            group.members.forEach(m => {
                balances[m.id] -= share;
            });
        });

        const debtors = [], creditors = [];
        for (let id in balances) {
            const name = group.members.find(m => m.id === id)?.name;
            if (balances[id] < -0.01) debtors.push({ name, amt: -balances[id] });
            else if (balances[id] > 0.01) creditors.push({ name, amt: balances[id] });
        }

        while (debtors.length && creditors.length) {
            const d = debtors[0], c = creditors[0];
            const pay = Math.min(d.amt, c.amt);
            const item = createEl("div", "settlement-item", `${d.name} 支付給 ${c.name}：${group.currency} ${pay.toFixed(2)}`);
            settlementResult.appendChild(item);
            d.amt -= pay; c.amt -= pay;
            if (d.amt <= 0.01) debtors.shift();
            if (c.amt <= 0.01) creditors.shift();
        }
        if (!settlementResult.innerHTML) settlementResult.textContent = "大家帳目都清囉！💕";
    }

    // 初始化
    loadGroups();
})();
