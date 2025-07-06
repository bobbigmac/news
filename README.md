# World News

A clean, ad-free news site focused on major world stories. No clickbait, no fluff, just the facts you need to know. Built for GitHub Pages with automatic deployment via GitHub Actions.

## Adding News Stories

Drop a new `story-name.md` in `/news/` with:

```md
---
title: "Story Title"
published_date: "2024-01-15"
summary: "Brief summary of the story for the homepage"
category: "Politics"
tags: ["elections", "democracy", "international"]
image: "/assets/images/story-image.jpg"
external_links:
  - title: "Related Article"
    url: "https://example.com/article"
---

# Story Title

## Overview

Your story content here...

## Key Developments

More content...

## Analysis

Further analysis...
```

Push to main → GitHub Action builds and deploys automatically.

## Story Front Matter

- `title`: The story headline
- `published_date`: When the story was first published (YYYY-MM-DD)
- `summary`: Brief description for homepage cards
- `category`: Story category (Politics, Technology, etc.)
- `tags`: Array of relevant tags for search
- `image`: Optional featured image URL
- `external_links`: Array of related external links

## Setup

1. `npm ci` → `npm run build` locally
2. Push to main
3. Configure GitHub Pages to deploy from Actions workflow

# Features

## 🚀 Current Features

### News Management
- **Story Cards**: Clean homepage with story panels
- **Search & Filter**: Real-time search across titles, content, and tags
- **Categories**: Organize stories by topic
- **Living Documents**: Update stories as events develop

### User Experience
- **Responsive Design**: Works on all devices
- **Clean Typography**: Easy to read news content
- **No Ads**: Distraction-free reading experience
- **Fast Loading**: Static site generation

## 📋 Development Tasks

### Phase 2: Enhanced Features
1. Add story images and media support
2. Implement story categories and filtering
3. Add social sharing functionality
4. Create RSS feed generation

### Phase 3: Advanced Features
1. Add story timestamps and update tracking
2. Implement related stories suggestions
3. Add dark mode support
4. Create story archives by date

### Phase 4: Scale & Optimize
1. Add service worker for offline access
2. Generate SEO files (sitemap, robots.txt)
3. Implement analytics (privacy-focused)
4. Add story submission workflow
