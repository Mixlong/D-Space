// 通用外部链接/新窗口打开封装，复用 Electron API 或浏览器能力
import { getToken } from '@/utils/auth'

const hasElectronAPI = () =>
  typeof window !== 'undefined' && window.electronAPI;

// 窗口管理：最多保持2个打开的窗口（可通过 setMaxWindows 修改）
let MAX_WINDOWS = 2
const openedWindows = []

// 设置最大窗口数量
export function setMaxWindows(max) {
  if (typeof max === 'number' && max > 0) {
    MAX_WINDOWS = max
  }
}

// 获取当前打开的窗口数量
export function getOpenWindowsCount() {
  cleanClosedWindows()
  return openedWindows.length
}

// 清理已关闭的窗口引用
const cleanClosedWindows = () => {
  for (let i = openedWindows.length - 1; i >= 0; i--) {
    if (openedWindows[i].closed) {
      openedWindows.splice(i, 1)
    }
  }
}

// 管理窗口数量
const manageWindows = (newWindow) => {
  if (!newWindow || newWindow.closed) return
  
  // 清理已关闭的窗口
  cleanClosedWindows()
  
  // 添加新窗口到数组
  openedWindows.push(newWindow)
  
  // 如果超过最大数量，关闭最早打开的窗口
  while (openedWindows.length > MAX_WINDOWS) {
    const oldestWindow = openedWindows.shift()
    if (oldestWindow && !oldestWindow.closed) {
      try {
        oldestWindow.close()
      } catch (e) {
        console.warn('[窗口管理] 关闭窗口失败:', e)
      }
    }
  }
}

const normalizeToken = (token, stripBearer = true) => {
  const effectiveToken =
    token === undefined || token === null ? getToken() : token;

  if (!effectiveToken) return '';

  return stripBearer && effectiveToken.toLowerCase().startsWith('bearer ')
    ? effectiveToken.replace(/^bearer\s+/i, '')
    : effectiveToken;
};

// 合并查询参数
export function buildUrlWithParams(baseUrl, params = {}) {
  const entries = Object.entries(params || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (!entries.length) return baseUrl;
  try {
    const parsed = new URL(baseUrl);
    entries.forEach(([key, value]) => parsed.searchParams.set(key, value));
    return parsed.toString();
  } catch (_err) {
    // 若 baseUrl 不是合法 URL，直接拼接
    const joiner = baseUrl.includes('?') ? '&' : '?';
    const query = entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${baseUrl}${joiner}${query}`;
  }
}

// 组装带 token 的 URL，默认去掉 Bearer 前缀，可附加额外参数
export function buildUrlWithToken(baseUrl, token, options = {}) {
  const {
    paramName = 'token',
    stripBearer = true,
    extraParams = {}
  } = options;
  const normalizedToken = normalizeToken(token, stripBearer);

  const params = { ...extraParams };
  if (normalizedToken) {
    params[paramName] = normalizedToken;
  }

  return buildUrlWithParams(baseUrl, params);
}

// 系统默认浏览器打开
export function openExternalLink(url) {
  if (!url) return;

  if (hasElectronAPI() && window.electronAPI.openExternal) {
    try {
      window.electronAPI.openExternal(url);
      return;
    } catch (error) {
      console.error('[linkOpener] Electron openExternal 失败，使用 window.open', error);
    }
  }
  window.open(url, '_blank');
}

// 新窗口打开（优先 Electron，回退浏览器），可自动带 token
export function openNewWindowWithToken({
  baseUrl,
  token,
  paramName = 'token',
  stripBearer = true,
  extraParams = {}
} = {}) {
  if (!baseUrl) return;
  const url = buildUrlWithToken(baseUrl, token, {
    paramName,
    stripBearer,
    extraParams
  });

  if (hasElectronAPI() && window.electronAPI.openInNewWindow) {
    try {
      window.electronAPI.openInNewWindow(url);
      return url;
    } catch (error) {
      console.error('[linkOpener] Electron openInNewWindow 失败，使用 window.open', error);
    }
  }

  // 浏览器环境：管理窗口数量
  const newWindow = window.open(url, '_blank');
  manageWindows(newWindow);
  return url;
}

// 新窗口打开已拼好的 URL（不额外处理 token）
export function openNewWindowUrl(url) {
  if (!url) return;

  if (hasElectronAPI() && window.electronAPI.openInNewWindow) {
    try {
      window.electronAPI.openInNewWindow(url);
      return;
    } catch (error) {
      console.error('[linkOpener] Electron openInNewWindow 失败，使用 window.open', error);
    }
  }
  
  // 浏览器环境：管理窗口数量
  const newWindow = window.open(url, '_blank');
  manageWindows(newWindow);
}
