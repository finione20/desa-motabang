// ── STATE ──
let sidebarOpen = true;
let isTyping = false;
let chatStarted = false;

// ── AI RESPONSES (demo) ──
const responses = {
  default: [
    `Baik, saya akan membantu Anda. Mohon berikan informasi yang diperlukan:\n\n• **Nama lengkap** warga\n• **NIK** (Nomor Induk Kependudukan)\n• **Alamat lengkap**\n• **Keperluan** surat\n\nSaya akan memproses dan menyiapkan dokumennya. ✅`,
    `Tentu! Untuk membuat surat tersebut, saya membutuhkan beberapa data:\n\n• Nama dan NIK pemohon\n• Tujuan/keperluan surat\n• Nama kepala desa\n• Tanggal yang diinginkan\n\nSilakan lengkapi data di atas untuk saya proses. 📋`,
    `Permintaan Anda sudah saya terima. Surat akan saya siapkan berdasarkan template resmi yang berlaku di lingkungan pemerintahan desa.\n\nApakah ada data tambahan yang perlu dilengkapi?`,
  ],
  surat: `Saya bisa membantu membuat berbagai jenis surat desa, antara lain:\n\n• 📄 **Surat Keterangan Domisili**\n• 📄 **Surat Keterangan Tidak Mampu**\n• 📄 **Surat Pengantar SKCK**\n• 📄 **Surat Keterangan Usaha**\n• 📄 **Surat Keterangan Lahir/Meninggal**\n• 📄 **Surat Izin Keramaian**\n\nSilakan sebutkan jenis surat yang dibutuhkan! 🏡`,
  domisili: `Baik, saya akan membuat **Surat Keterangan Domisili**.\n\nMohon lengkapi data berikut:\n\n1. Nama lengkap sesuai KTP\n2. NIK\n3. Tempat & tanggal lahir\n4. Alamat lengkap RT/RW, Dusun, Desa\n5. Keperluan surat (contoh: membuka rekening, melamar kerja)\n\nData ini diperlukan agar surat sah secara administrasi. ✅`,
  bantuan: `Halo! Saya **DesAi**, asisten AI yang dirancang khusus untuk membantu administrasi desa.\n\nSaya bisa membantu:\n\n• 📝 Membuat surat-surat resmi desa\n• 📋 Menjawab pertanyaan regulasi pemerintahan\n• 👥 Informasi prosedur kependudukan\n• 📊 Menyusun laporan dan pengumuman desa\n\nAda yang ingin Anda tanyakan? 😊`,
};

function getReply(text) {
  const t = text.toLowerCase();
  if (t.includes('domisili')) return responses.domisili;
  if (t.includes('surat')) return responses.surat;
  if (t.includes('halo') || t.includes('hai') || t.includes('help') || t.includes('bantu'))
    return responses.bantuan;
  const arr = responses.default;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── SIDEBAR TOGGLE ──
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sidebarOpen = !sidebarOpen;
  sb.classList.toggle('collapsed', !sidebarOpen);
}

// ── NEW CHAT ──
function newChat() {
  chatStarted = false;
  document.getElementById('welcomeScreen').style.display = 'flex';
  document.getElementById('messagesContainer').innerHTML = '';
  document.getElementById('chatInput').value = '';
  adjustTextarea();
  // Mark all nav items inactive
  document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active-hist'));
}

// ── SUGGESTION CLICK ──
function useSuggestion(text) {
  document.getElementById('chatInput').value = text;
  adjustTextarea();
  sendMessage();
}

// ── SEND MESSAGE ──
function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isTyping) return;

  // Hide welcome screen on first message
  if (!chatStarted) {
    document.getElementById('welcomeScreen').style.display = 'none';
    chatStarted = true;
  }

  appendMessage('user', text);
  input.value = '';
  adjustTextarea();

  // Show typing
  isTyping = true;
  showTyping();
  document.getElementById('sendBtn').disabled = true;

  const delay = 800 + Math.random() * 700;
  setTimeout(() => {
    hideTyping();
    appendMessage('ai', getReply(text));
    isTyping = false;
    document.getElementById('sendBtn').disabled = false;
  }, delay);
}

// ── APPEND MESSAGE ──
function appendMessage(role, text) {
  const container = document.getElementById('messagesContainer');
  const row = document.createElement('div');
  row.className = 'message-row';

  const isAI = role === 'ai';
  const formatted = formatText(text);

  row.innerHTML = `
    <div class="msg-avatar ${isAI ? 'ai-av' : 'user-av'}">
      ${isAI ? '🤖' : '👤'}
    </div>
    <div class="msg-content">
      <div class="msg-name ${isAI ? 'ai-name' : ''}">${isAI ? 'DesAi' : 'Anda'}</div>
      <div class="msg-text">${formatted}</div>
      ${isAI ? `<div class="msg-actions">
        <button class="msg-action-btn" onclick="copyText(this)">📋 Salin</button>
        <button class="msg-action-btn">👍</button>
        <button class="msg-action-btn">👎</button>
      </div>` : ''}
    </div>`;

  container.appendChild(row);
  scrollToBottom();
}

// ── FORMAT TEXT ──
function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .split('\n\n').map(p => p.startsWith('<ul>') || p.startsWith('<li>') ? p : `<p>${p}</p>`).join('');
}

// ── COPY TEXT ──
function copyText(btn) {
  const text = btn.closest('.msg-content').querySelector('.msg-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Disalin';
    setTimeout(() => btn.textContent = '📋 Salin', 2000);
  });
}

// ── TYPING INDICATOR ──
function showTyping() {
  const container = document.getElementById('messagesContainer');
  const row = document.createElement('div');
  row.className = 'typing-row'; row.id = 'typingRow';
  row.innerHTML = `
    <div class="msg-avatar ai-av">🤖</div>
    <div class="msg-content">
      <div class="msg-name ai-name">DesAi</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  container.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typingRow');
  if (el) el.remove();
}

// ── SCROLL ──
function scrollToBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}

// ── TEXTAREA AUTO-RESIZE ──
function adjustTextarea() {
  const ta = document.getElementById('chatInput');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
}

// ── ENTER TO SEND ──
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('chatInput').addEventListener('input', adjustTextarea);
  document.getElementById('chatInput').addEventListener('keydown', handleKeyDown);
});