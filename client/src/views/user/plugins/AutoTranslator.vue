<template>
  <div class="translator-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-language me-2"></i>自动翻译助手</div>
      <div class="plugin-card-body">
        <div class="trans-layout">
          <div class="trans-panel">
            <div class="trans-head">
              <select v-model="sourceLang" class="form-select form-select-sm">
                <option value="auto">自动检测</option>
                <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
              </select>
            </div>
            <textarea v-model="sourceText" class="form-control trans-input" rows="8" placeholder="输入需要翻译的内容...&#10;支持内容资产描述、客户沟通、合同条款等各类文本"></textarea>
            <div class="trans-stats"><span class="text-muted small">{{ sourceText.length }}字</span></div>
          </div>
          <div class="trans-middle">
            <button class="btn btn-primary btn-swap" @click="swapLang" title="互换"><i class="fas fa-exchange-alt"></i></button>
            <button class="btn btn-primary btn-translate" @click="translate" :disabled="translating">
              <i class="fas" :class="translating ? 'fa-spinner fa-spin' : 'fa-arrow-right'"></i>
            </button>
          </div>
          <div class="trans-panel">
            <div class="trans-head">
              <select v-model="targetLang" class="form-select form-select-sm">
                <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
              </select>
            </div>
            <textarea v-model="resultText" class="form-control trans-input" rows="8" placeholder="翻译结果将显示在这里..." readonly></textarea>
            <div class="trans-stats">
              <button v-if="resultText" class="btn btn-sm btn-success" @click="copyResult"><i class="fas fa-copy me-1"></i>复制</button>
            </div>
          </div>
        </div>
        <div class="quick-phrases mt-4">
          <h6><i class="fas fa-bolt me-1"></i>常用短语快速翻译</h6>
          <div class="phrase-grid">
            <button v-for="(p, i) in quickPhrases" :key="i" class="phrase-btn" @click="usePhrase(p)">{{ p }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })

const languages = [
  { code: 'zh', name: '中文' }, { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' }, { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' }, { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
]

const quickPhrases = [
  '这套房子月租金是多少？', '可以安排查看内容吗？', '包含物业费吗？',
  '最短租期是多久？', '这个小区外国人多吗？', '有车位吗？',
  '家电齐全吗？', '合同可以做英文版吗？', '押金是多少？',
]

const sourceLang = ref('auto')
const targetLang = ref('en')
const sourceText = ref('')
const resultText = ref('')
const translating = ref(false)

const translate = async () => {
  if (!sourceText.value.trim()) return ElMessage.warning('请输入需要翻译的内容')
  translating.value = true
  try {
    const res = await api.post('/user/plugin-exec/translate', {
      text: sourceText.value, source_lang: sourceLang.value, target_lang: targetLang.value
    })
    resultText.value = res.data?.data?.translated || ''
    ElMessage.success('翻译完成')
  } catch (err) {
    ElMessage.error('翻译失败: ' + (err.response?.data?.message || err.message))
  }
  translating.value = false
}

const swapLang = () => {
  if (sourceLang.value === 'auto') sourceLang.value = 'zh'
  const tmp = sourceLang.value; sourceLang.value = targetLang.value; targetLang.value = tmp
  const tmpT = sourceText.value; sourceText.value = resultText.value; resultText.value = tmpT
}

const usePhrase = (p) => { sourceText.value = p }

const copyResult = () => {
  navigator.clipboard.writeText(resultText.value).then(() => ElMessage.success('已复制')).catch(() => {
    const t = document.createElement('textarea'); t.value = resultText.value; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); ElMessage.success('已复制')
  })
}
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #11998e, #38ef7d); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.trans-layout { display: grid; grid-template-columns: 1fr 60px 1fr; gap: 12px; align-items: start; }
@media (max-width: 768px) { .trans-layout { grid-template-columns: 1fr; } .trans-middle { display: flex; justify-content: center; } }
.trans-head { margin-bottom: 8px; }
.trans-head .form-select { width: auto; min-width: 120px; }
.trans-input { resize: vertical; font-size: 14px; }
.trans-stats { margin-top: 6px; display: flex; justify-content: space-between; align-items: center; }
.trans-middle { display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; padding-top: 40px; }
.btn-swap { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0; }
.btn-translate { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0; }
.quick-phrases h6 { font-size: 14px; margin-bottom: 10px; }
.phrase-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.phrase-btn { background: #f0f2f5; border: 1px solid #e0e0e0; border-radius: 20px; padding: 4px 14px; font-size: 12px; cursor: pointer; transition: all .2s; }
.phrase-btn:hover { background: #4879FF; color: #fff; border-color: #4879FF; }
</style>
