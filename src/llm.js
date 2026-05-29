// llm.js — dual-path vision inference for GrocBot
//   "transformers-vit-gpt2"  → Transformers.js ViT-GPT2 captioning (~250 MB, no WebGPU needed)
//   Phi-3.5-vision-*-MLC    → WebLLM on WebGPU (~2.4 GB)

// Only models actually present in @mlc-ai/web-llm 0.2.84 prebuiltAppConfig
export const VISION_MODELS = [
  { id: 'transformers-vit-gpt2',                name: 'ViT-GPT2 Captioning (~250 MB) — lightest, no WebGPU' },
  { id: 'Phi-3.5-vision-instruct-q4f16_1-MLC', name: 'Phi-3.5 Vision (~2.4 GB) — WebLLM, best quality' },
]

// ── Keyword → nutrition lookup used by the Transformers.js path ───────────
const FOOD_LOOKUP = [
  { keys: ['pizza'],                        name: 'Pizza',           calories: 285, protein: 12, carbs: 36, fats: 10, healthy: false, emoji: '🍕' },
  { keys: ['burger', 'hamburger'],          name: 'Burger',          calories: 550, protein: 25, carbs: 40, fats: 30, healthy: false, emoji: '🍔' },
  { keys: ['salad'],                        name: 'Salad',           calories: 120, protein:  5, carbs: 15, fats:  5, healthy: true,  emoji: '🥗' },
  { keys: ['apple'],                        name: 'Apple',           calories:  95, protein:  0, carbs: 25, fats:  0, healthy: true,  emoji: '🍎' },
  { keys: ['banana'],                       name: 'Banana',          calories: 105, protein:  1, carbs: 27, fats:  0, healthy: true,  emoji: '🍌' },
  { keys: ['orange'],                       name: 'Orange',          calories:  62, protein:  1, carbs: 15, fats:  0, healthy: true,  emoji: '🍊' },
  { keys: ['rice', 'fried rice'],           name: 'Rice',            calories: 206, protein:  4, carbs: 45, fats:  0, healthy: true,  emoji: '🍚' },
  { keys: ['pasta', 'spaghetti', 'noodle'], name: 'Pasta',           calories: 220, protein:  8, carbs: 43, fats:  1, healthy: true,  emoji: '🍝' },
  { keys: ['sandwich'],                     name: 'Sandwich',        calories: 350, protein: 18, carbs: 40, fats: 12, healthy: true,  emoji: '🥪' },
  { keys: ['cake', 'cupcake'],              name: 'Cake',            calories: 350, protein:  4, carbs: 50, fats: 15, healthy: false, emoji: '🎂' },
  { keys: ['cookie', 'biscuit'],            name: 'Cookie',          calories: 140, protein:  2, carbs: 20, fats:  6, healthy: false, emoji: '🍪' },
  { keys: ['soup'],                         name: 'Soup',            calories: 150, protein:  8, carbs: 18, fats:  4, healthy: true,  emoji: '🍲' },
  { keys: ['egg', 'omelette', 'omelet'],    name: 'Eggs',            calories: 155, protein: 13, carbs:  1, fats: 11, healthy: true,  emoji: '🥚' },
  { keys: ['milk'],                         name: 'Milk',            calories: 150, protein:  8, carbs: 12, fats:  8, healthy: true,  emoji: '🥛' },
  { keys: ['cheese'],                       name: 'Cheese',          calories: 113, protein:  7, carbs:  0, fats:  9, healthy: true,  emoji: '🧀' },
  { keys: ['chicken'],                      name: 'Chicken',         calories: 239, protein: 27, carbs:  0, fats: 14, healthy: true,  emoji: '🍗' },
  { keys: ['steak', 'beef', 'meat'],        name: 'Steak',           calories: 271, protein: 26, carbs:  0, fats: 18, healthy: true,  emoji: '🥩' },
  { keys: ['fish', 'salmon', 'tuna'],       name: 'Fish',            calories: 206, protein: 28, carbs:  0, fats: 10, healthy: true,  emoji: '🐟' },
  { keys: ['bread', 'toast'],              name: 'Bread',            calories: 264, protein:  9, carbs: 49, fats:  3, healthy: true,  emoji: '🍞' },
  { keys: ['yogurt'],                       name: 'Yogurt',          calories: 100, protein:  6, carbs: 15, fats:  2, healthy: true,  emoji: '🍦' },
  { keys: ['ice cream'],                    name: 'Ice Cream',       calories: 207, protein:  3, carbs: 24, fats: 11, healthy: false, emoji: '🍨' },
  { keys: ['donut', 'doughnut'],            name: 'Donut',           calories: 253, protein:  4, carbs: 30, fats: 14, healthy: false, emoji: '🍩' },
  { keys: ['sushi'],                        name: 'Sushi',           calories: 200, protein: 10, carbs: 30, fats:  4, healthy: true,  emoji: '🍣' },
  { keys: ['taco'],                         name: 'Taco',            calories: 210, protein: 10, carbs: 21, fats: 10, healthy: true,  emoji: '🌮' },
  { keys: ['broccoli', 'vegetable', 'veggie'], name: 'Vegetables',  calories:  55, protein:  4, carbs: 11, fats:  1, healthy: true,  emoji: '🥦' },
  { keys: ['carrot'],                       name: 'Carrot',          calories:  52, protein:  1, carbs: 12, fats:  0, healthy: true,  emoji: '🥕' },
  { keys: ['coffee'],                       name: 'Coffee',          calories:   5, protein:  0, carbs:  1, fats:  0, healthy: true,  emoji: '☕' },
  { keys: ['juice'],                        name: 'Juice',           calories: 112, protein:  1, carbs: 26, fats:  0, healthy: true,  emoji: '🥤' },
  { keys: ['soda', 'cola', 'coke', 'pepsi'],name: 'Soda',           calories: 140, protein:  0, carbs: 39, fats:  0, healthy: false, emoji: '🥤' },
]

