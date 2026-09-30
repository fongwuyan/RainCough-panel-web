/* RainCough 系统扩展产物 · scheduler · 由 tools/build-extension.js 生成 */
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

  // extensions/scheduler/frontend/extension.js
  var import_vue3 = __toESM(require_vue());

  // extensions/scheduler/frontend/Scheduler.vue
  var import_vue = __toESM(require_vue());
  var import_vue2 = __toESM(require_vue());
  var import_rc_api = __toESM(require_rc_api());
  var _hoisted_1 = { class: "page" };
  var _hoisted_2 = { class: "page-head" };
  var _hoisted_3 = { class: "stats-row" };
  var _hoisted_4 = { class: "stat-num" };
  var _hoisted_5 = {
    class: "stat-num",
    style: { "color": "var(--success)" }
  };
  var _hoisted_6 = {
    class: "stat-num",
    style: { "color": "var(--text-muted)" }
  };
  var _hoisted_7 = {
    class: "stat-num",
    style: { "color": "var(--danger)" }
  };
  var _hoisted_8 = { class: "toolbar" };
  var _hoisted_9 = { class: "filter-tabs" };
  var _hoisted_10 = { class: "toolbar-right" };
  var _hoisted_11 = ["value"];
  var _hoisted_12 = { class: "page-body" };
  var _hoisted_13 = {
    key: 0,
    class: "loading"
  };
  var _hoisted_14 = {
    key: 1,
    class: "empty"
  };
  var _hoisted_15 = { key: 2 };
  var _hoisted_16 = { class: "job-main" };
  var _hoisted_17 = { class: "job-title" };
  var _hoisted_18 = { class: "job-name" };
  var _hoisted_19 = { class: "act-tag" };
  var _hoisted_20 = { class: "job-meta" };
  var _hoisted_21 = { class: "meta-item" };
  var _hoisted_22 = { class: "meta-item" };
  var _hoisted_23 = { class: "meta-item" };
  var _hoisted_24 = { key: 0 };
  var _hoisted_25 = { key: 0 };
  var _hoisted_26 = {
    key: 0,
    class: "job-params mono"
  };
  var _hoisted_27 = {
    key: 1,
    class: "job-err mono"
  };
  var _hoisted_28 = {
    key: 2,
    class: "history-block"
  };
  var _hoisted_29 = ["onClick"];
  var _hoisted_30 = { class: "caret" };
  var _hoisted_31 = {
    key: 0,
    class: "history-list"
  };
  var _hoisted_32 = { class: "h-time" };
  var _hoisted_33 = {
    key: 0,
    class: "h-dur"
  };
  var _hoisted_34 = ["title"];
  var _hoisted_35 = { class: "job-ops" };
  var _hoisted_36 = ["disabled", "onClick"];
  var _hoisted_37 = ["onClick"];
  var _hoisted_38 = ["onClick"];
  var _hoisted_39 = ["onClick"];
  var _hoisted_40 = { class: "modal sched-modal" };
  var _hoisted_41 = { class: "sched-modal-header" };
  var _hoisted_42 = { class: "sched-modal-heading" };
  var _hoisted_43 = { class: "sched-modal-body" };
  var _hoisted_44 = { class: "form-section" };
  var _hoisted_45 = { class: "form-grid" };
  var _hoisted_46 = { class: "full" };
  var _hoisted_47 = { class: "full" };
  var _hoisted_48 = ["value"];
  var _hoisted_49 = { class: "form-section" };
  var _hoisted_50 = { class: "trig-switch" };
  var _hoisted_51 = { class: "preset-row" };
  var _hoisted_52 = ["onClick"];
  var _hoisted_53 = { class: "sched-label" };
  var _hoisted_54 = { class: "cron-grid" };
  var _hoisted_55 = { class: "cron-preview mono" };
  var _hoisted_56 = { class: "form-section" };
  var _hoisted_57 = { class: "form-grid" };
  var _hoisted_58 = { class: "full" };
  var _hoisted_59 = {
    key: 1,
    class: "full"
  };
  var _hoisted_60 = { class: "full" };
  var _hoisted_61 = { class: "full" };
  var _hoisted_62 = { class: "sched-modal-footer" };
  var _hoisted_63 = {
    key: 0,
    class: "form-err"
  };
  var _hoisted_64 = { class: "form-ops" };
  var __sfc_main = {
    __name: "Scheduler",
    setup(__props) {
      const jobs = (0, import_vue2.ref)([]);
      const actions = (0, import_vue2.ref)([]);
      const error = (0, import_vue2.ref)("");
      const loading = (0, import_vue2.ref)(false);
      const showForm = (0, import_vue2.ref)(false);
      const editingId = (0, import_vue2.ref)(null);
      const filter = (0, import_vue2.ref)("all");
      const actionFilter = (0, import_vue2.ref)("");
      const search = (0, import_vue2.ref)("");
      const now = (0, import_vue2.ref)(Date.now());
      let clock = null;
      let refresher = null;
      const ACT_META = {
        gen_img: { color: "var(--accent)" },
        grab_setu: { color: "var(--success)" },
        rebuild_library: { color: "var(--warning)" },
        clean_tmp: { color: "var(--text-muted)" },
        shell: { color: "var(--text-muted)" }
      };
      const form = (0, import_vue2.reactive)({
        name: "",
        action: "gen_img",
        trigger: "interval",
        interval: 3600,
        minute: "0",
        hour: "*",
        day: "*",
        month: "*",
        day_of_week: "*",
        params: {}
      });
      const filtered = (0, import_vue2.computed)(() => {
        let list = jobs.value;
        if (actionFilter.value) list = list.filter((j) => j.action === actionFilter.value);
        if (search.value.trim()) {
          const q = search.value.trim().toLowerCase();
          list = list.filter((j) => j.name.toLowerCase().includes(q));
        }
        switch (filter.value) {
          case "running":
            list = list.filter((j) => !j.paused);
            break;
          case "paused":
            list = list.filter((j) => j.paused);
            break;
          case "failed":
            list = list.filter((j) => j.last && j.last.status === "error");
            break;
        }
        return list;
      });
      const stats = (0, import_vue2.computed)(() => {
        const s = { total: jobs.value.length, running: 0, paused: 0, failed: 0 };
        for (const j of jobs.value) {
          if (j.paused) s.paused++;
          else s.running++;
          if (j.last && j.last.status === "error") s.failed++;
        }
        return s;
      });
      function fmtTime(ts) {
        if (!ts) return "-";
        return new Date(ts * 1e3).toLocaleString();
      }
      function relTime(ts) {
        if (!ts) return "—";
        const diff = Math.floor((now.value - ts * 1e3) / 1e3);
        if (diff < 0) return fmtTime(ts);
        if (diff < 60) return `${diff} 秒前`;
        if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
        return `${Math.floor(diff / 86400)} 天前`;
      }
      function countdown(ts) {
        if (!ts) return "—";
        const diff = Math.floor((ts * 1e3 - now.value) / 1e3);
        if (diff < 0) return "即将执行";
        if (diff < 60) return `${diff} 秒后`;
        if (diff < 3600) return `${Math.floor(diff / 60)} 分钟 ${diff % 60} 秒后`;
        const h = Math.floor(diff / 3600);
        const m = Math.floor(diff % 3600 / 60);
        return `${h} 小时 ${m} 分后`;
      }
      function fmtInterval(sec) {
        sec = Number(sec) || 0;
        if (sec >= 86400 && sec % 86400 === 0) return `每 ${sec / 86400} 天`;
        if (sec >= 3600 && sec % 3600 === 0) return `每 ${sec / 3600} 小时`;
        if (sec >= 60 && sec % 60 === 0) return `每 ${sec / 60} 分钟`;
        return `每 ${sec} 秒`;
      }
      const DOW = ["日", "一", "二", "三", "四", "五", "六"];
      function fmtCron(job) {
        const { minute, hour, day, month, day_of_week } = job;
        if (day === "*" && month === "*" && day_of_week === "*") {
          if (minute === "*") return "每分钟";
          if (hour === "*") return `每小时 ${minute} 分`;
          return `每天 ${hour}:${String(minute).padStart(2, "0")}`;
        }
        if (day === "*" && month === "*" && day_of_week !== "*") {
          const days = day_of_week.split(",").map((d) => DOW[Number(d) % 7]).join("、");
          return `每周 ${days} ${hour}:${String(minute).padStart(2, "0")}`;
        }
        if (day_of_week === "*" && month === "*" && day !== "*") {
          return `每月 ${day} 日 ${hour}:${String(minute).padStart(2, "0")}`;
        }
        return `Cron: ${minute} ${hour} ${day} ${month} ${day_of_week}`;
      }
      function scheduleText(job) {
        return job.trigger === "interval" ? fmtInterval(job.interval) : fmtCron(job);
      }
      function actionLabel(key) {
        const a = actions.value.find((x) => x.key === key);
        return a ? a.label : key;
      }
      function paramsSummary(job) {
        const p = job.params || {};
        switch (job.action) {
          case "gen_img":
            return p.prompt ? `提示词: ${p.prompt}` : p.width ? `${p.width}×${p.height} ×${p.count || 1} 张` : "默认参数";
          case "grab_setu":
            return p.tag ? `标签: ${p.tag}` : "随机抓取";
          case "clean_tmp":
            return p.dir ? `清理 ${p.dir}（保留 ${p.days || 3} 天）` : "清理默认目录";
          case "shell":
            return p.command ? `命令: ${p.command}` : "未设置命令";
          case "rebuild_library":
            return "重建媒体库索引";
          default:
            return "";
        }
      }
      async function load() {
        loading.value = true;
        try {
          const d = await import_rc_api.api.schedJobs();
          jobs.value = d.jobs || [];
          error.value = "";
        } catch (e) {
          error.value = e.message || "加载失败";
        } finally {
          loading.value = false;
        }
      }
      function openCreate() {
        editingId.value = null;
        Object.assign(form, {
          name: "",
          action: "gen_img",
          trigger: "interval",
          interval: 3600,
          minute: "0",
          hour: "*",
          day: "*",
          month: "*",
          day_of_week: "*",
          params: {}
        });
        showForm.value = true;
      }
      function openEdit(job) {
        editingId.value = job.id;
        Object.assign(form, {
          name: job.name,
          action: job.action,
          trigger: job.trigger,
          interval: job.interval || 3600,
          minute: job.minute || "0",
          hour: job.hour || "*",
          day: job.day || "*",
          month: job.month || "*",
          day_of_week: job.day_of_week || "*",
          params: JSON.parse(JSON.stringify(job.params || {}))
        });
        showForm.value = true;
      }
      function setIntervalPreset(sec) {
        form.interval = sec;
      }
      async function save() {
        error.value = "";
        if (!form.name.trim()) {
          error.value = "请填写任务名称";
          return;
        }
        try {
          const payload = {
            name: form.name.trim(),
            action: form.action,
            trigger: form.trigger,
            params: form.params
          };
          if (form.trigger === "interval") {
            payload.interval = form.interval;
          } else {
            payload.minute = form.minute || "*";
            payload.hour = form.hour || "*";
            payload.day = form.day || "*";
            payload.month = form.month || "*";
            payload.day_of_week = form.day_of_week || "*";
          }
          if (editingId.value) {
            await import_rc_api.api.schedUpdate(editingId.value, payload);
          } else {
            await import_rc_api.api.schedCreate(payload);
          }
          showForm.value = false;
          load();
        } catch (e) {
          error.value = e.message || "保存失败";
        }
      }
      async function doDelete(job) {
        if (!window.confirm(`确定删除任务「${job.name}」？`)) return;
        try {
          await import_rc_api.api.schedDelete(job.id);
          load();
        } catch (e) {
          error.value = e.message || "删除失败";
        }
      }
      async function togglePause(job) {
        try {
          if (job.paused) await import_rc_api.api.schedResume(job.id);
          else await import_rc_api.api.schedPause(job.id);
          load();
        } catch (e) {
          error.value = e.message || "操作失败";
        }
      }
      async function runNow(job) {
        try {
          await import_rc_api.api.schedRun(job.id);
          load();
        } catch (e) {
          error.value = e.message || "触发失败";
        }
      }
      (0, import_vue2.onMounted)(async () => {
        try {
          const d = await import_rc_api.api.schedActions();
          actions.value = d.actions || [];
        } catch (e) {
          error.value = e.message;
        }
        load();
        clock = setInterval(() => {
          now.value = Date.now();
        }, 1e3);
        refresher = setInterval(load, 15e3);
      });
      (0, import_vue2.onUnmounted)(() => {
        if (clock) clearInterval(clock);
        if (refresher) clearInterval(refresher);
      });
      return (_ctx, _cache) => {
        return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_1, [
          (0, import_vue.createElementVNode)("div", _hoisted_2, [
            _cache[38] || (_cache[38] = (0, import_vue.createElementVNode)(
              "h1",
              null,
              "定时任务",
              -1
              /* CACHED */
            )),
            _cache[39] || (_cache[39] = (0, import_vue.createElementVNode)(
              "div",
              { class: "subtitle" },
              "APScheduler 定时执行 —— 生图 / 抓涩图 / 重建索引 / 清理 / 命令",
              -1
              /* CACHED */
            )),
            (0, import_vue.createElementVNode)("div", _hoisted_3, [
              (0, import_vue.createElementVNode)("div", {
                class: "stat",
                onClick: _cache[0] || (_cache[0] = ($event) => filter.value = "all")
              }, [
                (0, import_vue.createElementVNode)(
                  "div",
                  _hoisted_4,
                  (0, import_vue.toDisplayString)(stats.value.total),
                  1
                  /* TEXT */
                ),
                _cache[33] || (_cache[33] = (0, import_vue.createElementVNode)(
                  "div",
                  { class: "stat-label" },
                  "全部任务",
                  -1
                  /* CACHED */
                ))
              ]),
              (0, import_vue.createElementVNode)("div", {
                class: "stat",
                onClick: _cache[1] || (_cache[1] = ($event) => filter.value = "running")
              }, [
                (0, import_vue.createElementVNode)(
                  "div",
                  _hoisted_5,
                  (0, import_vue.toDisplayString)(stats.value.running),
                  1
                  /* TEXT */
                ),
                _cache[34] || (_cache[34] = (0, import_vue.createElementVNode)(
                  "div",
                  { class: "stat-label" },
                  "运行中",
                  -1
                  /* CACHED */
                ))
              ]),
              (0, import_vue.createElementVNode)("div", {
                class: "stat",
                onClick: _cache[2] || (_cache[2] = ($event) => filter.value = "paused")
              }, [
                (0, import_vue.createElementVNode)(
                  "div",
                  _hoisted_6,
                  (0, import_vue.toDisplayString)(stats.value.paused),
                  1
                  /* TEXT */
                ),
                _cache[35] || (_cache[35] = (0, import_vue.createElementVNode)(
                  "div",
                  { class: "stat-label" },
                  "已暂停",
                  -1
                  /* CACHED */
                ))
              ]),
              (0, import_vue.createElementVNode)("div", {
                class: "stat",
                onClick: _cache[3] || (_cache[3] = ($event) => filter.value = "failed")
              }, [
                (0, import_vue.createElementVNode)(
                  "div",
                  _hoisted_7,
                  (0, import_vue.toDisplayString)(stats.value.failed),
                  1
                  /* TEXT */
                ),
                _cache[36] || (_cache[36] = (0, import_vue.createElementVNode)(
                  "div",
                  { class: "stat-label" },
                  "上次失败",
                  -1
                  /* CACHED */
                ))
              ])
            ]),
            (0, import_vue.createElementVNode)("div", _hoisted_8, [
              (0, import_vue.createElementVNode)("div", _hoisted_9, [
                (0, import_vue.createElementVNode)(
                  "button",
                  {
                    class: (0, import_vue.normalizeClass)(["ftab", { active: filter.value === "all" }]),
                    onClick: _cache[4] || (_cache[4] = ($event) => filter.value = "all")
                  },
                  "全部",
                  2
                  /* CLASS */
                ),
                (0, import_vue.createElementVNode)(
                  "button",
                  {
                    class: (0, import_vue.normalizeClass)(["ftab", { active: filter.value === "running" }]),
                    onClick: _cache[5] || (_cache[5] = ($event) => filter.value = "running")
                  },
                  "运行中",
                  2
                  /* CLASS */
                ),
                (0, import_vue.createElementVNode)(
                  "button",
                  {
                    class: (0, import_vue.normalizeClass)(["ftab", { active: filter.value === "paused" }]),
                    onClick: _cache[6] || (_cache[6] = ($event) => filter.value = "paused")
                  },
                  "已暂停",
                  2
                  /* CLASS */
                ),
                (0, import_vue.createElementVNode)(
                  "button",
                  {
                    class: (0, import_vue.normalizeClass)(["ftab", { active: filter.value === "failed" }]),
                    onClick: _cache[7] || (_cache[7] = ($event) => filter.value = "failed")
                  },
                  "上次失败",
                  2
                  /* CLASS */
                )
              ]),
              (0, import_vue.createElementVNode)("div", _hoisted_10, [
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => search.value = $event),
                    class: "input",
                    style: { "width": "180px" },
                    placeholder: "搜索任务名称…"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelText, search.value]
                ]),
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => actionFilter.value = $event),
                    class: "input",
                    style: { "width": "150px" }
                  },
                  [
                    _cache[37] || (_cache[37] = (0, import_vue.createElementVNode)(
                      "option",
                      { value: "" },
                      "全部动作",
                      -1
                      /* CACHED */
                    )),
                    ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                      import_vue.Fragment,
                      null,
                      (0, import_vue.renderList)(actions.value, (a) => {
                        return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("option", {
                          key: a.key,
                          value: a.key
                        }, (0, import_vue.toDisplayString)(a.label), 9, _hoisted_11);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelSelect, actionFilter.value]
                ]),
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm",
                  onClick: load
                }, "刷新"),
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm btn-primary",
                  onClick: openCreate
                }, "+ 新建任务")
              ])
            ])
          ]),
          (0, import_vue.createElementVNode)("div", _hoisted_12, [
            loading.value && !jobs.value.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_13, "加载中…")) : !filtered.value.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_14, "没有匹配的定时任务")) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_15, [
              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                import_vue.Fragment,
                null,
                (0, import_vue.renderList)(filtered.value, (job) => {
                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    {
                      key: job.id,
                      class: (0, import_vue.normalizeClass)(["job-card", { paused: job.paused }])
                    },
                    [
                      (0, import_vue.createElementVNode)("div", _hoisted_16, [
                        (0, import_vue.createElementVNode)("div", _hoisted_17, [
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_18,
                            (0, import_vue.toDisplayString)(job.name),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue.createElementVNode)(
                            "span",
                            {
                              class: (0, import_vue.normalizeClass)(["badge", job.paused ? "badge-off" : "badge-on"])
                            },
                            (0, import_vue.toDisplayString)(job.paused ? "已暂停" : "运行中"),
                            3
                            /* TEXT, CLASS */
                          ),
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_19,
                            (0, import_vue.toDisplayString)(actionLabel(job.action)),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue.createElementVNode)("div", _hoisted_20, [
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_21,
                            (0, import_vue.toDisplayString)(scheduleText(job)),
                            1
                            /* TEXT */
                          ),
                          (0, import_vue.createElementVNode)("span", _hoisted_22, [
                            _cache[40] || (_cache[40] = (0, import_vue.createTextVNode)(
                              "下次执行: ",
                              -1
                              /* CACHED */
                            )),
                            (0, import_vue.createElementVNode)(
                              "b",
                              null,
                              (0, import_vue.toDisplayString)(countdown(job.next_run_time)),
                              1
                              /* TEXT */
                            )
                          ]),
                          (0, import_vue.createElementVNode)("span", _hoisted_23, [
                            _cache[41] || (_cache[41] = (0, import_vue.createTextVNode)(
                              " 上次: ",
                              -1
                              /* CACHED */
                            )),
                            !job.last || !job.last.time ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("span", _hoisted_24, "从未执行")) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                              "span",
                              {
                                key: 1,
                                class: (0, import_vue.normalizeClass)(job.last.status === "ok" ? "ok" : job.last.status === "error" ? "err" : "muted")
                              },
                              (0, import_vue.toDisplayString)(job.last.status === "ok" ? "成功" : job.last.status === "error" ? "失败" : "运行中"),
                              3
                              /* TEXT, CLASS */
                            )),
                            job.last && job.last.time ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                              import_vue.Fragment,
                              { key: 2 },
                              [
                                (0, import_vue.createTextVNode)(
                                  (0, import_vue.toDisplayString)(relTime(job.last.time)),
                                  1
                                  /* TEXT */
                                ),
                                job.last.duration ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                  "span",
                                  _hoisted_25,
                                  "（" + (0, import_vue.toDisplayString)(job.last.duration) + "s）",
                                  1
                                  /* TEXT */
                                )) : (0, import_vue.createCommentVNode)("v-if", true)
                              ],
                              64
                              /* STABLE_FRAGMENT */
                            )) : (0, import_vue.createCommentVNode)("v-if", true)
                          ])
                        ]),
                        paramsSummary(job) ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                          "div",
                          _hoisted_26,
                          (0, import_vue.toDisplayString)(paramsSummary(job)),
                          1
                          /* TEXT */
                        )) : (0, import_vue.createCommentVNode)("v-if", true),
                        job.last && job.last.status === "error" && job.last.message ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                          "div",
                          _hoisted_27,
                          (0, import_vue.toDisplayString)(job.last.message),
                          1
                          /* TEXT */
                        )) : (0, import_vue.createCommentVNode)("v-if", true),
                        job.history && job.history.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_28, [
                          (0, import_vue.createElementVNode)("div", {
                            class: "history-title",
                            onClick: ($event) => job._showHistory = !job._showHistory
                          }, [
                            (0, import_vue.createTextVNode)(
                              " 最近 " + (0, import_vue.toDisplayString)(job.history.length) + " 次执行 ",
                              1
                              /* TEXT */
                            ),
                            (0, import_vue.createElementVNode)(
                              "span",
                              _hoisted_30,
                              (0, import_vue.toDisplayString)(job._showHistory ? "▾" : "▸"),
                              1
                              /* TEXT */
                            )
                          ], 8, _hoisted_29),
                          job._showHistory ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_31, [
                            ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                              import_vue.Fragment,
                              null,
                              (0, import_vue.renderList)(job.history, (r, i) => {
                                return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", {
                                  key: i,
                                  class: "history-row"
                                }, [
                                  (0, import_vue.createElementVNode)(
                                    "span",
                                    {
                                      class: (0, import_vue.normalizeClass)(r.status === "ok" ? "ok" : r.status === "error" ? "err" : "muted")
                                    },
                                    (0, import_vue.toDisplayString)(r.status === "ok" ? "成功" : r.status === "error" ? "失败" : "执行中"),
                                    3
                                    /* TEXT, CLASS */
                                  ),
                                  (0, import_vue.createElementVNode)(
                                    "span",
                                    _hoisted_32,
                                    (0, import_vue.toDisplayString)(fmtTime(r.time)),
                                    1
                                    /* TEXT */
                                  ),
                                  r.duration ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                    "span",
                                    _hoisted_33,
                                    (0, import_vue.toDisplayString)(r.duration) + "s",
                                    1
                                    /* TEXT */
                                  )) : (0, import_vue.createCommentVNode)("v-if", true),
                                  (0, import_vue.createElementVNode)("span", {
                                    class: "h-msg mono",
                                    title: r.message
                                  }, (0, import_vue.toDisplayString)(r.message || "-"), 9, _hoisted_34)
                                ]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ])) : (0, import_vue.createCommentVNode)("v-if", true)
                        ])) : (0, import_vue.createCommentVNode)("v-if", true)
                      ]),
                      (0, import_vue.createElementVNode)("div", _hoisted_35, [
                        (0, import_vue.createElementVNode)("button", {
                          class: "btn btn-sm",
                          disabled: job.paused,
                          onClick: ($event) => runNow(job)
                        }, "立即执行", 8, _hoisted_36),
                        (0, import_vue.createElementVNode)("button", {
                          class: "btn btn-sm",
                          onClick: ($event) => togglePause(job)
                        }, (0, import_vue.toDisplayString)(job.paused ? "恢复" : "暂停"), 9, _hoisted_37),
                        (0, import_vue.createElementVNode)("button", {
                          class: "btn btn-sm",
                          onClick: ($event) => openEdit(job)
                        }, "编辑", 8, _hoisted_38),
                        (0, import_vue.createElementVNode)("button", {
                          class: "btn btn-sm btn-danger",
                          onClick: ($event) => doDelete(job)
                        }, "删除", 8, _hoisted_39)
                      ])
                    ],
                    2
                    /* CLASS */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]))
          ]),
          showForm.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", {
            key: 0,
            class: "overlay",
            onClick: _cache[32] || (_cache[32] = (0, import_vue.withModifiers)(($event) => showForm.value = false, ["self"]))
          }, [
            (0, import_vue.createElementVNode)("div", _hoisted_40, [
              (0, import_vue.createElementVNode)("div", _hoisted_41, [
                (0, import_vue.createElementVNode)(
                  "div",
                  _hoisted_42,
                  (0, import_vue.toDisplayString)(editingId.value ? "编辑任务" : "新建任务"),
                  1
                  /* TEXT */
                ),
                (0, import_vue.createElementVNode)("button", {
                  class: "sched-modal-close",
                  onClick: _cache[10] || (_cache[10] = ($event) => showForm.value = false),
                  title: "关闭"
                }, "✕")
              ]),
              (0, import_vue.createElementVNode)("div", _hoisted_43, [
                (0, import_vue.createElementVNode)("div", _hoisted_44, [
                  _cache[44] || (_cache[44] = (0, import_vue.createElementVNode)(
                    "div",
                    { class: "form-section-title" },
                    "基本信息",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue.createElementVNode)("div", _hoisted_45, [
                    (0, import_vue.createElementVNode)("label", _hoisted_46, [
                      _cache[42] || (_cache[42] = (0, import_vue.createTextVNode)(
                        "任务名称 ",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => form.name = $event),
                          class: "input",
                          placeholder: "例如：每日清理临时文件"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [import_vue.vModelText, form.name]
                      ])
                    ]),
                    (0, import_vue.createElementVNode)("label", _hoisted_47, [
                      _cache[43] || (_cache[43] = (0, import_vue.createTextVNode)(
                        "动作 ",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                        "select",
                        {
                          "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => form.action = $event),
                          class: "input"
                        },
                        [
                          ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                            import_vue.Fragment,
                            null,
                            (0, import_vue.renderList)(actions.value, (a) => {
                              return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("option", {
                                key: a.key,
                                value: a.key
                              }, (0, import_vue.toDisplayString)(a.label), 9, _hoisted_48);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ],
                        512
                        /* NEED_PATCH */
                      ), [
                        [import_vue.vModelSelect, form.action]
                      ])
                    ])
                  ])
                ]),
                (0, import_vue.createElementVNode)("div", _hoisted_49, [
                  _cache[51] || (_cache[51] = (0, import_vue.createElementVNode)(
                    "div",
                    { class: "form-section-title" },
                    "触发方式",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue.createElementVNode)("div", _hoisted_50, [
                    (0, import_vue.createElementVNode)(
                      "button",
                      {
                        class: (0, import_vue.normalizeClass)(["btn btn-sm", { "btn-primary": form.trigger === "interval" }]),
                        onClick: _cache[13] || (_cache[13] = ($event) => form.trigger = "interval")
                      },
                      "间隔",
                      2
                      /* CLASS */
                    ),
                    (0, import_vue.createElementVNode)(
                      "button",
                      {
                        class: (0, import_vue.normalizeClass)(["btn btn-sm", { "btn-primary": form.trigger === "cron" }]),
                        onClick: _cache[14] || (_cache[14] = ($event) => form.trigger = "cron")
                      },
                      "Cron 表达式",
                      2
                      /* CLASS */
                    )
                  ]),
                  form.trigger === "interval" ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    import_vue.Fragment,
                    { key: 0 },
                    [
                      (0, import_vue.createElementVNode)("div", _hoisted_51, [
                        ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                          import_vue.Fragment,
                          null,
                          (0, import_vue.renderList)([{ s: 60, l: "1分钟" }, { s: 300, l: "5分钟" }, { s: 900, l: "15分钟" }, { s: 1800, l: "30分钟" }, { s: 3600, l: "1小时" }, { s: 21600, l: "6小时" }, { s: 86400, l: "1天" }], (preset) => {
                            return (0, import_vue.createElementVNode)("button", {
                              key: preset.s,
                              class: (0, import_vue.normalizeClass)(["btn btn-sm preset", { "btn-primary": form.interval === preset.s }]),
                              onClick: ($event) => setIntervalPreset(preset.s)
                            }, (0, import_vue.toDisplayString)(preset.l), 11, _hoisted_52);
                          }),
                          64
                          /* STABLE_FRAGMENT */
                        ))
                      ]),
                      (0, import_vue.createElementVNode)("label", _hoisted_53, [
                        _cache[45] || (_cache[45] = (0, import_vue.createTextVNode)(
                          "自定义间隔（秒，≥10） ",
                          -1
                          /* CACHED */
                        )),
                        (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                          "input",
                          {
                            "onUpdate:modelValue": _cache[15] || (_cache[15] = ($event) => form.interval = $event),
                            class: "input",
                            type: "number",
                            min: "10"
                          },
                          null,
                          512
                          /* NEED_PATCH */
                        ), [
                          [
                            import_vue.vModelText,
                            form.interval,
                            void 0,
                            { number: true }
                          ]
                        ])
                      ])
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    import_vue.Fragment,
                    { key: 1 },
                    [
                      (0, import_vue.createElementVNode)("div", _hoisted_54, [
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[46] || (_cache[46] = (0, import_vue.createTextVNode)(
                            "分 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[16] || (_cache[16] = ($event) => form.minute = $event),
                              class: "input",
                              placeholder: "0"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.minute]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[47] || (_cache[47] = (0, import_vue.createTextVNode)(
                            "时 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[17] || (_cache[17] = ($event) => form.hour = $event),
                              class: "input",
                              placeholder: "*"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.hour]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[48] || (_cache[48] = (0, import_vue.createTextVNode)(
                            "日 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[18] || (_cache[18] = ($event) => form.day = $event),
                              class: "input",
                              placeholder: "*"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.day]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[49] || (_cache[49] = (0, import_vue.createTextVNode)(
                            "月 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[19] || (_cache[19] = ($event) => form.month = $event),
                              class: "input",
                              placeholder: "*"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.month]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[50] || (_cache[50] = (0, import_vue.createTextVNode)(
                            "星期 (0-6) ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[20] || (_cache[20] = ($event) => form.day_of_week = $event),
                              class: "input",
                              placeholder: "*"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.day_of_week]
                          ])
                        ])
                      ]),
                      (0, import_vue.createElementVNode)(
                        "div",
                        _hoisted_55,
                        (0, import_vue.toDisplayString)(fmtCron(form)),
                        1
                        /* TEXT */
                      )
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  ))
                ]),
                (0, import_vue.createElementVNode)("div", _hoisted_56, [
                  _cache[62] || (_cache[62] = (0, import_vue.createElementVNode)(
                    "div",
                    { class: "form-section-title" },
                    "动作参数",
                    -1
                    /* CACHED */
                  )),
                  (0, import_vue.createElementVNode)("div", _hoisted_57, [
                    form.action === "gen_img" ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                      import_vue.Fragment,
                      { key: 0 },
                      [
                        (0, import_vue.createElementVNode)("label", _hoisted_58, [
                          _cache[52] || (_cache[52] = (0, import_vue.createTextVNode)(
                            "提示词 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => form.params.prompt = $event),
                              class: "input",
                              placeholder: "prompt"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.params.prompt]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[53] || (_cache[53] = (0, import_vue.createTextVNode)(
                            "宽 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[22] || (_cache[22] = ($event) => form.params.width = $event),
                              class: "input",
                              placeholder: "512"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [
                              import_vue.vModelText,
                              form.params.width,
                              void 0,
                              { number: true }
                            ]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[54] || (_cache[54] = (0, import_vue.createTextVNode)(
                            "高 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[23] || (_cache[23] = ($event) => form.params.height = $event),
                              class: "input",
                              placeholder: "512"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [
                              import_vue.vModelText,
                              form.params.height,
                              void 0,
                              { number: true }
                            ]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[55] || (_cache[55] = (0, import_vue.createTextVNode)(
                            "步数 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[24] || (_cache[24] = ($event) => form.params.steps = $event),
                              class: "input",
                              placeholder: "20"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [
                              import_vue.vModelText,
                              form.params.steps,
                              void 0,
                              { number: true }
                            ]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[56] || (_cache[56] = (0, import_vue.createTextVNode)(
                            "数量 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[25] || (_cache[25] = ($event) => form.params.count = $event),
                              class: "input",
                              placeholder: "1"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [
                              import_vue.vModelText,
                              form.params.count,
                              void 0,
                              { number: true }
                            ]
                          ])
                        ])
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    )) : (0, import_vue.createCommentVNode)("v-if", true),
                    form.action === "grab_setu" ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("label", _hoisted_59, [
                      _cache[57] || (_cache[57] = (0, import_vue.createTextVNode)(
                        "标签（& 分隔） ",
                        -1
                        /* CACHED */
                      )),
                      (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[26] || (_cache[26] = ($event) => form.params.tag = $event),
                          class: "input",
                          placeholder: "例如：白丝"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [import_vue.vModelText, form.params.tag]
                      ])
                    ])) : (0, import_vue.createCommentVNode)("v-if", true),
                    form.action === "clean_tmp" ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                      import_vue.Fragment,
                      { key: 2 },
                      [
                        (0, import_vue.createElementVNode)("label", _hoisted_60, [
                          _cache[58] || (_cache[58] = (0, import_vue.createTextVNode)(
                            "清理目录 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[27] || (_cache[27] = ($event) => form.params.dir = $event),
                              class: "input",
                              placeholder: "/opt/touchgal/plugins"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.params.dir]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[59] || (_cache[59] = (0, import_vue.createTextVNode)(
                            "保留天数 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[28] || (_cache[28] = ($event) => form.params.days = $event),
                              class: "input",
                              placeholder: "3"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [
                              import_vue.vModelText,
                              form.params.days,
                              void 0,
                              { number: true }
                            ]
                          ])
                        ])
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    )) : (0, import_vue.createCommentVNode)("v-if", true),
                    form.action === "shell" ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                      import_vue.Fragment,
                      { key: 3 },
                      [
                        (0, import_vue.createElementVNode)("label", _hoisted_61, [
                          _cache[60] || (_cache[60] = (0, import_vue.createTextVNode)(
                            "Shell 命令 ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[29] || (_cache[29] = ($event) => form.params.command = $event),
                              class: "input",
                              placeholder: "例如：echo hello > /tmp/x"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [import_vue.vModelText, form.params.command]
                          ])
                        ]),
                        (0, import_vue.createElementVNode)("label", null, [
                          _cache[61] || (_cache[61] = (0, import_vue.createTextVNode)(
                            "超时（秒） ",
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                            "input",
                            {
                              "onUpdate:modelValue": _cache[30] || (_cache[30] = ($event) => form.params.timeout = $event),
                              class: "input",
                              placeholder: "60"
                            },
                            null,
                            512
                            /* NEED_PATCH */
                          ), [
                            [
                              import_vue.vModelText,
                              form.params.timeout,
                              void 0,
                              { number: true }
                            ]
                          ])
                        ])
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    )) : (0, import_vue.createCommentVNode)("v-if", true)
                  ])
                ])
              ]),
              (0, import_vue.createElementVNode)("div", _hoisted_62, [
                error.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                  "div",
                  _hoisted_63,
                  (0, import_vue.toDisplayString)(error.value),
                  1
                  /* TEXT */
                )) : (0, import_vue.createCommentVNode)("v-if", true),
                (0, import_vue.createElementVNode)("div", _hoisted_64, [
                  (0, import_vue.createElementVNode)("button", {
                    class: "btn btn-sm btn-ghost",
                    onClick: _cache[31] || (_cache[31] = ($event) => showForm.value = false)
                  }, "取消"),
                  (0, import_vue.createElementVNode)("button", {
                    class: "btn btn-sm btn-primary",
                    onClick: save
                  }, "保存")
                ])
              ])
            ])
          ])) : (0, import_vue.createCommentVNode)("v-if", true)
        ]);
      };
    }
  };
  __sfc_main.__scopeId = "data-v-bk1myz";
  var Scheduler_default = __sfc_main;
  (function() {
    var key = "rc-ext-css-data-v-bk1myz-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.toolbar[data-v-bk1myz] { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; flex-wrap: wrap;\n}\n.toolbar-right[data-v-bk1myz] { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;\n}\n.status[data-v-bk1myz] { margin-left: auto; font-size: 12px; color: var(--text-faint);\n}\n.stats-row[data-v-bk1myz] { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap;\n}\n.stat[data-v-bk1myz] {\r\n  flex: 1;\r\n  min-width: 120px;\r\n  background: var(--surface);\r\n  border: 1px solid var(--border);\r\n  padding: 12px 16px;\r\n  cursor: pointer;\r\n  transition: border-color var(--transition), background var(--transition);\n}\n.stat[data-v-bk1myz]:hover { border-color: var(--accent); background: var(--surface-2);\n}\n.stat-num[data-v-bk1myz] { font-size: 22px; font-weight: 800; font-family: var(--font-mono);\n}\n.stat-label[data-v-bk1myz] { font-size: 11px; color: var(--text-faint); margin-top: 2px;\n}\n.filter-tabs[data-v-bk1myz] { display: flex; gap: 4px;\n}\n.ftab[data-v-bk1myz] {\r\n  padding: 6px 14px;\r\n  font-size: 12px;\r\n  font-weight: 600;\r\n  color: var(--text-muted);\r\n  background: var(--surface);\r\n  border: 1px solid var(--border);\r\n  cursor: pointer;\r\n  transition: background var(--transition), color var(--transition), border-color var(--transition);\n}\n.ftab[data-v-bk1myz]:hover { color: var(--text);\n}\n.ftab.active[data-v-bk1myz] { background: var(--accent-soft); color: var(--accent); border-color: var(--accent);\n}\n.job-card[data-v-bk1myz] {\r\n  border: 1px solid var(--border);\r\n  border-radius: 0;\r\n  padding: 14px 16px;\r\n  margin-bottom: 10px;\r\n  background: var(--surface);\r\n  display: flex;\r\n  gap: 14px;\r\n  align-items: flex-start;\n}\n.job-card.paused[data-v-bk1myz] { opacity: 0.65;\n}\n.job-main[data-v-bk1myz] { flex: 1; min-width: 0;\n}\n.job-title[data-v-bk1myz] { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;\n}\n.job-name[data-v-bk1myz] { font-weight: 700;\n}\n.badge[data-v-bk1myz] { font-size: 11px; padding: 1px 7px; border-radius: 0;\n}\n.badge-on[data-v-bk1myz] { background: var(--success-soft); color: var(--success);\n}\n.badge-off[data-v-bk1myz] { background: var(--surface-3); color: var(--text-muted);\n}\n.act-tag[data-v-bk1myz] {\r\n  font-size: 11px;\r\n  padding: 1px 7px;\r\n  border-radius: 0;\r\n  background: var(--accent-soft);\r\n  color: var(--accent);\n}\n.job-meta[data-v-bk1myz] { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 7px; font-size: 12px; color: var(--text-muted);\n}\n.meta-item b[data-v-bk1myz] { color: var(--text); font-weight: 600;\n}\n.ok[data-v-bk1myz] { color: var(--success);\n}\n.err[data-v-bk1myz] { color: var(--danger);\n}\n.muted[data-v-bk1myz] { color: var(--text-faint);\n}\n.job-params[data-v-bk1myz] {\r\n  margin-top: 7px;\r\n  font-size: 11px;\r\n  color: var(--text-faint);\r\n  background: var(--surface-2);\r\n  border: 1px solid var(--border);\r\n  border-radius: 0;\r\n  padding: 4px 8px;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\n}\n.job-err[data-v-bk1myz] {\r\n  margin-top: 7px;\r\n  font-size: 11px;\r\n  color: var(--danger);\r\n  background: var(--danger-soft);\r\n  border: 1px solid transparent;\r\n  border-radius: 0;\r\n  padding: 4px 8px;\r\n  word-break: break-all;\n}\n.history-block[data-v-bk1myz] { margin-top: 9px; border-top: 1px dashed var(--border); padding-top: 7px;\n}\n.history-title[data-v-bk1myz] {\r\n  font-size: 11px;\r\n  color: var(--text-faint);\r\n  cursor: pointer;\r\n  user-select: none;\n}\n.caret[data-v-bk1myz] { margin-left: 4px;\n}\n.history-list[data-v-bk1myz] { margin-top: 6px;\n}\n.history-row[data-v-bk1myz] { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 2px 0;\n}\n.h-time[data-v-bk1myz] { color: var(--text-faint); font-family: var(--font-mono);\n}\n.h-dur[data-v-bk1myz] { color: var(--text-faint); font-family: var(--font-mono);\n}\n.h-msg[data-v-bk1myz] {\r\n  flex: 1;\r\n  color: var(--text-muted);\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\n}\n.job-ops[data-v-bk1myz] { display: flex; gap: 6px; flex-shrink: 0; flex-direction: column; align-items: stretch;\n}\n.sched-modal[data-v-bk1myz] {\r\n  max-width: 600px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  max-height: 86vh;\n}\n.sched-modal-header[data-v-bk1myz] {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  padding: 14px 18px;\r\n  border-bottom: 1px solid var(--border);\r\n  flex-shrink: 0;\n}\n.sched-modal-heading[data-v-bk1myz] { font-size: 15px; font-weight: 800; letter-spacing: 0.5px;\n}\n.sched-modal-close[data-v-bk1myz] {\r\n  background: none;\r\n  border: none;\r\n  color: var(--text-faint);\r\n  font-size: 16px;\r\n  line-height: 1;\r\n  cursor: pointer;\r\n  padding: 4px 8px;\r\n  transition: color var(--transition), background var(--transition);\n}\n.sched-modal-close[data-v-bk1myz]:hover { color: var(--text); background: var(--surface-2);\n}\n.sched-modal-body[data-v-bk1myz] {\r\n  padding: 16px 18px;\r\n  overflow-y: auto;\r\n  flex: 1;\n}\n.sched-modal-footer[data-v-bk1myz] {\r\n  padding: 12px 18px;\r\n  border-top: 1px solid var(--border);\r\n  flex-shrink: 0;\r\n  background: var(--surface-2);\n}\n.sched-label[data-v-bk1myz] { font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;\n}\n.form-section[data-v-bk1myz] { margin-bottom: 18px;\n}\n.form-section-title[data-v-bk1myz] {\r\n  font-size: 12px;\r\n  font-weight: 700;\r\n  color: var(--text-faint);\r\n  letter-spacing: 1.5px;\r\n  margin-bottom: 10px;\r\n  padding-bottom: 6px;\r\n  border-bottom: 1px solid var(--border);\n}\n.form-grid[data-v-bk1myz] { display: grid; grid-template-columns: 1fr 1fr; gap: 12px;\n}\n.form-grid label[data-v-bk1myz] { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted);\n}\n.form-grid .full[data-v-bk1myz] { grid-column: 1 / -1;\n}\n.trig-switch[data-v-bk1myz] { display: flex; gap: 8px; margin-bottom: 12px;\n}\n.preset-row[data-v-bk1myz] { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;\n}\n.preset[data-v-bk1myz] { padding: 3px 10px;\n}\n.cron-grid[data-v-bk1myz] { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px;\n}\n.cron-grid label[data-v-bk1myz] { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted);\n}\n.cron-preview[data-v-bk1myz] {\r\n  font-size: 12px;\r\n  color: var(--accent);\r\n  background: var(--accent-soft);\r\n  padding: 6px 10px;\r\n  border-radius: 0;\n}\n.form-err[data-v-bk1myz] { font-size: 12px; color: var(--danger); padding: 6px 0;\n}\n.form-ops[data-v-bk1myz] { display: flex; gap: 8px; justify-content: flex-end;\n}\r\n";
    document.head.appendChild(el);
  })();

  // extensions/scheduler/frontend/extension.js
  window.__rcExt__ = window.__rcExt__ || {};
  window.__rcExt__.scheduler = {
    mount: function(el) {
      var app = import_vue3.default.createApp(Scheduler_default);
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
