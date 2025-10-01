<template>
  <div id="app">
    <header>
      <h1>📋 Task Manager</h1>
      <nav>
        <router-link to="/">Главная</router-link>
        <router-link to="/new">Новая задача</router-link>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  setup() {
    // В этом компоненте пока нет состояния, но мы оставили setup для консистентности
    return {};
  },
});
</script>

<style scoped>
#app {
  font-family: "Segoe UI", sans-serif;
  background: #f4f6f8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
header {
  background: #2196f3;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
nav a {
  color: white;
  margin-left: 1rem;
  text-decoration: none;
  font-weight: 500;
}
nav a.router-link-active {
  text-decoration: underline;
}
main {
  flex: 1;
  padding: 2rem;
}
</style>
