(() => {
  // plugins/JMComic/frontend/plugin.js
  function register(g) {
    g.__rcPlugin_JMComic = {
      name: "JMComic",
      mount: function(container, ctx) {
        const { Vue } = ctx;
        const { createApp, h } = Vue;
        const App = {
          data() {
            return { keyword: "", albums: [], library: [], loading: false, err: "", view: null, meta: null };
          },
          methods: {
            async search(page) {
              const kw = this.keyword.trim();
              if (!kw) return;
              this.loading = true;
              this.err = "";
              try {
                const d = await (await fetch("/api/plugins/JMComic/search?keyword=" + encodeURIComponent(kw) + "&page=" + (page || 1))).json();
                if (d.ok === false) {
                  this.err = d.error || "\u641C\u7D22\u5931\u8D25";
                }
                this.albums = d.albums || [];
              } catch (e) {
                this.err = e.message;
              }
              this.loading = false;
            },
            async loadLibrary() {
              try {
                const d = await (await fetch("/api/plugins/JMComic/library")).json();
                this.library = d.library || [];
              } catch (e) {
              }
            },
            async openMeta(aid) {
              try {
                const d = await (await fetch("/api/plugins/JMComic/meta/" + aid)).json();
                this.meta = d && d.meta || null;
                this.view = this.meta ? "meta" : null;
              } catch (e) {
                this.err = e.message;
              }
            },
            close() {
              this.view = null;
              this.meta = null;
            },
            async download(aid) {
              try {
                await fetch("/api/plugins/JMComic/download", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ aid })
                });
                alert("\u5DF2\u52A0\u5165\u4E0B\u8F7D\u961F\u5217");
              } catch (e) {
                this.err = e.message;
              }
            },
            addLib(aid, title, cover) {
              fetch("/api/plugins/JMComic/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aid, title, cover })
              }).then(() => this.loadLibrary()).catch(() => {
              });
            }
          },
          mounted() {
            this.loadLibrary();
          },
          render() {
            const card = (a) => h("div", { key: a.aid, class: "card", style: "cursor:pointer;overflow:hidden;" }, [
              a.cover ? h("img", { src: a.cover, style: "width:100%;height:140px;object-fit:cover;background:#0a0d10;", onclick: () => this.openMeta(a.aid) }) : null,
              h("div", { style: "padding:8px;" }, [
                h("div", { style: "font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", onclick: () => this.openMeta(a.aid), title: a.title }, a.title),
                h("div", { class: "mono faint", style: "font-size:10px;margin:2px 0 6px;" }, a.author || ""),
                h("div", { class: "flex", style: "gap:4px;" }, [
                  h("button", { class: "btn btn-sm", onclick: () => this.download(a.aid) }, "\u4E0B\u8F7D"),
                  h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.addLib(a.aid, a.title, a.cover) }, "\u6536\u85CF")
                ])
              ])
            ]);
            const grid = (list) => h("div", { class: "card-grid", style: "grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;" }, list.map(card));
            const metaView = this.view === "meta" && this.meta ? h("div", { class: "section" }, [
              h("div", { class: "section-title" }, [h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.close() }, "\u2190 \u8FD4\u56DE"), " " + (this.meta.title || "")]),
              h("p", { class: "mono faint", style: "font-size:11px;" }, "\u4F5C\u8005: " + (this.meta.author || "-") + " \xB7 " + (this.meta.series || "")),
              h("div", { class: "flex", style: "gap:8px;margin-top:8px;" }, [
                h("button", { class: "btn btn-primary", onclick: () => this.download(this.meta.aid || "") }, "\u4E0B\u8F7D\u5168\u672C")
              ]),
              h("p", { class: "hint", style: "margin-top:8px;" }, "\u8BE6\u60C5\u5B57\u6BB5: " + JSON.stringify(Object.keys(this.meta).slice(0, 10)))
            ]) : null;
            return h("div", { class: "jm-panel" }, [
              h("div", { class: "section" }, [
                h("div", { class: "section-title" }, "JMComic \u641C\u7D22"),
                h("div", { class: "flex", style: "gap:8px;margin-bottom:8px;" }, [
                  h("input", { placeholder: "\u641C\u7D22\u6F2B\u753B...", value: this.keyword, oninput: (e) => this.keyword = e.target.value, class: "input", style: "flex:1;", onkeydown: (e) => {
                    if (e.key === "Enter") this.search();
                  } }),
                  h("button", { class: "btn btn-primary", onclick: () => this.search(), disabled: this.loading }, this.loading ? "\u641C\u7D22\u4E2D..." : "\u641C\u7D22")
                ]),
                this.err ? h("p", { style: "color:var(--danger);font-size:12px;" }, this.err) : null
              ]),
              metaView,
              this.albums.length ? h("div", { class: "section" }, [
                h("div", { class: "section-title" }, "\u641C\u7D22\u7ED3\u679C(" + this.albums.length + ")"),
                grid(this.albums)
              ]) : null,
              h("div", { class: "section" }, [
                h("div", { class: "section-title" }, "\u6211\u7684\u6536\u85CF(" + this.library.length + ")"),
                this.library.length ? grid(this.library.map((x) => ({ aid: String(x.aid), title: x.title, cover: x.cover, author: "" }))) : h("p", { class: "hint" }, "\u6682\u65E0\u6536\u85CF")
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
