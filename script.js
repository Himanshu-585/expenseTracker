// Supabase setup
const SUPABASE_URL = 'https://iqjgxhynsznhslkbuioi.supabase.co'
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxamd4aHluc3puaHNsa2J1aW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI1MDIsImV4cCI6MjA4OTQwODUwMn0.3y0-kw7MqVpisfBcPPmpv8pVH47IguLn8791VcqMCLQ"

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentGroup = null
let currentGroupName = ''
let currentUser = null

const CHART_COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
]

// =====================
// SANITIZATION HELPERS
// =====================
function escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str).replace(/[&<>"'`]/g, function(m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#96;'
        })[m]
    })
}

function sanitizeText(str) {
    if (!str) return ''
    return String(str).trim().slice(0, 500)
}

function sanitizeNumber(val) {
    var n = parseFloat(val)
    return isFinite(n) && n > 0 ? n : 0
}

// =====================
// AUTH & INIT
// =====================
window.onload = async function() {
    try {
        const { data: { session }, error } = await sb.auth.getSession()
        if (error) throw error

        if (!session) {
            window.location.href = 'login.html'
            return
        }
        currentUser = session.user

        var theme = localStorage.getItem('theme')
        if (theme == 'dark') {
            document.body.classList.add('dark')
            document.getElementById('themeToggle').textContent = '☀️ Light Mode'
        }
        setupListeners()
        await loadGroups()
    } catch (err) {
        console.error('Auth error:', err)
        window.location.href = 'login.html'
    }
}

// =====================
// LOAD & RENDER GROUPS
// =====================
async function loadGroups() {
    try {
        const { data: groups, error } = await sb
            .from('groups')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        renderSidebar(groups || [])
    } catch (err) {
        console.error('Error loading groups:', err)
        document.getElementById('groupsList').innerHTML = '<p style="color:red; text-align:center; padding:20px;">Error loading groups</p>'
    }
}

function renderSidebar(groups) {
    var list = document.getElementById('groupsList')
    if (groups.length == 0) {
        list.innerHTML = '<p style="color:gray; text-align:center; padding:20px;">No groups yet</p>'
        return
    }
    var html = ''
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i]
        var activeClass = g.id == currentGroup ? 'active' : ''
        html += '<div class="group-item ' + activeClass + '">'
        html += '<h4>' + escapeHtml(g.name) + '</h4>'
        html += '<div style="display:flex; gap:6px; margin-top:8px;">'
        html += '<button class="btn-green grp-open-btn" style="flex:1; padding:5px; font-size:0.85em;" data-id="' + escapeHtml(String(g.id)) + '" data-name="' + escapeHtml(g.name) + '">Open</button>'
        html += '<button class="btn-red grp-del-btn" style="padding:5px 10px; font-size:0.85em;" data-id="' + escapeHtml(String(g.id)) + '">Delete</button>'
        html += '</div></div>'
    }
    list.innerHTML = html

    document.querySelectorAll('.grp-open-btn').forEach(function(btn) {
        btn.onclick = async function() {
            currentGroup = parseInt(btn.dataset.id)
            currentGroupName = btn.dataset.name
            await loadGroups()
            await showGroupDetails()
        }
    })

    document.querySelectorAll('.grp-del-btn').forEach(function(btn) {
        btn.onclick = async function() {
            if (!confirm('Delete this group? All data will be lost!')) return
            var gid = parseInt(btn.dataset.id)
            await sb.from('groups').delete().eq('id', gid).eq('user_id', currentUser.id)
            if (currentGroup == gid) {
                currentGroup = null
                currentGroupName = ''
                document.getElementById('mainContent').innerHTML = '<div class="welcome-screen"><h2>👋 Welcome!</h2><p>Create a group to start tracking expenses</p></div>'
            }
            await loadGroups()
        }
    })
}

