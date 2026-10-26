import request from '@/utils/request'

// 更新说明沿用后台「通知公告」：类型为 1（版本通知），状态 0（正常），标题为版本号（不带 v 前缀）。
// 发现新版本时直接在更新下载弹窗里合并展示。
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 标题里的版本号需要完整匹配：1.0.2 不能误匹配 1.0.27
const buildVersionMatcher = (version) =>
  new RegExp('(?<![\\d.])' + escapeRegExp(version) + '(?!\\d|\\.\\d)')

// 查询指定版本的更新说明（按创建时间倒序）；失败静默返回空数组
export async function fetchUpdateNoticesByVersion(version) {
  const text = String(version || '').trim().replace(/^v/i, '')
  if (!text) return []

  try {
    const res = await request({
      url: '/system/notice/list',
      method: 'get',
      params: {
        pageNum: 1,
        pageSize: 50,
        noticeTitle: text,
        noticeType: '1',
        status: '0'
      },
      headers: { silent: true }
    })
    const matcher = buildVersionMatcher(text)
    const rows = Array.isArray(res?.rows) ? res.rows : []
    return rows
      .filter(notice =>
        String(notice.status ?? '0') === '0' &&
        notice.noticeTitle &&
        matcher.test(String(notice.noticeTitle).trim())
      )
      .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
  } catch (error) {
    console.warn('[UpdateNotice] 读取更新说明失败，仅展示下载进度:', error)
    return []
  }
}
