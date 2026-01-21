(function () {
    const STORAGE_KEY = "hk-split-groups";

    const $ = (id) => document.getElementById(id);
    const createEl = (tag, className, text) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    };

    const createId = () => `id_${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
    const sanitizeText = (str) => (str || "").trim();

    let groups = [];
    let currentGroupId = null;

    // DOM
    const createGroupForm = $("createGroupForm");
    const groupNameInput = $("groupName");
    const currencySelect = $("currency");
    const existingGroupsSection = $("existingGroups");
    const groupsList = $("groupsList");
    const splitInterface = $("splitInterface");
    const currentGroupName = $("currentGroupName");
    const addMemberForm = $("addMemberForm");
    const memberNameInput = $("memberName");
    const membersList = $("membersList");
    const addExpenseForm = $("addExpenseForm");
    const expenseDesc = $("expenseDesc");
    const expenseAmount = $("expenseAmount");
    const expensePayer = $("expensePayer");
    const expenseSplit = $("expenseSplit");
    const customSplitArea = $("customSplitArea");
    const customSplitFields = $("customSplitFields");
    const expensesList = $("expensesList");
    const settlementResult = $("settlementResult");
    const shareBtn = $("shareBtn");
    const shareUrl = $("shareUrl");

    function loadGroups() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            groups = raw ? JSON.parse(raw) : [];
        } catch (e) {
            groups = [];
        }
        renderGroups();
    
        // 新增下面這段：自動打開上次的群組
        const lastId = localStorage.getItem("hk-last-group-id");
        if (lastId && groups.some(g => g.id === lastId)) {
            openGroup(lastId);
        }
    }

    function saveGroups() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    }

    function renderGroups() {
        groupsList.innerHTML = "";
        if (!groups.length) {
            existingGroupsSection.style.display = "none";
            return;
        }
        existingGroupsSection.style.display = "block";
        groups.forEach((g) => {
            const card = createEl("div", "group-card");
            const info = createEl("div");
            info.innerHTML = `<strong>${escapeHtml(g.name)}</strong> <span class="badge">${g.currency}</span>`;
            const actions = createEl("div", "actions");
            const openBtn = createEl("button", "btn-secondary", "進入");
            openBtn.onclick = () => openGroup(g.id);
            const delBtn = createEl("button", "btn-secondary", "刪除");
            delBtn.onclick = () => deleteGroup(g.id);
            actions.append(openBtn, delBtn);
            card.append(info, actions);
            groupsList.appendChild(card);
        });
    }

    function deleteGroup(id) {
        if (!confirm("確定要刪除這個群組嗎？")) return;
        groups = groups.filter((g) => g.id !== id);
        if (currentGroupId === id) {
            currentGroupId = null;
            splitInterface.style.display = "none";
        }
        saveGroups();
        renderGroups();
    }

    function openGroup(id) {
        currentGroupId = id;
        localStorage.setItem("hk-last-group-id", id); // 新增這行：記住最後點開的 ID
        const group = getCurrentGroup();
        if (!group) return;
        currentGroupName.textContent = `${group.name}（${group.currency}）`;
        splitInterface.style.display = "block";
        renderMembers();
        renderExpenses();
        renderCustomSplitFields();
        renderSettlement();
    }

    function getCurrentGroup() {
        return groups.find((g) => g.id === currentGroupId);
    }

    // Event: create group
    createGroupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = sanitizeText(groupNameInput.value);
        const currency = currencySelect.value;
        if (!name) {
            alert("請輸入群組名稱");
            return;
        }
        const newGroup = {
            id: createId(),
            name,
            currency,
            members: [],
            expenses: [],
        };
        groups.push(newGroup);
        saveGroups();
        renderGroups();
        openGroup(newGroup.id);
        createGroupForm.reset();
        existingGroupsSection.style.display = "block";
    });

    // Members
    addMemberForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = sanitizeText(memberNameInput.value);
        const group = getCurrentGroup();
        if (!group) return;
        if (!name) {
            alert("請輸入成員姓名");
            return;
        }
        const duplicate = group.members.find((m) => m.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            alert("已有相同姓名的成員，請使用暱稱區分");
            return;
        }
        group.members.push({ id: createId(), name });
        saveGroups();
        renderMembers();
        renderCustomSplitFields();
        memberNameInput.value = "";
    });

    function renderMembers() {
        membersList.innerHTML = "";
        const group = getCurrentGroup();
        if (!group) return;
        group.members.forEach((m) => {
            const card = createEl("div", "member-card");
            card.appendChild(createEl("div", "", escapeHtml(m.name)));
            const actions = createEl("div", "actions");
            const delBtn = createEl("button", "btn-secondary", "刪除");
            delBtn.onclick = () => removeMember(m.id);
            actions.append(delBtn);
            card.appendChild(actions);
            membersList.appendChild(card);
        });
        // payer select
        expensePayer.innerHTML = "";
        group.members.forEach((m) => {
            const opt = createEl("option");
            opt.value = m.id;
            opt.textContent = m.name;
            expensePayer.appendChild(opt);
        });
        if (!group.members.length) {
            expensePayer.innerHTML = `<option value="">請先新增成員</option>`;
        }
    }

    function removeMember(memberId) {
        const group = getCurrentGroup();
        if (!group) return;
        if (!confirm("刪除成員後，相關費用將一併移除，確定嗎？")) return;
        group.members = group.members.filter((m) => m.id !== memberId);
        group.expenses = group.expenses.filter((ex) => ex.payerId !== memberId);
        saveGroups();
        renderMembers();
        renderExpenses();
        renderCustomSplitFields();
        renderSettlement();
    }

    // Expenses
    expenseSplit.addEventListener("change", () => {
        if (expenseSplit.value === "custom") {
            customSplitArea.style.display = "block";
            renderCustomSplitFields();
        } else {
            customSplitArea.style.display = "none";
        }
    });

    function renderCustomSplitFields() {
        const group = getCurrentGroup();
        if (!group || expenseSplit.value !== "custom") return;
        customSplitFields.innerHTML = "";
        group.members.forEach((m) => {
            const field = createEl("div", "split-field");
            const label = createEl("label", "", m.name);
            label.setAttribute("for", `weight_${m.id}`);
            const input = createEl("input");
            input.type = "number";
            input.min = "0";
            input.step = "0.01";
            input.id = `weight_${m.id}`;
            input.dataset.memberId = m.id;
            input.placeholder = "權重 (可留空)";
            field.append(label, input);
            customSplitFields.appendChild(field);
        });
    }

    addExpenseForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const group = getCurrentGroup();
        if (!group) return;
        if (!group.members.length) {
            alert("請先新增至少一位成員");
            return;
        }
        const desc = sanitizeText(expenseDesc.value);
        const amount = Number(expenseAmount.value);
        const payerId = expensePayer.value;
        const splitType = expenseSplit.value;
        if (!desc || !amount || amount <= 0 || !payerId) {
            alert("請填寫完整費用資訊且金額需大於 0");
            return;
        }
        let weights = [];
        if (splitType === "custom") {
            const inputs = customSplitFields.querySelectorAll("input[data-member-id]");
            weights = Array.from(inputs)
                .map((el) => ({ memberId: el.dataset.memberId, weight: Number(el.value) || 0 }))
                .filter((w) => w.weight > 0);
            if (!weights.length) {
                alert("自訂分攤至少需要一位有權重的成員");
                return;
            }
        }
        const expense = {
            id: createId(),
            desc,
            amount,
            payerId,
            splitType,
            weights,
        };
        group.expenses.push(expense);
        saveGroups();
        renderExpenses();
        renderSettlement();
        addExpenseForm.reset();
        customSplitArea.style.display = "none";
    });

    function renderExpenses() {
        expensesList.innerHTML = "";
        const group = getCurrentGroup();
        if (!group) return;
        group.expenses.forEach((ex) => {
            const card = createEl("div", "expense-card");
            const info = createEl("div");
            const payer = group.members.find((m) => m.id === ex.payerId);
            const splitLabel = ex.splitType === "equal" ? "平均" : "自訂";
            info.innerHTML = `<strong>${escapeHtml(ex.desc)}</strong><br>${group.currency} ${ex.amount.toFixed(2)} ・ 付款人：${escapeHtml(payer ? payer.name : "已移除")} ・ ${splitLabel}`;
            const actions = createEl("div", "actions");
            const delBtn = createEl("button", "btn-secondary", "刪除");
            delBtn.onclick = () => removeExpense(ex.id);
            actions.append(delBtn);
            card.append(info, actions);
            expensesList.appendChild(card);
        });
    }

    function removeExpense(id) {
        const group = getCurrentGroup();
        if (!group) return;
        group.expenses = group.expenses.filter((e) => e.id !== id);
        saveGroups();
        renderExpenses();
        renderSettlement();
    }

    // Settlement
    function renderSettlement() {
        settlementResult.innerHTML = "";
        const group = getCurrentGroup();
        if (!group) return;
        if (!group.expenses.length || !group.members.length) {
            settlementResult.textContent = "請新增成員與費用後再計算。";
            return;
        }
        const membersMap = new Map(group.members.map((m) => [m.id, { ...m, balance: 0 }]));
        group.expenses.forEach((ex) => {
            const participants =
                ex.splitType === "equal"
                    ? group.members.map((m) => ({ memberId: m.id, weight: 1 }))
                    : ex.weights;
            const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);
            if (!totalWeight) return;
            const payer = membersMap.get(ex.payerId);
            if (payer) payer.balance += ex.amount;
            participants.forEach((p) => {
                const member = membersMap.get(p.memberId);
                if (!member) return;
                const share = (ex.amount * p.weight) / totalWeight;
                member.balance -= share;
            });
        });

        const { transfers, debtors, creditors } = settleBalances([...membersMap.values()]);
        if (!transfers.length) {
            settlementResult.textContent = "大家都清帳囉！";
            return;
        }
        transfers.forEach((t) => {
            const row = createEl("div", "settlement-item");
            row.textContent = `${t.from} 支付給 ${t.to}：${group.currency} ${t.amount.toFixed(2)}`;
            settlementResult.appendChild(row);
        });

        // For transparency
        const detail = createEl("div", "hint");
        detail.textContent = `淨額狀態：債務 ${debtors.length} 人，債權 ${creditors.length} 人。`;
        settlementResult.appendChild(detail);
    }

    function settleBalances(members) {
        const debtors = [];
        const creditors = [];
        members.forEach((m) => {
            if (m.balance < -0.005) debtors.push({ name: m.name, balance: -m.balance });
            else if (m.balance > 0.005) creditors.push({ name: m.name, balance: m.balance });
        });
        debtors.sort((a, b) => b.balance - a.balance);
        creditors.sort((a, b) => b.balance - a.balance);
        const transfers = [];
        let i = 0,
            j = 0;
        while (i < debtors.length && j < creditors.length) {
            const pay = Math.min(debtors[i].balance, creditors[j].balance);
            transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
            debtors[i].balance -= pay;
            creditors[j].balance -= pay;
            if (debtors[i].balance < 0.005) i++;
            if (creditors[j].balance < 0.005) j++;
        }
        return { transfers, debtors, creditors };
    }

    // Share link
    shareBtn.addEventListener("click", () => {
        const group = getCurrentGroup();
        if (!group) return;
        if (!group.members.length) {
            alert("請先新增成員");
            return;
        }
        const key = CryptoJS.lib.WordArray.random(16).toString();
        const payload = {
            name: group.name,
            currency: group.currency,
            members: group.members,
            expenses: group.expenses,
            ts: Date.now(),
        };
        const cipher = CryptoJS.AES.encrypt(JSON.stringify(payload), key).toString();
        const sig = CryptoJS.HmacSHA256(cipher, key).toString();
        const baseUrl = `${location.origin}${location.pathname}`;
        const url = `${baseUrl}?g=${encodeURIComponent(cipher)}&s=${sig}#k=${key}`;
        shareUrl.style.display = "block";
        shareUrl.textContent = url;
        copyToClipboard(url);
    });

    function copyToClipboard(text) {
        navigator.clipboard?.writeText(text).catch(() => {});
    }

    function tryLoadFromUrl() {
        const params = new URLSearchParams(location.search);
        const cipher = params.get("g");
        const sig = params.get("s");
        const key = location.hash.startsWith("#k=") ? location.hash.slice(3) : null;
        if (!cipher || !sig || !key) return;
        const expected = CryptoJS.HmacSHA256(cipher, key).toString();
        if (expected !== sig) {
            alert("分享連結驗證失敗，資料可能已被竄改。");
            return;
        }
        try {
            const bytes = CryptoJS.AES.decrypt(cipher, key);
            const json = bytes.toString(CryptoJS.enc.Utf8);
            const data = JSON.parse(json);
            if (!data || !data.name || !Array.isArray(data.members) || !Array.isArray(data.expenses)) {
                throw new Error("invalid payload");
            }
            const imported = {
                id: createId(),
                name: data.name + "（匯入）",
                currency: data.currency || "HKD",
                members: data.members,
                expenses: data.expenses,
            };
            groups.push(imported);
            saveGroups();
            renderGroups();
            openGroup(imported.id);
        } catch (err) {
            console.error(err);
            alert("無法解析分享連結資料");
        }
    }

    function escapeHtml(str) {
        const safe = String(str || "");
        return safe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // init
    loadGroups();
    tryLoadFromUrl();
})();
