import { writeFileSync, readdirSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';

const API_KEY = 'lCOF86JDor85-nGp2pjExpsDbnxjW5nP3JK7w1w2KB6P7UKL';
const API_BASE_URL = 'https://api.currentsapi.services/v1';

// Fetch latest news across all categories
const LATEST_NEWS_LIMIT = 100;
const MAX_STORIES_TO_KEEP = 100; // Keep last 100 stories

// Generate a slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);
}

function yamlEscape(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function yamlSummary(summary) {
  if (!summary) return 'summary: ""';
  if (summary.includes('\n')) {
    return `summary: |\n  ${summary.replace(/\n/g, '\n  ')}`;
  }
  return `summary: "${yamlEscape(summary)}"`;
}

async function fetchLatestNews(limit = LATEST_NEWS_LIMIT, country = null) {
  try {
    let url = `${API_BASE_URL}/latest-news?language=en&apiKey=${API_KEY}`;
    if (country) {
      url += `&country=${country}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.news || [];
  } catch (error) {
    console.error(`Error fetching latest news${country ? ` for ${country}` : ''}:`, error.message);
    return null; // null signals a hard failure
  }
}

function newsToMarkdown(newsItem, isArchived = false) {
  const publishedDate = new Date(newsItem.published).toISOString().split('T')[0];
  const slug = generateSlug(newsItem.title);
  
  // Use category from API or default to 'General'
  const category = (newsItem.category || 'General').toString();
  
  const tags = [category.toLowerCase()];
  if (newsItem.keywords) {
    const keywords = newsItem.keywords.split(',').slice(0, 3).map(k => k.trim().toLowerCase());
    tags.push(...keywords.filter(k => k.length > 0));
  }
  
  const cleanTitle = yamlEscape(newsItem.title);
  const cleanSummary = newsItem.description ? newsItem.description.replace(/\r/g, '').replace(/\n+/g, ' ').trim() : `Latest breaking news`;
  const cleanImage = newsItem.image ? yamlEscape(newsItem.image) : '';
  const cleanUrl = newsItem.url ? yamlEscape(newsItem.url) : '';
  
  let yaml = `---\n`;
  yaml += `title: "${cleanTitle}"\n`;
  yaml += `published_date: "${publishedDate}"\n`;
  yaml += `${yamlSummary(cleanSummary)}\n`;
  yaml += `category: "${category.charAt(0).toUpperCase() + category.slice(1)}"\n`;
  yaml += `tags: ${JSON.stringify(tags)}\n`;
  yaml += `story_id: "${newsItem.id || ''}"\n`;
  if (isArchived) yaml += `archived: true\n`;
  if (cleanImage) yaml += `image: "${cleanImage}"\n`;
  yaml += `external_links:\n  - title: "Read full article"\n    url: "${cleanUrl}"\n`;
  yaml += `---\n\n`;

  const markdown = `${yaml}# ${newsItem.title}\n\n## Overview\n\n${newsItem.description || 'Latest breaking news.'}\n\n## Key Details\n\n${newsItem.content || newsItem.description || 'For more information, please refer to the full article linked below.'}\n\n## Source\n\nThis story was originally published by ${newsItem.author || newsItem.source || 'various sources'}.\n\n---\n\n*This article was automatically generated from current news sources. For the most up-to-date information, please refer to the original source.*\n`;

  return { slug, markdown, storyId: newsItem.id };
}

// Load existing stories and their IDs
function loadExistingStories(newsDir) {
  if (!existsSync(newsDir)) return new Map();
  
  const existingStories = new Map();
  const files = readdirSync(newsDir);
  
  for (const file of files) {
    if (file.endsWith('.md')) {
      try {
        const content = readFileSync(join(newsDir, file), 'utf8');
        const storyIdMatch = content.match(/story_id:\s*"([^"]+)"/);
        if (storyIdMatch) {
          existingStories.set(storyIdMatch[1], {
            file,
            content,
            slug: file.replace('.md', '')
          });
        }
      } catch (error) {
        console.warn(`Could not read ${file}:`, error.message);
      }
    }
  }
  
  return existingStories;
}

// Delete stories that are no longer in our keep list
function deleteOldStories(newsDir, keepStoryIds) {
  if (!existsSync(newsDir)) return;
  
  const files = readdirSync(newsDir);
  for (const file of files) {
    if (file.endsWith('.md')) {
      try {
        const content = readFileSync(join(newsDir, file), 'utf8');
        const storyIdMatch = content.match(/story_id:\s*"([^"]+)"/);
        if (storyIdMatch && !keepStoryIds.has(storyIdMatch[1])) {
          unlinkSync(join(newsDir, file));
          console.log(`Deleted old story: ${file}`);
        }
      } catch (error) {
        console.warn(`Could not process ${file}:`, error.message);
      }
    }
  }
}

async function generateNewsFiles() {
  console.log('Fetching latest news from Currents API...');
  const newsDir = 'news';
  
  // Fetch both global and UK news
  console.log('Fetching global latest news...');
  const globalNews = await fetchLatestNews(LATEST_NEWS_LIMIT);
  if (globalNews === null) {
    console.error('API failure or quota exceeded. Aborting. No files will be modified.');
    return;
  }
  
  // Add delay between requests to avoid rate limiting
  console.log('Waiting 2 seconds before fetching UK news...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('Fetching UK latest news...');
  const ukNews = await fetchLatestNews(LATEST_NEWS_LIMIT, 'gb');
  if (ukNews === null) {
    console.error('UK news API failure. Continuing with global news only.');
  }
  
  // Combine and deduplicate by story ID
  const allNews = new Map();
  
  // Add global news first
  for (const newsItem of globalNews) {
    if (newsItem.id) {
      allNews.set(newsItem.id, newsItem);
    }
  }
  
  // Add UK news (will overwrite duplicates, keeping UK version if same story)
  if (ukNews) {
    for (const newsItem of ukNews) {
      if (newsItem.id) {
        allNews.set(newsItem.id, newsItem);
      }
    }
  }
  
  const newsItems = Array.from(allNews.values());
  
  if (newsItems.length === 0) {
    console.error('No latest news fetched. Aborting. No files will be modified.');
    return;
  }
  
  console.log(`Combined ${globalNews.length} global + ${ukNews ? ukNews.length : 0} UK stories = ${newsItems.length} unique stories`);
  
  // Load existing stories
  const existingStories = loadExistingStories(newsDir);
  console.log(`Found ${existingStories.size} existing stories`);
  
  // Process new stories and track which ones to keep
  const keepStoryIds = new Set();
  const newStories = [];
  const updatedStories = [];
  
  for (const newsItem of newsItems) {
    const storyId = newsItem.id;
    if (!storyId) {
      console.warn('Story missing ID, skipping:', newsItem.title);
      continue;
    }
    
    keepStoryIds.add(storyId);
    
    if (existingStories.has(storyId)) {
      // Update existing story (might have new metadata)
      const { slug, markdown } = newsToMarkdown(newsItem, false);
      updatedStories.push({ storyId, slug, markdown });
      console.log(`Updated existing story: ${slug}.md`);
    } else {
      // New story
      const { slug, markdown } = newsToMarkdown(newsItem, false);
      newStories.push({ storyId, slug, markdown });
      console.log(`New story: ${slug}.md`);
    }
  }
  
  // Mark old stories as archived (but keep them)
  for (const [storyId, story] of existingStories) {
    if (!keepStoryIds.has(storyId)) {
      // This story is no longer in latest news, mark as archived
      const content = story.content;
      if (!content.includes('archived: true')) {
        const updatedContent = content.replace('story_id:', 'archived: true\nstory_id:');
        writeFileSync(join(newsDir, story.file), updatedContent);
        console.log(`Marked as archived: ${story.file}`);
      }
    }
  }
  
  // Write new and updated stories
  for (const { slug, markdown } of [...newStories, ...updatedStories]) {
    const filePath = join(newsDir, `${slug}.md`);
    writeFileSync(filePath, markdown);
  }
  
  // Clean up very old stories if we exceed the limit
  const totalStories = existingStories.size + newStories.length;
  if (totalStories > MAX_STORIES_TO_KEEP) {
    console.log(`Total stories (${totalStories}) exceeds limit (${MAX_STORIES_TO_KEEP}), cleaning up oldest...`);
    deleteOldStories(newsDir, keepStoryIds);
  }
  
  console.log(`\nNews generation complete! Added ${newStories.length} new stories, updated ${updatedStories.length} existing stories.`);
}

generateNewsFiles().catch(console.error); 