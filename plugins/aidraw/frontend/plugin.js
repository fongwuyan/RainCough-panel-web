/* AI 绘图插件：文生图 / 图生图 / JSON 批量 / 服务端历史画廊 */
(function () {
  const NAME = 'aidraw'
  const CSS = `
  .aidraw{padding:18px 22px;color:var(--text);font-size:13px}
  .aidraw h2{font-size:18px;margin:0 0 4px}
  .aidraw .sub{color:var(--text-muted);font-size:12px;margin:0 0 14px}
  .aidraw .row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;align-items:flex-end}
  .aidraw label{display:flex;flex-direction:column;gap:4px;color:var(--text-muted);font-size:12px}
  .aidraw input,.aidraw select,.aidraw textarea{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:6px 8px;font-size:13px}
  .aidraw textarea{min-height:74px;resize:vertical;width:100%;box-sizing:border-box}
  .aidraw .grow{flex:1;min-width:260px}
  .aidraw .btn{background:var(--surface-2);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:5px;cursor:pointer;font-size:12px}
  .aidraw .btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
  .aidraw .btn:disabled{opacity:.5;cursor:default}
  .aidraw .tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
  .aidraw .tab{padding:6px 12px;border:1px solid var(--border);border-radius:999px;cursor:pointer;font-size:12px}
  .aidraw .tab.on{background:var(--accent);border-color:var(--accent);color:#fff}
  .aidraw .status{font-size:12px;color:var(--text-muted);margin:8px 0}
  .aidraw .err{color:#f5534f;font-size:12px;margin:6px 0}
  .aidraw .progress{height:8px;background:var(--surface-2);border-radius:999px;overflow:hidden;margin:6px 0 4px}
  .aidraw .progress i{display:block;height:100%;background:var(--accent);width:0;transition:width .25s}
  .aidraw .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:14px}
  .aidraw .card{border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--surface);position:relative}
  .aidraw .card img{width:100%;display:block;aspect-ratio:1;object-fit:cover;cursor:zoom-in}
  .aidraw .meta{font-size:11px;color:var(--text-faint);padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aidraw .acts{display:flex;gap:4px;padding:0 8px 8px;flex-wrap:wrap}
  .aidraw .acts .btn{padding:3px 6px;font-size:11px}
  .aidraw .empty{color:var(--text-muted);padding:26px;border:1px dashed var(--border);border-radius:8px;text-align:center}
  .aidraw .thumb{max-width:160px;max-height:160px;border-radius:6px;border:1px solid var(--border);display:block;margin-top:4px}
  .aidraw .hint{font-size:11px;color:var(--text-faint)}
  .aidraw pre{white-space:pre-wrap;max-height:180px;overflow:auto;font-size:11px;background:var(--surface-2);padding:8px;border-radius:6px}
  `
  function h(tag, attrs, kids) {
    const el = document.createElement(tag)
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k]
      else if (k === 'text') el.textContent = attrs[k]
      else if (k === 'html') el.innerHTML = attrs[k]
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k])
      else if (attrs[k] != null) el.setAttribute(k, attrs[k])
    }
    if (kids) for (const k of kids) if (k) el.appendChild(k)
    return el
  }
  async function jget(url) {
    const r = await fetch(url, { credentials: 'same-origin' })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json()
  }
  async function jpost(url, body) {
    const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => null)
    if (!r.ok) throw new Error((d && d.error) || 'HTTP ' + r.status)
    return d
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result || ''))
      fr.onerror = reject
      fr.readAsDataURL(file)
    })
  }
  function parseBatchJson(text) {
    const d = JSON.parse(text)
    const items = Array.isArray(d) ? d : (Array.isArray(d.items) ? d.items : null)
    if (!items || !items.length) throw new Error('JSON 需要包含非空 items 数组')
    return { defaults: (d && d.defaults) || {}, items }
  }
  function merge(base, item) {
    const out = Object.assign({}, base || {}, item || {})
    delete out.prompt
    delete out.items
    return out
  }

  function mount(el, ctx) {
    if (!document.getElementById('rc-aidraw-css')) {
      document.head.appendChild(h('style', { id: 'rc-aidraw-css', text: CSS }))
    }
    el.innerHTML = ''
    const root = h('div', { class: 'aidraw' })
    el.appendChild(root)

    let tab = 't2i'
    let nodes = [], models = [], baseModels = [], loraModels = [], history = []
    let baseImage = '', batchBaseImage = '', batchItems = [], batchDefaults = {}
    let busy = false, cancelFlag = false, current = null, timer = null, startAt = 0
    let trainState = null, trainDatasets = [], trainMsg = '', trainTimer = null, trainLoaded = false
    let trainFiles = []
    const trainForm = { name: 'p_lora', base: 'realistic', dataset: '', trigger: 'p_character', steps: 800, rank: 16, alpha: 16, lr: 0.0001, width: 512, height: 512, batch: 1, seed: 42 }
    const dsForm = { name: '', caption: '' }

    const hd = h('div', {}, [h('h2', { text: 'AI 绘图' }), h('p', { class: 'sub', text: '节点生图 · 任意尺寸 · 图生图 · JSON 批量 · 服务端历史画廊' })])
    const tabs = h('div', { class: 'tabs' })
    const tabDefs = [['t2i', '文生图'], ['i2i', '图生图'], ['batch', 'JSON 批量'], ['history', '历史画廊'], ['train', 'LoRA 训练']]
    for (const [id, label] of tabDefs) {
      tabs.appendChild(h('div', { class: 'tab' + (tab === id ? ' on' : ''), text: label, 'data-tab': id, onclick: () => { tab = id; renderTabs(); render() } }))
    }
    const body = h('div')
    root.appendChild(hd); root.appendChild(tabs); root.appendChild(body)

    const nodeSel = h('select', {}, [h('option', { value: '', text: '加载节点中…' })])
    const modelSel = h('select', {}, [h('option', { value: '', text: '加载模型中…' })])
    const loraSel = h('select', {}, [h('option', { value: '', text: '无 LoRA' })])
    const loraScale = h('input', { type: 'number', min: '0', max: '2', step: '0.05', value: '1' })
    const prompt = h('textarea', { placeholder: '提示词，支持中文；例如：1girl, white dress, garden, soft light' })
    const negative = h('input', { placeholder: '负面提示词（可空）' })
    const width = h('input', { type: 'number', min: '1', value: '512', placeholder: '宽' })
    const height = h('input', { type: 'number', min: '1', value: '512', placeholder: '高' })
    const steps = h('input', { type: 'number', min: '1', max: '100', value: '20' })
    const cfg = h('input', { type: 'number', min: '1', max: '30', step: '0.5', value: '7' })
    const seed = h('input', { type: 'number', value: '-1' })
    const batchN = h('input', { type: 'number', min: '1', max: '8', value: '1' })
    const strength = h('input', { type: 'number', min: '0.05', max: '0.95', step: '0.05', value: '0.55' })
    const imageInput = h('input', { type: 'file', accept: 'image/*' })
    const imagePreview = h('img', { class: 'thumb', style: 'display:none' })
    const batchImageInput = h('input', { type: 'file', accept: 'image/*' })
    const batchImagePreview = h('img', { class: 'thumb', style: 'display:none' })
    const jsonInput = h('input', { type: 'file', accept: 'application/json,.json' })
    const batchInfo = h('div', { class: 'hint' })
    const status = h('div', { class: 'status', text: '就绪' })
    const err = h('div', { class: 'err' })
    const bar = h('div', { class: 'progress' }, [h('i')])
    const genBtn = h('button', { class: 'btn primary', text: '生成', onclick: () => runSingle() })
    const cancelBtn = h('button', { class: 'btn', text: '取消', disabled: 'disabled', onclick: cancel })
    const batchBtn = h('button', { class: 'btn primary', text: '开始批量', onclick: () => runBatch() })
    const gallery = h('div', { class: 'grid' })
    const empty = h('div', { class: 'empty', text: '还没有生成记录' })

    function setStatus(t) { status.textContent = t }
    function setErr(t) { err.textContent = t || '' }
    function setPct(n) { bar.firstChild.style.width = Math.max(0, Math.min(100, Number(n) || 0)) + '%' }
    function setBusy(v) {
      busy = v
      genBtn.disabled = v
      batchBtn.disabled = v
      cancelBtn.disabled = !v
    }
    function startTimer() {
      startAt = Date.now()
      clearInterval(timer)
      timer = setInterval(() => {
        if (busy) setStatus((current && current.label ? current.label : '生成中') + ' · ' + Math.floor((Date.now() - startAt) / 1000) + 's')
      }, 500)
    }
    function stopTimer() { clearInterval(timer); timer = null }

    nodeSel.onchange = () => { trainLoaded = false; loadModels(); if (tab === 'train') loadTraining(true) }
    modelSel.onchange = () => populateLoras()
    imageInput.onchange = async () => {
      const f = imageInput.files && imageInput.files[0]
      if (!f) return
      baseImage = await readFile(f)
      imagePreview.src = baseImage; imagePreview.style.display = 'block'
      const img = new Image()
      img.onload = () => { width.value = img.naturalWidth; height.value = img.naturalHeight }
      img.src = baseImage
    }
    batchImageInput.onchange = async () => {
      const f = batchImageInput.files && batchImageInput.files[0]
      if (!f) return
      batchBaseImage = await readFile(f)
      batchImagePreview.src = batchBaseImage; batchImagePreview.style.display = 'block'
    }
    jsonInput.onchange = async () => {
      try {
        const f = jsonInput.files && jsonInput.files[0]
        if (!f) return
        const parsed = parseBatchJson(await f.text())
        batchDefaults = parsed.defaults
        batchItems = parsed.items
        batchInfo.textContent = '已导入 ' + batchItems.length + ' 条，底图：' + (batchBaseImage ? '已选' : '未选（文生图批量）')
      } catch (e) { setErr('JSON 解析失败：' + e.message) }
    }

    function formRow(showStrength, showImage) {
      return h('div', {}, [
        h('div', { class: 'row' }, [
          h('label', {}, [h('span', { text: '节点' }), nodeSel]),
          h('label', {}, [h('span', { text: '模型' }), modelSel]),
          h('label', {}, [h('span', { text: 'LoRA' }), loraSel]),
          h('label', {}, [h('span', { text: 'LoRA 权重' }), loraScale]),
          h('label', {}, [h('span', { text: '宽' }), width]),
          h('label', {}, [h('span', { text: '高' }), height]),
          h('label', {}, [h('span', { text: '步数' }), steps]),
          h('label', {}, [h('span', { text: 'CFG' }), cfg]),
          h('label', {}, [h('span', { text: '种子' }), seed]),
          h('label', {}, [h('span', { text: '数量' }), batchN]),
        ]),
        h('label', { class: 'grow' }, [h('span', { text: '提示词' }), prompt]),
        h('div', { class: 'row' }, [
          h('label', { class: 'grow' }, [h('span', { text: '负面提示词' }), negative]),
          showStrength ? h('label', {}, [h('span', { text: '重绘强度' }), strength]) : null,
          genBtn, cancelBtn,
        ]),
        showImage ? h('div', { class: 'row' }, [h('label', { class: 'grow' }, [h('span', { text: '底图' }), imageInput, imagePreview])]) : null,
        bar, status, err,
      ])
    }

    function renderTabs() {
      for (const x of tabs.children) x.classList.toggle('on', x.getAttribute('data-tab') === tab)
    }

    function render() {
      body.innerHTML = ''
      if (tab === 'history') { renderHistory(); return }
      if (tab === 'batch') { body.appendChild(renderBatch()); return }
      if (tab === 'train') { body.appendChild(renderTrain()); if (!trainLoaded) loadTraining(true); return }
      body.appendChild(formRow(tab === 'i2i', tab === 'i2i'))
    }

    function renderTrain() {
      const box = h('div', {}, [])
      const dsSel = h('select', {}, [h('option', { value: '', text: '加载数据集中…' })])
      for (const d of trainDatasets) dsSel.appendChild(h('option', { value: d.name, text: d.name + ' · ' + d.images + ' 图 / ' + d.captions + ' caption' }))
      if (trainForm.dataset) dsSel.value = trainForm.dataset
      else if (trainDatasets.length) { trainForm.dataset = trainDatasets[0].name; dsSel.value = trainForm.dataset }
      dsSel.onchange = () => { trainForm.dataset = dsSel.value }
      const baseSel = h('select', {}, [h('option', { value: 'realistic', text: '写实 · SD1.5' }), h('option', { value: 'anime', text: '动漫 · waifu-diffusion' }), h('option', { value: 'anima-int8', text: 'Anima 2.9B int8 · 动漫' })])
      baseSel.value = trainForm.base
      baseSel.onchange = () => { trainForm.base = baseSel.value }
      const field = (label, input) => h('label', {}, [h('span', { text: label }), input])
      const num = (key, step) => {
        const x = h('input', { type: 'number', value: String(trainForm[key]) })
        if (step) x.step = step
        x.oninput = () => { trainForm[key] = Number(x.value) }
        return x
      }
      const nameIn = h('input', { value: trainForm.name, placeholder: '输出 LoRA 名' })
      nameIn.oninput = () => { trainForm.name = nameIn.value }
      const trigIn = h('input', { value: trainForm.trigger, placeholder: '触发词，如 p_character' })
      trigIn.oninput = () => { trainForm.trigger = trigIn.value }
      const startBtn = h('button', { class: 'btn primary', text: '开始训练', onclick: startTraining })
      const stopBtn = h('button', { class: 'btn', text: '停止', onclick: stopTraining })
      const refreshBtn = h('button', { class: 'btn', text: '刷新', onclick: () => loadTraining(true) })
      const state = trainState || {}
      const pct = state.total ? Math.round((state.step || 0) * 100 / state.total) : 0
      const bar = h('div', { class: 'progress' }, [h('i', { style: 'width:' + pct + '%' })])
      const status = h('div', { class: 'status', text: (trainMsg || '') + (state.status ? ' · ' + state.status + ' · step ' + (state.step || 0) + '/' + (state.total || 0) + ' · loss ' + (state.avg_loss || state.loss || '-') : '') })
      const log = h('pre', { class: 'hint', text: (state.log || []).slice(-18).join('\n') })
      const loras = (models || []).filter((m) => m.kind === 'lora')
      const loraBox = h('div', { class: 'row' }, loras.map((m) => h('button', { class: 'btn btn-sm', text: '用 ' + (m.name || m.id) + ' 出图', onclick: () => useTrainedLora(m) })))
      if (!loras.length) loraBox.appendChild(h('span', { class: 'hint', text: '训练完成后刷新模型列表' }))

      const dsInput = h('input', { type: 'file', multiple: 'multiple', accept: 'image/png,image/jpeg,image/webp' })
      dsInput.onchange = () => { trainFiles = Array.from(dsInput.files || []) }
      const dsName = h('input', { value: dsForm.name, placeholder: '新数据集名' })
      dsName.oninput = () => { dsForm.name = dsName.value }
      const dsCap = h('input', { value: dsForm.caption, placeholder: '这批图片的 caption（可空）' })
      dsCap.oninput = () => { dsForm.caption = dsCap.value }
      const dsInfo = h('div', { class: 'hint', text: trainDatasets.map((d) => d.name + '(' + d.images + '/' + d.captions + ')').join(' · ') || '暂无数据集' })

      box.appendChild(h('div', { class: 'row' }, [
        field('节点', nodeSel),
        field('数据集', dsSel),
        field('底模', baseSel),
        field('LoRA 名称', nameIn),
        field('触发词', trigIn),
      ]))
      box.appendChild(h('div', { class: 'row' }, [
        field('步数', num('steps')), field('rank', num('rank')), field('alpha', num('alpha')),
        field('lr', num('lr', '0.00001')), field('宽', num('width')), field('高', num('height')),
        field('batch', num('batch')), field('seed', num('seed')),
      ]))
      box.appendChild(h('div', { class: 'row' }, [startBtn, stopBtn, refreshBtn]))
      box.appendChild(bar); box.appendChild(status); box.appendChild(log)
      box.appendChild(h('div', { class: 'section-title', text: '数据集管理' }))
      box.appendChild(h('div', { class: 'row' }, [
        field('新建', dsName), h('button', { class: 'btn', text: '创建', onclick: createDataset }),
        field('图片（多选）', dsInput), field('统一 caption', dsCap),
        h('button', { class: 'btn primary', text: '上传', onclick: uploadDataset }),
        h('button', { class: 'btn', text: '删除当前数据集', onclick: deleteDataset }),
      ]))
      box.appendChild(dsInfo)
      box.appendChild(h('div', { class: 'section-title', text: '训练产物 / 直接出图' }))
      box.appendChild(loraBox)
      return box
    }

    async function loadTraining(rerender) {
      const nid = nodeSel.value
      if (!nid) return
      try {
        const d = await jget('/api/node-train?node_id=' + encodeURIComponent(nid))
        trainState = (d && d.state) || null
        trainDatasets = (d && d.datasets) || []
        trainMsg = ''
        trainLoaded = true
        const st = (trainState && trainState.status) || ''
        if (st === 'running' || st === 'stopping') {
          if (!trainTimer) trainTimer = setInterval(() => loadTraining(true), 2000)
        } else {
          clearInterval(trainTimer); trainTimer = null
        }
        if (!trainForm.dataset && trainDatasets.length) trainForm.dataset = trainDatasets[0].name
        if (rerender && tab === 'train') render()
      } catch (e) { trainMsg = '训练服务不可用：' + e.message }
    }

    async function startTraining() {
      if (!nodeSel.value) { trainMsg = '请选择节点'; return }
      if (!trainForm.dataset) { trainMsg = '请选择数据集'; return }
      trainMsg = '提交训练…'
      try {
        await jpost('/api/node-train/start', { node_id: nodeSel.value, req: {
          dataset: trainForm.dataset, name: trainForm.name, trigger: trainForm.trigger,
          base: trainForm.base, steps: Number(trainForm.steps) || 800,
          rank: Number(trainForm.rank) || 16, alpha: Number(trainForm.alpha) || 16,
          lr: Number(trainForm.lr) || 0.0001, width: Number(trainForm.width) || 512,
          height: Number(trainForm.height) || 512,
          batch: Number(trainForm.batch) || 1, seed: Number(trainForm.seed) || 42,
        } })
        trainMsg = '训练已启动'
        if (tab === 'train') render()
        clearInterval(trainTimer)
        trainTimer = setInterval(() => loadTraining(true), 2000)
      } catch (e) { trainMsg = '启动失败：' + e.message; if (tab === 'train') render() }
    }

    async function stopTraining() {
      try { await jpost('/api/node-train/stop', { node_id: nodeSel.value }); trainMsg = '已请求停止' } catch (e) { trainMsg = '停止失败：' + e.message }
      clearInterval(trainTimer)
      if (tab === 'train') render()
    }

    async function createDataset() {
      if (!dsForm.name.trim()) { trainMsg = '请输入数据集名'; if (tab === 'train') render(); return }
      try { await jpost('/api/node-datasets/create', { node_id: nodeSel.value, name: dsForm.name.trim() }); trainForm.dataset = dsForm.name.trim(); await loadTraining(true) }
      catch (e) { trainMsg = '创建失败：' + e.message; if (tab === 'train') render() }
    }

    async function uploadDataset() {
      if (!trainForm.dataset) { trainMsg = '请先选择数据集'; if (tab === 'train') render(); return }
      if (!trainFiles.length) { trainMsg = '请选择图片'; if (tab === 'train') render(); return }
      let ok = 0
      for (const f of trainFiles) {
        try {
          const b64 = (await readFile(f)).split(',')[1]
          await jpost('/api/node-datasets/upload', { node_id: nodeSel.value, name: trainForm.dataset, filename: f.name, image_b64: b64, caption: dsForm.caption })
          ok++
          trainMsg = '上传 ' + ok + '/' + trainFiles.length
          if (tab === 'train') render()
        } catch (e) { trainMsg = '上传失败：' + f.name + ' ' + e.message; if (tab === 'train') render(); break }
      }
      await loadTraining(true)
    }

    async function deleteDataset() {
      if (!trainForm.dataset || !confirm('删除数据集「' + trainForm.dataset + '」？')) return
      try { await jpost('/api/node-datasets/delete', { node_id: nodeSel.value, name: trainForm.dataset }); trainForm.dataset = ''; await loadTraining(true) }
      catch (e) { trainMsg = '删除失败：' + e.message; if (tab === 'train') render() }
    }

    async function useTrainedLora(m) {
      await loadModels()
      const family = m.lora_for || 'sd15'
      const base = baseModels.find((x) => x.kind === family || (x.kind === 'sd15' && family === 'sd15')) || baseModels[0]
      if (base) modelSel.value = base.id
      populateLoras()
      loraSel.value = m.id
      prompt.value = trainForm.trigger || m.trigger || ''
      tab = 't2i'; renderTabs(); render()
      setStatus('已载入 LoRA：' + (m.name || m.id))
    }

    function renderBatch() {
      const box = h('div', {}, [
        h('p', { class: 'hint', text: 'JSON 支持 { defaults:{...}, items:[{prompt,...}] } 或直接数组。每条可用同一张底图走图生图；不选底图则走文生图批量。' }),
        h('div', { class: 'row' }, [
          h('label', {}, [h('span', { text: '节点' }), nodeSel]),
          h('label', {}, [h('span', { text: '底模' }), modelSel]),
          h('label', {}, [h('span', { text: 'LoRA' }), loraSel]),
          h('label', {}, [h('span', { text: 'LoRA 权重' }), loraScale]),
        ]),
        h('div', { class: 'row' }, [
          h('label', {}, [h('span', { text: '批量底图（可选）' }), batchImageInput, batchImagePreview]),
          h('label', { class: 'grow' }, [h('span', { text: '导入 JSON' }), jsonInput]),
        ]),
        batchInfo,
        h('div', { class: 'row' }, [batchBtn, cancelBtn]),
        bar, status, err,
      ])
      return box
    }

    function renderHistory() {
      body.innerHTML = ''
      const bar2 = h('div', { class: 'row' }, [
        h('button', { class: 'btn', text: '刷新', onclick: loadHistory }),
        h('button', { class: 'btn', text: '清空', onclick: clearHistory }),
        h('span', { class: 'hint', text: history.length + ' 条' }),
      ])
      body.appendChild(bar2)
      const grid = h('div', { class: 'grid' })
      if (!history.length) grid.appendChild(h('div', { class: 'empty', text: '还没有生成记录' }))
      for (const it of history) {
        const src = it.thumb || it.full_url || it.url || ''
        const card = h('div', { class: 'card' }, [
          src ? h('img', { src, loading: 'lazy', onclick: () => window.open(it.full_url || it.url || src, '_blank') }) : null,
          h('div', { class: 'meta', title: it.prompt || '', text: (it.prompt || '(无提示词)').slice(0, 60) }),
          h('div', { class: 'meta', text: [it.mode || 'txt2img', it.width + '×' + it.height, 'seed ' + (it.seed ?? '-'), it.model || ''].join(' · ') }),
          h('div', { class: 'acts' }, [
            h('button', { class: 'btn', text: '查看', onclick: () => window.open(it.full_url || it.url || src, '_blank') }),
            h('a', { class: 'btn', href: it.full_url || it.url || src, download: '', text: '下载' }),
            h('button', { class: 'btn', text: '复用', onclick: () => reuse(it) }),
            h('button', { class: 'btn', text: '删除', onclick: () => deleteHistory(it) }),
          ]),
        ])
        grid.appendChild(card)
      }
      body.appendChild(grid)
    }

    async function loadNodes() {
      try {
        const d = await jget('/api/nodes')
        nodes = (d.nodes || []).filter((n) => n.enabled !== false)
        nodeSel.innerHTML = ''
        if (!nodes.length) { nodeSel.appendChild(h('option', { value: '', text: '没有可用节点' })); setErr('请先在节点管理添加节点'); return }
        for (const n of nodes) nodeSel.appendChild(h('option', { value: n.id, text: n.name + ' (' + n.host + ')' }))
        nodeSel.value = (nodes.find((n) => n.status === 'online') || nodes[0]).id
        await loadModels()
      } catch (e) { setErr('加载节点失败：' + e.message) }
    }
    async function loadModels() {
      const nid = nodeSel.value
      if (!nid) return
      modelSel.innerHTML = ''
      modelSel.appendChild(h('option', { value: '', text: '加载中…' }))
      try {
        const d = await jget('/api/node-jobs/models?node_id=' + encodeURIComponent(nid))
        models = ((d && d.models) || []).filter((m) => m.installed && m.capability !== 'insufficient_vram')
        baseModels = models.filter((m) => m.kind !== 'lora')
        loraModels = models.filter((m) => m.kind === 'lora')
        modelSel.innerHTML = ''
        for (const m of baseModels) modelSel.appendChild(h('option', { value: m.id, text: m.name || m.id }))
        if (!baseModels.length) modelSel.appendChild(h('option', { value: '', text: '没有可用底模' }))
        populateLoras()
        setStatus('已连接节点，底模 ' + baseModels.length + ' 个，LoRA ' + loraModels.length + ' 个')
      } catch (e) { setErr('加载模型失败：' + e.message) }
    }

    function populateLoras() {
      const base = models.find((m) => m.id === modelSel.value)
      const kind = base ? base.kind : ''
      const keep = loraSel.value
      loraSel.innerHTML = ''
      loraSel.appendChild(h('option', { value: '', text: '无 LoRA' }))
      const usable = loraModels.filter((m) => !m.lora_for || !kind || m.lora_for === kind)
      for (const m of usable) loraSel.appendChild(h('option', { value: m.id, text: (m.name || m.id) + (m.lora_for ? ' [' + m.lora_for + ']' : '') }))
      if (usable.some((m) => m.id === keep)) loraSel.value = keep
    }

    function payloadFor(item, useImage, sharedImage) {
      const p = {
        prompt: String(item.prompt || '').trim(),
        negative_prompt: String(item.negative_prompt ?? negative.value ?? '').trim(),
        width: Number(item.width || width.value) || 512,
        height: Number(item.height || height.value) || 512,
        steps: Number(item.steps || steps.value) || 20,
        scale: Number(item.scale || cfg.value) || 7,
        seed: item.seed != null ? Number(item.seed) : (Number(seed.value) >= 0 ? Number(seed.value) : -1),
        n: Number(item.n || batchN.value) || 1,
        model: item.model || modelSel.value,
      }
      const lora = item.lora !== undefined ? item.lora : loraSel.value
      if (lora) {
        p.lora = Array.isArray(lora) ? lora.join(',') : String(lora)
        p.lora_scale = Number(item.lora_scale || loraScale.value) || 1
      }
      if (useImage) {
        p.mode = 'img2img'
        p.image = item.image || sharedImage || ''
        p.strength = Number(item.strength || strength.value) || 0.55
      }
      return p
    }

    async function submitJob(payload) {
      const nid = nodeSel.value
      if (!nid) throw new Error('请选择节点')
      const d = await jpost('/api/node-jobs', { node_id: nid, kind: 'image', payload })
      return { nid, jid: (d.job || {}).id }
    }

    async function pollJob(nid, jid, label, mode) {
      return new Promise((resolve, reject) => {
        const t0 = Date.now()
        const iv = setInterval(async () => {
          if (cancelFlag) { clearInterval(iv); resolve({ status: 'canceled' }); return }
          try {
            const d = await jget('/api/node-jobs/status?node_id=' + encodeURIComponent(nid) + '&job_id=' + encodeURIComponent(jid))
            const j = d.job || {}
            if (j.status === 'queued') setStatus(label + '：排队中…')
            else if (j.status === 'running') {
              if (mode === 'img2img') setStatus(label + '：图生图处理中（节点无步进上报）')
              else { setStatus(label + '：生成中 ' + (j.progress || 0) + '%'); setPct(j.progress || 0) }
            }
            if (j.status === 'succeeded') {
              clearInterval(iv)
              setPct(100)
              resolve({ status: 'succeeded', job: j, elapsed: Date.now() - t0 })
            } else if (j.status === 'failed' || j.status === 'canceled') {
              clearInterval(iv)
              resolve({ status: j.status, job: j, elapsed: Date.now() - t0 })
            }
          } catch (e) { clearInterval(iv); reject(e) }
        }, 1500)
      })
    }

    async function thumbOf(url) {
      try {
        const r = await fetch(url, { credentials: 'same-origin' })
        if (!r.ok) return ''
        const blob = await r.blob()
        const bmp = await createImageBitmap(blob)
        const scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(bmp.width * scale))
        c.height = Math.max(1, Math.round(bmp.height * scale))
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
        return c.toDataURL('image/jpeg', 0.72)
      } catch (e) { return '' }
    }

    async function saveHistory(nid, jid, idx, payload, job) {
      const url = '/api/node-jobs/image?node_id=' + encodeURIComponent(nid) + '&job_id=' + encodeURIComponent(jid) + '&idx=' + idx
      const item = {
        id: jid + ':' + idx, node_id: nid, job_id: jid, idx,
        prompt: payload.prompt, negative_prompt: payload.negative_prompt,
        mode: payload.mode || 'txt2img', strength: payload.strength,
        lora: payload.lora || '', lora_scale: payload.lora_scale,
        width: payload.width, height: payload.height, steps: payload.steps,
        seed: payload.seed, model: payload.model, n: payload.n,
        full_url: url, thumb: await thumbOf(url), ts: Date.now(),
      }
      try { await ctx.invoke('aidraw.history.add', { item }) } catch (e) {}
      history.unshift(item)
      history = history.slice(0, 500)
    }

    async function runSingle() {
      if (busy) return
      const useImage = tab === 'i2i'
      const p = payloadFor({ prompt: prompt.value.trim() }, useImage, baseImage)
      if (!p.prompt) { setErr('提示词不能为空'); return }
      if (useImage && !p.image) { setErr('图生图请先上传底图'); return }
      setErr(''); setBusy(true); cancelFlag = false; current = { label: '生成' }; startTimer(); setStatus('提交中…')
      try {
        const { nid, jid } = await submitJob(p)
        current = { label: '生成', nid, jid }
        const res = await pollJob(nid, jid, '生成', p.mode)
        if (res.status === 'succeeded') {
          const imgs = (res.job.result && res.job.result.images) || []
          for (let i = 0; i < imgs.length; i++) await saveHistory(nid, jid, i, p, res.job)
          setStatus('完成 ' + imgs.length + ' 张，用时 ' + (res.elapsed / 1000).toFixed(1) + 's')
        } else if (res.status === 'canceled') setStatus('已取消')
        else { setStatus('失败'); setErr((res.job && res.job.error) || '节点任务失败') }
      } catch (e) { setErr('提交/查询失败：' + e.message); setStatus('失败') }
      finally { setBusy(false); stopTimer(); current = null }
    }

    async function runBatch() {
      if (busy) return
      setErr('')
      if (!batchItems.length) { setErr('请先导入 JSON'); return }
      const useImage = !!batchBaseImage
      setBusy(true); cancelFlag = false; startTimer()
      let ok = 0, failed = 0
      const total = batchItems.length
      for (let i = 0; i < total; i++) {
        if (cancelFlag) break
        const raw = batchItems[i] || {}
        const merged = Object.assign({}, batchDefaults, raw)
        const p = payloadFor(merged, useImage, batchBaseImage)
        current = { label: '批量 ' + (i + 1) + '/' + total }
        if (!p.prompt) { failed++; setErr('第 ' + (i + 1) + ' 条缺少 prompt，跳过'); continue }
        setStatus('批量 ' + (i + 1) + '/' + total + '：提交中…')
        setPct((i / total) * 100)
        try {
          const { nid, jid } = await submitJob(p)
          current = { label: '批量 ' + (i + 1) + '/' + total, nid, jid }
          const res = await pollJob(nid, jid, '批量 ' + (i + 1) + '/' + total, p.mode)
          if (res.status === 'succeeded') {
            const imgs = (res.job.result && res.job.result.images) || []
            for (let k = 0; k < imgs.length; k++) await saveHistory(nid, jid, k, p, res.job)
            ok++
          } else { failed++; setErr('第 ' + (i + 1) + ' 条失败：' + ((res.job && res.job.error) || res.status)) }
        } catch (e) { failed++; setErr('第 ' + (i + 1) + ' 条异常：' + e.message) }
        setPct(((i + 1) / total) * 100)
      }
      setBusy(false); stopTimer(); current = null
      setStatus('批量结束：成功 ' + ok + '，失败 ' + failed + (cancelFlag ? '（已取消）' : ''))
      if (tab === 'history') renderHistory()
    }

    async function cancel() {
      cancelFlag = true
      const jid = current && current.jid
      const nid = (current && current.nid) || nodeSel.value
      if (jid && nid) {
        try { await jpost('/api/node-jobs/cancel?node_id=' + encodeURIComponent(nid) + '&job_id=' + encodeURIComponent(jid), {}) } catch (e) {}
      }
      setStatus('已请求取消；批量队列已停止')
      setBusy(false); stopTimer()
      if (current) current = null
    }

    async function loadHistory() {
      try {
        const d = await ctx.invoke('aidraw.history.list', { limit: 200 })
        history = (d && d.items) || []
      } catch (e) {
        try { history = JSON.parse(localStorage.getItem('rc-aidraw-history') || '[]') } catch (e2) { history = [] }
      }
      if (tab === 'history') renderHistory()
    }
    async function deleteHistory(it) {
      try { await ctx.invoke('aidraw.history.delete', { id: it.id }) } catch (e) {}
      history = history.filter((x) => x.id !== it.id)
      renderHistory()
    }
    async function clearHistory() {
      if (!confirm('清空服务端历史画廊记录？')) return
      try { await ctx.invoke('aidraw.history.clear', {}) } catch (e) {}
      history = []; renderHistory()
    }
    function reuse(it) {
      tab = it.mode === 'img2img' ? 'i2i' : 't2i'
      prompt.value = it.prompt || ''
      negative.value = it.negative_prompt || ''
      width.value = it.width || 512
      height.value = it.height || 512
      steps.value = it.steps || 20
      seed.value = it.seed != null ? it.seed : -1
      if (it.model) modelSel.value = it.model
      populateLoras()
      if (it.lora) loraSel.value = it.lora
      if (it.lora_scale != null) loraScale.value = it.lora_scale
      if (it.strength != null) strength.value = it.strength
      renderTabs(); render()
    }

    loadNodes()
    loadHistory()
    render()

    return {
      unmount() {
        stopTimer()
        clearInterval(trainTimer)
        try { if (pollTimer) clearInterval(pollTimer) } catch (e) {}
      },
    }
  }

  window.__rcPluginV4__ = window.__rcPluginV4__ || {}
  window.__rcPluginV4__[NAME] = { mount }
})()
