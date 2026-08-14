<script setup>
import { ref } from 'vue'

const active = ref(0)
const chapters = [
  { label: '目录结构', title: '目录结构' },
  { label: '后端插件', title: '编写后端插件' },
  { label: '路由请求', title: '插件路由与请求' },
  { label: '系统 API', title: '系统级 API' },
  { label: '前端页面', title: '编写前端页面' },
  { label: '安装分发', title: '安装与分发插件' },
  { label: '完整示例', title: '完整示例：Hello 插件' },
]
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>插件开发文档</h1>
      <div class="subtitle">如何为 TouchGal 编写插件</div>

      <div class="tabs">
        <button
          v-for="(c, i) in chapters"
          :key="i"
          class="tab"
          :class="{ active: active === i }"
          @click="active = i"
        >{{ c.label }}</button>
      </div>
    </div>

    <div class="page-body">

      <div v-show="active === 0" class="doc-section">
        <h3>目录结构</h3>
        <p>插件是位于 <code>plugins/</code> 目录下的一个文件夹，后端入口必须是 <code>plugin.py</code>：</p>
        <pre><code>plugins/
  base.py               # Plugin 基类与 PluginManager（框架自带）
  converter.py          # Java 插件转换器（框架自带）
  your_plugin/          # 你的插件目录
    plugin.py           # 后端入口，必须定义 Plugin 子类
    data.json           # 可选：插件自己的数据/配置
    cache/              # 可选：静态资源目录，可经 /cache/ 直接访问</code></pre>
      </div>

      <div v-show="active === 1" class="doc-section">
        <h3>编写后端插件</h3>
        <p>在 <code>plugin.py</code> 中定义 <code>Plugin</code> 的子类，框架启动时会自动扫描并加载。</p>
        <pre><code>from plugins.base import Plugin
from flask import jsonify


