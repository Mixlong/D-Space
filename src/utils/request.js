import axios from 'axios'
import { ElNotification, ElMessageBox, ElMessage, ElLoading } from 'element-plus'
import { getToken, setToken } from '@/utils/auth'
import errorCode from '@/utils/errorCode'
import { tansParams, blobValidate } from '@/utils/ruoyi'
import cache from '@/plugins/cache'
import { saveAs } from 'file-saver'
import useUserStore from '@/store/modules/user'
import { getIamValue, updateIamFromResponse } from '@/utils/iam'
import { decrypt } from '@/utils/jsencrypt'

let downloadLoadingInstance
// 是否显示重新登录
export let isRelogin = { show: false }
// 后台静默请求（如自动更新检查）：失败时不弹出错误提示
const isSilentRequest = (config) => config?.headers?.silent === true
// 是否正在执行自动登录
let isAutoLogging = false
// 等待自动登录完成的请求队列
let pendingRequests = []

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8'
// 创建axios实例
const service = axios.create({
  // axios中请求配置有baseURL选项，表示请求URL公共部分
  baseURL: import.meta.env.VITE_APP_BASE_API,
  // 超时
  timeout: 10000
})

// request拦截器
service.interceptors.request.use(config => {
  // 沿用当前 IAM；新 IAM 保存后下一次登录会自动使用新值
  try {
    const iamValue = getIamValue()
    if (/\/login(?:\?|$)/.test(config.url) && iamValue) {
      config.headers['iam'] = iamValue
    }
  } catch (error) {
    console.warn('[Request] 读取 IAM 失败:', error)
  }

  // 是否需要设置 token
  const isToken = (config.headers || {}).isToken === false
  // 是否需要防止数据重复提交
  const isRepeatSubmit = (config.headers || {}).repeatSubmit === false
  if (getToken() && !isToken) {
    config.headers['Authorization'] = 'Bearer ' + getToken() // 让每个请求携带自定义token 请根据实际情况自行修改
  }
  // get请求映射params参数
  if (config.method === 'get' && config.params) {
    let url = config.url + '?' + tansParams(config.params)
    url = url.slice(0, -1)
    config.params = {}
    config.url = url
  }
  if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
    const requestObj = {
      url: config.url,
      data: typeof config.data === 'object' ? JSON.stringify(config.data) : config.data,
      time: new Date().getTime()
    }
    const requestSize = Object.keys(JSON.stringify(requestObj)).length // 请求数据大小
    const limitSize = 5 * 1024 * 1024 // 限制存放数据5M
    if (requestSize >= limitSize) {
      console.warn(`[${config.url}]: ` + '请求数据大小超出允许的5M限制，无法进行防重复提交验证。')
      return config
    }
    const sessionObj = cache.session.getJSON('sessionObj')
    if (sessionObj === undefined || sessionObj === null || sessionObj === '') {
      cache.session.setJSON('sessionObj', requestObj)
    } else {
      const s_url = sessionObj.url                // 请求地址
      const s_data = sessionObj.data              // 请求数据
      const s_time = sessionObj.time              // 请求时间
      const interval = 1000                       // 间隔时间(ms)，小于此时间视为重复提交
      if (s_data === requestObj.data && requestObj.time - s_time < interval && s_url === requestObj.url) {
        const message = '数据正在处理，请勿重复提交'
        console.warn(`[${s_url}]: ` + message)
        return Promise.reject(new Error(message))
      } else {
        cache.session.setJSON('sessionObj', requestObj)
      }
    }
  }
  return config
}, error => {
  console.log(error)
  Promise.reject(error)
})

