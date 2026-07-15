
(function(){
  try {
    var D = document;
    if (!D || !D.body) return;
    if (window.__CCM_ST_EXT_INIT__) return;
    window.__CCM_ST_EXT_INIT__ = true;

    function stContext(){
      try { if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) return SillyTavern.getContext(); } catch(e){}
      return null;
    }
    function stChat(){ var c = stContext(); return c && Array.isArray(c.chat) ? c.chat : []; }
    function stCurrentCharName(){
      try { var c = stContext(); if (c && c.name2) return String(c.name2); } catch(e){}
      return '';
    }
    function stInputEl(){
      return D.getElementById('send_textarea') || D.querySelector('textarea#send_textarea') || D.querySelector('textarea[name="send_textarea"]') || D.querySelector('textarea');
    }
    function normalizeAsset(item, idx){
      item = item || {};
      var name = item.name || item.avatar || item.filename || item.title || item.key || item.uid || ('item_' + idx);
      var id = item.id || item.avatar || item.filename || item.key || name;
      return { id: String(id), name: String(name), _raw: item };
    }
    function findByNameOrId(list, value){
      value = String(value || '');
      return (list || []).filter(function(it){ return String(it.id) === value || String(it.name) === value; });
    }    function stHeaders(opts){
      opts = opts || {};
      try { var c = stContext(); if (c && typeof c.getRequestHeaders === 'function') return c.getRequestHeaders(opts); } catch(e){}
      try { if (typeof getRequestHeaders === 'function') return getRequestHeaders(opts); } catch(e2){}
      return opts.omitContentType ? {} : { 'Content-Type': 'application/json' };
    }
    async function stJsonPost(url, payload){
      var resp = await fetch(url, {
        method: 'POST',
        headers: stHeaders(),
        body: JSON.stringify(payload || {}),
        cache: 'no-cache'
      });
      if (!resp.ok) throw new Error('ST API ' + url + ' failed: ' + resp.status);
      return await resp.json();
    }
    function normalizeSTWorld(obj){
      obj = obj || {};
      var name = obj.name || obj.id || 'Imported Lorebook';
      var data = Object.assign({}, obj);
      delete data.id;
      data.name = name;
      if (!data.entries) data.entries = {};
      return { name: String(name), data: data };
    }
    var TV = {
      get: async function(k, scope){
        try {
          var prefix = scope === 'chat' ? 'ccm_st_c_' : 'ccm_st_g_';
          var raw = localStorage.getItem(prefix + k);
          return raw === null ? undefined : raw;
        } catch(e){ return undefined; }
      },
      set: async function(k, v, scope){
        try {
          var prefix = scope === 'chat' ? 'ccm_st_c_' : 'ccm_st_g_';
          if (v === '' || v === null || v === undefined) localStorage.removeItem(prefix + k);
          else localStorage.setItem(prefix + k, String(v));
        } catch(e){}
      },
      input: {
        get: async function(){ var el = stInputEl(); return el ? (el.value || el.textContent || '') : ''; },
        set: async function(text){ var el = stInputEl(); if (!el) throw new Error('找不到 ST 输入框'); if ('value' in el) el.value = text; else el.textContent = text; el.dispatchEvent(new Event('input', { bubbles:true })); el.focus && el.focus(); }
      },
      message: {
        count: async function(){ return stChat().length; },
        find: async function(range){
          var chat = stChat();
          var from = Math.max(0, Number(range && range[0]) || 0);
          var to = Math.min(chat.length - 1, Number(range && range[1]) || chat.length - 1);
          return chat.slice(from, to + 1).map(function(m){
            m = m || {};
            var content = (m.mes || m.message || m.content || '');
            return {
              role: m.is_user ? 'user' : (m.is_system ? 'system' : 'char'),
              content: content,
              time: (m.send_date && Date.parse(m.send_date)) || Date.now(),
              name: m.name || (m.is_user ? 'User' : stCurrentCharName()),
              is_user: !!m.is_user,
              is_system: !!m.is_system,
              original_avatar: m.original_avatar || m.avatar || '',
              extra: (m.extra && typeof m.extra === 'object') ? m.extra : {}
            };
          }).filter(function(m){ return m.content; });
        }
      },
      chat: { current: async function(){ return { characters: [{ name: stCurrentCharName() }] }; } },
      utils: {
        export: async function(filename, b64){
          var bin = atob(String(b64).replace(/\s+/g, ''));
          var bytes = new Uint8Array(bin.length);
          for (var i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
          var text = (typeof TextDecoder !== 'undefined') ? new TextDecoder('utf-8').decode(bytes) : decodeURIComponent(escape(bin));
          var blob = new Blob([text], { type:'application/jsonl;charset=utf-8' });
          var a = D.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'export.jsonl'; D.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        }
      },
      character: {
        all: async function(){ var c = stContext(); var arr = c && Array.isArray(c.characters) ? c.characters : null; return arr ? arr.map(normalizeAsset) : null; },
        get: async function(id){ var arr = await TV.character.all(); var hit = findByNameOrId(arr, id)[0]; return hit ? Object.assign({ id: hit.id, name: hit.name }, hit._raw || {}) : null; },
        find: async function(name){ return findByNameOrId(await TV.character.all(), name); },
        create: async function(){ throw new Error('ST 角色卡导入暂未接入'); },
        update: async function(){ throw new Error('ST 角色卡更新暂未接入'); }
      },
      regex: {
        all: async function(){ try { var c=stContext(); var ex=(c && (c.extensionSettings || c.extension_settings)) || window.extension_settings || {}; var arr=ex.regex || ex.regex_scripts || []; return Array.isArray(arr) ? arr.map(normalizeAsset) : null; } catch(e){ return null; } },
        get: async function(id){ var arr = await TV.regex.all(); var hit = findByNameOrId(arr, id)[0]; return hit ? Object.assign({ id: hit.id, name: hit.name }, hit._raw || {}) : null; },
        find: async function(name){ return findByNameOrId(await TV.regex.all(), name); },
        create: async function(){ throw new Error('ST 正则导入暂未接入'); },
        update: async function(){ throw new Error('ST 正则更新暂未接入'); }
      },
      lorebook: {
        all: async function(){
          try {
            var list = await stJsonPost('/api/worldinfo/list', {});
            return Array.isArray(list) ? list.map(function(it, idx){
              var id = it.file_id || it.name || ('world_' + idx);
              var name = it.name || it.file_id || id;
              return { id:String(id), name:String(name), entries: it.entries || '', _raw: it };
            }) : [];
          } catch(e){ console.error('[跨端同步库 ST] 读取世界书列表失败：', e); return null; }
        },
        get: async function(id){
          try {
            var data = await stJsonPost('/api/worldinfo/get', { name: String(id) });
            if (!data) return null;
            data.id = String(id);
            if (!data.name) data.name = String(id);
            return data;
          } catch(e){ console.error('[跨端同步库 ST] 读取世界书失败：', e); return null; }
        },
        find: async function(name, options){
          var list = await TV.lorebook.all();
          if (!Array.isArray(list)) return [];
          var match = options && options.match || 'exact';
          var q = String(name || '').toLowerCase();
          return list.filter(function(it){
            var n = String(it.name || '').toLowerCase();
            if (match === 'contains') return n.indexOf(q) !== -1;
            if (match === 'prefix') return n.indexOf(q) === 0;
            if (match === 'suffix') return n.slice(-q.length) === q;
            return n === q;
          });
        },
        create: async function(obj){
          var w = normalizeSTWorld(obj);
          await stJsonPost('/api/worldinfo/edit', { name: w.name, data: w.data });
          return w.name;
        },
        update: async function(obj){
          var w = normalizeSTWorld(obj);
          await stJsonPost('/api/worldinfo/edit', { name: w.name, data: w.data });
          return w.name;
        }
      }
    };

    // ===== 常量 =====
    var IDX_KEY = 'ccm_index';
    var SNAP_PREFIX = 'ccm_snap_';
    var NAME_KEY = 'ccm_my_name';
    var GH_TOKEN_KEY = 'ccm_gh_token';   // GitHub Personal Access Token
    var GH_REPO_KEY = 'ccm_gh_repo';     // 格式 "owner/repo"
    var GH_BRANCH_KEY = 'ccm_gh_branch'; // 默认 main
    var GH_DATA_DIR = 'ccm-data';        // 仓库里存数据的文件夹
    var OPEN_KEY = 'com.cecelia.cross-sync.openRequest';
    var SEEN_KEY = 'ccm_seen_map'; // 记录本设备已经"看过"哪些云端内容（按 sha/savedAt 判断是否有更新）
    var MAX_SNAPS = 100;     // 全局最多保留多少份快照，避免存储无限膨胀
    var MAX_MSG_PER_SNAP = 100; // 每份快照最多带多少条消息（封顶 100）

    // ===== 存储：优先走 'global' 域（跨角色共享），若环境不支持则退化为 'chat' 域并提示 =====
    // 注：'global' 是否是本环境真实支持的 scope 名称，需要在 Tavo 里实测确认；
    // 如果实测发现该 scope 无效（存取不到跨聊天共享的数据），
    // 把下面 GLOBAL_SCOPE 改成实际可用的全局域名称即可，其余逻辑不用动。
    var GLOBAL_SCOPE = 'global';
    var cache = {};
    function val(k, fb){ return (cache[k] !== undefined && cache[k] !== null) ? cache[k] : fb; }
    async function pullG(k){ try { var v = await TV.get(k, GLOBAL_SCOPE); if (v===null||v===undefined) return undefined; if (typeof v==='string'){ try{ return JSON.parse(v); }catch(e){ return v; } } return v; } catch(e){ return undefined; } }
    async function pushG(k, v){ cache[k]=v; try { await TV.set(k, JSON.stringify(v), GLOBAL_SCOPE); } catch(e){} }
    async function pullC(k){ try { var v = await TV.get(k, 'chat'); if (v===null||v===undefined) return undefined; if (typeof v==='string'){ try{ return JSON.parse(v); }catch(e){ return v; } } return v; } catch(e){ return undefined; } }
    async function pushC(k, v){ cache[k]=v; try { await TV.set(k, JSON.stringify(v), 'chat'); } catch(e){} }

    function idx(){ var l=val(IDX_KEY,null); if(!Array.isArray(l)){ l=[]; cache[IDX_KEY]=l; } return l; }
    function myName(){ return val(NAME_KEY,''); }
    function ghToken(){ return val(GH_TOKEN_KEY,''); }
    function ghRepo(){ return val(GH_REPO_KEY,''); }
    function ghBranch(){ return val(GH_BRANCH_KEY,'') || 'main'; }
    function cloudConfigured(){ return !!(ghToken() && ghRepo()); }

    async function loadAll(){
      var i = await pullG(IDX_KEY); cache[IDX_KEY] = Array.isArray(i) ? i : [];
      var n = await pullC(NAME_KEY); cache[NAME_KEY] = (typeof n === 'string') ? n : '';
      var gt = await pullG(GH_TOKEN_KEY); cache[GH_TOKEN_KEY] = (typeof gt === 'string') ? gt : '';
      var gr = await pullG(GH_REPO_KEY); cache[GH_REPO_KEY] = (typeof gr === 'string') ? gr : '';
      var gb = await pullG(GH_BRANCH_KEY); cache[GH_BRANCH_KEY] = (typeof gb === 'string') ? gb : '';
      var sm = await pullG(SEEN_KEY); cache[SEEN_KEY] = (sm && typeof sm === 'object' && !Array.isArray(sm)) ? sm : {};
    }

    // ===== "已读/新内容"标记：按 key（如 asset:regex:tavo:某正则）记住上次看到的版本标记（sha 或 savedAt），
    // 跟当前云端的标记不一样，就说明是新内容或有更新，用红点/NEW 提示出来。=====
    function seenGet(key){ return (cache[SEEN_KEY] || {})[key]; }
    function seenIsNew(key, marker){ if (marker === undefined || marker === null || marker === '') return false; return seenGet(key) !== marker; }
    var pendingSeen = null;
    function seenQueue(key, marker){ if (!pendingSeen) pendingSeen = {}; pendingSeen[key] = marker; }
    async function seenFlush(){
      if (!pendingSeen) return;
      var m = cache[SEEN_KEY] || {};
      Object.keys(pendingSeen).forEach(function(k){ m[k] = pendingSeen[k]; });
      cache[SEEN_KEY] = m;
      pendingSeen = null;
      await pushG(SEEN_KEY, m);
    }

    // ===== 云端同步：改用 GitHub 仓库当存储后端（读写仓库里的文件），
    // 因为 Cloudflare Workers 的 *.workers.dev 域名在某些网络环境下会被单独限制/连不上，
    // 而 api.github.com 这条连通性稳定得多。=====
    var PLATFORM = 'st'; // 这份代码固定跑在 Tavo 里；ST 版对应的常量是 'st'
    var PLATFORM_LABEL = { tavo: 'Tavo', st: 'SillyTavern' };

    function fetchTO(url, opts, ms){
      ms = ms || 20000;
      return new Promise(function(resolve, reject){
        var done = false;
        var timer = setTimeout(function(){ if(!done){ done=true; reject(new Error('请求超时')); } }, ms);
        fetch(url, opts).then(function(r){ if(!done){ done=true; clearTimeout(timer); resolve(r); } })
          .catch(function(e){ if(!done){ done=true; clearTimeout(timer); reject(e); } });
      });
    }

    // UTF-8 安全的 base64 编解码（GitHub API 要求文件内容是 base64）
    function b64encode(str){ return btoa(unescape(encodeURIComponent(str))); }
    function b64decode(b64){ return decodeURIComponent(escape(atob(b64.replace(/\n/g,'')))); }

    function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

    // 批量操作时 GitHub 有时候会触发"二级限流"（短时间内请求太密集，返回 403）或偶发超时/5xx，
    // 这类都是可以重试就好的临时性失败；用指数退避重试几次，减少"点好几次才能全部成功"的情况。
    async function withRetry(fn, tries){
      tries = tries || 3;
      var lastErr;
      for (var i=0;i<tries;i++){
        try { return await fn(); }
        catch(e){
          lastErr = e;
          var msg = String((e && e.message) || e);
          var retryable = /403|409|422|5\d\d|超时|timeout|network|fetch/i.test(msg);
          if (!retryable || i === tries - 1) throw e;
          await sleep(500 * Math.pow(2, i)); // 500ms → 1000ms → 2000ms
        }
      }
      throw lastErr;
    }

    function ghHeaders(){
      return {
        'Authorization': 'token ' + ghToken(),
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
    }
    function ghUrl(path){ return 'https://api.github.com/repos/' + ghRepo() + '/contents/' + path; }

    // 读一个文件，不存在返回 null，其他错误抛异常
    async function ghGetFile(path){
      return await withRetry(async function(){
        var resp = await fetchTO(ghUrl(path) + '?ref=' + encodeURIComponent(ghBranch()), { headers: ghHeaders() });
        if (resp.status === 404) return null;
        if (!resp.ok) throw new Error('GitHub 读取失败：' + resp.status);
        var data = await resp.json();
        return { content: b64decode(data.content), sha: data.sha };
      });
    }

    // 写一个文件；sha 传 undefined 表示新建，传具体值表示更新（覆盖）
    async function ghPutFile(path, content, sha, message){
      return await withRetry(async function(){
        var body = { message: message || ('update ' + path), content: b64encode(content), branch: ghBranch() };
        if (sha) body.sha = sha;
        var resp = await fetchTO(ghUrl(path), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }, 30000);
        if (resp.status === 409 || resp.status === 422) {
          // Conflict or validation after a slow previous write: fetch newest sha and retry once.
          var latest = await ghGetFile(path);
          if (latest) {
            body.sha = latest.sha;
            resp = await fetchTO(ghUrl(path), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }, 30000);
          }
        }
        if (!resp.ok) {
          var detail = '';
          try { detail = await resp.text(); } catch(e){}
          throw new Error('GitHub write failed: ' + resp.status + (detail ? (' ' + detail.slice(0, 160)) : ''));
        }
        var data = await resp.json();
        return data.content ? data.content.sha : undefined;
      }, 4);
    }

    async function ghDeleteFile(path, sha, message){
      return await withRetry(async function(){
        var resp = await fetchTO(ghUrl(path), {
          method: 'DELETE', headers: ghHeaders(),
          body: JSON.stringify({ message: message || ('delete ' + path), sha: sha, branch: ghBranch() })
        });
        if (!resp.ok && resp.status !== 404) throw new Error('GitHub 删除失败：' + resp.status);
        return resp.ok;
      });
    }

    // 列出某个目录下的文件（目录不存在时返回空数组，而不是抛错）
    async function ghListDir(dirPath){
      try {
        var resp = await fetchTO('https://api.github.com/repos/' + ghRepo() + '/contents/' + dirPath + '?ref=' + encodeURIComponent(ghBranch()), { headers: ghHeaders() });
        if (resp.status === 404) return [];
        if (!resp.ok) throw new Error('目录读取失败：' + resp.status);
        var arr = await resp.json();
        return Array.isArray(arr) ? arr : [];
      } catch(e){ console.error('[跨端同步库] 目录读取失败：', e); return []; }
    }

    // ===== 目录结构：
    // ccm-data/index.json                         —— 共享的对话记录索引（Tavo/ST 都读写这一份，跨平台可见）
    // ccm-data/<platform>/conversations/snap_*.json —— 每条对话记录的具体内容，按来源平台分文件夹
    // ccm-data/<platform>/characters|regexes|lorebooks/*.json —— 角色卡/正则/世界书，同样按平台分文件夹
    // =====
    function convPath(platform, id){ return GH_DATA_DIR + '/' + platform + '/conversations/snap_' + id + '.jsonl'; }
    function assetPath(platform, kind, name){ return GH_DATA_DIR + '/' + platform + '/' + ASSET_KINDS[kind].dir + '/' + safeAssetName(name) + '.json'; }

    // ===== 对话记录的云端存储格式：SillyTavern/Tavo 通用的逐行 JSON 聊天记录（.jsonl），
    // 第一行是本次对话的元信息，后面每一行是一条消息，字段沿用 name/is_user/is_system/send_date/mes，
    // 这样导出的文件可以直接拖进别的平台当聊天记录导入，不用再额外转换。 =====
    function p2(n){ return (n<10?'0':'')+n; }
    function p3(n){ return (n<10?'00':(n<100?'0':''))+n; }
    function fmtCreateDate(ms){
      var d = new Date(ms||Date.now());
      return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+'@'+p2(d.getHours())+'h'+p2(d.getMinutes())+'m'+p2(d.getSeconds())+'s';
    }
    function fmtSendDate(ms){
      var d = new Date(ms||Date.now());
      return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+'T'+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())+'.'+p3(d.getMilliseconds());
    }
    function parseSendDateMs(s){ try { var t = Date.parse(s); return isNaN(t) ? undefined : t; } catch(e){ return undefined; } }

    // 把内部快照结构 {meta, messages} 拼成 jsonl 文本
    function buildChatlogJsonl(meta, messages){
      meta = meta || {};
      messages = Array.isArray(messages) ? messages : [];
      var vars = Object.assign({}, (meta.chat_metadata && meta.chat_metadata.variables) || meta.variables || {});
      if (meta.charName && !vars.ccm_my_name) vars.ccm_my_name = meta.charName;
      var chatMeta = { variables: vars };
      if (meta.note) chatMeta.note = meta.note;
      if (meta.savedAt) chatMeta.savedAt = meta.savedAt;
      chatMeta.msgCount = meta.msgCount || messages.length;
      chatMeta.platform = meta.platform || PLATFORM;
      var lines = [];
      lines.push(JSON.stringify({
        user_name: meta.userName || 'User',
        character_name: meta.charName || '',
        create_date: fmtCreateDate(meta.savedAt),
        chat_metadata: chatMeta
      }));
      messages.forEach(function(m){
        m = m || {};
        var raw = m.raw && typeof m.raw === 'object' ? m.raw : {};
        var isUser = (typeof m.is_user === 'boolean') ? m.is_user : ((typeof raw.is_user === 'boolean') ? raw.is_user : m.role === 'user');
        var isSystem = (typeof m.is_system === 'boolean') ? m.is_system : ((typeof raw.is_system === 'boolean') ? raw.is_system : m.role === 'system');
        var extra = (m.extra && typeof m.extra === 'object') ? m.extra : ((raw.extra && typeof raw.extra === 'object') ? raw.extra : {});
        lines.push(JSON.stringify({
          name: m.name || raw.name || (isUser ? (meta.userName || 'User') : (meta.charName || '')),
          is_user: !!isUser,
          is_system: !!isSystem,
          send_date: fmtSendDate(m.time || meta.savedAt),
          mes: String(m.content != null ? m.content : (raw.mes || raw.message || raw.content || '')),
          original_avatar: m.original_avatar || raw.original_avatar || '',
          extra: extra
        }));
      });
      return lines.join('\n');
    }

    function parseChatlogJsonl(text){
      var lines = String(text||'').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
      if (!lines.length) return null;
      var head; try { head = JSON.parse(lines[0]); } catch(e){ return null; }
      var cm = head.chat_metadata || {};
      var messages = [];
      for (var i=1;i<lines.length;i++){
        var obj; try { obj = JSON.parse(lines[i]); } catch(e){ continue; }
        messages.push({
          role: obj.is_user ? 'user' : (obj.is_system ? 'system' : 'char'),
          content: obj.mes || obj.message || obj.content || '',
          time: parseSendDateMs(obj.send_date) || cm.savedAt,
          name: obj.name || '',
          is_user: !!obj.is_user,
          is_system: !!obj.is_system,
          original_avatar: obj.original_avatar || '',
          extra: (obj.extra && typeof obj.extra === 'object') ? obj.extra : {},
          raw: obj
        });
      }
      var meta = {
        charName: head.character_name || '',
        savedAt: cm.savedAt || Date.now(),
        msgCount: cm.msgCount || messages.length,
        note: cm.note || '',
        platform: cm.platform || 'unknown',
        variables: (cm.variables && typeof cm.variables === 'object') ? cm.variables : {},
        chat_metadata: cm
      };
      return { meta: meta, messages: messages };
    }

    function mergeCloudIndexEntry(list, entry){
      list = Array.isArray(list) ? list : [];
      var merged = list.filter(function(it){ return it && it.id !== entry.id; });
      merged.unshift(entry);
      if (merged.length > 200) merged = merged.slice(0, 200);
      return merged;
    }

    async function cloudIndexHas(entry){
      try {
        var f = await ghGetFile(GH_DATA_DIR + '/index.json');
        if (!f) return false;
        var list = JSON.parse(f.content);
        if (!Array.isArray(list)) return false;
        return list.some(function(it){ return it && it.id === entry.id && (it.platform || PLATFORM) === PLATFORM; });
      } catch(e){ return false; }
    }

    async function cloudUpsertIndex(entry){
      return await withRetry(async function(){
        var idxPath = GH_DATA_DIR + '/index.json';
        var existing = null;
        try { existing = await ghGetFile(idxPath); } catch(e){}
        var list = [];
        if (existing) { try { list = JSON.parse(existing.content); if (!Array.isArray(list)) list = []; } catch(e){ list = []; } }
        var merged = mergeCloudIndexEntry(list, entry);
        await ghPutFile(idxPath, JSON.stringify(merged), existing ? existing.sha : undefined, 'update index');
        return true;
      }, 4);
    }

    async function cloudSave(meta, messages){
      if (!cloudConfigured()) return false;
      var snapPath = convPath(PLATFORM, meta.id);
      var entry = { id: meta.id, charName: meta.charName, savedAt: meta.savedAt, msgCount: meta.msgCount, note: meta.note || '', platform: PLATFORM };
      try {
        var payload = buildChatlogJsonl({ charName: meta.charName, savedAt: meta.savedAt, msgCount: meta.msgCount, note: meta.note || '', platform: PLATFORM }, messages);
        var existingSnap = null;
        try { existingSnap = await ghGetFile(snapPath); } catch(e){}
        try {
          await ghPutFile(snapPath, payload, existingSnap ? existingSnap.sha : undefined, 'save conversation snapshot ' + meta.id);
        } catch(writeErr) {
          console.warn('[跨端同步库] 云端快照写入返回异常，正在回读确认：', writeErr);
          await sleep(1800);
          var writtenSnap = null;
          try { writtenSnap = await ghGetFile(snapPath); } catch(e){}
          if (!writtenSnap) throw writeErr;
        }

        var indexOk = false;
        try {
          indexOk = await cloudUpsertIndex(entry);
        } catch(indexErr) {
          console.warn('[跨端同步库] 云端索引写入返回异常，正在回读确认：', indexErr);
        }
        if (!indexOk) {
          await sleep(1800);
          indexOk = await cloudIndexHas(entry);
        }
        if (!indexOk) throw new Error('cloud index verify failed');

        seenQueue('conv:' + PLATFORM + ':' + meta.id, meta.savedAt);
        await seenFlush();
        return true;
      } catch (e) {
        console.error('[跨端同步库] 云端保存失败：', e);
        return false;
      }
    }

    async function cloudList(excludeName){
      if (!cloudConfigured()) return [];
      try {
        var idxPath = GH_DATA_DIR + '/index.json';
        var f = await ghGetFile(idxPath);
        if (!f) return [];
        var list = JSON.parse(f.content);
        if (!Array.isArray(list)) return [];
        return list.filter(function(it){ return !excludeName || it.charName !== excludeName; })
          .map(function(it){ return { id: it.id, charName: it.charName, savedAt: it.savedAt, msgCount: it.msgCount, note: it.note || '', source: 'cloud', platform: it.platform || 'unknown' }; });
      } catch (e) { console.error('[跨端同步库] 云端列表读取失败：', e); return []; }
    }

    async function cloudFetchItem(id, platform){
      if (!cloudConfigured()) return null;
      try {
        var f = await ghGetFile(convPath(platform || PLATFORM, id));
        if (!f) return null;
        return parseChatlogJsonl(f.content);
      } catch (e) { console.error('[跨端同步库] 云端详情读取失败：', e); return null; }
    }

    async function cloudDelete(id, platform){
      if (!cloudConfigured()) return false;
      try {
        var snapPath = convPath(platform || PLATFORM, id);
        var f = await ghGetFile(snapPath);
        if (f) await ghDeleteFile(snapPath, f.sha, '删除快照 ' + id);
        var idxPath = GH_DATA_DIR + '/index.json';
        var existing = await ghGetFile(idxPath);
        if (existing) {
          var list = [];
          try { list = JSON.parse(existing.content); } catch(e){}
          list = (Array.isArray(list) ? list : []).filter(function(it){ return it.id !== id; });
          await ghPutFile(idxPath, JSON.stringify(list), existing.sha, '删除索引项 ' + id);
        }
        return true;
      } catch (e) { console.error('[跨端同步库] 云端删除失败：', e); return false; }
    }

    // 清空云端全部对话记录（索引 + 两个平台文件夹下的所有快照文件），用于"推倒重来"
    async function clearCloudConversations(onProgress){
      if (!cloudConfigured()) { showToast('请先配置云同步'); return false; }
      try {
        var platforms = ['tavo', 'st'];
        var deleted = 0;
        for (var i=0;i<platforms.length;i++){
          var dir = GH_DATA_DIR + '/' + platforms[i] + '/conversations';
          var files = await ghListDir(dir);
          for (var j=0;j<files.length;j++){
            if (files[j].type !== 'file') continue;
            if (onProgress) onProgress(platforms[i], j+1, files.length);
            await ghDeleteFile(files[j].path, files[j].sha, '清空对话记录：' + files[j].name);
            deleted++;
            await sleep(150);
          }
        }
        var idxPath = GH_DATA_DIR + '/index.json';
        var existing = await ghGetFile(idxPath);
        if (existing) { await ghDeleteFile(idxPath, existing.sha, '清空对话记录索引'); }
        cache[IDX_KEY] = []; // 顺带清掉本地索引缓存里对云端的引用（本地自己存的快照文件不受影响）
        return deleted;
      } catch(e){ console.error('[跨端同步库] 清空云端对话记录失败：', e); return false; }
    }

    // 合并本地快照 + 云端快照，尽量去掉"刚保存的这条本地和云端都会各出现一次"的重复
    async function combinedList(excludeName){
      var local = idx().map(function(e){
        return { id: e.id, charName: e.charName, savedAt: e.savedAt, msgCount: e.msgCount, note: e.note || '', source: 'local', platform: PLATFORM };
      });
      var cloud = [];
      try { cloud = await cloudList(); } catch(e) { cloud = []; }
      var merged = cloud.slice();
      local.forEach(function(le){
        var dup = cloud.some(function(ce){ return ce.charName===le.charName && ce.savedAt===le.savedAt && ce.msgCount===le.msgCount; });
        if (!dup) merged.push(le);
      });
      merged.sort(function(a,b){ return (b.savedAt||0) - (a.savedAt||0); });
      return merged;
    }

    // ===== 资产同步：角色卡 / 正则 / 世界书 =====
    // 用 tavo.character / tavo.regex / tavo.lorebook 这几个官方接口做本地读写，
    // 云端存储原样复用已有的 GitHub 仓库（按平台分文件夹），
    // 三类资产的对象结构完全由 Tavo 自己定义，我们只负责原样转存，不做任何字段改写，
    // 这样可以最大程度避免手工拼字段导致格式不对。
    function safeAssetName(s){ return String(s||'unnamed').replace(/[\\/:*?"<>|]/g,'_').slice(0,80); }

    var ASSET_KINDS = {
      character: {
        label: '角色卡', dir: 'characters',
        all: async function(){ try { if (!TV.character || !TV.character.all) return null; return await TV.character.all(); } catch(e){ return null; } },
        get: async function(id){ return await TV.character.get(id); },
        find: async function(name){ try { return await TV.character.find(name, { match: 'exact' }); } catch(e){ return []; } },
        createFn: async function(obj){ return await TV.character.create(obj); },
        updateFn: async function(obj){ return await TV.character.update(obj); }
      },
      regex: {
        label: '正则', dir: 'regexes',
        all: async function(){ try { if (!TV.regex || !TV.regex.all) return null; return await TV.regex.all(); } catch(e){ return null; } },
        get: async function(id){ return await TV.regex.get(id); },
        find: async function(name){ try { return await TV.regex.find(name, { match: 'exact' }); } catch(e){ return []; } },
        createFn: async function(obj){ return await TV.regex.create(obj); },
        updateFn: async function(obj){ return await TV.regex.update(obj); }
      },
      lorebook: {
        label: '世界书', dir: 'lorebooks',
        all: async function(){ try { if (!TV.lorebook || !TV.lorebook.all) return null; return await TV.lorebook.all(); } catch(e){ return null; } },
        get: async function(id){ return await TV.lorebook.get(id); },
        find: async function(name){ try { return await TV.lorebook.find(name, { match: 'exact' }); } catch(e){ return []; } },
        createFn: async function(obj){ return await TV.lorebook.create(obj); },
        updateFn: async function(obj){ return await TV.lorebook.update(obj); }
      }
    };

    // 本地资产列表；返回 null 表示这个环境读不到这类 API（不是"没有数据"，是接口本身不可用）
    async function assetLocalList(kind){
      return await ASSET_KINDS[kind].all();
    }

    // 把某个本地资产的完整内容推送到云端（原样存一份 JSON），silent=true 时不弹 toast（批量推送用）
    async function assetPushToCloud(kind, id, silent){
      if (!cloudConfigured()) { if(!silent) showToast('请先在"云同步设置"里配置好 GitHub Token 和仓库'); return false; }
      try {
        var full = await ASSET_KINDS[kind].get(id);
        if (!full) { if(!silent) showToast('读取本地数据失败'); return false; }
        var path = assetPath(PLATFORM, kind, full.name);
        var existing = null;
        try { existing = await ghGetFile(path); } catch(e){}
        var newSha = await ghPutFile(path, JSON.stringify(full), existing ? existing.sha : undefined, '同步' + ASSET_KINDS[kind].label + '：' + full.name);
        // 自己刚推上去的内容，立刻标记为"已读"，避免自己给自己提示"有更新"
        seenQueue('asset:' + kind + ':' + PLATFORM + ':' + full.name, newSha || Date.now());
        await seenFlush();
        if (!silent) showToast(ASSET_KINDS[kind].label + '「' + full.name + '」已推送到云端');
        return true;
      } catch(e){ console.error('[跨端同步库] 资产推送失败：', e); if(!silent) showToast('推送失败：' + (e && e.message ? e.message : e)); return false; }
    }

    // 列出云端某类资产：两个平台文件夹都扫一遍，合并显示（谁推送的都能看到）
    async function assetCloudList(kind){
      if (!cloudConfigured()) return [];
      var platforms = ['tavo', 'st'];
      var out = [];
      for (var i=0;i<platforms.length;i++){
        var files = await ghListDir(GH_DATA_DIR + '/' + platforms[i] + '/' + ASSET_KINDS[kind].dir);
        files.filter(function(f){ return f.type === 'file' && /\.json$/i.test(f.name); })
          .forEach(function(f){ out.push({ name: f.name.replace(/\.json$/i,''), path: f.path, platform: platforms[i], sha: f.sha }); });
      }
      return out;
    }

    async function assetCloudFetch(path){
      try {
        var f = await ghGetFile(path);
        if (!f) return null;
        return JSON.parse(f.content);
      } catch(e){ console.error('[跨端同步库] 资产云端详情读取失败：', e); return null; }
    }

    // 把云端某个资产应用到本地：本地已存在同名的就更新，不存在就新建（这两步都会弹出 Tavo 自己的确认框）
    // 注：这里统一走 create/update，不用 import——因为我们云端存的是 tavo.*.get() 原样导出的 tavo 原生字段格式，
    // 而 tavo.*.import() 按官方文档是吃 SillyTavern/CCv3 格式（字段名不一样），用 import 会导致字段对不上。
    async function assetApplyFromCloud(kind, path){
      try {
        var data = await assetCloudFetch(path);
        if (!data) { showToast('读取云端数据失败'); return false; }
        var existing = [];
        try { existing = await ASSET_KINDS[kind].find(data.name); } catch(e){}
        if (existing && existing.length) {
          var merged = Object.assign({}, data, { id: existing[0].id });
          await ASSET_KINDS[kind].updateFn(merged);
          showToast(ASSET_KINDS[kind].label + '「' + data.name + '」已更新到本地');
        } else {
          var withoutId = Object.assign({}, data); delete withoutId.id;
          await ASSET_KINDS[kind].createFn(withoutId);
          showToast(ASSET_KINDS[kind].label + '「' + data.name + '」已导入到本地');
        }
        return true;
      } catch(e){ console.error('[跨端同步库] 资产应用失败：', e); showToast('应用失败：' + (e && e.message ? e.message : e)); return false; }
    }

    // 批量应用：多选之后依次处理，返回 {ok, fail}
    async function assetApplyMultipleFromCloud(kind, paths, onProgress){
      var ok = 0, fail = 0;
      for (var i=0;i<paths.length;i++){
        if (onProgress) onProgress(i+1, paths.length);
        var success = await assetApplyFromCloudSilent(kind, paths[i]);
        if (success) ok++; else fail++;
        await sleep(150);
      }
      return { ok: ok, fail: fail };
    }
    async function assetApplyFromCloudSilent(kind, path){
      try {
        var data = await assetCloudFetch(path);
        if (!data) return false;
        var existing = [];
        try { existing = await ASSET_KINDS[kind].find(data.name); } catch(e){}
        if (existing && existing.length) {
          var merged = Object.assign({}, data, { id: existing[0].id });
          await ASSET_KINDS[kind].updateFn(merged);
        } else {
          var withoutId = Object.assign({}, data); delete withoutId.id;
          await ASSET_KINDS[kind].createFn(withoutId);
        }
        return true;
      } catch(e){ console.error('[跨端同步库] 资产应用失败：', e); return false; }
    }

    // ===== 尝试自动获取当前角色名（若 API 不可用则要求用户手动填写并记住） =====
    async function tryAutoCharName(){
      try {
        if (TV.chat && typeof TV.chat.current === 'function') {
          var chat = await TV.chat.current();
          if (chat && Array.isArray(chat.characters) && chat.characters[0] && chat.characters[0].name) {
            return String(chat.characters[0].name);
          }
        }
      } catch(e){}
      return '';
    }

    // ===== 读取当前聊天窗口最近消息 =====
    async function recentMsgs(n){
      try {
        var c = await TV.message.count();
        if (!c) return [];
        var from = Math.max(0, c - n);
        var m = await TV.message.find([from, c-1]);
        return Array.isArray(m) ? m : [];
      } catch(e){ return []; }
    }

    function fmtTime(ms){ try{ return new Date(ms).toLocaleString(); }catch(e){ return ''; } }
    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function uid(){ return 'x'+Date.now()+'_'+Math.floor(Math.random()*100000); }

    // ===== 保存当前角色对话为快照，写入全局索引 =====
    async function saveSnapshot(note){
      var name = myName();
      if (!name) { showToast('请先在设置里填写本角色的名称标签'); return false; }
      var msgs = await recentMsgs(MAX_MSG_PER_SNAP);
      if (!msgs.length) { showToast('当前没有可保存的对话内容'); return false; }
      var simplified = msgs.map(function(m){
        m = m || {};
        var item = {
          role: m.role,
          content: String(m.content || ''),
          time: m.time || Date.now(),
          name: m.name || '',
          is_user: typeof m.is_user === 'boolean' ? m.is_user : m.role === 'user',
          is_system: typeof m.is_system === 'boolean' ? m.is_system : m.role === 'system',
          original_avatar: m.original_avatar || '',
          extra: (m.extra && typeof m.extra === 'object') ? m.extra : {}
        };
        return item;
      });
      var id = uid();
      var entry = { id: id, charName: name, savedAt: Date.now(), msgCount: simplified.length, note: note || '' };
      await pushG(SNAP_PREFIX + id, { meta: entry, messages: simplified });
      var list = idx();
      list.unshift(entry);
      if (list.length > MAX_SNAPS) {
        var removed = list.slice(MAX_SNAPS);
        list = list.slice(0, MAX_SNAPS);
        for (var i=0;i<removed.length;i++){ try{ await TV.set(SNAP_PREFIX+removed[i].id, '', GLOBAL_SCOPE); }catch(e){} }
      }
      cache[IDX_KEY] = list;
      await pushG(IDX_KEY, list);
      showToast('已保存「'+name+'」的对话快照');
      return true;
    }

    async function deleteSnapshot(id){
      var list = idx().filter(function(e){ return e.id !== id; });
      cache[IDX_KEY] = list;
      await pushG(IDX_KEY, list);
      try { await TV.set(SNAP_PREFIX+id, '', GLOBAL_SCOPE); } catch(e){}
    }

    // ===== 把选中的快照组装成一段可编辑文本，写入输入框（不自动发送，交给用户确认再发） =====
    // 每条消息按"发言人 + 分隔符 + 时间 + 分隔符 + 内容"拼成一行。
    // 分隔符用一个正常代码/文本里几乎不可能出现的特殊字符，
    // 避免这段拼接代码自己的源码文本被后面的显示正则误当成一条对话内容处理。
    function esc4tag(s){ return String(s==null?'':s).replace(/"/g,'&quot;'); }
    var SEP = '◈';
    // items: [{id, source, platform}]，source 是 'local' 或 'cloud'
    async function bringIntoInput(items){
      if (!items.length) { showToast('请先勾选想调取的对话'); return; }
      var blocks = [];
      for (var i=0;i<items.length;i++){
        var it = items[i];
        var snap = null;
        if (it.source === 'cloud') {
          snap = await cloudFetchItem(it.id, it.platform);
        } else {
          snap = await pullG(SNAP_PREFIX + it.id);
        }
        if (!snap || !snap.messages) continue;
        var meta = snap.meta || {};
        var lines = snap.messages.map(function(m){
          var who = m.role === 'user' ? '我' : (meta.charName || '对方');
          var t = fmtTime(m.time || meta.savedAt);
          // 把内容里的换行统一转成 <br>，避免消息本身是多段落时产生"空行"，
          // 导致 Markdown 渲染器把 <details> 折叠块在空行处提前截断
          var content = String(m.content||'').replace(/\[\[/g,'［［').replace(/\]\]/g,'］］').replace(/\r\n/g,'\n').replace(/\n+/g,'<br>');
          return who + SEP + t + SEP + content;
        }).join('\n');
        var name = esc4tag(meta.charName || '未知角色');
        var cnt = meta.msgCount || snap.messages.length;
        var time = esc4tag(fmtTime(meta.savedAt));
        blocks.push('[[CCM_MERGE name="'+name+'" count="'+cnt+'" time="'+time+'"]]\n'+lines+'\n[[/CCM_MERGE]]');
      }
      if (!blocks.length) { showToast('没有取到有效内容'); return; }
      var text = blocks.join('\n\n');
      try {
        var existing = await TV.input.get();
        if (existing) text = String(existing) + '\n\n' + text;
        await TV.input.set(text);
        showToast('已带入输入框，请确认后再发送');
      } catch(e){ showToast('写入输入框失败'); }
    }

    // 把选中的对话快照分别导出成 .jsonl 文件（跟云端保存的格式一样），
    // 用 tavo.utils.export 触发系统分享/保存，方便直接甩给别人或导入其他平台
    async function exportSnapshotsAsFiles(items){
      if (!items.length) { showToast('请先勾选想导出的对话'); return; }
      if (!TV.utils || typeof TV.utils.export !== 'function') { showToast('当前环境不支持导出文件（tavo.utils.export 不可用）'); return; }
      var okCount = 0;
      for (var i=0;i<items.length;i++){
        var it = items[i];
        var snap = null;
        if (it.source === 'cloud') {
          snap = await cloudFetchItem(it.id, it.platform);
        } else {
          snap = await pullG(SNAP_PREFIX + it.id);
        }
        if (!snap || !snap.messages) continue;
        var meta = snap.meta || {};
        var platform = it.platform || meta.platform || PLATFORM;
        var jsonl = buildChatlogJsonl({ charName: meta.charName, savedAt: meta.savedAt, msgCount: meta.msgCount || snap.messages.length, note: meta.note || '', platform: platform }, snap.messages);
        var platformLabel = PLATFORM_LABEL[platform] || 'Tavo';
        var cnt = meta.msgCount || snap.messages.length;
        var fname = platformLabel + '_' + (meta.charName || '对话') + '_' + cnt + 'GPs.jsonl';
        try {
          await TV.utils.export(fname, b64encode(jsonl));
          okCount++;
        } catch(e){ console.error('[跨端同步库] 导出失败：', fname, e); }
      }
      showToast(okCount ? ('已导出 ' + okCount + ' 份 .jsonl 文件') : '导出失败，请看控制台日志');
    }

    // ===== UI =====
    var el = function(id){ return D.getElementById(id); };
    var lastOpenRequest = null;

    function openPanelFromContribution(){
      build();
      var ov = el('ccm-overlay');
      if (!ov) return false;
      ov.classList.add('open');
      switchTab(activeTab && activeTab !== 'pull' ? activeTab : 'conv');
      return true;
    }

    try {
      var rootWindow = window.top || window;
      rootWindow.__CCM_CROSS_SYNC_OPEN__ = openPanelFromContribution;
    } catch(e0) {
      window.__CCM_CROSS_SYNC_OPEN__ = openPanelFromContribution;
    }

    async function checkOpenRequest(){
      try {
        var request = await pullG(OPEN_KEY);
        var marker = request && typeof request === 'object' ? request.at : request;
        if (marker && marker !== lastOpenRequest) {
          lastOpenRequest = marker;
          openPanelFromContribution();
        }
      } catch(e1){}
    }
    function showToast(msg){
      var t = el('ccm-toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._t);
      t._t = setTimeout(function(){ t.classList.remove('show'); }, 2000);
    }

    function buildStyle(){
      if (el('ccm-style')) return;
      var style = D.createElement('style');
      style.id = 'ccm-style';
      style.textContent = `
        #ccm-fab { position:fixed; right:14px; bottom:78px; z-index:2147483646; width:34px; height:34px; border-radius:50%; background:rgba(30,30,40,0.7); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.25); box-shadow:0 6px 18px rgba(0,0,0,0.35); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; touch-action:none; user-select:none; }
        #ccm-fab-dot { position:fixed; right:12px; bottom:106px; width:11px; height:11px; border-radius:50%; background:#FF5A5F; border:2px solid #1B1B24; pointer-events:none; z-index:2147483647; display:none; }
        #ccm-fab:active { transform:scale(0.88); }
        .ccm-overlay { position:fixed; inset:0; z-index:2147483647; background:rgba(10,10,16,0.5); backdrop-filter:blur(3px); display:none; align-items:flex-end; justify-content:center; padding:0; font-family:-apple-system,'PingFang SC','Noto Sans SC',system-ui,sans-serif; }
        .ccm-overlay.open { display:flex; }
        .ccm-card { width:100%; max-width:480px; height:auto; max-height:78vh; background:#1B1B24; border-radius:20px 20px 0 0; box-shadow:0 -8px 32px rgba(0,0,0,0.5); padding:14px 16px 16px; overflow-y:auto; -webkit-overflow-scrolling:touch; touch-action:pan-y; overscroll-behavior:contain; position:relative; border:1px solid rgba(255,255,255,0.08); border-bottom:none; display:flex; flex-direction:column; color:#E8E6F0; animation:ccmSlideUp 0.2s ease; }
        @keyframes ccmSlideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        .ccm-card::-webkit-scrollbar { width:7px; }
        .ccm-card::-webkit-scrollbar-track { background:rgba(255,255,255,0.04); border-radius:4px; }
        .ccm-card::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.4); border-radius:4px; }
        .ccm-card { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.4) rgba(255,255,255,0.04); }
        .ccm-title { font-size:19px; font-weight:800; text-align:center; margin-bottom:2px; }
        .ccm-subtitle { font-size:11px; color:#9A97AE; text-align:center; margin-bottom:12px; line-height:1.5; }
        .ccm-tabs { display:flex; gap:6px; margin-bottom:10px; }
        .ccm-tab { flex:1; text-align:center; padding:8px 0; border-radius:12px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.06); cursor:pointer; color:#B8B5C8; position:relative; }
        .ccm-tab-dot { display:none; position:absolute; top:4px; right:8px; width:7px; height:7px; border-radius:50%; background:#FF5A5F; }
        .ccm-tab.on { background:#6C5CE7; color:#fff; }
        .ccm-section { margin-bottom:10px; }
        .ccm-label { font-size:12px; font-weight:700; color:#C8C5D8; margin-bottom:4px; display:block; }
        .ccm-input { width:100%; box-sizing:border-box; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:#E8E6F0; font-size:13px; outline:none; }
        .ccm-input:focus { border-color:#6C5CE7; }
        .ccm-btn { padding:9px 14px; border:none; border-radius:24px; font-size:13px; font-weight:800; cursor:pointer; background:#6C5CE7; color:#fff; text-align:center; }
        .ccm-btn:active { transform:scale(0.96); }
        .ccm-btn.full { width:100%; }
        .ccm-btn.outline { background:transparent; border:1.5px solid rgba(255,255,255,0.2); color:#E8E6F0; }
        .ccm-btn.small { padding:5px 10px; font-size:11px; }
        .ccm-close { position:absolute; top:12px; right:12px; width:30px; height:30px; border-radius:50%; border:none; background:rgba(255,255,255,0.08); color:#E8E6F0; font-size:15px; cursor:pointer; }
        .ccm-list-item { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 12px; margin-bottom:8px; }
        .ccm-item-head { display:flex; align-items:center; gap:8px; }
        .ccm-item-head input[type=checkbox] { width:16px; height:16px; flex:none; }
        .ccm-item-name { font-weight:800; font-size:13px; flex:1; }
        .ccm-item-time { font-size:10px; color:#9A97AE; }
        .ccm-item-note { font-size:11px; color:#B8B5C8; margin-top:4px; }
        .ccm-item-actions { display:flex; justify-content:flex-end; margin-top:6px; }
        .ccm-empty { text-align:center; color:#7A7790; font-size:12px; padding:24px 0; }
        .ccm-toast { position:fixed; bottom:40px; left:50%; transform:translateX(-50%); background:#2A2A38; color:#fff; padding:8px 16px; border-radius:24px; font-size:12px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.3); z-index:2147483651; opacity:0; transition:opacity 0.3s; pointer-events:none; }
        .ccm-toast.show { opacity:1; }
        .ccm-footer { text-align:center; font-size:10px; color:#6A6780; margin-top:auto; padding-top:8px; flex:none; }
      `;
      D.head.appendChild(style);
    }

    var activeTab = 'conv';

    async function renderList(keyword){
      var box = el('ccm-list');
      if (!box) return;
      box.innerHTML = `<div class='ccm-empty'>加载中...</div>`;
      var list = [];
      try {
        var name = myName();
        list = await combinedList(name);
        if (keyword) {
          var kw = keyword.trim().toLowerCase();
          list = list.filter(function(e){
            return (e.charName||'').toLowerCase().indexOf(kw)!==-1 || (e.note||'').toLowerCase().indexOf(kw)!==-1;
          });
        }
      } catch (eOuter) {
        // 兜底：就算合并/过滤逻辑本身出了意外，也不能让界面一直停在"加载中"
        box.innerHTML = `<div class='ccm-empty'>加载失败，请重试。<br>${esc(eOuter && eOuter.message ? eOuter.message : String(eOuter))}</div>`;
        return;
      }
      if (!list.length) { box.innerHTML = `<div class='ccm-empty'>没有匹配的对话快照。<br>先去其他角色窗口打开插件，保存一份记录吧。</div>`; return; }
      var groups = { tavo: [], st: [], other: [] };
      list.forEach(function(e){ (groups[e.platform] || groups.other).push(e); });
      var order = [['tavo','📁 Tavo'], ['st','📁 SillyTavern'], ['other','📁 其他']];
      var html = '';
      order.forEach(function(pair){
        var key = pair[0], label = pair[1];
        var items = groups[key];
        if (!items.length) return;
        html += `<div style='font-size:11px;font-weight:800;color:#9A97AE;margin:6px 0 4px;'>${label}</div>`;
        items.forEach(function(e){
          var seenKey = 'conv:' + (e.platform||'unknown') + ':' + e.id;
          var isNew = e.source === 'cloud' && seenIsNew(seenKey, e.savedAt);
          if (e.source === 'cloud') seenQueue(seenKey, e.savedAt);
          html += `<div class='ccm-list-item'>
            <div class='ccm-item-head'>
              <input type='checkbox' class='ccm-pick' data-id='${e.id}' data-source='${e.source}' data-platform='${e.platform||''}'>
              <div class='ccm-item-name'>${esc(e.charName)}${isNew ? ` <span style='color:#FF5A5F;font-size:10px;font-weight:800;'>NEW</span>` : ''}</div>
              <div class='ccm-item-time'>${esc(fmtTime(e.savedAt))} · ${e.msgCount}条</div>
            </div>
            ${e.note ? `<div class='ccm-item-note'>${esc(e.note)}</div>` : ''}
            <div class='ccm-item-actions'><button class='ccm-btn small outline ccm-del' data-id='${e.id}' data-source='${e.source}' data-platform='${e.platform||''}'>删除</button></div>
          </div>`;
        });
      });
      await seenFlush();
      box.innerHTML = html;
      box.querySelectorAll('.ccm-del').forEach(function(btn){
        btn.addEventListener('click', async function(){
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

    var currentAssetKind = 'character';
    // 角色卡/正则/世界书三个标签页共用同一套 DOM（靠 refreshAssetPanel 按 currentAssetKind 重新渲染），
    // 如果推送/应用进行到一半时用户切换了标签页，旧的进度提示不该继续往（已经被换成别的分类的）同一批 DOM 里写字，
    // 不然就会看到"明明在世界书标签页，进度却显示的是正则"这种串台。用一个递增的世代号来判断"这次操作还是不是当前这次打开"。
    var assetPanelGen = 0;

    function switchTab(tab){
      activeTab = tab;
      el('ccm-tab-conv').className = 'ccm-tab' + (tab==='conv' ? ' on' : '');
      el('ccm-tab-character').className = 'ccm-tab' + (tab==='character' ? ' on' : '');
      el('ccm-tab-regex').className = 'ccm-tab' + (tab==='regex' ? ' on' : '');
      el('ccm-tab-lorebook').className = 'ccm-tab' + (tab==='lorebook' ? ' on' : '');
      el('ccm-tab-overview').className = 'ccm-tab' + (tab==='overview' ? ' on' : '');
      el('ccm-tab-net').className = 'ccm-tab' + (tab==='net' ? ' on' : '');
      el('ccm-panel-conv').style.display = tab==='conv' ? '' : 'none';
      var isAsset = (tab==='character' || tab==='regex' || tab==='lorebook');
      el('ccm-panel-assets').style.display = isAsset ? '' : 'none';
      el('ccm-panel-overview').style.display = tab==='overview' ? '' : 'none';
      el('ccm-panel-net').style.display = tab==='net' ? '' : 'none';
      if (tab==='conv') {
        renderList(el('ccm-search') ? el('ccm-search').value : '');
        refreshUpdateTargets();
      }
      if (isAsset) { currentAssetKind = tab; refreshAssetPanel(); }
      if (tab==='overview') { refreshOverview(); }
      if (tab==='net') {
        if (el('ccm-cloud-token')) el('ccm-cloud-token').value = ghToken();
        if (el('ccm-cloud-repo')) el('ccm-cloud-repo').value = ghRepo();
        if (el('ccm-cloud-branch')) el('ccm-cloud-branch').value = ghBranch();
      }
      setTimeout(refreshCategoryDots, 300);
    }

    // 把当前分类（角色卡/正则/世界书其中一个）本地全部内容一键推送到云端，不需要一个个勾选
    async function pushAllOfKind(kind){
      if (!cloudConfigured()) { showToast('请先在"云同步设置"里配置好 GitHub Token 和仓库'); return; }
      var gen = assetPanelGen;
      var box = el('ccm-asset-push-all-kind-result');
      var list = await assetLocalList(kind);
      if (gen !== assetPanelGen) return;
      if (list === null) { box.textContent = ASSET_KINDS[kind].label + '：接口不可用'; return; }
      if (!list.length) { box.textContent = ASSET_KINDS[kind].label + '：本地暂无内容'; return; }
      var ok = 0, fail = 0;
      for (var i=0;i<list.length;i++){
        if (gen === assetPanelGen) box.textContent = '正在推送：' + (i+1) + '/' + list.length;
        var success = await assetPushToCloud(kind, list[i].id, true);
        if (success) ok++; else fail++;
        await sleep(200);
      }
      if (gen === assetPanelGen) {
        box.textContent = '完成：成功 ' + ok + ' 个' + (fail ? ('，失败 ' + fail + ' 个') : '');
        await sleep(1200);
        refreshAssetPanel();
      }
      showToast(ASSET_KINDS[kind].label + '一键推送完成：成功 ' + ok + ' 个' + (fail ? ('，失败 ' + fail + ' 个') : ''));
    }

    // 清空云端某一类资产（角色卡/正则/世界书三选一），两个平台文件夹都清，用于处理"云端已经有旧测试数据"这种情况
    async function clearCloudAssetsOfKind(kind, onProgress){
      if (!cloudConfigured()) { showToast('请先配置云同步'); return false; }
      try {
        var platforms = ['tavo', 'st'];
        var deleted = 0;
        for (var i=0;i<platforms.length;i++){
          var dir = GH_DATA_DIR + '/' + platforms[i] + '/' + ASSET_KINDS[kind].dir;
          var files = await ghListDir(dir);
          for (var j=0;j<files.length;j++){
            if (files[j].type !== 'file') continue;
            if (onProgress) onProgress(platforms[i], j+1, files.length);
            await ghDeleteFile(files[j].path, files[j].sha, '清空资产：' + files[j].name);
            deleted++;
            await sleep(150);
          }
        }
        return deleted;
      } catch(e){ console.error('[跨端同步库] 清空云端资产失败：', e); return false; }
    }

    async function clearCloudAssetsOfKindUI(kind){
      if (!cloudConfigured()) { showToast('请先配置云同步'); return; }
      var box = el('ccm-asset-clear-kind-result');
      box.textContent = '正在清空...';
      var result = await clearCloudAssetsOfKind(kind, function(platform, i, total){
        box.textContent = '正在删除 ' + PLATFORM_LABEL[platform] + ' 的' + ASSET_KINDS[kind].label + '：' + i + '/' + total;
      });
      if (result === false) { box.textContent = '清空失败，请看控制台日志'; showToast('清空失败'); }
      else { box.textContent = '已清空云端 ' + result + ' 份' + ASSET_KINDS[kind].label; showToast('已清空，可以重新开始了'); refreshAssetPanel(); }
    }

    // 清空云端全部对话记录（两个平台的所有快照文件 + 共享索引），供"从头开始"用
    async function clearCloudConversationsUI(){
      if (!cloudConfigured()) { showToast('请先配置云同步'); return; }
      var box = el('ccm-clear-conv-result');
      box.textContent = '正在清空...';
      var result = await clearCloudConversations(function(platform, i, total){
        box.textContent = '正在删除 ' + PLATFORM_LABEL[platform] + ' 的记录：' + i + '/' + total;
      });
      if (result === false) { box.textContent = '清空失败，请看控制台日志'; showToast('清空失败'); }
      else { box.textContent = '已清空云端 ' + result + ' 条对话记录'; showToast('已清空，可以重新开始了'); renderList(''); }
    }

    async function refreshAssetPanel(){
      assetPanelGen++;
      var myGen = assetPanelGen;
      var kind = currentAssetKind;
      var localBox = el('ccm-asset-local-list');
      var cloudBox = el('ccm-asset-cloud-list');
      if (el('ccm-asset-kind-label')) el('ccm-asset-kind-label').textContent = ASSET_KINDS[kind].label;
      if (el('ccm-asset-select-all')) el('ccm-asset-select-all').checked = false;
      if (el('ccm-asset-cloud-select-all')) el('ccm-asset-cloud-select-all').checked = false;
      if (el('ccm-asset-push-result')) el('ccm-asset-push-result').textContent = '';
      if (el('ccm-asset-push-all-kind-result')) el('ccm-asset-push-all-kind-result').textContent = '';
      if (el('ccm-asset-apply-result')) el('ccm-asset-apply-result').textContent = '';
      if (el('ccm-asset-clear-kind-result')) el('ccm-asset-clear-kind-result').textContent = '';
      localBox.innerHTML = "<div class='ccm-empty'>加载中...</div>";
      cloudBox.innerHTML = "<div class='ccm-empty'>加载中...</div>";
      var cloud = await assetCloudList(kind);
      if (myGen !== assetPanelGen) return; // 这期间又切换了标签页，这份数据已经过时，别再往 DOM 里写了
      var cloudNameSet = {};
      cloud.forEach(function(it){ cloudNameSet[it.name] = true; });
      var list = await assetLocalList(kind);
      if (myGen !== assetPanelGen) return;
      if (list === null) {
        localBox.innerHTML = "<div class='ccm-empty'>这个环境读不到"+esc(ASSET_KINDS[kind].label)+"（tavo."+kind+" 接口不可用）</div>";
      } else if (!list.length) {
        localBox.innerHTML = "<div class='ccm-empty'>本地暂无"+esc(ASSET_KINDS[kind].label)+"</div>";
      } else {
        // 注意：勾选框不会因为"云端已有同名的"就自动帮你打勾——是否推送永远由你自己勾选决定，
        // 这里只是用灰色 + "已同步"提示告诉你哪些云端已经有了，方便你判断要不要重新推送覆盖。
        localBox.innerHTML = list.map(function(it){
          var synced = !!cloudNameSet[it.name];
          return "<label style='display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;cursor:pointer;"+(synced?'color:#8A87A0;':'')+"'>"
            + "<input type='checkbox' class='ccm-asset-pick' value='"+esc(it.id)+"' style='width:15px;height:15px;flex:none;'>"
            + "<span>"+esc(it.name)+"</span>"
            + (synced ? "<span style='font-size:10px;color:#7A9C8A;margin-left:2px;'>（云端已有同名）</span>" : "")
            + "</label>";
        }).join('');
      }
      if (!cloud.length) {
        cloudBox.innerHTML = "<div class='ccm-empty'>云端还没有"+esc(ASSET_KINDS[kind].label)+"，先从本地推送一个吧</div>";
      } else {
        var groups = { tavo: [], st: [], other: [] };
        cloud.forEach(function(it){ (groups[it.platform] || groups.other).push(it); });
        var order = [['tavo','📁 Tavo'], ['st','📁 SillyTavern'], ['other','📁 其他']];
        var html = '';
        order.forEach(function(pair){
          var pk = pair[0], plabel = pair[1];
          var items = groups[pk];
          if (!items.length) return;
          html += "<div style='font-size:11px;font-weight:800;color:#9A97AE;margin:6px 0 4px;'>"+plabel+"</div>";
          items.forEach(function(it){
            var seenKey = 'asset:' + kind + ':' + it.platform + ':' + it.name;
            var isNew = seenIsNew(seenKey, it.sha);
            seenQueue(seenKey, it.sha);
            html += "<label style='display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;cursor:pointer;'>"
              + "<input type='checkbox' class='ccm-asset-cloud-pick' value='"+esc(it.path)+"' style='width:15px;height:15px;flex:none;'>"
              + "<span>"+esc(it.name)+"</span>"+(isNew ? " <span style='color:#FF5A5F;font-size:10px;font-weight:800;'>NEW</span>" : "")
              + "</label>";
          });
        });
        await seenFlush();
        if (myGen !== assetPanelGen) return;
        cloudBox.innerHTML = html;
      }
    }

    // ===== "云端总览"标签：一级按平台文件夹分（📁 Tavo / 📁 SillyTavern），
    // 二级在每个平台文件夹里再分对话记录/角色卡/正则/世界书四类，只读浏览 + "去操作"跳转按钮。
    // 平台和分类两级都可以点标题折叠/展开——分类默认收起（内容量最大的地方），平台默认展开。=====
    function flashLocatedItem(node){
      if (!node || !node.style) return;
      var oldBoxShadow = node.style.boxShadow;
      var oldOutline = node.style.outline;
      node.style.boxShadow = '0 0 0 2px rgba(111,92,230,0.85), 0 0 18px rgba(111,92,230,0.35)';
      node.style.outline = 'none';
      setTimeout(function(){
        node.style.boxShadow = oldBoxShadow;
        node.style.outline = oldOutline;
      }, 1600);
    }

    function locateCloudOverviewItem(kind, id, platform, path, name){
      var tab = kind === 'conv' ? 'conv' : kind;
      switchTab(tab);
      var attempts = 0;
      (function waitForList(){
        attempts++;
        var hit = null;
        if (kind === 'conv') {
          Array.prototype.slice.call(D.querySelectorAll('.ccm-pick')).some(function(c){
            var ok = c.getAttribute('data-id') === id
              && c.getAttribute('data-source') === 'cloud'
              && (!platform || c.getAttribute('data-platform') === platform);
            if (ok) hit = c;
            return ok;
          });
          if (hit) Array.prototype.slice.call(D.querySelectorAll('.ccm-pick')).forEach(function(c){ c.checked = false; });
        } else {
          Array.prototype.slice.call(D.querySelectorAll('.ccm-asset-cloud-pick')).some(function(c){
            var ok = c.value === path;
            if (ok) hit = c;
            return ok;
          });
          if (hit) Array.prototype.slice.call(D.querySelectorAll('.ccm-asset-cloud-pick')).forEach(function(c){ c.checked = false; });
        }
        if (hit) {
          hit.checked = true;
          var item = hit.closest ? (hit.closest('.ccm-list-item') || hit.closest('label')) : hit.parentElement;
          if (item && item.scrollIntoView) item.scrollIntoView({ block:'center', behavior:'smooth' });
          flashLocatedItem(item || hit);
          showToast('???????' + (name || '????'));
          return;
        }
        if (attempts < 25) { setTimeout(waitForList, 200); return; }
        showToast('?????????????????');
      })();
    }

    async function refreshOverview(){
      var box = el('ccm-overview-body');
      if (!box) return;
      box.innerHTML = "<div class='ccm-empty'>加载中...</div>";
      if (!cloudConfigured()) { box.innerHTML = "<div class='ccm-empty'>还没有配置云同步，先去"+"\"云同步设置\""+"里填好 GitHub Token 和仓库吧</div>"; return; }
      try {
        var conv = await cloudList();
        var chars = await assetCloudList('character');
        var regexes = await assetCloudList('regex');
        var lores = await assetCloudList('lorebook');
        var categories = [
          { key: 'conv', label: '对话记录', tab: 'conv', items: conv, nameOf: function(it){ return it.charName; }, timeOf: function(it){ return fmtTime(it.savedAt)+' · '+it.msgCount+'条'; } },
          { key: 'character', label: '角色卡', tab: 'character', items: chars, nameOf: function(it){ return it.name; }, timeOf: function(){ return ''; } },
          { key: 'regex', label: '正则', tab: 'regex', items: regexes, nameOf: function(it){ return it.name; }, timeOf: function(){ return ''; } },
          { key: 'lorebook', label: '世界书', tab: 'lorebook', items: lores, nameOf: function(it){ return it.name; }, timeOf: function(){ return ''; } }
        ];
        var platforms = [['tavo', '📁 Tavo'], ['st', '📁 SillyTavern']];
        var html = '';
        platforms.forEach(function(pp){
          var pk = pp[0], plabel = pp[1];
          var anyItem = categories.some(function(c){ return c.items.some(function(it){ return it.platform === pk; }); });
          var pBodyId = 'ccm-ov-body-' + pk;
          html += "<div class='ccm-ov-toggle' data-target='"+pBodyId+"' style='display:flex;align-items:center;gap:6px;cursor:pointer;font-size:16px;font-weight:800;margin:16px 0 8px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);'>"
            + "<span class='ccm-ov-arrow'>▼</span><span>"+plabel+"</span></div>";
          if (!anyItem) { html += "<div class='ccm-empty' style='padding:6px 0 10px;'>这个平台还没有同步任何内容</div>"; return; }
          html += "<div id='"+pBodyId+"'>";
          categories.forEach(function(c){
            var filtered = c.items.filter(function(it){ return it.platform === pk; });
            if (!filtered.length) return;
            var cBodyId = 'ccm-ov-body-' + pk + '-' + c.key;
            html += "<div style='margin:8px 0 4px;'>"
              + "<div class='ccm-ov-toggle' data-target='"+cBodyId+"' style='display:flex;align-items:center;gap:6px;cursor:pointer;'>"
              + "<span class='ccm-ov-arrow'>▶</span>"
              + "<span style='font-weight:700;font-size:12.5px;color:#C7C4DA;flex:1;'>"+c.label+"（"+filtered.length+"）</span>"
              + "<button class='ccm-btn small outline ccm-overview-jump' data-tab='"+c.tab+"'>去操作 →</button>"
              + "</div></div>"
              + "<div id='"+cBodyId+"' style='display:none;'>";
            filtered.forEach(function(it){
              var itemId = c.key === 'conv' ? (it.id || '') : '';
              var itemPath = c.key === 'conv' ? '' : (it.path || '');
              var itemName = c.nameOf(it) || '';
              html += "<div class='ccm-list-item ccm-overview-item' data-kind='"+esc(c.key)+"' data-id='"+esc(itemId)+"' data-platform='"+esc(it.platform||'')+"' data-path='"+esc(itemPath)+"' data-name='"+esc(itemName)+"' title='???????' style='margin-bottom:6px;cursor:pointer;'><div class='ccm-item-head'><div class='ccm-item-name'>"+esc(itemName)+"</div>"
                + (c.timeOf(it) ? "<div class='ccm-item-time'>"+esc(c.timeOf(it))+"</div>" : '') + "</div></div>";
            });
            html += "</div>";
          });
          html += "</div>";
        });
        box.innerHTML = html;
        box.querySelectorAll('.ccm-ov-toggle').forEach(function(h){
          h.addEventListener('click', function(){
            var body = el(this.getAttribute('data-target'));
            var arrow = this.querySelector('.ccm-ov-arrow');
            if (!body) return;
            var isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
          });
        });
        box.querySelectorAll('.ccm-overview-jump').forEach(function(btn){
          btn.addEventListener('click', function(e){
            e.stopPropagation(); // ????"???"????????????/??
            switchTab(this.getAttribute('data-tab'));
          });
        });
        box.querySelectorAll('.ccm-overview-item').forEach(function(item){
          item.addEventListener('click', function(e){
            e.stopPropagation();
            locateCloudOverviewItem(
              this.getAttribute('data-kind'),
              this.getAttribute('data-id') || '',
              this.getAttribute('data-platform') || '',
              this.getAttribute('data-path') || '',
              this.getAttribute('data-name') || ''
            );
          });
        });
      } catch(e){
        box.innerHTML = "<div class='ccm-empty'>加载失败：" + esc(e && e.message ? e.message : String(e)) + "</div>";
      }
    }

    // 保存标签页里的"保存方式"下拉：列出本角色之前存过的记录，选中即可覆盖更新那一条，而不是每次都新建一条
    function refreshUpdateTargets(){
      var sel = el('ccm-update-target');
      if (!sel) return;
      var name = myName();
      var mine = idx().filter(function(e){ return e.charName === name; });
      var html = "<option value=''>存为新记录</option>";
      mine.forEach(function(e){
        html += "<option value='"+e.id+"'>更新："+fmtTime(e.savedAt)+" · "+e.msgCount+"条"+(e.note?(' · '+esc(e.note)):'')+"</option>";
      });
      sel.innerHTML = html;
    }

    function build(){
      buildStyle();
      if (!el('ccm-fab')) {
        var fab = D.createElement('div');
        fab.id = 'ccm-fab';
        fab.innerHTML = '🔀';
        D.body.appendChild(fab);
        fab.addEventListener('click', function(e){
          e.stopPropagation();
          var ov = el('ccm-overlay');
          if (ov.classList.contains('open')) { ov.classList.remove('open'); return; }
          ov.classList.add('open');
          switchTab(activeTab && activeTab !== 'pull' ? activeTab : 'conv');
        });
      }
      if (!el('ccm-fab-dot')) {
        var dot = D.createElement('div');
        dot.id = 'ccm-fab-dot';
        D.body.appendChild(dot);
        refreshPendingDot();
      }
      if (!el('ccm-overlay')) {
        var ov = D.createElement('div');
        ov.className = 'ccm-overlay';
        ov.id = 'ccm-overlay';
        ov.innerHTML = `
          <div class='ccm-card'>
            <button class='ccm-close' id='ccm-close'>✕</button>
            <div class='ccm-title'>🔄 跨端同步库</div>
            <div class='ccm-subtitle'>对话记录 / 角色卡 / 正则 / 世界书，按需保存或调取</div>
            <div class='ccm-tabs'>
              <div class='ccm-tab on' id='ccm-tab-conv'>对话记录<span class='ccm-tab-dot' id='ccm-tab-conv-dot'></span></div>
              <div class='ccm-tab' id='ccm-tab-character'>角色卡<span class='ccm-tab-dot' id='ccm-tab-character-dot'></span></div>
              <div class='ccm-tab' id='ccm-tab-regex'>正则<span class='ccm-tab-dot' id='ccm-tab-regex-dot'></span></div>
              <div class='ccm-tab' id='ccm-tab-lorebook'>世界书<span class='ccm-tab-dot' id='ccm-tab-lorebook-dot'></span></div>
              <div class='ccm-tab' id='ccm-tab-overview'>云端总览</div>
              <div class='ccm-tab' id='ccm-tab-net'>云同步设置</div>
            </div>
            <div id='ccm-panel-conv'>
              <div class='ccm-section'>
                <label class='ccm-label'>本角色名称标签 <small style='color:#7A7790;'>（用于在其他窗口区分来源，仅需填一次）</small></label>
                <input class='ccm-input' id='ccm-my-name' placeholder='例如：小明 / 咖啡店老板娘'>
              </div>
              <div class='ccm-section'>
                <label class='ccm-label'>保存方式</label>
                <select class='ccm-input' id='ccm-update-target'><option value=''>存为新记录</option></select>
              </div>
              <div class='ccm-section'>
                <label class='ccm-label'>备注（可选）</label>
                <input class='ccm-input' id='ccm-note' placeholder='例如：第一次约会那段'>
              </div>
              <div class='ccm-section'>
                <label class='ccm-label'>保存最近几条消息</label>
                <select class='ccm-input' id='ccm-snap-count'>
                  <option value='100'>100条</option>
                  <option value='50'>50条</option>
                  <option value='20' selected>20条</option>
                  <option value='10'>10条</option>
                  <option value='5'>5条</option>
                </select>
              </div>
              <button class='ccm-btn full' id='ccm-save'>保存当前对话快照</button>
              <hr style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;'>
              <div class='ccm-section'>
                <input class='ccm-input' id='ccm-search' placeholder='搜索角色名或备注...'>
              </div>
              <div class='ccm-section' id='ccm-list' style='flex:1;'></div>
              <button class='ccm-btn full' id='ccm-bring'>带入当前对话框</button>
              <button class='ccm-btn full outline' id='ccm-export' style='margin-top:8px;'>导出选中为 .jsonl 文件</button>
              <div class='ccm-footer'>快照仅保存文本内容，不含图片；全局最多保留 ${MAX_SNAPS} 份，超出后自动清理最早的；云端保存 / 导出均为通用 .jsonl 聊天记录格式，可直接导入其他平台</div>
              <hr style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;'>
              <div class='ccm-section'>
                <label class='ccm-label' style='color:#FF5A5F;'>危险操作</label>
                <button class='ccm-btn full outline' id='ccm-clear-conv' style='border-color:#FF5A5F;color:#FF5A5F;'>清空云端全部对话记录</button>
                <div id='ccm-clear-conv-result' style='font-size:11px;color:#B8B5C8;margin-top:6px;line-height:1.6;'></div>
              </div>
            </div>
            <div id='ccm-panel-assets' style='display:none;'>
              <div class='ccm-section'>
                <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>
                  <label class='ccm-label' style='margin-bottom:0;'>本地：勾选要推送到云端的<span id='ccm-asset-kind-label'></span></label>
                  <label style='font-size:11px;color:#B8B5C8;display:flex;align-items:center;gap:4px;white-space:nowrap;'>
                    <input type='checkbox' id='ccm-asset-select-all'> 全选
                  </label>
                </div>
                <div id='ccm-asset-local-list' style='max-height:180px;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:2px 8px;'></div>
              </div>
              <button class='ccm-btn full' id='ccm-asset-push'>推送选中到云端</button>
              <div id='ccm-asset-push-result' style='font-size:11px;color:#B8B5C8;margin-top:6px;line-height:1.6;'></div>
              <button class='ccm-btn full outline' id='ccm-asset-push-all-kind' style='margin-top:8px;'>一键推送本地全部到云端</button>
              <div id='ccm-asset-push-all-kind-result' style='font-size:11px;color:#B8B5C8;margin-top:6px;line-height:1.6;'></div>
              <div class='ccm-section' style='margin-top:14px;'>
                <div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>
                  <label class='ccm-label' style='margin-bottom:0;'>云端：勾选要应用到本地的 <small style='color:#7A7790;'>（应用时 Tavo 会弹出确认框，需要你手动确认）</small></label>
                  <label style='font-size:11px;color:#B8B5C8;display:flex;align-items:center;gap:4px;white-space:nowrap;'>
                    <input type='checkbox' id='ccm-asset-cloud-select-all'> 全选
                  </label>
                </div>
                <div id='ccm-asset-cloud-list'></div>
              </div>
              <button class='ccm-btn full' id='ccm-asset-apply-selected'>应用选中到本地</button>
              <div id='ccm-asset-apply-result' style='font-size:11px;color:#B8B5C8;margin-top:6px;line-height:1.6;'></div>
              <div class='ccm-footer' style='margin-top:6px;'>应用云端资产时，若本地已有同名的会更新，没有就新建；灰色文字并标注"云端已有同名"的仅供参考，勾选框不会自动帮你选，要不要重新推送由你自己决定；新出现的云端内容会标红色 NEW</div>
              <hr style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;'>
              <div class='ccm-section'>
                <label class='ccm-label' style='color:#FF5A5F;'>危险操作</label>
                <button class='ccm-btn full outline' id='ccm-asset-clear-kind' style='border-color:#FF5A5F;color:#FF5A5F;'>清空云端本类全部内容</button>
                <div id='ccm-asset-clear-kind-result' style='font-size:11px;color:#B8B5C8;margin-top:6px;line-height:1.6;'></div>
              </div>
            </div>
            <div id='ccm-panel-overview' style='display:none;'>
              <div class='ccm-subtitle' style='margin-bottom:10px;'>汇总查看四个分类已经同步到云端的内容，按平台文件夹分组；点"去操作"跳到对应标签页去推送/应用/删除</div>
              <div id='ccm-overview-body'></div>
            </div>
            <div id='ccm-panel-net' style='display:none;'>
              <div class='ccm-section'>
                <label class='ccm-label'>GitHub Token <small style='color:#7A7790;'>（Personal Access Token，勾选 repo 权限那种）</small></label>
                <input class='ccm-input' id='ccm-cloud-token' placeholder='ghp_ 开头的一长串'>
              </div>
              <div class='ccm-section'>
                <label class='ccm-label'>仓库 <small style='color:#7A7790;'>（格式：用户名/仓库名）</small></label>
                <input class='ccm-input' id='ccm-cloud-repo' placeholder='例如：your-name/your-sync-repo'>
              </div>
              <div class='ccm-section'>
                <label class='ccm-label'>分支 <small style='color:#7A7790;'>（不确定就填 main）</small></label>
                <input class='ccm-input' id='ccm-cloud-branch' placeholder='main'>
              </div>
              <button class='ccm-btn full' id='ccm-cloud-save-cfg'>保存云同步设置</button>
              <div class='ccm-footer' style='margin-top:6px;'>不填的话插件只在本设备本地保存/调取，不影响正常使用；批量推送/清空等操作已经分别放到"对话记录"和"角色卡/正则/世界书"各自的标签页里了</div>
              <hr class='ccm-divider-net' style='border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0;'>
              <div class='ccm-section'>
                <label class='ccm-label'>连通性测试 <small style='color:#7A7790;'>（不影响上面的云同步配置，纯粹测试这个环境能不能发外部请求）</small></label>
                <input class='ccm-input' id='ccm-net-url' value='https://api.github.com'>
              </div>
              <button class='ccm-btn full outline' id='ccm-net-test'>发送测试请求</button>
              <div class='ccm-section' style='margin-top:10px;'>
                <div id='ccm-net-result' style='font-size:12px;color:#B8B5C8;line-height:1.6;white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;min-height:40px;'>点击上面的按钮开始测试</div>
              </div>
            </div>
          </div>`;
        D.body.appendChild(ov);
        ov.addEventListener('click', function(e){ if (e.target===ov) ov.classList.remove('open'); });
        if (!el('ccm-toast')) { var tt=D.createElement('div'); tt.className='ccm-toast'; tt.id='ccm-toast'; D.body.appendChild(tt); }
        bind();
      }
    }

    function bind(){
      el('ccm-close').addEventListener('click', function(){ el('ccm-overlay').classList.remove('open'); });
      el('ccm-tab-conv').addEventListener('click', function(){ switchTab('conv'); });
      el('ccm-tab-character').addEventListener('click', function(){ switchTab('character'); });
      el('ccm-tab-regex').addEventListener('click', function(){ switchTab('regex'); });
      el('ccm-tab-lorebook').addEventListener('click', function(){ switchTab('lorebook'); });
      el('ccm-tab-net').addEventListener('click', function(){ switchTab('net'); });
      el('ccm-asset-select-all').addEventListener('change', function(){
        var checked = this.checked;
        D.querySelectorAll('.ccm-asset-pick').forEach(function(c){ c.checked = checked; });
      });
      el('ccm-asset-push').addEventListener('click', async function(){
        var kind = currentAssetKind; // 固定住这次点击时的分类，中途切标签页也不受影响
        var gen = assetPanelGen;
        var ids = Array.prototype.slice.call(D.querySelectorAll('.ccm-asset-pick:checked')).map(function(c){ return c.value; });
        if (!ids.length) { showToast('请先勾选要推送的'+ASSET_KINDS[kind].label); return; }
        if (!cloudConfigured()) { showToast('请先在"云同步设置"里配置好 GitHub Token 和仓库'); return; }
        var box = el('ccm-asset-push-result');
        var ok = 0, fail = 0;
        for (var i=0;i<ids.length;i++){
          if (gen === assetPanelGen) box.textContent = '正在推送：' + (i+1) + '/' + ids.length;
          var success = await assetPushToCloud(kind, ids[i], true);
          if (success) ok++; else fail++;
          await sleep(200);
        }
        if (gen === assetPanelGen) {
          box.textContent = '完成：成功 ' + ok + ' 个' + (fail ? ('，失败 ' + fail + ' 个') : '');
          await sleep(1200);
          refreshAssetPanel();
        }
        showToast(ASSET_KINDS[kind].label + '推送完成：成功 ' + ok + ' 个' + (fail ? ('，失败 ' + fail + ' 个') : ''));
      });
      el('ccm-asset-push-all-kind').addEventListener('click', function(){ pushAllOfKind(currentAssetKind); });
      el('ccm-asset-clear-kind').addEventListener('click', function(){ clearCloudAssetsOfKindUI(currentAssetKind); });
      el('ccm-asset-cloud-select-all').addEventListener('change', function(){
        var checked = this.checked;
        D.querySelectorAll('.ccm-asset-cloud-pick').forEach(function(c){ c.checked = checked; });
      });
      el('ccm-asset-apply-selected').addEventListener('click', async function(){
        var kind = currentAssetKind; // 同上：固定住这次点击时的分类
        var gen = assetPanelGen;
        var paths = Array.prototype.slice.call(D.querySelectorAll('.ccm-asset-cloud-pick:checked')).map(function(c){ return c.value; });
        if (!paths.length) { showToast('请先勾选要应用到本地的' + ASSET_KINDS[kind].label); return; }
        var box = el('ccm-asset-apply-result');
        var result = await assetApplyMultipleFromCloud(kind, paths, function(i, total){
          if (gen === assetPanelGen) box.textContent = '正在应用：' + i + '/' + total;
        });
        if (gen === assetPanelGen) { box.textContent = '完成：成功 ' + result.ok + ' 个' + (result.fail ? ('，失败 ' + result.fail + ' 个') : ''); refreshAssetPanel(); }
        showToast(ASSET_KINDS[kind].label + '应用完成：成功 ' + result.ok + ' 个' + (result.fail ? ('，失败 ' + result.fail + ' 个') : ''));
      });
      el('ccm-clear-conv').addEventListener('click', function(){ clearCloudConversationsUI(); });
      el('ccm-tab-overview').addEventListener('click', function(){ switchTab('overview'); });
      el('ccm-search').addEventListener('input', function(){ renderList(this.value); });
      el('ccm-bring').addEventListener('click', function(){
        var items = Array.prototype.slice.call(D.querySelectorAll('.ccm-pick:checked')).map(function(c){
          return { id: c.getAttribute('data-id'), source: c.getAttribute('data-source'), platform: c.getAttribute('data-platform') };
        });
        bringIntoInput(items);
      });
      el('ccm-export').addEventListener('click', function(){
        var items = Array.prototype.slice.call(D.querySelectorAll('.ccm-pick:checked')).map(function(c){
          return { id: c.getAttribute('data-id'), source: c.getAttribute('data-source'), platform: c.getAttribute('data-platform') };
        });
        exportSnapshotsAsFiles(items);
      });
      el('ccm-my-name').value = myName();
      el('ccm-my-name').addEventListener('change', async function(){
        var v = this.value.trim();
        cache[NAME_KEY] = v;
        await pushC(NAME_KEY, v);
        showToast('已记住本角色名称');
        refreshPendingDot();
      });
      el('ccm-save').addEventListener('click', async function(){
        var raw = el('ccm-snap-count').value;
        var cnt;
        if (raw === 'all') {
          var totalNow = 0;
          try { totalNow = await TV.message.count(); } catch(e){}
          cnt = totalNow || MAX_MSG_PER_SNAP;
        } else {
          cnt = Number(raw) || 20;
        }
        cnt = Math.max(1, Math.min(MAX_MSG_PER_SNAP, cnt));
        var note = el('ccm-note').value.trim();
        var targetId = el('ccm-update-target') ? el('ccm-update-target').value : '';
        var ok = await saveSnapshotWithCount(note, cnt, targetId || null);
        if (ok) { el('ccm-note').value=''; refreshUpdateTargets(); }
      });
      el('ccm-cloud-save-cfg').addEventListener('click', async function(){
        var token = el('ccm-cloud-token').value.trim();
        var repo = el('ccm-cloud-repo').value.trim().replace(/^\/|\/$/g,'');
        var branch = el('ccm-cloud-branch').value.trim() || 'main';
        cache[GH_TOKEN_KEY] = token;
        cache[GH_REPO_KEY] = repo;
        cache[GH_BRANCH_KEY] = branch;
        await pushG(GH_TOKEN_KEY, token);
        await pushG(GH_REPO_KEY, repo);
        await pushG(GH_BRANCH_KEY, branch);
        showToast(token && repo ? '云同步设置已保存' : '已清空云同步设置（只用本地存储）');
      });
      el('ccm-net-test').addEventListener('click', async function(){
        var url = el('ccm-net-url').value.trim();
        var box = el('ccm-net-result');
        if (!url) { showToast('请先填一个测试地址'); return; }
        box.textContent = '请求中...';
        var t0 = Date.now();
        try {
          // 用标准浏览器 fetch，不经过 tavo.* API，专门测试这个脚本运行的环境
          // 允不允许直接访问外部网络
          var resp = await fetch(url, { method: 'GET' });
          var ms = Date.now() - t0;
          var bodyPreview = '';
          try {
            var text = await resp.text();
            bodyPreview = text.length > 200 ? text.slice(0, 200) + '...' : text;
          } catch (e0) { bodyPreview = '(读取响应内容失败：' + (e0 && e0.message ? e0.message : e0) + ')'; }
          box.textContent = '✅ 请求成功\n状态码：' + resp.status + '\n耗时：' + ms + 'ms\n响应预览：\n' + bodyPreview;
          showToast('请求成功，状态码 ' + resp.status);
        } catch (e1) {
          var ms2 = Date.now() - t0;
          box.textContent = '❌ 请求失败（耗时 ' + ms2 + 'ms）\n错误信息：' + (e1 && e1.message ? e1.message : String(e1)) + '\n\n如果这里报错，大概率说明这个脚本运行的环境不允许直接发外部网络请求（比如被 CSP 策略拦截），需要换别的思路（比如通过 Tavo 官方 API 转发，而不是脚本直接 fetch）。';
          showToast('请求失败，看下面的详情');
        }
      });
    }

    // 支持自定义保存条数（不改动默认常量，避免影响其他调用点）
    async function saveSnapshotWithCount(note, cnt, existingId){
      var name = myName();
      if (!name) { showToast('请先填写本角色的名称标签'); return false; }
      var msgs = await recentMsgs(cnt);
      if (!msgs.length) { showToast('当前没有可保存的对话内容'); return false; }
      var simplified = msgs.map(function(m){ return { role: m.role, content: String(m.content||'').slice(0,2000), time: m.time || Date.now() }; });
      var totalNow = 0;
      try { totalNow = await TV.message.count(); } catch(e){}
      var id = existingId || uid();
      var entry = { id: id, charName: name, savedAt: Date.now(), msgCount: simplified.length, note: note || '', totalAtSave: totalNow };
      await pushG(SNAP_PREFIX + id, { meta: entry, messages: simplified });
      var list = idx();
      var pos = list.findIndex(function(e){ return e.id === id; });
      if (pos !== -1) {
        list[pos] = entry;
      } else {
        list.unshift(entry);
        if (list.length > MAX_SNAPS) {
          var removed = list.slice(MAX_SNAPS);
          list = list.slice(0, MAX_SNAPS);
          for (var i=0;i<removed.length;i++){ try{ await TV.set(SNAP_PREFIX+removed[i].id, '', GLOBAL_SCOPE); }catch(e){} }
        }
      }
      cache[IDX_KEY] = list;
      await pushG(IDX_KEY, list);
      var cloudOk = false;
      if (cloudConfigured()) { cloudOk = await cloudSave(entry, simplified); }
      showToast((existingId?'已更新':'已保存')+'「'+name+'」的对话快照（'+simplified.length+'条）'+(cloudConfigured() ? (cloudOk ? '，云端同步成功' : '，云端同步失败（看控制台日志）') : ''));
      await refreshPendingDot();
      return true;
    }

    // ===== "有新内容还没同步"的提醒小红点 =====
    async function hasPendingUpdate(){
      try {
        var name = myName();
        if (!name) return false;
        var mine = idx().filter(function(e){ return e.charName === name; });
        if (!mine.length) return false;
        var latest = mine.reduce(function(a,b){ return (a.savedAt||0) > (b.savedAt||0) ? a : b; });
        var totalNow = await TV.message.count();
        return totalNow > (latest.totalAtSave || 0);
      } catch(e){ return false; }
    }

    async function refreshPendingDot(){
      var dot = el('ccm-fab-dot');
      if (!dot) return;
      var pending = await hasPendingUpdate();
      dot.style.display = pending ? 'block' : 'none';
    }

    // ===== 检查各个顶部分类里有没有还没看过的云端新内容，只是"看一眼"，不会标记为已读
    // （真正标记已读是在用户实际打开那个分类的标签页、看到列表渲染出来的时候）=====
    function setDotEl(id, show){ var d = el(id); if (d) d.style.display = show ? 'block' : 'none'; }
    async function refreshCategoryDots(){
      if (!cloudConfigured()) { setDotEl('ccm-tab-conv-dot', false); setDotEl('ccm-tab-character-dot', false); setDotEl('ccm-tab-regex-dot', false); setDotEl('ccm-tab-lorebook-dot', false); return; }
      try {
        var conv = await cloudList();
        setDotEl('ccm-tab-conv-dot', conv.some(function(it){ return seenIsNew('conv:' + (it.platform||'unknown') + ':' + it.id, it.savedAt); }));
      } catch(e){}
      var kinds = ['character', 'regex', 'lorebook'];
      for (var i=0;i<kinds.length;i++){
        try {
          var kind = kinds[i];
          var cloud = await assetCloudList(kind);
          setDotEl('ccm-tab-' + kind + '-dot', cloud.some(function(it){ return seenIsNew('asset:' + kind + ':' + it.platform + ':' + it.name, it.sha); }));
        } catch(e){}
      }
    }

    // ===== 首次启动时自动注册"折叠卡片 + 气泡染色"这 3 条显示用正则脚本 =====
    // 用 tavo.regex.find/create 官方接口做，不用再让用户额外导入一张角色卡。
    // 如果这几个接口在插件运行时里不可用，就静默跳过（不影响悬浮按钮等其他功能）。
    var DISPLAY_REGEX_GROUP_NAME = '跨端同步库-显示样式';
    async function ensureDisplayRegexes(){
      try {
        if (!TV.regex || !TV.regex.find || !TV.regex.create) {
          console.warn('[跨端同步库] tavo.regex 接口不可用，跳过自动注册显示正则（需要手动导入配套角色卡）');
          return;
        }
        var existing = await TV.regex.find(DISPLAY_REGEX_GROUP_NAME, { match: 'exact' });
        if (existing && existing.length) return; // 已经建过了，不重复建

        var outerFind = '/\\[\\[CCM_MERGE name="([^"]*)" count="([^"]*)" time="([^"]*)"\\]\\](\\n[\\s\\S]*?)\\n\\[\\[\\/CCM_MERGE\\]\\]/g';
        var outerReplace = `<details style="border:1px solid #E0E0E0;border-radius:10px;margin:6px 0;overflow:hidden;background:#FFFFFF;max-width:320px;box-shadow:0 1px 4px rgba(0,0,0,0.08);color:#333333;"><summary style="display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer;"><span style="font-size:17px;">📎</span><span style="display:inline-block;vertical-align:middle;"><span style="font-size:13px;font-weight:800;color:#333333;display:block;">$1</span><span style="font-size:10px;color:#999999;display:block;margin-top:1px;">$2条 · $3</span></span></summary><div style="padding:8px 12px 10px;border-top:1px solid #EEEEEE;background:#FFFFFF;color:#333333;">$4</div></details>`;

        var selfFind = '/^我' + SEP + '([^' + SEP + '\\n]+)' + SEP + '(.*)$/gm';
        var selfReplace = `<div style="background:#E3F0FF;border-top:1px solid #C7DEFB;border-radius:8px;padding:6px 9px;margin-top:6px;"><div><span style="color:#1E6FE0;font-weight:800;font-size:11px;">我</span> <span style="color:#7A96B8;font-size:9px;">$1</span></div><div style="font-size:11px;color:#333333;margin-top:2px;line-height:1.5;word-break:break-word;">$2</div></div>`;

        var otherFind = '/^([^' + SEP + '\\n]+)' + SEP + '([^' + SEP + '\\n]+)' + SEP + '(.*)$/gm';
        var otherReplace = `<div style="background:#F6E8FA;border-top:1px solid #E9CDF1;border-radius:8px;padding:6px 9px;margin-top:6px;"><div><span style="color:#B23FA0;font-weight:800;font-size:11px;">$1</span> <span style="color:#B296BC;font-size:9px;">$2</span></div><div style="font-size:11px;color:#333333;margin-top:2px;line-height:1.5;word-break:break-word;">$3</div></div>`;

        await TV.regex.create({
          name: DISPLAY_REGEX_GROUP_NAME,
          entries: [
            { name: '合并转发卡片展示', findRegex: outerFind, replaceString: outerReplace, placements: ['user','char'], timing: 'display', trimStrings: [], substitution: 'none', enabled: true },
            { name: '我方发言气泡', findRegex: selfFind, replaceString: selfReplace, placements: ['user','char'], timing: 'display', trimStrings: [], substitution: 'none', enabled: true },
            { name: '对方发言气泡', findRegex: otherFind, replaceString: otherReplace, placements: ['user','char'], timing: 'display', trimStrings: [], substitution: 'none', enabled: true }
          ]
        });
        console.log('[跨端同步库] 已自动注册显示正则（会弹出一次 Tavo 的确认框）');
      } catch(e){ console.error('[跨端同步库] 自动注册显示正则失败：', e); }
    }

    // ===== 启动 =====
    (async function(){
      await loadAll();
      if (!myName()) {
        var auto = await tryAutoCharName();
        if (auto) { cache[NAME_KEY] = auto; await pushC(NAME_KEY, auto); }
      }
      build();
      checkOpenRequest();
      // 定时重新检查一次，防止 DOM 因为消息列表回收/重渲染等原因把悬浮按钮清掉后不再出现
      setInterval(build, 3000);
      setInterval(checkOpenRequest, 1200);
      setInterval(refreshPendingDot, 8000); // 定期检查当前角色有没有新消息还没同步进快照
      setInterval(refreshCategoryDots, 15000); // 定期检查四个分类标签有没有还没看过的云端新内容
      ensureDisplayRegexes();
      console.log('[跨端同步库] 已启动');
      refreshPendingDot();
      refreshCategoryDots();
    })();

  } catch(e){ console.error('[跨端同步库] 启动失败', e); }
})();
(function(){
  "use strict";

  async function openCrossSync(){
    try {
      var root = window.top || window;
      if (root && typeof root.__CCM_CROSS_SYNC_OPEN__ === "function") {
        root.__CCM_CROSS_SYNC_OPEN__();
        return { opened: true };
      }
    } catch (_) {}

    try {
      if (typeof window.__CCM_CROSS_SYNC_OPEN__ === "function") {
        window.__CCM_CROSS_SYNC_OPEN__();
        return { opened: true };
      }
    } catch (_) {}

    try {
      if (typeof tavo !== "undefined" && tavo.utils && typeof tavo.utils.toast === "function") {
        await tavo.utils.toast("跨端同步库面板没有初始化，请重新进入聊天页或开启 Advanced Rendering");
      }
    } catch (_) {}
    return { opened: false };
  }

  if (typeof tavo !== "undefined" && tavo.plugin && typeof tavo.plugin.on === "function") {
    tavo.plugin.on("inputActions:open-cross-sync", openCrossSync);
    tavo.plugin.on("sidebar:open-cross-sync", openCrossSync);
  }
})();
