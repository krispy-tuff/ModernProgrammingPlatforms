<template>
  <div class="login-form-container">
    <form @submit.prevent="handleSubmit" class="login-form">
      <h2>{{ isLoginMode ? 'Вход' : 'Регистрация' }}</h2>
      
      <div class="form-group">
        <label for="login">Логин</label>
        <input type="text" id="login" v-model="username" required>
      </div>
      <div class="form-group">
        <label for="password">Пароль</label>
        <input type="password" id="password" v-model="password" required>
      </div>

      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

      <button type="submit">{{ isLoginMode ? 'Войти' : 'Зарегистрироваться' }}</button>

      <p class="toggle-mode">
        <a href="#" @click.prevent="toggleMode">
          {{ isLoginMode ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите' }}
        </a>
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['success']);

const username = ref('');
const password = ref('');
const error = ref(null);
const successMessage = ref(null);
const isLoginMode = ref(true);

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value;
  error.value = null;
  successMessage.value = null;
};

const handleSubmit = () => {
  if (isLoginMode.value) {
    login();
  } else {
    register();
  }
};

const login = async () => {
  error.value = null;
  successMessage.value = null;
  try {
    const res = await fetch('/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation Login($login: String!, $password: String!) { login(login: $login, password: $password) { message user { id login } } }`,
        variables: { login: username.value, password: password.value }
      })
    });
    const json = await res.json();
    if (json.errors && json.errors.length) {
      error.value = json.errors[0].message || 'Ошибка входа';
      return;
    }
    emit('success');
  } catch (e) {
    error.value = 'Не удалось подключиться к серверу';
  }
};

const register = async () => {
  error.value = null;
  successMessage.value = null;
  try {
    const res = await fetch('/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation Register($login: String!, $password: String!) { register(login: $login, password: $password) { message user { id login } } }`,
        variables: { login: username.value, password: password.value }
      })
    });
    const json = await res.json();
    if (json.errors && json.errors.length) {
      error.value = json.errors[0].message || 'Ошибка регистрации';
      return;
    }
    successMessage.value = 'Регистрация прошла успешно! Теперь вы можете войти.';
    isLoginMode.value = true;
  } catch (e) {
    error.value = 'Не удалось подключиться к серверу';
  }
};
</script>

<style scoped>
.login-form-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--bg-color);
}

.login-form {
  background: var(--card-bg-color);
  padding: 2.5rem 2rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 100%;
  max-width: 380px;
  text-align: center;
}

h2 {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--text-color);
}

.form-group {
  margin-bottom: 1rem;
  text-align: left;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--subtle-text-color);
}

input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--card-bg-color);
  color: var(--text-color);
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
}

.error-message {
  color: var(--danger-color);
  margin-bottom: 1rem;
  text-align: left;
}

.success-message {
  color: #16a34a; /* Green for success */
  margin-bottom: 1rem;
  text-align: left;
}

button[type="submit"] {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: var(--primary-color);
  color: var(--card-bg-color);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
}

button[type="submit"]:hover {
  background-color: var(--primary-hover-color);
}

.toggle-mode a {
  color: var(--subtle-text-color);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.toggle-mode a:hover {
  color: var(--primary-color);
  text-decoration: underline;
}
</style>