// =====================
// GROUP DETAILS
// =====================
async function showGroupDetails() {
    if (!currentGroup) return

    try {
        const { data: members, error: membersError } = await sb
            .from('members')
            .select('*')
            .eq('group_id', currentGroup)
            .order('name')

        if (membersError) throw membersError

        const { data: expenses, error: expensesError } = await sb
            .from('expenses')
            .select('*')
            .eq('group_id', currentGroup)
            .order('created_at', { ascending: false })

        if (expensesError) throw expensesError

        const { data: messages, error: messagesError } = await sb
            .from('messages')
            .select('*')
            .eq('group_id', currentGroup)
            .order('created_at', { ascending: true })

        if (messagesError) throw messagesError

        var total = expenses.reduce(function(s, e) { return s + e.amount }, 0)
        var avg = expenses.length > 0 ? total / expenses.length : 0
        var budget = parseFloat(localStorage.getItem('budget_' + currentGroup)) || 0

        var html = ''
        html += '<div class="group-header"><h2>' + escapeHtml(currentGroupName) + '</h2>'
        html += '<div class="group-actions">'
        html += '<button class="btn-green" id="addMemberOpenBtn">+ Add Member</button>'
        html += '<button class="btn-green" id="addExpenseOpenBtn">+ Add Expense</button>'
        html += '<button class="btn-orange" id="setBudgetOpenBtn">🎯 Set Budget</button>'
        html += '<button class="btn-purple" id="insightsBtn">📊 Insights</button>'
        html += '<button class="btn-red" id="logoutBtn" onclick="handleLogout()" style="background:#6b7280;">🚪 Logout</button>'
        html += '</div></div>'

        html += renderBudgetSection(total, budget)

        html += '<div class="summary-grid">'
        html += '<div class="summary-card"><h4>Total Spent</h4><p>Rs.' + total.toFixed(2) + '</p></div>'
        html += '<div class="summary-card"><h4>Expenses</h4><p>' + expenses.length + '</p></div>'
        html += '<div class="summary-card"><h4>Average</h4><p>Rs.' + avg.toFixed(2) + '</p></div>'
        html += '</div>'

        html += '<div class="section"><h3>Members (' + members.length + ')</h3><div class="members-grid" id="membersGrid"></div></div>'
        html += '<div class="section"><h3>Expenses (' + expenses.length + ')</h3><div class="expense-list" id="expenseList"></div></div>'
        html += '<div class="section"><h3>Who Owes Whom</h3><div class="balance-list" id="balanceList"></div></div>'
        html += '<div class="section"><h3>Group Chat</h3><div class="chat-box">'
        html += '<div class="chat-messages" id="chatMessages"></div>'
        html += '<div class="chat-input-row"><input type="text" id="chatInput" placeholder="Type a message..." maxlength="500"><button id="sendMsgBtn">Send</button>'
        html += '</div></div></div>'

        document.getElementById('mainContent').innerHTML = html

        document.getElementById('addMemberOpenBtn').onclick = function() { openModal('addMemberModal') }
        document.getElementById('addExpenseOpenBtn').onclick = async function() {
            var mem = members || []
            if (!mem || mem.length < 2) { alert('Add at least 2 members first'); return }
            updatePaidByDropdown(mem)
            updateSplitConfig(mem)
            hideSplitPreview()
            openModal('addExpenseModal')
        }
        document.getElementById('setBudgetOpenBtn').onclick = function() {
            document.getElementById('budgetAmount').value = budget > 0 ? budget : ''
            openModal('setBudgetModal')
        }
        document.getElementById('insightsBtn').onclick = function() {
            openModal('aiInsightsModal')
            showRuleInsights(members, expenses, total, budget)
        }
        document.getElementById('sendMsgBtn').onclick = sendMsg

        // Allow send on Enter key
        document.getElementById('chatInput') && document.getElementById('chatInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') sendMsg()
        })

        renderMembers(members)
        renderExpenses(expenses)
        renderBalances(members, expenses)
        renderChat(messages)
        updatePaidByDropdown(members)
    } catch (err) {
        console.error('Error showing group details:', err)
        alert('Error loading group details: ' + err.message)
    }
}

