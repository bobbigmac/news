import { readFileSync, readdirSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true });

const srcDir = 'news';
const outDir = 'docs';

mkdirSync(outDir, { recursive: true });

// Build news stories and collect meta
const list = [];
for (const file of readdirSync(srcDir)) {
  if (!file.endsWith('.md')) continue;
  const srcPath = join(srcDir, file);
  const src = readFileSync(srcPath, 'utf8');
  const { data, content } = matter(src);
  const slug = file.replace(/\.md$/, '');
  
  // Clean up common markdown formatting issues
  let cleanedContent = content
    .replace(/^\s+##/gm, '##') // Remove leading spaces before headers
    .replace(/^\s+[-*]/gm, (match) => match.trim()) // Remove leading spaces before list items
    .replace(/^\s+\d+\./gm, (match) => match.trim()) // Remove leading spaces before numbered lists
    .trim();
  
  // Parse content into sections and create custom HTML structure
  const sections = cleanedContent.split('## ');
  let htmlBody = '';
  
  if (sections.length > 1) {
    // Title section (first section)
    const titleSection = sections[0].trim();
    if (titleSection) {
      htmlBody += `<h1>${titleSection.replace('# ', '')}</h1>`;
    }
    
    // Add metadata if available
    if (data.published_date) {
      htmlBody += `<div class="story-meta">
        <time datetime="${data.published_date}">${new Date(data.published_date).toLocaleDateString()}</time>
      </div>`;
    }
    
    if (data.summary) {
      htmlBody += `<div class="story-summary">
        <p>${data.summary}</p>
      </div>`;
    }
    
    // Create content sections
    htmlBody += '<div class="story-content">';
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section) continue;
      
      const lines = section.split('\n');
      const sectionTitle = lines[0].trim();
      const sectionContent = lines.slice(1).join('\n').trim();
      
      // Render section content as markdown
      const sectionHtml = md.render(`## ${section}`);
      htmlBody += sectionHtml;
    }
    
    htmlBody += '</div>';
  } else {
    // Fallback to standard markdown rendering
    htmlBody = md.render(cleanedContent);
  }
  
  const title = data.title || slug;
  
  // Add external links if specified in front matter
  if (data.external_links && data.external_links.length > 0) {
    htmlBody += `
      <div class="external-links-section">
        <h2>Related Links</h2>
        <ul>
          ${data.external_links.map(link => 
            `<li><a href="${link.url}" target="_blank" rel="noopener">${link.title || link.url}</a></li>`
          ).join('')}
        </ul>
      </div>
    `;
  }

  const fullHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><header><button id="menu-toggle" class="menu-toggle" aria-label="Toggle menu">☰</button><h1><a href="index.html">News</a></h1><input type="search" id="filter" placeholder="Search stories…"/></header><aside id="list"></aside><main id="content">${htmlBody}</main><script>window.SITE_CONFIG={basePath:'./'};</script><script type="module" src="app.js"></script></body></html>`;
  writeFileSync(join(outDir, `${slug}.html`), fullHtml);

  list.push({ 
    slug, 
    title, 
    tags: data.tags || [],
    published_date: data.published_date,
    summary: data.summary,
    image: data.image,
    category: data.category
  });
}

// Sort stories by published date (newest first)
list.sort((a, b) => {
  if (!a.published_date && !b.published_date) return 0;
  if (!a.published_date) return 1;
  if (!b.published_date) return -1;
  return new Date(b.published_date) - new Date(a.published_date);
});

// Write listing
writeFileSync(join(outDir, 'stories.json'), JSON.stringify(list, null, 2));

// Create search index
const searchIndex = list.map(story => {
  const storyPath = join(srcDir, `${story.slug}.md`);
  const storyContent = readFileSync(storyPath, 'utf8');
  const { content } = matter(storyContent);
  
  // Clean content for search
  const cleanContent = content
    .replace(/^\s+##/gm, '##')
    .replace(/^\s+[-*]/gm, (match) => match.trim())
    .replace(/^\s+\d+\./gm, (match) => match.trim())
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase();
  
  return {
    slug: story.slug,
    title: story.title,
    tags: story.tags,
    category: story.category,
    summary: story.summary,
    content: cleanContent,
    url: `./${story.slug}.html`
  };
});

writeFileSync(join(outDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

// Copy static assets
copyFileSync('src/index.html', join(outDir, 'index.html'));
copyFileSync('src/style.css', join(outDir, 'style.css'));
copyFileSync('src/app.js', join(outDir, 'app.js'));
copyFileSync('src/search.js', join(outDir, 'search.js'));
copyFileSync('src/share.js', join(outDir, 'share.js'));

console.log('Build complete. Stories:', list.length);
