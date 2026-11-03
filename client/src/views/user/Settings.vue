<template>
  <div class="user-settings-page">
    <!-- 页面头部 - 橙色渐变（与PHP版profile一致） -->
    <div class="page-header-profile">
      <div class="d-flex align-items-center">
        <div class="avatar-container me-4">
          <img :src="userAvatar" class="profile-avatar" alt="头像" @error="$event.target.src='/uploads/placeholder.png'" />
          <div class="avatar-edit-overlay" @click="triggerAvatarUpload">
            <i class="fas fa-camera"></i>
          </div>
        </div>
        <div>
          <h2>{{ profileForm.display_name || profileForm.username || '用户' }}</h2>
          <p class="mb-0 opacity-90">
            <i class="fas fa-envelope me-1"></i>{{ profileForm.email || '未设置邮箱' }}
          </p>
        </div>
      </div>
      <input ref="avatarInput" type="file" accept="image/*" style="display: none" @change="handleAvatarUpload" />
    </div>

    <!-- 设置卡片 -->
    <div class="settings-card">
      <el-tabs v-model="activeTab">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="profile">
          <div class="tab-content-inner">
            <el-form ref="profileFormRef" :model="profileForm" :rules="profileRules" label-width="100px" label-position="top" class="max-w-600">
              <div class="row g-3">
                <div class="col-md-6">
                  <el-form-item label="用户名" prop="username">
                    <el-input v-model="profileForm.username" disabled>
                      <template #prefix><i class="fas fa-user text-muted"></i></template>
                    </el-input>
                  </el-form-item>
                </div>
                <div class="col-md-6">
                  <el-form-item label="显示名称" prop="display_name">
                    <el-input v-model="profileForm.display_name" placeholder="显示名称">
                      <template #prefix><i class="fas fa-id-badge text-muted"></i></template>
                    </el-input>
                  </el-form-item>
                </div>
                <div class="col-md-6">
                  <el-form-item label="邮箱" prop="email">
                    <el-input v-model="profileForm.email" placeholder="邮箱">
                      <template #prefix><i class="fas fa-envelope text-muted"></i></template>
                    </el-input>
                  </el-form-item>
                </div>
                <div class="col-md-6">
                  <el-form-item label="手机号" prop="phone">
                    <el-input v-model="profileForm.phone" placeholder="手机号">
                      <template #prefix><i class="fas fa-phone text-muted"></i></template>
                    </el-input>
                  </el-form-item>
                </div>
              </div>
              <el-form-item class="mt-3">
                <el-button type="primary" :loading="profileLoading" @click="handleSaveProfile" class="btn-profile-save">
                  <i class="fas fa-save me-1"></i>保存修改
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 修改密码 -->
        <el-tab-pane label="修改密码" name="password">
          <div class="tab-content-inner">
            <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="120px" label-position="top" class="max-w-600">
              <el-form-item label="当前密码" prop="current_password">
                <el-input v-model="passwordForm.current_password" type="password" show-password placeholder="请输入当前密码">
                  <template #prefix><i class="fas fa-lock text-muted"></i></template>
                </el-input>
              </el-form-item>
              <el-form-item label="新密码" prop="new_password">
                <el-input v-model="passwordForm.new_password" type="password" show-password placeholder="请输入新密码（至少6位）">
                  <template #prefix><i class="fas fa-key text-muted"></i></template>
                </el-input>
              </el-form-item>
              <el-form-item label="确认新密码" prop="confirm_password">
                <el-input v-model="passwordForm.confirm_password" type="password" show-password placeholder="请再次输入新密码">
                  <template #prefix><i class="fas fa-key text-muted"></i></template>
                </el-input>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="passwordLoading" @click="handleChangePassword" class="btn-profile-save">
                  <i class="fas fa-shield-alt me-1"></i>修改密码
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api/modules/auth'
import { useAuthStore } from '@/store/auth'
import api from '@/api'

const authStore = useAuthStore()
const activeTab = ref('profile')
const profileFormRef = ref(null)
const passwordFormRef = ref(null)
const avatarInput = ref(null)
const profileLoading = ref(false)
const passwordLoading = ref(false)

