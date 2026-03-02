// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---

// Generar o recuperar el ID único del dispositivo
// Es como nuestra "matrícula" para saber quién pone qué post
const deviceId = (() => {
    let id = localStorage.getItem('lola_device_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lola_device_id', id);
    }
    return id;
})();

console.log("🚀 Identidad del dispositivo:", deviceId);

// Inicializar Supabase
const { createClient } = supabase;
const api = createClient(SB_URL, SB_KEY);

// --- 2. NAVEGACIÓN (SPA) ---

const routes = {
    '': 'feed',
    '#new': 'new_post'
};

function router() {
    const hash = window.location.hash;
    const view = routes[hash] || 'feed';
    const container = document.getElementById('view-container');

    if (view === 'feed') {
        renderFeed(container);
    } else if (view === 'new_post') {
        renderNewPost(container);
    }
}

async function renderFeed(container) {
    container.innerHTML = `
        <div class="fade-in">
            <div id="posts-list">
                <div class="loading-spinner">Cargando la red de Lola... 🐾</div>
            </div>
        </div>
    `;

    await fetchPosts();
}

async function fetchPosts() {
    const list = document.getElementById('posts-list');

    // 1. Pedimos los posts y sus likes asociados
    // Usamos una técnica de Supabase para traer los likes de cada post
    const { data: posts, error } = await api
        .from('posts')
        .select('*, likes(device_id)')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        list.innerHTML = `<p style="text-align:center">Error al despertar a Lola: ${error.message}</p>`;
        return;
    }

    if (posts.length === 0) {
        list.innerHTML = `<div class="glass card" style="text-align:center">
            <p>Aún no hay mensajes. ¡Sé el primero en ladrar algo! 🐶</p>
        </div>`;
        return;
    }

    list.innerHTML = posts.map(post => {
        const likeCount = post.likes ? post.likes.length : 0;
        const hasLiked = post.likes ? post.likes.some(l => l.device_id === deviceId) : false;
        const isFeatured = post.is_featured || false;

        return `
            <div class="glass card fade-in ${isFeatured ? 'card-featured' : ''}" id="post-${post.id}">
                <p class="post-content">${post.content}</p>
                <div class="post-meta">
                    <span>${new Date(post.created_at).toLocaleDateString()}</span>
                    <div class="post-actions">
                        <button class="action-btn btn-like" onclick="handleLikePost('${post.id}')" style="opacity: ${hasLiked ? '1' : '0.6'}">
                            ${hasLiked ? '❤️' : '🤍'} ${likeCount}
                        </button>
                        ${post.author_id === deviceId ? `
                            <button class="action-btn btn-star ${isFeatured ? 'active' : ''}" onclick="handleToggleFeature('${post.id}', ${isFeatured})">
                                ${isFeatured ? '⭐' : '☆'}
                            </button>
                            <button class="action-btn btn-delete" onclick="handleDeletePost('${post.id}')">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function handleToggleFeature(postId, currentStatus) {
    const { error } = await api
        .from('posts')
        .update({ is_featured: !currentStatus })
        .eq('id', postId)
        .eq('author_id', deviceId);

    if (error) {
        alert("Error al destacar: " + error.message);
    } else {
        fetchPosts(); // Refrescar vista
    }
}

async function handleLikePost(postId) {
    // Primero comprobamos si ya le hemos dado like localmente (para ir rápido)
    // Pero Supabase lo bloqueará igual gracias al UNIQUE que pusimos en SQL
    const { error } = await api
        .from('likes')
        .insert([{ post_id: postId, device_id: deviceId }]);

    if (error) {
        // Si el error es que ya existe el like, lo quitamos (dislike)
        if (error.code === '23505') {
            await api.from('likes').delete().eq('post_id', postId).eq('device_id', deviceId);
        } else {
            return console.error("Error con el corazón:", error.message);
        }
    }

    // Refrescamos para ver el nuevo conteo
    fetchPosts();
}

function renderNewPost(container) {
    container.innerHTML = `
        <div class="fade-in">
            <div class="glass card">
                <h2 style="margin-bottom: 1.5rem">¿Qué está pasando? 🐶</h2>
                <div class="form-group">
                    <textarea id="post-text" placeholder="¡Escribe algo increíble para la comunidad de Lola!"></textarea>
                    <button id="submit-btn" class="btn-primary" onclick="handleCreatePost()">Publicar</button>
                    <button class="nav-link" style="text-align:center; font-size: 0.9rem" onclick="location.hash=''">Cancelar</button>
                </div>
            </div>
        </div>
    `;
}

async function handleCreatePost() {
    const btn = document.getElementById('submit-btn');
    const content = document.getElementById('post-text').value;

    if (!content.trim()) return alert("¡No puedes publicar un post vacío!");

    btn.disabled = true;
    btn.innerText = "Publicando...";

    const { error } = await api
        .from('posts')
        .insert([
            { content: content, author_id: deviceId }
        ]);

    if (error) {
        alert("¡Error de red!: " + error.message);
        btn.disabled = false;
        btn.innerText = "Publicar";
    } else {
        window.location.hash = ''; // Volver al feed
    }
}

async function handleDeletePost(postId) {
    if (!confirm("¿Estás seguro de que quieres borrar este mensaje? 🐾")) return;

    const { error } = await api
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', deviceId); // Doble seguridad

    if (error) {
        alert("Lola no pudo borrar eso: " + error.message);
    } else {
        router(); // Refrescar vista
    }
}

// Escuchar cambios en la URL
window.addEventListener('hashchange', router);
window.addEventListener('load', router);
