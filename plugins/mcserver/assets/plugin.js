(() => {
  // plugins/mcserver/frontend/plugin.js
  function register(g) {
    g.__rcPlugin_mcserver = {
      name: "mcserver",
      mount: function(container, ctx) {
        const { Vue } = ctx;
        const { createApp, h } = Vue;
        const App = {
          data() {
            return { instances: [], newName: "", newDir: "", newPort: 25565, err: "", console: null, polling: false };
          },
          methods: {
            async load() {
              try {
                const d = await (await fetch("/api/plugins/mcserver/instances")).json();
                this.instances = d.instances || [];
              } catch (e) {
                this.err = e.message;
              }
            },
            async add() {
              if (!this.newName) return;
              try {
                await fetch("/api/plugins/mcserver/instance/add", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: this.newName, dir: this.newDir || "/opt/mc/" + this.newName, port: this.newPort })
                });
                this.newName = "";
                this.load();
              } catch (e) {
                this.err = e.message;
              }
            },
            async act(name, action) {
              try {
                const d = await (await fetch("/api/plugins/mcserver/" + action, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name })
                })).json();
                if (d && d.ok === false) this.err = d.error || "";
                this.load();
              } catch (e) {
                this.err = e.message;
              }
            },
            async del(name) {
              if (!confirm("\u5220\u9664\u5B9E\u4F8B " + name + " ?")) return;
              try {
                await fetch("/api/plugins/mcserver/instance/remove", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name })
                });
                this.load();
              } catch (e) {
                this.err = e.message;
              }
            },
            async showConsole(name) {
              try {
                const d = await (await fetch("/api/plugins/mcserver/console?name=" + name)).json();
                alert(d.console || "(\u7A7A\u63A7\u5236\u53F0)");
              } catch (e) {
                this.err = e.message;
              }
            }
          },
          mounted() {
            this.load();
          },
          render() {
            const rows = this.instances.map((it) => h("tr", { key: it.name }, [
              h("td", { class: "mono" }, it.name),
              h("td", { class: "mono faint", style: "font-size:11px;" }, it.dir || "-"),
              h("td", { class: "mono" }, it.port || 25565),
              h("td", null, it.running ? h("span", { class: "tag-chip", style: "background:var(--success);color:#fff;" }, "\u8FD0\u884C\u4E2D") : h("span", { class: "tag-chip" }, "\u5DF2\u505C\u6B62")),
              h("td", null, it.online ? h("span", { style: "color:var(--success);font-size:12px;" }, "\u5728\u7EBF") : h("span", { style: "color:var(--text-faint);font-size:12px;" }, "\u79BB\u7EBF")),
              h("td", null, h("div", { class: "flex", style: "gap:4px;justify-content:flex-end;" }, [
                h("button", { class: "btn btn-sm", onclick: () => this.act(it.name, "start") }, "\u542F\u52A8"),
                h("button", { class: "btn btn-sm", onclick: () => this.act(it.name, "stop") }, "\u505C\u6B62"),
                h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.showConsole(it.name) }, "\u63A7\u5236\u53F0"),
                h("button", { class: "btn btn-sm btn-danger", onclick: () => this.del(it.name) }, "\u5220\u9664")
              ]))
            ]));
            return h("div", { class: "mc-panel" }, [
              h("div", { class: "section" }, [
                h("div", { class: "section-title", style: "display:flex;justify-content:space-between;" }, [
                  h("span", null, "MC \u670D\u52A1\u5668\u5B9E\u4F8B"),
                  h("button", { class: "btn btn-sm", onclick: () => this.load() }, "\u5237\u65B0")
                ]),
                this.err ? h("p", { style: "color:var(--danger);font-size:12px;" }, this.err) : null,
                h("div", { class: "flex", style: "gap:8px;margin-bottom:8px;" }, [
                  h("input", { placeholder: "\u5B9E\u4F8B\u540D(\u5982 smp)", value: this.newName, oninput: (e) => this.newName = e.target.value, class: "input", style: "width:120px;" }),
                  h("input", { placeholder: "\u76EE\u5F55(\u9ED8\u8BA4 /opt/mc/<\u540D>)", value: this.newDir, oninput: (e) => this.newDir = e.target.value, class: "input", style: "flex:1;" }),
                  h("input", { placeholder: "\u7AEF\u53E3", value: this.newPort, oninput: (e) => this.newPort = e.target.value, class: "input", style: "width:70px;" }),
                  h("button", { class: "btn btn-primary", onclick: () => this.add() }, "+ \u5B9E\u4F8B")
                ]),
                h("table", { class: "table" }, [
                  h("thead", null, h("tr", null, [h("th", null, "\u540D\u79F0"), h("th", null, "\u76EE\u5F55"), h("th", null, "\u7AEF\u53E3"), h("th", null, "\u72B6\u6001"), h("th", null, "\u5728\u7EBF"), h("th", null, "")])),
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
