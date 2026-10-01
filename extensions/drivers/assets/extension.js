/* RainCough 系统扩展产物 · drivers · 由 tools/build-extension.js 生成 */
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

  // extensions/drivers/frontend/extension.js
  var import_vue3 = __toESM(require_vue());

  // extensions/drivers/frontend/App.vue
  var import_vue = __toESM(require_vue());
  var import_vue2 = __toESM(require_vue());
  var _hoisted_1 = { class: "page" };
  var _hoisted_2 = { class: "page-body" };
  var _hoisted_3 = { class: "dr-bar" };
  var _hoisted_4 = ["disabled"];
  var _hoisted_5 = { class: "dr-origin" };
  var _hoisted_6 = {
    key: 0,
    class: "dr-err"
  };
  var _hoisted_7 = {
    key: 1,
    class: "dr-cfg"
  };
  var _hoisted_8 = ["disabled"];
  var _hoisted_9 = {
    key: 2,
    class: "dr-sec"
  };
  var _hoisted_10 = { class: "dr-sec-t" };
  var _hoisted_11 = { class: "dr-sec" };
  var _hoisted_12 = { class: "dr-sec-t" };
  var _hoisted_13 = {
    key: 0,
    class: "dr-fake"
  };
  var _hoisted_14 = { class: "dr-sec" };
  var _hoisted_15 = { class: "dr-sec-t" };
  var _hoisted_16 = {
    key: 0,
    class: "dr-empty"
  };
  var _hoisted_17 = {
    key: 1,
    class: "table"
  };
  var _hoisted_18 = { class: "dr-mono" };
  var _hoisted_19 = { class: "dr-faint" };
  var _hoisted_20 = {
    key: 0,
    class: "dr-tag"
  };
  var _hoisted_21 = {
    key: 0,
    class: "dr-faint"
  };
  var _hoisted_22 = {
    key: 1,
    class: "dr-faint"
  };
  var _hoisted_23 = { class: "dr-mono" };
  var _hoisted_24 = { class: "dr-faint" };
  var _hoisted_25 = {
    key: 0,
    class: "dr-faint"
  };
  var _hoisted_26 = { class: "dr-sec" };
  var _hoisted_27 = { class: "dr-sec-t" };
  var _hoisted_28 = { class: "dr-rule" };
  var _hoisted_29 = ["disabled"];
  var _hoisted_30 = {
    key: 4,
    class: "dr-sec"
  };
  var _hoisted_31 = { class: "dr-sec-t" };
  var _hoisted_32 = {
    key: 0,
    class: "dr-err"
  };
  var _hoisted_33 = {
    key: 1,
    class: "dr-empty"
  };
  var _hoisted_34 = {
    key: 2,
    class: "table"
  };
  var _hoisted_35 = { class: "dr-mono dr-faint" };
  var _hoisted_36 = { class: "dr-faint" };
  var _hoisted_37 = { class: "dr-mono" };
  var _hoisted_38 = { class: "dr-mono" };
  var _hoisted_39 = { class: "dr-mono dr-faint" };
  var _hoisted_40 = { class: "dr-mono dr-faint" };
  var _hoisted_41 = { class: "dr-faint" };
  var _hoisted_42 = ["disabled", "onClick"];
  var _hoisted_43 = {
    key: 5,
    class: "dr-sec"
  };
  var _hoisted_44 = { class: "dr-sec-t" };
  var _hoisted_45 = {
    key: 0,
    class: "dr-rule"
  };
  var _hoisted_46 = { key: 0 };
  var _hoisted_47 = { key: 1 };
  var _hoisted_48 = {
    key: 1,
    class: "dr-rule"
  };
  var _hoisted_49 = { key: 0 };
  var _hoisted_50 = { class: "dr-mono" };
  var _hoisted_51 = {
    key: 2,
    class: "dr-rule"
  };
  var _hoisted_52 = { class: "dr-mono" };
  var _hoisted_53 = { class: "dr-mono" };
  var _hoisted_54 = { class: "dr-mono" };
  var _hoisted_55 = {
    key: 3,
    class: "dr-rule"
  };
  var _hoisted_56 = { key: 0 };
  var _hoisted_57 = {
    key: 4,
    class: "dr-rule"
  };
  var _hoisted_58 = { class: "dr-mono" };
  var _hoisted_59 = { class: "dr-mono" };
  var _hoisted_60 = {
    key: 5,
    class: "dr-rule"
  };
  var _hoisted_61 = { class: "dr-rule" };
  var _hoisted_62 = { class: "dr-mono" };
  var _hoisted_63 = { class: "dr-faint" };
  var _hoisted_64 = ["value"];
  var _hoisted_65 = {
    class: "dr-bar",
    style: { "margin-top": "8px" }
  };
  var _hoisted_66 = ["placeholder"];
  var _hoisted_67 = ["disabled"];
  var _hoisted_68 = {
    key: 6,
    class: "dr-sec"
  };
  var _hoisted_69 = { class: "dr-sec-t" };
  var _hoisted_70 = { key: 0 };
  var _hoisted_71 = { class: "dr-bar" };
  var _hoisted_72 = ["disabled"];
  var _hoisted_73 = {
    key: 0,
    class: "dr-err"
  };
  var _hoisted_74 = {
    key: 0,
    class: "dr-rule"
  };
  var _hoisted_75 = { class: "dr-mono" };
  var _hoisted_76 = { class: "dr-faint" };
  var _hoisted_77 = {
    key: 0,
    class: "dr-out"
  };
  var _hoisted_78 = {
    key: 1,
    class: "dr-rule"
  };
  var _hoisted_79 = { class: "dr-mono" };
  var _hoisted_80 = {
    key: 2,
    class: "dr-rule"
  };
  var _hoisted_81 = { class: "dr-mono" };
  var _hoisted_82 = { class: "dr-sec" };
  var _hoisted_83 = { class: "dr-bar" };
  var _hoisted_84 = ["disabled"];
  var _hoisted_85 = ["disabled"];
  var _hoisted_86 = ["disabled"];
  var _hoisted_87 = { class: "dr-sec" };
  var _hoisted_88 = { class: "dr-sec-t" };
  var _hoisted_89 = { class: "dr-bar" };
  var _hoisted_90 = ["disabled"];
  var _hoisted_91 = {
    key: 0,
    class: "dr-empty"
  };
  var _hoisted_92 = {
    key: 1,
    class: "dr-empty"
  };
  var _hoisted_93 = {
    key: 2,
    class: "table"
  };
  var _hoisted_94 = { class: "dr-mono" };
  var _hoisted_95 = { class: "dr-mono dr-faint" };
  var __sfc_main = {
    __name: "App",
    props: { ctx: { type: Object, required: true } },
    setup(__props) {
      const props = __props;
      const inv = (id, p, t) => props.ctx.host.api.ifaceInvoke(id, p, t);
      const err = (0, import_vue2.ref)("");
      const busy = (0, import_vue2.ref)("");
      const repo = (0, import_vue2.ref)(null);
      const gpu = (0, import_vue2.ref)(null);
      const plan = (0, import_vue2.ref)(null);
      const task = (0, import_vue2.ref)(null);
      const logs = (0, import_vue2.ref)(null);
      const showCfg = (0, import_vue2.ref)(false);
      const typed = (0, import_vue2.ref)("");
      const ack = (0, import_vue2.ref)([]);
      let timer = null;
      const cfg = (0, import_vue2.ref)({ branch: "main", mirror: true, local_dir: "", token: "", gpg: true, gpg_fpr: "" });
      function msg(e) {
        return e && e.message || String(e);
      }
      function mb(n) {
        return n ? (n / 1048576).toFixed(0) + " MB" : "-";
      }
      function cv(v) {
        return v === true ? "开" : v === false ? "关" : "未知";
      }
      function short(s) {
        return (s || "").slice(0, 12) + (s ? "…" : "");
      }
      function srcText(r) {
        if (!r) return "-";
        const used = r.used ? { local: "本地目录", direct: "直连", mirror1: "镜像1", mirror2: "镜像2", mirror3: "镜像3" }[r.used] || r.used : "不可达";
        const age = r.cache_age_s == null ? "-" : r.cache_age_s < 60 ? r.cache_age_s + "s" : Math.round(r.cache_age_s / 60) + "min";
        return `panel @${r.branch} · ${used} · ${age}前 · ${r.count} 个条目`;
      }
      function gpgText(r) {
        const g = r && r.gpg || {};
        if (!g.enabled) return "签名校验 关";
        return g.verified ? `签名 已验证 · ${String(g.fpr || "").slice(0, 16)}…` : `签名 未验证${g.error ? " · " + g.error : ""}`;
      }
      async function load() {
        busy.value = "load";
        err.value = "";
        try {
          const r = await Promise.all([inv("drivers.repo", {}, 4e4), inv("drivers.gpu", {}, 3e4)]);
          repo.value = r[0];
          gpu.value = r[1];
          Object.assign(cfg.value, {
            branch: r[0].branch,
            mirror: r[0].mirror,
            local_dir: r[0].local_dir || "",
            gpg: (r[0].gpg || {}).enabled !== false,
            gpg_fpr: (r[0].gpg || {}).expected_fpr || ""
          });
          const t = await inv("drivers.task", {}, 2e4);
          if (t.active) {
            task.value = t.active;
            startPoll();
          }
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      async function sync() {
        busy.value = "sync";
        err.value = "";
        try {
          repo.value = await inv("drivers.repo", { refresh: true }, 4e4);
          gpu.value = await inv("drivers.gpu", { refresh: true }, 3e4);
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      async function save() {
        busy.value = "save";
        err.value = "";
        try {
          await inv("drivers.repo.config", {
            branch: cfg.value.branch,
            mirror: !!cfg.value.mirror,
            local_dir: cfg.value.local_dir || "",
            token: cfg.value.token || void 0,
            gpg: !!cfg.value.gpg,
            gpg_fpr: cfg.value.gpg_fpr || void 0
          }, 2e4);
          cfg.value.token = "";
          showCfg.value = false;
          await sync();
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      async function precheck(p) {
        busy.value = "plan";
        err.value = "";
        plan.value = null;
        typed.value = "";
        ack.value = [];
        try {
          plan.value = await inv("drivers.install", p, 3e4);
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      async function doApply() {
        if (!plan.value) return;
        busy.value = "apply";
        err.value = "";
        try {
          const r = await inv("drivers.install", {
            mode: "apply",
            plan_id: plan.value.plan_id,
            confirm: { acknowledge: ack.value, typed: typed.value }
          }, 4e4);
          task.value = { id: r.task_id, state: r.state, commands: [], progress: [] };
          startPoll();
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      async function doRevert(action) {
        busy.value = "plan";
        err.value = "";
        plan.value = null;
        typed.value = "";
        ack.value = [];
        try {
          plan.value = await inv("drivers.revert", { mode: "precheck", action }, 3e4);
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      function startPoll() {
        stopPoll();
        timer = setInterval(async () => {
          if (!task.value || !task.value.id) return;
          try {
            task.value = await inv("drivers.task", { id: task.value.id }, 2e4);
            if (["done", "failed", "cancelled"].includes(task.value.state)) {
              stopPoll();
              await afterTask();
            }
          } catch (e) {
            stopPoll();
            err.value = msg(e);
          }
        }, 2e3);
      }
      function stopPoll() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
      async function afterTask() {
        try {
          repo.value = await inv("drivers.repo", {}, 3e4);
          gpu.value = await inv("drivers.gpu", { refresh: true }, 3e4);
          logs.value = await inv("drivers.log", { limit: 20 }, 2e4);
        } catch (e) {
          err.value = msg(e);
        }
      }
      async function cancelTask() {
        if (!task.value) return;
        try {
          await inv("drivers.cancel", { id: task.value.id }, 2e4);
        } catch (e) {
          err.value = msg(e);
        }
      }
      async function loadLogs() {
        busy.value = "log";
        try {
          logs.value = await inv("drivers.log", { limit: 50 }, 2e4);
        } catch (e) {
          err.value = msg(e);
        } finally {
          busy.value = "";
        }
      }
      function pct(t) {
        const p = t && t.progress || [];
        for (let i = p.length - 1; i >= 0; i--) if (p[i].pct != null) return p[i].pct;
        return t && t.state === "done" ? 100 : null;
      }
      (0, import_vue2.onMounted)(load);
      (0, import_vue2.onBeforeUnmount)(stopPoll);
      return (_ctx, _cache) => {
        return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_1, [
          (0, import_vue.createElementVNode)("div", _hoisted_2, [
            (0, import_vue.createElementVNode)("div", _hoisted_3, [
              (0, import_vue.createElementVNode)("button", {
                class: "btn btn-sm",
                disabled: !!busy.value,
                onClick: sync
              }, (0, import_vue.toDisplayString)(busy.value === "sync" ? "同步中…" : "同步"), 9, _hoisted_4),
              (0, import_vue.createElementVNode)(
                "button",
                {
                  class: "btn btn-sm",
                  onClick: _cache[0] || (_cache[0] = ($event) => showCfg.value = !showCfg.value)
                },
                (0, import_vue.toDisplayString)(showCfg.value ? "收起配置" : "配置"),
                1
                /* TEXT */
              ),
              (0, import_vue.createElementVNode)(
                "span",
                _hoisted_5,
                (0, import_vue.toDisplayString)(srcText(repo.value)) + " · " + (0, import_vue.toDisplayString)(gpgText(repo.value)),
                1
                /* TEXT */
              )
            ]),
            err.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
              "div",
              _hoisted_6,
              (0, import_vue.toDisplayString)(err.value),
              1
              /* TEXT */
            )) : (0, import_vue.createCommentVNode)("v-if", true),
            showCfg.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_7, [
              (0, import_vue.createElementVNode)("label", null, [
                _cache[13] || (_cache[13] = (0, import_vue.createTextVNode)(
                  "分支",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    class: "input",
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => cfg.value.branch = $event),
                    style: { "width": "100px" }
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelText, cfg.value.branch]
                ])
              ]),
              (0, import_vue.createElementVNode)("label", null, [
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    type: "checkbox",
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => cfg.value.mirror = $event)
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelCheckbox, cfg.value.mirror]
                ]),
                _cache[14] || (_cache[14] = (0, import_vue.createTextVNode)(
                  " 镜像",
                  -1
                  /* CACHED */
                ))
              ]),
              (0, import_vue.createElementVNode)("label", null, [
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    type: "checkbox",
                    "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => cfg.value.gpg = $event)
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelCheckbox, cfg.value.gpg]
                ]),
                _cache[15] || (_cache[15] = (0, import_vue.createTextVNode)(
                  " 签名校验",
                  -1
                  /* CACHED */
                ))
              ]),
              (0, import_vue.createElementVNode)("label", null, [
                _cache[16] || (_cache[16] = (0, import_vue.createTextVNode)(
                  "指纹",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    class: "input",
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => cfg.value.gpg_fpr = $event),
                    style: { "width": "330px" }
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelText, cfg.value.gpg_fpr]
                ])
              ]),
              (0, import_vue.createElementVNode)("label", null, [
                _cache[17] || (_cache[17] = (0, import_vue.createTextVNode)(
                  "本地目录",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    class: "input",
                    "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => cfg.value.local_dir = $event),
                    style: { "width": "220px" }
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelText, cfg.value.local_dir]
                ])
              ]),
              (0, import_vue.createElementVNode)("label", null, [
                _cache[18] || (_cache[18] = (0, import_vue.createTextVNode)(
                  "令牌",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)(
                  "input",
                  {
                    class: "input",
                    "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => cfg.value.token = $event),
                    type: "password",
                    style: { "width": "150px" }
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [import_vue.vModelText, cfg.value.token]
                ])
              ]),
              (0, import_vue.createElementVNode)("button", {
                class: "btn btn-sm btn-primary",
                disabled: !!busy.value,
                onClick: save
              }, "保存", 8, _hoisted_8)
            ])) : (0, import_vue.createCommentVNode)("v-if", true),
            repo.value && repo.value.problems && repo.value.problems.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_9, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_10,
                "清单问题 (" + (0, import_vue.toDisplayString)(repo.value.problems.length) + ")",
                1
                /* TEXT */
              ),
              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                import_vue.Fragment,
                null,
                (0, import_vue.renderList)(repo.value.problems, (p) => {
                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    {
                      key: p.id,
                      class: "dr-warn"
                    },
                    (0, import_vue.toDisplayString)(p.id) + ": " + (0, import_vue.toDisplayString)(p.error),
                    1
                    /* TEXT */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : (0, import_vue.createCommentVNode)("v-if", true),
            gpu.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
              import_vue.Fragment,
              { key: 3 },
              [
                (0, import_vue.createElementVNode)("div", _hoisted_11, [
                  (0, import_vue.createElementVNode)("div", _hoisted_12, [
                    (0, import_vue.createTextVNode)(
                      "核心 " + (0, import_vue.toDisplayString)(gpu.value.tools.kernel) + " · Secure Boot " + (0, import_vue.toDisplayString)(cv(gpu.value.secure_boot)) + " · DKMS " + (0, import_vue.toDisplayString)(gpu.value.tools.dkms ? "已装" : "未装") + " · headers " + (0, import_vue.toDisplayString)(gpu.value.tools.headers ? "已装" : "未装") + " · 磁盘 " + (0, import_vue.toDisplayString)(gpu.value.tools.free_disk_mb) + " MB",
                      1
                      /* TEXT */
                    ),
                    gpu.value.fake ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("span", _hoisted_13, "模拟数据")) : (0, import_vue.createCommentVNode)("v-if", true)
                  ])
                ]),
                (0, import_vue.createElementVNode)("div", _hoisted_14, [
                  (0, import_vue.createElementVNode)(
                    "div",
                    _hoisted_15,
                    "NVIDIA 卡 (" + (0, import_vue.toDisplayString)(gpu.value.cards.length) + ")",
                    1
                    /* TEXT */
                  ),
                  !gpu.value.cards.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_16, "没有 NVIDIA 设备")) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("table", _hoisted_17, [
                    _cache[20] || (_cache[20] = (0, import_vue.createElementVNode)(
                      "thead",
                      null,
                      [
                        (0, import_vue.createElementVNode)("tr", null, [
                          (0, import_vue.createElementVNode)("th", null, "地址"),
                          (0, import_vue.createElementVNode)("th", null, "型号"),
                          (0, import_vue.createElementVNode)("th", null, "架构"),
                          (0, import_vue.createElementVNode)("th", null, "算力"),
                          (0, import_vue.createElementVNode)("th", null, "驱动"),
                          (0, import_vue.createElementVNode)("th", null, "输出"),
                          (0, import_vue.createElementVNode)("th", null, "链路"),
                          (0, import_vue.createElementVNode)("th", null, "GSP"),
                          (0, import_vue.createElementVNode)("th", null, "匹配条目"),
                          (0, import_vue.createElementVNode)("th", null, "状态")
                        ])
                      ],
                      -1
                      /* CACHED */
                    )),
                    (0, import_vue.createElementVNode)("tbody", null, [
                      ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                        import_vue.Fragment,
                        null,
                        (0, import_vue.renderList)(gpu.value.cards, (c) => {
                          return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("tr", {
                            key: c.bdf
                          }, [
                            (0, import_vue.createElementVNode)("td", _hoisted_18, [
                              (0, import_vue.createTextVNode)(
                                (0, import_vue.toDisplayString)(c.bdf),
                                1
                                /* TEXT */
                              ),
                              _cache[19] || (_cache[19] = (0, import_vue.createElementVNode)(
                                "br",
                                null,
                                null,
                                -1
                                /* CACHED */
                              )),
                              (0, import_vue.createElementVNode)(
                                "span",
                                _hoisted_19,
                                (0, import_vue.toDisplayString)(c.pci_id),
                                1
                                /* TEXT */
                              )
                            ]),
                            (0, import_vue.createElementVNode)("td", null, [
                              (0, import_vue.createTextVNode)(
                                (0, import_vue.toDisplayString)(c.model),
                                1
                                /* TEXT */
                              ),
                              c.mining ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                "span",
                                _hoisted_20,
                                "矿卡 " + (0, import_vue.toDisplayString)(c.mining_class),
                                1
                                /* TEXT */
                              )) : (0, import_vue.createCommentVNode)("v-if", true)
                            ]),
                            (0, import_vue.createElementVNode)(
                              "td",
                              null,
                              (0, import_vue.toDisplayString)(c.arch || "-"),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue.createElementVNode)(
                              "td",
                              null,
                              (0, import_vue.toDisplayString)(c.compute_cap || "-"),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue.createElementVNode)("td", null, [
                              (0, import_vue.createTextVNode)(
                                (0, import_vue.toDisplayString)(c.driver || "未装"),
                                1
                                /* TEXT */
                              ),
                              c.driver_version ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                "span",
                                _hoisted_21,
                                (0, import_vue.toDisplayString)(c.driver_version),
                                1
                                /* TEXT */
                              )) : (0, import_vue.createCommentVNode)("v-if", true),
                              c.driver_source !== "none" ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                "span",
                                _hoisted_22,
                                " (" + (0, import_vue.toDisplayString)(c.driver_source) + ")",
                                1
                                /* TEXT */
                              )) : (0, import_vue.createCommentVNode)("v-if", true)
                            ]),
                            (0, import_vue.createElementVNode)(
                              "td",
                              null,
                              (0, import_vue.toDisplayString)(c.has_display_output ? c.connectors.length + " 个" : "无"),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue.createElementVNode)("td", _hoisted_23, [
                              (0, import_vue.createTextVNode)(
                                (0, import_vue.toDisplayString)(c.link.width || "-"),
                                1
                                /* TEXT */
                              ),
                              (0, import_vue.createElementVNode)(
                                "span",
                                _hoisted_24,
                                "/" + (0, import_vue.toDisplayString)(c.link.max_width || "-"),
                                1
                                /* TEXT */
                              )
                            ]),
                            (0, import_vue.createElementVNode)(
                              "td",
                              null,
                              (0, import_vue.toDisplayString)(c.gsp.supported ? (c.gsp.enabled === true ? "已启用" : c.gsp.enabled === false ? "已关闭" : "未知") + (c.gsp.disable_recommended ? " · 建议关" : "") : "不支持"),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue.createElementVNode)(
                              "td",
                              null,
                              (0, import_vue.toDisplayString)(c.repo_entry ? c.repo_entry.id + " · " + c.repo_entry.driver_version : "无"),
                              1
                              /* TEXT */
                            ),
                            (0, import_vue.createElementVNode)("td", null, [
                              (0, import_vue.createTextVNode)(
                                (0, import_vue.toDisplayString)(c.ready.can_install ? "可安装" : c.ready.blocked_by.join("/") || "缺条目"),
                                1
                                /* TEXT */
                              ),
                              c.ready.missing.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                "span",
                                _hoisted_25,
                                " · 缺 " + (0, import_vue.toDisplayString)(c.ready.missing.join("/")),
                                1
                                /* TEXT */
                              )) : (0, import_vue.createCommentVNode)("v-if", true),
                              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                                import_vue.Fragment,
                                null,
                                (0, import_vue.renderList)(c.warnings, (w) => {
                                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                                    "div",
                                    {
                                      key: w,
                                      class: "dr-warn"
                                    },
                                    (0, import_vue.toDisplayString)(w),
                                    1
                                    /* TEXT */
                                  );
                                }),
                                128
                                /* KEYED_FRAGMENT */
                              ))
                            ])
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ]))
                ]),
                (0, import_vue.createElementVNode)("div", _hoisted_26, [
                  (0, import_vue.createElementVNode)(
                    "div",
                    _hoisted_27,
                    "容器直通 (" + (0, import_vue.toDisplayString)(gpu.value.container.toolkit_installed ? "已装 " + gpu.value.container.version : "未装") + ")",
                    1
                    /* TEXT */
                  ),
                  (0, import_vue.createElementVNode)(
                    "div",
                    _hoisted_28,
                    "docker " + (0, import_vue.toDisplayString)(gpu.value.container.docker ? "已装" : "未装") + " · nvidia-ctk " + (0, import_vue.toDisplayString)(gpu.value.container.nvidia_ctk ? "有" : "无") + " · docker runtime " + (0, import_vue.toDisplayString)(gpu.value.container.docker_runtime_configured ? "已配置" : "未配置") + " · 源文件 " + (0, import_vue.toDisplayString)(gpu.value.container.list_file ? "在" : "无") + " · keyring " + (0, import_vue.toDisplayString)(gpu.value.container.keyring ? "在" : "无"),
                    1
                    /* TEXT */
                  ),
                  (0, import_vue.createElementVNode)("button", {
                    class: "btn btn-sm",
                    disabled: !!busy.value,
                    onClick: _cache[7] || (_cache[7] = ($event) => precheck({ mode: "precheck", kind: "container-toolkit" }))
                  }, "预检安装", 8, _hoisted_29)
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (0, import_vue.createCommentVNode)("v-if", true),
            repo.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_30, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_31,
                "补丁清单 (" + (0, import_vue.toDisplayString)(repo.value.entries.length) + ")",
                1
                /* TEXT */
              ),
              repo.value.error ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                "div",
                _hoisted_32,
                (0, import_vue.toDisplayString)(repo.value.error),
                1
                /* TEXT */
              )) : (0, import_vue.createCommentVNode)("v-if", true),
              !repo.value.entries.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_33, "清单里没有条目")) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("table", _hoisted_34, [
                _cache[25] || (_cache[25] = (0, import_vue.createElementVNode)(
                  "thead",
                  null,
                  [
                    (0, import_vue.createElementVNode)("tr", null, [
                      (0, import_vue.createElementVNode)("th", null, "条目"),
                      (0, import_vue.createElementVNode)("th", null, "适用卡"),
                      (0, import_vue.createElementVNode)("th", null, "版本"),
                      (0, import_vue.createElementVNode)("th", null, "补丁"),
                      (0, import_vue.createElementVNode)("th", null, "官方驱动"),
                      (0, import_vue.createElementVNode)("th", null, "收尾"),
                      (0, import_vue.createElementVNode)("th")
                    ])
                  ],
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)("tbody", null, [
                  ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                    import_vue.Fragment,
                    null,
                    (0, import_vue.renderList)(repo.value.entries, (e) => {
                      return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("tr", {
                        key: e.id
                      }, [
                        (0, import_vue.createElementVNode)("td", null, [
                          (0, import_vue.createTextVNode)(
                            (0, import_vue.toDisplayString)(e.title),
                            1
                            /* TEXT */
                          ),
                          _cache[21] || (_cache[21] = (0, import_vue.createElementVNode)(
                            "br",
                            null,
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_35,
                            (0, import_vue.toDisplayString)(e.id),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue.createElementVNode)("td", _hoisted_36, [
                          (0, import_vue.createTextVNode)(
                            (0, import_vue.toDisplayString)(e.card_names.join(" / ")),
                            1
                            /* TEXT */
                          ),
                          _cache[22] || (_cache[22] = (0, import_vue.createElementVNode)(
                            "br",
                            null,
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_37,
                            (0, import_vue.toDisplayString)(e.card_pci_ids.join(" ")),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue.createElementVNode)(
                          "td",
                          _hoisted_38,
                          (0, import_vue.toDisplayString)(e.driver_version),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue.createElementVNode)("td", null, [
                          (0, import_vue.createTextVNode)(
                            (0, import_vue.toDisplayString)(e.patch.blocks) + " 块",
                            1
                            /* TEXT */
                          ),
                          _cache[23] || (_cache[23] = (0, import_vue.createElementVNode)(
                            "br",
                            null,
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_39,
                            (0, import_vue.toDisplayString)(short(e.patch.result_sha256)),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue.createElementVNode)("td", null, [
                          (0, import_vue.createTextVNode)(
                            (0, import_vue.toDisplayString)(mb(e.base.size_b)),
                            1
                            /* TEXT */
                          ),
                          _cache[24] || (_cache[24] = (0, import_vue.createElementVNode)(
                            "br",
                            null,
                            null,
                            -1
                            /* CACHED */
                          )),
                          (0, import_vue.createElementVNode)(
                            "span",
                            _hoisted_40,
                            (0, import_vue.toDisplayString)(short(e.base.sha256_expected)),
                            1
                            /* TEXT */
                          )
                        ]),
                        (0, import_vue.createElementVNode)(
                          "td",
                          _hoisted_41,
                          (0, import_vue.toDisplayString)(e.post.join(" / ")),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue.createElementVNode)("td", null, [
                          (0, import_vue.createElementVNode)("button", {
                            class: "btn btn-sm",
                            disabled: !!busy.value,
                            onClick: ($event) => precheck({ mode: "precheck", entry_id: e.id })
                          }, "预检", 8, _hoisted_42)
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ]))
            ])) : (0, import_vue.createCommentVNode)("v-if", true),
            plan.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_43, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_44,
                (0, import_vue.toDisplayString)(plan.value.title) + " · " + (0, import_vue.toDisplayString)(plan.value.plan_id) + " · " + (0, import_vue.toDisplayString)(plan.value.kind) + " · " + (0, import_vue.toDisplayString)(plan.value.entry_id),
                1
                /* TEXT */
              ),
              plan.value.source ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_45, [
                (0, import_vue.createTextVNode)(
                  "来源 " + (0, import_vue.toDisplayString)(plan.value.source.repo) + " @" + (0, import_vue.toDisplayString)(plan.value.source.branch) + " ",
                  1
                  /* TEXT */
                ),
                plan.value.source.used ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                  "span",
                  _hoisted_46,
                  "(" + (0, import_vue.toDisplayString)(plan.value.source.used) + ")",
                  1
                  /* TEXT */
                )) : (0, import_vue.createCommentVNode)("v-if", true),
                plan.value.gpg && plan.value.gpg.verified ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("span", _hoisted_47, " · 签名已验证")) : (0, import_vue.createCommentVNode)("v-if", true)
              ])) : (0, import_vue.createCommentVNode)("v-if", true),
              plan.value.base ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_48, [
                (0, import_vue.createTextVNode)(
                  "官方驱动 " + (0, import_vue.toDisplayString)(plan.value.base.version) + " · " + (0, import_vue.toDisplayString)(mb(plan.value.base.size_b)),
                  1
                  /* TEXT */
                ),
                plan.value.base.download ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                  "span",
                  _hoisted_49,
                  " · " + (0, import_vue.toDisplayString)(plan.value.base.download.mode) + " × " + (0, import_vue.toDisplayString)(plan.value.base.download.connections),
                  1
                  /* TEXT */
                )) : (0, import_vue.createCommentVNode)("v-if", true),
                _cache[26] || (_cache[26] = (0, import_vue.createElementVNode)(
                  "br",
                  null,
                  null,
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_50,
                  "sha256 " + (0, import_vue.toDisplayString)(plan.value.base.sha256_expected),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue.createCommentVNode)("v-if", true),
              plan.value.patch ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_51, [
                _cache[27] || (_cache[27] = (0, import_vue.createTextVNode)(
                  "补丁 ",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_52,
                  (0, import_vue.toDisplayString)(plan.value.patch.path),
                  1
                  /* TEXT */
                ),
                _cache[28] || (_cache[28] = (0, import_vue.createTextVNode)(
                  " · 靶点 ",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_53,
                  (0, import_vue.toDisplayString)(plan.value.patch.target),
                  1
                  /* TEXT */
                ),
                (0, import_vue.createTextVNode)(
                  " · " + (0, import_vue.toDisplayString)(plan.value.patch.blocks) + " 块",
                  1
                  /* TEXT */
                ),
                _cache[29] || (_cache[29] = (0, import_vue.createElementVNode)(
                  "br",
                  null,
                  null,
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_54,
                  (0, import_vue.toDisplayString)(short(plan.value.patch.base_sha256)) + " → " + (0, import_vue.toDisplayString)(short(plan.value.patch.result_sha256)),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue.createCommentVNode)("v-if", true),
              plan.value.prereq ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_55, [
                (0, import_vue.createTextVNode)(
                  "前置: " + (0, import_vue.toDisplayString)(plan.value.prereq.length ? plan.value.prereq.join(" / ") : "无"),
                  1
                  /* TEXT */
                ),
                plan.value.conflicts ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                  "span",
                  _hoisted_56,
                  " · 冲突: " + (0, import_vue.toDisplayString)(plan.value.conflicts.length ? plan.value.conflicts.map((c) => c.pkg).join(" / ") : "无"),
                  1
                  /* TEXT */
                )) : (0, import_vue.createCommentVNode)("v-if", true)
              ])) : (0, import_vue.createCommentVNode)("v-if", true),
              plan.value.modprobe ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_57, [
                _cache[30] || (_cache[30] = (0, import_vue.createTextVNode)(
                  "将写入 ",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_58,
                  (0, import_vue.toDisplayString)(plan.value.modprobe.file),
                  1
                  /* TEXT */
                ),
                _cache[31] || (_cache[31] = (0, import_vue.createTextVNode)(
                  ": ",
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_59,
                  (0, import_vue.toDisplayString)(plan.value.modprobe.lines.join(" | ")),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue.createCommentVNode)("v-if", true),
              plan.value.side_effects ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                "div",
                _hoisted_60,
                "initramfs " + (0, import_vue.toDisplayString)(plan.value.side_effects.initramfs ? "会重建" : "不动") + " · 黑名单 " + (0, import_vue.toDisplayString)(plan.value.side_effects.nouveau_blacklist ? "会写" : "不写") + " · 需重启 " + (0, import_vue.toDisplayString)(plan.value.reboot_required ? "是" : "否"),
                1
                /* TEXT */
              )) : (0, import_vue.createCommentVNode)("v-if", true),
              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                import_vue.Fragment,
                null,
                (0, import_vue.renderList)(plan.value.warnings || [], (w) => {
                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                    "div",
                    {
                      key: w,
                      class: "dr-warn"
                    },
                    (0, import_vue.toDisplayString)(w),
                    1
                    /* TEXT */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_61,
                "将执行 (" + (0, import_vue.toDisplayString)(plan.value.commands.length) + ")",
                1
                /* TEXT */
              ),
              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                import_vue.Fragment,
                null,
                (0, import_vue.renderList)(plan.value.commands, (c) => {
                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", {
                    key: c.cmd,
                    class: "dr-cmd"
                  }, [
                    (0, import_vue.createElementVNode)(
                      "span",
                      _hoisted_62,
                      (0, import_vue.toDisplayString)(c.cmd),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue.createElementVNode)(
                      "span",
                      _hoisted_63,
                      " — " + (0, import_vue.toDisplayString)(c.why),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              _cache[32] || (_cache[32] = (0, import_vue.createElementVNode)(
                "div",
                { class: "dr-rule" },
                "确认项",
                -1
                /* CACHED */
              )),
              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                import_vue.Fragment,
                null,
                (0, import_vue.renderList)(plan.value.requires_confirm, (a) => {
                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("label", {
                    key: a,
                    class: "dr-ack"
                  }, [
                    (0, import_vue.withDirectives)((0, import_vue.createElementVNode)("input", {
                      type: "checkbox",
                      value: a,
                      "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => ack.value = $event)
                    }, null, 8, _hoisted_64), [
                      [import_vue.vModelCheckbox, ack.value]
                    ]),
                    (0, import_vue.createTextVNode)(
                      " " + (0, import_vue.toDisplayString)(a),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              (0, import_vue.createElementVNode)("div", _hoisted_65, [
                (0, import_vue.withDirectives)((0, import_vue.createElementVNode)("input", {
                  class: "input",
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => typed.value = $event),
                  placeholder: "输入以确认: " + (plan.value.typed_expect || ""),
                  style: { "width": "260px" }
                }, null, 8, _hoisted_66), [
                  [import_vue.vModelText, typed.value]
                ]),
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm btn-danger",
                  disabled: !!busy.value || ack.value.length < (plan.value.requires_confirm || []).length || typed.value !== plan.value.typed_expect,
                  onClick: doApply
                }, "确认执行", 8, _hoisted_67)
              ])
            ])) : (0, import_vue.createCommentVNode)("v-if", true),
            task.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_68, [
              (0, import_vue.createElementVNode)("div", _hoisted_69, [
                (0, import_vue.createTextVNode)(
                  (0, import_vue.toDisplayString)(task.value.action || "任务") + " " + (0, import_vue.toDisplayString)(task.value.id) + " · " + (0, import_vue.toDisplayString)(task.value.state),
                  1
                  /* TEXT */
                ),
                pct(task.value) != null ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                  "span",
                  _hoisted_70,
                  " · " + (0, import_vue.toDisplayString)(pct(task.value)) + "%",
                  1
                  /* TEXT */
                )) : (0, import_vue.createCommentVNode)("v-if", true)
              ]),
              (0, import_vue.createElementVNode)("div", _hoisted_71, [
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm",
                  disabled: !["queued", "running"].includes(task.value.state),
                  onClick: cancelTask
                }, "取消任务", 8, _hoisted_72),
                task.value.error ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                  "span",
                  _hoisted_73,
                  (0, import_vue.toDisplayString)(task.value.error),
                  1
                  /* TEXT */
                )) : (0, import_vue.createCommentVNode)("v-if", true)
              ]),
              task.value.progress && task.value.progress.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                "div",
                _hoisted_74,
                (0, import_vue.toDisplayString)(task.value.progress[task.value.progress.length - 1].label),
                1
                /* TEXT */
              )) : (0, import_vue.createCommentVNode)("v-if", true),
              ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                import_vue.Fragment,
                null,
                (0, import_vue.renderList)(task.value.commands, (c, i) => {
                  return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", {
                    key: i,
                    class: "dr-cmd"
                  }, [
                    (0, import_vue.createElementVNode)(
                      "span",
                      _hoisted_75,
                      (0, import_vue.toDisplayString)(c.cmd),
                      1
                      /* TEXT */
                    ),
                    (0, import_vue.createElementVNode)(
                      "span",
                      _hoisted_76,
                      " rc=" + (0, import_vue.toDisplayString)(c.rc) + " " + (0, import_vue.toDisplayString)(c.ms) + "ms",
                      1
                      /* TEXT */
                    ),
                    c.out_tail ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)(
                      "div",
                      _hoisted_77,
                      (0, import_vue.toDisplayString)(c.out_tail),
                      1
                      /* TEXT */
                    )) : (0, import_vue.createCommentVNode)("v-if", true)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              task.value.effects && task.value.effects.patch ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_78, [
                (0, import_vue.createTextVNode)(
                  "补丁: 靶点 " + (0, import_vue.toDisplayString)(task.value.effects.patch.target) + " · " + (0, import_vue.toDisplayString)(task.value.effects.patch.already ? "原本已完成" : "已应用") + " · ",
                  1
                  /* TEXT */
                ),
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_79,
                  (0, import_vue.toDisplayString)(short(task.value.effects.patch.sha256)),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue.createCommentVNode)("v-if", true),
              task.value.effects && task.value.effects.nvidia_smi ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_80, [
                (0, import_vue.createElementVNode)(
                  "span",
                  _hoisted_81,
                  (0, import_vue.toDisplayString)(task.value.effects.nvidia_smi),
                  1
                  /* TEXT */
                )
              ])) : (0, import_vue.createCommentVNode)("v-if", true)
            ])) : (0, import_vue.createCommentVNode)("v-if", true),
            (0, import_vue.createElementVNode)("div", _hoisted_82, [
              _cache[33] || (_cache[33] = (0, import_vue.createElementVNode)(
                "div",
                { class: "dr-sec-t" },
                "退路",
                -1
                /* CACHED */
              )),
              (0, import_vue.createElementVNode)("div", _hoisted_83, [
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm",
                  disabled: !!busy.value,
                  onClick: _cache[10] || (_cache[10] = ($event) => doRevert("uninstall"))
                }, "官方卸载", 8, _hoisted_84),
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm",
                  disabled: !!busy.value,
                  onClick: _cache[11] || (_cache[11] = ($event) => doRevert("deb"))
                }, "回 Debian 包", 8, _hoisted_85),
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm",
                  disabled: !!busy.value,
                  onClick: _cache[12] || (_cache[12] = ($event) => doRevert("repatch"))
                }, "回补丁前", 8, _hoisted_86)
              ])
            ]),
            (0, import_vue.createElementVNode)("div", _hoisted_87, [
              (0, import_vue.createElementVNode)(
                "div",
                _hoisted_88,
                "日志 " + (0, import_vue.toDisplayString)(logs.value ? "(" + logs.value.total + ")" : ""),
                1
                /* TEXT */
              ),
              (0, import_vue.createElementVNode)("div", _hoisted_89, [
                (0, import_vue.createElementVNode)("button", {
                  class: "btn btn-sm",
                  disabled: !!busy.value,
                  onClick: loadLogs
                }, "刷新日志", 8, _hoisted_90)
              ]),
              !logs.value ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_91, "未加载")) : !logs.value.items.length ? ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("div", _hoisted_92, "暂无记录")) : ((0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("table", _hoisted_93, [
                _cache[34] || (_cache[34] = (0, import_vue.createElementVNode)(
                  "thead",
                  null,
                  [
                    (0, import_vue.createElementVNode)("tr", null, [
                      (0, import_vue.createElementVNode)("th", null, "时间"),
                      (0, import_vue.createElementVNode)("th", null, "动作"),
                      (0, import_vue.createElementVNode)("th", null, "结果"),
                      (0, import_vue.createElementVNode)("th", null, "命令"),
                      (0, import_vue.createElementVNode)("th", null, "备份")
                    ])
                  ],
                  -1
                  /* CACHED */
                )),
                (0, import_vue.createElementVNode)("tbody", null, [
                  ((0, import_vue.openBlock)(true), (0, import_vue.createElementBlock)(
                    import_vue.Fragment,
                    null,
                    (0, import_vue.renderList)(logs.value.items.slice().reverse(), (l) => {
                      return (0, import_vue.openBlock)(), (0, import_vue.createElementBlock)("tr", {
                        key: l.id + l.ts
                      }, [
                        (0, import_vue.createElementVNode)(
                          "td",
                          _hoisted_94,
                          (0, import_vue.toDisplayString)(new Date(l.ts * 1e3).toLocaleString("zh-CN", { hour12: false })),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue.createElementVNode)(
                          "td",
                          null,
                          (0, import_vue.toDisplayString)(l.action),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue.createElementVNode)(
                          "td",
                          {
                            class: (0, import_vue.normalizeClass)({ "dr-err": l.result !== "ok" })
                          },
                          (0, import_vue.toDisplayString)(l.result),
                          3
                          /* TEXT, CLASS */
                        ),
                        (0, import_vue.createElementVNode)(
                          "td",
                          null,
                          (0, import_vue.toDisplayString)((l.commands || []).length),
                          1
                          /* TEXT */
                        ),
                        (0, import_vue.createElementVNode)(
                          "td",
                          _hoisted_95,
                          (0, import_vue.toDisplayString)(l.backup || "-"),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ]))
            ])
          ])
        ]);
      };
    }
  };
  __sfc_main.__scopeId = "data-v-1nc86li";
  var App_default = __sfc_main;
  (function() {
    var key = "rc-ext-css-data-v-1nc86li-0";
    if (document.getElementById(key)) return;
    var el = document.createElement("style");
    el.id = key;
    el.textContent = "\n.dr-bar[data-v-1nc86li] { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;\n}\n.dr-origin[data-v-1nc86li] { font-size: 12px; color: var(--text-faint); font-family: var(--font-mono);\n}\n.dr-cfg[data-v-1nc86li] { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 20px; margin-bottom: 14px;\n  background: var(--surface); border: 1px solid var(--border); font-size: 12px; color: var(--text-muted);\n}\n.dr-cfg label[data-v-1nc86li], .dr-ack[data-v-1nc86li] { display: flex; align-items: center; gap: 6px;\n}\n.dr-ack[data-v-1nc86li] { font-size: 12px; color: var(--text-muted); margin: 2px 0;\n}\n.dr-sec[data-v-1nc86li] { background: var(--surface); border: 1px solid var(--border); padding: 16px 20px; margin-bottom: 18px;\n}\n.dr-sec-t[data-v-1nc86li] { font-size: 13px; font-weight: 700; color: var(--text); padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border);\n}\n.dr-empty[data-v-1nc86li] { font-size: 12px; color: var(--text-faint); padding: 10px 0;\n}\n.dr-err[data-v-1nc86li] { font-size: 12px; color: var(--danger); padding: 6px 0;\n}\n.dr-warn[data-v-1nc86li] { font-size: 12px; color: var(--danger); margin: 4px 0;\n}\n.dr-rule[data-v-1nc86li] { font-size: 12px; color: var(--text-muted); line-height: 1.9; margin-bottom: 8px;\n}\n.dr-cmd[data-v-1nc86li] { font-size: 12px; color: var(--text-muted); line-height: 1.8; margin-bottom: 4px;\n}\n.dr-out[data-v-1nc86li] { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); white-space: pre-wrap; max-height: 120px; overflow: auto;\n}\n.dr-mono[data-v-1nc86li] { font-family: var(--font-mono);\n}\n.dr-faint[data-v-1nc86li] { color: var(--text-faint);\n}\n.dr-tag[data-v-1nc86li] { margin-left: 6px; padding: 1px 8px; font-size: 10px; color: var(--accent); background: var(--accent-soft);\n}\n.dr-fake[data-v-1nc86li] { margin-left: 8px; padding: 1px 8px; font-size: 10px; color: var(--danger); border: 1px solid var(--border);\n}\n";
    document.head.appendChild(el);
  })();

  // extensions/drivers/frontend/extension.js
  window.__rcExt__ = window.__rcExt__ || {};
  window.__rcExt__.drivers = {
    mount(el, ctx) {
      const app = (0, import_vue3.createApp)(App_default, { ctx });
      app.mount(el);
      return () => app.unmount();
    }
  };
})();
