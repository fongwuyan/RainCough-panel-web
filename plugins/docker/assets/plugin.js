(() => {
  // plugins/docker/frontend/plugin.js
  function register(g) {
    g.__rcPlugin_docker = {
      name: "docker",
      mount: function(container, ctx) {
        const { Vue } = ctx;
        const { createApp, h } = Vue;
        const App = {
          data() {
            return { containers: [], info: null, showAll: false, loading: false, err: "" };
          },
          methods: {
            async load() {
              this.loading = true;
              try {
                const r = await fetch("/api/plugins/docker/containers" + (this.showAll ? "?all=1" : ""));
                const d = await r.json();
                this.containers = d.containers || [];
              } catch (e) {
                this.err = e.message;
              }
              this.loading = false;
            },
            async loadInfo() {
              try {
                const d = await (await fetch("/api/plugins/docker/info")).json();
                this.info = d;
              } catch (e) {
              }
            },
            async act(cid, action) {
              try {
                const d = await (await fetch("/api/plugins/docker/containers/" + action + "/" + cid, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}"
                })).json();
                if (d && d.ok === false) this.err = d.error || "";
                this.load();
              } catch (e) {
                this.err = e.message;
              }
            },
            async logs(cid) {
              try {
                const d = await (await fetch("/api/plugins/docker/containers/logs/" + cid)).json();
                alert(d.logs || "(\u7A7A\u65E5\u5FD7)");
              } catch (e) {
                this.err = e.message;
              }
            }
          },
          mounted() {
            this.load();
            this.loadInfo();
          },
          render() {
            const rows = this.containers.map((c) => h("tr", { key: c.id }, [
              h("td", { class: "mono" }, c.name),
              h("td", { class: "mono faint" }, c.image),
              h("td", null, c.status),
              h("td", { class: "mono faint", style: "font-size:11px;" }, c.ports || "-"),
              h("td", null, h("div", { class: "flex", style: "gap:4px;justify-content:flex-end;" }, [
                h("button", { class: "btn btn-sm", onclick: () => this.act(c.id, "start") }, "\u542F\u52A8"),
                h("button", { class: "btn btn-sm", onclick: () => this.act(c.id, "stop") }, "\u505C\u6B62"),
                h("button", { class: "btn btn-sm", onclick: () => this.act(c.id, "restart") }, "\u91CD\u542F"),
                h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.logs(c.id) }, "\u65E5\u5FD7"),
                h("button", { class: "btn btn-sm btn-danger", onclick: () => this.act(c.id, "remove") }, "\u5220\u9664")
              ]))
            ]));
            return h("div", { class: "docker-panel" }, [
              h("div", { class: "section" }, [
                h("div", { class: "section-title", style: "display:flex;justify-content:space-between;align-items:center;" }, [
                  h("span", null, "Docker \u5BB9\u5668" + (this.info && this.info.version ? " \xB7 v" + this.info.version : "")),
                  h("div", { class: "flex", style: "gap:6px;" }, [
                    h("label", { style: "font-size:12px;display:flex;align-items:center;gap:4px;" }, [
                      h("input", { type: "checkbox", checked: this.showAll, onchange: (e) => {
                        this.showAll = e.target.checked;
                        this.load();
                      } }),
                      "\u663E\u793A\u5DF2\u505C\u6B62"
                    ]),
                    h("button", { class: "btn btn-sm", onclick: () => this.load() }, "\u5237\u65B0")
                  ])
                ]),
                this.err ? h("p", { style: "color:var(--danger);font-size:12px;" }, this.err) : null,
                this.loading ? h("p", { class: "hint" }, "\u52A0\u8F7D\u4E2D...") : h("table", { class: "table" }, [
                  h("thead", null, h("tr", null, [h("th", null, "\u540D\u79F0"), h("th", null, "\u955C\u50CF"), h("th", null, "\u72B6\u6001"), h("th", null, "\u7AEF\u53E3"), h("th", null, "")])),
                  h("tbody", null, rows)
                ])
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
