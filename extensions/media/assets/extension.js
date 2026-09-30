/* RainCough 系统扩展产物 · media · 由 tools/build-extension.js 生成 */
(() => {
  // extensions/media/frontend/extension.js
  (function() {
    var host = window.__rcHost;
    if (!host) {
      console.error("[ext:media] \u5BBF\u4E3B\u8FD0\u884C\u65F6\u7F3A\u5931");
      return;
    }
    var Vue = host.Vue;
    var api = host.api;
    var usePreview = host.usePreview;
    var CSS = [
      ".rc-ext-media .media-toolbar{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}",
      ".rc-ext-media .root-tabs{display:flex;gap:6px;flex-wrap:wrap;}",
      ".rc-ext-media .tab{padding:5px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-muted);font-size:12px;cursor:pointer;}",
      ".rc-ext-media .tab.active{background:var(--accent);border-color:var(--accent);color:#fff;}",
      ".rc-ext-media .root-count{opacity:.75;margin-left:4px;font-size:11px;}",
      ".rc-ext-media .media-actions{display:flex;align-items:center;gap:6px;}",
      ".rc-ext-media .media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;}",
      ".rc-ext-media .media-card{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface-2);cursor:pointer;transition:border-color .15s;}",
      ".rc-ext-media .media-card:hover{border-color:var(--accent);}",
      ".rc-ext-media .media-thumb{height:160px;background:#0a0d10;}",
      ".rc-ext-media .media-thumb img{width:100%;height:100%;object-fit:cover;display:block;}",
      ".rc-ext-media .video-thumb{width:100%;height:100%;background-size:cover;background-position:center;position:relative;}",
      ".rc-ext-media .video-badge{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;color:rgba(255,255,255,.9);text-shadow:0 1px 6px rgba(0,0,0,.7);}",
      ".rc-ext-media .media-info{padding:8px 10px;}",
      ".rc-ext-media .media-name{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".rc-ext-media .media-meta{display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:4px;}",
      ".rc-ext-media .modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:100;}",
      ".rc-ext-media .modal{background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-md);padding:16px;width:560px;max-width:92vw;}",
      ".rc-ext-media .modal-title{font-weight:700;margin-bottom:12px;}",
      ".rc-ext-media .root-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;}",
      ".rc-ext-media .tag-info{margin-top:8px;font-size:12px;color:var(--text-muted);}",
      ".rc-ext-media .tag-chips{margin-top:6px;}",
      ".rc-ext-media .chip{display:inline-block;font-size:11px;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1px 6px;}",
      ".rc-ext-media .dedup-list{max-height:55vh;overflow:auto;}",
      ".rc-ext-media .dedup-note{font-size:12px;color:var(--text-muted);margin-bottom:10px;}",
      ".rc-ext-media .dedup-group{border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 10px;margin-bottom:8px;background:var(--surface-2);}",
      ".rc-ext-media .dedup-title{font-size:12px;font-weight:700;margin-bottom:6px;}",
      ".rc-ext-media .dedup-row{display:flex;align-items:center;gap:8px;padding:3px 0;}",
      ".rc-ext-media .dedup-path{flex:1;font-family:var(--font-mono);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}"
    ].join("\n");
    function injectStyle() {
      if (document.getElementById("rc-ext-media-style")) return;
      var el = document.createElement("style");
      el.id = "rc-ext-media-style";
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    var TEMPLATE = `
  <div class="rc-ext-media">
    <div class="page">
      <div class="page-head">
        <h1>\u5A92\u4F53\u4E2D\u5FC3</h1>
        <div class="subtitle">\u805A\u5408\u6D4F\u89C8\u670D\u52A1\u5668\u56FE\u7247\u4E0E\u89C6\u9891 \xB7 \u7CFB\u7EDF\u6269\u5C55</div>
        <div class="media-toolbar">
          <div class="root-tabs">
            <button v-for="r in roots" :key="r.name" class="tab" :class="{ active: activeRoot === r.name }" @click="switchRoot(r.name)">
              {{ r.label }}
              <span v-if="counts[r.name]" class="root-count">{{ counts[r.name].image }}\u56FE/{{ counts[r.name].video }}\u89C6\u9891</span>
            </button>
          </div>
          <div class="media-actions">
            <button class="btn btn-sm" :class="{ 'btn-primary': kind === '' }" @click="switchKind('')">\u5168\u90E8</button>
            <button class="btn btn-sm" :class="{ 'btn-primary': kind === 'image' }" @click="switchKind('image')">\u56FE\u7247</button>
            <button class="btn btn-sm" :class="{ 'btn-primary': kind === 'video' }" @click="switchKind('video')">\u89C6\u9891</button>
            <input v-model="tagFilter" class="input" style="width:140px;" placeholder="\u6807\u7B7E\u7B5B\u9009\uFF08\u9017\u53F7\u5206\u9694\uFF09" @keydown.enter="doTagSearch" />
            <button class="btn btn-sm" @click="doTagSearch">\u7B5B\u9009</button>
            <button class="btn btn-sm" :disabled="tagging || !imageCount" @click="doTagBatch">
              {{ tagging ? '\u6253\u6807\u4E2D\u2026' : '\u6253\u6807\u5F53\u524D' }}
            </button>
            <button class="btn btn-sm" :disabled="dedupLoading" @click="doDedup">\u76F8\u4F3C\u68C0\u6D4B</button>
            <button class="btn btn-sm btn-ghost" style="margin-left:8px;" @click="openRootsEditor">\u7F16\u8F91\u6839\u76EE\u5F55</button>
          </div>
        </div>
        <div v-if="tagInfo" class="tag-info">{{ tagInfo }}</div>
      </div>

      <div class="page-body">
        <div v-if="error" class="error" style="margin-bottom:10px;">{{ error }}</div>
        <div v-if="loading && !items.length" class="status-line" style="padding:20px;">\u52A0\u8F7D\u4E2D...</div>
        <div v-else-if="!items.length && !loading" class="empty" style="padding:40px;">\u6682\u65E0\u5A92\u4F53</div>

        <div v-if="items.length" class="media-grid">
          <div v-for="item in items" :key="item.path" class="media-card" @click="openView(item)">
            <div class="media-thumb">
              <template v-if="item.kind === 'image'">
                <img :src="api.mediaThumb(item.path)" loading="lazy" :alt="item.name" />
              </template>
              <template v-else>
                <div class="video-thumb" :style="thumbStyle(item)">
                  <span class="video-badge">\u25B6</span>
                </div>
              </template>
            </div>
            <div class="media-info">
              <div class="media-name" :title="item.name">{{ item.name }}</div>
              <div class="media-meta">
                <span>{{ fmtSize(item.size) }}</span>
                <span>{{ fmtTime(item.mtime) }}</span>
              </div>
              <div v-if="item.tags && (item.tags.general || []).length" class="tag-chips">
                <span class="chip">{{ item.tags.general.slice(0, 5).join('\u3001') }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasMore" style="text-align:center;padding:14px;">
          <button class="btn btn-sm" :disabled="loading" @click="load(false)">
            {{ loading ? '\u52A0\u8F7D\u4E2D\u2026' : ('\u52A0\u8F7D\u66F4\u591A\uFF08' + items.length + ' / ' + total + '\uFF09') }}
          </button>
        </div>
      </div>

      <div v-if="showRootsEditor" class="modal-mask" @click.self="showRootsEditor = false">
        <div class="modal">
          <div class="modal-title">\u7F16\u8F91\u5A92\u4F53\u6839\u76EE\u5F55</div>
          <div style="max-height:50vh;overflow:auto;">
            <div v-for="(r, i) in editRoots" :key="i" class="root-row">
              <input v-model="r.label" class="input" style="width:110px;" placeholder="\u663E\u793A\u540D" />
              <input v-model="r.path" class="input" style="flex:1;" placeholder="\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u5982 /opt/touchgal/plugins/aigen/output" />
              <button class="btn btn-sm btn-danger" @click="removeRoot(i)">\u5220\u9664</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;justify-content:space-between;">
            <button class="btn btn-sm" @click="addRoot">+ \u6DFB\u52A0\u6839\u76EE\u5F55</button>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-sm btn-ghost" @click="showRootsEditor = false">\u53D6\u6D88</button>
              <button class="btn btn-sm btn-primary" @click="saveRoots">\u4FDD\u5B58</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showDedup" class="modal-mask" @click.self="showDedup = false">
        <div class="modal">
          <div class="modal-title">
            \u76F8\u4F3C\u56FE\u7247\u68C0\u6D4B
            <button class="btn btn-sm btn-ghost" style="float:right;" @click="showDedup = false">\u5173\u95ED</button>
          </div>
          <div v-if="dedupLoading" class="status-line" style="padding:16px;">\u626B\u63CF\u4E2D\u2026\uFF08\u9700\u6570\u5206\u949F\uFF09</div>
          <div v-else-if="!dedupGroups.length" class="empty" style="padding:20px;">\u672A\u53D1\u73B0\u76F8\u4F3C\u7EC4\uFF08\u626B\u63CF {{ dedupScanned }} \u5F20\uFF09</div>
          <div v-else class="dedup-list">
            <div class="dedup-note">\u53D1\u73B0 {{ dedupGroups.length }} \u7EC4\u7591\u4F3C\u91CD\u590D\uFF08\u5171\u626B\u63CF {{ dedupScanned }} \u5F20\uFF09</div>
            <div v-for="(g, gi) in dedupGroups" :key="gi" class="dedup-group">
              <div class="dedup-title">\u7EC4 {{ gi + 1 }}\uFF08{{ g.length }} \u5F20\uFF09</div>
              <div v-for="p in g" :key="p" class="dedup-row">
                <span class="dedup-path" :title="p">{{ p }}</span>
                <button class="btn btn-sm btn-danger" :disabled="deleting[p]" @click="deleteDup(p)">\u5220\u9664</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
    var MediaCenter = {
      name: "MediaCenterExt",
      template: TEMPLATE,
      setup: function() {
        var preview = usePreview();
        var roots = Vue.ref([]);
        var activeRoot = Vue.ref("");
        var kind = Vue.ref("");
        var items = Vue.ref([]);
        var page = Vue.ref(0);
        var total = Vue.ref(0);
        var loading = Vue.ref(false);
        var error = Vue.ref("");
        var counts = Vue.ref({});
        var showRootsEditor = Vue.ref(false);
        var editRoots = Vue.ref([]);
        var tagFilter = Vue.ref("");
        var tagging = Vue.ref(false);
        var tagInfo = Vue.ref("");
        var showDedup = Vue.ref(false);
        var dedupGroups = Vue.ref([]);
        var dedupScanned = Vue.ref(0);
        var dedupLoading = Vue.ref(false);
        var deleting = Vue.ref({});
        var hasMore = Vue.computed(function() {
          return items.value.length < total.value;
        });
        var imageCount = Vue.computed(function() {
          return items.value.filter(function(i) {
            return i.kind === "image";
          }).length;
        });
        function fmtSize(b) {
          b = b || 0;
          if (b < 1024) return b + " B";
          var u = ["KB", "MB", "GB", "TB"];
          var i = -1;
          var v = b;
          while (v >= 1024 && i < u.length - 1) {
            v /= 1024;
            i++;
          }
          return v.toFixed(1) + " " + u[i];
        }
        function fmtTime(ts) {
          if (!ts) return "-";
          var d = new Date(ts * 1e3);
          var p = function(n) {
            return String(n).padStart(2, "0");
          };
          return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
        }
        function thumbStyle(item) {
          return { backgroundImage: "url(" + api.mediaThumb(item.path) + ")" };
        }
        async function loadRoots() {
          try {
            var d = await api.mediaRoots();
            roots.value = d.roots || [];
            if (!activeRoot.value && roots.value.length) activeRoot.value = roots.value[0].name;
          } catch (e) {
            error.value = e.message;
          }
        }
        async function loadStats() {
          try {
            var d = await api.mediaStats();
            counts.value = d.counts || {};
          } catch (e) {
          }
        }
        async function load(reset) {
          if (reset === void 0) reset = true;
          if (!activeRoot.value) return;
          loading.value = true;
          error.value = "";
          try {
            var d = await api.mediaList(activeRoot.value, kind.value, reset ? 0 : page.value, tagFilter.value);
            total.value = d.total;
            items.value = reset ? d.items || [] : items.value.concat(d.items || []);
            page.value = d.page + 1;
          } catch (e) {
            error.value = e.message;
          } finally {
            loading.value = false;
          }
        }
        async function doTagBatch() {
          var paths = items.value.filter(function(i) {
            return i.kind === "image";
          }).map(function(i) {
            return i.path;
          });
          if (!paths.length) return;
          tagging.value = true;
          tagInfo.value = "";
          error.value = "";
          try {
            var d = await api.mediaTag(paths);
            var done = d.results.filter(function(r) {
              return !r.error;
            }).length;
            var failed = d.results.length - done;
            tagInfo.value = "\u6253\u6807\u5B8C\u6210\uFF1A\u6210\u529F " + done + "\uFF0C\u5931\u8D25 " + failed + "\uFF08\u5355\u5F20\u7EA6 1-3s\uFF0C\u8BF7\u7A0D\u5019\uFF09";
            await load(true);
          } catch (e) {
            error.value = e.message;
          } finally {
            tagging.value = false;
          }
        }
        function doTagSearch() {
          load(true);
        }
        async function doDedup() {
          if (!activeRoot.value) return;
          dedupLoading.value = true;
          error.value = "";
          showDedup.value = true;
          dedupGroups.value = [];
          try {
            var d = await api.mediaDedup(activeRoot.value);
            dedupGroups.value = d.groups || [];
            dedupScanned.value = d.scanned || 0;
          } catch (e) {
            error.value = e.message;
          } finally {
            dedupLoading.value = false;
          }
        }
        async function deleteDup(path) {
          if (!window.confirm("\u786E\u5B9A\u5220\u9664\uFF1F\n" + path)) return;
          deleting.value[path] = true;
          try {
            await api.fmDelete([path]);
            dedupGroups.value = dedupGroups.value.map(function(g) {
              return g.filter(function(p) {
                return p !== path;
              });
            }).filter(function(g) {
              return g.length > 1;
            });
          } catch (e) {
            error.value = e.message;
          } finally {
            delete deleting.value[path];
          }
        }
        function switchRoot(name) {
          if (name === activeRoot.value) return;
          activeRoot.value = name;
          load(true);
        }
        function switchKind(k) {
          if (k === kind.value) return;
          kind.value = k;
          load(true);
        }
        function openView(item) {
          if (item.kind !== "image") {
            window.open(api.mediaFile(item.path), "_blank");
            return;
          }
          var list = items.value.filter(function(i) {
            return i.kind === "image";
          }).map(function(i) {
            return api.mediaFile(i.path);
          });
          var idx = list.indexOf(api.mediaFile(item.path));
          preview.open(list, idx < 0 ? 0 : idx);
        }
        function openRootsEditor() {
          editRoots.value = roots.value.map(function(r) {
            return { name: r.name, label: r.label, path: r.path };
          });
          showRootsEditor.value = true;
        }
        function addRoot() {
          editRoots.value.push({ name: "", label: "", path: "" });
        }
        function removeRoot(i) {
          editRoots.value.splice(i, 1);
        }
        async function saveRoots() {
          try {
            await api.mediaSaveRoots(editRoots.value);
            showRootsEditor.value = false;
            await loadRoots();
            await loadStats();
            if (activeRoot.value) await load(true);
          } catch (e) {
            error.value = e.message;
          }
        }
        Vue.onMounted(async function() {
          await loadRoots();
          await loadStats();
          await load(true);
        });
        return {
          api,
          preview,
          roots,
          activeRoot,
          kind,
          items,
          page,
          total,
          loading,
          error,
          counts,
          showRootsEditor,
          editRoots,
          tagFilter,
          tagging,
          tagInfo,
          showDedup,
          dedupGroups,
          dedupScanned,
          dedupLoading,
          deleting,
          hasMore,
          imageCount,
          fmtSize,
          fmtTime,
          thumbStyle,
          load,
          doTagBatch,
          doTagSearch,
          doDedup,
          deleteDup,
          switchRoot,
          switchKind,
          openView,
          openRootsEditor,
          addRoot,
          removeRoot,
          saveRoots
        };
      }
    };
    window.__rcExt__ = window.__rcExt__ || {};
    window.__rcExt__.media = {
      mount: function(el) {
        injectStyle();
        var app = Vue.createApp(MediaCenter);
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
})();
