<template>
  <div class="menu-management">
    <div class="page-header">
      <h3 class="page-title"><i class="fas fa-bars me-2"></i>菜单管理</h3>
      <el-button type="primary" size="small" @click="openMenuDialog()"><i class="fas fa-plus me-1"></i>添加菜单</el-button>
    </div>

    <div class="card-container" v-loading="loading">
      <el-table :data="menus" row-key="id" border default-expand-all>
        <el-table-column prop="name" label="菜单名称" width="180" />
        <el-table-column prop="location" label="位置" width="100">
          <template #default="{ row }">{{ row.location || 'header' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openItemDialog(row)"><i class="fas fa-plus me-1"></i>添加项</el-button>
            <el-button size="small" text type="danger" @click="deleteMenu(row)"><i class="fas fa-trash"></i></el-button>
          </template>
        </el-table-column>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="menu-items-panel">
              <el-table :data="row.items || []" size="small" border>
                <el-table-column prop="title" label="标题" min-width="120" />
                <el-table-column prop="url" label="链接" min-width="150" />
                <el-table-column prop="target" label="打开方式" width="90">
                  <template #default="{ row: item }">{{ item.target || '_self' }}</template>
                </el-table-column>
                <el-table-column prop="icon" label="图标" width="80" />
                <el-table-column prop="sort_order" label="排序" width="70" />
                <el-table-column prop="status" label="状态" width="80">
                  <template #default="{ row: item }">
                    <el-tag :type="item.status === 1 || item.status === 'active' ? 'success' : 'info'" size="small">{{ item.status === 1 || item.status === 'active' ? '启用' : '停用' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="130" align="center">
                  <template #default="{ row: item }">
                    <el-button size="small" text type="primary" @click="openItemDialog(row, item)">编辑</el-button>
                    <el-button size="small" text type="danger" @click="deleteMenuItem(item)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 菜单编辑弹窗 -->
    <el-dialog v-model="menuDialogVisible" :title="menuForm.id ? '编辑菜单' : '添加菜单'" width="450px" destroy-on-close>
      <el-form :model="menuForm" label-position="top">
        <el-form-item label="菜单名称" required>
          <el-input v-model="menuForm.name" placeholder="例如：主导航" />
        </el-form-item>
        <el-form-item label="位置">
          <el-select v-model="menuForm.position" placeholder="选择位置" style="width: 100%">
            <el-option label="头部" value="header" />
            <el-option label="底部" value="footer" />
            <el-option label="侧边栏" value="sidebar" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="menuForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="menuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveMenu">保存</el-button>
      </template>
    </el-dialog>

    <!-- 菜单项编辑弹窗 -->
    <el-dialog v-model="itemDialogVisible" :title="itemForm.id ? '编辑菜单项' : '添加菜单项'" width="500px" destroy-on-close>
      <el-form :model="itemForm" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="itemForm.title" placeholder="菜单项标题" />
        </el-form-item>
        <el-form-item label="链接 URL">
          <el-input v-model="itemForm.url" placeholder="例如：/properties 或 https://..." />
        </el-form-item>
        <el-form-item label="打开方式">
          <el-select v-model="itemForm.target" placeholder="选择" style="width: 100%">
            <el-option label="当前窗口" value="_self" />
            <el-option label="新窗口" value="_blank" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="itemForm.icon" placeholder="例如：fa fa-home" />
        </el-form-item>
        <el-form-item label="父级 ID">
          <el-input-number v-model="itemForm.parent_id" :min="0" placeholder="0 表示顶级" style="width: 100%" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sort_order" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="itemForm.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveMenuItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const submitting = ref(false)
const menus = ref([])
const menuDialogVisible = ref(false)
const itemDialogVisible = ref(false)
const currentMenu = ref(null)

const menuForm = reactive({ id: null, name: '', position: 'header', status: 'active' })
const itemForm = reactive({
  id: null,
  title: '',
  url: '#',
  target: '_self',
  icon: '',
  parent_id: 0,
  sort_order: 0,
  status: 1,
})

onMounted(() => loadMenus())

async function loadMenus() {
  loading.value = true
  try {
    const res = await api.get('/admin/menus')
    menus.value = res.data || []
  } catch (e) {
    console.error('加载菜单失败:', e)
  }
  loading.value = false
}

function openMenuDialog(menu = null) {
  if (menu) {
    Object.assign(menuForm, { id: menu.id, name: menu.name || '', position: menu.location || 'header', status: menu.status || 'active' })
  } else {
    Object.assign(menuForm, { id: null, name: '', position: 'header', status: 'active' })
  }
  menuDialogVisible.value = true
}

async function saveMenu() {
  if (!menuForm.name) return ElMessage.warning('请输入菜单名称')
  submitting.value = true
  try {
    await api.post('/admin/menus', { id: menuForm.id, name: menuForm.name, position: menuForm.position, status: menuForm.status })
    ElMessage.success('保存成功')
    menuDialogVisible.value = false
    await loadMenus()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
  submitting.value = false
}

async function deleteMenu(menu) {
  try {
    await ElMessageBox.confirm(`确定删除菜单「${menu.name}」？将同时删除其下所有菜单项。`, '确认', { type: 'warning' })
    await api.delete(`/admin/menus/${menu.id}`)
    ElMessage.success('删除成功')
    await loadMenus()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

function openItemDialog(menu, item = null) {
  currentMenu.value = menu
  if (item) {
    Object.assign(itemForm, {
      id: item.id,
      title: item.title || '',
      url: item.url || '#',
      target: item.target || '_self',
      icon: item.icon || '',
      parent_id: item.parent_id || 0,
      sort_order: item.sort_order || 0,
      status: item.status !== undefined ? item.status : 1,
    })
  } else {
    Object.assign(itemForm, {
      id: null,
      title: '',
      url: '#',
      target: '_self',
      icon: '',
      parent_id: 0,
      sort_order: (menu.items?.length || 0),
      status: 1,
    })
  }
  itemDialogVisible.value = true
}

async function saveMenuItem() {
  if (!itemForm.title) return ElMessage.warning('请输入标题')
  if (!currentMenu.value) return
  submitting.value = true
  try {
    await api.post(`/admin/menus/${currentMenu.value.id}/items`, {
      id: itemForm.id,
      title: itemForm.title,
      url: itemForm.url || '#',
      target: itemForm.target || '_self',
      icon: itemForm.icon || '',
      parent_id: itemForm.parent_id || 0,
      sort_order: itemForm.sort_order || 0,
      status: itemForm.status,
    })
    ElMessage.success('保存成功')
    itemDialogVisible.value = false
    await loadMenus()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
  submitting.value = false
}

async function deleteMenuItem(item) {
  try {
    await ElMessageBox.confirm(`确定删除菜单项「${item.title}」？`, '确认', { type: 'warning' })
    await api.delete(`/admin/menu-items/${item.id}`)
    ElMessage.success('删除成功')
    await loadMenus()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}
</script>

<style scoped>
.menu-management .page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.menu-management .page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
}
.menu-management .card-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.menu-management .menu-items-panel {
  padding: 16px 24px;
  background: #f8f9fa;
}
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
</style>
