/* RainCough 系统扩展产物 · syscenter · 由 tools/build-extension.js 生成 */
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // rc-host:vue
  var require_vue = __commonJS({
    "rc-host:vue"(exports, module) {
      var host = window.__rcHost;
      if (!host || !host.Vue) throw new Error("系统扩展宿主运行时缺失: window.__rcHost.Vue");
      module.exports = host.Vue;
    }
  });

  // rc-host:rc-api
  var require_rc_api = __commonJS({
    "rc-host:rc-api"(exports, module) {
      var host = window.__rcHost;
      if (!host || !host.api) throw new Error("系统扩展宿主运行时缺失: window.__rcHost.api");
      module.exports = host.api;
    }
  });

  // rc-host:vue-router
  var require_vue_router = __commonJS({
    "rc-host:vue-router"(exports, module) {
      var host = window.__rcHost;
      var R = host && host.router && host.router();
      if (!R) throw new Error("系统扩展宿主运行时缺失: window.__rcHost.router");
      function hashQuery() {
        var h = String(window.location.hash || ""), i = h.indexOf("?"), o = {};
        if (i >= 0) {
          var p = new URLSearchParams(h.slice(i + 1));
          p.forEach(function(v, k) {
            o[k] = v;
          });
        }
        return o;
      }
      module.exports = {
        useRouter: function() {
          return R;
        },
        useRoute: function() {
          var cur = R.currentRoute && R.currentRoute.value || { query: {} };
          return {
            path: cur.path || "",
            name: cur.name,
            hash: cur.hash || "",
            fullPath: cur.fullPath || "",
            meta: cur.meta || {},
            params: cur.params || {},
            query: Object.assign({}, cur.query || {}, hashQuery())
          };
        },
        createRouter: function() {
          return R;
        },
        createWebHashHistory: function() {
          return null;
        },
        RouterLink: { name: "RouterLink", render: function() {
          return null;
        } },
        RouterView: { name: "RouterView", render: function() {
          return null;
        } }
      };
    }
  });

  // extensions/syscenter/frontend/extension.js
  var import_vue15 = __toESM(require_vue());

  // extensions/syscenter/frontend/SysFuncMain.vue
  var import_vue13 = __toESM(require_vue());
  var import_vue14 = __toESM(require_vue());
  var import_rc_api7 = __toESM(require_rc_api());

  // extensions/syscenter/frontend/Logs.vue
  var import_vue = __toESM(require_vue());
  var import_vue2 = __toESM(require_vue());
  var import_rc_api = __toESM(require_rc_api());
  var _hoisted_1 = { class: "page" };
  var _hoisted_2 = { class: "page-head" };
  var _hoisted_3 = { class: "log-toolbar" };
  var _hoisted_4 = { class: "log-status" };
  var _hoisted_5 = { class: "page-body no-scroll" };
  var _hoisted_6 = { class: "log-view" };
  var __sfc_main = {
    __name: "Logs",
    setup(__props) {
      const text = (0, import_vue2.ref)("");
      const grep = (0, import_vue2.ref)("");
      const lines = (0, import_vue2.ref)(200);
      const error = (0, import_vue2.ref)("");
      const loading = (0, import_vue2.ref)(false);
      const auto = (0, import_vue2.ref)(true);
      let timer = null;
      async function load() {
        loading.value = true;
        try {
          const d = await import_rc_api.api.sysLogs(lines.value, grep.value);
          error.value = "";
          text.value = d.text || "";
        } catch (e) {
          error.value = e.message || "加载失败";
        } finally {
          loading.value = false;
        }
      }
      function toggleAuto() {
        auto.value = !auto.value;
        if (auto.value) start();
        else stop();
      }
      function start() {
        stop();
        timer = setInterval(load, 2e3);
      }
      function stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
      let debounce = null;
      function onSearchInput() {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(load, 400);
      }
      (0, import_vue2.watch)(lines, () => {
        if (auto.value) load();
      });
      (0, import_vue2.onMounted)(() => {
        load();
        if (auto.value) start();
      });
      (0, import_vue2.onUnmounted)(stop);
      return (_ctx, _cache) => {
        return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_1, [
          (0, import_vue.createElementVNode)("div", _hoisted_2, [
            _cache[3] || (_cache[3] = (0, import_vue.createElementVNode)(
              "h1",
              null,
              "系统日志",
              -1
              /* CACHED */
            )),
            _cache[4] || (_cache[4] = (0, import_vue.createElementVNode)(
              "div",
              { class: "subtitle" },
              "/var/log/touchgal.log",
              -1
              /* CACHED */
            )),
            (0, import_vue.createElementVNode)("div", _hoisted_3, [
              (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                "input",
                {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => grep.value = $event),
                  class: "term-select",
                  placeholder: "过滤关键字…",
                  onInput: onSearchInput
                },
                null,
                544
                /* NEED_HYDRATION, NEED_PATCH */
              ), [
                [import_vue.vModelText, grep.value]
              ]),
              (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                "select",
                {
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => lines.value = $event),
                  class: "term-select"
                },
                [..._cache[2] || (_cache[2] = [
                  (0, import_vue.createElementVNode)(
                    "option",
                    { value: 100 },
                    "100 行",
                    -1
                    /* CACHED */
                  ),
                  (0, import_vue.createElementVNode)(
                    "option",
                    { value: 200 },
                    "200 行",
                    -1
                    /* CACHED */
                  ),
                  (0, import_vue.createElementVNode)(
                    "option",
                    { value: 500 },
                    "500 行",
                    -1
                    /* CACHED */
                  ),
                  (0, import_vue.createElementVNode)(
                    "option",
                    { value: 1e3 },
                    "1000 行",
                    -1
                    /* CACHED */
                  )
                ])],
                512
                /* NEED_PATCH */
              ), [
                [import_vue.vModelSelect, lines.value]
              ]),
              (0, import_vue.createElementVNode)("button", {
                class: "btn btn-sm",
                onClick: load
              }, "刷新"),
              (0, import_vue.createElementVNode)(
                "button",
                {
                  class: (0, import_vue.normalizeClass)(["btn btn-sm", auto.value ? "btn-primary" : ""]),
                  onClick: toggleAuto
                },
                (0, import_vue.toDisplayString)(auto.value ? "自动刷新: 开" : "自动刷新: 关"),
                3
                /* TEXT, CLASS */
              ),
              (0, import_vue.createElementVNode)(
                "span",
                _hoisted_4,
                (0, import_vue.toDisplayString)(loading.value ? "加载中…" : error.value || (text.value ? "ok" : "空")),
                1
                /* TEXT */
              )
            ])
          ]),
          (0, import_vue.createElementVNode)("div", _hoisted_5, [
            (0, import_vue.createElementVNode)(
              "pre",
              _hoisted_6,
              (0, import_vue.toDisplayString)(text.value),
              1
              /* TEXT */
            )
          ])
        ]);
      };
    }
  };
  __sfc_main.__scopeId = "data-v-1cpsz63";
  var Logs_default = __sfc_main;
  (function() {
    var key = "rc-ext-css-data-v-1cpsz63-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.log-toolbar[data-v-1cpsz63] {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  margin-top: 10px;\n}\n.term-select[data-v-1cpsz63] {\r\n  background: var(--surface-2);\r\n  color: var(--text);\r\n  border: 1px solid var(--border);\r\n  border-radius: 0;\r\n  padding: 5px 8px;\r\n  font-size: 13px;\n}\n.log-status[data-v-1cpsz63] {\r\n  margin-left: auto;\r\n  font-size: 12px;\r\n  color: var(--text-faint);\n}\n.page-body[data-v-1cpsz63] {\r\n  display: flex;\r\n  flex-direction: column;\n}\n.log-view[data-v-1cpsz63] {\r\n  flex: 1;\r\n  min-height: 0;\r\n  overflow: auto;\r\n  margin: 0;\r\n  padding: 10px 12px;\r\n  background: #0b0e11;\r\n  border: 1px solid var(--border);\r\n  border-radius: 0;\r\n  font-family: var(--font-mono);\r\n  font-size: 12px;\r\n  line-height: 1.5;\r\n  color: #b8c4d0;\r\n  white-space: pre-wrap;\r\n  word-break: break-all;\n}\r\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/BackupMain.vue
  var import_vue3 = __toESM(require_vue());
  var import_vue4 = __toESM(require_vue());
  var import_rc_api2 = __toESM(require_rc_api());
  var _hoisted_12 = {
    key: 0,
    class: "notice",
    style: { "padding": "8px 12px", "border-radius": "0", "background": "var(--success-soft)", "color": "var(--success)", "margin-bottom": "12px" }
  };
  var _hoisted_22 = {
    key: 1,
    class: "error",
    style: { "margin-bottom": "12px" }
  };
  var _hoisted_32 = { class: "section" };
  var _hoisted_42 = {
    key: 0,
    class: "loading"
  };
  var _hoisted_52 = {
    key: 1,
    class: "empty",
    style: { "padding": "26px" }
  };
  var _hoisted_62 = {
    key: 2,
    class: "table",
    style: { "width": "100%", "border-collapse": "collapse", "font-size": "13px" }
  };
  var _hoisted_7 = { style: { "padding": "8px", "font-weight": "700" } };
  var _hoisted_8 = ["title"];
  var _hoisted_9 = { style: { "padding": "8px", "text-align": "center" } };
  var _hoisted_10 = { style: { "padding": "8px", "text-align": "center" } };
  var _hoisted_11 = { style: { "padding": "8px", "color": "var(--text-faint)", "font-family": "var(--font-mono)", "font-size": "12px" } };
  var _hoisted_122 = { style: { "padding": "8px", "text-align": "center" } };
  var _hoisted_13 = {
    key: 0,
    class: "badge running",
    style: { "color": "var(--accent)" }
  };
  var _hoisted_14 = {
    key: 1,
    class: "badge",
    style: { "color": "var(--text-faint)" }
  };
  var _hoisted_15 = {
    key: 3,
    class: "badge",
    style: { "color": "var(--text-faint)" }
  };
  var _hoisted_16 = { style: { "padding": "8px", "text-align": "right", "white-space": "nowrap" } };
  var _hoisted_17 = ["disabled", "onClick"];
  var _hoisted_18 = ["onClick"];
  var _hoisted_19 = ["onClick"];
  var _hoisted_20 = ["onClick"];
  var _hoisted_21 = { class: "section" };
  var _hoisted_222 = {
    key: 0,
    class: "empty",
    style: { "padding": "20px" }
  };
  var _hoisted_23 = {
    key: 1,
    class: "table",
    style: { "width": "100%", "border-collapse": "collapse", "font-size": "12.5px", "font-family": "var(--font-mono)" }
  };
  var _hoisted_24 = { style: { "padding": "6px" } };
  var _hoisted_25 = { style: { "padding": "6px" } };
  var _hoisted_26 = { style: { "padding": "6px", "text-align": "center" } };
  var _hoisted_27 = { style: { "padding": "6px", "text-align": "center" } };
  var _hoisted_28 = { style: { "padding": "6px", "text-align": "center" } };
  var _hoisted_29 = { style: { "padding": "6px", "text-align": "right", "white-space": "nowrap" } };
  var _hoisted_30 = { class: "status-line" };
  var _hoisted_31 = ["onClick"];
  var _hoisted_322 = { class: "modal-panel" };
  var _hoisted_33 = { class: "modal-head" };
  var _hoisted_34 = {
    class: "modal-body",
    style: { "display": "flex", "flex-direction": "column", "gap": "10px" }
  };
  var _hoisted_35 = { class: "lbl" };
  var _hoisted_36 = ["disabled"];
  var _hoisted_37 = { class: "lbl" };
  var _hoisted_38 = { class: "lbl" };
  var _hoisted_39 = { style: { "display": "flex", "gap": "10px", "flex-wrap": "wrap" } };
  var _hoisted_40 = { class: "lbl" };
  var _hoisted_41 = { class: "lbl" };
  var _hoisted_422 = { class: "lbl" };
  var _hoisted_43 = { class: "lbl" };
  var __sfc_main2 = {
    __name: "BackupMain",
    setup(__props) {
      const jobs = (0, import_vue4.ref)([]);
      const runs = (0, import_vue4.ref)([]);
      const loading = (0, import_vue4.ref)(false);
      const error = (0, import_vue4.ref)("");
      const notice = (0, import_vue4.ref)("");
      const showForm = (0, import_vue4.ref)(false);
      const editingName = (0, import_vue4.ref)("");
      const form = (0, import_vue4.ref)({ name: "", sources: "", target: "", compress: "gz", keep: 5, interval_hours: 0, excludes: "" });
      let timer = null;
      function sizeTxt(b) {
        if (!b && b !== 0) return "-";
        if (b < 1024) return b + " B";
        const u = ["KB", "MB", "GB", "TB"];
        let i = -1, v = b;
        while (v >= 1024 && i < u.length - 1) {
          v /= 1024;
          i++;
        }
        return v.toFixed(1) + " " + u[i];
      }
      function timeTxt(ts) {
        if (!ts) return "-";
        const d = new Date(ts * 1e3);
        const p = (n) => String(n).padStart(2, "0");
        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
      }
      function relTime(ts) {
        if (!ts) return "-";
        const s = Math.max(0, Math.floor(Date.now() / 1e3 - ts));
        if (s < 60) return s + " 秒前";
        if (s < 3600) return Math.floor(s / 60) + " 分钟前";
        return Math.floor(s / 3600) + " 小时前";
      }
      const RUN_STATE = { done: "完成", error: "失败", interrupted: "中断" };
      async function load() {
        loading.value = true;
        error.value = "";
        try {
          const [j, r] = await Promise.all([import_rc_api2.api.bkpList(), import_rc_api2.api.bkpRuns()]);
          jobs.value = j.jobs || [];
          runs.value = (r.runs || []).slice(0, 30);
        } catch (e) {
          error.value = e.message;
        } finally {
          loading.value = false;
        }
      }
      function openCreate() {
        editingName.value = "";
        form.value = { name: "", sources: "", target: "", compress: "gz", keep: 5, interval_hours: 0, excludes: "" };
        showForm.value = true;
      }
      function openEdit(j) {
        editingName.value = j.name;
        form.value = {
          name: j.name,
          sources: (j.sources || []).join("\n"),
          target: j.target || "",
          compress: j.compress || "gz",
          keep: j.keep || 5,
          interval_hours: j.interval_hours || 0,
          excludes: (j.excludes || []).join("\n")
        };
        showForm.value = true;
      }
      function closeForm() {
        showForm.value = false;
      }
      async function saveForm() {
        error.value = "";
        const payload = {
          name: form.value.name.trim(),
          sources: form.value.sources.split("\n").map((s) => s.trim()).filter(Boolean),
          target: form.value.target.trim(),
          compress: form.value.compress,
          keep: parseInt(form.value.keep, 10) || 5,
          interval_hours: parseInt(form.value.interval_hours, 10) || 0,
          excludes: form.value.excludes.split("\n").map((s) => s.trim()).filter(Boolean)
        };
        try {
          if (editingName.value) await import_rc_api2.api.bkpUpdate(editingName.value, payload);
          else await import_rc_api2.api.bkpCreate(payload);
          closeForm();
          await load();
        } catch (e) {
          error.value = e.message;
        }
      }
      async function runNow(j) {
        try {
          await import_rc_api2.api.bkpRun(j.name);
          notice.value = "已开始备份 " + j.name + "，可在任务队列查看进度";
          setTimeout(() => {
            notice.value = "";
          }, 5e3);
          setTimeout(load, 1500);
        } catch (e) {
          error.value = e.message;
        }
      }
      async function togglePause(j) {
        try {
          await import_rc_api2.api.bkpUpdate(j.name, { paused: !j.paused });
          await load();
        } catch (e) {
          error.value = e.message;
        }
      }
      async function removeJob(j) {
        if (!confirm("删除任务「" + j.name + "」？不会删除已产生的归档文件。")) return;
        try {
          await import_rc_api2.api.bkpDelete(j.name);
          await load();
        } catch (e) {
          error.value = e.message;
        }
      }
      async function removeRun(r) {
        if (!confirm("删除归档 " + r.file.split("/").pop() + " ？")) return;
        try {
          await import_rc_api2.api.bkpDeleteRun(r.file);
          await load();
        } catch (e) {
          error.value = e.message;
        }
      }
      async function goTarget(j) {
        try {
          window.open("/#/fm", "_blank");
        } catch (e) {
        }
      }
      (0, import_vue4.onMounted)(() => {
        load();
        timer = setInterval(load, 4e3);
      });
      (0, import_vue4.onBeforeUnmount)(() => {
        if (timer) clearInterval(timer);
      });
      return (_ctx, _cache) => {
        return (0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("div", null, [
          _cache[20] || (_cache[20] = (0, import_vue3.createElementVNode)(
            "h1",
            null,
            "系统备份",
            -1
            /* CACHED */
          )),
          _cache[21] || (_cache[21] = (0, import_vue3.createElementVNode)(
            "div",
            { class: "subtitle" },
            "目录打包备份与保留轮换 · 支持定时执行，进度接入任务队列",
            -1
            /* CACHED */
          )),
          notice.value ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)(
            "div",
            _hoisted_12,
            (0, import_vue3.toDisplayString)(notice.value),
            1
            /* TEXT */
          )) : (0, import_vue3.createCommentVNode)("v-if", true),
          error.value ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)(
            "div",
            _hoisted_22,
            (0, import_vue3.toDisplayString)(error.value),
            1
            /* TEXT */
          )) : (0, import_vue3.createCommentVNode)("v-if", true),
          (0, import_vue3.createElementVNode)("div", _hoisted_32, [
            (0, import_vue3.createElementVNode)("div", { class: "section-title" }, [
              _cache[7] || (_cache[7] = (0, import_vue3.createElementVNode)(
                "span",
                null,
                "备份任务",
                -1
                /* CACHED */
              )),
              (0, import_vue3.createElementVNode)("button", {
                class: "btn btn-sm btn-primary",
                style: { "float": "right" },
                onClick: openCreate
              }, "＋ 新建任务")
            ]),
            loading.value && !jobs.value.length ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("div", _hoisted_42, [..._cache[8] || (_cache[8] = [
              (0, import_vue3.createElementVNode)(
                "div",
                { class: "spinner" },
                null,
                -1
                /* CACHED */
              ),
              (0, import_vue3.createTextVNode)(
                " 加载中...",
                -1
                /* CACHED */
              )
            ])])) : !jobs.value.length ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("div", _hoisted_52, "还没有备份任务，点右上角「新建任务」开始")) : ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("table", _hoisted_62, [
              _cache[9] || (_cache[9] = (0, import_vue3.createElementVNode)(
                "thead",
                null,
                [
                  (0, import_vue3.createElementVNode)("tr", null, [
                    (0, import_vue3.createElementVNode)("th", { style: { "text-align": "left", "padding": "8px" } }, "名称"),
                    (0, import_vue3.createElementVNode)("th", null, "来源"),
                    (0, import_vue3.createElementVNode)("th", null, "保留"),
                    (0, import_vue3.createElementVNode)("th", null, "间隔"),
                    (0, import_vue3.createElementVNode)("th", null, "上次"),
                    (0, import_vue3.createElementVNode)("th", null, "状态"),
                    (0, import_vue3.createElementVNode)("th", { style: { "text-align": "right", "padding": "8px" } }, "操作")
                  ])
                ],
                -1
                /* CACHED */
              )),
              (0, import_vue3.createElementVNode)("tbody", null, [
                ((0, import_vue3.openBlock)(true), (0, import_vue3.createElementBlock)(
                  import_vue3.Fragment,
                  null,
                  (0, import_vue3.renderList)(jobs.value, (j) => {
                    return (0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("tr", {
                      key: j.name,
                      style: { "border-top": "1px solid var(--border)" }
                    }, [
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_7,
                        (0, import_vue3.toDisplayString)(j.name),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)("td", {
                        style: { "padding": "8px", "color": "var(--text-muted)", "font-family": "var(--font-mono)", "font-size": "12px" },
                        title: (j.sources || []).join("\n")
                      }, (0, import_vue3.toDisplayString)(j.sources.length) + " 个来源", 9, _hoisted_8),
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_9,
                        (0, import_vue3.toDisplayString)(j.keep),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_10,
                        (0, import_vue3.toDisplayString)(j.interval_hours ? j.interval_hours + " 小时" : j.paused ? "暂停" : "手动"),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_11,
                        (0, import_vue3.toDisplayString)(j.last_run ? relTime(j.last_run.start) + " · " + sizeTxt(j.last_run.size) : "-"),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)("td", _hoisted_122, [
                        j.running ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("span", _hoisted_13, "运行中")) : j.paused ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("span", _hoisted_14, "暂停")) : j.last_run ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)(
                          "span",
                          {
                            key: 2,
                            class: "badge",
                            style: (0, import_vue3.normalizeStyle)(j.last_run.status === "done" ? "color:var(--success)" : "color:var(--danger)")
                          },
                          (0, import_vue3.toDisplayString)(RUN_STATE[j.last_run.status] || j.last_run.status),
                          5
                          /* TEXT, STYLE */
                        )) : ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("span", _hoisted_15, "未运行"))
                      ]),
                      (0, import_vue3.createElementVNode)("td", _hoisted_16, [
                        (0, import_vue3.createElementVNode)("button", {
                          class: "btn btn-sm btn-primary",
                          disabled: j.running,
                          onClick: ($event) => runNow(j)
                        }, "立即备份", 8, _hoisted_17),
                        (0, import_vue3.createElementVNode)("button", {
                          class: "btn btn-sm",
                          onClick: ($event) => openEdit(j)
                        }, "编辑", 8, _hoisted_18),
                        (0, import_vue3.createElementVNode)("button", {
                          class: "btn btn-sm btn-ghost",
                          onClick: ($event) => togglePause(j)
                        }, (0, import_vue3.toDisplayString)(j.paused ? "恢复" : "暂停"), 9, _hoisted_19),
                        (0, import_vue3.createElementVNode)("button", {
                          class: "btn btn-sm btn-danger btn-ghost",
                          onClick: ($event) => removeJob(j)
                        }, "删除", 8, _hoisted_20)
                      ])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]))
          ]),
          (0, import_vue3.createElementVNode)("div", _hoisted_21, [
            _cache[11] || (_cache[11] = (0, import_vue3.createElementVNode)(
              "div",
              { class: "section-title" },
              "运行历史",
              -1
              /* CACHED */
            )),
            !runs.value.length ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("div", _hoisted_222, "暂无备份记录")) : ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("table", _hoisted_23, [
              _cache[10] || (_cache[10] = (0, import_vue3.createElementVNode)(
                "thead",
                null,
                [
                  (0, import_vue3.createElementVNode)("tr", null, [
                    (0, import_vue3.createElementVNode)("th", { style: { "text-align": "left", "padding": "6px" } }, "时间"),
                    (0, import_vue3.createElementVNode)("th", { style: { "text-align": "left" } }, "任务"),
                    (0, import_vue3.createElementVNode)("th", null, "时长"),
                    (0, import_vue3.createElementVNode)("th", null, "大小"),
                    (0, import_vue3.createElementVNode)("th", null, "状态"),
                    (0, import_vue3.createElementVNode)("th", { style: { "text-align": "right", "padding": "6px" } }, "归档")
                  ])
                ],
                -1
                /* CACHED */
              )),
              (0, import_vue3.createElementVNode)("tbody", null, [
                ((0, import_vue3.openBlock)(true), (0, import_vue3.createElementBlock)(
                  import_vue3.Fragment,
                  null,
                  (0, import_vue3.renderList)(runs.value, (r, i) => {
                    return (0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("tr", {
                      key: i,
                      style: { "border-top": "1px solid var(--border)" }
                    }, [
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_24,
                        (0, import_vue3.toDisplayString)(timeTxt(r.start)),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_25,
                        (0, import_vue3.toDisplayString)(r.job),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_26,
                        (0, import_vue3.toDisplayString)(r.duration ? r.duration + "s" : "-"),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)(
                        "td",
                        _hoisted_27,
                        (0, import_vue3.toDisplayString)(sizeTxt(r.size)),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue3.createElementVNode)("td", _hoisted_28, [
                        (0, import_vue3.createElementVNode)(
                          "span",
                          {
                            style: (0, import_vue3.normalizeStyle)(r.status === "done" ? "color:var(--success)" : "color:var(--danger)")
                          },
                          (0, import_vue3.toDisplayString)(RUN_STATE[r.status] || r.status),
                          5
                          /* TEXT, STYLE */
                        )
                      ]),
                      (0, import_vue3.createElementVNode)("td", _hoisted_29, [
                        (0, import_vue3.createElementVNode)(
                          "span",
                          _hoisted_30,
                          (0, import_vue3.toDisplayString)(r.file.split("/").pop()),
                          1
                          /* TEXT */
                        ),
                        r.file ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("button", {
                          key: 0,
                          class: "btn btn-sm btn-ghost",
                          onClick: ($event) => removeRun(r),
                          title: "删除归档"
                        }, "删", 8, _hoisted_31)) : (0, import_vue3.createCommentVNode)("v-if", true)
                      ])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]))
          ]),
          (0, import_vue3.createCommentVNode)(" 新建/编辑弹窗 "),
          showForm.value ? ((0, import_vue3.openBlock)(), (0, import_vue3.createElementBlock)("div", {
            key: 2,
            class: "modal-mask",
            onClick: (0, import_vue3.withModifiers)(closeForm, ["self"])
          }, [
            (0, import_vue3.createElementVNode)("div", _hoisted_322, [
              (0, import_vue3.createElementVNode)("div", _hoisted_33, [
                (0, import_vue3.createElementVNode)(
                  "span",
                  null,
                  (0, import_vue3.toDisplayString)(editingName.value ? "编辑任务：" + editingName.value : "新建备份任务"),
                  1
                  /* TEXT */
                ),
                (0, import_vue3.createElementVNode)("button", {
                  class: "btn btn-sm btn-ghost",
                  onClick: closeForm
                }, "×")
              ]),
              (0, import_vue3.createElementVNode)("div", _hoisted_34, [
                (0, import_vue3.createElementVNode)("label", _hoisted_35, [
                  _cache[12] || (_cache[12] = (0, import_vue3.createTextVNode)(
                    "任务名称 ",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)("input", {
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => form.value.name = $event),
                    class: "input",
                    disabled: !!editingName.value,
                    style: { "width": "100%" },
                    placeholder: "如: jmcomic 库"
                  }, null, 8, _hoisted_36), [
                    [import_vue3.vModelText, form.value.name]
                  ])
                ]),
                (0, import_vue3.createElementVNode)("label", _hoisted_37, [
                  _cache[13] || (_cache[13] = (0, import_vue3.createTextVNode)(
                    "来源路径（每行一个绝对路径） ",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)(
                    "textarea",
                    {
                      "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => form.value.sources = $event),
                      class: "input",
                      rows: "3",
                      style: { "width": "100%", "resize": "vertical", "font-family": "var(--font-mono)" },
                      placeholder: "/opt/touchgal/plugins/JMComic/downloads\n/opt/touchgal/data/tasks.json"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [import_vue3.vModelText, form.value.sources]
                  ])
                ]),
                (0, import_vue3.createElementVNode)("label", _hoisted_38, [
                  _cache[14] || (_cache[14] = (0, import_vue3.createTextVNode)(
                    "目标目录（绝对路径） ",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)(
                    "input",
                    {
                      "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => form.value.target = $event),
                      class: "input",
                      style: { "width": "100%", "font-family": "var(--font-mono)" },
                      placeholder: "/opt/touchgal/backups 或外置盘挂载点"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [import_vue3.vModelText, form.value.target]
                  ])
                ]),
                (0, import_vue3.createElementVNode)("div", _hoisted_39, [
                  (0, import_vue3.createElementVNode)("label", _hoisted_40, [
                    _cache[16] || (_cache[16] = (0, import_vue3.createTextVNode)(
                      "压缩 ",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)(
                      "select",
                      {
                        "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => form.value.compress = $event),
                        class: "input"
                      },
                      [..._cache[15] || (_cache[15] = [
                        (0, import_vue3.createElementVNode)(
                          "option",
                          { value: "gz" },
                          "tar.gz",
                          -1
                          /* CACHED */
                        ),
                        (0, import_vue3.createElementVNode)(
                          "option",
                          { value: "none" },
                          "tar(不压缩)",
                          -1
                          /* CACHED */
                        )
                      ])],
                      512
                      /* NEED_PATCH */
                    ), [
                      [import_vue3.vModelSelect, form.value.compress]
                    ])
                  ]),
                  (0, import_vue3.createElementVNode)("label", _hoisted_41, [
                    _cache[17] || (_cache[17] = (0, import_vue3.createTextVNode)(
                      "保留份数 ",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)(
                      "input",
                      {
                        "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => form.value.keep = $event),
                        type: "number",
                        min: "1",
                        class: "input",
                        style: { "width": "70px" }
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    ), [
                      [import_vue3.vModelText, form.value.keep]
                    ])
                  ]),
                  (0, import_vue3.createElementVNode)("label", _hoisted_422, [
                    _cache[18] || (_cache[18] = (0, import_vue3.createTextVNode)(
                      "定时间隔(小时, 0=手动) ",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)(
                      "input",
                      {
                        "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => form.value.interval_hours = $event),
                        type: "number",
                        min: "0",
                        class: "input",
                        style: { "width": "80px" }
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    ), [
                      [import_vue3.vModelText, form.value.interval_hours]
                    ])
                  ])
                ]),
                (0, import_vue3.createElementVNode)("label", _hoisted_43, [
                  _cache[19] || (_cache[19] = (0, import_vue3.createTextVNode)(
                    "排除规则（tar --exclude 通配, 每行一个） ",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue3.withDirectives)((0, import_vue3.createElementVNode)(
                    "textarea",
                    {
                      "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => form.value.excludes = $event),
                      class: "input",
                      rows: "2",
                      style: { "width": "100%", "resize": "vertical", "font-family": "var(--font-mono)" },
                      placeholder: "*.log\ncache"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [import_vue3.vModelText, form.value.excludes]
                  ])
                ])
              ]),
              (0, import_vue3.createElementVNode)("div", {
                class: "modal-foot",
                style: { "display": "flex", "justify-content": "flex-end", "gap": "8px", "padding": "12px 14px" }
              }, [
                (0, import_vue3.createElementVNode)("button", {
                  class: "btn btn-sm",
                  onClick: closeForm
                }, "取消"),
                (0, import_vue3.createElementVNode)("button", {
                  class: "btn btn-sm btn-primary",
                  onClick: saveForm
                }, "保存")
              ])
            ])
          ])) : (0, import_vue3.createCommentVNode)("v-if", true)
        ]);
      };
    }
  };
  __sfc_main2.__scopeId = "data-v-hs3zx0";
  var BackupMain_default = __sfc_main2;
  (function() {
    var key = "rc-ext-css-data-v-hs3zx0-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.table th[data-v-hs3zx0] { color: var(--text-faint); font-size: 12px;\n}\n.modal-mask[data-v-hs3zx0] { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;\n}\n.modal-panel[data-v-hs3zx0] { width: 520px; max-width: 94vw; max-height: 86vh; overflow: auto; background: var(--surface-2); border: 1px solid var(--border); border-radius: 0; box-shadow: var(--shadow);\n}\n.modal-head[data-v-hs3zx0] { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--border); font-weight: 700;\n}\n.modal-body[data-v-hs3zx0] { padding: 14px;\n}\n.lbl[data-v-hs3zx0] { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted);\n}\n.lbl .input[data-v-hs3zx0] { margin-top: 2px;\n}\r\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/Processes.vue
  var import_vue5 = __toESM(require_vue());
  var import_vue6 = __toESM(require_vue());
  var import_rc_api3 = __toESM(require_rc_api());
  var _hoisted_110 = { class: "page" };
  var _hoisted_210 = { class: "page-head" };
  var _hoisted_310 = { class: "proc-toolbar" };
  var _hoisted_44 = { class: "proc-status" };
  var _hoisted_53 = { class: "page-body" };
  var _hoisted_63 = { class: "proc-table-wrap" };
  var _hoisted_72 = { class: "proc-table" };
  var _hoisted_82 = { class: "mono" };
  var _hoisted_92 = { class: "mono" };
  var _hoisted_102 = { class: "mono" };
  var _hoisted_112 = { class: "mono" };
  var _hoisted_123 = ["title"];
  var _hoisted_132 = { class: "mono muted" };
  var _hoisted_142 = ["onClick"];
  var _hoisted_152 = ["onClick"];
  var _hoisted_162 = { key: 0 };
  var __sfc_main3 = {
    __name: "Processes",
    setup(__props) {
      const procs = (0, import_vue6.ref)([]);
      const sortKey = (0, import_vue6.ref)("cpu");
      const error = (0, import_vue6.ref)("");
      const loading = (0, import_vue6.ref)(false);
      const auto = (0, import_vue6.ref)(true);
      const confirmPid = (0, import_vue6.ref)(null);
      let timer = null;
      function fmtBytes(n) {
        n = n || 0;
        for (const u of ["B", "KB", "MB", "GB"]) {
          if (n < 1024 || u === "GB") return `${n.toFixed(1)} ${u}`;
          n /= 1024;
        }
      }
      function fmtTime(ts) {
        if (!ts) return "-";
        const d = new Date(ts * 1e3);
        return d.toLocaleString();
      }
      async function load() {
        loading.value = true;
        try {
          const d = await import_rc_api3.api.sysProcesses(sortKey.value);
          error.value = "";
          procs.value = d.processes || [];
        } catch (e) {
          error.value = e.message || "加载失败";
        } finally {
          loading.value = false;
        }
      }
      function setSort(k) {
        if (sortKey.value === k) return;
        sortKey.value = k;
        load();
      }
      async function doKill(pid, sig) {
        try {
          await import_rc_api3.api.sysKill(pid, sig);
          confirmPid.value = null;
          load();
        } catch (e) {
          error.value = e.message || "操作失败";
        }
      }
      function toggleAuto() {
        auto.value = !auto.value;
        if (auto.value) {
          timer = setInterval(load, 5e3);
        } else if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
      (0, import_vue6.onMounted)(() => {
        load();
        if (auto.value) timer = setInterval(load, 5e3);
      });
      (0, import_vue6.onUnmounted)(() => {
        if (timer) clearInterval(timer);
      });
      return (_ctx, _cache) => {
        return (0, import_vue5.openBlock)(), (0, import_vue5.createElementBlock)("div", _hoisted_110, [
          (0, import_vue5.createElementVNode)("div", _hoisted_210, [
            _cache[4] || (_cache[4] = (0, import_vue5.createElementVNode)(
              "h1",
              null,
              "进程管理",
              -1
              /* CACHED */
            )),
            _cache[5] || (_cache[5] = (0, import_vue5.createElementVNode)(
              "div",
              { class: "subtitle" },
              "服务器进程（仅可操作本用户 f 的进程）",
              -1
              /* CACHED */
            )),
            (0, import_vue5.createElementVNode)("div", _hoisted_310, [
              (0, import_vue5.createElementVNode)("button", {
                class: "btn btn-sm",
                onClick: load
              }, "刷新"),
              (0, import_vue5.createElementVNode)(
                "button",
                {
                  class: (0, import_vue5.normalizeClass)(["btn btn-sm", auto.value ? "btn-primary" : ""]),
                  onClick: toggleAuto
                },
                (0, import_vue5.toDisplayString)(auto.value ? "自动刷新: 开" : "自动刷新: 关"),
                3
                /* TEXT, CLASS */
              ),
              (0, import_vue5.createElementVNode)(
                "span",
                _hoisted_44,
                (0, import_vue5.toDisplayString)(loading.value ? "加载中…" : error.value || `${procs.value.length} 个进程`),
                1
                /* TEXT */
              )
            ])
          ]),
          (0, import_vue5.createElementVNode)("div", _hoisted_53, [
            (0, import_vue5.createElementVNode)("div", _hoisted_63, [
              (0, import_vue5.createElementVNode)("table", _hoisted_72, [
                (0, import_vue5.createElementVNode)("thead", null, [
                  (0, import_vue5.createElementVNode)("tr", null, [
                    (0, import_vue5.createElementVNode)(
                      "th",
                      {
                        onClick: _cache[0] || (_cache[0] = ($event) => setSort("pid"))
                      },
                      "PID " + (0, import_vue5.toDisplayString)(sortKey.value === "pid" ? "↓" : ""),
                      1
                      /* TEXT */
                    ),
                    _cache[6] || (_cache[6] = (0, import_vue5.createElementVNode)(
                      "th",
                      null,
                      "名称",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue5.createElementVNode)(
                      "th",
                      {
                        onClick: _cache[1] || (_cache[1] = ($event) => setSort("cpu"))
                      },
                      "CPU% " + (0, import_vue5.toDisplayString)(sortKey.value === "cpu" ? "↓" : ""),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue5.createElementVNode)(
                      "th",
                      {
                        onClick: _cache[2] || (_cache[2] = ($event) => setSort("mem"))
                      },
                      "内存 " + (0, import_vue5.toDisplayString)(sortKey.value === "mem" ? "↓" : ""),
                      1
                      /* TEXT */
                    ),
                    _cache[7] || (_cache[7] = (0, import_vue5.createElementVNode)(
                      "th",
                      null,
                      "用户",
                      -1
                      /* CACHED */
                    )),
                    _cache[8] || (_cache[8] = (0, import_vue5.createElementVNode)(
                      "th",
                      null,
                      "命令",
                      -1
                      /* CACHED */
                    )),
                    _cache[9] || (_cache[9] = (0, import_vue5.createElementVNode)(
                      "th",
                      null,
                      "启动时间",
                      -1
                      /* CACHED */
                    )),
                    _cache[10] || (_cache[10] = (0, import_vue5.createElementVNode)(
                      "th",
                      null,
                      "操作",
                      -1
                      /* CACHED */
                    ))
                  ])
                ]),
                (0, import_vue5.createElementVNode)("tbody", null, [
                  ((0, import_vue5.openBlock)(true), (0, import_vue5.createElementBlock)(
                    import_vue5.Fragment,
                    null,
                    (0, import_vue5.renderList)(procs.value.slice(0, 200), (p) => {
                      return (0, import_vue5.openBlock)(), (0, import_vue5.createElementBlock)("tr", {
                        key: p.pid
                      }, [
                        (0, import_vue5.createElementVNode)(
                          "td",
                          _hoisted_82,
                          (0, import_vue5.toDisplayString)(p.pid),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue5.createElementVNode)(
                          "td",
                          null,
                          (0, import_vue5.toDisplayString)(p.name),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue5.createElementVNode)(
                          "td",
                          _hoisted_92,
                          (0, import_vue5.toDisplayString)(p.cpu.toFixed(1)),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue5.createElementVNode)(
                          "td",
                          _hoisted_102,
                          (0, import_vue5.toDisplayString)(fmtBytes(p.mem)),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue5.createElementVNode)(
                          "td",
                          _hoisted_112,
                          (0, import_vue5.toDisplayString)(p.username),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue5.createElementVNode)("td", {
                          class: "cmd",
                          title: p.cmdline
                        }, (0, import_vue5.toDisplayString)(p.cmdline), 9, _hoisted_123),
                        (0, import_vue5.createElementVNode)(
                          "td",
                          _hoisted_132,
                          (0, import_vue5.toDisplayString)(fmtTime(p.create_time)),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue5.createElementVNode)("td", null, [
                          confirmPid.value === p.pid ? ((0, import_vue5.openBlock)(), (0, import_vue5.createElementBlock)(
                            import_vue5.Fragment,
                            { key: 0 },
                            [
                              (0, import_vue5.createElementVNode)("button", {
                                class: "btn btn-sm btn-danger",
                                onClick: ($event) => doKill(p.pid, "SIGKILL")
                              }, "确认结束", 8, _hoisted_142),
                              (0, import_vue5.createElementVNode)("button", {
                                class: "btn btn-sm",
                                onClick: _cache[3] || (_cache[3] = ($event) => confirmPid.value = null)
                              }, "取消")
                            ],
                            64
                            /* STABLE_FRAGMENT */
                          )) : ((0, import_vue5.openBlock)(), (0, import_vue5.createElementBlock)("button", {
                            key: 1,
                            class: "btn btn-sm",
                            onClick: ($event) => confirmPid.value = p.pid
                          }, "结束", 8, _hoisted_152))
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !procs.value.length ? ((0, import_vue5.openBlock)(), (0, import_vue5.createElementBlock)("tr", _hoisted_162, [..._cache[11] || (_cache[11] = [
                    (0, import_vue5.createElementVNode)(
                      "td",
                      {
                        colspan: "8",
                        class: "muted",
                        style: { "text-align": "center", "padding": "24px" }
                      },
                      "无进程数据",
                      -1
                      /* CACHED */
                    )
                  ])])) : (0, import_vue5.createCommentVNode)("v-if", true)
                ])
              ])
            ])
          ])
        ]);
      };
    }
  };
  __sfc_main3.__scopeId = "data-v-1bcv5ai";
  var Processes_default = __sfc_main3;
  (function() {
    var key = "rc-ext-css-data-v-1bcv5ai-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.proc-toolbar[data-v-1bcv5ai] {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  margin-top: 10px;\n}\n.proc-status[data-v-1bcv5ai] {\r\n  margin-left: auto;\r\n  font-size: 12px;\r\n  color: var(--text-faint);\n}\n.proc-table-wrap[data-v-1bcv5ai] {\r\n  border: 1px solid var(--border);\r\n  border-radius: 0;\r\n  overflow: auto;\n}\n.proc-table[data-v-1bcv5ai] {\r\n  width: 100%;\r\n  border-collapse: collapse;\r\n  font-size: 12px;\n}\n.proc-table th[data-v-1bcv5ai] {\r\n  position: sticky;\r\n  top: 0;\r\n  background: var(--surface-2);\r\n  text-align: left;\r\n  padding: 8px 10px;\r\n  border-bottom: 1px solid var(--border);\r\n  cursor: pointer;\r\n  white-space: nowrap;\r\n  color: var(--text-muted);\n}\n.proc-table td[data-v-1bcv5ai] {\r\n  padding: 6px 10px;\r\n  border-bottom: 1px solid var(--border);\r\n  vertical-align: top;\n}\n.proc-table tr:last-child td[data-v-1bcv5ai] { border-bottom: none;\n}\n.mono[data-v-1bcv5ai] { font-family: var(--font-mono);\n}\n.muted[data-v-1bcv5ai] { color: var(--text-faint);\n}\n.cmd[data-v-1bcv5ai] {\r\n  max-width: 480px;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\n}\r\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/ServiceHealth.vue
  var import_vue7 = __toESM(require_vue());
  var import_vue8 = __toESM(require_vue());
  var import_vue_router = __toESM(require_vue_router());
  var import_rc_api4 = __toESM(require_rc_api());
  var _hoisted_111 = { class: "section" };
  var _hoisted_211 = { class: "section-title" };
  var _hoisted_311 = ["disabled"];
  var _hoisted_45 = { class: "sum" };
  var _hoisted_54 = { class: "stat-card" };
  var _hoisted_64 = { class: "stat-card" };
  var _hoisted_73 = { style: { "color": "#2e9e5b" } };
  var _hoisted_83 = { class: "stat-card" };
  var _hoisted_93 = { style: { "color": "#d9524e" } };
  var _hoisted_103 = { class: "stat-card" };
  var _hoisted_113 = { class: "bar" };
  var _hoisted_124 = { class: "faint" };
  var _hoisted_133 = { class: "table" };
  var _hoisted_143 = ["onClick"];
  var _hoisted_153 = {
    key: 0,
    class: "err"
  };
  var _hoisted_163 = ["onClick"];
  var _hoisted_172 = ["onClick"];
  var _hoisted_182 = { key: 0 };
  var _hoisted_192 = { key: 1 };
  var _hoisted_202 = {
    colspan: "8",
    class: "expand"
  };
  var _hoisted_212 = ["onClick"];
  var _hoisted_223 = {
    key: 1,
    class: "faint"
  };
  var _hoisted_232 = {
    key: 0,
    class: "log-panel"
  };
  var _hoisted_242 = { class: "log-head" };
  var _hoisted_252 = ["disabled"];
  var __sfc_main4 = {
    __name: "ServiceHealth",
    setup(__props) {
      const router = (0, import_vue_router.useRouter)();
      const loading = (0, import_vue8.ref)(false);
      const summary = (0, import_vue8.ref)({ total: 0, online: 0, offline: 0, interfaces: 0 });
      const rows = (0, import_vue8.ref)([]);
      const filter = (0, import_vue8.ref)({ type: "", status: "" });
      const expanded = (0, import_vue8.ref)(null);
      const log = (0, import_vue8.ref)({ open: false, name: "", text: "", lines: 200, loading: false });
      let timer = null;
      async function load() {
        loading.value = true;
        try {
          const srv = await import_rc_api4.api.servicesHealth();
          rows.value = (srv.providers || []).map((p) => ({
            name: p.name,
            label: p.label,
            version: p.version,
            kind: p.kind || "plugin",
            source: "v4",
            status: p.status,
            online: p.online,
            latency: p.latency_ms,
            fail: p.fail_count,
            lastSeen: p.last_seen,
            ifaces: p.ifaces || []
          }));
          Object.assign(summary.value, { total: rows.value.length, interfaces: srv.interfaces || 0 });
          summary.value.online = rows.value.filter((r) => r.online).length;
          summary.value.offline = rows.value.length - summary.value.online;
        } catch (e) {
          console.error("health load failed", e);
        } finally {
          loading.value = false;
        }
      }
      const filtered = (0, import_vue8.computed)(() => rows.value.filter((r) => {
        if (filter.value.type && filter.value.type !== "all") {
          if (filter.value.type === "system" && r.kind !== "system") return false;
          if (filter.value.type === "plugin" && r.kind !== "plugin") return false;
        }
        if (filter.value.status && filter.value.status !== "all") {
          if (filter.value.status === "online" && !r.online) return false;
          if (filter.value.status === "offline" && r.online) return false;
        }
        return true;
      }));
      const expandedRow = (0, import_vue8.computed)(() => rows.value.find((r) => r.name === expanded.value) || null);
      function toggleRow(name) {
        expanded.value = expanded.value === name ? null : name;
      }
      function goIfaces(q) {
        router.push({ path: "/sysfunc/ifa", query: q ? { q } : {} });
      }
      async function openLog(name) {
        log.value = { open: true, name, text: "", lines: 200, loading: true };
        try {
          const d = await import_rc_api4.api.servicesHealthLog(name, 200);
          log.value.text = d.text || "(空日志)";
        } catch (e) {
          log.value.text = "日志拉取失败: " + (e.message || e);
        } finally {
          log.value.loading = false;
        }
      }
      async function reloadLog() {
        if (!log.value.open) return;
        log.value.loading = true;
        try {
          const d = await import_rc_api4.api.servicesHealthLog(log.value.name, log.value.lines);
          log.value.text = d.text || "(空日志)";
        } catch (e) {
          log.value.text = "日志拉取失败: " + (e.message || e);
        } finally {
          log.value.loading = false;
        }
      }
      (0, import_vue8.onMounted)(() => {
        load();
        timer = setInterval(load, 1e4);
      });
      (0, import_vue8.onBeforeUnmount)(() => clearInterval(timer));
      return (_ctx, _cache) => {
        return (0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("div", _hoisted_111, [
          (0, import_vue7.createElementVNode)("div", _hoisted_211, [
            _cache[4] || (_cache[4] = (0, import_vue7.createElementVNode)(
              "h2",
              null,
              "服务健康中心",
              -1
              /* CACHED */
            )),
            _cache[5] || (_cache[5] = (0, import_vue7.createElementVNode)(
              "span",
              { class: "faint" },
              "注册表驱动 · v4 接口库 + 存量插件",
              -1
              /* CACHED */
            )),
            (0, import_vue7.createElementVNode)("button", {
              class: "btn",
              disabled: loading.value,
              onClick: load
            }, "刷新", 8, _hoisted_311)
          ]),
          (0, import_vue7.createElementVNode)("div", _hoisted_45, [
            (0, import_vue7.createElementVNode)("div", _hoisted_54, [
              (0, import_vue7.createElementVNode)(
                "b",
                null,
                (0, import_vue7.toDisplayString)(summary.value.total),
                1
                /* TEXT */
              ),
              _cache[6] || (_cache[6] = (0, import_vue7.createElementVNode)(
                "span",
                null,
                "提供方",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue7.createElementVNode)("div", _hoisted_64, [
              (0, import_vue7.createElementVNode)(
                "b",
                _hoisted_73,
                (0, import_vue7.toDisplayString)(summary.value.online),
                1
                /* TEXT */
              ),
              _cache[7] || (_cache[7] = (0, import_vue7.createElementVNode)(
                "span",
                null,
                "在线",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue7.createElementVNode)("div", _hoisted_83, [
              (0, import_vue7.createElementVNode)(
                "b",
                _hoisted_93,
                (0, import_vue7.toDisplayString)(summary.value.offline),
                1
                /* TEXT */
              ),
              _cache[8] || (_cache[8] = (0, import_vue7.createElementVNode)(
                "span",
                null,
                "离线",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue7.createElementVNode)("div", _hoisted_103, [
              (0, import_vue7.createElementVNode)(
                "b",
                null,
                (0, import_vue7.toDisplayString)(summary.value.interfaces),
                1
                /* TEXT */
              ),
              _cache[9] || (_cache[9] = (0, import_vue7.createElementVNode)(
                "span",
                null,
                "已注册接口",
                -1
                /* CACHED */
              ))
            ])
          ]),
          (0, import_vue7.createElementVNode)("div", _hoisted_113, [
            (0, import_vue7.withDirectives)((0, import_vue7.createElementVNode)(
              "select",
              {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => filter.value.type = $event),
                class: "input"
              },
              [..._cache[10] || (_cache[10] = [
                (0, import_vue7.createElementVNode)(
                  "option",
                  { value: "all" },
                  "类型:全部",
                  -1
                  /* CACHED */
                ),
                (0, import_vue7.createElementVNode)(
                  "option",
                  { value: "plugin" },
                  "插件",
                  -1
                  /* CACHED */
                ),
                (0, import_vue7.createElementVNode)(
                  "option",
                  { value: "system" },
                  "系统",
                  -1
                  /* CACHED */
                )
              ])],
              512
              /* NEED_PATCH */
            ), [
              [import_vue7.vModelSelect, filter.value.type]
            ]),
            (0, import_vue7.withDirectives)((0, import_vue7.createElementVNode)(
              "select",
              {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => filter.value.status = $event),
                class: "input"
              },
              [..._cache[11] || (_cache[11] = [
                (0, import_vue7.createElementVNode)(
                  "option",
                  { value: "all" },
                  "状态:全部",
                  -1
                  /* CACHED */
                ),
                (0, import_vue7.createElementVNode)(
                  "option",
                  { value: "online" },
                  "在线",
                  -1
                  /* CACHED */
                ),
                (0, import_vue7.createElementVNode)(
                  "option",
                  { value: "offline" },
                  "离线",
                  -1
                  /* CACHED */
                )
              ])],
              512
              /* NEED_PATCH */
            ), [
              [import_vue7.vModelSelect, filter.value.status]
            ]),
            (0, import_vue7.createElementVNode)(
              "span",
              _hoisted_124,
              "共 " + (0, import_vue7.toDisplayString)(filtered.value.length) + " 个",
              1
              /* TEXT */
            )
          ]),
          (0, import_vue7.createElementVNode)("table", _hoisted_133, [
            _cache[14] || (_cache[14] = (0, import_vue7.createElementVNode)(
              "thead",
              null,
              [
                (0, import_vue7.createElementVNode)("tr", null, [
                  (0, import_vue7.createElementVNode)("th", null, "提供方"),
                  (0, import_vue7.createElementVNode)("th", null, "类型"),
                  (0, import_vue7.createElementVNode)("th", null, "版本"),
                  (0, import_vue7.createElementVNode)("th", null, "状态"),
                  (0, import_vue7.createElementVNode)("th", null, "接口"),
                  (0, import_vue7.createElementVNode)("th", null, "延迟"),
                  (0, import_vue7.createElementVNode)("th", null, "失败"),
                  (0, import_vue7.createElementVNode)("th", null, "操作")
                ])
              ],
              -1
              /* CACHED */
            )),
            (0, import_vue7.createElementVNode)("tbody", null, [
              ((0, import_vue7.openBlock)(true), (0, import_vue7.createElementBlock)(
                import_vue7.Fragment,
                null,
                (0, import_vue7.renderList)(filtered.value, (r) => {
                  return (0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("tr", {
                    key: r.name,
                    onClick: ($event) => toggleRow(r.name)
                  }, [
                    (0, import_vue7.createElementVNode)("td", null, [
                      (0, import_vue7.createElementVNode)(
                        "span",
                        {
                          class: (0, import_vue7.normalizeClass)(["dot", r.online ? "on" : "off"])
                        },
                        null,
                        2
                        /* CLASS */
                      ),
                      (0, import_vue7.createElementVNode)(
                        "b",
                        null,
                        (0, import_vue7.toDisplayString)(r.label),
                        1
                        /* TEXT */
                      )
                    ]),
                    (0, import_vue7.createElementVNode)(
                      "td",
                      null,
                      (0, import_vue7.toDisplayString)(r.kind === "system" ? "系统" : "插件"),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue7.createElementVNode)(
                      "td",
                      null,
                      (0, import_vue7.toDisplayString)(r.version),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue7.createElementVNode)("td", null, [
                      (0, import_vue7.createTextVNode)(
                        (0, import_vue7.toDisplayString)(r.status),
                        1
                        /* TEXT */
                      ),
                      r.err ? ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)(
                        "span",
                        _hoisted_153,
                        " · " + (0, import_vue7.toDisplayString)(r.err),
                        1
                        /* TEXT */
                      )) : (0, import_vue7.createCommentVNode)("v-if", true)
                    ]),
                    (0, import_vue7.createElementVNode)(
                      "td",
                      null,
                      (0, import_vue7.toDisplayString)(r.ifaces.length),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue7.createElementVNode)(
                      "td",
                      null,
                      (0, import_vue7.toDisplayString)(r.latency != null ? r.latency + "ms" : "-"),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue7.createElementVNode)(
                      "td",
                      null,
                      (0, import_vue7.toDisplayString)(r.fail),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue7.createElementVNode)("td", {
                      onClick: _cache[2] || (_cache[2] = (0, import_vue7.withModifiers)(() => {
                      }, ["stop"]))
                    }, [
                      r.ifaces.length ? ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("button", {
                        key: 0,
                        class: "btn small",
                        onClick: ($event) => goIfaces(r.name)
                      }, "接口", 8, _hoisted_163)) : (0, import_vue7.createCommentVNode)("v-if", true),
                      (0, import_vue7.createElementVNode)("button", {
                        class: "btn small",
                        onClick: ($event) => openLog(r.name)
                      }, "日志", 8, _hoisted_172)
                    ])
                  ], 8, _hoisted_143);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              !filtered.value.length ? ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("tr", _hoisted_182, [..._cache[12] || (_cache[12] = [
                (0, import_vue7.createElementVNode)(
                  "td",
                  {
                    colspan: "8",
                    class: "empty"
                  },
                  "暂无服务",
                  -1
                  /* CACHED */
                )
              ])])) : (0, import_vue7.createCommentVNode)("v-if", true),
              expanded.value ? ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("tr", _hoisted_192, [
                (0, import_vue7.createElementVNode)("td", _hoisted_202, [
                  expandedRow.value && expandedRow.value.ifaces.length ? ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)(
                    import_vue7.Fragment,
                    { key: 0 },
                    [
                      _cache[13] || (_cache[13] = (0, import_vue7.createElementVNode)(
                        "span",
                        { class: "faint" },
                        "注册接口:",
                        -1
                        /* CACHED */
                      )),
                      ((0, import_vue7.openBlock)(true), (0, import_vue7.createElementBlock)(
                        import_vue7.Fragment,
                        null,
                        (0, import_vue7.renderList)(expandedRow.value.ifaces, (id) => {
                          return (0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("span", {
                            key: id,
                            class: "chip",
                            onClick: (0, import_vue7.withModifiers)(($event) => goIfaces(id), ["stop"])
                          }, (0, import_vue7.toDisplayString)(id), 9, _hoisted_212);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("span", _hoisted_223, "该服务未注册接口"))
                ])
              ])) : (0, import_vue7.createCommentVNode)("v-if", true)
            ])
          ]),
          log.value.open ? ((0, import_vue7.openBlock)(), (0, import_vue7.createElementBlock)("div", _hoisted_232, [
            (0, import_vue7.createElementVNode)("div", _hoisted_242, [
              (0, import_vue7.createElementVNode)(
                "b",
                null,
                "诊断日志 · " + (0, import_vue7.toDisplayString)(log.value.name),
                1
                /* TEXT */
              ),
              (0, import_vue7.createElementVNode)("button", {
                class: "btn small",
                disabled: log.value.loading,
                onClick: reloadLog
              }, "刷新", 8, _hoisted_252),
              (0, import_vue7.createElementVNode)("button", {
                class: "btn small",
                onClick: _cache[3] || (_cache[3] = ($event) => log.value.open = false)
              }, "关闭")
            ]),
            (0, import_vue7.createElementVNode)(
              "pre",
              null,
              (0, import_vue7.toDisplayString)(log.value.text),
              1
              /* TEXT */
            )
          ])) : (0, import_vue7.createCommentVNode)("v-if", true)
        ]);
      };
    }
  };
  __sfc_main4.__scopeId = "data-v-2kscv1";
  var ServiceHealth_default = __sfc_main4;
  (function() {
    var key = "rc-ext-css-data-v-2kscv1-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.sum[data-v-2kscv1] { display: flex; gap: 10px; margin-bottom: 10px;\n}\n.stat-card[data-v-2kscv1] { background: var(--bg2,#fff); border: 1px solid var(--border,#e5e5e5); border-radius: 8px; padding: 10px 16px; display: flex; flex-direction: column; min-width: 90px;\n}\n.stat-card b[data-v-2kscv1] { font-size: 20px;\n}\n.stat-card span[data-v-2kscv1] { font-size: 12px; color:#888;\n}\n.bar[data-v-2kscv1] { display: flex; gap: 8px; align-items: center; margin-bottom: 10px;\n}\n.dot[data-v-2kscv1] { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px;\n}\n.on[data-v-2kscv1] { background:#2e9e5b;\n}\n.off[data-v-2kscv1] { background:#d9524e;\n}\n.err[data-v-2kscv1] { color:#d33; font-size:12px;\n}\n.btn.small[data-v-2kscv1] { padding: 2px 10px; font-size: 12px; margin-right: 4px;\n}\n.expand[data-v-2kscv1] { background: rgba(53,121,168,.06);\n}\n.chip[data-v-2kscv1] { display:inline-block; background:#eef4fa; border:1px solid #cfe0ee; border-radius: 10px; padding:2px 10px; margin:3px 4px 3px 0; font-size:12px; cursor:pointer;\n}\n.log-panel[data-v-2kscv1] { margin-top:12px; border:1px solid var(--border,#e5e5e5); border-radius:8px;\n}\n.log-head[data-v-2kscv1] { display:flex; gap:8px; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border,#e5e5e5);\n}\n.log-panel pre[data-v-2kscv1] { margin:0; padding:12px; max-height:380px; overflow:auto; font-size:12px; background:#0d1117; color:#c9d1d9; white-space:pre-wrap;\n}\n.empty[data-v-2kscv1] { color:#999; text-align:center; padding:12px;\n}\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/EnvPkgMain.vue
  var import_vue9 = __toESM(require_vue());
  var import_vue10 = __toESM(require_vue());
  var import_rc_api5 = __toESM(require_rc_api());
  var _hoisted_114 = {
    key: 0,
    class: "error",
    style: { "margin-top": "12px" }
  };
  var _hoisted_213 = {
    key: 1,
    class: "ok",
    style: { "margin-top": "12px" }
  };
  var _hoisted_312 = {
    class: "tabs",
    style: { "margin-top": "20px" }
  };
  var _hoisted_46 = ["onClick"];
  var _hoisted_55 = {
    key: 0,
    class: "tab-count"
  };
  var _hoisted_65 = {
    class: "toolbar",
    style: { "margin-top": "16px" }
  };
  var _hoisted_74 = { class: "checkbox" };
  var _hoisted_84 = ["disabled"];
  var _hoisted_94 = {
    class: "grid",
    style: { "margin-top": "16px" }
  };
  var _hoisted_104 = { class: "card-top" };
  var _hoisted_115 = {
    key: 0,
    class: "tag-chip warn"
  };
  var _hoisted_125 = {
    key: 1,
    class: "tag-chip ok"
  };
  var _hoisted_134 = { class: "card-title" };
  var _hoisted_144 = { class: "card-meta" };
  var _hoisted_154 = { class: "card-actions" };
  var _hoisted_164 = {
    key: 0,
    class: "btn btn-sm btn-ghost",
    disabled: ""
  };
  var _hoisted_173 = ["onClick"];
  var _hoisted_183 = {
    key: 0,
    class: "empty-card"
  };
  var _hoisted_193 = {
    class: "section",
    style: { "margin-top": "24px" }
  };
  var _hoisted_203 = { class: "section-title" };
  var _hoisted_214 = {
    key: 0,
    class: "hint",
    style: { "margin-top": "8px" }
  };
  var _hoisted_224 = {
    key: 1,
    class: "grid"
  };
  var _hoisted_233 = { class: "card-top" };
  var _hoisted_243 = { class: "tag-chip" };
  var _hoisted_253 = { class: "card-title" };
  var _hoisted_262 = { class: "card-meta" };
  var _hoisted_272 = { class: "card-meta" };
  var _hoisted_282 = { class: "card-actions" };
  var _hoisted_292 = ["onClick"];
  var _hoisted_302 = ["onClick"];
  var _hoisted_313 = ["onClick"];
  var _hoisted_323 = ["onClick"];
  var _hoisted_332 = {
    key: 2,
    class: "modal-mask"
  };
  var _hoisted_342 = { class: "modal" };
  var _hoisted_352 = { style: { "margin-top": "16px" } };
  var _hoisted_362 = { class: "form-row" };
  var _hoisted_372 = { class: "hint" };
  var _hoisted_382 = { class: "form-row" };
  var _hoisted_392 = { class: "name" };
  var _hoisted_402 = { class: "modal-actions" };
  var _hoisted_412 = {
    key: 3,
    class: "modal-mask"
  };
  var _hoisted_423 = { class: "modal" };
  var _hoisted_432 = { class: "modal-head" };
  var _hoisted_442 = {
    class: "search-bar",
    style: { "align-items": "stretch", "margin-top": "14px" }
  };
  var _hoisted_452 = ["disabled"];
  var _hoisted_462 = { style: { "margin-top": "10px" } };
  var _hoisted_47 = ["value"];
  var _hoisted_48 = { style: { "margin-top": "8px" } };
  var __sfc_main5 = {
    __name: "EnvPkgMain",
    setup(__props) {
      const envs = (0, import_vue10.ref)({});
      const catalog = (0, import_vue10.ref)(null);
      const loading = (0, import_vue10.ref)(false);
      const error = (0, import_vue10.ref)("");
      const notice = (0, import_vue10.ref)("");
      const activeTab = (0, import_vue10.ref)("java");
      const search = (0, import_vue10.ref)("");
      const selType = (0, import_vue10.ref)("");
      const selVer = (0, import_vue10.ref)("");
      const selLabel = (0, import_vue10.ref)("");
      const versionModal = (0, import_vue10.ref)(false);
      const runName = (0, import_vue10.ref)("");
      const runCmd = (0, import_vue10.ref)("");
      const runOut = (0, import_vue10.ref)("");
      const runErr = (0, import_vue10.ref)("");
      const runLoading = (0, import_vue10.ref)(false);
      const runShow = (0, import_vue10.ref)(false);
      const onlyInstalled = (0, import_vue10.ref)(false);
      let pollTimer = null;
      const TABS = [
        { key: "java", label: "Java", icon: "J", desc: "JDK / Temurin", color: "#e76f51" },
        { key: "node", label: "Node.js", icon: "N", desc: "JavaScript 运行时", color: "#3fb950" },
        { key: "go", label: "Go", icon: "G", desc: "编译型静态语言", color: "#58a6ff" },
        { key: "python", label: "Python", icon: "P", desc: "解释型脚本语言", color: "#f0b429" },
        { key: "php", label: "PHP", icon: "Ph", desc: "Web 脚本语言", color: "#a371f7" },
        { key: "maven", label: "Maven", icon: "M", desc: "Java 构建工具", color: "#e58ba9" },
        { key: "cpp", label: "C/C++", icon: "C", desc: "系统编译工具链", color: "#8b949e" }
      ];
      const typeMeta = (0, import_vue10.computed)(() => TABS.find((t) => t.key === activeTab.value) || TABS[0]);
      const list = (0, import_vue10.computed)(() => {
        const rows = catalog.value && catalog.value[activeTab.value];
        if (!rows) return [];
        let out = rows;
        if (search.value.trim()) {
          const q = search.value.trim().toLowerCase();
          out = out.filter((r) => (r.label || "").toLowerCase().includes(q) || (r.version || "").toLowerCase().includes(q));
        }
        if (onlyInstalled.value) out = out.filter((r) => r.installed);
        return out;
      });
      const installedList = (0, import_vue10.computed)(() => Object.values(envs.value));
      async function load() {
        loading.value = true;
        error.value = "";
        try {
          const [e, c] = await Promise.all([import_rc_api5.api.envList(), import_rc_api5.api.envCatalog()]);
          envs.value = e.envs || {};
          catalog.value = c.catalog || {};
        } catch (err) {
          error.value = err.message;
        } finally {
          loading.value = false;
        }
      }
      (0, import_vue10.onMounted)(() => {
        load();
        pollTimer = setInterval(() => {
          import_rc_api5.api.envList().then((e) => {
            envs.value = e.envs || {};
          }).catch(() => {
          });
          import_rc_api5.api.envCatalog().then((c) => {
            if (c.catalog) catalog.value = c.catalog;
          }).catch(() => {
          });
        }, 5e3);
      });
      (0, import_vue10.onBeforeUnmount)(() => {
        clearInterval(pollTimer);
      });
      function pollEnv() {
        import_rc_api5.api.envList().then((e) => {
          envs.value = e.envs || {};
          const c = e.catalog;
          if (c) Object.assign(catalog.value || {}, c);
          if (!catalog.value) load();
        }).catch(() => {
        });
      }
      function taskOfName(name) {
        return envs.value[name] || null;
      }
      const runningNames = (0, import_vue10.computed)(() => {
        return new Set(Object.keys(envs.value));
      });
      function selectVersion(r) {
        if (r.installed) return;
        selType.value = r.type;
        selVer.value = r.version;
        selLabel.value = r.label || r.version;
        versionModal.value = true;
      }
      async function doInstall() {
        error.value = "";
        try {
          const res = await import_rc_api5.api.envInstallRT(selType.value, selVer.value);
          notice.value = `已开始安装 ${selLabel.value}...`;
          setTimeout(() => {
            notice.value = "";
          }, 5e3);
          versionModal.value = false;
          load();
        } catch (err) {
          error.value = err.message;
        }
      }
      async function uninstall(name) {
        if (!confirm(`确认卸载 ${name}？会删除其安装目录。`)) return;
        error.value = "";
        try {
          const r = await import_rc_api5.api.envUninstall(name);
          notice.value = r.message;
          setTimeout(() => {
            notice.value = "";
          }, 4e3);
          load();
        } catch (err) {
          error.value = err.message;
        }
      }
      async function start(name) {
        error.value = "";
        try {
          await import_rc_api5.api.envStart(name);
          load();
        } catch (err) {
          error.value = err.message;
        }
      }
      async function stop(name) {
        error.value = "";
        try {
          await import_rc_api5.api.envStop(name);
          load();
        } catch (err) {
          error.value = err.message;
        }
      }
      function openRun(name) {
        runName.value = name;
        runCmd.value = "";
        runOut.value = "";
        runErr.value = "";
        runShow.value = true;
      }
      async function doRun() {
        if (!runCmd.value.trim()) {
          runErr.value = "请输入命令";
          return;
        }
        runLoading.value = true;
        runOut.value = "";
        runErr.value = "";
        try {
          const r = await import_rc_api5.api.envRun(runName.value, runCmd.value, 120);
          runOut.value = r.stdout || "";
          runErr.value = r.stderr || "";
          if (!r.ok && !r.stderr) runErr.value = `退出码 ${r.rc}`;
        } catch (err) {
          runErr.value = err.message;
        } finally {
          runLoading.value = false;
        }
      }
      function fmtSize(n) {
        if (!n) return "-";
        if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(1) + " GB";
        if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
        return Math.round(n / 1024) + " KB";
      }
      function installedPkg(name) {
        return envs.value[name] && envs.value[name].status === "installed";
      }
      return (_ctx, _cache) => {
        return (0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("div", null, [
          _cache[10] || (_cache[10] = (0, import_vue9.createElementVNode)(
            "div",
            { class: "head" },
            [
              (0, import_vue9.createElementVNode)("div", null, [
                (0, import_vue9.createElementVNode)("h1", null, "环境包管理"),
                (0, import_vue9.createElementVNode)("div", { class: "subtitle" }, "自包含运行时：JDK / Node / Go / Python / PHP / Maven / C++ 工具链，供站点、终端、调度任务调用")
              ])
            ],
            -1
            /* CACHED */
          )),
          error.value ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
            "div",
            _hoisted_114,
            (0, import_vue9.toDisplayString)(error.value),
            1
            /* TEXT */
          )) : (0, import_vue9.createCommentVNode)("v-if", true),
          notice.value ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
            "div",
            _hoisted_213,
            (0, import_vue9.toDisplayString)(notice.value),
            1
            /* TEXT */
          )) : (0, import_vue9.createCommentVNode)("v-if", true),
          (0, import_vue9.createCommentVNode)(" Tabs "),
          (0, import_vue9.createElementVNode)("div", _hoisted_312, [
            ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
              import_vue9.Fragment,
              null,
              (0, import_vue9.renderList)(TABS, (t) => {
                return (0, import_vue9.createElementVNode)("button", {
                  key: t.key,
                  class: (0, import_vue9.normalizeClass)(["tab", { "tab--active": activeTab.value === t.key }]),
                  onClick: ($event) => activeTab.value = t.key,
                  style: (0, import_vue9.normalizeStyle)(activeTab.value === t.key ? { borderColor: t.color, color: t.color } : {})
                }, [
                  (0, import_vue9.createElementVNode)(
                    "span",
                    {
                      class: "tab-icon",
                      style: (0, import_vue9.normalizeStyle)({ background: t.color })
                    },
                    (0, import_vue9.toDisplayString)(t.icon),
                    5
                    /* TEXT, STYLE */
                  ),
                  (0, import_vue9.createTextVNode)(
                    " " + (0, import_vue9.toDisplayString)(t.label) + " ",
                    1
                    /* TEXT */
                  ),
                  catalog.value && catalog.value[t.key] ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
                    "span",
                    _hoisted_55,
                    (0, import_vue9.toDisplayString)(catalog.value[t.key].length),
                    1
                    /* TEXT */
                  )) : (0, import_vue9.createCommentVNode)("v-if", true)
                ], 14, _hoisted_46);
              }),
              64
              /* STABLE_FRAGMENT */
            ))
          ]),
          (0, import_vue9.createCommentVNode)(" search + filter "),
          (0, import_vue9.createElementVNode)("div", _hoisted_65, [
            (0, import_vue9.withDirectives)((0, import_vue9.createElementVNode)(
              "input",
              {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => search.value = $event),
                class: "input",
                style: { "flex": "1" },
                placeholder: "搜索版本…"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [import_vue9.vModelText, search.value]
            ]),
            (0, import_vue9.createElementVNode)("label", _hoisted_74, [
              (0, import_vue9.withDirectives)((0, import_vue9.createElementVNode)(
                "input",
                {
                  type: "checkbox",
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => onlyInstalled.value = $event)
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [import_vue9.vModelCheckbox, onlyInstalled.value]
              ]),
              _cache[5] || (_cache[5] = (0, import_vue9.createTextVNode)(
                " 只看已装",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue9.createElementVNode)("button", {
              class: "btn btn-ghost",
              onClick: load,
              disabled: loading.value
            }, (0, import_vue9.toDisplayString)(loading.value ? "加载中…" : "刷新"), 9, _hoisted_84)
          ]),
          (0, import_vue9.createCommentVNode)(" version grid "),
          (0, import_vue9.createElementVNode)("div", _hoisted_94, [
            ((0, import_vue9.openBlock)(true), (0, import_vue9.createElementBlock)(
              import_vue9.Fragment,
              null,
              (0, import_vue9.renderList)(list.value, (r) => {
                return (0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
                  "div",
                  {
                    key: r.version,
                    class: (0, import_vue9.normalizeClass)(["card", { "card--installed": r.installed }])
                  },
                  [
                    (0, import_vue9.createElementVNode)("div", _hoisted_104, [
                      (0, import_vue9.createElementVNode)(
                        "span",
                        {
                          class: "tag-chip",
                          style: (0, import_vue9.normalizeStyle)({ background: typeMeta.value.color })
                        },
                        (0, import_vue9.toDisplayString)(r.version),
                        5
                        /* TEXT, STYLE */
                      ),
                      r.compile ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("span", _hoisted_115, "源码编译")) : (0, import_vue9.createCommentVNode)("v-if", true),
                      r.installed ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("span", _hoisted_125, "已安装")) : (0, import_vue9.createCommentVNode)("v-if", true)
                    ]),
                    (0, import_vue9.createElementVNode)(
                      "div",
                      _hoisted_134,
                      (0, import_vue9.toDisplayString)(r.label),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue9.createElementVNode)(
                      "div",
                      _hoisted_144,
                      (0, import_vue9.toDisplayString)(r.size_hint),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue9.createElementVNode)("div", _hoisted_154, [
                      r.installed ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("button", _hoisted_164, "已安装")) : ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("button", {
                        key: 1,
                        class: "btn btn-sm btn-primary",
                        onClick: ($event) => selectVersion(r)
                      }, "下载安装", 8, _hoisted_173))
                    ])
                  ],
                  2
                  /* CLASS */
                );
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            !list.value.length ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
              "div",
              _hoisted_183,
              "暂无" + (0, import_vue9.toDisplayString)(typeMeta.value.label) + "版本",
              1
              /* TEXT */
            )) : (0, import_vue9.createCommentVNode)("v-if", true)
          ]),
          (0, import_vue9.createCommentVNode)(" installed section "),
          (0, import_vue9.createElementVNode)("div", _hoisted_193, [
            (0, import_vue9.createElementVNode)(
              "div",
              _hoisted_203,
              "已安装环境 (" + (0, import_vue9.toDisplayString)(installedList.value.length) + ")",
              1
              /* TEXT */
            ),
            !installedList.value.length ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("div", _hoisted_214, "尚未安装任何环境包")) : ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("div", _hoisted_224, [
              ((0, import_vue9.openBlock)(true), (0, import_vue9.createElementBlock)(
                import_vue9.Fragment,
                null,
                (0, import_vue9.renderList)(installedList.value, (e) => {
                  return (0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("div", {
                    key: e.name,
                    class: "card card--installed"
                  }, [
                    (0, import_vue9.createElementVNode)("div", _hoisted_233, [
                      (0, import_vue9.createElementVNode)(
                        "span",
                        {
                          class: "tag-chip",
                          style: (0, import_vue9.normalizeStyle)({ background: (TABS.find((t) => t.key === e.type) || {}).color || "#8b949e" })
                        },
                        (0, import_vue9.toDisplayString)(e.type),
                        5
                        /* TEXT, STYLE */
                      ),
                      (0, import_vue9.createElementVNode)(
                        "span",
                        _hoisted_243,
                        (0, import_vue9.toDisplayString)(e.version),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue9.createElementVNode)(
                        "span",
                        {
                          class: (0, import_vue9.normalizeClass)(["tag-chip", e.exists ? "ok" : "fail"])
                        },
                        (0, import_vue9.toDisplayString)(e.exists ? "存在" : "缺失"),
                        3
                        /* TEXT, CLASS */
                      ),
                      e.type === "php" ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)(
                        "span",
                        {
                          key: 0,
                          class: (0, import_vue9.normalizeClass)(["tag-chip", e.fpm_running ? "ok" : "fail"])
                        },
                        (0, import_vue9.toDisplayString)(e.fpm_running ? "FPM运行" : "FPM停"),
                        3
                        /* TEXT, CLASS */
                      )) : (0, import_vue9.createCommentVNode)("v-if", true)
                    ]),
                    (0, import_vue9.createElementVNode)(
                      "div",
                      _hoisted_253,
                      (0, import_vue9.toDisplayString)(e.name),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue9.createElementVNode)(
                      "div",
                      _hoisted_262,
                      (0, import_vue9.toDisplayString)(e.root) + " · " + (0, import_vue9.toDisplayString)(fmtSize(e.size)),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue9.createElementVNode)(
                      "div",
                      _hoisted_272,
                      "安装于 " + (0, import_vue9.toDisplayString)(new Date(e.installed * 1e3).toLocaleString()),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue9.createElementVNode)("div", _hoisted_282, [
                      (0, import_vue9.createElementVNode)("button", {
                        class: "btn btn-sm",
                        onClick: ($event) => openRun(e.name)
                      }, "运行", 8, _hoisted_292),
                      e.type === "php" && !e.fpm_running ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("button", {
                        key: 0,
                        class: "btn btn-sm",
                        onClick: ($event) => start(e.name)
                      }, "启动FPM", 8, _hoisted_302)) : e.type === "php" ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("button", {
                        key: 1,
                        class: "btn btn-sm",
                        onClick: ($event) => stop(e.name)
                      }, "停止FPM", 8, _hoisted_313)) : (0, import_vue9.createCommentVNode)("v-if", true),
                      (0, import_vue9.createElementVNode)("button", {
                        class: "btn btn-sm btn-danger",
                        onClick: ($event) => uninstall(e.name)
                      }, "卸载", 8, _hoisted_323)
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]))
          ]),
          (0, import_vue9.createCommentVNode)(" version confirm modal "),
          versionModal.value ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("div", _hoisted_332, [
            (0, import_vue9.createElementVNode)("div", _hoisted_342, [
              _cache[9] || (_cache[9] = (0, import_vue9.createElementVNode)(
                "div",
                { class: "modal-head" },
                "下载并安装",
                -1
                /* CACHED */
              )),
              (0, import_vue9.createElementVNode)("div", _hoisted_352, [
                (0, import_vue9.createElementVNode)("div", _hoisted_362, [
                  _cache[6] || (_cache[6] = (0, import_vue9.createElementVNode)(
                    "span",
                    { class: "form-label" },
                    "运行",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue9.createElementVNode)(
                    "span",
                    _hoisted_372,
                    (0, import_vue9.toDisplayString)(selType.value),
                    1
                    /* TEXT */
                  )
                ]),
                (0, import_vue9.createElementVNode)("div", _hoisted_382, [
                  _cache[7] || (_cache[7] = (0, import_vue9.createElementVNode)(
                    "span",
                    { class: "form-label" },
                    "版本",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue9.createElementVNode)(
                    "span",
                    _hoisted_392,
                    (0, import_vue9.toDisplayString)(selLabel.value),
                    1
                    /* TEXT */
                  )
                ]),
                _cache[8] || (_cache[8] = (0, import_vue9.createElementVNode)(
                  "div",
                  {
                    class: "hint",
                    style: { "margin-top": "8px" }
                  },
                  "将从官方/镜像源下载并安装到系统，安装过程中可离开此页。",
                  -1
                  /* CACHED */
                ))
              ]),
              (0, import_vue9.createElementVNode)("div", _hoisted_402, [
                (0, import_vue9.createElementVNode)("button", {
                  class: "btn btn-primary",
                  onClick: doInstall
                }, "确认安装"),
                (0, import_vue9.createElementVNode)("button", {
                  class: "btn btn-ghost",
                  onClick: _cache[2] || (_cache[2] = ($event) => versionModal.value = false)
                }, "取消")
              ])
            ])
          ])) : (0, import_vue9.createCommentVNode)("v-if", true),
          (0, import_vue9.createCommentVNode)(" run console "),
          runShow.value ? ((0, import_vue9.openBlock)(), (0, import_vue9.createElementBlock)("div", _hoisted_412, [
            (0, import_vue9.createElementVNode)("div", _hoisted_423, [
              (0, import_vue9.createElementVNode)(
                "div",
                _hoisted_432,
                "环境运行 · " + (0, import_vue9.toDisplayString)(runName.value),
                1
                /* TEXT */
              ),
              (0, import_vue9.createElementVNode)("div", _hoisted_442, [
                (0, import_vue9.withDirectives)((0, import_vue9.createElementVNode)(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => runCmd.value = $event),
                    class: "input",
                    style: { "flex": "1", "font-family": "var(--font-mono)" },
                    placeholder: "如 java -version / node -v / go version",
                    onKeyup: (0, import_vue9.withKeys)(doRun, ["enter"])
                  },
                  null,
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ), [
                  [import_vue9.vModelText, runCmd.value]
                ]),
                (0, import_vue9.createElementVNode)("button", {
                  class: "btn btn-primary",
                  disabled: runLoading.value,
                  onClick: doRun
                }, (0, import_vue9.toDisplayString)(runLoading.value ? "运行中..." : "运行"), 9, _hoisted_452)
              ]),
              (0, import_vue9.createElementVNode)("div", _hoisted_462, [
                (0, import_vue9.createElementVNode)("textarea", {
                  class: "input",
                  style: { "width": "100%", "min-height": "160px", "font-family": "var(--font-mono)", "font-size": "12px" },
                  readonly: "",
                  value: (runOut.value ? runOut.value + "\n" : "") + (runErr.value ? "[err] " + runErr.value : "")
                }, null, 8, _hoisted_47)
              ]),
              (0, import_vue9.createElementVNode)("div", _hoisted_48, [
                (0, import_vue9.createElementVNode)("button", {
                  class: "btn btn-sm btn-ghost",
                  onClick: _cache[4] || (_cache[4] = ($event) => runShow.value = false)
                }, "关闭")
              ])
            ])
          ])) : (0, import_vue9.createCommentVNode)("v-if", true)
        ]);
      };
    }
  };
  __sfc_main5.__scopeId = "data-v-14197ca";
  var EnvPkgMain_default = __sfc_main5;
  (function() {
    var key = "rc-ext-css-data-v-14197ca-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.tabs[data-v-14197ca] { display: flex; flex-wrap: wrap; gap: 8px;\n}\n.tab[data-v-14197ca] { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--border);\r\n  border-radius: 0; background: var(--surface); color: var(--text-faint); cursor: pointer; font-size: 13px; transition: all .15s;\n}\n.tab[data-v-14197ca]:hover { border-color: var(--border-strong);\n}\n.tab--active[data-v-14197ca] { background: var(--surface); font-weight: 600;\n}\n.tab-icon[data-v-14197ca] { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;\r\n  border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700;\n}\n.tab-count[data-v-14197ca] { font-size: 11px; color: var(--text-faint);\n}\n.toolbar[data-v-14197ca] { display: flex; gap: 10px; align-items: center; flex-wrap: wrap;\n}\n.checkbox[data-v-14197ca] { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-faint);\n}\n.grid[data-v-14197ca] { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;\n}\n.card[data-v-14197ca] { background: var(--surface); border: 1px solid var(--border); border-radius: 0; padding: 14px;\r\n  transition: transform .15s, border-color .15s;\n}\n.card[data-v-14197ca]:hover { transform: translateY(-2px); border-color: var(--border-strong);\n}\n.card--installed[data-v-14197ca] { border-color: #3fb950;\n}\n.card-top[data-v-14197ca] { display: flex; gap: 6px; flex-wrap: wrap; align-items: center;\n}\n.card-title[data-v-14197ca] { font-size: 15px; font-weight: 600; margin-top: 10px; word-break: break-all;\n}\n.card-meta[data-v-14197ca] { font-size: 12px; color: var(--text-faint); margin-top: 4px;\n}\n.card-actions[data-v-14197ca] { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;\n}\n.empty-card[data-v-14197ca] { display: flex; align-items: center; justify-content: center; min-height: 90px;\r\n  border: 1px dashed var(--border-strong); border-radius: 0; color: var(--text-faint);\n}\n.section[data-v-14197ca] { background: var(--surface); border: 1px solid var(--border); border-radius: 0; padding: 20px;\n}\n.section-title[data-v-14197ca] { font-size: 16px; font-weight: 600; margin-bottom: 14px;\n}\n.tag-chip.warn[data-v-14197ca] { color: #f0b429;\n}\n.modal-mask[data-v-14197ca] { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50;\n}\n.modal[data-v-14197ca] { background: var(--bg); border: 1px solid var(--border); border-radius: 0; width: min(420px, 92vw); padding: 22px; max-height: 88vh; overflow: auto;\n}\n.modal-head[data-v-14197ca] { font-size: 17px; font-weight: 600; margin-bottom: 14px;\n}\n.modal-actions[data-v-14197ca] { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;\n}\r\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/Ifaces.vue
  var import_vue11 = __toESM(require_vue());
  var import_vue12 = __toESM(require_vue());
  var import_vue_router2 = __toESM(require_vue_router());
  var import_rc_api6 = __toESM(require_rc_api());
  var _hoisted_116 = { class: "section" };
  var _hoisted_215 = { class: "section-title" };
  var _hoisted_314 = ["disabled"];
  var _hoisted_49 = {
    key: 0,
    class: "err",
    style: { "margin-bottom": "8px", "padding": "8px 10px", "border": "1px solid #f3c1c0", "background": "#fdf1f1", "border-radius": "6px" }
  };
  var _hoisted_56 = { class: "iface-summary" };
  var _hoisted_66 = { class: "stat-card" };
  var _hoisted_75 = { class: "stat-card" };
  var _hoisted_85 = { style: { "color": "#2e9e5b" } };
  var _hoisted_95 = { class: "stat-card" };
  var _hoisted_105 = { style: { "color": "#d9524e" } };
  var _hoisted_117 = { class: "stat-card" };
  var _hoisted_126 = { class: "stat-card" };
  var _hoisted_135 = { class: "stat-card" };
  var _hoisted_145 = { class: "iface-filter" };
  var _hoisted_155 = ["value"];
  var _hoisted_165 = { class: "faint" };
  var _hoisted_174 = {
    key: 0,
    class: "iface-pager"
  };
  var _hoisted_184 = ["disabled"];
  var _hoisted_194 = { class: "faint" };
  var _hoisted_204 = ["disabled"];
  var _hoisted_216 = { class: "iface-body" };
  var _hoisted_225 = { class: "iface-list" };
  var _hoisted_234 = {
    key: 0,
    class: "empty"
  };
  var _hoisted_244 = { class: "group-head" };
  var _hoisted_254 = { class: "table" };
  var _hoisted_263 = ["onClick"];
  var _hoisted_273 = {
    key: 0,
    class: "iface-detail"
  };
  var _hoisted_283 = { class: "detail-head" };
  var _hoisted_293 = { class: "faint" };
  var _hoisted_303 = {
    key: 0,
    class: "err"
  };
  var _hoisted_315 = {
    key: 1,
    class: "kv"
  };
  var _hoisted_324 = { class: "kv" };
  var _hoisted_333 = { class: "kv" };
  var _hoisted_343 = {
    key: 2,
    class: "kv"
  };
  var _hoisted_353 = { class: "err" };
  var _hoisted_363 = { class: "kv" };
  var _hoisted_373 = { class: "test-box" };
  var _hoisted_383 = ["disabled"];
  var _hoisted_393 = {
    key: 0,
    class: "result"
  };
  var _hoisted_403 = {
    key: 1,
    class: "iface-detail empty"
  };
  var pageSize = 500;
  var __sfc_main6 = {
    __name: "Ifaces",
    setup(__props) {
      const route = (0, import_vue_router2.useRoute)();
      const summary = (0, import_vue12.ref)({ interfaces: 0, online: 0, offline: 0, plugin: 0, system: 0, providers: 0 });
      const items = (0, import_vue12.ref)([]);
      const total = (0, import_vue12.ref)(0);
      const loading = (0, import_vue12.ref)(false);
      const loadErr = (0, import_vue12.ref)("");
      const page = (0, import_vue12.ref)(1);
      const detail = (0, import_vue12.ref)(null);
      const detailErr = (0, import_vue12.ref)("");
      const testParams = (0, import_vue12.ref)("{}");
      const testResult = (0, import_vue12.ref)("");
      const testing = (0, import_vue12.ref)(false);
      const filters = (0, import_vue12.ref)({ source: "", visibility: "", status: "", q: "" });
      const visibilities = ["", "all", "main", "private"];
      let timer = null;
      const pages = (0, import_vue12.computed)(() => Math.max(1, Math.ceil(total.value / pageSize)));
      async function load() {
        loading.value = true;
        loadErr.value = "";
        try {
          const f = { ...filters.value, page: page.value, page_size: pageSize };
          if (!f.q) delete f.q;
          const [cat, sum] = await Promise.all([import_rc_api6.api.ifaces(f), import_rc_api6.api.ifacesSummary()]);
          items.value = cat.items || [];
          total.value = cat.total || 0;
          Object.assign(summary.value, sum);
          if (page.value > pages.value) {
            page.value = pages.value;
            return load();
          }
        } catch (e) {
          loadErr.value = e && e.message || String(e);
        } finally {
          loading.value = false;
        }
      }
      function resetLoad() {
        page.value = 1;
        load();
      }
      function goPage(p) {
        if (p < 1 || p > pages.value || p === page.value) return;
        page.value = p;
        load();
      }
      const DANGER_RE = /(delete|remove|install|uninstall|send|save|create|update|start|stop|restart|close|purge|runnow|mkdir|rename|cancel|clear|format|reboot|shutdown|exec)/i;
      function isDangerous(it) {
        if (!it) return false;
        if (DANGER_RE.test(it.id)) return true;
        return it.source === "system" && it.visibility !== "all";
      }
      function groups() {
        const by = /* @__PURE__ */ new Map();
        for (const it of items.value) {
          if (!by.has(it.plugin)) by.set(it.plugin, []);
          by.get(it.plugin).push(it);
        }
        return [...by.entries()].map(([plugin, list]) => ({ plugin, list }));
      }
      async function openDetail(it) {
        detail.value = it;
        detailErr.value = "";
        testResult.value = "";
        testParams.value = JSON.stringify(previewParams(it.input), null, 1);
        try {
          const d = await import_rc_api6.api.ifaceDetail(it.id);
          detail.value = { ...it, ...d };
        } catch (e) {
          detailErr.value = "详情加载失败: " + (e.message || e);
        }
      }
      function previewParams(schema) {
        if (!schema || schema.type !== "object" || !schema.props) return {};
        const out = {};
        for (const [k, v] of Object.entries(schema.props)) {
          if (v.type === "integer" || v.type === "number") out[k] = 0;
          else if (v.type === "boolean") out[k] = false;
          else out[k] = "";
        }
        return out;
      }
      async function runTest() {
        if (!detail.value) return;
        if (isDangerous(detail.value)) {
          const ok = confirm(
            "即将在服务器上执行接口试调用：\n" + detail.value.id + "\n\n该接口可能改变系统/插件状态（删除、保存、启停、发送等），确认继续？"
          );
          if (!ok) return;
        }
        testing.value = true;
        testResult.value = "";
        let params = {};
        try {
          params = JSON.parse(testParams.value || "{}");
        } catch (e) {
          testResult.value = "参数 JSON 解析失败: " + e.message;
          testing.value = false;
          return;
        }
        try {
          const r = await import_rc_api6.api.ifaceInvoke(detail.value.id, params, 15e3);
          testResult.value = JSON.stringify(r, null, 2);
        } catch (e) {
          testResult.value = "ERR: " + (e.message || e);
        } finally {
          testing.value = false;
          load();
        }
      }
      function dotCls(it) {
        if (it.source === "system") return "dot-system";
        return it.online ? "dot-on" : "dot-off";
      }
      (0, import_vue12.onMounted)(() => {
        if (route.query.q) filters.value.q = String(route.query.q);
        load();
        timer = setInterval(load, 15e3);
      });
      (0, import_vue12.onBeforeUnmount)(() => clearInterval(timer));
      return (_ctx, _cache) => {
        return (0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_116, [
          (0, import_vue11.createElementVNode)("div", _hoisted_215, [
            _cache[7] || (_cache[7] = (0, import_vue11.createElementVNode)(
              "h2",
              null,
              "接口总览",
              -1
              /* CACHED */
            )),
            _cache[8] || (_cache[8] = (0, import_vue11.createElementVNode)(
              "span",
              { class: "faint" },
              "接口库 v4 · 自注册服务总线（插件接口可被其他插件调用）",
              -1
              /* CACHED */
            )),
            (0, import_vue11.createElementVNode)("button", {
              class: "btn",
              disabled: loading.value,
              onClick: load
            }, "刷新", 8, _hoisted_314)
          ]),
          loadErr.value ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_49, [
            (0, import_vue11.createTextVNode)(
              " 目录加载失败: " + (0, import_vue11.toDisplayString)(loadErr.value) + " · ",
              1
              /* TEXT */
            ),
            (0, import_vue11.createElementVNode)("button", {
              class: "btn btn-sm",
              onClick: load
            }, "重试")
          ])) : (0, import_vue11.createCommentVNode)("v-if", true),
          (0, import_vue11.createElementVNode)("div", _hoisted_56, [
            (0, import_vue11.createElementVNode)("div", _hoisted_66, [
              (0, import_vue11.createElementVNode)(
                "b",
                null,
                (0, import_vue11.toDisplayString)(summary.value.interfaces),
                1
                /* TEXT */
              ),
              _cache[9] || (_cache[9] = (0, import_vue11.createElementVNode)(
                "span",
                null,
                "接口总数",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue11.createElementVNode)("div", _hoisted_75, [
              (0, import_vue11.createElementVNode)(
                "b",
                _hoisted_85,
                (0, import_vue11.toDisplayString)(summary.value.online),
                1
                /* TEXT */
              ),
              _cache[10] || (_cache[10] = (0, import_vue11.createElementVNode)(
                "span",
                null,
                "在线",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue11.createElementVNode)("div", _hoisted_95, [
              (0, import_vue11.createElementVNode)(
                "b",
                _hoisted_105,
                (0, import_vue11.toDisplayString)(summary.value.offline),
                1
                /* TEXT */
              ),
              _cache[11] || (_cache[11] = (0, import_vue11.createElementVNode)(
                "span",
                null,
                "离线",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue11.createElementVNode)("div", _hoisted_117, [
              (0, import_vue11.createElementVNode)(
                "b",
                null,
                (0, import_vue11.toDisplayString)(summary.value.plugin),
                1
                /* TEXT */
              ),
              _cache[12] || (_cache[12] = (0, import_vue11.createElementVNode)(
                "span",
                null,
                "插件接口",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue11.createElementVNode)("div", _hoisted_126, [
              (0, import_vue11.createElementVNode)(
                "b",
                null,
                (0, import_vue11.toDisplayString)(summary.value.system),
                1
                /* TEXT */
              ),
              _cache[13] || (_cache[13] = (0, import_vue11.createElementVNode)(
                "span",
                null,
                "系统接口",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue11.createElementVNode)("div", _hoisted_135, [
              (0, import_vue11.createElementVNode)(
                "b",
                null,
                (0, import_vue11.toDisplayString)(summary.value.providers),
                1
                /* TEXT */
              ),
              _cache[14] || (_cache[14] = (0, import_vue11.createElementVNode)(
                "span",
                null,
                "提供方",
                -1
                /* CACHED */
              ))
            ])
          ]),
          (0, import_vue11.createElementVNode)("div", _hoisted_145, [
            (0, import_vue11.withDirectives)((0, import_vue11.createElementVNode)(
              "input",
              {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => filters.value.q = $event),
                placeholder: "搜索接口 id / 插件 / 描述",
                class: "input",
                onKeyup: (0, import_vue11.withKeys)(resetLoad, ["enter"])
              },
              null,
              544
              /* NEED_HYDRATION, NEED_PATCH */
            ), [
              [import_vue11.vModelText, filters.value.q]
            ]),
            (0, import_vue11.withDirectives)((0, import_vue11.createElementVNode)(
              "select",
              {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => filters.value.source = $event),
                class: "input",
                onChange: resetLoad
              },
              [..._cache[15] || (_cache[15] = [
                (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "" },
                  "来源:全部",
                  -1
                  /* CACHED */
                ),
                (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "plugin" },
                  "插件",
                  -1
                  /* CACHED */
                ),
                (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "system" },
                  "系统",
                  -1
                  /* CACHED */
                )
              ])],
              544
              /* NEED_HYDRATION, NEED_PATCH */
            ), [
              [import_vue11.vModelSelect, filters.value.source]
            ]),
            (0, import_vue11.withDirectives)((0, import_vue11.createElementVNode)(
              "select",
              {
                "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => filters.value.visibility = $event),
                class: "input",
                onChange: resetLoad
              },
              [
                _cache[16] || (_cache[16] = (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "" },
                  "可见性:全部",
                  -1
                  /* CACHED */
                )),
                ((0, import_vue11.openBlock)(true), (0, import_vue11.createElementBlock)(
                  import_vue11.Fragment,
                  null,
                  (0, import_vue11.renderList)(visibilities.filter(Boolean), (v) => {
                    return (0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("option", {
                      key: v,
                      value: v
                    }, (0, import_vue11.toDisplayString)(v), 9, _hoisted_155);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              544
              /* NEED_HYDRATION, NEED_PATCH */
            ), [
              [import_vue11.vModelSelect, filters.value.visibility]
            ]),
            (0, import_vue11.withDirectives)((0, import_vue11.createElementVNode)(
              "select",
              {
                "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => filters.value.status = $event),
                class: "input",
                onChange: resetLoad
              },
              [..._cache[17] || (_cache[17] = [
                (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "" },
                  "状态:全部",
                  -1
                  /* CACHED */
                ),
                (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "online" },
                  "在线",
                  -1
                  /* CACHED */
                ),
                (0, import_vue11.createElementVNode)(
                  "option",
                  { value: "offline" },
                  "离线",
                  -1
                  /* CACHED */
                )
              ])],
              544
              /* NEED_HYDRATION, NEED_PATCH */
            ), [
              [import_vue11.vModelSelect, filters.value.status]
            ]),
            (0, import_vue11.createElementVNode)(
              "span",
              _hoisted_165,
              "共 " + (0, import_vue11.toDisplayString)(total.value) + " 个接口 · 本页 " + (0, import_vue11.toDisplayString)(items.value.length) + " 条",
              1
              /* TEXT */
            ),
            pages.value > 1 ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("span", _hoisted_174, [
              (0, import_vue11.createElementVNode)("button", {
                class: "btn btn-sm",
                disabled: page.value <= 1 || loading.value,
                onClick: _cache[4] || (_cache[4] = ($event) => goPage(page.value - 1))
              }, "上一页", 8, _hoisted_184),
              (0, import_vue11.createElementVNode)(
                "span",
                _hoisted_194,
                (0, import_vue11.toDisplayString)(page.value) + "/" + (0, import_vue11.toDisplayString)(pages.value),
                1
                /* TEXT */
              ),
              (0, import_vue11.createElementVNode)("button", {
                class: "btn btn-sm",
                disabled: page.value >= pages.value || loading.value,
                onClick: _cache[5] || (_cache[5] = ($event) => goPage(page.value + 1))
              }, "下一页", 8, _hoisted_204)
            ])) : (0, import_vue11.createCommentVNode)("v-if", true)
          ]),
          (0, import_vue11.createElementVNode)("div", _hoisted_216, [
            (0, import_vue11.createElementVNode)("div", _hoisted_225, [
              !items.value.length ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_234, "暂无接口（插件启动后自动注册）")) : (0, import_vue11.createCommentVNode)("v-if", true),
              ((0, import_vue11.openBlock)(true), (0, import_vue11.createElementBlock)(
                import_vue11.Fragment,
                null,
                (0, import_vue11.renderList)(groups(), (g) => {
                  return (0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", {
                    key: g.plugin,
                    class: "iface-group"
                  }, [
                    (0, import_vue11.createElementVNode)(
                      "div",
                      _hoisted_244,
                      (0, import_vue11.toDisplayString)(g.plugin),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue11.createElementVNode)("table", _hoisted_254, [
                      _cache[18] || (_cache[18] = (0, import_vue11.createElementVNode)(
                        "thead",
                        null,
                        [
                          (0, import_vue11.createElementVNode)("tr", null, [
                            (0, import_vue11.createElementVNode)("th", null, "接口"),
                            (0, import_vue11.createElementVNode)("th", null, "来源"),
                            (0, import_vue11.createElementVNode)("th", null, "可见性"),
                            (0, import_vue11.createElementVNode)("th", null, "状态"),
                            (0, import_vue11.createElementVNode)("th", null, "调用"),
                            (0, import_vue11.createElementVNode)("th", null, "平均")
                          ])
                        ],
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue11.createElementVNode)("tbody", null, [
                        ((0, import_vue11.openBlock)(true), (0, import_vue11.createElementBlock)(
                          import_vue11.Fragment,
                          null,
                          (0, import_vue11.renderList)(g.list, (it) => {
                            return (0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("tr", {
                              key: it.id,
                              class: (0, import_vue11.normalizeClass)({ active: detail.value && detail.value.id === it.id }),
                              onClick: ($event) => openDetail(it)
                            }, [
                              (0, import_vue11.createElementVNode)("td", null, [
                                (0, import_vue11.createElementVNode)(
                                  "span",
                                  {
                                    class: (0, import_vue11.normalizeClass)(["dot", dotCls(it)])
                                  },
                                  null,
                                  2
                                  /* CLASS */
                                ),
                                (0, import_vue11.createTextVNode)(
                                  (0, import_vue11.toDisplayString)(it.id),
                                  1
                                  /* TEXT */
                                )
                              ]),
                              (0, import_vue11.createElementVNode)(
                                "td",
                                null,
                                (0, import_vue11.toDisplayString)(it.source),
                                1
                                /* TEXT */
                              ),
                              (0, import_vue11.createElementVNode)(
                                "td",
                                null,
                                (0, import_vue11.toDisplayString)(it.visibility),
                                1
                                /* TEXT */
                              ),
                              (0, import_vue11.createElementVNode)(
                                "td",
                                null,
                                (0, import_vue11.toDisplayString)(it.status),
                                1
                                /* TEXT */
                              ),
                              (0, import_vue11.createElementVNode)(
                                "td",
                                null,
                                (0, import_vue11.toDisplayString)(it.calls),
                                1
                                /* TEXT */
                              ),
                              (0, import_vue11.createElementVNode)(
                                "td",
                                null,
                                (0, import_vue11.toDisplayString)(it.avg_ms) + "ms",
                                1
                                /* TEXT */
                              )
                            ], 10, _hoisted_263);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            detail.value ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_273, [
              (0, import_vue11.createElementVNode)("div", _hoisted_283, [
                (0, import_vue11.createElementVNode)(
                  "b",
                  null,
                  (0, import_vue11.toDisplayString)(detail.value.id),
                  1
                  /* TEXT */
                ),
                (0, import_vue11.createElementVNode)(
                  "span",
                  _hoisted_293,
                  "v" + (0, import_vue11.toDisplayString)(detail.value.version) + " · " + (0, import_vue11.toDisplayString)(detail.value.plugin),
                  1
                  /* TEXT */
                )
              ]),
              detailErr.value ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)(
                "div",
                _hoisted_303,
                (0, import_vue11.toDisplayString)(detailErr.value),
                1
                /* TEXT */
              )) : (0, import_vue11.createCommentVNode)("v-if", true),
              detail.value.description ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_315, [
                _cache[19] || (_cache[19] = (0, import_vue11.createElementVNode)(
                  "span",
                  null,
                  "描述",
                  -1
                  /* CACHED */
                )),
                (0, import_vue11.createElementVNode)(
                  "code",
                  null,
                  (0, import_vue11.toDisplayString)(detail.value.description),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue11.createCommentVNode)("v-if", true),
              (0, import_vue11.createElementVNode)("div", _hoisted_324, [
                _cache[20] || (_cache[20] = (0, import_vue11.createElementVNode)(
                  "span",
                  null,
                  "可见性",
                  -1
                  /* CACHED */
                )),
                (0, import_vue11.createElementVNode)(
                  "code",
                  null,
                  (0, import_vue11.toDisplayString)(detail.value.visibility),
                  1
                  /* TEXT */
                )
              ]),
              (0, import_vue11.createElementVNode)("div", _hoisted_333, [
                _cache[21] || (_cache[21] = (0, import_vue11.createElementVNode)(
                  "span",
                  null,
                  "统计",
                  -1
                  /* CACHED */
                )),
                (0, import_vue11.createElementVNode)(
                  "code",
                  null,
                  (0, import_vue11.toDisplayString)(detail.value.calls) + " 次 · " + (0, import_vue11.toDisplayString)(detail.value.avg_ms) + "ms 平均 · p95 " + (0, import_vue11.toDisplayString)(detail.value.p95_ms) + "ms",
                  1
                  /* TEXT */
                )
              ]),
              detail.value.last_error ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_343, [
                _cache[22] || (_cache[22] = (0, import_vue11.createElementVNode)(
                  "span",
                  null,
                  "最近错误",
                  -1
                  /* CACHED */
                )),
                (0, import_vue11.createElementVNode)(
                  "code",
                  _hoisted_353,
                  (0, import_vue11.toDisplayString)(detail.value.last_error),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue11.createCommentVNode)("v-if", true),
              (0, import_vue11.createElementVNode)("div", _hoisted_363, [
                _cache[23] || (_cache[23] = (0, import_vue11.createElementVNode)(
                  "span",
                  null,
                  "input schema",
                  -1
                  /* CACHED */
                )),
                (0, import_vue11.createElementVNode)(
                  "pre",
                  null,
                  (0, import_vue11.toDisplayString)(JSON.stringify(detail.value.input || {}, null, 1)),
                  1
                  /* TEXT */
                )
              ]),
              (0, import_vue11.createElementVNode)("div", _hoisted_373, [
                _cache[24] || (_cache[24] = (0, import_vue11.createElementVNode)(
                  "div",
                  { class: "label" },
                  "试调用（params JSON）",
                  -1
                  /* CACHED */
                )),
                (0, import_vue11.withDirectives)((0, import_vue11.createElementVNode)(
                  "textarea",
                  {
                    "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => testParams.value = $event),
                    rows: "4",
                    class: "input code"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue11.vModelText, testParams.value]
                ]),
                (0, import_vue11.createElementVNode)("button", {
                  class: "btn",
                  disabled: testing.value,
                  onClick: runTest
                }, (0, import_vue11.toDisplayString)(testing.value ? "调用中…" : "试调用"), 9, _hoisted_383),
                testResult.value ? ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)(
                  "pre",
                  _hoisted_393,
                  (0, import_vue11.toDisplayString)(testResult.value),
                  1
                  /* TEXT */
                )) : (0, import_vue11.createCommentVNode)("v-if", true)
              ])
            ])) : ((0, import_vue11.openBlock)(), (0, import_vue11.createElementBlock)("div", _hoisted_403, "点选左侧接口查看详情 / 试调用"))
          ])
        ]);
      };
    }
  };
  __sfc_main6.__scopeId = "data-v-ahgpu1";
  var Ifaces_default = __sfc_main6;
  (function() {
    var key = "rc-ext-css-data-v-ahgpu1-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.iface-summary[data-v-ahgpu1] { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;\n}\n.stat-card[data-v-ahgpu1] { background: var(--bg2, #fff); border: 1px solid var(--border, #e5e5e5); border-radius: 8px; padding: 10px 16px; min-width: 96px; display: flex; flex-direction: column;\n}\n.stat-card b[data-v-ahgpu1] { font-size: 20px;\n}\n.stat-card span[data-v-ahgpu1] { font-size: 12px; color: #888;\n}\n.iface-filter[data-v-ahgpu1] { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px;\n}\n.iface-filter .input[data-v-ahgpu1] { min-width: 140px;\n}\n.iface-pager[data-v-ahgpu1] { display: inline-flex; gap: 6px; align-items: center;\n}\n.iface-body[data-v-ahgpu1] { display: grid; grid-template-columns: 1fr 380px; gap: 12px; align-items: start;\n}\n@media (max-width: 1100px) {\n.iface-body[data-v-ahgpu1] { grid-template-columns: 1fr;\n}\n}\n.iface-group[data-v-ahgpu1] { margin-bottom: 12px;\n}\n.group-head[data-v-ahgpu1] { font-weight: bold; margin-bottom: 4px; color: #3579a8;\n}\n.table[data-v-ahgpu1] { width: 100%;\n}\n.table tr[data-v-ahgpu1] { cursor: pointer;\n}\n.table tr.active[data-v-ahgpu1] { background: rgba(53, 121, 168, 0.12);\n}\n.dot[data-v-ahgpu1] { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;\n}\n.dot-on[data-v-ahgpu1] { background: #2e9e5b;\n}\n.dot-off[data-v-ahgpu1] { background: #d9524e;\n}\n.dot-system[data-v-ahgpu1] { background: #3579a8;\n}\n.iface-detail[data-v-ahgpu1] { border: 1px solid var(--border, #e5e5e5); border-radius: 8px; padding: 12px; background: var(--bg2, #fff);\n}\n.detail-head[data-v-ahgpu1] { display: flex; justify-content: space-between; margin-bottom: 8px;\n}\n.kv[data-v-ahgpu1] { margin-bottom: 6px; font-size: 13px;\n}\n.kv span[data-v-ahgpu1] { color: #888; margin-right: 6px;\n}\n.kv code[data-v-ahgpu1], .kv pre[data-v-ahgpu1] { background: #f5f5f5; border-radius: 4px; padding: 2px 6px; font-size: 12px;\n}\n.kv pre[data-v-ahgpu1] { display: block; margin-top: 4px; white-space: pre-wrap;\n}\n.err[data-v-ahgpu1] { color: #d33;\n}\n.test-box[data-v-ahgpu1] { margin-top: 10px;\n}\n.test-box textarea[data-v-ahgpu1] { width: 100%; font-family: monospace;\n}\n.test-box .result[data-v-ahgpu1] { background: #f5f5f5; border-radius: 6px; padding: 8px; font-size: 12px; white-space: pre-wrap; max-height: 220px; overflow: auto;\n}\n.empty[data-v-ahgpu1] { color: #999; padding: 12px;\n}\nlabel[data-v-ahgpu1] { font-size: 13px;\n}\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/SysFuncMain.vue
  var _hoisted_118 = { class: "sys-page" };
  var _hoisted_217 = {
    key: 0,
    class: "notice"
  };
  var _hoisted_316 = {
    key: 1,
    class: "error",
    style: { "margin-bottom": "10px" }
  };
  var _hoisted_410 = {
    key: 2,
    class: "pane-load"
  };
  var _hoisted_57 = { class: "pane-head" };
  var _hoisted_67 = { class: "pane-sub" };
  var _hoisted_76 = { class: "table" };
  var _hoisted_86 = { class: "mono faint" };
  var _hoisted_96 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_106 = { class: "pane-head" };
  var _hoisted_119 = { class: "stat-row" };
  var _hoisted_127 = { class: "tile" };
  var _hoisted_136 = { class: "v" };
  var _hoisted_146 = { class: "tile" };
  var _hoisted_156 = { class: "v" };
  var _hoisted_166 = {
    class: "flex",
    style: { "margin-bottom": "8px", "flex-wrap": "wrap", "gap": "6px" }
  };
  var _hoisted_175 = { class: "table" };
  var _hoisted_185 = { class: "mono faint" };
  var _hoisted_195 = { class: "mono" };
  var _hoisted_205 = { class: "mono faint" };
  var _hoisted_218 = { key: 0 };
  var _hoisted_226 = {
    key: 11,
    class: "sf-body"
  };
  var _hoisted_235 = {
    key: 0,
    class: "error"
  };
  var _hoisted_245 = { class: "pane-head" };
  var _hoisted_255 = {
    key: 0,
    class: "mono-block",
    style: { "margin-bottom": "8px" }
  };
  var _hoisted_264 = { class: "svc-grid" };
  var _hoisted_274 = { class: "svc-top" };
  var _hoisted_284 = { class: "svc-name mono" };
  var _hoisted_294 = { class: "svc-sub" };
  var _hoisted_304 = {
    class: "faint",
    style: { "margin-left": "6px" }
  };
  var _hoisted_317 = { class: "svc-actions" };
  var _hoisted_325 = ["onClick"];
  var _hoisted_334 = ["onClick"];
  var _hoisted_344 = ["onClick"];
  var _hoisted_354 = ["onClick"];
  var _hoisted_364 = ["onClick"];
  var _hoisted_374 = { class: "pane-head" };
  var _hoisted_384 = { class: "hv-grid" };
  var _hoisted_394 = { class: "stat" };
  var _hoisted_404 = {
    class: "mono",
    style: { "font-size": "13px" }
  };
  var _hoisted_413 = { class: "faint" };
  var _hoisted_424 = { class: "stat" };
  var _hoisted_433 = { class: "mono" };
  var _hoisted_443 = { class: "faint mono" };
  var _hoisted_453 = { class: "mono" };
  var _hoisted_463 = { class: "stat" };
  var _hoisted_472 = {
    class: "mono",
    style: { "font-size": "13px" }
  };
  var _hoisted_482 = { class: "stat" };
  var _hoisted_492 = { class: "mono" };
  var _hoisted_50 = { class: "faint mono" };
  var _hoisted_51 = { class: "table" };
  var _hoisted_522 = { class: "mono" };
  var _hoisted_532 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_542 = { class: "stat-row" };
  var _hoisted_552 = { class: "tile" };
  var _hoisted_562 = { class: "v" };
  var _hoisted_572 = { class: "tile" };
  var _hoisted_58 = { class: "v txt-sm" };
  var _hoisted_59 = {
    key: 0,
    class: "mono-block",
    style: { "margin-bottom": "8px" }
  };
  var _hoisted_60 = { class: "table" };
  var _hoisted_61 = { class: "mono" };
  var _hoisted_622 = { class: "mono" };
  var _hoisted_632 = { class: "mono faint" };
  var _hoisted_642 = {
    key: 1,
    class: "hint"
  };
  var _hoisted_652 = { class: "pane-head" };
  var _hoisted_662 = { class: "stat-row" };
  var _hoisted_672 = { class: "tile" };
  var _hoisted_68 = { class: "v" };
  var _hoisted_69 = { class: "v" };
  var _hoisted_70 = { class: "disk-rows" };
  var _hoisted_71 = { class: "disk-row-top" };
  var _hoisted_722 = { class: "mono disk-mount" };
  var _hoisted_732 = { class: "tag-chip chip-dim" };
  var _hoisted_742 = { class: "mono" };
  var _hoisted_752 = {
    class: "progress",
    style: { "margin-top": "6px" }
  };
  var _hoisted_762 = { class: "disk-row-sub faint mono" };
  var _hoisted_77 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_78 = {
    class: "doc-section",
    style: { "margin-top": "10px" }
  };
  var _hoisted_79 = { class: "mono-block pre panel-box" };
  var _hoisted_80 = { class: "pane-head" };
  var _hoisted_81 = {
    class: "stat",
    style: { "margin-bottom": "10px" }
  };
  var _hoisted_822 = { class: "mono" };
  var _hoisted_832 = { class: "faint" };
  var _hoisted_842 = {
    class: "flex",
    style: { "margin-bottom": "12px" }
  };
  var _hoisted_852 = ["disabled"];
  var _hoisted_862 = { class: "pane-head" };
  var _hoisted_87 = { class: "tag-chip chip-dim" };
  var _hoisted_88 = {
    key: 0,
    class: "snap-chips"
  };
  var _hoisted_89 = {
    key: 1,
    class: "hint"
  };
  var _hoisted_90 = { class: "pane-head" };
  var _hoisted_91 = { class: "table" };
  var _hoisted_922 = { class: "avatar" };
  var _hoisted_932 = { class: "mono" };
  var _hoisted_942 = { class: "mono faint" };
  var _hoisted_952 = { class: "mono faint" };
  var _hoisted_962 = ["onClick"];
  var _hoisted_97 = {
    key: 0,
    style: { "margin-top": "12px" }
  };
  var _hoisted_98 = { class: "pane-head" };
  var _hoisted_99 = { class: "pane-title" };
  var _hoisted_100 = { class: "pane-head" };
  var _hoisted_101 = {
    key: 0,
    class: "mono-block",
    style: { "margin-bottom": "8px" }
  };
  var _hoisted_1022 = { class: "split2" };
  var _hoisted_1032 = {
    key: 0,
    class: "tag-chip",
    title: "永久保存, 不自动过期, 仅本页可删"
  };
  var _hoisted_1042 = {
    class: "mono faint",
    style: { "font-size": "11px", "word-break": "break-all" }
  };
  var _hoisted_1052 = { class: "mono" };
  var _hoisted_1062 = ["onClick"];
  var _hoisted_107 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_108 = { class: "top-row-top" };
  var _hoisted_109 = {
    class: "mono",
    style: { "font-size": "11px", "word-break": "break-all" }
  };
  var _hoisted_1102 = {
    class: "mono",
    style: { "flex": "none" }
  };
  var _hoisted_1112 = { class: "progress" };
  var _hoisted_1122 = { class: "danger-panel" };
  var _hoisted_1132 = {
    class: "flex",
    style: { "margin-bottom": "12px" }
  };
  var _hoisted_1142 = {
    class: "flex",
    style: { "flex-wrap": "wrap" }
  };
  var _hoisted_1152 = { class: "pane-head" };
  var _hoisted_1162 = { class: "tag-chip chip-ok mono" };
  var _hoisted_1172 = {
    key: 0,
    class: "mono-block",
    style: { "margin-bottom": "8px" }
  };
  var _hoisted_1182 = { class: "table" };
  var _hoisted_1192 = { class: "mono" };
  var _hoisted_120 = { class: "mono" };
  var _hoisted_121 = {
    key: 0,
    class: "tag-chip chip-ok"
  };
  var _hoisted_1222 = {
    key: 1,
    class: "tag-chip chip-dim"
  };
  var _hoisted_1232 = ["onClick"];
  var _hoisted_1242 = { class: "pane-head" };
  var _hoisted_1252 = { class: "stat-row" };
  var _hoisted_1262 = { class: "tile" };
  var _hoisted_1272 = { class: "v txt-sm" };
  var _hoisted_128 = { class: "tile" };
  var _hoisted_129 = { class: "v txt-sm" };
  var _hoisted_130 = { class: "pane-head" };
  var _hoisted_131 = { class: "stat-row" };
  var _hoisted_1322 = { class: "v" };
  var _hoisted_1332 = {
    class: "faint",
    style: { "font-size": "11px" }
  };
  var _hoisted_1342 = { class: "k" };
  var _hoisted_1352 = { class: "check-grid" };
  var _hoisted_1362 = { class: "mono" };
  var _hoisted_137 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_138 = { class: "pane-head" };
  var _hoisted_139 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_140 = { class: "tl" };
  var _hoisted_141 = { class: "tl-time mono" };
  var _hoisted_1422 = { class: "tl-act" };
  var _hoisted_1432 = { class: "tl-msg" };
  var _hoisted_1442 = { class: "pane-head" };
  var _hoisted_1452 = {
    key: 0,
    class: "hint"
  };
  var _hoisted_1462 = {
    key: 1,
    class: "error"
  };
  var _hoisted_147 = {
    key: 2,
    class: "hint"
  };
  var _hoisted_148 = { class: "lr-layout" };
  var _hoisted_149 = { class: "lr-list" };
  var _hoisted_150 = ["onClick"];
  var _hoisted_151 = { class: "lr-edit" };
  var _hoisted_1522 = {
    class: "flex",
    style: { "margin-bottom": "6px" }
  };
  var _hoisted_1532 = { class: "mono" };
  var _hoisted_1542 = ["disabled"];
  var _hoisted_1552 = {
    key: 1,
    class: "hint",
    style: { "text-align": "left" }
  };
  var __sfc_main7 = {
    __name: "SysFuncMain",
    setup(__props) {
      const SUBKEYS = ["logs", "processes", "svc", "sh", "hw", "up", "disk", "snap", "usr", "clean", "env", "pwr", "kern", "tz", "health", "events", "lr", "backup", "boot", "api", "ifa"];
      const COMP_SUBS = ["logs", "processes", "backup", "sh", "env", "ifa"];
      const sub = (0, import_vue14.ref)("logs");
      function activate(k) {
        if (!SUBKEYS.includes(k)) k = "logs";
        sub.value = k;
        if (!COMP_SUBS.includes(k) && !data.value[k]) loadSection(k);
        apiPoll(k);
      }
      const appErr = (0, import_vue14.ref)("");
      (0, import_vue14.onErrorCaptured)((e) => {
        appErr.value = String(e && (e.message || e) || "渲染错误");
      });
      const open = (0, import_vue14.ref)({});
      const loading = (0, import_vue14.ref)({});
      const err = (0, import_vue14.ref)({});
      const data = (0, import_vue14.ref)({});
      const notice = (0, import_vue14.ref)("");
      function toast(m) {
        notice.value = m;
        setTimeout(() => {
          notice.value = "";
        }, 3e3);
      }
      async function call(key, fn) {
        loading.value[key] = true;
        err.value[key] = "";
        try {
          data.value[key] = await fn();
        } catch (e) {
          err.value[key] = e.message;
        } finally {
          loading.value[key] = false;
        }
      }
      function loadSection(k) {
        const jobs = {
          svc: () => import_rc_api7.api.sysfServiceList(),
          hw: () => import_rc_api7.api.sysfHardware(),
          up: () => import_rc_api7.api.sysfUpdatesList(),
          disk: () => import_rc_api7.api.sysfDisks(),
          snap: () => import_rc_api7.api.sysfSnapCap(),
          usr: () => import_rc_api7.api.sysfUsers(),
          clean: () => import_rc_api7.api.sysfCleanScan(),
          pwr: () => import_rc_api7.api.sysfPwrState(),
          kern: () => import_rc_api7.api.sysfKernels(),
          tz: () => import_rc_api7.api.sysfTime(),
          health: () => import_rc_api7.api.sysfHealth(),
          events: () => import_rc_api7.api.sysfEvents(150),
          lr: () => import_rc_api7.api.sysfLogrotateList(),
          boot: () => import_rc_api7.api.sysfBootHistory(),
          api: () => loadApi()
        };
        if (jobs[k]) call(k, jobs[k]);
        if (k === "snap") call("snapList", import_rc_api7.api.sysfSnapList);
      }
      async function svcAct(u, act) {
        try {
          const r = await import_rc_api7.api.sysfServiceAction(u.unit, act);
          data.value.svcMsg = r && (r.out || r.error) || "ok";
        } catch (e) {
          data.value.svcMsg = e.message;
        }
        loadSection("svc");
      }
      async function updRefresh() {
        data.value.upMsg = "更新索引中...";
        try {
          const r = await import_rc_api7.api.sysfUpdatesRefresh();
          data.value.upMsg = r && (r.out || r.error) || "ok";
        } catch (e) {
          data.value.upMsg = e.message;
        }
        loadSection("up");
      }
      async function updRun() {
        if (!confirm("确认执行 apt upgrade 升级全部软件包？\n此操作需要几分钟。")) return;
        data.value.upMsg = "升级中(可能数分钟)...";
        try {
          const r = await import_rc_api7.api.sysfUpdatesRun();
          data.value.upMsg = r && (r.out || r.error) || "done";
        } catch (e) {
          data.value.upMsg = e.message;
        }
        loadSection("up");
      }
      const snapName = (0, import_vue14.ref)("");
      async function snapCreate() {
        if (!snapName.value.trim()) return;
        try {
          const r = await import_rc_api7.api.sysfSnapCreate(snapName.value.trim());
          toast(r && r.ok ? "快照已创建" : r && r.error || "创建失败");
        } catch (e) {
          toast(e.message);
        }
        snapName.value = "";
        loadSection("snap");
      }
      const sshUser = (0, import_vue14.ref)("");
      const sshKeys = (0, import_vue14.ref)("");
      async function sshLoad(u) {
        sshUser.value = u;
        await call("keys", () => import_rc_api7.api.sysfSshKeys(u));
        const d = data.value.keys || {};
        sshKeys.value = d.keys || d.error || "";
      }
      async function sshSave() {
        try {
          const r = await import_rc_api7.api.sysfSshKeysSave(sshUser.value, sshKeys.value);
          toast(r && r.ok ? "已保存(sshd 立即生效)" : r && r.error || "失败");
        } catch (e) {
          toast(e.message);
        }
      }
      const svcFilter = (0, import_vue14.ref)("");
      function initialSub() {
        const h = String(window.location.hash || "");
        const i = h.indexOf("?");
        if (i < 0) return "logs";
        const q = new URLSearchParams(h.slice(i + 1));
        const s = q.get("sub") || "";
        return SUBKEYS.includes(s) ? s : "logs";
      }
      (0, import_vue14.onMounted)(() => {
        activate(initialSub());
      });
      const SUBS = [
        { key: "logs", label: "系统日志" },
        { key: "processes", label: "进程管理" },
        { key: "svc", label: "服务管理" },
        { key: "sh", label: "服务健康" },
        { key: "hw", label: "硬件" },
        { key: "up", label: "系统更新" },
        { key: "disk", label: "磁盘" },
        { key: "snap", label: "快照" },
        { key: "usr", label: "用户/密钥" },
        { key: "clean", label: "存储清理" },
        { key: "env", label: "环境包" },
        { key: "pwr", label: "关机/重启" },
        { key: "kern", label: "内核管理" },
        { key: "tz", label: "时间/NTP" },
        { key: "health", label: "健康检查" },
        { key: "events", label: "事件时间线" },
        { key: "lr", label: "日志保留" },
        { key: "backup", label: "系统备份" },
        { key: "boot", label: "启动历史" },
        { key: "api", label: "接口监控" },
        { key: "ifa", label: "接口总览" }
      ];
      const subLabel = (0, import_vue14.computed)(() => (SUBS.find((s) => s.key === sub.value) || { label: "" }).label);
      const paneLoading = (0, import_vue14.computed)(() => loading.value[sub.value] && !data.value[sub.value] && !COMP_SUBS.includes(sub.value));
      const svcUnits = (0, import_vue14.computed)(() => (data.value.svc || {}).units || []);
      const healthChecks = (0, import_vue14.computed)(() => (data.value.health || {}).checks || []);
      const healthOk = (0, import_vue14.computed)(() => healthChecks.value.filter((x) => x.ok).length);
      const healthFail = (0, import_vue14.computed)(() => healthChecks.value.length - healthOk.value);
      const maxDiskUse = (0, import_vue14.computed)(() => {
        let m = 0;
        for (const d of (data.value.disk || {}).df || []) {
          const v = parseInt(d.use);
          if (!isNaN(v) && v > m) m = v;
        }
        return m;
      });
      function parseSize(s) {
        const m = /^([\d.]+)\s*([KMGT])?/.exec(String(s || ""));
        if (!m) return 0;
        const n = parseFloat(m[1]) || 0;
        const mult = { K: 1, M: 1024, G: 1048576, T: 1073741824 }[m[2]] || 1;
        return n * mult;
      }
      function topBar(s) {
        const rows = (data.value.clean || {}).dirs || [];
        let max = 1;
        for (const d of rows) {
          const v = parseSize(d.size);
          if (v > max) max = v;
        }
        return Math.max(3, Math.round(parseSize(s) / max * 100));
      }
      function eventActCls(a) {
        const s = String(a || "");
        if (/stop|reboot|shutdown|remove|delete|fail|error|kill/i.test(s)) return "chip-err";
        if (/start|create|save|sync|add/i.test(s)) return "chip-ok";
        return "chip-info";
      }
      async function healthRestart() {
        if (!confirm("确认重启面板服务(raincough)？连接会闪断几秒。")) return;
        try {
          const r = await import_rc_api7.api.sysfHealthRestart();
          toast(r && r.ok !== false ? "已发送重启" : r && r.error || "失败");
        } catch (e) {
          toast(e.message);
        }
      }
      const lrEdit = (0, import_vue14.ref)(null);
      function lrSelect(f) {
        lrEdit.value = { name: f.name, content: f.content };
      }
      async function lrSave() {
        if (!lrEdit.value) return;
        try {
          const r = await import_rc_api7.api.sysfLogrotateSave(lrEdit.value.name, lrEdit.value.content);
          toast(r && r.ok !== false ? "已保存" : r && r.error || "失败");
        } catch (e) {
          toast(e.message);
        }
        loadSection("lr");
      }
      let apiTimer = null;
      const apiPollOn = (0, import_vue14.ref)(true);
      async function loadApi() {
        const [st, cl] = await Promise.all([import_rc_api7.api.sysfApiStats(), import_rc_api7.api.sysfApiCalls(300)]);
        data.value.apiStats = st;
        data.value.apiCalls = cl && cl.calls || [];
      }
      function apiPoll(k) {
        if (apiTimer) {
          clearInterval(apiTimer);
          apiTimer = null;
        }
        if (k === "api" && apiPollOn.value) apiTimer = setInterval(() => {
          loadApi().catch(() => {
          });
        }, 3e3);
      }
      function toggleApiPoll() {
        apiPollOn.value = !apiPollOn.value;
        if (sub.value === "api") apiPoll("api");
      }
      async function clearApiCalls() {
        try {
          await import_rc_api7.api.sysfApiClear();
          data.value.apiCalls = [];
        } catch (e) {
        }
      }
      async function cleanDo(item) {
        let msg = "清理「" + (item.label || item.key) + "」" + (item.path ? " (" + item.path + ")" : "") + " ?";
        if (item.key === "workspace") {
          msg = "确定清除【工作台常驻历史】？\n\n· 该数据永久保存、从不自动过期，「存储清理」是唯一删除入口\n· 清除后不可恢复，工作台图表将从零重新累积\n\n继续？";
        }
        if (!confirm(msg)) return;
        try {
          const r = await import_rc_api7.api.sysfCleanDo(item.key);
          if (r && r.ok !== false) toast(r && r.output ? String(r.output).trim() : "已清理");
          else toast(r && r.error || "清理失败");
        } catch (e) {
          toast("清理失败: " + e.message);
        }
        loadSection("clean");
      }
      async function kernRemove(pkg) {
        if (!confirm("删除内核 " + pkg + " ?")) return;
        try {
          const r = await import_rc_api7.api.sysfKernelRemove(pkg);
          toast(r && r.ok !== false ? "已删除" : r && r.error || "删除失败");
        } catch (e) {
          toast(e.message);
        }
        loadSection("kern");
      }
      async function timeSyncDo() {
        try {
          const r = await import_rc_api7.api.sysfTimeSync();
          toast(r && r.ok !== false ? "已同步" : r && r.error || "同步失败");
        } catch (e) {
          toast(e.message);
        }
        loadSection("tz");
      }
      const pwrAction = (0, import_vue14.ref)("reboot");
      const pwrMin = (0, import_vue14.ref)(1);
      const pwrEpoch = (0, import_vue14.computed)(() => {
        const s = (data.value.pwr || {}).state;
        return !s || s === "none" ? "" : s;
      });
      async function pwrPlan() {
        const action = pwrAction.value;
        const minutes = Number(pwrMin.value) || 1;
        if (!confirm((action === "reboot" ? "重启" : "关机") + " " + minutes + " 分钟后?")) return;
        try {
          const r = await import_rc_api7.api.sysfPwrPlan(action, minutes);
          toast(r && r.ok !== false ? "已计划" : r && r.error || "失败");
        } catch (e) {
          toast(e.message);
        }
        loadSection("pwr");
      }
      async function pwrCancel() {
        try {
          const r = await import_rc_api7.api.sysfPwrCancel();
          toast(r && r.ok !== false ? "已取消" : r && r.error || "失败");
        } catch (e) {
          toast(e.message);
        }
        loadSection("pwr");
      }
      return (_ctx, _cache) => {
        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_118, [
          notice.value ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
            "div",
            _hoisted_217,
            (0, import_vue13.toDisplayString)(notice.value),
            1
            /* TEXT */
          )) : (0, import_vue13.createCommentVNode)("v-if", true),
          appErr.value ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
            "div",
            _hoisted_316,
            "运行/渲染错误: " + (0, import_vue13.toDisplayString)(appErr.value),
            1
            /* TEXT */
          )) : (0, import_vue13.createCommentVNode)("v-if", true),
          paneLoading.value ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
            "div",
            _hoisted_410,
            "⟳ 正在加载 " + (0, import_vue13.toDisplayString)(subLabel.value) + " …",
            1
            /* TEXT */
          )) : (0, import_vue13.createCommentVNode)("v-if", true),
          (0, import_vue13.createCommentVNode)(" 页面型子组件(自带取数): 日志/进程/备份 + 融入的服务健康/环境包/接口总览 "),
          sub.value === "logs" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createBlock)(Logs_default, { key: 3 })) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "processes" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createBlock)(Processes_default, { key: 4 })) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "backup" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createBlock)(BackupMain_default, { key: 5 })) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "sh" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createBlock)(ServiceHealth_default, { key: 6 })) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "env" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createBlock)(EnvPkgMain_default, { key: 7 })) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "ifa" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createBlock)(Ifaces_default, { key: 8 })) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "boot" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
            import_vue13.Fragment,
            { key: 9 },
            [
              (0, import_vue13.createElementVNode)("div", _hoisted_57, [
                _cache[18] || (_cache[18] = (0, import_vue13.createElementVNode)(
                  "span",
                  { class: "pane-title" },
                  "启动历史",
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)(
                  "span",
                  _hoisted_67,
                  "本次启动 " + (0, import_vue13.toDisplayString)((data.value.boot || {}).boot_started || "—"),
                  1
                  /* TEXT */
                ),
                _cache[19] || (_cache[19] = (0, import_vue13.createElementVNode)(
                  "span",
                  { class: "grow" },
                  null,
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)("button", {
                  class: "btn btn-sm",
                  onClick: _cache[0] || (_cache[0] = ($event) => loadSection("boot"))
                }, "⟳ 刷新")
              ]),
              (0, import_vue13.createElementVNode)("table", _hoisted_76, [
                _cache[20] || (_cache[20] = (0, import_vue13.createElementVNode)(
                  "thead",
                  null,
                  [
                    (0, import_vue13.createElementVNode)("tr", null, [
                      (0, import_vue13.createElementVNode)("th", null, "动作"),
                      (0, import_vue13.createElementVNode)("th", null, "时间")
                    ])
                  ],
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)("tbody", null, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)((data.value.boot || {}).rows || [], (r, i) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", { key: i }, [
                        (0, import_vue13.createElementVNode)("td", null, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["tag-chip", r.action === "current" ? "chip-ok" : "chip-dim"])
                            },
                            (0, import_vue13.toDisplayString)(r.action),
                            3
                            /* TEXT, CLASS */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)(
                          "td",
                          _hoisted_86,
                          (0, import_vue13.toDisplayString)(r.when),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ]),
              !((data.value.boot || {}).rows || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_96, "无记录(或 last 无法读取)")) : (0, import_vue13.createCommentVNode)("v-if", true)
            ],
            64
            /* STABLE_FRAGMENT */
          )) : (0, import_vue13.createCommentVNode)("v-if", true),
          sub.value === "api" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
            import_vue13.Fragment,
            { key: 10 },
            [
              (0, import_vue13.createElementVNode)("div", _hoisted_106, [
                _cache[21] || (_cache[21] = (0, import_vue13.createElementVNode)(
                  "span",
                  { class: "pane-title" },
                  "接口监控",
                  -1
                  /* CACHED */
                )),
                _cache[22] || (_cache[22] = (0, import_vue13.createElementVNode)(
                  "span",
                  { class: "pane-sub" },
                  "路由统计 · 实时请求流水",
                  -1
                  /* CACHED */
                )),
                _cache[23] || (_cache[23] = (0, import_vue13.createElementVNode)(
                  "span",
                  { class: "grow" },
                  null,
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)("button", {
                  class: "btn btn-sm",
                  onClick: loadApi
                }, "⟳ 刷新"),
                (0, import_vue13.createElementVNode)(
                  "button",
                  {
                    class: "btn btn-sm",
                    onClick: toggleApiPoll
                  },
                  (0, import_vue13.toDisplayString)(apiPollOn.value ? "⏸ 暂停" : "▶ 轮询"),
                  1
                  /* TEXT */
                ),
                (0, import_vue13.createElementVNode)("button", {
                  class: "btn btn-sm btn-ghost",
                  onClick: clearApiCalls
                }, "清空")
              ]),
              (0, import_vue13.createElementVNode)("div", _hoisted_119, [
                (0, import_vue13.createElementVNode)("div", _hoisted_127, [
                  _cache[24] || (_cache[24] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "k" },
                    "路由总数",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    _hoisted_136,
                    (0, import_vue13.toDisplayString)((data.value.apiStats || {}).routes_total || 0),
                    1
                    /* TEXT */
                  )
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_146, [
                  _cache[25] || (_cache[25] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "k" },
                    "累计调用",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    _hoisted_156,
                    (0, import_vue13.toDisplayString)((data.value.apiStats || {}).calls_total || 0),
                    1
                    /* TEXT */
                  )
                ]),
                (0, import_vue13.createElementVNode)(
                  "div",
                  {
                    class: (0, import_vue13.normalizeClass)(["tile", (data.value.apiStats || {}).calls_4xx ? "tile-warn" : ""])
                  },
                  [
                    _cache[26] || (_cache[26] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "4xx",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      {
                        class: (0, import_vue13.normalizeClass)(["v", (data.value.apiStats || {}).calls_4xx ? "txt-warn" : ""])
                      },
                      (0, import_vue13.toDisplayString)((data.value.apiStats || {}).calls_4xx || 0),
                      3
                      /* TEXT, CLASS */
                    )
                  ],
                  2
                  /* CLASS */
                ),
                (0, import_vue13.createElementVNode)(
                  "div",
                  {
                    class: (0, import_vue13.normalizeClass)(["tile", (data.value.apiStats || {}).calls_5xx ? "tile-danger" : ""])
                  },
                  [
                    _cache[27] || (_cache[27] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "5xx",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      {
                        class: (0, import_vue13.normalizeClass)(["v", (data.value.apiStats || {}).calls_5xx ? "txt-danger" : ""])
                      },
                      (0, import_vue13.toDisplayString)((data.value.apiStats || {}).calls_5xx || 0),
                      3
                      /* TEXT, CLASS */
                    )
                  ],
                  2
                  /* CLASS */
                )
              ]),
              (0, import_vue13.createElementVNode)("div", _hoisted_166, [
                ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                  import_vue13.Fragment,
                  null,
                  (0, import_vue13.renderList)((data.value.apiStats || {}).methods || {}, (n, m) => {
                    return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                      "span",
                      {
                        key: m,
                        class: "tag-chip chip-info"
                      },
                      (0, import_vue13.toDisplayString)(m) + " " + (0, import_vue13.toDisplayString)(n),
                      1
                      /* TEXT */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              (0, import_vue13.createElementVNode)("table", _hoisted_175, [
                _cache[29] || (_cache[29] = (0, import_vue13.createElementVNode)(
                  "thead",
                  null,
                  [
                    (0, import_vue13.createElementVNode)("tr", null, [
                      (0, import_vue13.createElementVNode)("th", null, "时间"),
                      (0, import_vue13.createElementVNode)("th", null, "方法"),
                      (0, import_vue13.createElementVNode)("th", null, "路径"),
                      (0, import_vue13.createElementVNode)("th", null, "状态"),
                      (0, import_vue13.createElementVNode)("th", null, "耗时"),
                      (0, import_vue13.createElementVNode)("th", null, "来源")
                    ])
                  ],
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)("tbody", null, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)(data.value.apiCalls || [], (c, i) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", { key: i }, [
                        (0, import_vue13.createElementVNode)(
                          "td",
                          _hoisted_185,
                          (0, import_vue13.toDisplayString)(c.ts),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue13.createElementVNode)("td", null, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["tag-chip", c.method === "POST" ? "chip-err" : c.method === "DELETE" ? "chip-warn" : "chip-ok"])
                            },
                            (0, import_vue13.toDisplayString)(c.method),
                            3
                            /* TEXT, CLASS */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)(
                          "td",
                          _hoisted_195,
                          (0, import_vue13.toDisplayString)(c.path),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue13.createElementVNode)("td", null, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["tag-chip", c.code < 400 ? "chip-ok" : c.code < 500 ? "chip-warn" : "chip-err"])
                            },
                            (0, import_vue13.toDisplayString)(c.code),
                            3
                            /* TEXT, CLASS */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)(
                          "td",
                          {
                            class: (0, import_vue13.normalizeClass)(["mono", (c.ms || 0) >= 1e3 ? "txt-danger" : ""])
                          },
                          (0, import_vue13.toDisplayString)(c.ms) + "ms",
                          3
                          /* TEXT, CLASS */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "td",
                          _hoisted_205,
                          (0, import_vue13.toDisplayString)(c.ip),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !(data.value.apiCalls || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", _hoisted_218, [..._cache[28] || (_cache[28] = [
                    (0, import_vue13.createElementVNode)(
                      "td",
                      {
                        colspan: "6",
                        class: "hint"
                      },
                      "暂无记录(有请求后出现; 轮询 3s 自动刷新)",
                      -1
                      /* CACHED */
                    )
                  ])])) : (0, import_vue13.createCommentVNode)("v-if", true)
                ])
              ])
            ],
            64
            /* STABLE_FRAGMENT */
          )) : (0, import_vue13.createCommentVNode)("v-if", true),
          !COMP_SUBS.includes(sub.value) ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_226, [
            err.value[sub.value] ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              "div",
              _hoisted_235,
              (0, import_vue13.toDisplayString)(err.value[sub.value]),
              1
              /* TEXT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "svc" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 1 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_245, [
                  _cache[30] || (_cache[30] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "服务单元",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    {
                      class: (0, import_vue13.normalizeClass)(["tag-chip", svcUnits.value.some((u) => u.active === "failed") ? "chip-err" : "chip-ok"])
                    },
                    (0, import_vue13.toDisplayString)(svcUnits.value.filter((u) => u.active === "active").length) + "/" + (0, import_vue13.toDisplayString)(svcUnits.value.length) + " 运行中",
                    3
                    /* TEXT, CLASS */
                  ),
                  _cache[31] || (_cache[31] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.withDirectives)((0, import_vue13.createElementVNode)(
                    "input",
                    {
                      "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => svcFilter.value = $event),
                      class: "input",
                      style: { "max-width": "220px" },
                      placeholder: "过滤服务名…"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [import_vue13.vModelText, svcFilter.value]
                  ]),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[2] || (_cache[2] = ($event) => loadSection("svc"))
                  }, "⟳")
                ]),
                data.value.svcMsg ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                  "div",
                  _hoisted_255,
                  (0, import_vue13.toDisplayString)(data.value.svcMsg),
                  1
                  /* TEXT */
                )) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("div", _hoisted_264, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)(svcUnits.value, (u) => {
                      return (0, import_vue13.withDirectives)(((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", {
                        key: u.unit,
                        class: "svc-card"
                      }, [
                        (0, import_vue13.createElementVNode)("div", _hoisted_274, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["led", u.active === "active" ? "on" : u.active === "failed" ? "bad" : ""])
                            },
                            null,
                            2
                            /* CLASS */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_284,
                            (0, import_vue13.toDisplayString)(u.unit),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)("div", _hoisted_294, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["tag-chip", u.active === "active" ? "chip-ok" : u.active === "failed" ? "chip-err" : "chip-dim"])
                            },
                            (0, import_vue13.toDisplayString)(u.active),
                            3
                            /* TEXT, CLASS */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_304,
                            "自启 " + (0, import_vue13.toDisplayString)(u.sub),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)("div", _hoisted_317, [
                          (0, import_vue13.createElementVNode)("button", {
                            class: "btn btn-sm btn-primary",
                            onClick: ($event) => svcAct(u, "start")
                          }, "启动", 8, _hoisted_325),
                          (0, import_vue13.createElementVNode)("button", {
                            class: "btn btn-sm",
                            onClick: ($event) => svcAct(u, "stop")
                          }, "停止", 8, _hoisted_334),
                          (0, import_vue13.createElementVNode)("button", {
                            class: "btn btn-sm",
                            onClick: ($event) => svcAct(u, "restart")
                          }, "重启", 8, _hoisted_344),
                          _cache[32] || (_cache[32] = (0, import_vue13.createElementVNode)(
                            "span",
                            { class: "grow" },
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue13.createElementVNode)("button", {
                            class: "btn btn-sm btn-ghost",
                            onClick: ($event) => svcAct(u, "enable")
                          }, "自启开", 8, _hoisted_354),
                          (0, import_vue13.createElementVNode)("button", {
                            class: "btn btn-sm btn-ghost",
                            onClick: ($event) => svcAct(u, "disable")
                          }, "自启关", 8, _hoisted_364)
                        ])
                      ])), [
                        [import_vue13.vShow, !svcFilter.value || u.unit.indexOf(svcFilter.value) >= 0]
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "hw" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 2 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_374, [
                  _cache[33] || (_cache[33] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "硬件概览",
                    -1
                    /* CACHED */
                  )),
                  _cache[34] || (_cache[34] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[3] || (_cache[3] = ($event) => loadSection("hw"))
                  }, "⟳ 刷新")
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_384, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_394, [
                    _cache[35] || (_cache[35] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "st-k" },
                      "CPU",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "b",
                      _hoisted_404,
                      (0, import_vue13.toDisplayString)(((data.value.hw || {}).cpu || {}).model || "-"),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_413,
                      "核数: " + (0, import_vue13.toDisplayString)(((data.value.hw || {}).cpu || {}).cores || "-"),
                      1
                      /* TEXT */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)("div", _hoisted_424, [
                    _cache[37] || (_cache[37] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "st-k" },
                      "内存",
                      -1
                      /* CACHED */
                    )),
                    (((data.value.hw || {}).memory || {}).sticks || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      { key: 0 },
                      [
                        (0, import_vue13.createElementVNode)(
                          "b",
                          _hoisted_433,
                          (0, import_vue13.toDisplayString)(((data.value.hw || {}).memory || {}).sticks.length) + " 条",
                          1
                          /* TEXT */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "span",
                          _hoisted_443,
                          (0, import_vue13.toDisplayString)((((data.value.hw || {}).memory || {}).sticks || []).map((x) => x.size + (x.speed ? "@" + x.speed : "")).join(", ")),
                          1
                          /* TEXT */
                        )
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    )) : ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      { key: 1 },
                      [
                        (0, import_vue13.createElementVNode)(
                          "b",
                          _hoisted_453,
                          (0, import_vue13.toDisplayString)(((data.value.hw || {}).memory || {}).total ? (((data.value.hw || {}).memory || {}).total / 1073741824).toFixed(1) + " GB" : "—"),
                          1
                          /* TEXT */
                        ),
                        _cache[36] || (_cache[36] = (0, import_vue13.createElementVNode)(
                          "span",
                          { class: "faint" },
                          "物理内存总量",
                          -1
                          /* CACHED */
                        ))
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    ))
                  ]),
                  (0, import_vue13.createElementVNode)("div", _hoisted_463, [
                    _cache[38] || (_cache[38] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "st-k" },
                      "主板",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "b",
                      _hoisted_472,
                      (0, import_vue13.toDisplayString)(((data.value.hw || {}).board || {}).vendor || "") + " " + (0, import_vue13.toDisplayString)(((data.value.hw || {}).board || {}).model || ""),
                      1
                      /* TEXT */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)("div", _hoisted_482, [
                    _cache[39] || (_cache[39] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "st-k" },
                      "温度传感器",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "b",
                      _hoisted_492,
                      (0, import_vue13.toDisplayString)(((data.value.hw || {}).temps || []).length) + " 个",
                      1
                      /* TEXT */
                    ),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_50,
                      (0, import_vue13.toDisplayString)(((data.value.hw || {}).temps || []).map((t) => t.chip + ":" + Object.values(t.values || {}).join("/")).join(" ").slice(0, 120)),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                _cache[41] || (_cache[41] = (0, import_vue13.createElementVNode)(
                  "div",
                  { class: "pane-head" },
                  [
                    (0, import_vue13.createElementVNode)("span", { class: "pane-title" }, "磁盘 S.M.A.R.T")
                  ],
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)("table", _hoisted_51, [
                  _cache[40] || (_cache[40] = (0, import_vue13.createElementVNode)(
                    "thead",
                    null,
                    [
                      (0, import_vue13.createElementVNode)("tr", null, [
                        (0, import_vue13.createElementVNode)("th", null, "设备"),
                        (0, import_vue13.createElementVNode)("th", null, "状态")
                      ])
                    ],
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("tbody", null, [
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)((data.value.hw || {}).smart || [], (sd, i) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", { key: i }, [
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_522,
                            (0, import_vue13.toDisplayString)(sd.dev),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)("td", null, [
                            (0, import_vue13.createElementVNode)(
                              "span",
                              {
                                class: (0, import_vue13.normalizeClass)(["tag-chip", (sd.status || "").indexOf("OK") >= 0 ? "chip-ok" : "chip-err"])
                              },
                              (0, import_vue13.toDisplayString)(sd.status),
                              3
                              /* TEXT, CLASS */
                            )
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ]),
                !((data.value.hw || {}).smart || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_532, "无 SMART 数据(需 smartmontools)")) : (0, import_vue13.createCommentVNode)("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "up" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 3 },
              [
                (0, import_vue13.createElementVNode)("div", { class: "pane-head" }, [
                  _cache[42] || (_cache[42] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "系统更新",
                    -1
                    /* CACHED */
                  )),
                  _cache[43] || (_cache[43] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: updRefresh
                  }, "更新索引"),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm btn-danger",
                    onClick: updRun
                  }, "立即升级")
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_542, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_552, [
                    _cache[44] || (_cache[44] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "可升级包",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_562,
                      (0, import_vue13.toDisplayString)((data.value.up || {}).count != null ? (data.value.up || {}).count : "—"),
                      1
                      /* TEXT */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)(
                    "div",
                    {
                      class: (0, import_vue13.normalizeClass)(["tile", (data.value.up || {}).security ? "tile-warn" : ""])
                    },
                    [
                      _cache[45] || (_cache[45] = (0, import_vue13.createElementVNode)(
                        "span",
                        { class: "k" },
                        "涉安全更新",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue13.createElementVNode)(
                        "span",
                        {
                          class: (0, import_vue13.normalizeClass)(["v", (data.value.up || {}).security ? "txt-warn" : ""])
                        },
                        (0, import_vue13.toDisplayString)((data.value.up || {}).security != null ? (data.value.up || {}).security : "—"),
                        3
                        /* TEXT, CLASS */
                      )
                    ],
                    2
                    /* CLASS */
                  ),
                  (0, import_vue13.createElementVNode)("div", _hoisted_572, [
                    _cache[46] || (_cache[46] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "索引状态",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_58,
                      (0, import_vue13.toDisplayString)((data.value.up || {}).count != null ? "已就绪" : "未刷新"),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                data.value.upMsg ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                  "div",
                  _hoisted_59,
                  (0, import_vue13.toDisplayString)(data.value.upMsg),
                  1
                  /* TEXT */
                )) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("table", _hoisted_60, [
                  _cache[47] || (_cache[47] = (0, import_vue13.createElementVNode)(
                    "thead",
                    null,
                    [
                      (0, import_vue13.createElementVNode)("tr", null, [
                        (0, import_vue13.createElementVNode)("th", null, "软件包"),
                        (0, import_vue13.createElementVNode)("th", null, "新版本"),
                        (0, import_vue13.createElementVNode)("th", null, "架构")
                      ])
                    ],
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("tbody", null, [
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)((data.value.up || {}).packages || [], (p, i) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", { key: i }, [
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_61,
                            (0, import_vue13.toDisplayString)(p.pkg),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_622,
                            (0, import_vue13.toDisplayString)(p.new),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_632,
                            (0, import_vue13.toDisplayString)(p.arch),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ]),
                !((data.value.up || {}).packages || []).length && !data.value.upMsg ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_642, "点击「更新索引」获取可升级列表")) : (0, import_vue13.createCommentVNode)("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "disk" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 4 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_652, [
                  _cache[48] || (_cache[48] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "磁盘用量",
                    -1
                    /* CACHED */
                  )),
                  _cache[49] || (_cache[49] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[4] || (_cache[4] = ($event) => loadSection("disk"))
                  }, "⟳ 刷新")
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_662, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_672, [
                    _cache[50] || (_cache[50] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "文件系统",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_68,
                      (0, import_vue13.toDisplayString)(((data.value.disk || {}).df || []).length),
                      1
                      /* TEXT */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)(
                    "div",
                    {
                      class: (0, import_vue13.normalizeClass)(["tile", maxDiskUse.value >= 85 ? "tile-danger" : maxDiskUse.value >= 70 ? "tile-warn" : "tile-ok"])
                    },
                    [
                      _cache[51] || (_cache[51] = (0, import_vue13.createElementVNode)(
                        "span",
                        { class: "k" },
                        "最高使用率",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue13.createElementVNode)(
                        "span",
                        _hoisted_69,
                        (0, import_vue13.toDisplayString)(maxDiskUse.value) + "%",
                        1
                        /* TEXT */
                      )
                    ],
                    2
                    /* CLASS */
                  )
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_70, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)((data.value.disk || {}).df || [], (d, i) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", {
                        key: i,
                        class: "disk-row"
                      }, [
                        (0, import_vue13.createElementVNode)("div", _hoisted_71, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_722,
                            (0, import_vue13.toDisplayString)(d.mount),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_732,
                            (0, import_vue13.toDisplayString)(d.type),
                            1
                            /* TEXT */
                          ),
                          _cache[52] || (_cache[52] = (0, import_vue13.createElementVNode)(
                            "span",
                            { class: "grow" },
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_742,
                            (0, import_vue13.toDisplayString)(d.used) + " / " + (0, import_vue13.toDisplayString)(d.size),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["mono", parseInt(d.use) >= 85 ? "txt-danger" : parseInt(d.use) >= 70 ? "txt-warn" : "txt-ok"]),
                              style: { "min-width": "46px", "text-align": "right" }
                            },
                            (0, import_vue13.toDisplayString)(d.use),
                            3
                            /* TEXT, CLASS */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)("div", _hoisted_752, [
                          (0, import_vue13.createElementVNode)(
                            "div",
                            {
                              style: (0, import_vue13.normalizeStyle)({ width: Math.min(100, parseInt(d.use) || 0) + "%", background: parseInt(d.use) >= 85 ? "var(--danger)" : parseInt(d.use) >= 70 ? "var(--warning)" : "var(--accent)" })
                            },
                            null,
                            4
                            /* STYLE */
                          )
                        ]),
                        (0, import_vue13.createElementVNode)(
                          "div",
                          _hoisted_762,
                          (0, import_vue13.toDisplayString)(d.fs) + " · 可用 " + (0, import_vue13.toDisplayString)(d.avail),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                !((data.value.disk || {}).df || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_77, "无挂载数据")) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("details", _hoisted_78, [
                  _cache[53] || (_cache[53] = (0, import_vue13.createElementVNode)(
                    "summary",
                    { class: "muted" },
                    "lsblk 拓扑",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "pre",
                    _hoisted_79,
                    (0, import_vue13.toDisplayString)(JSON.stringify((data.value.disk || {}).lsblk, null, 2)),
                    1
                    /* TEXT */
                  )
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "snap" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 5 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_80, [
                  _cache[54] || (_cache[54] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "只读快照",
                    -1
                    /* CACHED */
                  )),
                  _cache[55] || (_cache[55] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[5] || (_cache[5] = ($event) => loadSection("snap"))
                  }, "⟳ 刷新")
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_81, [
                  _cache[56] || (_cache[56] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "st-k" },
                    "根文件系统",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "b",
                    _hoisted_822,
                    (0, import_vue13.toDisplayString)((data.value.snap || {}).fstype || "-"),
                    1
                    /* TEXT */
                  ),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    {
                      class: (0, import_vue13.normalizeClass)(["tag-chip", (data.value.snap || {}).supported ? "chip-ok" : "chip-err"])
                    },
                    (0, import_vue13.toDisplayString)((data.value.snap || {}).supported ? "支持在线快照" : "不支持"),
                    3
                    /* TEXT, CLASS */
                  ),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    _hoisted_832,
                    (0, import_vue13.toDisplayString)((data.value.snap || {}).hint || ""),
                    1
                    /* TEXT */
                  )
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_842, [
                  (0, import_vue13.withDirectives)((0, import_vue13.createElementVNode)(
                    "input",
                    {
                      "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => snapName.value = $event),
                      class: "input",
                      placeholder: "快照名 (英文/数字)"
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [import_vue13.vModelText, snapName.value]
                  ]),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm btn-primary",
                    disabled: !(data.value.snap || {}).supported,
                    onClick: snapCreate
                  }, "创建只读快照", 8, _hoisted_852)
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_862, [
                  _cache[57] || (_cache[57] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "已有快照",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    _hoisted_87,
                    (0, import_vue13.toDisplayString)(((data.value.snapList || {}).snapshots || []).length),
                    1
                    /* TEXT */
                  )
                ]),
                ((data.value.snapList || {}).snapshots || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_88, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)((data.value.snapList || {}).snapshots, (s) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                        "span",
                        {
                          key: s,
                          class: "tag-chip chip-info snap-chip mono"
                        },
                        (0, import_vue13.toDisplayString)(s),
                        1
                        /* TEXT */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])) : ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_89, "(无快照)"))
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "usr" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 6 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_90, [
                  _cache[58] || (_cache[58] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "用户 / SSH 密钥",
                    -1
                    /* CACHED */
                  )),
                  _cache[59] || (_cache[59] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[7] || (_cache[7] = ($event) => loadSection("usr"))
                  }, "⟳ 刷新")
                ]),
                (0, import_vue13.createElementVNode)("table", _hoisted_91, [
                  _cache[60] || (_cache[60] = (0, import_vue13.createElementVNode)(
                    "thead",
                    null,
                    [
                      (0, import_vue13.createElementVNode)("tr", null, [
                        (0, import_vue13.createElementVNode)("th", null, "用户"),
                        (0, import_vue13.createElementVNode)("th", null, "UID"),
                        (0, import_vue13.createElementVNode)("th", null, "主目录"),
                        (0, import_vue13.createElementVNode)("th", null, "Shell"),
                        (0, import_vue13.createElementVNode)("th", null, "sudo"),
                        (0, import_vue13.createElementVNode)("th", null, "密钥")
                      ])
                    ],
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("tbody", null, [
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)(data.value.usr || [], (u) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", {
                          key: u.name
                        }, [
                          (0, import_vue13.createElementVNode)("td", null, [
                            (0, import_vue13.createElementVNode)(
                              "span",
                              _hoisted_922,
                              (0, import_vue13.toDisplayString)((u.name || "?").slice(0, 1).toUpperCase()),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue13.createElementVNode)(
                              "span",
                              _hoisted_932,
                              (0, import_vue13.toDisplayString)(u.name),
                              1
                              /* TEXT */
                            )
                          ]),
                          (0, import_vue13.createElementVNode)(
                            "td",
                            null,
                            (0, import_vue13.toDisplayString)(u.uid),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_942,
                            (0, import_vue13.toDisplayString)(u.home),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_952,
                            (0, import_vue13.toDisplayString)(u.shell),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)("td", null, [
                            (0, import_vue13.createElementVNode)(
                              "span",
                              {
                                class: (0, import_vue13.normalizeClass)(["tag-chip", u.sudo ? "chip-ok" : "chip-dim"])
                              },
                              (0, import_vue13.toDisplayString)(u.sudo ? "sudo" : "—"),
                              3
                              /* TEXT, CLASS */
                            )
                          ]),
                          (0, import_vue13.createElementVNode)("td", null, [
                            (0, import_vue13.createElementVNode)("button", {
                              class: "btn btn-sm",
                              onClick: ($event) => sshLoad(u.name)
                            }, "管理密钥", 8, _hoisted_962)
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ]),
                sshUser.value ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_97, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_98, [
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_99,
                      "authorized_keys · " + (0, import_vue13.toDisplayString)(sshUser.value),
                      1
                      /* TEXT */
                    ),
                    _cache[61] || (_cache[61] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "grow" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    _cache[62] || (_cache[62] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "faint" },
                      "保存即生效",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)("button", {
                      class: "btn btn-sm btn-primary",
                      onClick: sshSave
                    }, "保存")
                  ]),
                  (0, import_vue13.withDirectives)((0, import_vue13.createElementVNode)(
                    "textarea",
                    {
                      "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => sshKeys.value = $event),
                      class: "input mono",
                      rows: "8",
                      style: { "font-family": "var(--font-mono)" }
                    },
                    null,
                    512
                    /* NEED_PATCH */
                  ), [
                    [import_vue13.vModelText, sshKeys.value]
                  ])
                ])) : (0, import_vue13.createCommentVNode)("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "clean" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 7 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_100, [
                  _cache[63] || (_cache[63] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "存储清理",
                    -1
                    /* CACHED */
                  )),
                  _cache[64] || (_cache[64] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-sub" },
                    "全盘 du 可能 30s+ · 结果缓存 90s",
                    -1
                    /* CACHED */
                  )),
                  _cache[65] || (_cache[65] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm btn-primary",
                    onClick: _cache[9] || (_cache[9] = ($event) => loadSection("clean"))
                  }, "⟳ 重新扫描")
                ]),
                data.value.cleanMsg ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                  "div",
                  _hoisted_101,
                  (0, import_vue13.toDisplayString)(data.value.cleanMsg),
                  1
                  /* TEXT */
                )) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("div", _hoisted_1022, [
                  (0, import_vue13.createElementVNode)("div", null, [
                    _cache[67] || (_cache[67] = (0, import_vue13.createElementVNode)(
                      "div",
                      {
                        class: "pane-head",
                        style: { "margin-top": "0" }
                      },
                      [
                        (0, import_vue13.createElementVNode)("span", { class: "pane-title" }, "清理项")
                      ],
                      -1
                      /* CACHED */
                    )),
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)((data.value.clean || {}).items || [], (it) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", {
                          key: it.key,
                          class: "clean-row"
                        }, [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            null,
                            (0, import_vue13.toDisplayString)(it.label),
                            1
                            /* TEXT */
                          ),
                          it.key === "workspace" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("span", _hoisted_1032, "常驻·不限期")) : (0, import_vue13.createCommentVNode)("v-if", true),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_1042,
                            (0, import_vue13.toDisplayString)(it.path),
                            1
                            /* TEXT */
                          ),
                          _cache[66] || (_cache[66] = (0, import_vue13.createElementVNode)(
                            "span",
                            { class: "grow" },
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_1052,
                            (0, import_vue13.toDisplayString)(it.size),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)("button", {
                            class: "btn btn-sm btn-danger",
                            onClick: ($event) => cleanDo(it)
                          }, "清理", 8, _hoisted_1062)
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    !((data.value.clean || {}).items || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_107, "暂无数据, 点击「重新扫描」")) : (0, import_vue13.createCommentVNode)("v-if", true)
                  ]),
                  (0, import_vue13.createElementVNode)("div", null, [
                    _cache[68] || (_cache[68] = (0, import_vue13.createElementVNode)(
                      "div",
                      {
                        class: "pane-head",
                        style: { "margin-top": "0" }
                      },
                      [
                        (0, import_vue13.createElementVNode)("span", { class: "pane-title" }, "磁盘占用 Top 15")
                      ],
                      -1
                      /* CACHED */
                    )),
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)((data.value.clean || {}).dirs || [], (d, i) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", {
                          key: i,
                          class: "top-row"
                        }, [
                          (0, import_vue13.createElementVNode)("div", _hoisted_108, [
                            (0, import_vue13.createElementVNode)(
                              "span",
                              _hoisted_109,
                              (0, import_vue13.toDisplayString)(d.path),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue13.createElementVNode)(
                              "span",
                              _hoisted_1102,
                              (0, import_vue13.toDisplayString)(d.size),
                              1
                              /* TEXT */
                            )
                          ]),
                          (0, import_vue13.createElementVNode)("div", _hoisted_1112, [
                            (0, import_vue13.createElementVNode)(
                              "div",
                              {
                                style: (0, import_vue13.normalizeStyle)({ width: topBar(d.size) + "%" })
                              },
                              null,
                              4
                              /* STYLE */
                            )
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "pwr" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 8 },
              [
                _cache[74] || (_cache[74] = (0, import_vue13.createElementVNode)(
                  "div",
                  { class: "pane-head" },
                  [
                    (0, import_vue13.createElementVNode)("span", { class: "pane-title" }, "关机 / 重启"),
                    (0, import_vue13.createElementVNode)("span", { class: "pane-sub" }, "电源计划 · 危险操作")
                  ],
                  -1
                  /* CACHED */
                )),
                (0, import_vue13.createElementVNode)("div", _hoisted_1122, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_1132, [
                    _cache[69] || (_cache[69] = (0, import_vue13.createElementVNode)(
                      "span",
                      {
                        class: "faint",
                        style: { "flex": "none" }
                      },
                      "当前计划",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      {
                        class: (0, import_vue13.normalizeClass)(["tag-chip", pwrEpoch.value ? "chip-err" : "chip-dim"]),
                        style: { "max-width": "100%", "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }
                      },
                      (0, import_vue13.toDisplayString)(pwrEpoch.value || "无计划"),
                      3
                      /* TEXT, CLASS */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)("div", _hoisted_1142, [
                    (0, import_vue13.withDirectives)((0, import_vue13.createElementVNode)(
                      "select",
                      {
                        "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => pwrAction.value = $event),
                        class: "select"
                      },
                      [..._cache[70] || (_cache[70] = [
                        (0, import_vue13.createElementVNode)(
                          "option",
                          { value: "reboot" },
                          "重启",
                          -1
                          /* CACHED */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "option",
                          { value: "shutdown" },
                          "关机",
                          -1
                          /* CACHED */
                        )
                      ])],
                      512
                      /* NEED_PATCH */
                    ), [
                      [import_vue13.vModelSelect, pwrAction.value]
                    ]),
                    (0, import_vue13.withDirectives)((0, import_vue13.createElementVNode)(
                      "input",
                      {
                        "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => pwrMin.value = $event),
                        type: "number",
                        class: "input",
                        style: { "max-width": "110px" },
                        min: "1",
                        max: "1440"
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    ), [
                      [
                        import_vue13.vModelText,
                        pwrMin.value,
                        void 0,
                        { number: true }
                      ]
                    ]),
                    _cache[71] || (_cache[71] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "muted" },
                      "分钟后执行",
                      -1
                      /* CACHED */
                    )),
                    _cache[72] || (_cache[72] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "grow" },
                      null,
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)("button", {
                      class: "btn btn-sm",
                      onClick: pwrCancel
                    }, "取消计划"),
                    (0, import_vue13.createElementVNode)("button", {
                      class: "btn btn-sm btn-danger",
                      onClick: pwrPlan
                    }, "计划执行")
                  ]),
                  _cache[73] || (_cache[73] = (0, import_vue13.createElementVNode)(
                    "div",
                    {
                      class: "hint",
                      style: { "margin-top": "10px" }
                    },
                    "计划生效后到点自动执行, 请在到点前取消。",
                    -1
                    /* CACHED */
                  ))
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "kern" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 9 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_1152, [
                  _cache[75] || (_cache[75] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "内核管理",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)(
                    "span",
                    _hoisted_1162,
                    (0, import_vue13.toDisplayString)((data.value.kern || {}).current || "—"),
                    1
                    /* TEXT */
                  ),
                  _cache[76] || (_cache[76] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[12] || (_cache[12] = ($event) => loadSection("kern"))
                  }, "⟳ 刷新")
                ]),
                data.value.kernMsg ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                  "div",
                  _hoisted_1172,
                  (0, import_vue13.toDisplayString)(data.value.kernMsg),
                  1
                  /* TEXT */
                )) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("table", _hoisted_1182, [
                  _cache[77] || (_cache[77] = (0, import_vue13.createElementVNode)(
                    "thead",
                    null,
                    [
                      (0, import_vue13.createElementVNode)("tr", null, [
                        (0, import_vue13.createElementVNode)("th", null, "包"),
                        (0, import_vue13.createElementVNode)("th", null, "版本"),
                        (0, import_vue13.createElementVNode)("th", null, "状态"),
                        (0, import_vue13.createElementVNode)("th", null, "操作")
                      ])
                    ],
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("tbody", null, [
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)((data.value.kern || {}).installed || [], (k) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("tr", {
                          key: k.pkg
                        }, [
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_1192,
                            (0, import_vue13.toDisplayString)(k.pkg),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "td",
                            _hoisted_120,
                            (0, import_vue13.toDisplayString)(k.ver),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)("td", null, [
                            k.pkg.indexOf((data.value.kern || {}).current || "zzz") >= 0 ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("span", _hoisted_121, "运行中")) : ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("span", _hoisted_1222, "—"))
                          ]),
                          (0, import_vue13.createElementVNode)("td", null, [
                            k.pkg.indexOf((data.value.kern || {}).current || "zzz") < 0 ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("button", {
                              key: 0,
                              class: "btn btn-sm btn-danger",
                              onClick: ($event) => kernRemove(k)
                            }, "卸载", 8, _hoisted_1232)) : (0, import_vue13.createCommentVNode)("v-if", true)
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "tz" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 10 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_1242, [
                  _cache[78] || (_cache[78] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "时间 / NTP",
                    -1
                    /* CACHED */
                  )),
                  _cache[79] || (_cache[79] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[13] || (_cache[13] = ($event) => loadSection("tz"))
                  }, "⟳ 刷新"),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm btn-primary",
                    onClick: timeSyncDo
                  }, "启用 / 同步 NTP")
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_1252, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_1262, [
                    _cache[80] || (_cache[80] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "时区",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_1272,
                      (0, import_vue13.toDisplayString)(((data.value.tz || {}).fields || {})["Time zone"] || "—"),
                      1
                      /* TEXT */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)("div", _hoisted_128, [
                    _cache[81] || (_cache[81] = (0, import_vue13.createElementVNode)(
                      "span",
                      { class: "k" },
                      "本地时间",
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue13.createElementVNode)(
                      "span",
                      _hoisted_129,
                      (0, import_vue13.toDisplayString)(((data.value.tz || {}).fields || {})["Local time"] || "—"),
                      1
                      /* TEXT */
                    )
                  ]),
                  (0, import_vue13.createElementVNode)(
                    "div",
                    {
                      class: (0, import_vue13.normalizeClass)(["tile", (data.value.tz || {}).sync === "off" ? "tile-danger" : "tile-ok"])
                    },
                    [
                      _cache[82] || (_cache[82] = (0, import_vue13.createElementVNode)(
                        "span",
                        { class: "k" },
                        "NTP 同步",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue13.createElementVNode)(
                        "span",
                        {
                          class: (0, import_vue13.normalizeClass)(["v txt-sm", (data.value.tz || {}).sync === "off" ? "txt-danger" : "txt-ok"])
                        },
                        (0, import_vue13.toDisplayString)((data.value.tz || {}).sync || "off"),
                        3
                        /* TEXT, CLASS */
                      )
                    ],
                    2
                    /* CLASS */
                  )
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "health" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 11 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_130, [
                  _cache[83] || (_cache[83] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "健康检查",
                    -1
                    /* CACHED */
                  )),
                  _cache[84] || (_cache[84] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-sub" },
                    "磁盘 / 内存 / 面板服务",
                    -1
                    /* CACHED */
                  )),
                  _cache[85] || (_cache[85] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[14] || (_cache[14] = ($event) => loadSection("health"))
                  }, "⟳ 重新检查"),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm btn-danger",
                    onClick: healthRestart
                  }, "重启面板服务")
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_131, [
                  (0, import_vue13.createElementVNode)(
                    "div",
                    {
                      class: (0, import_vue13.normalizeClass)(["tile", healthFail.value ? "tile-danger" : "tile-ok"])
                    },
                    [
                      _cache[86] || (_cache[86] = (0, import_vue13.createElementVNode)(
                        "span",
                        { class: "k" },
                        "检查结果",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue13.createElementVNode)(
                        "span",
                        _hoisted_1322,
                        (0, import_vue13.toDisplayString)(healthOk.value) + "/" + (0, import_vue13.toDisplayString)(healthChecks.value.length),
                        1
                        /* TEXT */
                      ),
                      (0, import_vue13.createElementVNode)(
                        "span",
                        _hoisted_1332,
                        (0, import_vue13.toDisplayString)(healthFail.value ? healthFail.value + " 项异常" : "全部正常"),
                        1
                        /* TEXT */
                      )
                    ],
                    2
                    /* CLASS */
                  ),
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)(healthChecks.value, (it) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                        "div",
                        {
                          class: (0, import_vue13.normalizeClass)(["tile", it.ok ? "tile-ok" : "tile-danger"]),
                          key: it.name
                        },
                        [
                          (0, import_vue13.createElementVNode)(
                            "span",
                            _hoisted_1342,
                            (0, import_vue13.toDisplayString)(it.name),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue13.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue13.normalizeClass)(["v txt-sm", it.ok ? "txt-ok" : "txt-danger"])
                            },
                            (0, import_vue13.toDisplayString)(it.ok ? "正常" : "异常"),
                            3
                            /* TEXT, CLASS */
                          )
                        ],
                        2
                        /* CLASS */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                (0, import_vue13.createElementVNode)("div", _hoisted_1352, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)(healthChecks.value, (it, i) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", {
                        key: i,
                        class: "check-row"
                      }, [
                        (0, import_vue13.createElementVNode)(
                          "span",
                          {
                            class: (0, import_vue13.normalizeClass)(["led", it.ok ? "on" : "bad"])
                          },
                          null,
                          2
                          /* CLASS */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "span",
                          _hoisted_1362,
                          (0, import_vue13.toDisplayString)(it.name),
                          1
                          /* TEXT */
                        ),
                        _cache[87] || (_cache[87] = (0, import_vue13.createElementVNode)(
                          "span",
                          { class: "grow" },
                          null,
                          -1
                          /* CACHED */
                        )),
                        (0, import_vue13.createElementVNode)(
                          "span",
                          {
                            class: (0, import_vue13.normalizeClass)(["tag-chip", it.ok ? "chip-ok" : "chip-err"])
                          },
                          (0, import_vue13.toDisplayString)(it.ok ? "正常" : "异常"),
                          3
                          /* TEXT, CLASS */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                !healthChecks.value.length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_137, "暂无数据, 点击「重新检查」")) : (0, import_vue13.createCommentVNode)("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "events" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 12 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_138, [
                  _cache[88] || (_cache[88] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "事件时间线",
                    -1
                    /* CACHED */
                  )),
                  _cache[89] || (_cache[89] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-sub" },
                    "系统操作留痕 (服务/更新/电源/清理/快照/内核/时间)",
                    -1
                    /* CACHED */
                  )),
                  _cache[90] || (_cache[90] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[15] || (_cache[15] = ($event) => loadSection("events"))
                  }, "⟳ 刷新")
                ]),
                !((data.value.events || {}).events || []).length ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_139, "暂无记录, 执行过上述操作后会出现")) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("div", _hoisted_140, [
                  ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                    import_vue13.Fragment,
                    null,
                    (0, import_vue13.renderList)((data.value.events || {}).events || [], (e, i) => {
                      return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", {
                        key: i,
                        class: "tl-item"
                      }, [
                        (0, import_vue13.createElementVNode)(
                          "span",
                          _hoisted_141,
                          (0, import_vue13.toDisplayString)(new Date(e.t * 1e3).toLocaleString()),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "span",
                          {
                            class: (0, import_vue13.normalizeClass)(["tag-chip tl-scope", eventActCls(e.action)])
                          },
                          (0, import_vue13.toDisplayString)(e.scope),
                          3
                          /* TEXT, CLASS */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "b",
                          _hoisted_1422,
                          (0, import_vue13.toDisplayString)(e.action),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue13.createElementVNode)(
                          "span",
                          _hoisted_1432,
                          (0, import_vue13.toDisplayString)(e.msg),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true),
            sub.value === "lr" ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
              import_vue13.Fragment,
              { key: 13 },
              [
                (0, import_vue13.createElementVNode)("div", _hoisted_1442, [
                  _cache[91] || (_cache[91] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-title" },
                    "日志保留 (logrotate)",
                    -1
                    /* CACHED */
                  )),
                  _cache[92] || (_cache[92] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "pane-sub" },
                    "/etc/logrotate.d · 保存后下次轮转生效",
                    -1
                    /* CACHED */
                  )),
                  _cache[93] || (_cache[93] = (0, import_vue13.createElementVNode)(
                    "span",
                    { class: "grow" },
                    null,
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue13.createElementVNode)("button", {
                    class: "btn btn-sm",
                    onClick: _cache[16] || (_cache[16] = ($event) => loadSection("lr"))
                  }, "⟳ 刷新")
                ]),
                loading.value.lr ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_1452, "加载中…")) : (0, import_vue13.createCommentVNode)("v-if", true),
                err.value.lr ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                  "div",
                  _hoisted_1462,
                  (0, import_vue13.toDisplayString)(err.value.lr),
                  1
                  /* TEXT */
                )) : (0, import_vue13.createCommentVNode)("v-if", true),
                !loading.value.lr && !err.value.lr && (data.value.lr || {}).ok === void 0 ? ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_147, "数据未就绪，点击「刷新」重新加载")) : (0, import_vue13.createCommentVNode)("v-if", true),
                (0, import_vue13.createElementVNode)("div", _hoisted_148, [
                  (0, import_vue13.createElementVNode)("div", _hoisted_149, [
                    ((0, import_vue13.openBlock)(true), (0, import_vue13.createElementBlock)(
                      import_vue13.Fragment,
                      null,
                      (0, import_vue13.renderList)((data.value.lr || {}).files || [], (f) => {
                        return (0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("button", {
                          key: f.name,
                          class: "lr-file",
                          onClick: ($event) => lrSelect(f)
                        }, (0, import_vue13.toDisplayString)(f.name), 9, _hoisted_150);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  (0, import_vue13.createElementVNode)("div", _hoisted_151, [
                    (0, import_vue13.createElementVNode)("div", _hoisted_1522, [
                      (0, import_vue13.createElementVNode)(
                        "b",
                        _hoisted_1532,
                        (0, import_vue13.toDisplayString)(lrEdit.value ? lrEdit.value.name : "(选择左侧配置)"),
                        1
                        /* TEXT */
                      ),
                      _cache[94] || (_cache[94] = (0, import_vue13.createElementVNode)(
                        "span",
                        { class: "grow" },
                        null,
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue13.createElementVNode)("button", {
                        class: "btn btn-sm btn-primary",
                        disabled: !lrEdit.value,
                        onClick: lrSave
                      }, "保存", 8, _hoisted_1542)
                    ]),
                    lrEdit.value ? (0, import_vue13.withDirectives)(((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)(
                      "textarea",
                      {
                        key: 0,
                        "onUpdate:modelValue": _cache[17] || (_cache[17] = ($event) => lrEdit.value.content = $event),
                        class: "input mono",
                        rows: "16",
                        style: { "font-family": "var(--font-mono)" }
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    )), [
                      [import_vue13.vModelText, lrEdit.value.content]
                    ]) : ((0, import_vue13.openBlock)(), (0, import_vue13.createElementBlock)("div", _hoisted_1552, "← 选择左侧配置后在此编辑")),
                    _cache[95] || (_cache[95] = (0, import_vue13.createElementVNode)(
                      "div",
                      {
                        class: "muted",
                        style: { "font-size": "11px", "margin-top": "6px" }
                      },
                      "要点: rotate N(保留份数) · size X(达到大小轮转) · compress(压缩) · daily/weekly",
                      -1
                      /* CACHED */
                    ))
                  ])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue13.createCommentVNode)("v-if", true)
          ])) : (0, import_vue13.createCommentVNode)("v-if", true)
        ]);
      };
    }
  };
  __sfc_main7.__scopeId = "data-v-1yfhp4q";
  var SysFuncMain_default = __sfc_main7;
  (function() {
    var key = "rc-ext-css-data-v-1yfhp4q-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.notice[data-v-1yfhp4q] { padding: 8px 12px; background: var(--success-soft); color: var(--success); margin-bottom: 12px; font-size: 13px;\n}\n.sf-body[data-v-1yfhp4q] {\n}\n.svc-grid[data-v-1yfhp4q] { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px;\n}\n.svc-card[data-v-1yfhp4q] { border: 1px solid var(--border); padding: 10px 12px; background: var(--surface-2);\n}\n.svc-name[data-v-1yfhp4q] { font-size: 12px; font-weight: 600; margin-bottom: 4px;\n}\n.svc-sub[data-v-1yfhp4q] { font-size: 11px; margin-bottom: 8px;\n}\n.hv-grid[data-v-1yfhp4q] { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-bottom: 12px;\n}\n.stat[data-v-1yfhp4q] { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--border); background: var(--surface-2);\n}\n.st-k[data-v-1yfhp4q] { font-size: 11px; color: var(--text-faint);\n}\n.pre[data-v-1yfhp4q] { max-height: 280px; overflow: auto;\n}\n.bar-row[data-v-1yfhp4q] { display: flex; align-items: flex-end; gap: 2px; height: 56px; padding: 4px; background: var(--surface-2);\n}\n.bar-cell[data-v-1yfhp4q] { flex: 1; background: var(--accent); min-width: 2px;\n}\n.bar-cell.hot[data-v-1yfhp4q] { background: var(--danger);\n}\n.tl[data-v-1yfhp4q] { border-left: 2px solid var(--border); padding-left: 12px;\n}\n.tl-item[data-v-1yfhp4q] { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 12px;\n}\n.tl-time[data-v-1yfhp4q] { color: var(--text-faint); font-size: 11px; width: 170px;\n}\n.tl-scope[data-v-1yfhp4q] { color: var(--accent); font-weight: 700; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.tl-act[data-v-1yfhp4q] { color: var(--text-muted); width: 110px;\n}\n.tl-msg[data-v-1yfhp4q] { color: var(--text); flex: 1;\n}\n.lr-layout[data-v-1yfhp4q] { display: grid; grid-template-columns: 200px 1fr; gap: 12px;\n}\n.lr-file[data-v-1yfhp4q] { display: block; width: 100%; text-align: left; padding: 8px 10px; margin-bottom: 4px; background: var(--surface-2); border: 1px solid var(--border); cursor: pointer; font-size: 12px;\n}\n.lr-file[data-v-1yfhp4q]:hover { border-color: var(--accent);\n}\r\n\r\n/* ================= 系统中心视觉重构 ================= */\r\n/* 加载占位 */\n.pane-load[data-v-1yfhp4q] {\r\n  padding: 28px; text-align: center; margin-bottom: 12px;\r\n  border: 1px dashed var(--border);\r\n  color: var(--text-faint); font-family: var(--font-mono); font-size: 13px;\n}\r\n/* 面板头 */\n.pane-head[data-v-1yfhp4q] {\r\n  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;\r\n  margin: 2px 0 10px; padding-bottom: 8px;\r\n  border-bottom: 1px solid var(--border);\n}\n.pane-title[data-v-1yfhp4q] { font-size: 14px; font-weight: 800;\n}\n.pane-sub[data-v-1yfhp4q] { font-size: 12px; color: var(--text-faint);\n}\r\n/* 统计砖 */\n.stat-row[data-v-1yfhp4q] { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 12px;\n}\n.tile[data-v-1yfhp4q] {\r\n  display: flex; flex-direction: column; gap: 4px;\r\n  padding: 12px 14px;\r\n  border: 1px solid var(--border); background: var(--surface-2);\n}\n.tile .k[data-v-1yfhp4q] { font-size: 11px; color: var(--text-faint); letter-spacing: .5px;\n}\n.tile .v[data-v-1yfhp4q] { font-size: 24px; font-weight: 800; font-family: var(--font-mono); line-height: 1.1;\n}\n.tile .v.txt-sm[data-v-1yfhp4q] { font-size: 14px; font-weight: 700; word-break: break-all;\n}\n.tile-ok[data-v-1yfhp4q] { border-color: var(--success); background: var(--success-soft);\n}\n.tile-warn[data-v-1yfhp4q] { border-color: var(--warning); background: var(--warning-soft);\n}\n.tile-danger[data-v-1yfhp4q] { border-color: var(--danger); background: var(--danger-soft);\n}\n.txt-ok[data-v-1yfhp4q] { color: var(--success);\n}\n.txt-warn[data-v-1yfhp4q] { color: var(--warning);\n}\n.txt-danger[data-v-1yfhp4q] { color: var(--danger);\n}\r\n/* 状态芯片 */\n.chip-ok[data-v-1yfhp4q] { background: var(--success-soft); color: var(--success); border: 1px solid var(--success);\n}\n.chip-warn[data-v-1yfhp4q] { background: var(--warning-soft); color: var(--warning); border: 1px solid var(--warning);\n}\n.chip-err[data-v-1yfhp4q] { background: var(--danger-soft); color: var(--danger); border: 1px solid var(--danger);\n}\n.chip-dim[data-v-1yfhp4q] { background: var(--surface-2); color: var(--text-faint); border: 1px solid var(--border);\n}\n.chip-info[data-v-1yfhp4q] { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent);\n}\r\n/* LED 指示 */\n.led[data-v-1yfhp4q] { width: 8px; height: 8px; flex: none; display: inline-block; background: var(--text-faint);\n}\n.led.on[data-v-1yfhp4q] { background: var(--success);\n}\n.led.bad[data-v-1yfhp4q] { background: var(--danger);\n}\r\n/* 双栏布局 */\n.split2[data-v-1yfhp4q] { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start;\n}\n.panel-box[data-v-1yfhp4q] {\r\n  border: 1px solid var(--border); background: var(--surface-2);\r\n  padding: 10px 12px; max-height: 320px; overflow: auto; white-space: pre-wrap;\n}\r\n/* 服务卡动作行 */\n.svc-actions[data-v-1yfhp4q] { display: flex; align-items: center; gap: 6px; flex-wrap: wrap;\n}\r\n/* 磁盘行卡 */\n.disk-rows[data-v-1yfhp4q] { display: flex; flex-direction: column; gap: 10px;\n}\n.disk-row[data-v-1yfhp4q] { border: 1px solid var(--border); background: var(--surface-2); padding: 10px 12px;\n}\n.disk-row-top[data-v-1yfhp4q] { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;\n}\n.disk-mount[data-v-1yfhp4q] { font-weight: 700; min-width: 110px;\n}\n.disk-row-sub[data-v-1yfhp4q] { font-size: 11px; margin-top: 5px;\n}\r\n/* 清理 */\n.clean-row[data-v-1yfhp4q] {\r\n  display: flex; align-items: center; gap: 10px;\r\n  padding: 9px 12px; margin-bottom: 6px;\r\n  border: 1px solid var(--border); background: var(--surface-2);\n}\n.top-row[data-v-1yfhp4q] { padding: 8px 10px; margin-bottom: 6px; border: 1px solid var(--border); background: var(--surface-2);\n}\n.top-row-top[data-v-1yfhp4q] { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px;\n}\n.top-row-top span[data-v-1yfhp4q]:first-child { flex: 1;\n}\r\n/* 危险面板 */\n.danger-panel[data-v-1yfhp4q] { border: 1px solid var(--danger); border-left-width: 4px; background: var(--danger-soft); padding: 14px 16px;\n}\r\n/* 健康检查 */\n.check-grid[data-v-1yfhp4q] { display: flex; flex-direction: column; gap: 6px;\n}\n.check-row[data-v-1yfhp4q] {\r\n  display: flex; align-items: center; gap: 10px;\r\n  padding: 9px 12px; font-size: 13px;\r\n  border: 1px solid var(--border); background: var(--surface-2);\n}\r\n/* 快照芯片 */\n.snap-chips[data-v-1yfhp4q] { display: flex; flex-wrap: wrap; gap: 8px;\n}\n.snap-chip[data-v-1yfhp4q] { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\r\n/* 用户头像块 */\n.avatar[data-v-1yfhp4q] {\r\n  display: inline-flex; width: 22px; height: 22px; margin-right: 8px;\r\n  align-items: center; justify-content: center;\r\n  background: var(--accent-soft); color: var(--accent);\r\n  font-weight: 700; font-size: 12px; vertical-align: middle;\n}\n@media (max-width: 1000px) {\n.split2[data-v-1yfhp4q] { grid-template-columns: 1fr;\n}\n}\r\n";
    document.head.appendChild(el);
  })();

  // extensions/syscenter/frontend/extension.js
  window.__rcExt__ = window.__rcExt__ || {};
  window.__rcExt__.syscenter = {
    mount: function(el) {
      var app = import_vue15.default.createApp(SysFuncMain_default);
      app.mount(el);
      return function() {
        try {
          app.unmount();
        } catch (e) {
        }
      };
    }
  };
})();