// =====================
// BUDGET
// =====================
function renderBudgetSection(total, budget) {
    if (budget <= 0) {
        return '<div class="budget-section"><div class="budget-header"><h4>🎯 Budget Goal</h4><span style="color:#6366f1; cursor:pointer;" onclick="document.getElementById(\'setBudgetOpenBtn\').click()">+ Set a budget</span></div><p style="font-size:0.85em; color:#94a3b8;">No budget set yet.</p></div>'
    }
    var pct = Math.min((total / budget) * 100, 100)
    var isWarning = pct >= 70 && pct < 90
    var isDanger = pct >= 90
    var barClass = isDanger ? 'danger' : (isWarning ? 'warning' : '')
    var alertHtml = ''
    if (isDanger) alertHtml = '<div class="budget-alert danger">🚨 Over 90% of your budget used!</div>'
    else if (isWarning) alertHtml = '<div class="budget-alert">⚠️ You\'ve used ' + pct.toFixed(0) + '% of your budget.</div>'
    return `
        <div class="budget-section">
            <div class="budget-header">
                <h4>🎯 Budget Goal</h4>
                <span>Rs.${total.toFixed(2)} / Rs.${budget.toFixed(2)}</span>
            </div>
            <div class="budget-bar-wrapper">
                <div class="budget-bar ${barClass}" style="width:${pct}%"></div>
            </div>
            <div class="budget-status ${barClass}">${pct.toFixed(1)}% used • Rs.${Math.max(budget - total, 0).toFixed(2)} remaining</div>
            ${alertHtml}
        </div>`
}

// =====================
// INSIGHTS
// =====================
function showRuleInsights(members, expenses, total, budget) {
    var el = document.getElementById('aiInsightsContent')
    if (!el) return
    if (expenses.length === 0) { el.innerHTML = '<div class="ai-error">No expenses yet!</div>'; return }
    var insights = generateInsights(members, expenses, total, budget)
    var html = '<div class="ai-insights-result">'
    insights.forEach(function(ins) {
        html += '<div class="ai-insight-block"><strong>' + escapeHtml(ins.title) + '</strong>' + ins.body + '</div>'
    })
    html += '</div>'
    el.innerHTML = html
}

function generateInsights(members, expenses, total, budget) {
    var insights = []
    var categoryTotals = {}
    expenses.forEach(function(exp) {
        var cat = exp.category || '📌 Other'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount
    })
    var topCat = Object.keys(categoryTotals).sort(function(a, b) { return categoryTotals[b] - categoryTotals[a] })[0]
    if (topCat) insights.push({ title: '🍔 Top Category', body: 'Most spent on <strong>' + escapeHtml(topCat) + '</strong> — Rs.' + categoryTotals[topCat].toFixed(2) })

    var payerTotals = {}
    expenses.forEach(function(exp) { payerTotals[exp.paid_by] = (payerTotals[exp.paid_by] || 0) + exp.amount })
    var topPayer = Object.keys(payerTotals).sort(function(a, b) { return payerTotals[b] - payerTotals[a] })[0]
    if (topPayer) insights.push({ title: '💳 Top Payer', body: '<strong>' + escapeHtml(topPayer) + '</strong> paid Rs.' + payerTotals[topPayer].toFixed(2) })

    var perPerson = members.length > 0 ? total / members.length : 0
    insights.push({ title: '👥 Per Person', body: 'Each owes <strong>Rs.' + perPerson.toFixed(2) + '</strong>' })

    if (budget > 0) {
        var pct = (total / budget) * 100
        if (pct >= 100) insights.push({ title: '🚨 Over Budget!', body: 'You exceeded by Rs.' + Math.abs(budget - total).toFixed(2) })
        else insights.push({ title: '✅ Budget OK', body: pct.toFixed(0) + '% used. Rs.' + (budget - total).toFixed(2) + ' left.' })
    }
    return insights
}

