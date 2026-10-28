const STORAGE_KEY = 'ticketsystem_tickets';
const ADMIN_USERNAME = 'admin@it.local';
const ADMIN_PASSWORD = 'admin123';

const defaultTickets = [
  {
    id: 1,
    ticketNumber: 'IT-1001',
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
    category: 'Software',
    priority: 'High',
    subject: 'Laptop login issue',
    description: 'I cannot sign in to my work laptop after the last password reset.',
    status: 'Open',
    createdAt: '2026-10-01 09:42',
    messages: [
      {
        sender: 'user',
        senderName: 'Jane Smith',
        senderEmail: 'jane@example.com',
        message: 'I cannot sign in to my work laptop after the last password reset.',
        createdAt: '2026-10-01 09:42'
      }
    ]
  },
  {
    id: 2,
    ticketNumber: 'IT-1002',
    userName: 'Mark Lee',
    userEmail: 'mark@example.com',
    category: 'Hardware',
    priority: 'Medium',
    subject: 'Printer not responding',
    description: 'The office printer keeps going offline and not printing.',
    status: 'Awaiting IT Response',
    createdAt: '2026-10-02 11:20',
    messages: [
      {
        sender: 'user',
        senderName: 'Mark Lee',
        senderEmail: 'mark@example.com',
        message: 'The office printer keeps going offline and not printing.',
        createdAt: '2026-10-02 11:20'
      },
      {
        sender: 'admin',
        senderName: 'IT Admin',
        senderEmail: 'admin@it.local',
        message: 'Please restart the printer queue and confirm the network cable is connected.',
        createdAt: '2026-10-02 11:40'
      }
    ]
  }
];

const state = {
  tickets: loadTickets(),
  adminLoggedIn: false
};

const els = {
  ticketForm: document.getElementById('ticketForm'),
  ticketSearchForm: document.getElementById('ticketSearchForm'),
  searchTicketNumber: document.getElementById('searchTicketNumber'),
  publicTicketView: document.getElementById('publicTicketView'),
  createdTicketNumber: document.getElementById('createdTicketNumber'),
  createdTicketStatus: document.getElementById('createdTicketStatus'),
  createdTicketMessage: document.getElementById('createdTicketMessage'),
  ticketDetailView: document.getElementById('ticketDetailView'),
  detailTicketNumber: document.getElementById('detailTicketNumber'),
  detailStatus: document.getElementById('detailStatus'),
  detailCustomerName: document.getElementById('detailCustomerName'),
  detailCustomerEmail: document.getElementById('detailCustomerEmail'),
  detailCategory: document.getElementById('detailCategory'),
  detailPriority: document.getElementById('detailPriority'),
  detailSubject: document.getElementById('detailSubject'),
  detailDescription: document.getElementById('detailDescription'),
  ticketConversation: document.getElementById('ticketConversation'),
  userReplyForm: document.getElementById('userReplyForm'),
  replyName: document.getElementById('replyName'),
  replyEmail: document.getElementById('replyEmail'),
  replyMessage: document.getElementById('replyMessage'),
  adminPanel: document.getElementById('adminPanel'),
  openAdminBtn: document.getElementById('openAdminBtn'),
  adminLoginView: document.getElementById('adminLoginView'),
  adminDashboardView: document.getElementById('adminDashboardView'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  logoutAdminBtn: document.getElementById('logoutAdminBtn'),
  statusFilter: document.getElementById('statusFilter'),
  adminTicketTable: document.getElementById('adminTicketTable')
};

function loadTickets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    console.warn('Could not parse saved tickets', e);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTickets));
  return defaultTickets;
}

function saveTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tickets));
}

function generateTicketNumber() {
  const numbers = state.tickets.map((ticket) => Number(String(ticket.ticketNumber).replace(/\D/g, '')) || 0);
  const next = numbers.length ? Math.max(...numbers) + 1 : 1001;
  return `IT-${next}`;
}

