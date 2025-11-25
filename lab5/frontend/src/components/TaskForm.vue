<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  task: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['submit']);

const form = ref({});
const newlyAddedFiles = ref([]);
const attachmentsToDelete = ref([]);
const fileInput = ref(null);

const visibleAttachments = computed(() => {
  if (!form.value || !form.value.attachments) return [];
  return form.value.attachments.filter(
    att => !attachmentsToDelete.value.includes(att.id)
  );
});

watch(() => props.task, (newTask) => {
  if (newTask) {
    form.value = JSON.parse(JSON.stringify(newTask));
    if (form.value.dueDate) {
      form.value.dueDate = form.value.dueDate.split('T')[0];
    }
  } else {
    form.value = {
      title: '',
      description: '',
      dueDate: '',
      status: 'pending'
    };
  }
  newlyAddedFiles.value = [];
  attachmentsToDelete.value = [];
}, { immediate: true });

function handleFileSelect(event) {
  if (event.target.files) {
    newlyAddedFiles.value.push(...event.target.files);
    event.target.value = '';
  }
}

function removeNewFile(index) {
  newlyAddedFiles.value.splice(index, 1);
}

function stageAttachmentForDeletion(attachmentId) {
  attachmentsToDelete.value.push(attachmentId);
}

function handleSubmit() {
  emit('submit', {
    task: form.value,
    files: newlyAddedFiles.value,
    attachmentsToDelete: attachmentsToDelete.value
  });
}

// Expose handleSubmit to be callable from the parent
defineExpose({ handleSubmit });

</script>

<template>
  <form @submit.prevent="handleSubmit" id="task-form">
    <div class="form-group">
      <label>Название</label>
      <input type="text" v-model="form.title" required>
    </div>
    <div class="form-group">
      <label>Описание</label>
      <textarea v-model="form.description"></textarea>
    </div>
    <div class="form-group">
      <label>Дата выполнения</label>
      <input type="date" v-model="form.dueDate">
    </div>
    <div class="form-group">
      <label>Статус</label>
      <select v-model="form.status">
        <option value="pending">Ожидает</option>
        <option value="in_progress">В процессе</option>
        <option value="completed">Завершено</option>
        <option value="cancelled">Отменено</option>
      </select>
    </div>
    <div class="form-group">
      <label>Вложения</label>
      <div class="file-uploader">
        <button type="button" @click="fileInput.click()" class="btn">Добавить файл</button>
        <input type="file" ref="fileInput" @change="handleFileSelect" multiple style="display: none;">
        <ul class="file-list">
          <li v-for="file in visibleAttachments" :key="file.id">
            <a :href="file.path" :download="file.originalName" target="_blank">{{ file.originalName }}</a>
            <button @click.stop.prevent="stageAttachmentForDeletion(file.id)" type="button" class="btn-remove">&times;</button>
          </li>
          <li v-for="(file, index) in newlyAddedFiles" :key="index">
            {{ file.name }} <button @click="removeNewFile(index)" type="button" class="btn-remove">&times;</button>
          </li>
        </ul>
      </div>
    </div>
  </form>
</template>