// =====================
// SPLIT PREVIEW
// =====================
function updateSplitPreview(members, amount) {
    if (!members || members.length === 0 || !amount || amount <= 0) { hideSplitPreview(); return }
    var method = document.querySelector('input[name="split"]:checked')
    if (!method) return
    var splits = calculateSplitPreview(method.value, members, amount)
    if (!splits || splits.length === 0) { hideSplitPreview(); return }
    var container = document.getElementById('splitPreviewContainer')
    var chart = document.getElementById('splitChart')
    if (!container || !chart) return
    container.style.display = 'block'
    var html = ''
    splits.forEach(function(s, idx) {
        var pct = (s.amount / amount) * 100
        var color = CHART_COLORS[idx % CHART_COLORS.length]
        html += '<div class="split-bar-row">'
        html += '<div class="split-bar-label">' + escapeHtml(s.name) + '</div>'
        html += '<div class="split-bar-track"><div class="split-bar-fill" data-pct="' + pct + '" style="background:' + color + '; width:0%">' + pct.toFixed(0) + '%</div></div>'
        html += '<div class="split-bar-amount">Rs.' + s.amount.toFixed(2) + '</div>'
        html += '</div>'
    })
    chart.innerHTML = html
    setTimeout(function() {
        chart.querySelectorAll('.split-bar-fill').forEach(function(bar) { bar.style.width = bar.dataset.pct + '%' })
    }, 50)
}

function calculateSplitPreview(method, members, amount) {
    if (method === 'equal') {
        var share = amount / members.length
        return members.map(function(m) { return { name: m.name, amount: share } })
    }
    if (method === 'custom') {
        var checked = []
        document.querySelectorAll('.member-cb:checked').forEach(function(c) { checked.push(c.dataset.member) })
        if (checked.length === 0) return null
        var share = amount / checked.length
        return checked.map(function(name) { return { name: name, amount: share } })
    }
    if (method === 'percentage') {
        var results = []
        document.querySelectorAll('.pct-input').forEach(function(inp) {
            var pct = parseFloat(inp.value) || 0
            if (pct > 0) results.push({ name: inp.dataset.member, amount: amount * pct / 100 })
        })
        return results
    }
    if (method === 'amount') {
        var results = []
        document.querySelectorAll('.amt-input').forEach(function(inp) {
            var val = parseFloat(inp.value) || 0
            if (val > 0) results.push({ name: inp.dataset.member, amount: val })
        })
        return results
    }
    return null
}

function hideSplitPreview() {
    var container = document.getElementById('splitPreviewContainer')
    if (container) container.style.display = 'none'
}

// =====================
// RENDER FUNCTIONS
// =====================
function renderMembers(members) {
    var el = document.getElementById('membersGrid')
    if (!el) return
    if (members.length == 0) { el.innerHTML = '<div class="empty-state"><p>No members yet</p></div>'; return }
    var html = ''
    members.forEach(function(m) {
        html += '<div class="member-card"><span>' + escapeHtml(m.name) + '</span>'
        html += '<button class="btn-red mem-del-btn" data-id="' + escapeHtml(String(m.id)) + '">Remove</button></div>'
    })
    el.innerHTML = html
    el.querySelectorAll('.mem-del-btn').forEach(function(btn) {
        btn.onclick = async function() {
            if (!confirm('Remove this member?')) return
            await sb.from('members').delete().eq('id', parseInt(btn.dataset.id))
            await showGroupDetails()
        }
    })
}

