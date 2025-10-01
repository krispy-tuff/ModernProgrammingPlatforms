<template>
  <div class="task-form">
    <form @submit.prevent="saveTask">
      <label>Название</label>
      <input v-model="task.title" required />

      <label>Описание</label>
      <textarea v-model="task.description"></textarea>

      <label>Статус</label>
      <select v-model="task.status">
        <option value="todo">Надо сделать</option>
        <option value="current">В процессе</option>
        <option value="done">Готово</option>
      </select>

      <label>Вложения</label>
      <div class="drop-area" @dragover.prevent @drop.prevent="handleDrop">
        Перетащите файлы сюда или кликните для выбора
        <input
          type="file"
          multiple
          ref="fileInput"
          @change="handleFiles"
          hidden
        />
      </div>
      <button type="button" @click="fileInput.click()">Выбрать файлы</button>

      <ul class="attachments" v-if="combinedAttachments.length">
        <li v-for="f in combinedAttachments" :key="f.id || f.name">
          <span>{{ f.original_name || f.name }}</span>
          <button type="button" @click="removeFile(f)">❌</button>
        </li>
      </ul>

      <button type="submit">Сохранить</button>
    </form>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from "vue";
import axios from "axios";

export default {
  props: ["taskId"],
  setup(props, { emit }) {
    const task = reactive({
      title: "",
      description: "",
      status: "todo",
      attachments: [],
    });
    const files = ref([]);
    const deletedIds = ref([]);
    const fileInput = ref(null);

    const combinedAttachments = computed(() => [
      ...task.attachments.filter((a) => !deletedIds.value.includes(a.id)),
      ...files.value,
    ]);

    const handleFiles = (e) => {
      const selected = Array.from(e.target.files);
      files.value.push(...selected);
    };

    const handleDrop = (e) => {
      const dropped = Array.from(e.dataTransfer.files);
      files.value.push(...dropped);
    };

    const removeFile = (f) => {
      if (f.id) deletedIds.value.push(f.id);
      else files.value.splice(files.value.indexOf(f), 1);
    };

    const loadTask = async () => {
      if (!props.taskId) return;
      const res = await axios.get(`/tasks/${props.taskId}`);
      Object.assign(task, res.data);
    };

    const saveTask = async () => {
      let taskRes;
      if (props.taskId) {
        taskRes = await axios.put(`/tasks/${props.taskId}`, {
          title: task.title,
          description: task.description,
          status: task.status,
        });
      } else {
        taskRes = await axios.post("/tasks", {
          title: task.title,
          description: task.description,
          status: task.status,
        });
        task.id = taskRes.data.id;
      }

      // Удаляем старые файлы
      for (const id of deletedIds.value) {
        await axios.delete(`/tasks/${props.taskId}/attachments/${id}`);
      }

      // Загружаем новые файлы
      if (files.value.length) {
        const formData = new FormData();
        files.value.forEach((f) => formData.append("file", f));
        await axios.post(`/tasks/${props.taskId}/attachments`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      window.location.href = "/"; // Можно потом заменить на router.push
    };

    onMounted(loadTask);

    return {
      task,
      files,
      deletedIds,
      fileInput,
      combinedAttachments,
      handleFiles,
      handleDrop,
      removeFile,
      saveTask,
    };
  },
};
</script>

<style scoped>
.task-form {
  max-width: 600px;
  margin: auto;
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  display: grid;
  gap: 1rem;
}
input,
textarea,
select {
  width: 100%;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #ccc;
}
button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  border: none;
}
button[type="submit"] {
  background: #4caf50;
  color: white;
}
.drop-area {
  border: 2px dashed #ccc;
  padding: 1rem;
  text-align: center;
  border-radius: 4px;
  cursor: pointer;
  background: #fafafa;
}
.attachments {
  list-style: none;
  padding: 0;
}
.attachments li {
  display: flex;
  justify-content: space-between;
  background: #f4f4f4;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  margin-bottom: 0.3rem;
}
</style>
