// llm.js — WebLLM vision client for GrocBot food scanning

export const VISION_MODELS = [
  { id: 'Phi-3-vision-128k-instruct-q4f16_1-MLC',    name: 'Phi-3 Vision (~2.4 GB) — recommended' },
  { id: 'Phi-3.5-vision-instruct-q4f16_1-MLC',       name: 'Phi-3.5 Vision (~2.4 GB) — latest' },
]

let _worker     = null
let _status     = 'idle'   // idle | loading | ready | error
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
      if (_genResolve) {
        _genResolve(msg.generatedText)
        _genResolve = _genReject = null
      }
      break
    case 'error': {
      const err = new Error(msg.error)
      _onProgress?.({ type: 'error', error: msg.error })
      if (_loadReject) { _status = 'error'; _loadReject(err); _loadResolve = _loadReject = null }
      if (_genReject)  { _genReject(err);  _genResolve = _genReject = null }
      break
    }
    case 'cancelled':
    case 'disposed':
      _status  = 'idle'
      _modelId = null
      break
  }
}

export function getModelStatus() {
  return { status: _status, modelId: _modelId }
}

export function loadModel(modelId, onProgress) {
  _ensureWorker()
  _status     = 'loading'
  _onProgress = onProgress ?? null
  _genCounter++
  return new Promise((resolve, reject) => {
    _loadResolve = resolve
    _loadReject  = reject
    _worker.postMessage({ action: 'load', modelId, gen: _genCounter })
  })
}

/**
 * analyzeImage — Send a base64 image to the vision model.
 * Returns parsed nutrition object or null on parse failure.
 * @param {string} base64DataUrl  e.g. "data:image/jpeg;base64,..."
 * @returns {Promise<{name,calories,protein,carbs,fats,healthy,emoji}|null>}
 */
export async function analyzeImage(base64DataUrl) {
  if (_status !== 'ready' || !_worker) {
    throw new Error('Vision model not loaded.')
  }

  const systemPrompt = `You are a nutrition expert. When given a food image, respond ONLY with a valid JSON object — no markdown, no explanation. Schema:
{"name":"string","calories":number,"protein":number,"carbs":number,"fats":number,"healthy":boolean,"emoji":"string"}
Use realistic per-serving values. If no food is visible, return {"name":"unknown","calories":0,"protein":0,"carbs":0,"fats":0,"healthy":false,"emoji":"❓"}.`

  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: base64DataUrl } },
      { type: 'text', text: 'Identify this food and estimate its nutritional content per serving.' },
    ],
  }]

  _genCounter++
  const raw = await new Promise((resolve, reject) => {
    _genResolve = resolve
    _genReject  = reject
    _worker.postMessage({ action: 'generate', messages, systemPrompt: null, gen: _genCounter })
  })

  // Strip markdown code fences if the model wraps its JSON
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  try {
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd   = cleaned.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found')
    return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
  } catch {
    return null
  }
}

export function cancelLoad() {
  _worker?.postMessage({ action: 'cancel' })
}
