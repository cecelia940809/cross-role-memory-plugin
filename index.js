// ============================================
// 跨端同步库调取插件 - SillyTavern 正规扩展版
// 装法见仓库 README，需要通过"扩展 -> 安装扩展"粘贴仓库地址来装
// ============================================

(function () {
  var D = document;

  // ===== 常量 =====
  var IDX_KEY = 'ccm_index';
  var SNAP_PREFIX = 'ccm_snap_';
  var NAME_KEY = 'ccm_my_name';
  var GH_TOKEN_KEY = 'ccm_gh_token';
  var GH_REPO_KEY = 'ccm_gh_repo';
  var GH_BRANCH_KEY = 'ccm_gh_branch';
  var GH_DATA_DIR = 'ccm-data';
  var MAX_SNAPS = 100;
  var MAX_MSG_PER_SNAP = 40;
  var LS_PREFIX = 'ccm_st_';
  var SEP = '◈';

  var cache = {};
  function val(k, fb) { return (cache[k] !== undefined && cache[k] !== null) ? cache[k] : fb; }
  async function pullG(k) { try { var raw = localStorage.getItem(LS_PREFIX + 'g_' + k); if (raw === null) return undefined; try { return JSON.parse(raw); } catch (e) { return raw; } } catch (e) { return undefined; } }
  async function pushG(k, v) { cache[k] = v; try { localStorage.setItem(LS_PREFIX + 'g_' + k, JSON.stringify(v)); } catch (e) { } }
  async function removeG(k) { try { localStorage.removeItem(LS_PREFIX + 'g_' + k); } catch (e) { } }
  async function pullC(k) { try { var raw = localStorage.getItem(LS_PREFIX + 'c_' + k); if (raw === null) return undefined; try { return JSON.parse(raw); } catch (e) { return raw; } } catch (e) { return undefined; } }
  async function pushC(k, v) { cache[k] = v; try { localStorage.setItem(LS_PREFIX + 'c_' + k, JSON.stringify(v)); } catch (e) { } }

  function idx() { var l = val(IDX_KEY, null); if (!Array.isArray(l)) { l = []; cache[IDX_KEY] = l; } return l; }
  function myName() { return val(NAME_KEY, ''); }
  function ghToken() { return val(GH_TOKEN_KEY, ''); }
  function ghRepo() { return val(GH_REPO_KEY, ''); }
  function ghBranch() { return val(GH_BRANCH_KEY, '') || 'main'; }
  function cloudConfigured() { return !!(ghToken() && ghRepo()); }

  async function loadAll() {
    var i = await pullG(IDX_KEY); cache[IDX_KEY] = Array.isArray(i) ? i : [];
    var n = await pullC(NAME_KEY); cache[NAME_KEY] = (typeof n === 'string') ? n : '';
    var gt = await pullG(GH_TOKEN_KEY); cache[GH_TOKEN_KEY] = (typeof gt === 'string') ? gt : '';
    var gr = await pullG(GH_REPO_KEY); cache[GH_REPO_KEY] = (typeof gr === 'string') ? gr : '';
    var gb = await pullG(GH_BRANCH_KEY); cache[GH_BRANCH_KEY] = (typeof gb === 'string') ? gb : '';
  }

  // ===== 云端同步：改用 GitHub 仓库当存储后端，和 Tavo 版共用同一个仓库即可互通 =====
  function fetchTO(url, opts, ms) {
    ms = ms || 8000;
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('请求超时')); } }, ms);
      fetch(url, opts).then(function (r) { if (!done) { done = true; clearTimeout(timer); resolve(r); } })
        .catch(function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
  }

  function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64decode(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }

  function ghHeaders() {
    return {
      'Authorization': 'token ' + ghToken(),
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }
  function ghUrl(path) { return 'https://api.github.com/repos/' + ghRepo() + '/contents/' + path; }

  async function ghGetFile(path) {
    var resp = await fetchTO(ghUrl(path) + '?ref=' + encodeURIComponent(ghBranch()), { headers: ghHeaders() });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error('GitHub 读取失败：' + resp.status);
    var data = await resp.json();
    return { content: b64decode(data.content), sha: data.sha };
  }

  async function ghPutFile(path, content, sha, message) {
    var body = { message: message || ('update ' + path), content: b64encode(content), branch: ghBranch() };
    if (sha) body.sha = sha;
    var resp = await fetchTO(ghUrl(path), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
    if (resp.status === 409 && sha) {
      var latest = await ghGetFile(path);
      if (latest) {
        body.sha = latest.sha;
        resp = await fetchTO(ghUrl(path), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
      }
    }
    if (!resp.ok) throw new Error('GitHub 写入失败：' + resp.status);
    var data = await resp.json();
    return data.content ? data.content.sha : undefined;
  }

  async function ghDeleteFile(path, sha, message) {
    var resp = await fetchTO(ghUrl(path), {
      method: 'DELETE', headers: ghHeaders(),
      body: JSON.stringify({ message: message || ('delete ' + path), sha: sha, branch: ghBranch() })
    });
    return resp.ok;
  }

  var PLATFORM = 'st';
  function convPath(platform, id){ return GH_DATA_DIR + '/' + platform + '/conversations/snap_' + id + '.json'; }

  async function cloudSave(meta, messages) {
    if (!cloudConfigured()) return false;
    try {
      var snapPath = convPath(PLATFORM, meta.id);
      var payload = JSON.stringify({ meta: { id: meta.id, charName: meta.charName, savedAt: meta.savedAt, msgCount: meta.msgCount, note: meta.note || '', platform: PLATFORM }, messages: messages });
      var existingSnap = null;
      try { existingSnap = await ghGetFile(snapPath); } catch (e) { }
      await ghPutFile(snapPath, payload, existingSnap ? existingSnap.sha : undefined, '保存对话快照 ' + meta.id);

      var idxPath = GH_DATA_DIR + '/index.json';
      var existing = null;
      try { existing = await ghGetFile(idxPath); } catch (e) { }
      var list = [];
      if (existing) { try { list = JSON.parse(existing.content); if (!Array.isArray(list)) list = []; } catch (e) { list = []; } }
      var pos = list.findIndex(function (it) { return it.id === meta.id; });
      var entry = { id: meta.id, charName: meta.charName, savedAt: meta.savedAt, msgCount: meta.msgCount, note: meta.note || '', platform: PLATFORM };
      if (pos !== -1) { list[pos] = entry; } else { list.unshift(entry); }
      if (list.length > 200) list = list.slice(0, 200);
      await ghPutFile(idxPath, JSON.stringify(list), existing ? existing.sha : undefined, '更新索引');
      return true;
    } catch (e) {
      console.error('[跨端同步库 ST] 云端保存失败：', e);
      return false;
    }
  }

  async function cloudList(excludeName) {
    if (!cloudConfigured()) return [];
    try {
      var idxPath = GH_DATA_DIR + '/index.json';
      var f = await ghGetFile(idxPath);
      if (!f) return [];
      var list = JSON.parse(f.content);
      if (!Array.isArray(list)) return [];
      return list.filter(function (it) { return !excludeName || it.charName !== excludeName; })
        .map(function (it) { return { id: it.id, charName: it.charName, savedAt: it.savedAt, msgCount: it.msgCount, note: it.note || '', source: 'cloud', platform: it.platform || 'unknown' }; });
    } catch (e) { console.error('[跨端同步库 ST] 云端列表读取失败：', e); return []; }
  }

  async function cloudFetchItem(id, platform) {
    if (!cloudConfigured()) return null;
    try {
      var f = await ghGetFile(convPath(platform || PLATFORM, id));
      if (!f) return null;
      return JSON.parse(f.content);
    } catch (e) { console.error('[跨端同步库 ST] 云端详情读取失败：', e); return null; }
  }

  async function cloudDelete(id, platform) {
    if (!cloudConfigured()) return false;
    try {
      var snapPath = convPath(platform || PLATFORM, id);
      var f = await ghGetFile(snapPath);
      if (f) await ghDeleteFile(snapPath, f.sha, '删除快照 ' + id);
      var idxPath = GH_DATA_DIR + '/index.json';
      var existing = await ghGetFile(idxPath);
      if (existing) {
        var list = [];
        try { list = JSON.parse(existing.content); } catch (e) { }
        list = (Array.isArray(list) ? list : []).filter(function (it) { return it.id !== id; });
        await ghPutFile(idxPath, JSON.stringify(list), existing.sha, '删除索引项 ' + id);
      }
      return true;
    } catch (e) { console.error('[跨端同步库 ST] 云端删除失败：', e); return false; }
  }

  async function combinedList(excludeName) {
    var local = idx().map(function (e) {
      return { id: e.id, charName: e.charName, savedAt: e.savedAt, msgCount: e.msgCount, note: e.note || '', source: 'local', platform: 'st' };
    });
    var cloud = [];
    try { cloud = await cloudList(); } catch (e) { cloud = []; }
    var merged = cloud.slice();
    local.forEach(function (le) {
      var dup = cloud.some(function (ce) { return ce.charName === le.charName && ce.savedAt === le.savedAt && ce.msgCount === le.msgCount; });
      if (!dup) merged.push(le);
    });
    merged.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    return merged;
  }

  // ===== ST 专用：读取上下文、聊天记录、输入框 =====
  function getSTContext() {
    try { if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) return SillyTavern.getContext(); } catch (e) { }
    return null;
  }

  async function tryAutoCharName() {
    try {
      var ctx = getSTContext();
      if (ctx && ctx.name2) return String(ctx.name2);
    } catch (e) { }
    return '';
  }

  async function recentMsgs(n) {
    try {
      var ctx = getSTContext();
      if (!ctx || !Array.isArray(ctx.chat)) return [];
      var chat = ctx.chat;
      var from = Math.max(0, chat.length - n);
      return chat.slice(from).map(function (m) {
        return {
          role: m.is_user ? 'user' : 'char',
          content: m.mes || '',
          time: (m.send_date && Date.parse(m.send_date)) || Date.now()
        };
      }).filter(function (m) { return m.content; });
    } catch (e) { return []; }
  }

  function fmtTime(ms) { try { return new Date(ms).toLocaleString(); } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }
  function uid() { return 'x' + Date.now() + '_' + Math.floor(Math.random() * 100000); }

  async function deleteSnapshot(id) {
    var list = idx().filter(function (e) { return e.id !== id; });
    cache[IDX_KEY] = list;
    await pushG(IDX_KEY, list);
    await removeG(SNAP_PREFIX + id);
  }

  function esc4tag(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

  // items: [{id, source}]，source 是 'local' 或 'cloud'
  async function bringIntoInput(items) {
    if (!items.length) { showToast('请先勾选想调取的对话'); return; }
    var blocks = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var snap = null;
      if (it.source === 'cloud') { snap = await cloudFetchItem(it.id, it.platform); }
      else { snap = await pullG(SNAP_PREFIX + it.id); }
      if (!snap || !snap.messages) continue;
      var meta = snap.meta || {};
      var lines = snap.messages.map(function (m) {
        var who = m.role === 'user' ? '我' : (meta.charName || '对方');
        var t = fmtTime(m.time || meta.savedAt);
        var content = String(m.content || '').replace(/\[\[/g, '［［').replace(/\]\]/g, '］］').replace(/\r\n/g, '\n').replace(/\n+/g, '<br>');
        return who + SEP + t + SEP + content;
      }).join('\n');
      var name = esc4tag(meta.charName || '未知角色');
      var cnt = meta.msgCount || snap.messages.length;
      var time = esc4tag(fmtTime(meta.savedAt));
      blocks.push('[[CCM_MERGE name="' + name + '" count="' + cnt + '" time="' + time + '"]]\n' + lines + '\n[[/CCM_MERGE]]');
    }
    if (!blocks.length) { showToast('没有取到有效内容'); return; }
    var text = blocks.join('\n\n');
    try {
      var ta = D.getElementById('send_textarea');
      var existing = ta ? ta.value : '';
      if (existing) text = existing + '\n\n' + text;
      if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      showToast('已带入输入框，请确认后再发送');
    } catch (e) { showToast('写入输入框失败'); }
  }

  // ===== UI =====
  var el = function (id) { return D.getElementById(id); };
  function showToast(msg) {
    var t = el('ccm-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  function buildStyle() {
    if (el('ccm-style')) return;
    var style = D.createElement('style');
    style.id = 'ccm-style';
    style.textContent = [
      "#ccm-fab { position:fixed; right:14px; bottom:78px; z-index:99999; width:34px; height:34px; border-radius:50%; background:rgba(30,30,40,0.7); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.25); box-shadow:0 6px 18px rgba(0,0,0,0.35); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; user-select:none; }",
      "#ccm-fab:active { transform:scale(0.88); }",
      ".ccm-overlay { position:fixed; inset:0; z-index:100000; background:rgba(10,10,16,0.5); backdrop-filter:blur(3px); display:none; align-items:flex-end; justify-content:center; padding:0; font-family:-apple-system,'PingFang SC','Noto Sans SC',system-ui,sans-serif; }",
      ".ccm-overlay.open { display:flex; }",
      ".ccm-card { width:100%; max-width:480px; height:auto; max-height:62vh; background:#1B1B24; border-radius:20px 20px 0 0; box-shadow:0 -8px 32px rgba(0,0,0,0.5); padding:14px 16px 16px; overflow-y:auto; position:relative; border:1px solid rgba(255,255,255,0.08); border-bottom:none; display:flex; flex-direction:column; color:#E8E6F0; }",
      ".ccm-card::-webkit-scrollbar { width:4px; }",
      ".ccm-card::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:4px; }",
      ".ccm-title { font-size:19px; font-weight:800; text-align:center; margin-bottom:2px; }",
      ".ccm-subtitle { font-size:11px; color:#9A97AE; text-align:center; margin-bottom:12px; line-height:1.5; }",
      ".ccm-tabs { display:flex; gap:6px; margin-bottom:10px; }",
      ".ccm-tab { flex:1; text-align:center; padding:8px 0; border-radius:12px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.06); cursor:pointer; color:#B8B5C8; }",
      ".ccm-tab.on { background:#6C5CE7; color:#fff; }",
      ".ccm-section { margin-bottom:10px; }",
      ".ccm-label { font-size:12px; font-weight:700; color:#C8C5D8; margin-bottom:4px; display:block; }",
      ".ccm-input { width:100%; box-sizing:border-box; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:#E8E6F0; font-size:13px; outline:none; }",
      ".ccm-input:focus { border-color:#6C5CE7; }",
      ".ccm-btn { padding:9px 14px; border:none; border-radius:24px; font-size:13px; font-weight:800; cursor:pointer; background:#6C5CE7; color:#fff; text-align:center; }",
      ".ccm-btn:active { transform:scale(0.96); }",
      ".ccm-btn.full { width:100%; }",
      ".ccm-btn.outline { background:transparent; border:1.5px solid rgba(255,255,255,0.2); color:#E8E6F0; }",
      ".ccm-btn.small { padding:5px 10px; font-size:11px; }",
      ".ccm-close { position:absolute; top:12px; right:12px; width:30px; height:30px; border-radius:50%; border:none; background:rgba(255,255,255,0.08); color:#E8E6F0; font-size:15px; cursor:pointer; }",
      ".ccm-list-item { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 12px; margin-bottom:8px; }",
      ".ccm-item-head { display:flex; align-items:center; gap:8px; }",
      ".ccm-item-head input[type=checkbox] { width:16px; height:16px; flex:none; }",
      ".ccm-item-name { font-weight:800; font-size:13px; flex:1; }",
      ".ccm-item-time { font-size:10px; color:#9A97AE; }",
      ".ccm-item-note { font-size:11px; color:#B8B5C8; margin-top:4px; }",
      ".ccm-item-actions { display:flex; justify-content:flex-end; margin-top:6px; }",
      ".ccm-empty { text-align:center; color:#7A7790; font-size:12px; padding:24px 0; }",
      ".ccm-toast { position:fixed; bottom:40px; left:50%; transform:translateX(-50%); background:#2A2A38; color:#fff; padding:8px 16px; border-radius:24px; font-size:12px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.3); z-index:100001; opacity:0; transition:opacity 0.3s; pointer-events:none; }",
      ".ccm-toast.show { opacity:1; }",
      ".ccm-footer { text-align:center; font-size:10px; color:#6A6780; margin-top:auto; padding-top:8px; flex:none; }"
    ].join('\n');
    D.head.appendChild(style);
  }

  var activeTab = 'pull';

  async function renderList(keyword) {
    var box = el('ccm-list');
    if (!box) return;
    box.innerHTML = "<div class='ccm-empty'>加载中...</div>";
    var list = [];
    try {
      var name = myName();
      list = await combinedList(name);
      if (keyword) {
        var kw = keyword.trim().toLowerCase();
        list = list.filter(function (e) {
          return (e.charName || '').toLowerCase().indexOf(kw) !== -1 || (e.note || '').toLowerCase().indexOf(kw) !== -1;
        });
      }
    } catch (eOuter) {
      box.innerHTML = "<div class='ccm-empty'>加载失败，请重试。<br>" + esc(eOuter && eOuter.message ? eOuter.message : String(eOuter)) + "</div>";
      return;
    }
    if (!list.length) { box.innerHTML = "<div class='ccm-empty'>没有匹配的对话快照。<br>先去其他角色窗口保存一份记录吧。</div>"; return; }
    var html = '';
    list.forEach(function (e) {
      var platformTag = e.platform === 'st' ? 'ST' : (e.platform === 'tavo' ? 'Tavo' : (e.platform || ''));
      html += "<div class='ccm-list-item'>"
        + "<div class='ccm-item-head'>"
        + "<input type='checkbox' class='ccm-pick' data-id='" + e.id + "' data-source='" + e.source + "' data-platform='" + (e.platform||'') + "'>"
        + "<div class='ccm-item-name'>" + esc(e.charName) + "</div>"
        + "<div class='ccm-item-time'>" + esc(fmtTime(e.savedAt)) + " · " + e.msgCount + "条" + (platformTag ? ' · ' + esc(platformTag) : '') + "</div>"
        + "</div>"
        + (e.note ? "<div class='ccm-item-note'>" + esc(e.note) + "</div>" : '')
        + "<div class='ccm-item-actions'><button class='ccm-btn small outline ccm-del' data-id='" + e.id + "' data-source='" + e.source + "' data-platform='" + (e.platform||'') + "'>删除</button></div>"
        + "</div>";
    });
    box.innerHTML = html;
    box.querySelectorAll('.ccm-del').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = this.getAttribute('data-id');
        var source = this.getAttribute('data-source');
        var platform = this.getAttribute('data-platform');
        if (source === 'cloud') {
          var ok = await cloudDelete(id, platform);
          showToast(ok ? '已从云端删除' : '云端删除失败');
        } else {
          await deleteSnapshot(id);
          showToast('已删除');
        }
        renderList(el('ccm-search').value);
      });
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    el('ccm-tab-pull').className = 'ccm-tab' + (tab === 'pull' ? ' on' : '');
    el('ccm-tab-push').className = 'ccm-tab' + (tab === 'push' ? ' on' : '');
    el('ccm-tab-net').className = 'ccm-tab' + (tab === 'net' ? ' on' : '');
    el('ccm-panel-pull').style.display = tab === 'pull' ? '' : 'none';
    el('ccm-panel-push').style.display = tab === 'push' ? '' : 'none';
    el('ccm-panel-net').style.display = tab === 'net' ? '' : 'none';
    if (tab === 'pull') renderList(el('ccm-search') ? el('ccm-search').value : '');
    if (tab === 'net') {
      if (el('ccm-cloud-token')) el('ccm-cloud-token').value = ghToken();
      if (el('ccm-cloud-repo')) el('ccm-cloud-repo').value = ghRepo();
      if (el('ccm-cloud-branch')) el('ccm-cloud-branch').value = ghBranch();
      if (el('ccm-net-url') && !el('ccm-net-url').value) el('ccm-net-url').value = 'https://api.github.com';
    }
  }

  function build() {
    buildStyle();
    if (!el('ccm-fab')) {
      var fab = D.createElement('div');
      fab.id = 'ccm-fab';
      fab.innerHTML = '🔀';
      D.body.appendChild(fab);
      fab.addEventListener('click', function (e) {
        e.stopPropagation();
        el('ccm-overlay').classList.add('open');
        switchTab(activeTab);
      });
    }
    if (!el('ccm-overlay')) {
      var ov = D.createElement('div');
      ov.className = 'ccm-overlay';
      ov.id = 'ccm-overlay';
      ov.innerHTML = "<div class='ccm-card'>"
        + "<button class='ccm-close' id='ccm-close'>\u2715</button>"
        + "<div class='ccm-title'>\ud83d\udd00 \u8de8\u89d2\u8272\u8bb0\u5fc6</div>"
        + "<div class='ccm-subtitle'>\u5728\u4e0d\u540c\u89d2\u8272\u7a97\u53e3\u4e4b\u95f4\uff0c\u6309\u9700\u8c03\u53d6\u6216\u4fdd\u5b58\u5bf9\u8bdd\u7247\u6bb5</div>"
        + "<div class='ccm-tabs'>"
        + "<div class='ccm-tab on' id='ccm-tab-pull'>\u8c03\u53d6</div>"
        + "<div class='ccm-tab' id='ccm-tab-push'>\u4fdd\u5b58</div>"
        + "<div class='ccm-tab' id='ccm-tab-net'>\u4e91\u540c\u6b65</div>"
        + "</div>"
        + "<div id='ccm-panel-pull'>"
        + "<div class='ccm-section'><input class='ccm-input' id='ccm-search' placeholder='\u641c\u7d22\u89d2\u8272\u540d\u6216\u5907\u6ce8...'></div>"
        + "<div class='ccm-section' id='ccm-list' style='flex:1;'></div>"
        + "<button class='ccm-btn full' id='ccm-bring'>\u5e26\u5165\u5f53\u524d\u5bf9\u8bdd\u6846</button>"
        + "</div>"
        + "<div id='ccm-panel-push' style='display:none;'>"
        + "<div class='ccm-section'><label class='ccm-label'>\u672c\u89d2\u8272\u540d\u79f0\u6807\u7b7e <small style='color:#7A7790;'>\uff08\u901a\u5e38\u4f1a\u81ea\u52a8\u8bc6\u522b\uff0c\u8bc6\u522b\u4e0d\u5230\u65f6\u624b\u52a8\u586b\uff09</small></label><input class='ccm-input' id='ccm-my-name' placeholder='\u4f8b\u5982\uff1a\u5c0f\u660e / \u5496\u5561\u5e97\u8001\u677f\u5a18'></div>"
        + "<div class='ccm-section'><label class='ccm-label'>\u5907\u6ce8\uff08\u53ef\u9009\uff09</label><input class='ccm-input' id='ccm-note' placeholder='\u4f8b\u5982\uff1a\u7b2c\u4e00\u6b21\u7ea6\u4f1a\u90a3\u6bb5'></div>"
        + "<div class='ccm-section'><label class='ccm-label'>\u4fdd\u5b58\u6700\u8fd1\u51e0\u6761\u6d88\u606f</label><input class='ccm-input' id='ccm-snap-count' type='number' min='2' max='" + MAX_MSG_PER_SNAP + "' value='20'></div>"
        + "<button class='ccm-btn full' id='ccm-save'>\u4fdd\u5b58\u5f53\u524d\u5bf9\u8bdd\u5feb\u7167</button>"
        + "</div>"
        + "<div class='ccm-footer'>\u5feb\u7167\u4ec5\u4fdd\u5b58\u6587\u672c\u5185\u5bb9\uff0c\u4e0d\u542b\u56fe\u7247\uff1b\u5168\u5c40\u6700\u591a\u4fdd\u7559 " + MAX_SNAPS + " \u4efd\uff0c\u8d85\u51fa\u540e\u81ea\u52a8\u6e05\u7406\u6700\u65e9\u7684</div>"
        + "</div>"
        + "<div id='ccm-panel-net' style='display:none;'>"
        + "<div class='ccm-section'><label class='ccm-label'>GitHub Token <small style='color:#7A7790;'>\uff08Personal Access Token\uff0c\u52fe\u9009 repo \u6743\u9650\u90a3\u79cd\uff09</small></label><input class='ccm-input' id='ccm-cloud-token' placeholder='ghp_ \u5f00\u5934\u7684\u4e00\u957f\u4e32'></div>"
        + "<div class='ccm-section'><label class='ccm-label'>\u4ed3\u5e93 <small style='color:#7A7790;'>\uff08\u683c\u5f0f\uff1a\u7528\u6237\u540d/\u4ed3\u5e93\u540d\uff0c\u8981\u548c Tavo \u90a3\u8fb9\u4e00\u6837\u624d\u80fd\u4e92\u901a\uff09</small></label><input class='ccm-input' id='ccm-cloud-repo' placeholder='\u4f8b\u5982\uff1acecelia940809/cross-role-memory-plugin'></div>"
        + "<div class='ccm-section'><label class='ccm-label'>\u5206\u652f <small style='color:#7A7790;'>\uff08\u4e0d\u786e\u5b9a\u5c31\u586b main\uff09</small></label><input class='ccm-input' id='ccm-cloud-branch' placeholder='main'></div>"
        + "<button class='ccm-btn full' id='ccm-cloud-save-cfg'>\u4fdd\u5b58\u4e91\u540c\u6b65\u8bbe\u7f6e</button>"
        + "<div class='ccm-footer' style='margin-top:6px;'>\u4e0d\u586b\u7684\u8bdd\u63d2\u4ef6\u53ea\u5728\u672c\u8bbe\u5907\u672c\u5730\u4fdd\u5b58/\u8c03\u53d6\uff0c\u4e0d\u5f71\u54cd\u6b63\u5e38\u4f7f\u7528</div>"
        + "<hr style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;'>"
        + "<div class='ccm-section'><label class='ccm-label'>\u8fde\u901a\u6027\u6d4b\u8bd5 <small style='color:#7A7790;'>\uff08\u76f4\u63a5\u6d4b\u8bd5\u4e91\u540c\u6b65\u63a5\u53e3\u80fd\u4e0d\u80fd\u53d1\u9001\u8bf7\u6c42\uff09</small></label><input class='ccm-input' id='ccm-net-url' placeholder='\u4f1a\u81ea\u52a8\u7528\u4e0a\u9762\u586b\u7684\u670d\u52a1\u5668\u5730\u5740'></div>"
        + "<button class='ccm-btn full outline' id='ccm-net-test'>\u53d1\u9001\u6d4b\u8bd5\u8bf7\u6c42</button>"
        + "<div class='ccm-section' style='margin-top:10px;'><div id='ccm-net-result' style='font-size:12px;color:#B8B5C8;line-height:1.6;white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;min-height:40px;'>\u70b9\u51fb\u4e0a\u9762\u7684\u6309\u94ae\u5f00\u59cb\u6d4b\u8bd5</div></div>"
        + "</div>";
      D.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('open'); });
      if (!el('ccm-toast')) { var tt = D.createElement('div'); tt.className = 'ccm-toast'; tt.id = 'ccm-toast'; D.body.appendChild(tt); }
      bind();
    }
  }

  function bind() {
    el('ccm-close').addEventListener('click', function () { el('ccm-overlay').classList.remove('open'); });
    el('ccm-tab-pull').addEventListener('click', function () { switchTab('pull'); });
    el('ccm-tab-push').addEventListener('click', function () { switchTab('push'); });
    el('ccm-tab-net').addEventListener('click', function () { switchTab('net'); });
    el('ccm-search').addEventListener('input', function () { renderList(this.value); });
    el('ccm-bring').addEventListener('click', function () {
      var items = Array.prototype.slice.call(D.querySelectorAll('.ccm-pick:checked')).map(function (c) {
        return { id: c.getAttribute('data-id'), source: c.getAttribute('data-source'), platform: c.getAttribute('data-platform') };
      });
      bringIntoInput(items);
    });
    el('ccm-my-name').value = myName();
    el('ccm-my-name').addEventListener('change', async function () {
      var v = this.value.trim();
      cache[NAME_KEY] = v;
      await pushC(NAME_KEY, v);
      showToast('已记住本角色名称');
    });
    el('ccm-save').addEventListener('click', async function () {
      var cnt = Number(el('ccm-snap-count').value) || 20;
      cnt = Math.max(2, Math.min(MAX_MSG_PER_SNAP, cnt));
      var note = el('ccm-note').value.trim();
      var ok = await saveSnapshotWithCount(note, cnt);
      if (ok) { el('ccm-note').value = ''; }
    });
    el('ccm-cloud-save-cfg').addEventListener('click', async function () {
      var token = el('ccm-cloud-token').value.trim();
      var repo = el('ccm-cloud-repo').value.trim().replace(/^\/|\/$/g, '');
      var branch = el('ccm-cloud-branch').value.trim() || 'main';
      cache[GH_TOKEN_KEY] = token;
      cache[GH_REPO_KEY] = repo;
      cache[GH_BRANCH_KEY] = branch;
      await pushG(GH_TOKEN_KEY, token);
      await pushG(GH_REPO_KEY, repo);
      await pushG(GH_BRANCH_KEY, branch);
      showToast(token && repo ? '云同步设置已保存' : '已清空云同步设置（只用本地存储）');
    });
    el('ccm-net-test').addEventListener('click', async function () {
      var url = el('ccm-net-url').value.trim();
      var box = el('ccm-net-result');
      if (!url) { showToast('请先填一个测试地址'); return; }
      box.textContent = '请求中...';
      var t0 = Date.now();
      try {
        var resp = await fetch(url, { method: 'GET' });
        var ms = Date.now() - t0;
        var text = '';
        try { text = await resp.text(); } catch (e0) { text = '(读取响应失败：' + (e0 && e0.message ? e0.message : e0) + ')'; }
        var preview = text.length > 300 ? text.slice(0, 300) + '...' : text;
        box.textContent = '✅ 请求成功\n状态码：' + resp.status + '\n耗时：' + ms + 'ms\n响应预览：\n' + preview;
        showToast('请求成功，状态码 ' + resp.status);
      } catch (e1) {
        var ms2 = Date.now() - t0;
        box.textContent = '❌ 请求失败（耗时 ' + ms2 + 'ms）\n错误信息：' + (e1 && e1.message ? e1.message : String(e1)) + '\n\n如果这里报错，大概率是这个页面环境不允许直接发外部请求（比如 CSP 策略拦截）。';
        showToast('请求失败，看下面详情');
      }
    });
  }

  async function saveSnapshotWithCount(note, cnt) {
    var name = myName();
    if (!name) { showToast('识别不到角色名，请先手动填写'); return false; }
    var msgs = await recentMsgs(cnt);
    if (!msgs.length) { showToast('当前没有可保存的对话内容'); return false; }
    var simplified = msgs.map(function (m) { return { role: m.role, content: String(m.content || '').slice(0, 2000), time: m.time || Date.now() }; });
    var id = uid();
    var entry = { id: id, charName: name, savedAt: Date.now(), msgCount: simplified.length, note: note || '' };
    await pushG(SNAP_PREFIX + id, { meta: entry, messages: simplified });
    var list = idx();
    list.unshift(entry);
    if (list.length > MAX_SNAPS) {
      var removed = list.slice(MAX_SNAPS);
      list = list.slice(0, MAX_SNAPS);
      for (var i = 0; i < removed.length; i++) { await removeG(SNAP_PREFIX + removed[i].id); }
    }
    cache[IDX_KEY] = list;
    await pushG(IDX_KEY, list);
    var cloudOk = false;
    if (cloudConfigured()) { cloudOk = await cloudSave(entry, simplified); }
    showToast('已保存「' + name + '」的对话快照（' + simplified.length + '条）' + (cloudConfigured() ? (cloudOk ? '，云端同步成功' : '，云端同步失败（看控制台日志）') : ''));
    return true;
  }

  async function init() {
    if (window.__CCM_ST_EXT_INIT__) return;
    window.__CCM_ST_EXT_INIT__ = true;
    await loadAll();
    if (!myName()) {
      var auto = await tryAutoCharName();
      if (auto) { cache[NAME_KEY] = auto; await pushC(NAME_KEY, auto); }
    }
    build();
    setInterval(build, 3000); // FAB 自愈：防止页面切换/重渲染把悬浮按钮清掉后不再出现
    console.log('[跨端同步库 ST] 已启动');
  }

  // 第三方扩展的标准自启动写法
  if (typeof jQuery !== 'undefined') {
    jQuery(function () { init(); });
  } else {
    if (D.readyState === 'complete' || D.readyState === 'interactive') { init(); }
    else { D.addEventListener('DOMContentLoaded', init); }
  }
})();