function renderExpenses(expenses) {
    var el = document.getElementById('expenseList')
    if (!el) return
    if (expenses.length == 0) { el.innerHTML = '<div class="empty-state"><p>No expenses yet</p></div>'; return }
    var html = ''
    expenses.forEach(function(exp) {
        html += '<div class="expense-card"><div>'
        html += '<h4>' + escapeHtml(exp.category || '📌') + ' ' + escapeHtml(exp.description) + '</h4>'
        html += '<p>Paid by ' + escapeHtml(exp.paid_by) + ' • ' + escapeHtml(getDate(exp.created_at)) + '</p>'
        html += '</div><div class="expense-amount">Rs.' + parseFloat(exp.amount).toFixed(2) + '</div>'
        html += '<button class="btn-red exp-del-btn" data-id="' + escapeHtml(String(exp.id)) + '">Delete</button></div>'
    })
    el.innerHTML = html
    el.querySelectorAll('.exp-del-btn').forEach(function(btn) {
        btn.onclick = async function() {
            if (!confirm('Delete this expense?')) return
            await sb.from('expenses').delete().eq('id', parseInt(btn.dataset.id))
            await showGroupDetails()
        }
    })
}

function renderBalances(members, expenses) {
    var el = document.getElementById('balanceList')
    if (!el) return
    if (members.length < 2 || expenses.length == 0) {
        el.innerHTML = '<div class="empty-state"><p>Add members and expenses to see balances</p></div>'
        return
    }
    var bal = {}
    members.forEach(function(m) { bal[m.name] = 0 })
    expenses.forEach(function(exp) {
        if (bal[exp.paid_by] === undefined) return
        bal[exp.paid_by] += exp.amount
        var sd = exp.split_data
        if (!exp.split_method || exp.split_method == 'equal') {
            var share = exp.amount / members.length
            members.forEach(function(m) { bal[m.name] -= share })
        } else if (exp.split_method == 'custom' && sd && sd.members) {
            var share = exp.amount / sd.members.length
            sd.members.forEach(function(m) { if (bal[m] !== undefined) bal[m] -= share })
        } else if (exp.split_method == 'percentage' && sd && sd.percentages) {
            Object.keys(sd.percentages).forEach(function(m) { if (bal[m] !== undefined) bal[m] -= (exp.amount * sd.percentages[m] / 100) })
        } else if (exp.split_method == 'amount' && sd && sd.amounts) {
            Object.keys(sd.amounts).forEach(function(m) {
                if (bal[m] !== undefined) bal[m] -= parseFloat(sd.amounts[m]) || 0
            })
        }
    })
    var creditors = [], debtors = []
    Object.keys(bal).forEach(function(p) {
        if (bal[p] > 0.01) creditors.push({ name: p, amt: bal[p] })
        else if (bal[p] < -0.01) debtors.push({ name: p, amt: -bal[p] })
    })
    var settlements = []
    var i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
        var pay = Math.min(debtors[i].amt, creditors[j].amt)
        settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: pay })
        debtors[i].amt -= pay; creditors[j].amt -= pay
        if (debtors[i].amt < 0.01) i++
        if (creditors[j].amt < 0.01) j++
    }
    if (settlements.length == 0) { el.innerHTML = '<div class="balance-item settled">✅ All settled up!</div>'; return }
    var html = ''
    settlements.forEach(function(s) {
        html += '<div class="balance-item"><strong>' + escapeHtml(s.from) + '</strong> owes <strong>' + escapeHtml(s.to) + '</strong> '
        html += '<strong style="color:#ef4444">Rs.' + s.amount.toFixed(2) + '</strong></div>'
    })
    el.innerHTML = html
}