// 响应拦截器
service.interceptors.response.use(async res => {
  // 未设置状态码则默认成功状态
  const code = res.data.code || 200
  // 获取错误信息
  const msg = errorCode[code] || res.data.msg || errorCode['default']
  // 二进制数据则直接返回
  if (res.request.responseType === 'blob' || res.request.responseType === 'arraybuffer') {
    return res.data
  }
  if (code === 401) {
    // 获取原始请求配置，用于重试
    const originalConfig = res.config
    // 公开认证接口和已重试请求不得再触发静默登录，防止连续验证
    if (originalConfig?._iamAuthRetried || originalConfig?.headers?.isToken === false || /\/login(?:\?|$)/.test(originalConfig?.url || '')) {
      return Promise.reject(new Error('身份认证失败，请重新登录'))
    }

    // 检查是否有保存的账号密码（记住密码）
    const rememberMe = localStorage.getItem('rememberMe') === 'true'
    const savedUsername = localStorage.getItem('username')
    const savedPassword = localStorage.getItem('password')

    // 如果有保存的账号密码，可以尝试自动登录
    if (rememberMe && savedUsername && savedPassword) {
      // 返回一个 Promise，等待自动登录完成后重试请求
      return new Promise((resolve, reject) => {
        // 将当前请求加入等待队列
        pendingRequests.push({ config: originalConfig, resolve, reject })

        // 如果当前没有正在执行的自动登录，启动自动登录
        if (!isAutoLogging) {
          console.log('[Request] Token已过期，尝试静默自动登录...')
          isAutoLogging = true
          performAutoLogin(savedUsername, savedPassword)
        } else {
          console.log('[Request] Token已过期，已有自动登录进行中，请求加入等待队列')
        }
      })
    }

    // 没有保存账号密码，静默跳转到登录页
    if (!isRelogin.show) {
      isRelogin.show = true
      console.log('[Request] Token已过期，没有保存的账号密码，跳转到登录页')
      useUserStore().logOut().then(() => {
        isRelogin.show = false
        // 静默跳转到登录页，不弹窗
        import('@/router').then(module => {
          const router = module.default
          router.push('/login')
        }).catch(err => {
          console.error('[Request] Router跳转失败，使用fallback方式:', err)
          window.location.hash = '#/login'
        })
      })
    }
    return Promise.reject('无效的会话，或者会话已过期，请重新登录。')
  } else if (code === 500) {
    if (!isSilentRequest(res.config)) ElMessage({ message: msg, type: 'error' })
    return Promise.reject(new Error(msg))
  } else if (code === 601) {
    if (!isSilentRequest(res.config)) ElMessage({ message: msg, type: 'warning' })
    return Promise.reject(new Error(msg))
  } else if (code === 40010) {
    // 需要短信验证码，不显示错误提示，直接抛出错误码
    return Promise.reject(code)
  } else if (code !== 200) {
    if (!isSilentRequest(res.config)) ElNotification.error({ title: msg })
    return Promise.reject('error')
  } else {
    // 只接受登录及短信认证接口签发的新 IAM，避免普通业务响应误覆盖认证凭据。
    if (/\/(?:login|sms\/verify)(?:\?|$)/.test(res.config?.url || '')) {
      await updateIamFromResponse(res.data)
    }
    return Promise.resolve(res.data)
  }
},
  error => {
    console.log('err' + error)
    let { message } = error
    if (message == "Network Error") {
      message = "后端接口连接异常"
    } else if (message.includes("timeout")) {
      message = "系统接口请求超时"
    } else if (message.includes("Request failed with status code")) {
      message = "系统接口" + message.substr(message.length - 3) + "异常"
    }
    if (!isSilentRequest(error.config)) {
      ElMessage({ message: message, type: 'error', duration: 5 * 1000 })
    }
    return Promise.reject(error)
  }
)

