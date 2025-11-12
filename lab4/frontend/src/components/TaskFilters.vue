<script setup>
defineProps(['searchQuery', 'statusFilter', 'sortBy'])
const emit = defineEmits(['update:searchQuery', 'update:statusFilter', 'update:sortBy'])
</script>

<template>
  <div class="filters card">
    <input
      type="text"
      :value="searchQuery"
      @input="emit('update:searchQuery', $event.target.value)"
      placeholder="Поиск по названию..."
    />
    <select :value="statusFilter" @change="emit('update:statusFilter', $event.target.value)">
      <option value="all">Все статусы</option>
      <option value="pending">Ожидает</option>
      <option value="in_progress">В процессе</option>
      <option value="completed">Завершено</option>
      <option value="cancelled">Отменено</option>
    </select>
    <select :value="sortBy" @change="emit('update:sortBy', $event.target.value)">
      <option value="createdAt_desc">Сначала новые</option>
      <option value="createdAt_asc">Сначала старые</option>
      <option value="dueDate_asc">По дате выполнения (возр.)</option>
      <option value="dueDate_desc">По дате выполнения (убыв.)</option>
    </select>
  </div>
</template>
