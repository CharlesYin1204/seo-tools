<template>
  <div class="container py-5">
    <div v-loading="loading">
      <div v-if="article">
        <nav aria-label="breadcrumb" class="mb-3">
          <ol class="breadcrumb">
            <li class="breadcrumb-item"><router-link to="/">首页</router-link></li>
            <li class="breadcrumb-item"><router-link to="/blog">博客</router-link></li>
            <li class="breadcrumb-item active">{{ article.title }}</li>
          </ol>
        </nav>

        <article class="mx-auto" style="max-width:800px">
          <img v-if="article.cover" :src="article.cover" class="w-100 rounded mb-4" style="max-height:400px;object-fit:cover" :alt="article.title">
          <h1 class="mb-3">{{ article.title }}</h1>
          <div class="d-flex gap-3 text-muted mb-4">
            <span><i class="bi bi-person"></i> {{ article.author || '管理员' }}</span>
            <span><i class="bi bi-calendar"></i> {{ article.created_at }}</span>
            <span><i class="bi bi-eye"></i> {{ article.views || 0 }} 浏览</span>
          </div>
          <div class="article-content" v-html="article.content"></div>
        </article>
      </div>
      <el-empty v-else-if="!loading" description="文章不存在" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'

const route = useRoute()
const article = ref(null)
const loading = ref(false)

onMounted(() => loadArticle())

async function loadArticle() {
  loading.value = true
  try {
    const res = await api.get(`/blog/${route.params.slug}`)
    article.value = res.data
  } catch {}
  loading.value = false
}
</script>

<style scoped>
.article-content { line-height: 1.8; font-size: 16px; }
.article-content :deep(img) { max-width: 100%; border-radius: 8px; margin: 16px 0; }
</style>