function lookupFromCaption(caption) {
  const lower = caption.toLowerCase()
  for (const entry of FOOD_LOOKUP) {
    if (entry.keys.some(k => lower.includes(k))) {
      return { name: entry.name, calories: entry.calories, protein: entry.protein,
               carbs: entry.carbs, fats: entry.fats, healthy: entry.healthy, emoji: entry.emoji }
    }
  }
  return { name: caption.slice(0, 30), calories: 200, protein: 5, carbs: 20, fats: 5, healthy: true, emoji: '🍽' }
}

// ── Transformers.js path ──────────────────────────────────────────────────

let _captioner     = null
let _tjsLoading    = false

async function _loadTransformers(onProgress) {
  if (_captioner) return
  _tjsLoading = true
  onProgress?.({ type: 'phase', phase: 'download', note: 'Loading ViT-GPT2 from HuggingFace…' })
  const { pipeline, env } = await import('@xenova/transformers')
  env.allowLocalModels = false
  _captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
    progress_callback: (p) => {
      if (p.status === 'downloading') {
        const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0
        onProgress?.({ type: 'downloading', file: p.file, progress: pct })
      }
    },
  })
  _tjsLoading = false
  onProgress?.({ type: 'ready', modelId: 'transformers-vit-gpt2' })
}

async function _analyzeImageTransformers(base64DataUrl) {
  if (!_captioner) throw new Error('Transformers.js model not loaded.')
  const result = await _captioner(base64DataUrl)
  const caption = result?.[0]?.generated_text ?? ''
  return lookupFromCaption(caption)
}

// ── WebLLM path (Web Worker) ──────────────────────────────────────────────

let _worker     = null
let _status     = 'idle'
let _modelId    = null
let _genCounter = 0

let _loadResolve = null
let _loadReject  = null
let _genResolve  = null
let _genReject   = null
let _onProgress  = null

