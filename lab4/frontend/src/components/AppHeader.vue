<template>
  <header class="app-header-outer">
    <div class="container app-header">
      <h1>Менеджер задач</h1>
      <div class="header-actions">
        <button @click="$emit('addTask')" class="btn btn-primary">Добавить задачу</button>
        <button @click="$emit('logout')" class="btn btn-secondary">Выход</button>
      </div>
    </div>
  </header>
</template>

<script setup>
defineEmits(['addTask', 'logout'])
</script>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 1rem;
}
</style>
