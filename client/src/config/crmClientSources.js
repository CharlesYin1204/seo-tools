/**
 * CRM 客户来源：选项与展示文案（与后端 plugin_user_data.data_json 中 source 字段一致）
 * CRM-001
 */
export const CRM_SOURCE_COOPERATIVE_LISTING = 'cooperative_listing'

export const CRM_CLIENT_SOURCE_OPTIONS = [
  { value: CRM_SOURCE_COOPERATIVE_LISTING, label: '合作房源' },
  { value: 'wechat', label: '微信' },
  { value: 'referral', label: '朋友介绍' },
  { value: 'website', label: '网站' },
  { value: 'phone', label: '电话咨询' },
  { value: 'other', label: '其他' },
]

const labelMap = Object.fromEntries(CRM_CLIENT_SOURCE_OPTIONS.map((o) => [o.value, o.label]))

export function getCrmSourceLabel (value) {
  if (value == null || value === '') return '-'
  return labelMap[value] || String(value)
}
