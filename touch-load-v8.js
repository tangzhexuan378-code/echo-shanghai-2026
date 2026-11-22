(() => {
  if (!window.EchoTouch?.enabled) return;
  const original = window.fetch.bind(window);
  const size = 524288;
  const engine = { key: 'engine', bytes: 9326774, full: 38034280, mime: 'application/wasm' };
  const world = { key: 'world', bytes: 5254636, full: 5254636, mime: 'application/octet-stream' };
  const panel = document.getElementById('status');
  const info = document.createElement('div');
  info.className = 'touch-loading';
  info.innerHTML = '<strong>回到同一处</strong><span>正在载入上海街景…</span>';
  panel.prepend(info);
  panel.style.visibility = 'visible';
  const label = info.lastElementChild;
  let received = 0;
  function report(bytes) {
    received += bytes;
    const percent = Math.min(100, Math.floor(100 * received / (engine.bytes + world.bytes)));
    label.textContent = percent === 100 ? '正在进入上海街景…' : '正在载入上海街景 · ' + percent + '%';
  }
  let decoder;
  function loadDecoder() {
    if (!decoder) decoder = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./touch-parts-v8/inflate.js', document.baseURI).href;
      script.onload = () => resolve(window.fflate);
      script.onerror = () => reject(new Error('解压组件下载失败'));
      document.head.append(script);
    });
    return decoder;
  }
  async function loadParts(asset, options) {
    const parts = new Array(Math.ceil(asset.bytes / size));
    let next = 0;
    async function worker() {
      while (next < parts.length) {
        const i = next++;
        const path = './touch-parts-v8/' + asset.key + '-' + i + '.bin';
        const expected = Math.min(size, asset.bytes - i * size);
        for (let attempt = 0; ; attempt++) {
          try {
            const r = await original(new URL(path, document.baseURI), options);
            if (!r.ok) throw new Error(String(r.status));
            const bytes = new Uint8Array(await r.arrayBuffer());
            if (bytes.length !== expected) throw new Error('下载未完成');
            parts[i] = bytes;
            report(bytes.length);
            break;
          } catch (e) {
            if (attempt >= 1 || options?.signal?.aborted) throw e;
          }
        }
      }
    }
    await Promise.all(Array.from({length: 4}, worker));
    const data = new Blob(parts);
    let body = data;
    if (asset === engine) {
      if (typeof window.DecompressionStream === 'function') {
        body = data.stream().pipeThrough(new DecompressionStream('gzip'));
      } else {
        const library = await loadDecoder();
        body = library.gunzipSync(new Uint8Array(await data.arrayBuffer()));
      }
    }
    return new Response(body, { headers: { 'Content-Type': asset.mime, 'Content-Length': String(asset.full) } });
  }
  window.fetch = async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input, document.baseURI);
    const asset = url.pathname.endsWith('/index.wasm') ? engine : url.pathname.endsWith('/echo-v8.pck') ? world : null;
    if (!asset || url.origin !== location.origin) return original(input, options);
    try { return await loadParts(asset, options); }
    catch (e) {
      if (options?.signal?.aborted) throw e;
      label.textContent = '正在重新连接，继续载入街景…';
      return original(input, options);
    }
  };
})();
