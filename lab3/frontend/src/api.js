const api = {
  async fetch(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      // Broadcast a custom event that the App component can listen to.
      window.dispatchEvent(new CustomEvent('unauthorized'));
      throw new Error('Unauthorized');
    }
    return response;
  }
};

export default api;
