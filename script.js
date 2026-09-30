// ================================================
// EXPENSE TRACKER — script.js
// ================================================

// =====================
// SUPABASE SETUP
// =====================
const SUPABASE_URL = 'https://iqjgxhynsznhslkbuioi.supabase.co'
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxamd4aHluc3puaHNsa2J1aW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI1MDIsImV4cCI6MjA4OTQwODUwMn0.3y0-kw7MqVpisfBcPPmpv8pVH47IguLn8791VcqMCLQ"

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentGroup = null
let currentGroupName = ''
let currentUser = null
let cachedGroups = []

const CHART_COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
]

let __authRedirected = false

function redirectToLogin() {
    if (__authRedirected) return
    __authRedirected = true
    window.location.replace('login.html')
}

// =====================
// SANITIZATION
// =====================
function escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str).replace(/[&<>"'`]/g, function(m) {
        return ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;', '`': '&#96;'
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
// ROUTER
// =====================
function getPageFromHash() {
    var hash = window.location.hash.replace('#', '') || 'dashboard'
    if (hash.indexOf('group/') === 0) return 'group'
    return hash
}

function navigate(page) {
    window.location.hash = page
}

async function router() {
    var page = getPageFromHash()

    if (page === 'group') {
        var gid = window.location.hash.replace('#group/', '')
        if (gid) {
            currentGroup = parseInt(gid)
            var g = cachedGroups.find(function(x) { return x.id == currentGroup })
            currentGroupName = g ? g.name : 'Group'
            await showGroupDetails()
            return
        }
        navigate('groups')
        return
    }

    document.querySelectorAll('.nav-link').forEach(function(el) {
        el.classList.toggle('active', el.dataset.page === page)
    })

    if (page === 'dashboard') return renderDashboardPage()
    if (page === 'groups') return renderGroupsPage()
    if (page === 'expenses') return renderExpensesPage()
    if (page === 'analytics') return renderAnalyticsPage()
    if (page === 'profile') return renderProfilePage()
    return renderDashboardPage()
}

window.addEventListener('hashchange', router)

// =====================
// AUTH & INIT
// =====================
window.onload = async function() {
    try {
        const { data: { session }, error } = await sb.auth.getSession()
        if (error) throw error
        if (!session) { redirectToLogin(); return }
        currentUser = session.user

        var theme = localStorage.getItem('theme')
        if (theme == 'dark') {
            document.body.classList.add('dark')
            document.getElementById('themeToggle').textContent = '☀️ Light Mode'
        }

        setupListeners()
        await loadGroups()

        if (!window.location.hash) {
            window.location.hash = 'dashboard'
        } else {
            await router()
        }

        sb.auth.onAuthStateChange(function(event) {
            if (event === 'SIGNED_OUT') redirectToLogin()
        })
    } catch (err) {
        console.error('Auth error:', err)
        redirectToLogin()
    }
}

// =====================
// LOAD GROUPS
// =====================
async function loadGroups() {
    try {
        const { data: groups, error } = await sb
            .from('groups').select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
        if (error) throw error
        cachedGroups = groups || []
        renderSidebar(cachedGroups)
    } catch (err) {
        console.error('Error loading groups:', err)
    }
}

function renderSidebar(groups) {
    var list = document.getElementById('groupsList')
    if (!list) return
    if (groups.length === 0) {
        list.innerHTML = '<p style="color:gray;text-align:center;padding:12px;font-size:0.85em;">No groups yet</p>'
        return
    }
    var html = ''
    groups.forEach(function(g) {
        var active = g.id == currentGroup ? 'active' : ''
        html += '<div class="group-item ' + active + '" onclick="openGroupFromSidebar(' + g.id + ', \'' + escapeHtml(g.name).replace(/'/g, "\\'") + '\')">'
        html += '<h4>' + escapeHtml(g.name) + '</h4></div>'
    })
    list.innerHTML = html
}

function openGroupFromSidebar(id, name) {
    currentGroup = id
    currentGroupName = name
    navigate('group/' + id)
}

// =====================
// PAGE: DASHBOARD
// =====================
async function renderDashboardPage() {
    var el = document.getElementById('mainContent')
    if (!el) return
    el.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div><p>Loading...</p></div>'
    await loadGroups()

    var html = ''
    html += '<div class="page-header"><h2>🏠 Dashboard</h2><p>Welcome back, ' + escapeHtml((currentUser.email || '').split('@')[0]) + '!</p></div>'
    html += '<div class="summary-grid">'
    html += '<div class="summary-card"><h4>Total Groups</h4><p>' + cachedGroups.length + '</p></div>'
    html += '</div>'
    html += '<div class="section"><h3>📁 Your Groups</h3>'

    if (cachedGroups.length === 0) {
        html += '<div class="empty-state"><p>No groups yet. Click "+ New Group" to start.</p></div>'
    } else {
        html += '<div class="groups-page-grid">'
        cachedGroups.forEach(function(g) {
            html += '<div class="group-card" onclick="openGroupFromSidebar(' + g.id + ', \'' + escapeHtml(g.name).replace(/'/g, "\\'") + '\')">'
            html += '<h4>' + escapeHtml(g.name) + '</h4><p>Click to open →</p></div>'
        })
        html += '</div>'
    }
    html += '</div>'
    el.innerHTML = html
}

// =====================
// PAGE: GROUPS
// =====================
async function renderGroupsPage() {
    var el = document.getElementById('mainContent')
    if (!el) return
    await loadGroups()

    var html = ''
    html += '<div class="page-header"><h2>👥 My Groups</h2><p>All your expense groups</p></div>'
    html += '<button class="btn-green" id="newGroupFromPageBtn" style="margin-bottom:20px;">+ New Group</button>'

    if (cachedGroups.length === 0) {
        html += '<div class="empty-state"><p>No groups yet.</p></div>'
    } else {
        html += '<div class="groups-page-grid">'
        cachedGroups.forEach(function(g) {
            html += '<div class="group-card">'
            html += '<h4>' + escapeHtml(g.name) + '</h4>'
            html += '<div style="display:flex;gap:8px;margin-top:12px;">'
            html += '<button class="btn-green" style="flex:1;" onclick="event.stopPropagation();openGroupFromSidebar(' + g.id + ', \'' + escapeHtml(g.name).replace(/'/g, "\\'") + '\')">Open</button>'
            html += '<button class="btn-red" onclick="event.stopPropagation();deleteGroupFromPage(' + g.id + ')">Delete</button>'
            html += '</div></div>'
        })
        html += '</div>'
    }

    el.innerHTML = html
    document.getElementById('newGroupFromPageBtn').onclick = function() { openModal('createGroupModal') }
}

async function deleteGroupFromPage(id) {
    if (!confirm('Delete this group? All data will be lost!')) return
    await sb.from('groups').delete().eq('id', id).eq('user_id', currentUser.id)
    if (currentGroup === id) { currentGroup = null; currentGroupName = '' }
    await loadGroups()
    router()
}

// =====================
// PAGE: EXPENSES
// =====================
function renderExpensesPage() {
    document.getElementById('mainContent').innerHTML =
        '<div class="page-header"><h2>💰 Expenses</h2><p>Open a group to view its expenses</p></div>' +
        '<div class="empty-state"><p>Select a group from the sidebar to see expenses.</p></div>'
}

// =====================
// PAGE: ANALYTICS
// =====================
function renderAnalyticsPage() {
    document.getElementById('mainContent').innerHTML =
        '<div class="page-header"><h2>📊 Analytics</h2><p>Open a group to view analytics</p></div>' +
        '<div class="empty-state"><p>Select a group from the sidebar to see analytics.</p></div>'
}

// =====================
// PAGE: PROFILE
// =====================
function renderProfilePage() {
    var initial = ((currentUser.email || 'U')[0] || 'U').toUpperCase()
    var html = ''
    html += '<div class="page-header"><h2>👤 Profile</h2><p>Your account and preferences</p></div>'
    html += '<div class="profile-card"><div class="profile-avatar">' + initial + '</div>'
    html += '<div class="profile-info"><h3>' + escapeHtml((currentUser.email || '').split('@')[0]) + '</h3>'
    html += '<p>📧 ' + escapeHtml(currentUser.email) + '</p></div></div>'
    html += '<div class="section"><h3>📊 Your Stats</h3><div class="summary-grid">'
    html += '<div class="summary-card"><h4>Groups</h4><p>' + cachedGroups.length + '</p></div>'
    html += '</div></div>'
    html += '<div class="section"><h3>⚙️ Settings</h3><div class="settings-list">'
    html += '<div class="setting-item"><div><strong>🎨 Theme</strong></div><button class="btn-green" onclick="document.getElementById(\'themeToggle\').click()">Toggle</button></div>'
    html += '<div class="setting-item"><div><strong>🚪 Logout</strong></div><button class="btn-red" onclick="handleLogout()">Logout</button></div>'
    html += '</div></div>'
    document.getElementById('mainContent').innerHTML = html
}// =====================
// GROUP DETAILS PAGE
// =====================
async function showGroupDetails() {
    if (!currentGroup) { navigate('groups'); return }

    try {
        const { data: members } = await sb.from('members').select('*').eq('group_id', currentGroup).order('name')
        const { data: expenses } = await sb.from('expenses').select('*').eq('group_id', currentGroup).order('created_at', { ascending: false })
        const { data: messages } = await sb.from('messages').select('*').eq('group_id', currentGroup).order('created_at', { ascending: true })

        var memList = members || []
        var expList = expenses || []
        var msgList = messages || []

        var total = expList.reduce(function(s, e) { return s + e.amount }, 0)
        var avg = expList.length > 0 ? total / expList.length : 0
        var budget = parseFloat(localStorage.getItem('budget_' + currentGroup)) || 0

        var html = ''
        html += '<div class="group-header">'
        html += '<button onclick="navigate(\'groups\')" style="background:none;border:none;color:#6366f1;cursor:pointer;font-size:0.9em;margin-bottom:8px;padding:0;">← Back to Groups</button>'
        html += '<h2>' + escapeHtml(currentGroupName) + '</h2>'
        html += '<div class="group-actions">'
        html += '<button class="btn-green" id="addMemberOpenBtn">+ Add Member</button>'
        html += '<button class="btn-green" id="addExpenseOpenBtn">+ Add Expense</button>'
        html += '<button class="btn-orange" id="setBudgetOpenBtn">🎯 Set Budget</button>'
        html += '<button class="btn-purple" id="insightsBtn">📊 Insights</button>'
        html += '<button class="btn-purple" id="assistantBtn" style="background:#7c3aed;">🤖 AI Assistant</button>'
        html += '<button class="btn-purple" id="analyticsBtn" style="background:#0891b2;">📈 Analytics</button>'
        html += '<button class="btn-orange" id="settleBtn" style="background:#0ea5e9;">💸 Optimize Settlement</button>'
        html += '</div></div>'

        html += renderBudgetSection(total, budget)

        html += '<div class="summary-grid">'
        html += '<div class="summary-card"><h4>Total Spent</h4><p>Rs.' + total.toFixed(2) + '</p></div>'
        html += '<div class="summary-card"><h4>Expenses</h4><p>' + expList.length + '</p></div>'
        html += '<div class="summary-card"><h4>Average</h4><p>Rs.' + avg.toFixed(2) + '</p></div>'
        html += '</div>'

        html += '<div class="section"><h3>Members (' + memList.length + ')</h3><div class="members-grid" id="membersGrid"></div></div>'
        html += '<div class="section"><h3>Expenses (' + expList.length + ')</h3><div class="expense-list" id="expenseList"></div></div>'
        html += '<div class="section"><h3>Who Owes Whom</h3><div class="balance-list" id="balanceList"></div></div>'
        html += '<div class="section"><h3>Group Chat</h3><div class="chat-box"><div class="chat-messages" id="chatMessages"></div>'
        html += '<div class="chat-input-row"><input type="text" id="chatInput" placeholder="Type a message..." maxlength="500"><button id="sendMsgBtn">Send</button></div></div></div>'

        document.getElementById('mainContent').innerHTML = html

        document.getElementById('addMemberOpenBtn').onclick = function() { openModal('addMemberModal') }
        document.getElementById('addExpenseOpenBtn').onclick = function() {
            if (memList.length < 2) { alert('Add at least 2 members first'); return }
            updatePaidByDropdown(memList)
            updateSplitConfig(memList)
            hideSplitPreview()
            openModal('addExpenseModal')
        }
        document.getElementById('setBudgetOpenBtn').onclick = function() {
            document.getElementById('budgetAmount').value = budget > 0 ? budget : ''
            openModal('setBudgetModal')
        }
        document.getElementById('insightsBtn').onclick = function() {
            openModal('aiInsightsModal')
            showRuleInsights(memList, expList, total, budget)
        }
        document.getElementById('assistantBtn').onclick = function() {
            openAIAssistant(memList, expList, total, budget)
        }
        document.getElementById('analyticsBtn').onclick = function() {
            openAnalyticsModal(memList, expList)
        }
        document.getElementById('settleBtn').onclick = function() {
            showOptimizedSettlement(memList, expList)
        }
        document.getElementById('sendMsgBtn').onclick = sendMsg
        document.getElementById('chatInput') && document.getElementById('chatInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') sendMsg()
        })

        renderMembers(memList)
        renderExpenses(expList)
        renderBalances(memList, expList)
        renderChat(msgList)
        updatePaidByDropdown(memList)
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
        return '<div class="budget-section"><div class="budget-header"><h4>🎯 Budget Goal</h4><span style="color:#6366f1;cursor:pointer;" onclick="document.getElementById(\'setBudgetOpenBtn\').click()">+ Set a budget</span></div><p style="font-size:0.85em;color:#94a3b8;">No budget set yet.</p></div>'
    }
    var pct = Math.min((total / budget) * 100, 100)
    var isWarning = pct >= 70 && pct < 90
    var isDanger = pct >= 90
    var barClass = isDanger ? 'danger' : (isWarning ? 'warning' : '')
    var alertHtml = ''
    if (isDanger) alertHtml = '<div class="budget-alert danger">🚨 Over 90% of your budget used!</div>'
    else if (isWarning) alertHtml = '<div class="budget-alert">⚠️ You\'ve used ' + pct.toFixed(0) + '% of your budget.</div>'
    return '<div class="budget-section">' +
        '<div class="budget-header"><h4>🎯 Budget Goal</h4><span>Rs.' + total.toFixed(2) + ' / Rs.' + budget.toFixed(2) + '</span></div>' +
        '<div class="budget-bar-wrapper"><div class="budget-bar ' + barClass + '" style="width:' + pct + '%"></div></div>' +
        '<div class="budget-status ' + barClass + '">' + pct.toFixed(1) + '% used • Rs.' + Math.max(budget - total, 0).toFixed(2) + ' remaining</div>' +
        alertHtml + '</div>'
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
    var settlements = computeSettlements(computeBalances(members, expenses))
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
// SETUP LISTENERS
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
        const { data, error } = await sb.from('groups').insert([{ name, user_id: currentUser.id }]).select()
        if (error) { alert('Error: ' + error.message); return }
        document.getElementById('groupName').value = ''
        closeModal('createGroupModal')
        await loadGroups()
        openGroupFromSidebar(data[0].id, data[0].name)
    }

    document.getElementById('addMemberBtn').onclick = async function() {
        var name = sanitizeText(document.getElementById('memberName').value)
        if (!name) return alert('Enter member name')
        await sb.from('members').insert([{ group_id: currentGroup, name }])
        await sb.from('messages').insert([{ group_id: currentGroup, sender: 'System', text: name + ' joined the group', type: 'system' }])
        document.getElementById('memberName').value = ''
        closeModal('addMemberModal')
        await showGroupDetails()
    }

    document.getElementById('scanReceiptBtn').onclick = function() { openReceiptScanner() }

    document.getElementById('addExpenseBtn').onclick = async function() {
        var desc = sanitizeText(document.getElementById('expenseDesc').value)
        var amount = sanitizeNumber(document.getElementById('expenseAmount').value)
        var category = document.getElementById('expenseCategory').value
        var paidBy = document.getElementById('expensePaidBy').value
        var splitMethod = document.querySelector('input[name="split"]:checked').value

        if (!desc || !amount || !category || !paidBy) { alert('Please fill all fields'); return }

        var members = await sb.from('members').select('*').eq('group_id', currentGroup)
        var memberNames = members.data.map(function(m) { return m.name })
        var splitData = getSplitData(splitMethod, memberNames, amount)
        if (!splitData) return

        await sb.from('expenses').insert([{ group_id: currentGroup, description: desc, amount, category, paid_by: paidBy, split_method: splitMethod, split_data: splitData }])
        await sb.from('messages').insert([{ group_id: currentGroup, sender: 'System', text: paidBy + ' added: ' + desc + ' - Rs.' + amount.toFixed(2), type: 'system' }])

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
        if (!val) { alert('Enter a valid budget'); return }
        localStorage.setItem('budget_' + currentGroup, val)
        closeModal('setBudgetModal')
        showGroupDetails()
    }

    document.getElementById('removeBudgetBtn').onclick = function() {
        if (!confirm('Remove budget?')) return
        localStorage.removeItem('budget_' + currentGroup)
        closeModal('setBudgetModal')
        showGroupDetails()
    }
}// =====================
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
        html += '<div class="split-bar-track"><div class="split-bar-fill" data-pct="' + pct + '" style="background:' + color + ';width:0%">' + pct.toFixed(0) + '%</div></div>'
        html += '<div class="split-bar-amount">Rs.' + s.amount.toFixed(2) + '</div></div>'
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
    await sb.from('messages').insert([{ group_id: currentGroup, sender: 'You', text: text, type: 'user' }])
    inp.value = ''
    const { data: messages } = await sb.from('messages').select('*').eq('group_id', currentGroup).order('created_at', { ascending: true })
    renderChat(messages || [])
}

// =====================
// LOGOUT + MODAL HELPERS
// =====================
function handleLogout() {
    __authRedirected = true
    sb.auth.signOut().then(function() { window.location.replace('login.html') }).catch(function() { window.location.replace('login.html') })
}

function openModal(id) { document.getElementById(id).classList.add('active') }
function closeModal(id) { document.getElementById(id).classList.remove('active') }

window.openModal = openModal
window.closeModal = closeModal
window.handleLogout = handleLogout
window.navigate = navigate
window.openGroupFromSidebar = openGroupFromSidebar
window.deleteGroupFromPage = deleteGroupFromPage
window.askAssistant = askAssistant

window.onclick = function(e) { if (e.target.classList.contains('modal')) e.target.classList.remove('active') }

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

// =====================
// SETTLEMENT ALGORITHM
// =====================
function computeBalances(members, expenses) {
    var bal = {}
    members.forEach(function(m) { bal[m.name] = 0 })
    expenses.forEach(function(exp) {
        if (bal[exp.paid_by] === undefined) bal[exp.paid_by] = 0
        bal[exp.paid_by] += exp.amount
        var sd = exp.split_data
        if (!exp.split_method || exp.split_method === 'equal') {
            var share = exp.amount / members.length
            members.forEach(function(m) { bal[m.name] -= share })
        } else if (exp.split_method === 'custom' && sd && sd.members) {
            var share = exp.amount / sd.members.length
            sd.members.forEach(function(m) { if (bal[m] !== undefined) bal[m] -= share })
        } else if (exp.split_method === 'percentage' && sd && sd.percentages) {
            Object.keys(sd.percentages).forEach(function(m) {
                if (bal[m] !== undefined) bal[m] -= (exp.amount * sd.percentages[m] / 100)
            })
        } else if (exp.split_method === 'amount' && sd && sd.amounts) {
            Object.keys(sd.amounts).forEach(function(m) {
                if (bal[m] !== undefined) bal[m] -= (parseFloat(sd.amounts[m]) || 0)
            })
        }
    })
    return bal
}

function computeSettlements(balances) {
    var creditors = [], debtors = []
    Object.keys(balances).forEach(function(p) {
        var v = Math.round(balances[p] * 100) / 100
        if (v > 0.01) creditors.push({ name: p, amt: v })
        else if (v < -0.01) debtors.push({ name: p, amt: -v })
    })
    creditors.sort(function(a, b) { return b.amt - a.amt })
    debtors.sort(function(a, b) { return b.amt - a.amt })
    var settlements = [], i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
        var pay = Math.min(debtors[i].amt, creditors[j].amt)
        settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(pay * 100) / 100 })
        debtors[i].amt -= pay
        creditors[j].amt -= pay
        if (debtors[i].amt < 0.01) i++
        if (creditors[j].amt < 0.01) j++
    }
    return settlements
}

function showOptimizedSettlement(members, expenses) {
    var bal = computeBalances(members, expenses)
    var settlements = computeSettlements(bal)
    var html = '<div class="ai-insights-result"><div class="ai-insight-block"><strong>💸 Optimized Settlement Plan</strong>'
    if (settlements.length === 0) {
        html += '<div style="margin-top:8px;">✅ Everyone is already settled up!</div>'
    } else {
        html += '<div style="margin-top:8px;font-size:0.9em;color:#64748b;">⚡ ' + settlements.length + ' transaction' + (settlements.length > 1 ? 's' : '') + ' needed</div>'
        settlements.forEach(function(s) {
            html += '<div style="margin-top:10px;padding:10px;background:#f0f4ff;border-radius:8px;">'
            html += '<strong>' + escapeHtml(s.from) + '</strong> pays <strong>' + escapeHtml(s.to) + '</strong>'
            html += '<span style="color:#ef4444;font-weight:bold;float:right;">Rs.' + s.amount.toFixed(2) + '</span></div>'
        })
    }
    html += '</div></div>'
    document.getElementById('aiInsightsContent').innerHTML = html
    openModal('aiInsightsModal')
}

// =====================
// AI ASSISTANT
// =====================
var assistantContext = { members: [], expenses: [], total: 0, budget: 0 }

function openAIAssistant(members, expenses, total, budget) {
    assistantContext = { members: members, expenses: expenses, total: total, budget: budget }
    var chat = document.getElementById('assistantChat')
    chat.innerHTML = '<div class="assistant-msg bot">Hi! Ask me anything about this group\'s spending.</div>'
    renderAssistantSuggestions()
    openModal('aiAssistantModal')
    document.getElementById('assistantSendBtn').onclick = sendAssistantMessage
    document.getElementById('assistantInput').onkeydown = function(e) {
        if (e.key === 'Enter') sendAssistantMessage()
    }
}

function renderAssistantSuggestions() {
    var suggestions = [
        "How much did we spend in total?",
        "What's our top category?",
        "Who paid the most?",
        "Am I over budget?",
        "What's the average expense?",
        "How much does each person owe?"
    ]
    document.getElementById('assistantSuggestions').innerHTML = suggestions.map(function(s) {
        return '<button class="assistant-chip" onclick="askAssistant(\'' + s.replace(/'/g, "\\'") + '\')">' + s + '</button>'
    }).join('')
}

function askAssistant(q) {
    document.getElementById('assistantInput').value = q
    sendAssistantMessage()
}

function sendAssistantMessage() {
    var inp = document.getElementById('assistantInput')
    var q = inp.value.trim()
    if (!q) return
    var chat = document.getElementById('assistantChat')
    chat.innerHTML += '<div class="assistant-msg user">' + escapeHtml(q) + '</div>'
    inp.value = ''
    chat.scrollTop = chat.scrollHeight
    setTimeout(function() {
        var answer = generateAssistantAnswer(q, assistantContext)
        chat.innerHTML += '<div class="assistant-msg bot">' + answer + '</div>'
        chat.scrollTop = chat.scrollHeight
    }, 300)
}

function generateAssistantAnswer(question, ctx) {
    var q = question.toLowerCase()
    var members = ctx.members, expenses = ctx.expenses, total = ctx.total, budget = ctx.budget
    if (expenses.length === 0) return "No expenses in this group yet."

    if (q.indexOf('total') !== -1 || q.indexOf('how much') !== -1) {
        return '💰 Total spent: <strong>Rs.' + total.toFixed(2) + '</strong> across ' + expenses.length + ' expenses.'
    }
    if (q.indexOf('category') !== -1) {
        var cats = {}
        expenses.forEach(function(e) { var c = e.category || 'Other'; cats[c] = (cats[c] || 0) + e.amount })
        var sorted = Object.keys(cats).map(function(k) { return [k, cats[k]] }).sort(function(a, b) { return b[1] - a[1] })
        return '📊 Top category: <strong>' + escapeHtml(sorted[0][0]) + '</strong> — Rs.' + sorted[0][1].toFixed(2)
    }
    if (q.indexOf('paid') !== -1 || q.indexOf('payer') !== -1) {
        var payers = {}
        expenses.forEach(function(e) { payers[e.paid_by] = (payers[e.paid_by] || 0) + e.amount })
        var top = Object.keys(payers).sort(function(a, b) { return payers[b] - payers[a] })[0]
        return '💳 <strong>' + escapeHtml(top) + '</strong> paid most: Rs.' + payers[top].toFixed(2)
    }
    if (q.indexOf('budget') !== -1) {
        if (budget <= 0) return "🎯 No budget set."
        var pct = (total / budget) * 100
        return '✅ Budget: Rs.' + total.toFixed(2) + ' / Rs.' + budget.toFixed(2) + ' (' + pct.toFixed(1) + '%)'
    }
    if (q.indexOf('average') !== -1 || q.indexOf('avg') !== -1) {
        return '📈 Average: <strong>Rs.' + (total / expenses.length).toFixed(2) + '</strong>'
    }
    if (q.indexOf('owe') !== -1 || q.indexOf('who') !== -1) {
        var settlements = computeSettlements(computeBalances(members, expenses))
        if (settlements.length === 0) return "✅ Everyone is settled up!"
        return "💸 Settlement:<br>" + settlements.map(function(s) {
            return '• ' + escapeHtml(s.from) + ' → ' + escapeHtml(s.to) + ': Rs.' + s.amount.toFixed(2)
        }).join('<br>')
    }
    return "🤔 I didn't understand. Try asking about total, category, top payer, budget, average, or settlement."
}

// =====================
// RECEIPT SCANNER
// =====================
var lastReceipt = null

function openReceiptScanner() {
    document.getElementById('receiptFile').value = ''
    document.getElementById('receiptPreview').innerHTML = ''
    document.getElementById('receiptResult').innerHTML = ''
    document.getElementById('receiptProgress').style.display = 'none'
    document.getElementById('receiptUseBtn').style.display = 'none'
    openModal('receiptModal')
    document.getElementById('receiptFile').onchange = handleReceiptUpload
    document.getElementById('receiptUseBtn').onclick = useReceiptValues
}

async function handleReceiptUpload(e) {
    var file = e.target.files[0]
    if (!file) return
    document.getElementById('receiptPreview').innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="max-width:100%;border-radius:8px;max-height:200px;">'
    document.getElementById('receiptProgress').style.display = 'block'
    document.getElementById('receiptProgressText').textContent = 'Reading image...'
    document.getElementById('receiptResult').innerHTML = ''
    try {
        var result = await Tesseract.recognize(file, 'eng', {
            logger: function(m) {
                if (m.status === 'recognizing text') {
                    document.getElementById('receiptProgressText').textContent = 'Recognizing... ' + Math.round(m.progress * 100) + '%'
                }
            }
        })
        lastReceipt = parseReceiptText(result.data.text)
        renderReceiptResult(lastReceipt)
    } catch (err) {
        document.getElementById('receiptResult').innerHTML = '<div class="ai-error">❌ Error: ' + escapeHtml(err.message) + '</div>'
    } finally {
        document.getElementById('receiptProgress').style.display = 'none'
    }
}

function parseReceiptText(text) {
    var lines = text.split('\n').map(function(l) { return l.trim() }).filter(Boolean)
    var fullText = lines.join(' ')
    var amount = 0
    var totalKeywords = /total|grand total|amount due|net amount|balance/i
    lines.forEach(function(line) {
        if (totalKeywords.test(line)) {
            var nums = line.match(/[\d,]+\.?\d*/g)
            if (nums) {
                var n = parseFloat(nums[nums.length - 1].replace(/,/g, ''))
                if (n > amount) amount = n
            }
        }
    })
    if (!amount) {
        var allNums = fullText.match(/[\d,]+\.\d{2}|\d{3,}/g) || []
        allNums.forEach(function(s) {
            var n = parseFloat(s.replace(/,/g, ''))
            if (n > amount && n < 10000000) amount = n
        })
    }
    var merchant = ''
    for (var i = 0; i < Math.min(5, lines.length); i++) {
        if (lines[i].length > 2 && !/^\d+$/.test(lines[i]) && !/receipt|invoice|bill/i.test(lines[i])) {
            merchant = lines[i].slice(0, 60)
            break
        }
    }
    var lower = fullText.toLowerCase()
    var category = '📌 Other'
    if (/restaurant|cafe|food|pizza|burger|dinner|lunch|swiggy|zomato/.test(lower)) category = '🍔 Food'
    else if (/uber|ola|taxi|flight|train|petrol|fuel|travel/.test(lower)) category = '✈️ Travel'
    else if (/mall|store|shop|amazon|flipkart|mart/.test(lower)) category = '🛒 Shopping'
    else if (/movie|cinema|netflix|spotify|game/.test(lower)) category = '🎬 Entertainment'
    else if (/electric|water|gas|bill|recharge|wifi/.test(lower)) category = '💡 Bills'
    return {
        merchant: merchant || 'Unknown Merchant',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        category: category
    }
}

function renderReceiptResult(r) {
    document.getElementById('receiptUseBtn').style.display = 'block'
    document.getElementById('receiptResult').innerHTML =
        '<div class="ai-insight-block"><strong>📄 Extracted Data</strong>' +
        '<div style="margin-top:8px;font-size:0.92em;line-height:1.8;">' +
        '<div>🏪 <strong>Merchant:</strong> ' + escapeHtml(r.merchant) + '</div>' +
        '<div>💰 <strong>Amount:</strong> Rs.' + r.amount.toFixed(2) + '</div>' +
        '<div>🏷️ <strong>Category:</strong> ' + escapeHtml(r.category) + '</div>' +
        '</div></div>'
}

function useReceiptValues() {
    if (!lastReceipt) return
    document.getElementById('expenseDesc').value = lastReceipt.merchant
    document.getElementById('expenseAmount').value = lastReceipt.amount.toFixed(2)
    var sel = document.getElementById('expenseCategory')
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === lastReceipt.category) { sel.value = sel.options[i].value; break }
    }
    closeModal('receiptModal')
}

// =====================
// ANALYTICS MODAL
// =====================
var analyticsCharts = []

function openAnalyticsModal(members, expenses) {
    var container = document.getElementById('analyticsContent')
    if (expenses.length === 0) {
        container.innerHTML = '<div class="ai-error">📭 No expenses to analyze yet.</div>'
        openModal('analyticsModal')
        return
    }
    var categories = {}
    expenses.forEach(function(e) { var c = e.category || '📌 Other'; categories[c] = (categories[c] || 0) + e.amount })

    var monthly = {}
    expenses.forEach(function(e) {
        var d = new Date(e.created_at)
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        monthly[key] = (monthly[key] || 0) + e.amount
    })
    var months = Object.keys(monthly).sort()
    var monthLabels = months.map(function(m) {
        var parts = m.split('-')
        return new Date(parts[0], parts[1] - 1).toLocaleString('en', { month: 'short', year: '2-digit' })
    })
    var monthValues = months.map(function(m) { return monthly[m] })

    var total = expenses.reduce(function(s, e) { return s + e.amount }, 0)
    var avg = total / expenses.length
    var forecast = linearForecast(monthValues)
    var avgMonthly = monthValues.length > 0 ? monthValues.reduce(function(a, b) { return a + b }, 0) / monthValues.length : 0
    var trendPct = avgMonthly > 0 ? ((forecast - avgMonthly) / avgMonthly) * 100 : 0
    var topCat = Object.keys(categories).sort(function(a, b) { return categories[b] - categories[a] })[0] || '—'

    var trendBadge = trendPct > 5 ? '<span class="fh-badge">📈 +' + trendPct.toFixed(1) + '%</span>'
        : trendPct < -5 ? '<span class="fh-badge">📉 ' + trendPct.toFixed(1) + '%</span>'
        : '<span class="fh-badge">➖ Stable</span>'

    container.innerHTML =
        '<div class="analytics-wrap">' +
        '<div class="analytics-kpis">' +
        '<div class="analytics-kpi grad-indigo"><div class="kpi-label">Total Spent</div><div class="kpi-value">Rs.' + total.toFixed(0) + '</div><div class="kpi-sub">' + expenses.length + ' expenses</div></div>' +
        '<div class="analytics-kpi grad-green"><div class="kpi-label">Average</div><div class="kpi-value">Rs.' + avg.toFixed(0) + '</div><div class="kpi-sub">per expense</div></div>' +
        '<div class="analytics-kpi grad-orange"><div class="kpi-label">Top Category</div><div class="kpi-value" style="font-size:1.15em;">' + escapeHtml(topCat) + '</div><div class="kpi-sub">Rs.' + (categories[topCat] || 0).toFixed(0) + '</div></div>' +
        '<div class="analytics-kpi grad-cyan"><div class="kpi-label">Months</div><div class="kpi-value">' + monthValues.length + '</div><div class="kpi-sub">Rs.' + avgMonthly.toFixed(0) + '/mo avg</div></div>' +
        '</div>' +
        '<div class="forecast-hero"><div class="fh-label">🔮 Next Month Forecast</div><div class="fh-value">Rs.' + forecast.toFixed(2) + '</div><div class="fh-sub">' + trendBadge + '<span>' + (monthValues.length < 2 ? 'Need 2+ months' : 'Based on ' + monthValues.length + ' months') + '</span></div></div>' +
        '<div class="analytics-charts">' +
        '<div class="analytics-card"><h4><span class="dot"></span> Category Breakdown</h4><canvas id="categoryChart" height="220"></canvas></div>' +
        '<div class="analytics-card"><h4><span class="dot green"></span> Monthly Trend</h4><canvas id="trendChart" height="220"></canvas></div>' +
        '</div></div>'

    openModal('analyticsModal')
    analyticsCharts.forEach(function(c) { c.destroy() })
    analyticsCharts = []

    setTimeout(function() {
        var catCtx = document.getElementById('categoryChart')
        if (catCtx) {
            analyticsCharts.push(new Chart(catCtx, {
                type: 'doughnut',
                data: { labels: Object.keys(categories), datasets: [{ data: Object.keys(categories).map(function(k) { return categories[k] }), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }] },
                options: { cutout: '62%', plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } } } }
            }))
        }
        var trendCtx = document.getElementById('trendChart')
        if (trendCtx) {
            var labels = monthLabels.concat(['Next*'])
            var data = monthValues.concat([forecast])
            var gradient = trendCtx.getContext('2d').createLinearGradient(0, 0, 0, 220)
            gradient.addColorStop(0, 'rgba(99,102,241,0.35)')
            gradient.addColorStop(1, 'rgba(99,102,241,0)')
            analyticsCharts.push(new Chart(trendCtx, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: 'Spend', data: data, borderColor: '#6366f1', backgroundColor: gradient, fill: true, tension: 0.4, borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#6366f1', pointBorderWidth: 2, pointRadius: 5 }] },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.15)' } } } }
            }))
        }
    }, 100)
}

function linearForecast(values) {
    if (values.length === 0) return 0
    if (values.length === 1) return values[0]
    var n = values.length
    var xSum = (n * (n - 1)) / 2
    var ySum = values.reduce(function(a, b) { return a + b }, 0)
    var xySum = values.reduce(function(s, y, x) { return s + x * y }, 0)
    var x2Sum = (n * (n - 1) * (2 * n - 1)) / 6
    var denom = (n * x2Sum - xSum * xSum)
    if (denom === 0) return ySum / n
    var slope = (n * xySum - xSum * ySum) / denom
    var intercept = (ySum - slope * xSum) / n
    return Math.max(slope * n + intercept, 0)
}