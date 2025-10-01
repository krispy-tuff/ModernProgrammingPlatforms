import { createRouter, createWebHistory } from "vue-router";
import TaskList from "../components/TaskList.vue";
import TaskForm from "../components/TaskForm.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: TaskList,
  },
  {
    path: "/new",
    name: "NewTask",
    component: TaskForm,
  },
  {
    path: "/tasks/:id",
    name: "EditTask",
    component: TaskForm,
    props: (route) => ({ taskId: route.params.id }),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
