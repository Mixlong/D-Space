/**
 * 头像URL处理工具
 */

/**
 * 获取完整的头像URL
 * @param {string} avatarPath - 头像路径
 * @returns {string} 完整的头像URL，如果是默认头像则返回空字符串
 */
export function getAvatarUrl(avatarPath) {
  if (!avatarPath) {
    return ''
  }
  
  // 过滤掉默认头像路径，返回空字符串让颜色背景生效
  if (avatarPath.includes('default') || avatarPath.includes('profile.jpg')) {
    return ''
  }
  
  // 如果已经是完整的URL（http或https开头），直接返回
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath
  }
  
  // 如果是相对路径，拼接基础URL
  const baseUrl = import.meta.env.VITE_APP_BASE_API
  
  // 确保路径以 / 开头
  const path = avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`
  
  return `${baseUrl}${path}`
}
