<template>
  <div>
    <h2>Все задачи</h2>
    <div class="tasks">
      <TaskItem
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @deleted="loadTasks"
      />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import axios from "axios";
import TaskItem from "./TaskItem.vue";

export default {
  components: { TaskItem },
  setup() {
    const tasks = ref([]);

    const loadTasks = async () => {
      const res = await axios.get("/tasks");
      tasks.value = res.data;
    };

    onMounted(loadTasks);

    return { tasks, loadTasks };
  },
};
</script>

<style scoped>
.tasks {
  display: grid;
  gap: 1rem;
}
</style>
