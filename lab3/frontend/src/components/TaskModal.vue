<script setup>
import { ref, computed } from 'vue';
import BaseModal from './BaseModal.vue';
import TaskForm from './TaskForm.vue';

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  taskToEdit: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'add-task', 'update-task']);

const taskFormRef = ref(null);

const isEditMode = computed(() => !!props.taskToEdit);
const modalTitle = computed(() => isEditMode.value ? 'Редактировать задачу' : 'Добавить задачу');

function handleFormSubmit(formData) {
  if (isEditMode.value) {
    emit('update-task', formData);
  } else {
    emit('add-task', formData);
  }
}

function triggerFormSubmit() {
  if (taskFormRef.value) {
    taskFormRef.value.handleSubmit();
  }
}

function closeModal() {
  emit('close');
}

</script>

<template>
  <BaseModal
    :show="show"
    :title="modalTitle"
    @close="closeModal"
    @submit="triggerFormSubmit"
  >
    <TaskForm
      ref="taskFormRef"
      :task="taskToEdit"
      @submit="handleFormSubmit"
    />
  </BaseModal>
</template>