function renderChat(messages) {
    var el = document.getElementById('chatMessages')
    if (!el) return
    if (messages.length == 0) { el.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>'; return }
    var html = ''
    messages.forEach(function(msg) {
        if (msg.type == 'system') {
            html += '<div class="chat-msg system">' + escapeHtml(msg.text) + '</div>'
        } else {
            var cls = msg.sender == 'You' ? 'me' : 'other'
            html += '<div class="chat-msg ' + cls + '">'
            if (cls == 'other') html += '<div style="font-size:0.82em;font-weight:bold;margin-bottom:3px;">' + escapeHtml(msg.sender) + '</div>'
            html += escapeHtml(msg.text) + '<div class="msg-time">' + escapeHtml(getDate(msg.created_at)) + '</div></div>'
        }
    })
    el.innerHTML = html
    el.scrollTop = el.scrollHeight
}

// =====================
// LISTENERS & SETUP
// =====================
function setupListeners() {
    document.getElementById('newGroupBtn').onclick = function() { openModal('createGroupModal') }

    document.getElementById('themeToggle').onclick = function() {
        document.body.classList.toggle('dark')
        var isDark = document.body.classList.contains('dark')
        document.getElementById('themeToggle').textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode'
        localStorage.setItem('theme', isDark ? 'dark' : 'light')
    }

    document.getElementById('createGroupBtn').onclick = async function() {
        var name = sanitizeText(document.getElementById('groupName').value)
        if (!name) return alert('Enter a group name')
        if (name.length > 100) return alert('Group name too long')

        const { data, error } = await sb
            .from('groups')
            .insert([{ name, user_id: currentUser.id }])
            .select()

        if (error) {
            alert('Error creating group: ' + error.message)
            return
        }

        document.getElementById('groupName').value = ''
        closeModal('createGroupModal')
        currentGroup = data[0].id
        currentGroupName = data[0].name
        await loadGroups()
        await showGroupDetails()
    }

    document.getElementById('addMemberBtn').onclick = async function() {
        var name = sanitizeText(document.getElementById('memberName').value)
        if (!name) return alert('Enter member name')
        if (name.length > 100) return alert('Member name too long')

        await sb.from('members').insert([{ group_id: currentGroup, name }])

        await sb.from('messages').insert([{
            group_id: currentGroup,
            sender: 'System',
            text: name + ' joined the group',
            type: 'system'
        }])

        document.getElementById('memberName').value = ''
        closeModal('addMemberModal')
        await showGroupDetails()
    }

    document.getElementById('addExpenseBtn').onclick = async function() {
        var desc = sanitizeText(document.getElementById('expenseDesc').value)
        var amount = sanitizeNumber(document.getElementById('expenseAmount').value)
        var category = document.getElementById('expenseCategory').value
        var paidBy = document.getElementById('expensePaidBy').value
        var splitMethod = document.querySelector('input[name="split"]:checked').value

        if (!desc) { alert('Please enter a description'); return }
        if (desc.length > 200) { alert('Description too long'); return }
        if (!amount || amount <= 0) { alert('Please enter a valid amount'); return }
        if (amount > 10000000) { alert('Amount too large'); return }
        if (!category) { alert('Please select a category'); return }
        if (!paidBy) { alert('Please select who paid'); return }

        var members = await sb.from('members').select('*').eq('group_id', currentGroup)
        var memberNames = members.data.map(function(m) { return m.name })
        var splitData = getSplitData(splitMethod, memberNames, amount)
        if (!splitData) return

        await sb.from('expenses').insert([{
            group_id: currentGroup,
            description: desc,
            amount,
            category,
            paid_by: paidBy,
            split_method: splitMethod,
            split_data: splitData
        }])

        await sb.from('messages').insert([{
            group_id: currentGroup,
            sender: 'System',
            text: paidBy + ' added: ' + desc + ' - Rs.' + amount.toFixed(2),
            type: 'system'
        }])

        document.getElementById('expenseDesc').value = ''
        document.getElementById('expenseAmount').value = ''
        document.getElementById('expenseCategory').value = ''
        document.getElementById('expensePaidBy').value = ''
        document.querySelector('input[name="split"][value="equal"]').checked = true
        hideSplitPreview()
        closeModal('addExpenseModal')
        await showGroupDetails()
    }

    document.getElementById('expenseAmount').addEventListener('input', async function() {
        var amount = sanitizeNumber(this.value)
        if (!currentGroup) return
        var members = await sb.from('members').select('*').eq('group_id', currentGroup)
        updateSplitPreview(members.data, amount)
        updateSplitConfig(members.data)
    })

    document.querySelectorAll('input[name="split"]').forEach(function(r) {
        r.onchange = async function() {
            var members = await sb.from('members').select('*').eq('group_id', currentGroup)
            updateSplitConfig(members.data || [])
            var amount = sanitizeNumber(document.getElementById('expenseAmount').value)
            updateSplitPreview(members.data, amount)
        }
    })

    document.getElementById('saveBudgetBtn').onclick = function() {
        var val = sanitizeNumber(document.getElementById('budgetAmount').value)
        if (!val || val <= 0) { alert('Enter a valid budget amount'); return }
        if (val > 100000000) { alert('Budget amount too large'); return }
        localStorage.setItem('budget_' + currentGroup, val)
        closeModal('setBudgetModal')
        showGroupDetails()
    }

    document.getElementById('removeBudgetBtn').onclick = function() {
        if (!confirm('Remove the budget goal for this group?')) return
        localStorage.removeItem('budget_' + currentGroup)
        closeModal('setBudgetModal')
        showGroupDetails()
    }
}

// =====================
// SPLIT HELPERS
// =====================
function updatePaidByDropdown(members) {
    var sel = document.getElementById('expensePaidBy')
    if (!sel) return
    sel.innerHTML = '<option value="">Who paid?</option>'
    members.forEach(function(m) { sel.innerHTML += '<option value="' + escapeHtml(m.name) + '">' + escapeHtml(m.name) + '</option>' })
}

function updateSplitConfig(members) {
    var method = document.querySelector('input[name="split"]:checked')
    var area = document.getElementById('splitConfig')
    if (!area || !method || !members) return
    if (method.value == 'equal') {
        area.innerHTML = '<p style="color:gray;font-size:0.9em;">Split equally among all members</p>'
    } else if (method.value == 'percentage') {
        var html = '<p style="font-size:0.9em;margin-bottom:8px;">Enter % for each member:</p>'
        members.forEach(function(m) {
            html += '<div class="split-row"><label>' + escapeHtml(m.name) + '</label>'
            html += '<input type="number" class="pct-input" data-member="' + escapeHtml(m.name) + '" placeholder="%" min="0" max="100"></div>'
        })
        html += '<div class="total-indicator" id="pctTotal">Total: 0%</div>'
        area.innerHTML = html
        document.querySelectorAll('.pct-input').forEach(function(inp) {
            inp.oninput = function() {
                var t = 0
                document.querySelectorAll('.pct-input').forEach(function(i) { t += parseFloat(i.value) || 0 })
                var el = document.getElementById('pctTotal')
                el.textContent = 'Total: ' + t.toFixed(1) + '%'
                el.className = 'total-indicator' + (Math.abs(t - 100) > 0.01 ? ' error' : '')
                var amount = sanitizeNumber(document.getElementById('expenseAmount').value)
                updateSplitPreview(members, amount)
            }
        })
    } else if (method.value == 'custom') {
        var html = '<p style="font-size:0.9em;margin-bottom:8px;">Select members:</p>'
        members.forEach(function(m) {
            html += '<div class="split-row"><label><input type="checkbox" class="member-cb" data-member="' + escapeHtml(m.name) + '" checked> ' + escapeHtml(m.name) + '</label></div>'
        })
        area.innerHTML = html
        area.querySelectorAll('.member-cb').forEach(function(cb) {
            cb.onchange = function() {
                var amount = sanitizeNumber(document.getElementById('expenseAmount').value)
                updateSplitPreview(members, amount)
            }
        })
    } else if (method.value == 'amount') {
        var totalAmt = sanitizeNumber(document.getElementById('expenseAmount').value)
        var html = '<p style="font-size:0.9em;margin-bottom:8px;">Enter exact amount:</p>'
        members.forEach(function(m) {
            html += '<div class="split-row"><label>' + escapeHtml(m.name) + '</label>'
            html += '<input type="number" class="amt-input" data-member="' + escapeHtml(m.name) + '" placeholder="Rs." min="0"></div>'
        })
        html += '<div class="total-indicator" id="amtTotal">Total: Rs.0 / Rs.' + totalAmt.toFixed(2) + '</div>'
        area.innerHTML = html
        document.querySelectorAll('.amt-input').forEach(function(inp) {
            inp.oninput = function() {
                var totalAmt = sanitizeNumber(document.getElementById('expenseAmount').value)
                var t = 0
                document.querySelectorAll('.amt-input').forEach(function(i) { t += parseFloat(i.value) || 0 })
                var el = document.getElementById('amtTotal')
                el.textContent = 'Total: Rs.' + t.toFixed(2) + ' / Rs.' + totalAmt.toFixed(2)
                el.className = 'total-indicator' + (Math.abs(t - totalAmt) > 0.01 ? ' error' : '')
                updateSplitPreview(members, totalAmt)
            }
        })
    }
    var amount = sanitizeNumber(document.getElementById('expenseAmount').value)
    if (amount > 0) updateSplitPreview(members, amount)
}

function getSplitData(method, memberNames, totalAmount) {
    if (method == 'equal') return { members: memberNames }
    if (method == 'percentage') {
        var p = {}, t = 0
        document.querySelectorAll('.pct-input').forEach(function(i) { p[i.dataset.member] = parseFloat(i.value) || 0; t += p[i.dataset.member] })
        if (Math.abs(t - 100) > 0.01) { alert('Percentages must add up to 100%'); return null }
        return { percentages: p }
    }
    if (method == 'custom') {
        var m = []
        document.querySelectorAll('.member-cb:checked').forEach(function(c) { m.push(c.dataset.member) })
        if (m.length == 0) { alert('Select at least one member'); return null }
        return { members: m }
    }
    if (method == 'amount') {
        var a = {}, t = 0
        document.querySelectorAll('.amt-input').forEach(function(i) {
            var v = parseFloat(i.value) || 0
            a[i.dataset.member] = v
            t += v
        })
        if (Math.abs(t - totalAmount) > 0.01) { alert('Amounts must add up to Rs.' + totalAmount.toFixed(2)); return null }
        return { amounts: a }
    }
}

// =====================
// CHAT
// =====================
async function sendMsg() {
    var inp = document.getElementById('chatInput')
    var text = sanitizeText(inp.value)
    if (!text) return
    if (text.length > 500) { alert('Message too long'); return }

    await sb.from('messages').insert([{
        group_id: currentGroup,
        sender: 'You',
        text: text,
        type: 'user'
    }])

    inp.value = ''
    const { data: messages } = await sb
        .from('messages')
        .select('*')
        .eq('group_id', currentGroup)
        .order('created_at', { ascending: true })
    renderChat(messages || [])
}

// =====================
// LOGOUT
// =====================
function handleLogout() {
    sb.auth.signOut()
        .then(function() { window.location.href = 'auth.html' })
        .catch(function() { window.location.href = 'auth.html' })
}

// =====================
// MODAL HELPERS
// =====================
function openModal(id) {
    document.getElementById(id).classList.add('active')
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active')
}

window.openModal = openModal
window.closeModal = closeModal
window.handleLogout = handleLogout

window.onclick = function(e) {
    if (e.target.classList.contains('modal'))
        e.target.classList.remove('active')
}

// =====================
// DATE HELPER
// =====================
function getDate(dateStr) {
    if (!dateStr) return 'Just now'
    var d = new Date(dateStr), now = new Date()
    var diff = Math.floor((now - d) / 86400000)
    if (diff == 0) return 'Today'
    if (diff == 1) return 'Yesterday'
    if (diff < 7) return diff + ' days ago'
    return d.toLocaleDateString()
}