function _ensureWorker() {
  if (_worker) return
  _worker = new Worker(new URL('./llmWorker.js', import.meta.url), { type: 'module' })
  _worker.onmessage = _handleMessage
  _worker.onerror   = (e) => {
    _status = 'error'
    const msg = e.message ?? 'Worker crashed'
    if (_loadReject) { _loadReject(new Error(msg)); _loadResolve = _loadReject = null }
    if (_genReject)  { _genReject(new Error(msg));  _genResolve  = _genReject  = null }
  }
}

function _handleMessage(e) {
  const msg = e.data
  switch (msg.status) {
    case 'device_detected':
      _onProgress?.({ type: 'device', device: msg.device })
      break
    case 'phase':
      _onProgress?.({ type: 'phase', phase: msg.phase, note: msg.note })
      break
    case 'downloading':
      _onProgress?.({ type: 'downloading', file: msg.file, progress: msg.progress })
      break
    case 'ready':
      _status  = 'ready'
      _modelId = msg.modelId
      _onProgress?.({ type: 'ready', modelId: msg.modelId })
      if (_loadResolve) { _loadResolve(msg.modelId); _loadResolve = _loadReject = null }
      break
    case 'success':
      if (_genResolve) { _genResolve(msg.generatedText); _genResolve = _genReject = null }
      break
    case 'error': {
      const err = new Error(msg.error)
      _onProgress?.({ type: 'error', error: msg.error })
      if (_loadReject) { _status = 'error'; _loadReject(err); _loadResolve = _loadReject = null }
      if (_genReject)  { _genReject(err); _genResolve = _genReject = null }
      break
    }
    case 'cancelled':
    case 'disposed':
      _status = 'idle'; _modelId = null; break
  }
}

async function _analyzeImageWebLLM(base64DataUrl) {
  if (_status !== 'ready' || !_worker) throw new Error('Vision model not loaded.')
  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: base64DataUrl } },
      { type: 'text', text: 'Identify this food. Respond ONLY with valid JSON: {"name":"string","calories":number,"protein":number,"carbs":number,"fats":number,"healthy":boolean,"emoji":"string"}' },
    ],
  }]
  _genCounter++
  const raw = await new Promise((resolve, reject) => {
    _genResolve = resolve; _genReject = reject
    _worker.postMessage({ action: 'generate', messages, systemPrompt: null, gen: _genCounter })
  })
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  try {
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
    if (s === -1 || e === -1) throw new Error('no JSON')
    return JSON.parse(cleaned.slice(s, e + 1))
  } catch { return null }
}

// ── Public API ─────────────────────────────────────────────────────────────

// Track which backend is active
let _activeBackend = null  // 'transformers' | 'webllm'

export function getModelStatus() {
  if (_activeBackend === 'transformers') return { status: _captioner ? 'ready' : (_tjsLoading ? 'loading' : 'idle'), modelId: 'transformers-vit-gpt2' }
  return { status: _status, modelId: _modelId }
}

export async function loadModel(modelId, onProgress) {
  if (modelId === 'transformers-vit-gpt2') {
    _activeBackend = 'transformers'
    await _loadTransformers(onProgress)
    return modelId
  }
  _activeBackend = 'webllm'
  _ensureWorker()
  _status     = 'loading'
  _onProgress = onProgress ?? null
  _genCounter++
  return new Promise((resolve, reject) => {
    _loadResolve = resolve; _loadReject = reject
    _worker.postMessage({ action: 'load', modelId, gen: _genCounter })
  })
}

export async function analyzeImage(base64DataUrl) {
  if (_activeBackend === 'transformers') return _analyzeImageTransformers(base64DataUrl)
  return _analyzeImageWebLLM(base64DataUrl)
}

export function cancelLoad() {
  if (_activeBackend === 'transformers') return
  _worker?.postMessage({ action: 'cancel' })
}
