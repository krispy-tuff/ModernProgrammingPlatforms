<template>
  <div class="task" :class="task.status">
    <h3>{{ task.title }}</h3>
    <p>{{ task.description }}</p>
    <p><b>Статус:</b> {{ task.status }}</p>

    <ul class="attachments" v-if="task.attachments && task.attachments.length">
      <li v-for="att in task.attachments" :key="att.id">
        <a
          :href="`http://localhost:3000/api/tasks/${task.id}/attachments/${att.id}`"
          target="_blank"
        >
          {{ att.filename }}
        </a>
        <button @click="deleteAttachment(att)">❌</button>
      </li>
    </ul>

    <div class="actions">
      <router-link :to="'/tasks/' + task.id">Редактировать</router-link>
      <button @click="deleteTask">Удалить</button>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import axios from "axios";

export default defineComponent({
  props: ["task"],
  setup(props, { emit }) {
    const deleteTask = async () => {
      if (!confirm("Удалить задачу?")) return;
      await axios.delete(`/tasks/${props.task.id}`);
      emit("deleted");
    };

    const deleteAttachment = async (att) => {
      if (!confirm("Удалить файл?")) return;
      await axios.delete(`/tasks/${props.task.id}/attachments/${att.id}`);
      props.task.attachments = props.task.attachments.filter(
        (a) => a.id !== att.id
      );
    };

    return { deleteTask, deleteAttachment };
  },
});
</script>

<style scoped>
.task {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
.task.todo {
  border-left: 5px solid #f44336;
}
.task.current {
  border-left: 5px solid #2196f3;
}
.task.done {
  border-left: 5px solid #4caf50;
}
.actions {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}
.actions button,
.actions a {
  padding: 0.3rem 0.8rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.actions button {
  background: #f44336;
  color: white;
}
.actions a {
  background: #2196f3;
  color: white;
  text-decoration: none;
}
.attachments {
  list-style: none;
  padding: 0;
  margin-top: 0.5rem;
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