function formatStatusClass(status) {
  const normalized = (status || 'Open').toLowerCase().replace(/\s+/g, '-');
  return normalized;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hideTicketViews() {
  els.publicTicketView.classList.add('hidden');
  els.ticketDetailView.classList.add('hidden');
}

function showTicketDetail(ticket) {
  hideTicketViews();
  els.ticketDetailView.classList.remove('hidden');
  els.detailTicketNumber.textContent = ticket.ticketNumber;
  els.detailStatus.textContent = ticket.status;
  els.detailStatus.className = `status-badge ${formatStatusClass(ticket.status)}`;
  els.detailCustomerName.textContent = ticket.userName;
  els.detailCustomerEmail.textContent = ticket.userEmail;
  els.detailCategory.textContent = ticket.category;
  els.detailPriority.textContent = ticket.priority;
  els.detailSubject.textContent = ticket.subject;
  els.detailDescription.textContent = ticket.description;
  els.replyName.value = ticket.userName;
  els.replyEmail.value = ticket.userEmail;
  els.replyMessage.value = '';
  renderConversation(ticket.messages || []);
}

function renderConversation(messages) {
  if (!messages || !messages.length) {
    els.ticketConversation.innerHTML = '<p>No messages yet.</p>';
    return;
  }

  els.ticketConversation.innerHTML = messages
    .map((message) => `
      <div class="conversation-item ${message.sender}">
        <div class="conversation-meta">
          <strong>${escapeHtml(message.senderName)}</strong>
          <span>${escapeHtml(message.createdAt)}</span>
        </div>
        <div>${escapeHtml(message.message)}</div>
      </div>
    `)
    .join('');
}

function renderAdminDashboard() {
  const filter = els.statusFilter.value;
  const tickets = filter === 'all'
    ? [...state.tickets]
    : state.tickets.filter((ticket) => ticket.status === filter);

  if (!tickets.length) {
    els.adminTicketTable.innerHTML = '<div class="ticket-row"><div>No tickets match this filter.</div></div>';
    return;
  }

  els.adminTicketTable.innerHTML = tickets
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((ticket) => `
      <div class="ticket-row">
        <div><strong>${escapeHtml(ticket.ticketNumber)}</strong></div>
        <div>${escapeHtml(ticket.subject)}</div>
        <div>${escapeHtml(ticket.userName)}</div>
        <div>${escapeHtml(ticket.priority)}</div>
        <div><span class="status-badge ${formatStatusClass(ticket.status)}">${escapeHtml(ticket.status)}</span></div>
        <button type="button" class="secondary-btn" data-ticket-number="${escapeHtml(ticket.ticketNumber)}">Open</button>
      </div>
    `)
    .join('');

  document.querySelectorAll('[data-ticket-number]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = state.tickets.find((ticket) => ticket.ticketNumber === button.dataset.ticketNumber);
      if (selected) {
        showTicketDetail(selected);
        showAdminReplyControls(selected);
      }
    });
  });
}

function showAdminReplyControls(ticket) {
  const existing = document.querySelector('.admin-reply-box');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'reply-box admin-reply-box';
  wrapper.innerHTML = `
    <h3>Admin reply</h3>
    <div class="two-col">
      <div class="field">
        <label for="adminStatus">Status</label>
        <select id="adminStatus">
          <option ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
          <option ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option ${ticket.status === 'Awaiting IT Response' ? 'selected' : ''}>Awaiting IT Response</option>
          <option ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </div>
      <div class="field">
        <label for="adminPriority">Priority</label>
        <select id="adminPriority">
          <option ${ticket.priority === 'Low' ? 'selected' : ''}>Low</option>
          <option ${ticket.priority === 'Medium' ? 'selected' : ''}>Medium</option>
          <option ${ticket.priority === 'High' ? 'selected' : ''}>High</option>
          <option ${ticket.priority === 'Critical' ? 'selected' : ''}>Critical</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label for="adminMessage">IT response</label>
      <textarea id="adminMessage" rows="5" placeholder="Reply to customer here..."></textarea>
    </div>
    <button type="button" class="primary-btn" id="sendAdminReplyBtn">Send reply</button>
  `;

  els.ticketDetailView.appendChild(wrapper);

  document.getElementById('sendAdminReplyBtn').addEventListener('click', () => {
    const selectedStatus = document.getElementById('adminStatus').value;
    const selectedPriority = document.getElementById('adminPriority').value;
    const adminMessage = document.getElementById('adminMessage').value.trim();

    const found = state.tickets.find((item) => item.ticketNumber === ticket.ticketNumber);
    if (!found) return;

    found.status = selectedStatus;
    found.priority = selectedPriority;
    if (adminMessage) {
      found.messages.push({
        sender: 'admin',
        senderName: 'IT Admin',
        senderEmail: ADMIN_USERNAME,
        message: adminMessage,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      });
    }

    saveTickets();
    renderAdminDashboard();
    showTicketDetail(found);
    alert(`Reply sent to ${found.userEmail}.`);
  });
}

