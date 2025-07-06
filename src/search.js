// Search functionality module
let searchIndex = [];
let storiesData = [];

// Load search index and stories data
export async function loadSearchIndex() {
  try {
    const basePath = window.SITE_CONFIG?.basePath || './';
    const [searchResponse, storiesResponse] = await Promise.all([
      fetch(`${basePath}search-index.json`),
      fetch(`${basePath}stories.json`)
    ]);
    
    searchIndex = await searchResponse.json();
    storiesData = await storiesResponse.json();
  } catch (error) {
    console.error('Failed to load search index:', error);
  }
}

// Search function
export function searchStories(query) {
  if (!query.trim()) return searchIndex.map(story => ({ ...story, score: 0 }));
  
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  
  return searchIndex
    .map(story => {
      let score = 0;
      const searchableText = `${story.title} ${story.content} ${story.tags.join(' ')} ${story.category || ''} ${story.summary || ''}`.toLowerCase();
      
      searchTerms.forEach(term => {
        // Title matches get highest score
        if (story.title.toLowerCase().includes(term)) score += 10;
        // Category matches get high score
        if (story.category && story.category.toLowerCase().includes(term)) score += 8;
        // Tag matches get medium score
        if (story.tags.some(tag => tag.toLowerCase().includes(term))) score += 5;
        // Summary matches get medium score
        if (story.summary && story.summary.toLowerCase().includes(term)) score += 3;
        // Content matches get lower score
        if (searchableText.includes(term)) score += 1;
      });
      
      return { ...story, score };
    })
    .filter(story => story.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Initialize search
export async function initSearch() {
  await loadSearchIndex();
  
  const filterEl = document.getElementById('filter');
  const storiesGridEl = document.getElementById('stories-grid');
  
  if (!filterEl) return;
  
  // Check if we're on the homepage
  const isHomepage = window.location.pathname.endsWith('index.html') || 
                    window.location.pathname.endsWith('/') ||
                    window.location.pathname === '';
  
  if (isHomepage && storiesGridEl) {
    // Initial render of all stories
    renderStoriesGrid(storiesData);
    
    // Search input handler for homepage - real-time filtering
    filterEl.addEventListener('input', (e) => {
      const query = e.target.value;
      const results = searchStories(query);
      renderStoriesGrid(results);
    });
    
    // Check for search parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    if (searchQuery) {
      filterEl.value = searchQuery;
      const results = searchStories(searchQuery);
      renderStoriesGrid(results);
    }
  } else {
    // On story pages - wait for Enter key before redirecting
    filterEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = filterEl.value.trim();
        if (query) {
          window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        } else {
          window.location.href = 'index.html';
        }
      }
    });
    
    // Set focus to search box on story pages
    filterEl.focus();
  }
}

// Render stories grid
function renderStoriesGrid(stories) {
  const storiesGridEl = document.getElementById('stories-grid');
  if (!storiesGridEl) return;
  
  if (stories.length === 0) {
    storiesGridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #6c757d;">
        <h2>No stories found</h2>
        <p>Try adjusting your search terms.</p>
      </div>
    `;
    return;
  }
  
  const storiesHTML = stories.map(story => {
    const imageStyle = story.image ? `background-image: url('${story.image}')` : '';
    const dateStr = story.published_date ? new Date(story.published_date).toLocaleDateString() : '';
    
    return `
      <div class="story-panel" onclick="window.location.href='${story.slug}.html'">
        ${story.image ? `<div class="story-image" style="${imageStyle}"></div>` : ''}
        <div class="story-content">
          <div class="story-meta">
            ${story.category ? `<span class="story-category">${story.category}</span>` : ''}
            ${dateStr ? `<span class="story-date">${dateStr}</span>` : ''}
          </div>
          <h3 class="story-title">${story.title}</h3>
          ${story.summary ? `<p class="story-summary">${story.summary}</p>` : ''}
          ${story.tags && story.tags.length > 0 ? `
            <div class="story-tags">
              ${story.tags.slice(0, 3).map(tag => `<span class="story-tag">${tag}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  storiesGridEl.innerHTML = storiesHTML;
}

// Initialize navigation (simplified for news site)
export function initNavigation() {
  const menuToggle = document.getElementById('menu-toggle');
  
  // Mobile menu toggle (if needed for future features)
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      // Could be used for mobile navigation in the future
      console.log('Menu toggle clicked');
    });
  }
} 