// 通用下载方法
export function download(url, params, filename, config) {
  downloadLoadingInstance = ElLoading.service({ text: "正在下载数据，请稍候", background: "rgba(0, 0, 0, 0.7)", })
  return service.post(url, params, {
    transformRequest: [(params) => { return tansParams(params) }],
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    responseType: 'blob',
    ...config
  }).then(async (data) => {
    const isBlob = blobValidate(data)
    if (isBlob) {
      const blob = new Blob([data])
      saveAs(blob, filename)
    } else {
      const resText = await data.text()
      const rspObj = JSON.parse(resText)
      const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default']
      ElMessage.error(errMsg)
    }
    downloadLoadingInstance.close()
  }).catch((r) => {
    console.error(r)
    ElMessage.error('下载文件出现错误，请联系管理员！')
    downloadLoadingInstance.close()
  })
}
/**
 * 执行静默自动登录
 * 登录成功后会重试所有等待中的请求
 * 注意：此函数的逻辑需要与 login.vue 的登录流程完全对齐
 * @param {string} username - 用户名
 * @param {string} encryptedPassword - 加密后的密码（存储在 localStorage 中）
 */
async function performAutoLogin(username, encryptedPassword) {
  try {
    // 解密密码（与 login.vue 的 getCookie 逻辑一致）
    const password = decrypt(encryptedPassword)

    if (!password) {
      console.error('[AutoLogin] 无法解密密码')
      handleAutoLoginFailure()
      return
    }

    console.log('[AutoLogin] 开始静默登录，用户:', username)

    // 构建请求头（与 request.js 拦截器中的逻辑完全一致）
    const headers = {
      'Content-Type': 'application/json;charset=utf-8'
    }

    // 静默登录和手动登录使用同一份最新 IAM
    try {
      const iamValue = getIamValue()
      if (iamValue) {
        headers['iam'] = iamValue
      }
    } catch (e) {
      console.warn('[AutoLogin] 读取 IAM 信息失败:', e)
    }

    // 使用独立的 axios 实例进行登录，避免循环拦截
    // 请求数据格式与 api/login.js 的 login 方法一致
    const loginResponse = await axios.post(
      `${import.meta.env.VITE_APP_BASE_API}/login`,
      { username, password },
      { headers }
    )

    // 检查登录响应（与 userStore.login 的处理逻辑一致）
    if (loginResponse.data && loginResponse.data.code === 200 && loginResponse.data.token) {
      const newToken = loginResponse.data.token
      await updateIamFromResponse(loginResponse.data)

      // 保存新 Token（与 userStore.login 一致）
      setToken(newToken)
      useUserStore().token = newToken

      console.log('[AutoLogin] 静默登录成功，开始重试等待中的请求...')

      // 重试所有等待中的请求
      const requests = [...pendingRequests]
      pendingRequests = []
      isAutoLogging = false

      for (const { config, resolve, reject } of requests) {
        try {
          // 更新 Token 且最多重试一次，防止 401 循环登录
          config.headers['Authorization'] = 'Bearer ' + newToken
          config._iamAuthRetried = true
          // 重新发送请求
          const retryResponse = await service(config)
          resolve(retryResponse)
        } catch (error) {
          reject(error)
        }
      }
    } else {
      // 登录失败（如密码错误、账号被禁用等）
      console.warn('[AutoLogin] 登录返回非成功状态:', loginResponse.data)
      handleAutoLoginFailure()
    }
  } catch (error) {
    console.error('[AutoLogin] 静默登录失败:', error)
    handleAutoLoginFailure()
  }
}

/**
 * 处理自动登录失败
 * 清除保存的账号密码，拒绝所有等待中的请求，跳转到登录页
 */
function handleAutoLoginFailure() {
  // 清除可能已过期/失效的保存账号信息
  localStorage.removeItem('rememberMe')
  localStorage.removeItem('username')
  localStorage.removeItem('password')

  // 拒绝所有等待中的请求
  const requests = [...pendingRequests]
  pendingRequests = []
  isAutoLogging = false

  for (const { reject } of requests) {
    reject('自动登录失败，请重新登录')
  }

  // 静默跳转到登录页
  useUserStore().logOut().then(() => {
    import('@/router').then(module => {
      const router = module.default
      router.push('/login')
    }).catch(() => {
      window.location.hash = '#/login'
    })
  })
}

export default service
