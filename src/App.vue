<script setup>
import { onMounted } from 'vue';
import UrlForm from './components/UrlForm.vue';
import UrlList from './components/UrlList.vue';
import { useUrlStore } from './stores/url';

const urlStore = useUrlStore();

onMounted(() => {
  // Inicializar datos
  urlStore.fetchUrls();
});
</script>

 <template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow py-6 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800 ">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
        <h1 class="text-3xl font-bold text-gray-800 text-center text-white">Gestor URL</h1>
      </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <UrlForm />
      <UrlList />
    </main>

    <footer class=" border-t border-gray-200 py-6 mt-12 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-center text-white text-sm">
          © 2025 Gestor URL - Sistema de revisión de URL
          <span class="text-lg font-bold">
            TicTac Comunicación

          </span>
        </p>
      </div>
    </footer>
  </div>
</template>
<style scoped>
button {
  color: black;
  background: #BBF33A;
}
</style>