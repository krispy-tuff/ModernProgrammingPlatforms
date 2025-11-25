const api = {
  async fetch(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', ...options });
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('unauthorized'));
      throw new Error('Unauthorized');
    }
    return response;
  },
  async graphql(query, variables = {}) {
    const res = await fetch('/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    if (json.errors && json.errors.length) {
      const msg = json.errors[0].message || 'GraphQL error';
      if (msg.toLowerCase().includes('unauthorized')) {
        window.dispatchEvent(new CustomEvent('unauthorized'));
      }
      throw new Error(msg);
    }
    return json.data;
  }
};

export default api;
