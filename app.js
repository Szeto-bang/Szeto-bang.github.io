/* ===================================================================
 * 接种公告 · 佛山  —  应用逻辑
 * 数据：佛山市卫生健康局公布的《佛山市预防接种门诊信息》(2026-09-20)
 * 实时公告：粤苗公开接口 https://ymapp.cdcp.org.cn/nipisgd/getNoticeAppAction.action
 * 说明：门诊需在 clinics 数据中填写 organCode 后，才会拉取并显示实时公告。
 * =================================================================== */
(function () {
  "use strict";

  var API = "https://ymapp.cdcp.org.cn/nipisgd/getNoticeAppAction.action";
  var CACHE_KEY = "foshan-vaccine-notices:v1";

  /* ---------- 图标 ---------- */
  var ICONS = {
    building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M2 21h20M9 7h2M9 11h2M9 15h2M16 9h4v12"/>',
    location: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1Z"/>',
    warning: '<path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
    refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    cloud: '<path d="M18 10h-1.3A5 5 0 1 0 7 9.5 3.5 3.5 0 0 0 7 17h11a3.5 3.5 0 0 0 0-7Z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/>'
  };
  function icon(name, size) {
    size = size || 18;
    return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + "</svg>";
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toDate(v) {
    if (!v) return null;
    var s = String(v).indexOf("T") > -1 ? String(v) : String(v).replace(" ", "T");
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(v, withYear) {
    var d = toDate(v);
    if (!d) return v || "尚未获取";
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return (withYear === false ? "" : d.getFullYear() + "/") + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function telLink(phone) {
    var p = esc(phone);
    return '<a href="tel:' + p + '">' + p + "</a>";
  }

  function relDate(v, now) {
    var d = toDate(v);
    if (!d) return null;
    now = now || new Date();
    var a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    var n = Math.floor((a - b) / 86400000);
    if (n < 0) return null;
    if (n === 0) return "今天";
    if (n === 1) return "昨天";
    return n + "天前";
  }

  /* ---------- 公告 HTML 清洗（白名单，防注入） ---------- */
  var KEEP = new Set(["P", "DIV", "SPAN", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"]);
  var DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "OPTION", "LINK", "META", "SVG", "MATH", "IMG", "A", "VIDEO", "AUDIO", "CANVAS"]);
  var COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i;

  function safeStyle(raw) {
    var out = [];
    raw.split(";").forEach(function (decl) {
      var i = decl.indexOf(":");
      if (i === -1) return;
      var k = decl.slice(0, i).trim().toLowerCase();
      var v = decl.slice(i + 1).trim();
      if (k === "color" && COLOR.test(v)) out.push("color:" + v);
      else if (k === "text-align" && /^(left|right|center|justify)$/.test(v)) out.push("text-align:" + v);
      else if (k === "font-weight" && /^(normal|bold|[1-9]00)$/.test(v)) out.push("font-weight:" + v);
      else if (k === "font-style" && /^(normal|italic)$/.test(v)) out.push("font-style:" + v);
      else if (k === "text-decoration" && /^(none|underline|line-through)$/.test(v)) out.push("text-decoration:" + v);
    });
    return out.join(";");
  }
  function cleanNode(node) {
    Array.prototype.slice.call(node.children).forEach(function (el) {
      if (DROP.has(el.tagName)) { el.remove(); return; }
      if (!KEEP.has(el.tagName)) { el.replaceWith.apply(el, Array.prototype.slice.call(el.childNodes)); return; }
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var isSpan = (name === "colspan" || name === "rowspan") && /^(?:[1-9]|1\d|20)$/.test(attr.value);
        if (name === "style") {
          var s = safeStyle(attr.value);
          if (s) el.setAttribute("style", s); else el.removeAttribute("style");
        } else if (!isSpan) {
          el.removeAttribute(attr.name);
        }
      });
      cleanNode(el);
    });
  }
  function sanitize(html) {
    var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  /* ---------- 缺苗信息提取 ---------- */
  function extractSupply(html) {
    var lines = String(html || "")
      .split(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi)
      .map(function (chunk) {
        return (new DOMParser().parseFromString(chunk, "text/html").body.textContent || "")
          .replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      })
      .filter(function (t) { return /缺苗|缺货|暂无|没苗|无苗/.test(t); })
      .sort(function (a, b) { return a.length - b.length; })
      .map(function (t) {
        var m = t.match(/[^。；]{0,18}(?:缺苗|缺货|暂无|没苗|无苗)[^。；]{0,200}[。；]?/);
        return (m && m[0].trim()) || t.slice(0, 200);
      });
    return Array.from(new Set(lines.filter(Boolean))).slice(0, 3);
  }

  /* ---------- 接口 ---------- */
  function fetchNotice(clinic, signal) {
    if (!clinic.organCode) {
      return Promise.reject(new Error("该门诊尚未配置粤苗门诊编码（organCode），暂无法读取实时公告。"));
    }
    var body = new URLSearchParams({
      orgCode: clinic.organCode,
      noticeType: "1",
      type: "3",
      appType: "1",
      version: "2.0.28"
    });
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString(),
      signal: signal
    }).then(function (res) {
      if (!res.ok) throw new Error("接口返回 " + res.status);
      return res.json();
    }).then(function (json) {
      var item = json && json.message && json.message[0];
      if (!item || !item.noticeContion) {
        if (json && json.statusCode === "300") throw new Error("门诊未发布公告（接口返回“系统维护中”）");
        throw new Error("接口未返回公告正文");
      }
      return {
        noticeId: item.noticeId,
        inputDate: item.inputDate,
        updatedAt: item.updDate,
        html: sanitize(item.noticeContion),
        supplySummary: extractSupply(item.noticeContion)
      };
    });
  }

  /* ---------- 状态 ---------- */
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; }
  }
  var cache = loadCache();
  var REGIONS = [];
  var CLINICS = [];
  (function bindData() {
    var d = window.__VACCINE_DATA__;
    if (d) { REGIONS = d.REGIONS || []; CLINICS = d.CLINICS || []; }
    else window.addEventListener("vaccine-data-ready", bindData, { once: true });
  })();

  var state = {
    data: (cache && cache.data) || {},
    lastRefresh: (cache && cache.lastRefresh) || null,
    refreshing: false,
    menuOpen: false
  };

  /* ---------- 渲染：侧栏 ---------- */
  function renderNav() {
    var nav = document.getElementById("station-list");
    var current = currentId();
    nav.innerHTML = REGIONS.map(function (region) {
      var items = CLINICS.filter(function (c) { return c.region === region.name; }).map(function (c) {
        var st = state.data[c.id];
        var sub;
        if (!c.organCode) sub = "官方信息 · 未接入实时公告";
        else if (st && st.error) sub = "获取失败";
        else if (st && st.notice) sub = "更新于 " + fmtDate(st.notice.updatedAt, false) + "（" + relDate(st.notice.updatedAt) + "）";
        else sub = "等待获取";
        return '<button class="station-option ' + (c.id === current ? "is-active" : "") + '" data-id="' + c.id + '">' +
          icon("building", 25) +
          '<span><strong>' + esc(c.shortName) + "</strong><small>" + esc(sub) + "</small></span>" +
          icon("arrow") +
          "</button>";
      }).join("");
      return '<div class="station-group"><div class="station-group-title">' + esc(region.name) + "（" + CLINICS.filter(function (c) { return c.region === region.name; }).length + "）</div>" + items + "</div>";
    }).join("");
  }

  function currentId() {
    var wanted = new URLSearchParams(location.search).get("station");
    if (wanted && CLINICS.some(function (c) { return c.id === wanted; })) return wanted;
    return CLINICS[0].id;
  }

  /* ---------- 渲染：主内容 ---------- */
  function hoursTable(hours) {
    // 开诊时间以文本呈现，能解析出“星期X…时间”时自动补一张表
    var m = String(hours).match(/(\d{1,2}:\d{2})\s*[—\-–~至]+\s*(\d{1,2}:\d{2})/);
    if (!m) return "";
    return '<div class="hours-times"><span>' + icon("clock", 16) + "上午 " + esc(m[1]) + "—" + esc(m[2]) + "</span></div>";
  }

  function renderMain() {
    var clinic = CLINICS.find(function (c) { return c.id === currentId(); }) || CLINICS[0];
    var st = state.data[clinic.id] || {};
    var notice = st.notice || null;
    var main = document.getElementById("main");

    var head =
      '<section class="notice-heading"><div><h1>' + esc(clinic.name) + "</h1>" +
      '<div class="clinic-details">' +
      "<span>" + icon("location", 17) + esc(clinic.address) + "</span>" +
      '<a href="tel:' + esc(clinic.phoneFull) + '">' + icon("phone", 17) + esc(clinic.phoneFull) + "</a>" +
      "</div></div>" +
      (notice
        ? "<p>公告更新时间：<strong>" + esc(fmtDate(notice.updatedAt)) + "</strong>" +
          (relDate(notice.updatedAt) ? '<span class="relative-date">（' + relDate(notice.updatedAt) + "）</span>" : "") + "</p>"
        : '<p class="source-pill">' + icon("calendar", 15) + "官方公布 2026-09-20</p>") +
      '<button class="share-btn" type="button" data-share="' + esc(clinic.id) + '">' + icon("external", 14) + "复制这家门诊的链接</button>" +
      "</section>";

    /* 供应提示 */
    var supply;
    if (!clinic.organCode) {
      supply =
        '<section class="supply-panel is-soft" aria-labelledby="supply-title">' + icon("info", 24) +
        '<div><h2 id="supply-title">疫苗供应提示</h2>' +
        "<p>该门诊暂未接入粤苗实时公告，缺苗信息请以门诊现场或电话告知为准。下方为官方公布的开诊时间与预约方式。</p></div></section>";
    } else if (notice) {
      var list = notice.supplySummary || [];
      supply =
        '<section class="supply-panel" aria-labelledby="supply-title">' + icon("warning", 24) +
        '<div><h2 id="supply-title">疫苗供应提示</h2>' +
        (list.length
          ? "<ul>" + list.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"
          : "<p>公告未明确列出缺苗信息，请查看下方完整原文。</p>") +
        "</div></section>";
    } else if (st.error) {
      supply =
        '<section class="supply-panel is-soft" aria-labelledby="supply-title">' + icon("info", 24) +
        '<div><h2 id="supply-title">疫苗供应提示</h2><p>暂时无法读取该门诊公告：' + esc(st.error) + "</p></div></section>";
    } else {
      supply = '<section class="supply-panel is-soft"><div><h2>疫苗供应提示</h2><p>正在读取门诊公告…</p></div></section>';
    }

    /* 正文 */
    var doc;
    if (notice) {
      doc =
        '<article class="notice-document"><div class="document-label">门诊公告原文</div>' +
        '<div class="remote-notice">' + notice.html + "</div></article>";
    } else {
      doc =
        '<article class="notice-document is-info"><div class="document-label">门诊公开信息</div>' +
        '<div class="detail-block"><h3>' + icon("calendar", 18) + "开诊时间</h3><p>" + esc(clinic.hours) + "</p></div>" +
        '<div class="detail-block"><h3>' + icon("cloud", 18) + "预约方式</h3><p>" + esc(clinic.booking) + "</p></div>" +
        '<div class="detail-block"><h3>' + icon("location", 18) + "地址</h3><p>" + esc(clinic.address) + "</p></div>" +
        '<div class="detail-block"><h3>' + icon("phone", 18) + "咨询电话</h3><p>" + telLink(clinic.phoneFull) + "</p></div>" +
        '<p class="detail-foot">以上信息来自佛山市卫生健康局 2026-09-20 发布的《佛山市预防接种门诊信息》，可能随政策调整，请以现场告知为准。</p>' +
        "</article>";
    }

    /* 来源说明 */
    var apiState = clinic.organCode
      ? (notice ? '<span class="api-state"><i></i>接口可用</span>' : (st.error ? '<span class="api-state is-off"><i></i>接口异常</span>' : '<span class="api-state is-wait"><i></i>读取中</span>'))
      : '<span class="api-state is-off"><i></i>未接入</span>';
    var source =
      '<section class="source-note">' + icon("info", 19) +
      "<div><strong>数据来源：佛山市卫生健康局公开信息</strong>" +
      "<p>" + (clinic.organCode
        ? "实时公告按粤苗公开接口返回内容展示，公告可能因库存、运输或政策调整而变化，前往接种前请再次刷新并向门诊确认。"
        : "门诊基本信息来自官方公布名单；实时缺苗公告需接入粤苗门诊编码后自动显示，前往接种前请电话确认。") +
      "</p></div>" + apiState + "</section>";

    main.className = "content";
    main.innerHTML = head + supply + doc + source;
  }

  function renderTop() {
    var meta = document.querySelector(".refresh-meta span");
    var live = CLINICS.filter(function (c) { return c.organCode; }).length;
    meta.textContent = "上次成功刷新：" + fmtDate(state.lastRefresh) + (live ? "" : " · 已接入 " + live + "/" + CLINICS.length);
    var btn = document.querySelector(".refresh-button");
    btn.disabled = state.refreshing;
    btn.innerHTML = '<span class="' + (state.refreshing ? "spin" : "") + '">' + icon("refresh") + "</span>" + (state.refreshing ? "刷新中" : "刷新公告");
  }

  function render() {
    document.querySelector(".station-nav").classList.toggle("is-open", state.menuOpen);
    document.querySelector(".nav-scrim").classList.toggle("is-open", state.menuOpen);
    renderTop();
    renderNav();
    renderMain();
  }

  /* ---------- 刷新 ---------- */
  var ctrl = null;
  function refresh() {
    if (state.refreshing) return;
    var live = CLINICS.filter(function (c) { return c.organCode; });
    if (!live.length) {
      state.lastRefresh = new Date().toISOString();
      save();
      render();
      return;
    }
    state.refreshing = true;
    renderTop();
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    var signal = ctrl.signal;
    Promise.allSettled(live.map(function (c) { return fetchNotice(c, signal); })).then(function (results) {
      if (signal.aborted) return;
      var ok = false;
      var next = Object.assign({}, state.data);
      results.forEach(function (r, i) {
        var id = live[i].id;
        if (r.status === "fulfilled") {
          ok = true;
          next[id] = { notice: r.value, error: null };
        } else {
          next[id] = { notice: (state.data[id] && state.data[id].notice) || null, error: (r.reason && r.reason.message) || "请求失败" };
        }
      });
      state.data = next;
      if (ok) state.lastRefresh = new Date().toISOString();
      state.refreshing = false;
      save();
      render();
    });
  }

  function save() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: state.data, lastRefresh: state.lastRefresh }));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  /* ---------- 交互 ---------- */
  function select(id) {
    state.menuOpen = false;
    var url = new URL(location.href);
    url.searchParams.set("station", id);
    history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "auto" });
    render();
  }

  function copyLink(btn) {
    var url = new URL(location.href);
    url.searchParams.set("station", btn.getAttribute("data-share"));
    var text = url.toString();
    var done = function () {
      btn.textContent = "已复制 ✓";
      setTimeout(function () { btn.innerHTML = icon("external", 14) + "复制这家门诊的链接"; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { window.prompt("复制这个链接：", text); }
      document.body.removeChild(ta);
    }
  }

  document.addEventListener("click", function (e) {
    var opt = e.target.closest(".station-option");
    if (opt) { select(opt.getAttribute("data-id")); return; }
    if (e.target.closest(".menu-button")) { state.menuOpen = true; render(); return; }
    if (e.target.closest(".nav-scrim") || (e.target.closest(".station-nav-title button"))) { state.menuOpen = false; render(); return; }
    if (e.target.closest(".refresh-button")) { refresh(); return; }
    var share = e.target.closest(".share-btn");
    if (share) { copyLink(share); return; }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    if (!window.__VACCINE_DATA__) { window.addEventListener("vaccine-data-ready", boot, { once: true }); return; }
    render();
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // 某些内置浏览器在带查询参数的深链接下会中断首帧渲染，兜底再渲染一次
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!CLINICS.length) return;
      var nav = document.getElementById("station-list");
      if (nav && !nav.children.length) { render(); refresh(); }
    }, 300);
  });
})();
