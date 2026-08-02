import dayjs from 'dayjs'

/**
 * 将常见的小写格式串转换为 dayjs 支持的格式串。
 * 例：'yyyy-mm-dd hh:mm:ss' -> 'YYYY-MM-DD HH:mm:ss'、'yyyy-mm-dd' -> 'YYYY-MM-DD'
 */
function normalizeFormat(type: string): string {
  return type
    .replace(/yyyy/g, 'YYYY')
    .replace(/yy(?![a-z])/g, 'YY')
    .replace(/dd/g, 'DD')
    .replace(/hh/g, 'HH')
    .replace(/mm/g, (_match, offset, str) => {
      // mm 前后紧邻冒号（如 HH:mm:ss 中的分钟）时保留为分钟，否则视为月份
      const prev = str[offset - 1]
      const next = str[offset + 2]
      return prev === ':' || next === ':' ? 'mm' : 'MM'
    })
}

/**
 * 使用 dayjs 格式化日期。
 * @param date 日期数据（字符串 / 时间戳 / Date），无效值返回空字符串
 * @param type 格式化方式，如 'yyyy-mm-dd hh:mm:ss'、'yyyy-mm-dd' 等
 * @returns 格式化后的日期字符串；date 为空或无效时返回 ''
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  type = 'yyyy-mm-dd hh:mm:ss',
): string {
  if (date === null || date === undefined || date === '') return ''
  const d = dayjs(date)
  if (!d.isValid()) return ''
  return d.format(normalizeFormat(type))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
