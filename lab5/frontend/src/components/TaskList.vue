<script setup>
import TaskItem from './TaskItem.vue';

defineProps({
  tasks: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['update-task-status', 'edit-task', 'delete-task']);

function handleUpdateStatus(task) {
  emit('update-task-status', task);
}

function handleEditTask(task) {
  emit('edit-task', task);
}

function handleDeleteTask(taskId) {
  emit('delete-task', taskId);
}
</script>

<template>
  <div class="task-list">
    <div v-if="!tasks.length" class="task-card empty">
      Задачи не найдены. Попробуйте изменить фильтры или добавить новую задачу.
    </div>
    <TaskItem
      v-for="task in tasks"
      :key="task.id"
      :task="task"
      @update-status="handleUpdateStatus"
      @edit-task="handleEditTask"
      @delete-task="handleDeleteTask"
    />
  </div>
</template>