const profileForm = reactive({
  username: '',
  display_name: '',
  email: '',
  phone: '',
  avatar: '',
})

const userAvatar = computed(() => {
  return profileForm.avatar || authStore.user?.avatar || '/uploads/placeholder.png'
})

const profileRules = {
  display_name: [{ max: 50, message: '显示名称不能超过50个字符', trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }],
}

const passwordForm = reactive({
  current_password: '',
  new_password: '',
  confirm_password: '',
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.new_password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  current_password: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

function triggerAvatarUpload() {
  avatarInput.value?.click()
}

async function handleAvatarUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await api.post('/user/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const url = res.data?.data?.url || res.data?.url || ''
    if (url) {
      profileForm.avatar = url
      await authApi.updateProfile({ avatar: url })
      await authStore.fetchProfile()
      ElMessage.success('头像更新成功')
    }
  } catch {
    ElMessage.error('头像上传失败')
  }
  e.target.value = ''
}

async function loadProfile() {
  try {
    const user = authStore.user
    if (user) {
      profileForm.username = user.username || ''
      profileForm.display_name = user.display_name || ''
      profileForm.email = user.email || ''
      profileForm.phone = user.phone || ''
      profileForm.avatar = user.avatar || ''
    }
    const res = await authApi.getProfile()
    const data = res.data || res
    profileForm.username = data.username || ''
    profileForm.display_name = data.display_name || ''
    profileForm.email = data.email || ''
    profileForm.phone = data.phone || ''
    profileForm.avatar = data.avatar || ''
  } catch {
    if (authStore.user) {
      profileForm.username = authStore.user.username || ''
      profileForm.display_name = authStore.user.display_name || ''
      profileForm.email = authStore.user.email || ''
      profileForm.phone = authStore.user.phone || ''
      profileForm.avatar = authStore.user.avatar || ''
    }
  }
}

async function handleSaveProfile() {
  const valid = await profileFormRef.value?.validate().catch(() => false)
  if (!valid) return
  profileLoading.value = true
  try {
    await authApi.updateProfile({
      display_name: profileForm.display_name,
      email: profileForm.email,
      phone: profileForm.phone,
    })
    await authStore.fetchProfile()
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally {
    profileLoading.value = false
  }
}

async function handleChangePassword() {
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid) return
  passwordLoading.value = true
  try {
    await authApi.changePassword({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    })
    ElMessage.success('密码修改成功，请重新登录')
    passwordForm.current_password = ''
    passwordForm.new_password = ''
    passwordForm.confirm_password = ''
    setTimeout(() => authStore.logout(), 1500)
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '密码修改失败')
  } finally {
    passwordLoading.value = false
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.user-settings-page { max-width: 900px; }

/* 个人资料头部 - 橙色渐变（与PHP版一致） */
.page-header-profile {
  background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
  color: white;
  border-radius: 16px;
  padding: 24px 32px;
  margin-bottom: 24px;
}
.page-header-profile h2 { font-size: 1.4rem; font-weight: 700; margin-bottom: 6px; }
.page-header-profile p { font-size: 14px; }

/* 头像 */
.avatar-container { position: relative; cursor: pointer; }
.profile-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.3); object-fit: cover;
}
.avatar-edit-overlay {
  position: absolute; bottom: 0; right: 0;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(0,0,0,0.5); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; transition: all 0.3s;
}
.avatar-edit-overlay:hover { background: rgba(0,0,0,0.7); }

/* 设置卡片 */
.settings-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.tab-content-inner { padding: 16px 0; }
.max-w-600 { max-width: 600px; }
.btn-profile-save {
  background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%) !important;
  border: none !important;
  color: white !important;
  border-radius: 10px !important;
  padding: 10px 24px !important;
}
.btn-profile-save:hover { opacity: 0.9; }

/* 响应式 */
@media (max-width: 767px) {
  .page-header-profile { padding: 16px; border-radius: 10px; margin-bottom: 12px; }
  .page-header-profile h2 { font-size: 1.1rem; }
  .profile-avatar { width: 60px; height: 60px; }
  .settings-card { padding: 12px; border-radius: 10px; }
}
</style>