function toggleAdminPanel(show) {
  els.adminPanel.classList.toggle('hidden', !show);
  if (show) {
    els.adminLoginView.classList.toggle('hidden', state.adminLoggedIn);
    els.adminDashboardView.classList.toggle('hidden', !state.adminLoggedIn);
    if (state.adminLoggedIn) renderAdminDashboard();
  }
}

function handleTicketSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const ticket = {
    id: Date.now(),
    ticketNumber: generateTicketNumber(),
    userName: formData.get('userName').trim(),
    userEmail: formData.get('userEmail').trim(),
    category: formData.get('category'),
    priority: formData.get('priority'),
    subject: formData.get('subject').trim(),
    description: formData.get('description').trim(),
    status: 'Open',
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    messages: [
      {
        sender: 'user',
        senderName: formData.get('userName').trim(),
        senderEmail: formData.get('userEmail').trim(),
        message: formData.get('description').trim(),
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      }
    ]
  };

  state.tickets.push(ticket);
  saveTickets();

  els.createdTicketNumber.textContent = ticket.ticketNumber;
  els.createdTicketStatus.textContent = ticket.status;
  els.createdTicketStatus.className = `status-badge ${formatStatusClass(ticket.status)}`;
  els.createdTicketMessage.textContent = `Ticket created successfully. Your ticket number is ${ticket.ticketNumber}. The IT team will reply to ${ticket.userEmail}.`;

  els.publicTicketView.classList.remove('hidden');
  els.ticketDetailView.classList.add('hidden');
  event.target.reset();
}

function handleSearch(event) {
  event.preventDefault();
  const searched = els.searchTicketNumber.value.trim();
  if (!searched) {
    alert('Please enter a ticket number.');
    return;
  }

  const found = state.tickets.find((ticket) => ticket.ticketNumber.toUpperCase() === searched.toUpperCase());
  if (!found) {
    alert('Ticket not found. Please check the number and try again.');
    return;
  }

  showTicketDetail(found);
}

function handleUserReply(event) {
  event.preventDefault();
  const ticketNumber = els.detailTicketNumber.textContent.trim();
  const ticket = state.tickets.find((item) => item.ticketNumber === ticketNumber);
  if (!ticket) return;

  const messageText = els.replyMessage.value.trim();
  const name = els.replyName.value.trim();
  const email = els.replyEmail.value.trim();

  if (!messageText || !name || !email) {
    alert('Please complete all reply fields.');
    return;
  }

  if (email.toLowerCase() !== ticket.userEmail.toLowerCase()) {
    alert('Please use the email address used when the ticket was created.');
    return;
  }

  ticket.messages.push({
    sender: 'user',
    senderName: name,
    senderEmail: email,
    message: messageText,
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
  });
  ticket.status = 'Awaiting IT Response';
  saveTickets();
  renderAdminDashboard();
  showTicketDetail(ticket);
  alert('Your message has been sent to the IT team.');
}

function handleAdminLogin(event) {
  event.preventDefault();
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    state.adminLoggedIn = true;
    toggleAdminPanel(true);
    renderAdminDashboard();
  } else {
    alert('Invalid admin login. Use the default admin email and password.');
  }
}

function handleAdminLogout() {
  state.adminLoggedIn = false;
  document.getElementById('adminLoginForm').reset();
  toggleAdminPanel(false);
}

function initialize() {
  if (!els.ticketForm || !els.ticketSearchForm || !els.adminPanel) {
    return;
  }

  els.ticketForm.addEventListener('submit', handleTicketSubmit);
  els.ticketSearchForm.addEventListener('submit', handleSearch);
  els.userReplyForm.addEventListener('submit', handleUserReply);
  els.openAdminBtn.addEventListener('click', () => toggleAdminPanel(true));
  els.adminLoginForm.addEventListener('submit', handleAdminLogin);
  els.logoutAdminBtn.addEventListener('click', handleAdminLogout);
  els.statusFilter.addEventListener('change', renderAdminDashboard);

  hideTicketViews();
  toggleAdminPanel(false);
  renderAdminDashboard();
}

initialize();
