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
    const shareUrl = $("shareUrl");

    function loadGroups() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            groups = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("load groups failed", e);
            groups = [];
        }
        renderGroups();
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
        const group = getCurrentGroup();
        if (!group) return;
        currentGroupName.textContent = `${group.name}（${group.currency}）`;
        splitInterface.style.display = "block";
        renderMembers();
        renderExpenses();
        renderCustomSplitFields();
        renderSettlement();
        loadShareUrl();
    }

    function getCurrentGroup() {
        return groups.find((g) => g.id === currentGroupId);
    }

    // Event: create group
    createGroupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = sanitizeText(groupNameInput.value);
        const currency = currencySelect.value;
        if (!name) {
            alert("請輸入群組名稱");
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/group`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, currency }),
            });
            
            // 檢查回應是否為有效的 JSON
            const contentType = response.headers.get("content-type");
            let responseData;
            if (contentType && contentType.includes("application/json")) {
                responseData = await response.json();
            } else {
                const text = await response.text();
                console.error("Non-JSON response:", text);
                throw new Error(`伺服器回應格式錯誤: ${text.substring(0, 100)}`);
            }
            
            if (!response.ok) {
                throw new Error(responseData.error || `建立失敗 (狀態碼: ${response.status})`);
            }
            const newGroup = {
                id: createId(),
                serverId: responseData.id,
                name: responseData.name,
                currency: responseData.currency,
                members: [],
                expenses: [],
            };
            groups.push(newGroup);
            saveGroups();
            renderGroups();
            openGroup(newGroup.id);
            createGroupForm.reset();
            existingGroupsSection.style.display = "block";
        } catch (err) {
            console.error(err);
            alert("建立群組失敗，請稍後再試");
        }
    });

    // Members
    addMemberForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = sanitizeText(memberNameInput.value);
        const group = getCurrentGroup();
        if (!group || !group.serverId) return;
        if (!name) {
            alert("請輸入成員姓名");
            return;
        }
        const duplicate = group.members.find((m) => m.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            alert("已有相同姓名的成員，請使用暱稱區分");
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/group/${group.serverId}/member`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "新增失敗");
            }
            group.members.push({ id: responseData.id, name: responseData.name });
            saveGroups();
            await syncGroup(group);
            renderMembers();
            renderCustomSplitFields();
            memberNameInput.value = "";
        } catch (err) {
            console.error(err);
            alert("新增成員失敗，請稍後再試");
        }
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

    async function removeMember(memberId) {
        const group = getCurrentGroup();
        if (!group || !group.serverId) return;
        if (!confirm("刪除成員後，相關費用將一併移除，確定嗎？")) return;
        try {
            const response = await fetch(`${API_BASE}/api/group/${group.serverId}/member/${memberId}`, {
                method: "DELETE",
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "刪除失敗");
            }
            group.members = group.members.filter((m) => m.id !== memberId);
            group.expenses = group.expenses.filter((ex) => ex.payerId !== memberId);
            saveGroups();
            await syncGroup(group);
            renderMembers();
            renderExpenses();
            renderCustomSplitFields();
            renderSettlement();
        } catch (err) {
            console.error(err);
            alert("刪除成員失敗，請稍後再試");
        }
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

    addExpenseForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const group = getCurrentGroup();
        if (!group || !group.serverId) return;
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
        try {
            const response = await fetch(`${API_BASE}/api/group/${group.serverId}/expense`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ desc, amount, payerId, splitType, weights }),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "新增失敗");
            }
            const expense = {
                id: responseData.id,
                desc: responseData.desc,
                amount: responseData.amount,
                payerId: responseData.payerId,
                splitType: responseData.splitType,
                weights: responseData.weights || [],
            };
            group.expenses.push(expense);
            saveGroups();
            await syncGroup(group);
            renderExpenses();
            renderSettlement();
            addExpenseForm.reset();
            customSplitArea.style.display = "none";
        } catch (err) {
            console.error(err);
            alert("新增費用失敗，請稍後再試");
        }
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

    async function removeExpense(id) {
        const group = getCurrentGroup();
        if (!group || !group.serverId) return;
        try {
            const response = await fetch(`${API_BASE}/api/group/${group.serverId}/expense/${id}`, {
                method: "DELETE",
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "刪除失敗");
            }
            group.expenses = group.expenses.filter((e) => e.id !== id);
            saveGroups();
            await syncGroup(group);
            renderExpenses();
            renderSettlement();
        } catch (err) {
            console.error(err);
            alert("刪除費用失敗，請稍後再試");
        }
    }

    // 同步群組資料到伺服器
    async function syncGroup(group) {
        if (!group.serverId) return;
        try {
            await fetch(`${API_BASE}/api/group/${group.serverId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: group.name,
                    currency: group.currency,
                    members: group.members,
                    expenses: group.expenses,
                }),
            });
        } catch (err) {
            console.error("同步失敗", err);
        }
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

    // API 基礎 URL
    const API_BASE = window.location.origin;

    // 載入分享連結
    async function loadShareUrl() {
        const group = getCurrentGroup();
        if (!group || !group.serverId) return;
        const url = `${API_BASE}/?id=${group.serverId}`;
        shareUrl.style.display = "block";
        shareUrl.innerHTML = `<strong>分享連結：</strong><br><a href="${url}" target="_blank">${url}</a> <button onclick="copyToClipboard('${url}')" class="btn-secondary" style="margin-left: 8px;">複製</button>`;
    }

    function copyToClipboard(text) {
        navigator.clipboard?.writeText(text).then(() => {
            alert("連結已複製到剪貼簿！");
        }).catch(() => {
            alert("複製失敗，請手動複製連結");
        });
    }

    // 從 URL 載入群組
    async function tryLoadFromUrl() {
        const params = new URLSearchParams(location.search);
        const groupId = params.get("id");
        if (!groupId) return;
        try {
            const response = await fetch(`${API_BASE}/api/group/${groupId}`);
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "群組不存在");
            }
            const imported = {
                id: createId(),
                serverId: responseData.id,
                name: responseData.name,
                currency: responseData.currency || "HKD",
                members: responseData.members || [],
                expenses: responseData.expenses || [],
            };
            groups.push(imported);
            saveGroups();
            renderGroups();
            openGroup(imported.id);
        } catch (err) {
            console.error(err);
            alert("無法載入分享的群組資料：" + err.message);
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
