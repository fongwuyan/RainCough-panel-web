/* RainCough 系统扩展产物 · tasks · 由 tools/build-extension.js 生成 */
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

  // extensions/tasks/frontend/extension.js
  var import_vue3 = __toESM(require_vue());

  // extensions/tasks/frontend/TaskQueue.vue
  var import_vue = __toESM(require_vue());
  var import_vue2 = __toESM(require_vue());
  var import_rc_api = __toESM(require_rc_api());
  var _hoisted_1 = { class: "page" };
  var _hoisted_2 = { class: "page-header" };
  var _hoisted_3 = { class: "header-actions" };
  var _hoisted_4 = ["disabled"];
  var _hoisted_5 = ["disabled"];
  var _hoisted_6 = { class: "stat-row" };
  var _hoisted_7 = { class: "stat-card" };
  var _hoisted_8 = { class: "stat-num accent" };
  var _hoisted_9 = { class: "stat-card" };
  var _hoisted_10 = { class: "stat-num" };
  var _hoisted_11 = { class: "stat-card" };
  var _hoisted_12 = { class: "stat-num warn" };
  var _hoisted_13 = { class: "stat-card" };
  var _hoisted_14 = { class: "stat-num muted" };
  var _hoisted_15 = { class: "stat-card" };
  var _hoisted_16 = { class: "stat-num" };
  var _hoisted_17 = { class: "filter-bar" };
  var _hoisted_18 = ["title", "onClick"];
  var _hoisted_19 = {
    key: 0,
    class: "alert-err"
  };
  var _hoisted_20 = {
    key: 1,
    class: "alert-ok"
  };
  var _hoisted_21 = {
    key: 2,
    class: "hint"
  };
  var _hoisted_22 = {
    key: 3,
    class: "hint"
  };
  var _hoisted_23 = {
    key: 4,
    class: "task-grid"
  };
  var _hoisted_24 = { class: "task-head" };
  var _hoisted_25 = { class: "task-source" };
  var _hoisted_26 = { class: "task-name" };
  var _hoisted_27 = {
    key: 0,
    class: "task-phase"
  };
  var _hoisted_28 = {
    key: 1,
    class: "task-error"
  };
  var _hoisted_29 = {
    key: 2,
    class: "task-msg"
  };
  var _hoisted_30 = {
    key: 3,
    class: "task-msg"
  };
  var _hoisted_31 = {
    key: 4,
    class: "task-progress"
  };
  var _hoisted_32 = { class: "progress" };
  var _hoisted_33 = { class: "progress-num" };
  var _hoisted_34 = { class: "task-foot" };
  var _hoisted_35 = { class: "task-time" };
  var LIMIT = 300;
  var __sfc_main = {
    __name: "TaskQueue",
    setup(__props) {
      const tasks = (0, import_vue2.ref)([]);
      const stats = (0, import_vue2.ref)({ total: 0, running: 0, queued: 0, failed: 0, done: 0 });
      const loading = (0, import_vue2.ref)(false);
      const error = (0, import_vue2.ref)("");
      const notice = (0, import_vue2.ref)("");
      const busy = (0, import_vue2.ref)(false);
      const includeDone = (0, import_vue2.ref)(true);
      const filter = (0, import_vue2.ref)("all");
      const search = (0, import_vue2.ref)("");
      let pollTimer = null;
      let noticeTimer = null;
      let lastSig = "";
      let pending = false;
      function taskSig(d) {
        const list = d.tasks || [];
        let s = "";
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          s += t.id + "|" + t.status + "|" + t.progress + "|" + (t.message || "") + "|" + (t.error || "") + "|" + (t.phase || "") + "\n";
        }
        return s;
      }
      async function load() {
        if (pending) return;
        pending = true;
        if (!tasks.value.length) loading.value = true;
        try {
          const d = await import_rc_api.api.taskQueue(includeDone.value, LIMIT);
          error.value = "";
          const sig = taskSig(d);
          if (sig !== lastSig) {
            lastSig = sig;
            tasks.value = d.tasks || [];
            stats.value = d;
          }
        } catch (err) {
          error.value = err && err.message || String(err);
        } finally {
          pending = false;
          loading.value = false;
        }
      }
      function refresh() {
        lastSig = "";
        return load();
      }
      function toggleDone() {
        includeDone.value = !includeDone.value;
        lastSig = "";
        load();
      }
      function setNotice(msg) {
        notice.value = msg;
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => {
          notice.value = "";
        }, 4e3);
      }
      async function purgeDone() {
        if (busy.value) return;
        busy.value = true;
        try {
          const d = await import_rc_api.api.taskQueuePurge();
          setNotice(`已清理 ${d.removed || 0} 条已完成与失败任务`);
          lastSig = "";
          await load();
        } catch (err) {
          error.value = err && err.message || String(err);
        } finally {
          busy.value = false;
        }
      }
      function schedulePoll() {
        if (pollTimer) return;
        pollTimer = setInterval(() => {
          if (!document.hidden) load();
        }, 3e3);
      }
      function pausePoll() {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      function onVis() {
        if (document.hidden) return;
        load();
        schedulePoll();
      }
      (0, import_vue2.onMounted)(() => {
        load();
        schedulePoll();
        document.addEventListener("visibilitychange", onVis);
      });
      (0, import_vue2.onBeforeUnmount)(() => {
        pausePoll();
        if (noticeTimer) clearTimeout(noticeTimer);
        document.removeEventListener("visibilitychange", onVis);
      });
      const FILTERS = [
        { key: "all", label: "全部", desc: "所有任务" },
        { key: "running", label: "进行中", desc: "运行中 / 排队中" },
        { key: "download", label: "下载安装", desc: "下载 / 安装 / 拉取" },
        { key: "generate", label: "生成", desc: "生图 / 重绘 / 文生皮肤" },
        { key: "batch", label: "批量 / 调度", desc: "批量下载 / 定时任务" },
        { key: "backup", label: "备份", desc: "备份与恢复任务" },
        { key: "failed", label: "失败", desc: "出错 / 中断" }
      ];
      const SOURCE_LABEL = {
        store: "插件市场",
        backup: "备份",
        envpkg: "环境包",
        "mcserver-core": "MC 服务器",
        aigen: "AI 生图",
        "mcskin-paint": "图片转皮肤",
        "mcskin-text2skin": "文生皮肤",
        jmcomic: "JMComic",
        scheduler: "定时任务",
        docker: "Docker",
        yulotool: "工具箱",
        plugins: "插件安装"
      };
      const KIND_LABEL = {
        download: "下载",
        install: "安装",
        generate: "生图",
        repaint: "重绘",
        batch: "批量",
        schedule: "定时",
        process: "任务",
        backup: "备份",
        upload: "上传",
        shell: "命令"
      };
      const STATUS_LABEL = {
        queued: "排队中",
        running: "运行中",
        downloading: "下载中",
        collecting: "收集中",
        loading: "加载中",
        idle: "空闲",
        done: "已完成",
        error: "失败",
        cancelled: "已取消",
        interrupted: "中断",
        skipped: "跳过",
        failed: "失败"
      };
      function statusClass(s) {
        if (["running", "downloading", "collecting", "loading"].includes(s)) return "ok";
        if (["error", "failed", "interrupted"].includes(s)) return "err";
        if (["done", "cancelled", "skipped"].includes(s)) return "muted";
        return "status";
      }
      function matchesFilter(t, key) {
        if (key === "running") return ["running", "downloading", "collecting", "loading", "queued", "idle"].includes(t.status);
        if (key === "download") return ["download", "install"].includes(t.kind);
        if (key === "generate") return ["generate", "repaint"].includes(t.kind);
        if (key === "batch") return ["batch", "schedule"].includes(t.kind);
        if (key === "backup") return t.kind === "backup" || t.source === "backup";
        if (key === "failed") return ["error", "failed", "interrupted"].includes(t.status);
        return true;
      }
      const filterCounts = (0, import_vue2.computed)(() => {
        const m = {};
        for (const f of FILTERS) m[f.key] = tasks.value.filter((t) => matchesFilter(t, f.key)).length;
        return m;
      });
      const filtered = (0, import_vue2.computed)(() => {
        let out = tasks.value.filter((t) => matchesFilter(t, filter.value));
        const q = search.value.trim().toLowerCase();
        if (q) {
          out = out.filter((t) => (t.name || "").toLowerCase().includes(q) || (SOURCE_LABEL[t.source] || t.source || "").toLowerCase().includes(q) || (t.phase || "").toLowerCase().includes(q) || (t.message || "").toLowerCase().includes(q) || (t.error || "").toLowerCase().includes(q));
        }
        return out;
      });
      const emptyText = (0, import_vue2.computed)(() => {
        return search.value.trim() || filter.value !== "all" ? "没有匹配的任务" : "暂无任务";
      });
      function timeAgo(ts) {
        if (!ts) return "";
        const s = Math.max(0, Math.floor(Date.now() / 1e3 - ts));
        if (s < 60) return s + " 秒前";
        if (s < 3600) return Math.floor(s / 60) + " 分钟前";
        return Math.floor(s / 3600) + " 小时前";
      }
      return (_ctx, _cache) => {
        return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_1, [
          (0, import_vue.createElementVNode)("div", _hoisted_2, [
            _cache[4] || (_cache[4] = (0, import_vue.createElementVNode)(
              "div",
              null,
              [
                (0, import_vue.createElementVNode)("h1", null, "任务队列"),
                (0, import_vue.createElementVNode)("p", { class: "page-sub" }, "汇总所有插件与系统级功能的下载、安装、备份与生成任务")
              ],
              -1
              /* CACHED */
            )),
            (0, import_vue.createElementVNode)("div", _hoisted_3, [
              (0, import_vue.createElementVNode)(
                "button",
                {
                  class: "btn",
                  onClick: toggleDone
                },
                (0, import_vue.toDisplayString)(includeDone.value ? "只看进行中" : "显示全部"),
                1
                /* TEXT */
              ),
              (0, import_vue.createElementVNode)("button", {
                class: "btn",
                disabled: busy.value,
                onClick: _cache[0] || (_cache[0] = ($event) => purgeDone())
              }, "清理已完成与失败", 8, _hoisted_4),
              (0, import_vue.createElementVNode)("button", {
                class: "btn",
                disabled: busy.value || loading.value,
                onClick: _cache[1] || (_cache[1] = ($event) => refresh())
              }, "刷新", 8, _hoisted_5)
            ])
          ]),
          (0, import_vue.createElementVNode)("div", _hoisted_6, [
            (0, import_vue.createElementVNode)("div", _hoisted_7, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_8,
                (0, import_vue.toDisplayString)(stats.value.running || 0),
                1
                /* TEXT */
              ),
              _cache[5] || (_cache[5] = (0, import_vue.createElementVNode)(
                "div",
                { class: "stat-label" },
                "进行中",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue.createElementVNode)("div", _hoisted_9, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_10,
                (0, import_vue.toDisplayString)(stats.value.queued || 0),
                1
                /* TEXT */
              ),
              _cache[6] || (_cache[6] = (0, import_vue.createElementVNode)(
                "div",
                { class: "stat-label" },
                "排队中",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue.createElementVNode)("div", _hoisted_11, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_12,
                (0, import_vue.toDisplayString)(stats.value.failed || 0),
                1
                /* TEXT */
              ),
              _cache[7] || (_cache[7] = (0, import_vue.createElementVNode)(
                "div",
                { class: "stat-label" },
                "失败",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue.createElementVNode)("div", _hoisted_13, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_14,
                (0, import_vue.toDisplayString)(stats.value.done || 0),
                1
                /* TEXT */
              ),
              _cache[8] || (_cache[8] = (0, import_vue.createElementVNode)(
                "div",
                { class: "stat-label" },
                "已完成",
                -1
                /* CACHED */
              ))
            ]),
            (0, import_vue.createElementVNode)("div", _hoisted_15, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_16,
                (0, import_vue.toDisplayString)(stats.value.total || 0),
                1
                /* TEXT */
              ),
              _cache[9] || (_cache[9] = (0, import_vue.createElementVNode)(
                "div",
                { class: "stat-label" },
                "总计",
                -1
                /* CACHED */
              ))
            ])
          ]),
          (0, import_vue.createElementVNode)("div", _hoisted_17, [
            ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
              import_vue.Fragment,
              null,
              (0, import_vue.renderList)(FILTERS, (f) => {
                return (0, import_vue.createElementVNode)("div", {
                  key: f.key,
                  class: (0, import_vue.normalizeClass)(["filter-chip", { active: filter.value === f.key }]),
                  title: f.desc,
                  onClick: ($event) => filter.value = f.key
                }, (0, import_vue.toDisplayString)(f.label) + " (" + (0, import_vue.toDisplayString)(filterCounts.value[f.key]) + ") ", 11, _hoisted_18);
              }),
              64
              /* STABLE_FRAGMENT */
            )),
            (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
              "input",
              {
                "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => search.value = $event),
                class: "input search-input",
                placeholder: "搜索任务名 / 来源 / 说明"
              },
              null,
              512
              /* NEED_PATCH */
            ), [
              [import_vue.vModelText, search.value]
            ])
          ]),
          error.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_19, [
            (0, import_vue.createTextVNode)(
              " 刷新失败：" + (0, import_vue.toDisplayString)(error.value) + " ",
              1
              /* TEXT */
            ),
            (0, import_vue.createElementVNode)("button", {
              class: "alert-x",
              onClick: _cache[3] || (_cache[3] = ($event) => error.value = "")
            }, "关闭")
          ])) : (0, import_vue.createCommentVNode)("v-if", true),
          notice.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
            "div",
            _hoisted_20,
            (0, import_vue.toDisplayString)(notice.value),
            1
            /* TEXT */
          )) : (0, import_vue.createCommentVNode)("v-if", true),
          loading.value && !tasks.value.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_21, "加载中...")) : !filtered.value.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
            "div",
            _hoisted_22,
            (0, import_vue.toDisplayString)(emptyText.value),
            1
            /* TEXT */
          )) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_23, [
            ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
              import_vue.Fragment,
              null,
              (0, import_vue.renderList)(filtered.value, (t, idx) => {
                return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", {
                  key: t.source + "-" + t.id + "-" + idx,
                  class: "task-card"
                }, [
                  (0, import_vue.createElementVNode)("div", _hoisted_24, [
                    (0, import_vue.createElementVNode)(
                      "div",
                      {
                        class: (0, import_vue.normalizeClass)(["task-badge", "kind-" + t.kind])
                      },
                      (0, import_vue.toDisplayString)(KIND_LABEL[t.kind] || t.kind || "任务"),
                      3
                      /* TEXT, CLASS */
                    ),
                    (0, import_vue.createElementVNode)(
                      "div",
                      _hoisted_25,
                      (0, import_vue.toDisplayString)(SOURCE_LABEL[t.source] || t.source),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue.createElementVNode)(
                      "div",
                      {
                        class: (0, import_vue.normalizeClass)(["task-status", "badge-tag " + statusClass(t.status)])
                      },
                      (0, import_vue.toDisplayString)(STATUS_LABEL[t.status] || t.status),
                      3
                      /* TEXT, CLASS */
                    )
                  ]),
                  (0, import_vue.createElementVNode)(
                    "div",
                    _hoisted_26,
                    (0, import_vue.toDisplayString)(t.name || "未命名任务"),
                    1
                    /* TEXT */
                  ),
                  t.phase ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    _hoisted_27,
                    "阶段：" + (0, import_vue.toDisplayString)(t.phase),
                    1
                    /* TEXT */
                  )) : (0, import_vue.createCommentVNode)("v-if", true),
                  t.error ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    _hoisted_28,
                    "错误：" + (0, import_vue.toDisplayString)(t.error),
                    1
                    /* TEXT */
                  )) : (0, import_vue.createCommentVNode)("v-if", true),
                  t.message && t.message !== t.error ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    _hoisted_29,
                    (0, import_vue.toDisplayString)(t.message),
                    1
                    /* TEXT */
                  )) : (0, import_vue.createCommentVNode)("v-if", true),
                  t.meta && t.meta.target ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    _hoisted_30,
                    "目标：" + (0, import_vue.toDisplayString)(t.meta.target),
                    1
                    /* TEXT */
                  )) : (0, import_vue.createCommentVNode)("v-if", true),
                  t.status === "running" || t.status === "queued" || t.progress > 0 ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_31, [
                    (0, import_vue.createElementVNode)("div", _hoisted_32, [
                      (0, import_vue.createElementVNode)(
                        "div",
                        {
                          style: (0, import_vue.normalizeStyle)({ width: Math.min(100, t.progress || 0) + "%" })
                        },
                        null,
                        4
                        /* STYLE */
                      )
                    ]),
                    (0, import_vue.createElementVNode)(
                      "div",
                      _hoisted_33,
                      (0, import_vue.toDisplayString)(Math.min(100, Math.round(t.progress || 0))) + "%",
                      1
                      /* TEXT */
                    )
                  ])) : (0, import_vue.createCommentVNode)("v-if", true),
                  (0, import_vue.createElementVNode)("div", _hoisted_34, [
                    (0, import_vue.createElementVNode)(
                      "span",
                      _hoisted_35,
                      (0, import_vue.toDisplayString)(timeAgo(t.created)),
                      1
                      /* TEXT */
                    )
                  ])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]))
        ]);
      };
    }
  };
  __sfc_main.__scopeId = "data-v-1d1ktjz";
  var TaskQueue_default = __sfc_main;
  (function() {
    var key = "rc-ext-css-data-v-1d1ktjz-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.page-header[data-v-1d1ktjz] { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; flex-wrap: wrap;\n}\n.page-sub[data-v-1d1ktjz] { color: var(--border-strong); font-size: 13px; margin-top: 4px;\n}\n.header-actions[data-v-1d1ktjz] { display: flex; gap: 8px; flex-wrap: wrap;\n}\n.stat-row[data-v-1d1ktjz] { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px;\n}\n.stat-card[data-v-1d1ktjz] { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px;\n}\n.stat-num[data-v-1d1ktjz] { font-size: 26px; font-weight: 700;\n}\n.stat-num.accent[data-v-1d1ktjz] { color: var(--accent);\n}\n.stat-num.warn[data-v-1d1ktjz] { color: #f0b429;\n}\n.stat-num.muted[data-v-1d1ktjz] { color: var(--border-strong);\n}\n.stat-label[data-v-1d1ktjz] { font-size: 12px; color: var(--border-strong); margin-top: 2px;\n}\n.filter-bar[data-v-1d1ktjz] { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px;\n}\n.filter-chip[data-v-1d1ktjz] { padding: 6px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; color: var(--border-strong); user-select: none;\n}\n.filter-chip[data-v-1d1ktjz]:hover { border-color: var(--border-strong);\n}\n.filter-chip.active[data-v-1d1ktjz] { background: var(--accent); border-color: var(--accent); color: #fff;\n}\n.search-input[data-v-1d1ktjz] { max-width: 260px; margin-left: auto;\n}\n.alert-err[data-v-1d1ktjz] { border: 1px solid rgba(248, 81, 73, 0.45); background: rgba(248, 81, 73, 0.1); color: #ff7b72; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; justify-content: space-between; word-break: break-all;\n}\n.alert-ok[data-v-1d1ktjz] { border: 1px solid rgba(63, 185, 80, 0.4); background: rgba(63, 185, 80, 0.1); color: #3fb950; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 10px;\n}\n.alert-x[data-v-1d1ktjz] { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 12px; text-decoration: underline; flex-shrink: 0;\n}\n.task-grid[data-v-1d1ktjz] { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;\n}\n.task-card[data-v-1d1ktjz] { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px;\n}\n.task-head[data-v-1d1ktjz] { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;\n}\n.task-badge[data-v-1d1ktjz] { font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); flex-shrink: 0;\n}\n.task-badge.kind-download[data-v-1d1ktjz] { background: rgba(63, 185, 80, 0.15); color: #3fb950;\n}\n.task-badge.kind-install[data-v-1d1ktjz] { background: rgba(109, 92, 255, 0.15); color: var(--accent);\n}\n.task-badge.kind-generate[data-v-1d1ktjz] { background: rgba(240, 180, 41, 0.15); color: #f0b429;\n}\n.task-badge.kind-repaint[data-v-1d1ktjz] { background: rgba(163, 113, 247, 0.15); color: #a371f7;\n}\n.task-badge.kind-batch[data-v-1d1ktjz], .task-badge.kind-schedule[data-v-1d1ktjz] { background: rgba(88, 166, 255, 0.15); color: #58a6ff;\n}\n.task-badge.kind-backup[data-v-1d1ktjz] { background: rgba(210, 153, 34, 0.15); color: #d29922;\n}\n.task-source[data-v-1d1ktjz] { font-size: 12px; color: var(--border-strong); margin-right: auto;\n}\n.task-status[data-v-1d1ktjz] { font-size: 11px; flex-shrink: 0;\n}\n.task-name[data-v-1d1ktjz] { font-size: 15px; font-weight: 600; margin-bottom: 4px; word-break: break-all;\n}\n.task-phase[data-v-1d1ktjz] { font-size: 12px; color: var(--border-strong); margin-bottom: 4px; word-break: break-all;\n}\n.task-error[data-v-1d1ktjz] { font-size: 12px; color: #f0b429; margin-bottom: 4px; word-break: break-all;\n}\n.task-msg[data-v-1d1ktjz] { font-size: 12px; color: var(--border-strong); margin-bottom: 4px; word-break: break-all;\n}\n.task-progress[data-v-1d1ktjz] { display: flex; align-items: center; gap: 8px; margin: 8px 0 6px;\n}\n.task-progress .progress[data-v-1d1ktjz] { flex: 1;\n}\n.progress-num[data-v-1d1ktjz] { font-size: 12px; color: var(--border-strong); min-width: 36px; text-align: right;\n}\n.task-foot[data-v-1d1ktjz] { display: flex; justify-content: space-between; align-items: center;\n}\n.task-time[data-v-1d1ktjz] { font-size: 11px; color: var(--border-strong);\n}\n@media (max-width: 960px) {\n.page-header[data-v-1d1ktjz] { flex-direction: column;\n}\n.header-actions[data-v-1d1ktjz] { width: 100%;\n}\n.task-grid[data-v-1d1ktjz] { grid-template-columns: 1fr;\n}\n.search-input[data-v-1d1ktjz] { max-width: none; margin-left: 0; width: 100%;\n}\n}\n";
    document.head.appendChild(el);
  })();

  // extensions/tasks/frontend/extension.js
  window.__rcExt__ = window.__rcExt__ || {};
  window.__rcExt__.tasks = {
    mount: function(el) {
      var app = import_vue3.default.createApp(TaskQueue_default);
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
