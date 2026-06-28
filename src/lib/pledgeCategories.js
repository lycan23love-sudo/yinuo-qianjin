export const PLEDGE_CATEGORIES = [
  {
    key: 'health', label: '健康运动', emoji: '🏃', indexName: '健康运动指数', groupName: '健康运动互助会',
    hint: '跑步、健身、减脂、睡眠、饮食管理',
    tags: ['跑步','健身','减肥','早睡','戒烟','戒酒','饮食控制','康复训练'],
    words: ['跑','健身','运动','锻炼','瑜伽','游泳','减肥','减脂','饮食','早睡','戒烟','戒酒','康复','公里']
  },
  {
    key: 'study', label: '学习成长', emoji: '📚', indexName: '学习成长指数', groupName: '学习成长互助会',
    hint: '读书、考试、语言、技能、AI 学习',
    tags: ['读书','考试','英语','编程','AI学习','技能训练','课程学习','考研考证'],
    words: ['读','学','英语','单词','考试','考研','考证','编程','ai','AI','技能','课程','产品','作业']
  },
  {
    key: 'habit', label: '生活习惯', emoji: '🌅', indexName: '生活习惯指数', groupName: '生活习惯互助会',
    hint: '早起、整理、少刷手机、情绪与作息',
    tags: ['早起','不熬夜','少刷手机','整理房间','冥想','情绪管理','戒色自控','规律作息'],
    words: ['早起','起床','早睡','睡觉','熬夜','手机','短视频','整理','打扫','冥想','情绪','拖延','戒色','自律','习惯','作息']
  },
  {
    key: 'finance', label: '财务目标', emoji: '💰', indexName: '财务目标指数', groupName: '财务目标互助会',
    hint: '存钱、记账、还债、控制消费、副业',
    tags: ['存钱','记账','还债','控制消费','副业收入','投资学习','不乱花钱'],
    words: ['存钱','记账','还债','消费','省钱','理财','收入','副业','赚钱','投资','不买','攒钱']
  },
  {
    key: 'creative', label: '创作输出', emoji: '✍️', indexName: '创作输出指数', groupName: '创作输出互助会',
    hint: '写作、绘画、视频、直播、作品日更',
    tags: ['写作','绘画','视频','直播','音乐','产品开发','日更','发布作品'],
    words: ['写作','写','画','绘画','创作','视频','直播','音乐','发布','输出','作品','剪辑','日更','公众号','短视频']
  },
  {
    key: 'other', label: '综合其他', emoji: '🧭', indexName: '综合自律指数', groupName: '综合互助会',
    hint: '关系、家庭、公益、修行、职场与其他誓言',
    tags: ['亲密关系','家庭陪伴','公益善行','宗教修行','职场目标','其他'],
    words: ['关系','家庭','陪伴','公益','志愿','修行','祷告','念经','职场','工作','其他']
  },
]

export const PRIMARY_PLEDGE_CATEGORIES = PLEDGE_CATEGORIES.filter(c => c.key !== 'other')
export const TRADED_INDEX_CATEGORIES = PRIMARY_PLEDGE_CATEGORIES.map(c => ({
  ...c,
  code: c.key === 'health' ? 'HEALTH' : c.key === 'study' ? 'STUDY' : c.key === 'habit' ? 'HABIT' : c.key === 'finance' ? 'FINANCE' : 'CREATIVE',
}))
export const CATEGORY_OPTIONS = [{ key: 'all', label: '全部', emoji: '🌐' }, ...PLEDGE_CATEGORIES]

export function getPledgeCategory(keyOrLabel) {
  if (!keyOrLabel) return PLEDGE_CATEGORIES[PLEDGE_CATEGORIES.length - 1]
  return PLEDGE_CATEGORIES.find(c => c.key === keyOrLabel || c.label === keyOrLabel || c.groupName === keyOrLabel) || PLEDGE_CATEGORIES[PLEDGE_CATEGORIES.length - 1]
}

export function inferPledgeCategory(pledge = {}) {
  const direct = pledge.category_key || pledge.category || pledge.main_category
  const directMatch = PLEDGE_CATEGORIES.find(c => c.key === direct || c.label === direct)
  if (directMatch) return directMatch
  const text = [pledge.title, pledge.category_tag, pledge.subcategory, pledge.type, pledge.verify_type].filter(Boolean).join(' ').toLowerCase()
  return PLEDGE_CATEGORIES.find(c => c.key !== 'other' && c.words.some(w => text.includes(String(w).toLowerCase()))) || getPledgeCategory('other')
}

export function inferPledgeTag(pledge = {}) {
  if (pledge.category_tag || pledge.subcategory) return pledge.category_tag || pledge.subcategory
  const category = inferPledgeCategory(pledge)
  const text = String(pledge.title || '').toLowerCase()
  return category.tags.find(tag => text.includes(tag.toLowerCase())) || category.tags[0] || category.label
}

export function categoryFilterMatches(pledge, keyOrLabel) {
  if (!keyOrLabel || keyOrLabel === 'all' || keyOrLabel === '全部') return true
  return inferPledgeCategory(pledge).key === keyOrLabel || inferPledgeCategory(pledge).label === keyOrLabel
}
