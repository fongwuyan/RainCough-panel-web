(() => {
  // plugins/laizhangsetu/frontend/plugin.js
  function register(g) {
    g.__rcPlugin_laizhangsetu = {
      name: "laizhangsetu",
      mount: function(container, ctx) {
        const { Vue } = ctx;
        const { createApp, h } = Vue;
        const App = {
          data() {
            return { tags: "", r18: false, num: 1, items: [], history: [], loading: false, err: "" };
          },
          methods: {
            async fetch() {
              this.loading = true;
              this.err = "";
              try {
                const r = await fetch("/api/plugins/laizhangsetu/fetch", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tags: this.tags.split(/[,\s。]+/).filter(Boolean),
                    r18: this.r18,
                    num: Number(this.num) || 1
                  })
                });
                const d = await r.json();
                this.items = d.items || [];
                this.loadHistory();
              } catch (e) {
                this.err = e.message;
              }
              this.loading = false;
            },
            async loadHistory() {
              try {
                const r = await fetch("/api/plugins/laizhangsetu/history");
                const d = await r.json();
                this.history = d.history || [];
              } catch (e) {
              }
            }
          },
          mounted() {
            this.loadHistory();
          },
          render() {
            const imgs = (this.items.length ? this.items : this.history).map((it) => h("div", { key: it.pid || Math.random(), class: "card", style: "padding:6px;" }, [
              it.url ? h("img", { src: it.url, loading: "lazy", style: "width:100%;display:block;background:#0a0d10;" }) : null,
              h("div", { style: "font-size:11px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, it.title || "PID " + it.pid),
              h("a", { href: it.url, target: "_blank", class: "mono faint", style: "font-size:10px;" }, "\u539F\u56FE \u2197")
            ]));
            return h("div", { class: "ls-panel" }, [
              h("div", { class: "section" }, [
                h("div", { class: "section-title" }, "\u6765\u5F20\u6DA9\u56FE(Pixiv / Lolicon API)"),
                h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center;" }, [
                  h("input", { placeholder: "\u6807\u7B7E, \u9017\u53F7\u5206\u9694(\u5982: \u767D\u4E1D, \u5154\u5973\u90CE)", value: this.tags, oninput: (e) => this.tags = e.target.value, class: "input", style: "flex:1;min-width:180px;" }),
                  h(
                    "select",
                    { value: this.num, onchange: (e) => this.num = e.target.value, class: "input", style: "width:70px;" },
                    [1, 2, 3, 5].map((n) => h("option", { value: n }, n + " \u5F20"))
                  ),
                  h("label", { style: "display:flex;align-items:center;gap:4px;font-size:12px;" }, [
                    h("input", { type: "checkbox", checked: this.r18, onchange: (e) => this.r18 = e.target.checked }),
                    "R18"
                  ]),
                  h(
                    "button",
                    { class: "btn btn-primary", onclick: () => this.fetch(), disabled: this.loading },
                    this.loading ? "\u83B7\u53D6\u4E2D..." : "\u83B7\u53D6"
                  )
                ]),
                this.err ? h("p", { style: "color:var(--danger);font-size:12px;" }, this.err) : null
              ]),
              h("div", { class: "section" }, [
                h("div", { class: "section-title" }, this.items.length ? "\u672C\u6B21\u7ED3\u679C" : "\u5386\u53F2\u8BB0\u5F55"),
                h("div", { class: "card-grid", style: "grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;" }, imgs),
                !imgs.length && !this.loading ? h("p", { class: "hint" }, "\u6682\u65E0\u56FE\u7247, \u70B9\u51FB\u83B7\u53D6") : null
              ])
            ]);
          }
        };
        const vm = createApp(App);
        vm.mount(container);
        return () => vm.unmount();
      }
    };
  }
  if (typeof window !== "undefined") {
    register(window);
  }
})();