class HelloPlugin(Plugin):
    name = 'hello'            # 唯一标识，用于路由 /api/plugins/hello/*
    label = 'Hello 插件'       # 侧边栏显示名
    icon = ''                 # 图标（可选）
    description = '一个示例插件'

    def _register_routes(self):
        self.route('/ping')(self.ping)

    def ping(self):
        return jsonify({'message': 'pong'})</code></pre>
        <p><code>Plugin</code> 基类接口：</p>
        <table>
          <thead>
            <tr><th>成员</th><th>类型</th><th>说明</th></tr>
          </thead>
          <tbody>
            <tr><td><code>name</code></td><td>类属性</td><td>插件唯一标识，同时决定 <code>/api/plugins/&lt;name&gt;/*</code> 路径</td></tr>
            <tr><td><code>label</code></td><td>类属性</td><td>界面中显示的插件名称</td></tr>
            <tr><td><code>icon</code></td><td>类属性</td><td>可选图标（预留）</td></tr>
            <tr><td><code>description</code></td><td>类属性</td><td>插件简介，显示在侧边栏</td></tr>
            <tr><td><code>_register_routes()</code></td><td>抽象方法</td><td>在此调用 <code>self.route(...)</code> 注册路由</td></tr>
            <tr><td><code>route(path, methods=['GET'])</code></td><td>方法</td><td>路由装饰器，支持 GET/POST/DELETE</td></tr>
          </tbody>
        </table>
        <p>路由匹配规则：请求 <code>/api/plugins/&lt;name&gt;/&lt;subpath&gt;</code> 时，先精确匹配 <code>subpath</code>，再按前缀匹配，未命中返回 404。</p>
      </div>

      <div v-show="active === 2" class="doc-section">
        <h3>插件路由与请求</h3>
        <p>路由处理函数可正常使用 Flask 的 <code>request</code> 与响应工具，并按需读取 <code>request.path</code> 解析参数：</p>
        <pre><code>from flask import request, jsonify, send_file
import os

class DemoPlugin(Plugin):
    name = 'demo'
    label = 'Demo'
    description = ''

    def _register_routes(self):
        self.route('/echo', methods=['POST'])(self.echo)
        self.route('/data/', methods=['GET'])(self.data)
        self.route('/file/', methods=['GET'])(self.file)

    def echo(self):
        payload = request.get_json(force=True, silent=True) or {}
        return jsonify({'received': payload})

    def data(self):
        # 尾部路径参数：/api/plugins/demo/data/123
        sub = request.path.rsplit('/data/', 1)[-1]
        return jsonify({'id': sub})

    def file(self):
        base = os.path.dirname(__file__)
        return send_file(os.path.join(base, 'demo.txt'))</code></pre>
        <p>GET/POST/DELETE 均会转发到 <code>dispatch()</code>，处理函数只需关心业务逻辑。</p>
      </div>

      <div v-show="active === 3" class="doc-section">
        <h3>系统级 API</h3>
        <p>框架为插件管理和静态资源提供了以下接口：</p>
        <table>
          <thead>
            <tr><th>方法</th><th>路径</th><th>说明</th></tr>
          </thead>
          <tbody>
            <tr><td><code>GET</code></td><td><code>/api/plugins</code></td><td>列出所有已加载插件</td></tr>
            <tr><td><code>GET</code></td><td><code>/api/plugins/&lt;name&gt;</code></td><td>获取插件基本信息</td></tr>
            <tr><td><code>GET</code></td><td><code>/api/plugins/&lt;name&gt;/&lt;subpath&gt;</code></td><td>插件路由分发</td></tr>
            <tr><td><code>POST</code></td><td><code>/api/plugins/&lt;name&gt;/&lt;subpath&gt;</code></td><td>同上（POST 请求体为 JSON）</td></tr>
            <tr><td><code>DELETE</code></td><td><code>/api/plugins/&lt;name&gt;/&lt;subpath&gt;</code></td><td>同上（DELETE）</td></tr>
            <tr><td><code>GET</code></td><td><code>/api/plugins/&lt;name&gt;/cache/&lt;path&gt;</code></td><td>访问插件 <code>cache/</code> 目录下的静态文件</td></tr>
            <tr><td><code>POST</code></td><td><code>/api/plugins/install</code></td><td>上传 .zip 安装插件（multipart，字段名 <code>file</code>）</td></tr>
            <tr><td><code>DELETE</code></td><td><code>/api/plugins/&lt;name&gt;</code></td><td>卸载并删除插件目录</td></tr>
          </tbody>
        </table>
      </div>

      <div v-show="active === 4" class="doc-section">
        <h3>编写前端页面</h3>
        <p>前端为 Vue 3 + vue-router。每个插件可拥有专属视图组件，在 <code>web/src/components/PluginView.vue</code> 中注册：</p>
        <pre><code>import HelloMain from './hello/HelloMain.vue'

const MAP = {
  hello: HelloMain,
  // jmcomic, laizhangsetu, touchgal ...
}</code></pre>
        <p>组件内通过 <code>fetch</code> 或统一封装的 <code>web/src/api.js</code> 调用后端接口。以后端 <code>hello</code> 插件为例：</p>
        <pre><code>&lt;script setup&gt;
import { ref } from 'vue'

const msg = ref('')
const url = '/api/plugins/hello/ping'

fetch(url).then(r =&gt; r.json()).then(d =&gt; { msg.value = d.message })
&lt;/script&gt;

&lt;template&gt;
  &lt;div&gt;
    &lt;h1&gt;Hello 插件&lt;/h1&gt;
    &lt;div class="subtitle"&gt;后端返回：{{ msg }}&lt;/div&gt;
  &lt;/div&gt;
&lt;/template&gt;</code></pre>
        <p>组件目录建议统一放在 <code>web/src/components/&lt;插件名&gt;/</code> 下，并复用 <code>styles/main.css</code> 提供的 <code>.section</code>、<code>.btn</code>、<code>.tabs</code>、<code>.card-grid</code> 等样式类。</p>
        <p>改完前端后执行 <code>npm run build</code>，产物会输出到 <code>public/</code>，由后端直接托管。</p>
      </div>

      <div v-show="active === 5" class="doc-section">
        <h3>安装与分发插件</h3>
        <ol>
          <li><b>开发/临时使用：</b>直接把插件目录放进 <code>plugins/</code>，重启服务自动加载。</li>
          <li><b>分发：</b>将插件目录打包为 <code>.zip</code>，在侧边栏点击「安装插件」上传，服务器解压到 <code>plugins/</code> 并热加载。</li>
          <li><b>前端依赖：</b>若插件需要专属前端视图，需在 <code>PluginView.vue</code> 注册后重新构建；未注册的插件自动使用通用信息视图。</li>
        </ol>
        <p>安装接口：<code>POST /api/plugins/install</code>（multipart 表单，字段名 <code>file</code>），zip 内需包含插件目录及 <code>plugin.py</code>。</p>
      </div>

      <div v-show="active === 6" class="doc-section">
        <h3>完整示例：Hello 插件</h3>
        <p>一个带配置读取、数据读写的最小完整插件：</p>
        <pre><code># plugins/hello/plugin.py
import os
import json
from flask import request, jsonify
from plugins.base import Plugin

CONF = os.path.join(os.path.dirname(__file__), 'data.json')


def load_conf():
    if os.path.isfile(CONF):
        try:
            return json.load(open(CONF, encoding='utf-8'))
        except Exception:
            pass
    return {'count': 0}


def save_conf(cfg):
    with open(CONF, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


class HelloPlugin(Plugin):
    name = 'hello'
    label = 'Hello 插件'
    icon = ''
    description = '示例插件'

    def _register_routes(self):
        self.route('/ping')(self.ping)
        self.route('/count', methods=['GET', 'POST'])(self.count)

    def ping(self):
        return jsonify({'message': 'pong'})

    def count(self):
        cfg = load_conf()
        if request.method == 'POST':
            cfg['count'] += 1
            save_conf(cfg)
        return jsonify({'count': cfg['count']})</code></pre>
        <p>安装后即可访问：</p>
        <ul>
          <li><code>GET /api/plugins/hello/ping</code> → <code>{"message": "pong"}</code></li>
          <li><code>GET /api/plugins/hello/count</code> → 当前计数</li>
          <li><code>POST /api/plugins/hello/count</code> → 计数 +1</li>
        </ul>
      </div>

    </div>
  </div>
</template>
